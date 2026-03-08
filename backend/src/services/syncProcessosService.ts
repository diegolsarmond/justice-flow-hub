/**
 * Serviço de sincronização de processos com a API PDPJ.
 * Extraído de entityRoutes.ts para reutilização pelo scheduler e pela rota POST.
 */

import { supabaseAdmin } from '../config/supabase';

// ── Tipos ────────────────────────────────────────────────────────────────────
export type ProcessoItem = Record<string, unknown> & {
    numeroProcesso?: string;
    siglaTribunal?: string;
    nivelSigilo?: number;
    idCodexTribunal?: number;
    tramitacoes?: Array<Record<string, unknown>>;
    tramitacaoAtual?: Record<string, unknown>;
};

export interface SyncProcessosParams {
    empresaId: number;
    usuarioId: number;
    uf: string;
    numero: string;
}

export interface SyncProcessosResult {
    fetched: number;
    persisted: number;
    detalhesConsultados: number;
    partesPersistidas: number;
    movimentosPersistidos: number;
    documentosPersistidos: number;
    error?: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
export function toText(value: unknown): string | null {
    if (value == null) return null;
    if (typeof value === 'string') { const t = value.trim(); return t.length > 0 ? t : null; }
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return null;
}

export function toNumber(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '') { const p = Number(value); return Number.isFinite(p) ? p : null; }
    return null;
}

export function toBoolean(value: unknown, fb = false): boolean {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') {
        const v = value.trim().toLowerCase();
        if (['true', '1', 'sim', 'yes'].includes(v)) return true;
        if (['false', '0', 'nao', 'não', 'no'].includes(v)) return false;
    }
    return fb;
}

export function toIso(value: unknown): string | null {
    const raw = toText(value);
    if (!raw) return null;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
}

function normalizeNumeroProcesso(n: string): string {
    return n.replace(/\D/g, '');
}

function pickTramitacao(item: ProcessoItem): Record<string, unknown> | null {
    if (item.tramitacaoAtual && typeof item.tramitacaoAtual === 'object') return item.tramitacaoAtual;
    if (Array.isArray(item.tramitacoes) && item.tramitacoes.length > 0) {
        const active = item.tramitacoes.find((t) => typeof t === 'object' && t && (t as Record<string, unknown>).ativo === true);
        const first = active ?? item.tramitacoes[0];
        return typeof first === 'object' && first ? first as Record<string, unknown> : null;
    }
    return null;
}

function pickActiveTramitacao(tramitacoes: unknown): Record<string, unknown> | null {
    if (!Array.isArray(tramitacoes) || tramitacoes.length === 0) return null;
    const active = tramitacoes.find((t) => typeof t === 'object' && t && (t as Record<string, unknown>).ativo === true);
    const first = active ?? tramitacoes[0];
    return typeof first === 'object' && first ? first as Record<string, unknown> : null;
}

// ── Buscar token PDPJ ───────────────────────────────────────────────────────
export async function fetchPdpjToken(): Promise<string | null> {
    const { data: tokenRow, error } = await supabaseAdmin
        .from('token_jusbr')
        .select('access_token')
        .eq('expired', false)
        .order('datatimerenewal', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        console.error('[syncProcessos] Erro ao buscar token PDPJ:', error);
        return null;
    }

    return (tokenRow?.access_token as string) ?? null;
}

// ── Função principal de sync ────────────────────────────────────────────────
export async function syncProcessosPdpj(params: SyncProcessosParams): Promise<SyncProcessosResult> {
    const { empresaId, usuarioId, uf, numero } = params;
    const TAG = `[syncProcessos OAB=${numero}/${uf}]`;

    // 1. Token
    const pdpjToken = await fetchPdpjToken();
    if (!pdpjToken) {
        console.error(`${TAG} Nenhum token PDPJ válido encontrado.`);
        return { fetched: 0, persisted: 0, detalhesConsultados: 0, partesPersistidas: 0, movimentosPersistidos: 0, documentosPersistidos: 0, error: 'Token PDPJ ausente' };
    }

    console.log(`${TAG} Token obtido (prefixo): ${pdpjToken.substring(0, 40)}...`);

    // 2. Fetch de processos (paginação com searchAfter)
    const limite = 100;
    const maxPaginas = 50;
    let searchAfter: string[] | null = null;
    const fetchedItems: ProcessoItem[] = [];
    let paginaAtual = 0;

    while (paginaAtual < maxPaginas) {
        const query = new URLSearchParams({ oabRepresentante: `${uf}${numero}`, size: String(limite) });
        if (searchAfter && searchAfter.length > 0) query.set('searchAfter', searchAfter.join(','));

        const url = `https://portaldeservicos.pdpj.jus.br/api/v2/processos?${query.toString()}`;
        console.log(`${TAG} Página ${paginaAtual}: ${url}`);

        let response: globalThis.Response | null = null;
        for (let attempt = 0; attempt < 4; attempt++) {
            if (attempt > 0) {
                const delayMs = Math.min(5000 * Math.pow(2, attempt - 1), 30000);
                console.log(`${TAG} 429 rate-limit, retentativa ${attempt}/3, aguardando ${delayMs}ms...`);
                await new Promise((resolve) => setTimeout(resolve, delayMs));
            }

            response = await fetch(url, {
                headers: {
                    'Accept': 'application/json, text/plain, */*',
                    'Authorization': `Bearer ${pdpjToken}`,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
                },
            });

            if (response.status !== 429) break;
        }

        if (!response || !response.ok) {
            const body = response ? await response.text() : 'No response';
            const status = response?.status ?? 0;
            console.error(`${TAG} PDPJ API erro HTTP ${status} na página ${paginaAtual}:`, body.slice(0, 500));
            if (status === 401 || status === 403 || status === 500) {
                console.error(`${TAG} Possível token inválido/expirado.`);
            }
            break;
        }

        const result = await response.json() as Record<string, unknown>;
        const content = Array.isArray(result.content) ? result.content as ProcessoItem[] : [];
        fetchedItems.push(...content);

        const apiTotal = result.total;
        console.log(`${TAG} Página ${paginaAtual}: ${content.length} items, total API: ${apiTotal}, acumulado: ${fetchedItems.length}`);

        const nextSearch = Array.isArray(result.searchAfter)
            ? result.searchAfter.map((v: unknown) => toText(v)).filter((v: string | null): v is string => !!v)
            : [];

        paginaAtual += 1;

        if (content.length === 0) { console.log(`${TAG} Parando: content vazio`); break; }
        if (nextSearch.length === 0) { console.log(`${TAG} Parando: searchAfter vazio`); break; }
        if (content.length < limite) { console.log(`${TAG} Parando: última página (${content.length} < ${limite})`); break; }

        searchAfter = nextSearch;
        await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    console.log(`${TAG} Fetched ${fetchedItems.length} processos da API PDPJ`);

    // 3. Hidratar detalhes
    const hydratedItems: ProcessoItem[] = [];
    let detalhesConsultados = 0;

    for (const item of fetchedItems) {
        const numeroProcesso = toText(item.numeroProcesso);
        if (!numeroProcesso) { hydratedItems.push(item); continue; }

        const numeroNormalizado = normalizeNumeroProcesso(numeroProcesso);
        try {
            const detailResponse = await fetch(`https://portaldeservicos.pdpj.jus.br/api/v2/processos/${numeroNormalizado}`, {
                headers: { 'Accept': 'application/json, text/plain, */*', 'Authorization': `Bearer ${pdpjToken}` },
            });

            if (!detailResponse.ok) { hydratedItems.push(item); continue; }

            const detail = await detailResponse.json() as unknown;
            const first = Array.isArray(detail) && detail.length > 0 && typeof detail[0] === 'object' ? detail[0] as ProcessoItem : null;

            if (first) { hydratedItems.push({ ...item, ...first }); detalhesConsultados += 1; }
            else { hydratedItems.push(item); }
        } catch (detailErr) {
            console.error(`${TAG} Erro ao detalhar processo ${numeroProcesso}:`, detailErr);
            hydratedItems.push(item);
        }
    }

    console.log(`${TAG} Hidratados ${detalhesConsultados} detalhes`);

    // 4. Mapear e persistir
    const nowIso = new Date().toISOString();
    const processoRows = hydratedItems.map((item) => {
        const numeroProcesso = toText(item.numeroProcesso);
        const siglaTribunal = toText(item.siglaTribunal);
        if (!numeroProcesso || !siglaTribunal) return null;

        const tramitacao = pickTramitacao(item);
        const tramitacaoAtiva = pickActiveTramitacao(item.tramitacoes);

        // Try to extract ultimoMovimento from multiple possible locations in the PDPJ payload
        const ultimoMovimentoRaw =
            (tramitacaoAtiva?.ultimoMovimento as Record<string, unknown> | undefined) ??
            (tramitacao?.ultimoMovimento as Record<string, unknown> | undefined) ??
            (item.ultimoMovimento as Record<string, unknown> | undefined) ??
            null;

        // If ultimoMovimento is still null, try to derive from movimentos array (pick the most recent)
        const movimentosArr = Array.isArray(tramitacaoAtiva?.movimentos)
            ? tramitacaoAtiva!.movimentos as Array<Record<string, unknown>>
            : Array.isArray(tramitacao?.movimentos)
                ? tramitacao!.movimentos as Array<Record<string, unknown>>
                : [];

        let ultimoMovimento: Record<string, unknown> | null = ultimoMovimentoRaw;
        if (!ultimoMovimento && movimentosArr.length > 0) {
            // Sort by dataHora descending and pick the first
            const sorted = [...movimentosArr]
                .filter((m) => typeof m === 'object' && m !== null)
                .sort((a, b) => {
                    const da = toIso(a.dataHora);
                    const db = toIso(b.dataHora);
                    if (!da && !db) return 0;
                    if (!da) return 1;
                    if (!db) return -1;
                    return new Date(db).getTime() - new Date(da).getTime();
                });
            if (sorted.length > 0) {
                const latest = sorted[0];
                ultimoMovimento = {
                    nome: toText(latest.descricao) ?? toText(latest.nome) ?? null,
                    dataHora: latest.dataHora ?? null,
                    codigo: latest.codigo ?? null,
                };
            }
        }

        // Extract movement date, trying multiple field names
        const ultimoMovimentoData =
            toIso(ultimoMovimento?.dataHora) ??
            toIso(ultimoMovimento?.data) ??
            toIso(ultimoMovimento?.dataMovimento) ??
            null;

        return {
            numero_processo: numeroProcesso, sigla_tribunal: siglaTribunal,
            nivel_sigilo: toNumber(item.nivelSigilo), id_codex_tribunal: toNumber(item.idCodexTribunal),
            idempresa: empresaId, idusuario: usuarioId,
            data_ajuizamento: toIso(tramitacaoAtiva?.dataHoraAjuizamento ?? tramitacao?.dataHoraAjuizamento),
            data_ultima_distribuicao: toIso(tramitacaoAtiva?.dataHoraUltimaDistribuicao ?? tramitacao?.dataHoraUltimaDistribuicao),
            valor_acao: toNumber(tramitacaoAtiva?.valorAcao ?? tramitacao?.valorAcao),
            permite_peticionar: toBoolean(tramitacaoAtiva?.permitePeticionar ?? tramitacao?.permitePeticionar, false),
            orgao_julgador: tramitacaoAtiva?.orgaoJulgador ?? tramitacao?.orgaoJulgador ?? null,
            grau: tramitacaoAtiva?.grau ?? tramitacao?.grau ?? null,
            tribunal: tramitacaoAtiva?.tribunal ?? tramitacao?.tribunal ?? null,
            classe: Array.isArray(tramitacaoAtiva?.classe) ? tramitacaoAtiva?.classe : (Array.isArray(tramitacao?.classe) ? tramitacao?.classe : null),
            assunto: Array.isArray(tramitacaoAtiva?.assunto) ? tramitacaoAtiva?.assunto : (Array.isArray(tramitacao?.assunto) ? tramitacao?.assunto : null),
            ultimo_movimento: ultimoMovimento,
            ultimo_movimento_data: ultimoMovimentoData,
            tramitacao_ativa: tramitacaoAtiva ?? tramitacao,
            payload: item, synced_at: nowIso,
        };
    }).filter((row): row is NonNullable<typeof row> => row !== null);

    if (processoRows.length === 0) {
        console.log(`${TAG} Nenhum processo válido para persistir.`);
        await supabaseAdmin.from('pje_sync_processos_log').insert({
            idempresa: empresaId, idusuario: usuarioId, oab_numero: numero, oab_uf: uf,
            fetched: fetchedItems.length, persisted: 0, partes_persistidas: 0, movimentos_persistidos: 0, documentos_persistidos: 0,
            status: 'success', metadata: { maxPaginas, limite, detalharProcessos: true, detalhesConsultados },
        });
        return { fetched: fetchedItems.length, persisted: 0, detalhesConsultados, partesPersistidas: 0, movimentosPersistidos: 0, documentosPersistidos: 0 };
    }

    const { data: persisted, error: persistError } = await supabaseAdmin
        .from('pje_processos')
        .upsert(processoRows, { onConflict: 'numero_processo,sigla_tribunal,idempresa' })
        .select('id, numero_processo');

    if (persistError) {
        console.error(`${TAG} Falha ao persistir processos:`, persistError.message);
        return { fetched: fetchedItems.length, persisted: 0, detalhesConsultados, partesPersistidas: 0, movimentosPersistidos: 0, documentosPersistidos: 0, error: persistError.message };
    }

    console.log(`${TAG} Persistidos ${persisted?.length ?? 0} processos`);

    const processIdByNumero = new Map((persisted ?? []).map((p) => [p.numero_processo as string, p.id as number]));
    let partesPersistidas = 0;
    let movimentosPersistidos = 0;
    let documentosPersistidos = 0;

    for (const item of hydratedItems) {
        const numeroProcesso = toText(item.numeroProcesso);
        if (!numeroProcesso) continue;
        const processoId = processIdByNumero.get(numeroProcesso);
        if (!processoId) continue;

        const tramitacao = pickTramitacao(item);
        const partes = Array.isArray(tramitacao?.partes) ? tramitacao!.partes as Array<Record<string, unknown>> : [];
        const movimentos = Array.isArray(tramitacao?.movimentos) ? tramitacao!.movimentos as Array<Record<string, unknown>> : [];
        const documentos = Array.isArray(tramitacao?.documentos) ? tramitacao!.documentos as Array<Record<string, unknown>> : [];

        await Promise.all([
            supabaseAdmin.from('pje_processo_partes').delete().eq('processo_id', processoId),
            supabaseAdmin.from('pje_processo_movimentos').delete().eq('processo_id', processoId),
            supabaseAdmin.from('pje_processo_documentos').delete().eq('processo_id', processoId),
        ]);

        if (partes.length > 0) {
            const partesRows = partes.filter((p) => typeof p === 'object' && p !== null).map((p) => ({
                processo_id: processoId, numero_processo: numeroProcesso,
                polo: toText(p.polo), tipo_parte: toText(p.tipoParte), nome: toText(p.nome),
                tipo_pessoa: toText(p.tipoPessoa), sigilosa: toBoolean(p.sigilosa, false),
                documentos_principais: Array.isArray(p.documentosPrincipais) ? p.documentosPrincipais : null,
                representantes: Array.isArray(p.representantes) ? p.representantes : null,
                outros_nomes: Array.isArray(p.outrosNomes) ? p.outrosNomes : null,
                payload: p,
            }));
            const { error: partesError } = await supabaseAdmin.from('pje_processo_partes').insert(partesRows);
            if (partesError) console.error(`${TAG} Erro partes ${numeroProcesso}:`, partesError);
            else partesPersistidas += partesRows.length;
        }

        if (movimentos.length > 0) {
            const movimentosRows = movimentos.filter((m) => typeof m === 'object' && m !== null).map((m) => ({
                processo_id: processoId, numero_processo: numeroProcesso,
                data_hora: toIso(m.dataHora), descricao: toText(m.descricao), payload: m,
            }));
            const { error: movError } = await supabaseAdmin.from('pje_processo_movimentos').insert(movimentosRows);
            if (movError) console.error(`${TAG} Erro movimentos ${numeroProcesso}:`, movError);
            else movimentosPersistidos += movimentosRows.length;
        }

        if (documentos.length > 0) {
            const documentosRows = documentos.filter((d) => typeof d === 'object' && d !== null).map((d) => {
                const tipo = d.tipo && typeof d.tipo === 'object' ? d.tipo as Record<string, unknown> : null;
                return {
                    processo_id: processoId, numero_processo: numeroProcesso,
                    sequencia: toNumber(d.sequencia), data_hora_juntada: toIso(d.dataHoraJuntada),
                    id_codex: toNumber(d.idCodex), id_origem: toText(d.idOrigem),
                    nome: toText(d.nome), nivel_sigilo: toText(d.nivelSigilo),
                    tipo_codigo: toNumber(tipo?.codigo), tipo_nome: toText(tipo?.nome),
                    href_binario: toText(d.hrefBinario), href_texto: toText(d.hrefTexto), payload: d,
                };
            });
            const { error: docsError } = await supabaseAdmin.from('pje_processo_documentos').insert(documentosRows);
            if (docsError) console.error(`${TAG} Erro documentos ${numeroProcesso}:`, docsError);
            else documentosPersistidos += documentosRows.length;
        }
    }

    // 5. Log
    await supabaseAdmin.from('pje_sync_processos_log').insert({
        idempresa: empresaId, idusuario: usuarioId, oab_numero: numero, oab_uf: uf,
        fetched: fetchedItems.length, persisted: persisted?.length ?? 0,
        partes_persistidas: partesPersistidas, movimentos_persistidos: movimentosPersistidos, documentos_persistidos: documentosPersistidos,
        status: 'success', metadata: { maxPaginas, limite, detalharProcessos: true, detalhesConsultados },
    });

    const result: SyncProcessosResult = {
        fetched: fetchedItems.length, persisted: persisted?.length ?? 0, detalhesConsultados,
        partesPersistidas, movimentosPersistidos, documentosPersistidos,
    };

    console.log(`${TAG} Sincronização concluída:`, JSON.stringify(result));
    return result;
}

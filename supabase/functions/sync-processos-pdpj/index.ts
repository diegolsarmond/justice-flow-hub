import { createClient } from 'npm:@supabase/supabase-js@2';

type SyncPayload = {
  numeroOab?: string;
  ufOab?: string;
  empresaId?: number | string;
  usuarioId?: number | string;
  limite?: number;
  maxPaginas?: number;
  searchAfter?: string[];
  detalharProcessos?: boolean;
  detalhar_processos?: boolean;
  numero?: string;
  uf?: string;
  empresa_id?: number | string;
  usuario_id?: number | string;
  max_paginas?: number;
};

type ProcessoItem = Record<string, unknown> & {
  numeroProcesso?: string;
  siglaTribunal?: string;
  nivelSigilo?: number;
  idCodexTribunal?: number;
  tramitacoes?: Array<Record<string, unknown>>;
  tramitacaoAtual?: Record<string, unknown>;
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-pdpj-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const toText = (value: unknown): string | null => {
  if (value == null) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return null;
};

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const toBoolean = (value: unknown, fallback = false): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    if (['true', '1', 'sim', 'yes'].includes(v)) return true;
    if (['false', '0', 'nao', 'não', 'no'].includes(v)) return false;
  }
  return fallback;
};

const toIso = (value: unknown): string | null => {
  const raw = toText(value);
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
};

const normalizeNumeroProcesso = (numeroProcesso: string): string => numeroProcesso.replace(/\D/g, '');

const pickTramitacao = (item: ProcessoItem): Record<string, unknown> | null => {
  if (item.tramitacaoAtual && typeof item.tramitacaoAtual === 'object') return item.tramitacaoAtual;
  if (Array.isArray(item.tramitacoes) && item.tramitacoes.length > 0) {
    const active = item.tramitacoes.find((t) => typeof t === 'object' && t && (t as Record<string, unknown>).ativo === true);
    const first = active ?? item.tramitacoes[0];
    return typeof first === 'object' && first ? first as Record<string, unknown> : null;
  }
  return null;
};

const pickActiveTramitacao = (tramitacoes: unknown): Record<string, unknown> | null => {
  if (!Array.isArray(tramitacoes) || tramitacoes.length === 0) return null;
  const active = tramitacoes.find((t) => typeof t === 'object' && t && (t as Record<string, unknown>).ativo === true);
  const first = active ?? tramitacoes[0];
  return typeof first === 'object' && first ? first as Record<string, unknown> : null;
};

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Método não suportado.' }), {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  try {
    const payload = (await req.json()) as SyncPayload;

    const numeroOab = toText(payload.numeroOab ?? payload.numero)?.replace(/\D/g, '') ?? null;
    const ufOab = toText(payload.ufOab ?? payload.uf)?.toUpperCase().replace(/[^A-Z]/g, '') ?? null;
    const empresaId = Number(payload.empresaId ?? payload.empresa_id);
    const usuarioId = Number(payload.usuarioId ?? payload.usuario_id);
    const detalharProcessos = toBoolean(payload.detalharProcessos ?? payload.detalhar_processos, true);

    if (!numeroOab || !ufOab || ufOab.length !== 2) {
      return new Response(JSON.stringify({ error: 'numeroOab e ufOab válidos são obrigatórios.' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    if (!Number.isFinite(empresaId) || empresaId <= 0 || !Number.isFinite(usuarioId) || usuarioId <= 0) {
      return new Response(JSON.stringify({ error: 'empresaId e usuarioId válidos são obrigatórios.' }), {
        status: 400,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRole) {
      return new Response(JSON.stringify({ error: 'SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY não configurados.' }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // ── Busca o token PDPJ da tabela token_jusbr (não expirado) ────────────
    let pdpjToken = req.headers.get('x-pdpj-token') || null;

    if (!pdpjToken) {
      const { data: tokenRow, error: tokenError } = await supabase
        .from('token_jusbr')
        .select('access_token')
        .eq('expired', false)
        .order('datatimerenewal', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (tokenError) {
        console.error('[sync-processos-pdpj] Erro ao buscar token na tabela token_jusbr:', tokenError);
      }

      pdpjToken = tokenRow?.access_token ?? null;
    }

    if (!pdpjToken) {
      return new Response(JSON.stringify({ error: 'Token PDPJ ausente. Nenhum token válido encontrado na tabela token_jusbr.' }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const limite = Math.max(1, Math.min(100, toNumber(payload.limite) ?? 100));
    const maxPaginas = Math.max(1, Math.min(50, toNumber(payload.maxPaginas ?? payload.max_paginas) ?? 10));
    let searchAfter = Array.isArray(payload.searchAfter) ? payload.searchAfter : null;

    const fetchedItems: ProcessoItem[] = [];
    let paginaAtual = 0;

    while (paginaAtual < maxPaginas) {
      const query = new URLSearchParams({ oabRepresentante: `${ufOab}${numeroOab}`, size: String(limite) });
      if (searchAfter && searchAfter.length > 0) query.set('searchAfter', searchAfter.join(','));

      const response = await fetch(`https://portaldeservicos.pdpj.jus.br/api/v2/processos?${query.toString()}`, {
        headers: {
          Accept: 'application/json, text/plain, */*',
          Authorization: `Bearer ${pdpjToken}`,
        },
      });

      if (!response.ok) {
        const body = await response.text();
        return new Response(JSON.stringify({
          error: 'Falha ao consultar API de processos do PDPJ.',
          status: response.status,
          details: body,
          paginaAtual,
        }), {
          status: 502,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }

      const result = await response.json() as Record<string, unknown>;
      const content = Array.isArray(result.content) ? result.content as ProcessoItem[] : [];
      fetchedItems.push(...content);

      const nextSearch = Array.isArray(result.searchAfter)
        ? result.searchAfter.map((v) => toText(v)).filter((v): v is string => !!v)
        : [];

      paginaAtual += 1;
      if (content.length === 0 || nextSearch.length === 0 || content.length < limite) break;
      searchAfter = nextSearch;
    }

    const hydratedItems: ProcessoItem[] = [];
    let detalhesConsultados = 0;

    for (const item of fetchedItems) {
      const numeroProcesso = toText(item.numeroProcesso);
      if (!numeroProcesso || !detalharProcessos) {
        hydratedItems.push(item);
        continue;
      }

      const numeroNormalizado = normalizeNumeroProcesso(numeroProcesso);
      const detailResponse = await fetch(`https://portaldeservicos.pdpj.jus.br/api/v2/processos/${numeroNormalizado}`, {
        headers: {
          Accept: 'application/json, text/plain, */*',
          Authorization: `Bearer ${pdpjToken}`,
        },
      });

      if (!detailResponse.ok) {
        hydratedItems.push(item);
        continue;
      }

      const detail = await detailResponse.json() as unknown;
      const first = Array.isArray(detail) && detail.length > 0 && typeof detail[0] === 'object'
        ? detail[0] as ProcessoItem
        : null;

      if (first) {
        hydratedItems.push({ ...item, ...first });
        detalhesConsultados += 1;
      } else {
        hydratedItems.push(item);
      }
    }

    const nowIso = new Date().toISOString();

    const processoRows = hydratedItems
      .map((item) => {
        const numeroProcesso = toText(item.numeroProcesso);
        const siglaTribunal = toText(item.siglaTribunal);
        if (!numeroProcesso || !siglaTribunal) return null;

        const tramitacao = pickTramitacao(item);
        const tramitacaoAtiva = pickActiveTramitacao(item.tramitacoes);
        const ultimoMovimento = (tramitacaoAtiva?.ultimoMovimento as Record<string, unknown> | undefined) ?? null;

        return {
          numero_processo: numeroProcesso,
          sigla_tribunal: siglaTribunal,
          nivel_sigilo: toNumber(item.nivelSigilo),
          id_codex_tribunal: toNumber(item.idCodexTribunal),
          idempresa: empresaId,
          idusuario: usuarioId,
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
          ultimo_movimento_data: toIso(ultimoMovimento?.dataHora),
          tramitacao_ativa: tramitacaoAtiva ?? tramitacao,
          payload: item,
          synced_at: nowIso,
        };
      })
      .filter((row): row is Record<string, unknown> => row !== null);

    if (processoRows.length === 0) {
      return new Response(JSON.stringify({ fetched: hydratedItems.length, persisted: 0, partesPersistidas: 0, movimentosPersistidos: 0, documentosPersistidos: 0 }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const { data: persisted, error: persistError } = await supabase
      .from('pje_processos')
      .upsert(processoRows, { onConflict: 'numero_processo,sigla_tribunal,idempresa' })
      .select('id, numero_processo');

    if (persistError) {
      return new Response(JSON.stringify({ error: 'Falha ao persistir processos.', details: persistError.message }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

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
      const partes = Array.isArray(tramitacao?.partes) ? tramitacao.partes : [];
      const movimentos = Array.isArray(tramitacao?.movimentos) ? tramitacao.movimentos : [];
      const documentos = Array.isArray(tramitacao?.documentos) ? tramitacao.documentos : [];

      await Promise.all([
          supabase.from('pje_processo_partes').delete().eq('processo_id', processoId),
          supabase.from('pje_processo_movimentos').delete().eq('processo_id', processoId),
          supabase.from('pje_processo_documentos').delete().eq('processo_id', processoId)
      ]);

      if (partes.length > 0) {
        const partesRows = partes
          .filter((parte) => typeof parte === 'object' && parte !== null)
          .map((parte) => {
            const p = parte as Record<string, unknown>;
            return {
              processo_id: processoId,
              numero_processo: numeroProcesso,
              polo: toText(p.polo),
              tipo_parte: toText(p.tipoParte),
              nome: toText(p.nome),
              tipo_pessoa: toText(p.tipoPessoa),
              sigilosa: toBoolean(p.sigilosa, false),
              documentos_principais: Array.isArray(p.documentosPrincipais) ? p.documentosPrincipais : null,
              representantes: Array.isArray(p.representantes) ? p.representantes : null,
              outros_nomes: Array.isArray(p.outrosNomes) ? p.outrosNomes : null,
              payload: p,
            };
          });

        const { error: partesError } = await supabase.from('pje_processo_partes').insert(partesRows);
        if (partesError) {
             console.error(`Erro ao persistir partes do processo ${numeroProcesso}:`, partesError);
        } else {
             partesPersistidas += partesRows.length;
        }
      }

      if (movimentos.length > 0) {
        const movimentosRows = movimentos
          .filter((mov) => typeof mov === 'object' && mov !== null)
          .map((mov) => {
            const m = mov as Record<string, unknown>;
            return {
              processo_id: processoId,
              numero_processo: numeroProcesso,
              data_hora: toIso(m.dataHora),
              descricao: toText(m.descricao),
              payload: m,
            };
          });

        const { error: movimentosError } = await supabase.from('pje_processo_movimentos').insert(movimentosRows);
        if (movimentosError) {
            console.error(`Erro ao persistir movimentos do processo ${numeroProcesso}:`, movimentosError);
        } else {
            movimentosPersistidos += movimentosRows.length;
        }
      }

      if (documentos.length > 0) {
        const documentosRows = documentos
          .filter((doc) => typeof doc === 'object' && doc !== null)
          .map((doc) => {
            const d = doc as Record<string, unknown>;
            const tipo = d.tipo && typeof d.tipo === 'object' ? d.tipo as Record<string, unknown> : null;
            return {
              processo_id: processoId,
              numero_processo: numeroProcesso,
              sequencia: toNumber(d.sequencia),
              data_hora_juntada: toIso(d.dataHoraJuntada),
              id_codex: toNumber(d.idCodex),
              id_origem: toText(d.idOrigem),
              nome: toText(d.nome),
              nivel_sigilo: toText(d.nivelSigilo),
              tipo_codigo: toNumber(tipo?.codigo),
              tipo_nome: toText(tipo?.nome),
              href_binario: toText(d.hrefBinario),
              href_texto: toText(d.hrefTexto),
              payload: d,
            };
          });

        const { error: docsError } = await supabase.from('pje_processo_documentos').insert(documentosRows);
         if (docsError) {
            console.error(`Erro ao persistir documentos do processo ${numeroProcesso}:`, docsError);
        } else {
            documentosPersistidos += documentosRows.length;
        }
      }
    }

    await supabase.from('pje_sync_processos_log').insert({
      idempresa: empresaId,
      idusuario: usuarioId,
      oab_numero: numeroOab,
      oab_uf: ufOab,
      fetched: fetchedItems.length,
      persisted: persisted?.length ?? 0,
      partes_persistidas: partesPersistidas,
      movimentos_persistidos: movimentosPersistidos,
      documentos_persistidos: documentosPersistidos,
      status: 'success',
      metadata: {
        maxPaginas,
        limite,
        detalharProcessos,
        detalhesConsultados,
      },
    });

    return new Response(JSON.stringify({
      fetched: fetchedItems.length,
      persisted: persisted?.length ?? 0,
      detalhesConsultados,
      partesPersistidas,
      movimentosPersistidos,
      documentosPersistidos,
    }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro inesperado ao sincronizar processos.';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});

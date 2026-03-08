import { createClient } from 'npm:@supabase/supabase-js@2';

type SyncPayload = {
  numeroOab?: string;
  ufOab?: string;
  empresaId?: number | string;
  usuarioId?: number | string;
  dataInicio?: string;
  dataFim?: string;
  // snake_case payload (scheduler/sql compatibility)
  numero?: string;
  uf?: string;
  empresa_id?: number | string;
  usuario_id?: number | string;
  data_inicio?: string;
  data_fim?: string;
  pagina?: number;
  itensPorPagina?: number;
  intervaloDatas?: {
    dataInicio?: string;
    dataFim?: string;
  };
};

type ComunicaApiItem = Record<string, unknown> & {
  id?: string | number;
  siglaTribunal?: string;
  numeroProcesso?: string;
  numero_processo?: string;
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-comunicaapi-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const toText = (value: unknown): string | null => {
  if (value == null) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return null;
};

const toBoolean = (value: unknown, fallback: boolean): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'sim'].includes(normalized)) return true;
    if (['false', '0', 'no', 'nao', 'não'].includes(normalized)) return false;
  }

  if (typeof value === 'number') return value !== 0;

  return fallback;
};

const toIsoDate = (value: unknown): string | null => {
  const raw = toText(value);
  if (!raw) return null;

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

const normalizeList = (value: unknown): string[] | null => {
  if (!Array.isArray(value)) return null;

  const normalized = value
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      if (item && typeof item === 'object') {
        const possible =
          toText((item as Record<string, unknown>).nome) ??
          toText((item as Record<string, unknown>).nomeAdvogado) ??
          toText((item as Record<string, unknown>).advogado) ??
          toText((item as Record<string, unknown>).numeroOab) ??
          JSON.stringify(item);
        return possible?.trim() ?? '';
      }
      return toText(item) ?? '';
    })
    .filter((item) => item.length > 0);

  return normalized.length > 0 ? normalized : null;
};

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

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

    const dataInicio = toText(payload.dataInicio ?? payload.data_inicio ?? payload.intervaloDatas?.dataInicio);
    const dataFim = toText(payload.dataFim ?? payload.data_fim ?? payload.intervaloDatas?.dataFim);

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
    const comunicaApiToken =
      req.headers.get('x-comunicaapi-token') ||
      Deno.env.get('COMUNICA_API_TOKEN') ||
      Deno.env.get('COMUNICAAPI_TOKEN') ||
      Deno.env.get('PJE_COMUNICA_API_TOKEN');

    if (!supabaseUrl || !serviceRole) {
      return new Response(JSON.stringify({ error: 'SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY não configurados.' }), {
        status: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const fetchedItems: ComunicaApiItem[] = [];
    let pagina = Number.isFinite(Number(payload.pagina)) && Number(payload.pagina) > 0 ? Math.trunc(Number(payload.pagina)) : 1;
    const itensPorPagina = Number.isFinite(Number(payload.itensPorPagina)) && Number(payload.itensPorPagina) > 0
      ? Math.min(200, Math.trunc(Number(payload.itensPorPagina)))
      : 100;

    while (true) {
      const query = new URLSearchParams({
        numeroOab,
        ufOab,
        pagina: String(pagina),
        itensPorPagina: String(itensPorPagina),
      });

      if (dataInicio) query.set('dataDisponibilizacaoInicio', dataInicio);
      if (dataFim) query.set('dataDisponibilizacaoFim', dataFim);

      const headers: HeadersInit = { 
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      };
      if (comunicaApiToken) {
        headers.Authorization = `Bearer ${comunicaApiToken}`;
      }

      const response = await fetch(`https://comunicaapi.pje.jus.br/api/v1/comunicacao?${query.toString()}`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const body = await response.text();
        return new Response(JSON.stringify({
          error: 'Falha ao consultar ComunicaAPI.',
          details: body,
          status: response.status,
          pagina,
        }), {
          status: 502,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }

      const result = await response.json() as unknown;
      const items =
        Array.isArray(result)
          ? result
          : result && typeof result === 'object' && Array.isArray((result as Record<string, unknown>).items)
            ? (result as Record<string, unknown>).items as unknown[]
            : result && typeof result === 'object' && Array.isArray((result as Record<string, unknown>).data)
              ? (result as Record<string, unknown>).data as unknown[]
              : [];

      const pageItems = items as ComunicaApiItem[];
      fetchedItems.push(...pageItems);

      if (pageItems.length < itensPorPagina || pageItems.length === 0) {
        break;
      }

      pagina += 1;
    }

    const mappedRows = fetchedItems.map((item) => {
      const externalId = toText(item.id);
      const numeroProcesso = toText(item.numeroProcesso ?? item.numero_processo);

      return {
        external_id: externalId,
        siglaTribunal: toText(item.siglaTribunal ?? item.sigla_tribunal) ?? 'projudi',
        numero_processo: numeroProcesso,
        nomeOrgao: toText(item.nomeOrgao ?? item.nome_orgao),
        tipoComunicacao: toText(item.tipoComunicacao ?? item.tipo_comunicacao),
        texto: toText(item.texto),
        data_disponibilizacao: toIsoDate(item.dataDisponibilizacao ?? item.data_disponibilizacao),
        meio: toText(item.meio),
        link: toText(item.link),
        tipodocumento: toText(item.tipoDocumento ?? item.tipodocumento),
        nomeclasse: toText(item.nomeClasse ?? item.nomeclasse),
        codigoclasse: toText(item.codigoClasse ?? item.codigoclasse),
        numerocomunicacao: toText(item.numeroComunicacao ?? item.numerocomunicacao),
        ativo: toBoolean(item.ativo, true),
        hash: toText(item.hash),
        status: toText(item.status),
        motivo_cancelamento: toText(item.motivoCancelamento ?? item.motivo_cancelamento),
        data_cancelamento: toText(item.dataCancelamento ?? item.data_cancelamento),
        destinatarios: normalizeList(item.destinatarios),
        destinatarios_advogados: normalizeList(
          item.destinatariosadvogados ?? item.destinatarioadvogados ?? item.destinatarios_advogados,
        ),
        idempresa: empresaId,
        idusuario: usuarioId,
        nao_lida: true,
      };
    });

    const validRows = mappedRows.filter((row) => row.external_id && row.numero_processo);
    const skipped = mappedRows.length - validRows.length;

    if (validRows.length === 0) {
      return new Response(JSON.stringify({
        fetched: fetchedItems.length,
        inserted: 0,
        updated: 0,
        skipped,
        persistedIds: [],
      }), {
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      });
    }

    let inserted = 0;
    let updated = 0;
    const persistedIds: Array<number | string> = [];

    for (let index = 0; index < validRows.length; index += 200) {
      const chunk = validRows.slice(index, index + 200);
      const chunkExternalIds = Array.from(new Set(chunk.map((row) => row.external_id as string)));
      const chunkNumeros = Array.from(new Set(chunk.map((row) => row.numero_processo as string)));

      const { data: existingRows, error: existingError } = await supabase
        .from('intimacoes')
        .select('external_id, numero_processo')
        .in('external_id', chunkExternalIds)
        .in('numero_processo', chunkNumeros)
        .eq('idempresa', empresaId);

      if (existingError) {
        return new Response(JSON.stringify({
          error: 'Falha ao validar intimações existentes.',
          details: existingError.message,
        }), {
          status: 500,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }

      const existingSet = new Set(
        ((existingRows ?? []) as { numero_processo: string; external_id: string }[]).map(
          (row) => `${row.numero_processo}::${row.external_id}`
        ),
      );

      const { data, error } = await supabase
        .from('intimacoes')
        .upsert(chunk, { onConflict: 'numero_processo,external_id' })
        .select('id, numero_processo, external_id');

      if (error) {
        return new Response(JSON.stringify({
          error: 'Falha ao persistir intimações.',
          details: error.message,
        }), {
          status: 500,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        });
      }

      for (const row of data ?? []) {
        const key = `${row.numero_processo}::${row.external_id}`;
        if (existingSet.has(key)) {
          updated += 1;
        } else {
          inserted += 1;
        }
        persistedIds.push(row.id);
      }
    }

    return new Response(JSON.stringify({
      fetched: fetchedItems.length,
      inserted,
      updated,
      skipped,
      persistedIds,
    }), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro inesperado ao sincronizar intimações.';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }
});

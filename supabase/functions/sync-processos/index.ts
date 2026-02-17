import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user via getClaims
    const token = authHeader.replace("Bearer ", "");
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Usuário não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { numero_cnj, tribunal_alias } = await req.json();

    if (!numero_cnj || !tribunal_alias) {
      return new Response(JSON.stringify({ error: "numero_cnj e tribunal_alias são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get API token from database
    const { data: tokenData } = await supabase
      .from("api_tokens")
      .select("*")
      .eq("provider", "datajud")
      .limit(1)
      .single();

    if (!tokenData) {
      return new Response(JSON.stringify({ error: "Token da API Datajud não configurado. Configure nas Configurações." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call Datajud API
    const datajudUrl = `https://api-publica.datajud.cnj.jus.br/api_publica_${tribunal_alias.toLowerCase()}/_search`;
    
    const searchBody = {
      query: {
        match: {
          numeroProcesso: numero_cnj.replace(/\D/g, ""),
        },
      },
    };

    const apiResponse = await fetch(datajudUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `APIKey ${tokenData.access_token}`,
      },
      body: JSON.stringify(searchBody),
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      return new Response(JSON.stringify({ error: `Erro na API Datajud: ${apiResponse.status}`, details: errorText }), {
        status: apiResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await apiResponse.json();
    const hits = result?.hits?.hits ?? [];

    if (hits.length === 0) {
      return new Response(JSON.stringify({ message: "Processo não encontrado na base do Datajud", synced: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let synced = 0;

    for (const hit of hits) {
      const source = hit._source;
      const numeroCnj = source.numeroProcesso;

      const processoData = {
        numero_cnj: numeroCnj,
        tribunal: source.siglaTribunal ?? null,
        orgao_julgador: source.orgaoJulgador?.nomeOrgao ?? null,
        classe_judicial: source.classeProcessual?.nome ?? source.classe?.nome ?? null,
        assunto: Array.isArray(source.assuntos) ? source.assuntos.map((a: any) => a.nome).join(", ") : null,
        grau: source.grau ?? null,
        data_distribuicao: source.dataAjuizamento ?? null,
        data_ultimo_movimento: source.dataUltimaAtualizacao ?? null,
        nivel_sigilo: source.nivelSigilo ?? 0,
        status: "em_andamento",
        ativo: true,
      };

      // Upsert by numero_cnj
      const { data: existing } = await supabase
        .from("processos")
        .select("id")
        .eq("numero_cnj", numeroCnj)
        .limit(1)
        .single();

      if (existing) {
        await supabase.from("processos").update(processoData).eq("id", existing.id);
      } else {
        await supabase.from("processos").insert(processoData);
      }

      // Sync parties
      if (Array.isArray(source.poloAtivo)) {
        for (const parte of source.poloAtivo) {
          await upsertParte(supabase, numeroCnj, parte, "ativo");
        }
      }
      if (Array.isArray(source.poloPassivo)) {
        for (const parte of source.poloPassivo) {
          await upsertParte(supabase, numeroCnj, parte, "passivo");
        }
      }

      synced++;
    }

    return new Response(JSON.stringify({ message: `${synced} processo(s) sincronizado(s)`, synced }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Erro interno", details: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function upsertParte(supabase: any, numeroCnj: string, parte: any, polo: string) {
  const { data: processo } = await supabase
    .from("processos")
    .select("id")
    .eq("numero_cnj", numeroCnj)
    .limit(1)
    .single();

  if (!processo) return;

  const nome = parte.nome ?? parte.nomeCompleto ?? "Sem nome";

  const { data: existing } = await supabase
    .from("partes_processo")
    .select("id")
    .eq("processo_id", processo.id)
    .eq("nome", nome)
    .eq("polo", polo)
    .limit(1)
    .single();

  if (!existing) {
    await supabase.from("partes_processo").insert({
      processo_id: processo.id,
      nome,
      polo,
      tipo_pessoa: parte.tipoPessoa ?? null,
      documento_tipo: parte.tipoDocumento ?? null,
      documento_numero: parte.documento ?? null,
    });
  }
}

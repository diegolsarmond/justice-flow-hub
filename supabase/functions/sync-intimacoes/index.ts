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

    // Get ComunicaPJE token
    const { data: tokenData } = await supabase
      .from("api_tokens")
      .select("*")
      .eq("provider", "comunicapje")
      .limit(1)
      .single();

    if (!tokenData) {
      return new Response(JSON.stringify({ error: "Token do ComunicaPJE não configurado. Configure nas Configurações." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check token expiration and refresh if needed
    if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
      if (tokenData.refresh_token) {
        const refreshed = await refreshToken(tokenData, supabase);
        if (!refreshed) {
          return new Response(JSON.stringify({ error: "Token expirado e não foi possível renovar. Reconfigure o token." }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        tokenData.access_token = refreshed.access_token;
      } else {
        return new Response(JSON.stringify({ error: "Token expirado. Reconfigure nas Configurações." }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Call ComunicaPJE API
    const baseUrl = "https://comunicaapi.pje.jus.br";
    const oabNumero = tokenData.oab_numero;
    const oabUf = tokenData.oab_uf;

    if (!oabNumero || !oabUf) {
      return new Response(JSON.stringify({ error: "OAB número e UF não configurados no token." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiUrl = `${baseUrl}/api/v1/comunicacoes?oab=${oabNumero}&uf=${oabUf?.toUpperCase()}`;

    const apiResponse = await fetch(apiUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: "application/json",
      },
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      return new Response(JSON.stringify({ error: `Erro na API ComunicaPJE: ${apiResponse.status}`, details: errorText }), {
        status: apiResponse.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await apiResponse.json();
    const comunicacoes = Array.isArray(data) ? data : data?.comunicacoes ?? data?.items ?? data?.content ?? [];

    let synced = 0;
    let skipped = 0;

    for (const com of comunicacoes) {
      const comunicacaoId = com.id ?? com.comunicacaoId ?? com.numeroComunicacao;

      // Skip if already exists
      if (comunicacaoId) {
        const { data: existing } = await supabase
          .from("intimacoes")
          .select("id")
          .eq("comunicacao_id", comunicacaoId)
          .limit(1)
          .single();

        if (existing) {
          skipped++;
          continue;
        }
      }

      const numeroProcesso = com.numeroProcesso ?? com.processo?.numero ?? null;

      // Try to find matching processo
      let processoId = null;
      if (numeroProcesso) {
        const { data: proc } = await supabase
          .from("processos")
          .select("id")
          .eq("numero_cnj", numeroProcesso.replace(/\D/g, ""))
          .limit(1)
          .single();
        processoId = proc?.id ?? null;
      }

      await supabase.from("intimacoes").insert({
        comunicacao_id: comunicacaoId ?? null,
        numero_processo: numeroProcesso,
        processo_id: processoId,
        sigla_tribunal: com.siglaTribunal ?? com.tribunal ?? null,
        nome_orgao: com.nomeOrgao ?? com.orgao ?? null,
        tipo_comunicacao: com.tipoComunicacao ?? com.tipo ?? null,
        tipo_documento: com.tipoDocumento ?? null,
        nome_classe: com.nomeClasse ?? com.classe ?? null,
        codigo_classe: com.codigoClasse ?? null,
        texto: com.texto ?? com.conteudo ?? null,
        data_disponibilizacao: com.dataDisponibilizacao ?? com.data ?? null,
        meio: com.meio ?? null,
        meio_completo: com.meioCompleto ?? null,
        link: com.link ?? com.url ?? null,
        hash: com.hash ?? null,
        numero_comunicacao: com.numeroComunicacao ?? null,
        destinatarios: com.destinatarios ?? null,
        destinatario_advogados: com.destinatarioAdvogados ?? com.advogados ?? null,
        status: "pendente",
      });

      synced++;
    }

    return new Response(
      JSON.stringify({
        message: `${synced} intimação(ões) sincronizada(s), ${skipped} já existente(s)`,
        synced,
        skipped,
        total: comunicacoes.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: "Erro interno", details: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function refreshToken(tokenData: any, supabase: any): Promise<{ access_token: string } | null> {
  try {
    // PJe SSO token refresh
    const refreshUrl = "https://sso.cloud.pje.jus.br/auth/realms/pje/protocol/openid-connect/token";
    
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: tokenData.refresh_token,
      client_id: "comunicapje",
    });

    const response = await fetch(refreshUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    if (!response.ok) return null;

    const result = await response.json();

    // Update token in database
    await supabase.from("api_tokens").update({
      access_token: result.access_token,
      refresh_token: result.refresh_token ?? tokenData.refresh_token,
      expires_at: new Date(Date.now() + (result.expires_in ?? 3600) * 1000).toISOString(),
    }).eq("id", tokenData.id);

    return { access_token: result.access_token };
  } catch {
    return null;
  }
}

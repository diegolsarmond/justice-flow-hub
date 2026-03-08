/// <reference path="../deno.d.ts" />
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "./lib/constants.ts";
import type { HandlerContext } from "./lib/context.ts";
import { handlers } from "./handlers/index.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return jsonResponse({ error: "Configuração do Supabase ausente" }, 500);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let UAZAPI_URL = Deno.env.get("UAZAPI_URL");
    let UAZAPI_ADMIN_TOKEN = Deno.env.get("UAZAPI_ADMIN_TOKEN");
    if (!UAZAPI_URL || !UAZAPI_ADMIN_TOKEN) {
      const { data: configRow, error: configError } = await supabase
        .from("api_config")
        .select("uazapi_url, uazapi_admin_token")
        .eq("id", 1)
        .single();
      if (!configError && configRow?.uazapi_url && configRow?.uazapi_admin_token) {
        UAZAPI_URL = configRow.uazapi_url;
        UAZAPI_ADMIN_TOKEN = configRow.uazapi_admin_token;
      }
    }
    if (!UAZAPI_URL || !UAZAPI_ADMIN_TOKEN) {
      console.error("Missing UAZAPI_URL or UAZAPI_ADMIN_TOKEN (env and api_config)");
      return jsonResponse({
        error: "Configuração da API não encontrada",
        details: "Configure UAZAPI_URL e UAZAPI_ADMIN_TOKEN nos secrets ou na tabela public.api_config (id=1)",
      }, 400);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await supabase.auth.getUser(token);

    if (authError || !userData?.user) {
      console.error("Auth error:", authError);
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const userId = userData.user.id;
    console.log(`Request from user: ${userId}`);

    const context: HandlerContext = {
      supabase,
      userId,
      UAZAPI_URL,
      UAZAPI_ADMIN_TOKEN,
    };

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    console.log(`Action: ${action}`);

    const handler = action ? handlers[action] : undefined;
    if (!handler) {
      return jsonResponse({ error: "Ação não reconhecida", action }, 400);
    }

    return handler(req, url, context);
  } catch (error: unknown) {
    console.error("Error:", error);
    return jsonResponse(
      { error: "Erro interno", details: error instanceof Error ? error.message : String(error) },
      500
    );
  }
});

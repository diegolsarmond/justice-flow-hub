import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, PATCH, OPTIONS",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: { ...corsHeaders, "Access-Control-Max-Age": "86400" },
    });
  }

  if (req.method !== "PATCH") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Configuração do Supabase ausente" }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const { data: userData, error: authError } = await supabase.auth.getUser(token);

    if (authError || !userData?.user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const userId = userData.user.id;
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) {
      return jsonResponse({ error: "Query parameter 'id' é obrigatório" }, 400);
    }

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Body JSON inválido" }, 400);
    }

    const { data: conversation, error: fetchError } = await supabase
      .from("conversations")
      .select("id, instance_id, assigned_to")
      .eq("id", id)
      .single();

    if (fetchError || !conversation) {
      return jsonResponse({ error: "Conversa não encontrada" }, 404);
    }

    const { data: hasAccess } = await supabase.rpc("has_instance_access", {
      _user_id: userId,
      _instance_id: conversation.instance_id,
    });
    if (!hasAccess) {
      return jsonResponse({ error: "Sem permissão para acessar esta conversa" }, 403);
    }

    const { data: restricted } = await supabase.rpc("is_restricted", { _user_id: userId });
    if (restricted && conversation.assigned_to !== userId) {
      return jsonResponse({ error: "Sem permissão para acessar esta conversa" }, 403);
    }

    const allowedKeys = ["desativar_bot", "tags", "assigned_to", "notes"] as const;
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    for (const key of allowedKeys) {
      if (body[key] !== undefined) {
        updates[key] = body[key];
      }
    }

    const { data: updated, error: updateError } = await supabase
      .from("conversations")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (updateError) {
      return jsonResponse({ error: updateError.message }, 400);
    }

    return jsonResponse(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse({ error: message }, 500);
  }
});

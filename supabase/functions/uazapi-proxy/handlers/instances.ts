import type { HandlerContext } from "../lib/context.ts";
import { checkInstanceAccess, filterInstancesByAccess } from "../lib/context.ts";
import { jsonResponse } from "../lib/constants.ts";
import type { UazapiInstance } from "../lib/types.ts";

export async function handleListInstances(_req: Request, _url: URL, ctx: HandlerContext): Promise<Response> {
  const { supabase, userId, UAZAPI_URL, UAZAPI_ADMIN_TOKEN } = ctx;
  console.log(`Fetching instances from ${UAZAPI_URL}/instance/all`);
  const response = await fetch(`${UAZAPI_URL}/instance/all`, {
    method: "GET",
    headers: {
      "admintoken": UAZAPI_ADMIN_TOKEN,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`uazapi error: ${response.status} - ${errorText}`);
    return jsonResponse({ error: "Erro ao buscar instâncias da API", details: errorText }, response.status);
  }

  const instances: UazapiInstance[] = await response.json();
  console.log(`Found ${instances.length} instances`);

  for (const instance of instances) {
    const { error: upsertError } = await supabase
      .from("instances")
      .upsert({
        uazapi_instance_id: instance.id,
        uazapi_token: instance.token,
        name: instance.name || `Instância ${instance.id}`,
        status: instance.status === "connected" ? "connected" :
          instance.status === "connecting" ? "connecting" : "disconnected",
        profile_name: instance.profileName || null,
        profile_pic_url: instance.profilePicUrl || null,
        is_business: instance.isBusiness || false,
        qr_code: instance.qrcode || null,
        created_by: userId,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "uazapi_instance_id",
        ignoreDuplicates: false,
      });

    if (upsertError) {
      console.error(`Error upserting instance ${instance.id}:`, upsertError);
    }
  }

  const { data: dbInstances, error: dbError } = await supabase
    .from("instances")
    .select("*")
    .order("created_at", { ascending: false });

  if (dbError) {
    console.error("Database error:", dbError);
    const isTableMissing =
      dbError.code === "PGRST205" ||
      (typeof dbError.message === "string" &&
        (dbError.message.includes("instances") || dbError.message.includes("schema cache")));
    const message = isTableMissing
      ? "Tabela 'instances' não existe. Aplique as migrações no Supabase (SQL Editor ou: npx supabase db push)."
      : "Erro ao buscar instâncias";
    return jsonResponse({ error: message, details: dbError.message }, 500);
  }

  const filteredInstances = await filterInstancesByAccess(ctx, dbInstances || []);
  return jsonResponse({ instances: filteredInstances, synced: instances.length });
}

export async function handleCreateInstance(req: Request, _url: URL, ctx: HandlerContext): Promise<Response> {
  const { supabase, userId, UAZAPI_URL, UAZAPI_ADMIN_TOKEN } = ctx;
  const body = await req.json();
  const { name } = body;

  if (!name) {
    return jsonResponse({ error: "Nome da instância é obrigatório" }, 400);
  }

  // Obter a empresa do usuário atual para vincular a instância via banco
  const { data: userData } = await supabase
    .from("usuarios")
    .select("empresa")
    .eq("auth_user_id", userId)
    .single();

  console.log(`Creating instance: ${name}`);
  const response = await fetch(`${UAZAPI_URL}/instance/init`, {
    method: "POST",
    headers: {
      "admintoken": UAZAPI_ADMIN_TOKEN,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`uazapi error: ${response.status} - ${errorText}`);
    return jsonResponse({ error: "Erro ao criar instância", details: errorText }, response.status);
  }

  const result = await response.json();
  console.log(`Instance created:`, result);

  const { data: dbInstance, error: dbError } = await supabase
    .from("instances")
    .insert({
      uazapi_instance_id: result.instance?.id || result.token,
      uazapi_token: result.token,
      name: name,
      status: "disconnected",
      created_by: userId,
      empresa_id: userData?.empresa || null,
    })
    .select()
    .single();

  if (dbError) {
    console.error("Database error:", dbError);
  }

  return jsonResponse({ instance: dbInstance, uazapi: result });
}

export async function handleConnectInstance(req: Request, _url: URL, ctx: HandlerContext): Promise<Response> {
  const { supabase, UAZAPI_URL } = ctx;
  const body = await req.json();
  const { instanceId, phone } = body;

  if (!(await checkInstanceAccess(ctx, instanceId))) {
    return jsonResponse({ error: "Sem permissão para acessar esta instância" }, 403);
  }

  const { data: instance, error: instanceError } = await supabase
    .from("instances")
    .select("uazapi_token, uazapi_instance_id")
    .eq("id", instanceId)
    .single();

  if (instanceError || !instance?.uazapi_token) {
    return jsonResponse({ error: "Instância não encontrada" }, 404);
  }

  console.log(`Connecting instance: ${instanceId}`);
  const response = await fetch(`${UAZAPI_URL}/instance/connect`, {
    method: "POST",
    headers: {
      "token": instance.uazapi_token,
      "Content-Type": "application/json",
    },
    body: phone ? JSON.stringify({ phone }) : "{}",
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`uazapi error: ${response.status} - ${errorText}`);
    return jsonResponse({ error: "Erro ao conectar instância", details: errorText }, response.status);
  }

  const result = await response.json();
  console.log(`Connect result:`, result);

  await supabase
    .from("instances")
    .update({
      status: result.instance?.status === "connected" ? "connected" : "qr_ready",
      qr_code: result.instance?.qrcode || null,
      phone_number: result.instance?.profileName || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", instanceId);

  return jsonResponse(result);
}

export async function handleDisconnectInstance(req: Request, _url: URL, ctx: HandlerContext): Promise<Response> {
  const { supabase, UAZAPI_URL } = ctx;
  const body = await req.json();
  const { instanceId } = body;

  if (!(await checkInstanceAccess(ctx, instanceId))) {
    return jsonResponse({ error: "Sem permissão para acessar esta instância" }, 403);
  }

  const { data: instance, error: instanceError } = await supabase
    .from("instances")
    .select("uazapi_token")
    .eq("id", instanceId)
    .single();

  if (instanceError || !instance?.uazapi_token) {
    return jsonResponse({ error: "Instância não encontrada" }, 404);
  }

  const response = await fetch(`${UAZAPI_URL}/instance/disconnect`, {
    method: "POST",
    headers: {
      "token": instance.uazapi_token,
      "Content-Type": "application/json",
    },
  });

  const result = await response.json();

  await supabase
    .from("instances")
    .update({
      status: "disconnected",
      qr_code: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", instanceId);

  return jsonResponse(result);
}

export async function handleGetStatus(req: Request, url: URL, ctx: HandlerContext): Promise<Response> {
  const { supabase, UAZAPI_URL } = ctx;
  const instanceId = url.searchParams.get("instanceId");
  if (!instanceId || !(await checkInstanceAccess(ctx, instanceId))) {
    return jsonResponse({ error: "Sem permissão para acessar esta instância" }, 403);
  }

  const { data: instance, error: instanceError } = await supabase
    .from("instances")
    .select("uazapi_token, uazapi_instance_id")
    .eq("id", instanceId)
    .single();

  if (instanceError || !instance?.uazapi_token) {
    return jsonResponse({ error: "Instância não encontrada" }, 404);
  }

  const response = await fetch(`${UAZAPI_URL}/instance/status`, {
    method: "GET",
    headers: {
      "token": instance.uazapi_token,
    },
  });

  const result = await response.json();

  if (result.instance) {
    await supabase
      .from("instances")
      .update({
        status: result.instance.status === "connected" ? "connected" :
          result.instance.status === "connecting" ? "connecting" : "disconnected",
        qr_code: result.instance.qrcode || null,
        profile_name: result.instance.profileName || null,
        profile_pic_url: result.instance.profilePicUrl || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", instanceId);
  }

  return jsonResponse(result);
}

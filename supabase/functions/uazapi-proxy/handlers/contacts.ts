import type { HandlerContext } from "../lib/context.ts";
import { checkInstanceAccess } from "../lib/context.ts";
import { jsonResponse } from "../lib/constants.ts";

export async function handleContactRemove(req: Request, _url: URL, ctx: HandlerContext): Promise<Response> {
  const { supabase, UAZAPI_URL } = ctx;
  const body = await req.json().catch(() => ({}));
  const { instanceId, phone } = body as { instanceId?: string; phone?: string };

  if (!instanceId || !phone) {
    return jsonResponse({ error: "instanceId e phone são obrigatórios" }, 400);
  }

  if (!(await checkInstanceAccess(ctx, instanceId))) {
    return jsonResponse({ error: "Acesso negado" }, 403);
  }

  const { data: instance, error } = await supabase
    .from("instances")
    .select("uazapi_token")
    .eq("id", instanceId)
    .single();

  if (error || !instance?.uazapi_token) {
    return jsonResponse({ error: "Instância não encontrada" }, 404);
  }

  const removeRes = await fetch(`${UAZAPI_URL}/contact/remove`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "token": instance.uazapi_token,
    },
    body: JSON.stringify({ phone }),
  });

  const removeResult = await removeRes.json();
  return jsonResponse(removeResult, removeRes.status);
}

export async function handleContactAdd(req: Request, _url: URL, ctx: HandlerContext): Promise<Response> {
  const { supabase, UAZAPI_URL } = ctx;
  const body = await req.json().catch(() => ({}));
  const { instanceId, phone, name } = body as { instanceId?: string; phone?: string; name?: string };

  if (!instanceId || !phone || !name) {
    return jsonResponse({ error: "instanceId, phone e name são obrigatórios" }, 400);
  }

  if (!(await checkInstanceAccess(ctx, instanceId))) {
    return jsonResponse({ error: "Acesso negado" }, 403);
  }

  const { data: instanceAdd, error: errAdd } = await supabase
    .from("instances")
    .select("uazapi_token")
    .eq("id", instanceId)
    .single();

  if (errAdd || !instanceAdd?.uazapi_token) {
    return jsonResponse({ error: "Instância não encontrada" }, 404);
  }

  const addRes = await fetch(`${UAZAPI_URL}/contact/add`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "token": instanceAdd.uazapi_token,
    },
    body: JSON.stringify({ phone, name }),
  });

  const addResult = await addRes.json();
  return jsonResponse(addResult, addRes.status);
}

export async function handleUpdateContact(req: Request, _url: URL, ctx: HandlerContext): Promise<Response> {
  const { supabase, UAZAPI_URL } = ctx;
  const body = await req.json();
  const { instanceId, contactPhone, newName } = body;

  if (!instanceId || !contactPhone || !newName) {
    return jsonResponse({ error: "Campos obrigatórios ausentes" }, 400);
  }

  if (!(await checkInstanceAccess(ctx, instanceId))) {
    return jsonResponse({ error: "Acesso negado" }, 403);
  }

  const { data: instance, error } = await supabase
    .from("instances")
    .select("uazapi_token")
    .eq("id", instanceId)
    .single();

  if (error || !instance?.uazapi_token) {
    return jsonResponse({ error: "Instância não encontrada" }, 404);
  }

  const removeRes = await fetch(`${UAZAPI_URL}/contact/remove`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "token": instance.uazapi_token,
    },
    body: JSON.stringify({ phone: contactPhone }),
  });

  if (removeRes.status !== 200 && removeRes.status !== 404) {
    const removeResult = await removeRes.json();
    return jsonResponse(removeResult, removeRes.status);
  }

  const response = await fetch(`${UAZAPI_URL}/contact/add`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "token": instance.uazapi_token,
    },
    body: JSON.stringify({
      phone: contactPhone,
      name: newName,
    }),
  });

  const result = await response.json();
  return jsonResponse(result, response.status);
}

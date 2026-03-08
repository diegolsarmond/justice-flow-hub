import type { HandlerContext } from "../lib/context.ts";
import { checkInstanceAccess } from "../lib/context.ts";
import { jsonResponse } from "../lib/constants.ts";

export async function handleGetWebhook(_req: Request, url: URL, ctx: HandlerContext): Promise<Response> {
  const { supabase, UAZAPI_URL } = ctx;
  const instanceId = url.searchParams.get("instanceId");
  if (!instanceId || !(await checkInstanceAccess(ctx, instanceId))) {
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

  const response = await fetch(`${UAZAPI_URL}/webhook`, {
    method: "GET",
    headers: { "token": instance.uazapi_token },
  });

  if (!response.ok) {
    const errorText = await response.text();
    return jsonResponse({ error: "Erro ao buscar webhook", details: errorText }, response.status);
  }

  const result = await response.json();
  return jsonResponse(result);
}

export async function handleSetWebhook(req: Request, _url: URL, ctx: HandlerContext): Promise<Response> {
  const { supabase, UAZAPI_URL } = ctx;
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");

  const body = await req.json();
  const {
    instanceId,
    action,
    id: webhookId,
    url: webhookUrl,
    events,
    excludeMessages,
    enabled,
    addUrlEvents,
    addUrlTypesMessages,
  } = body;

  if (!instanceId || !(await checkInstanceAccess(ctx, instanceId))) {
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

  const payload: Record<string, unknown> =
    action === "delete" && webhookId
      ? { action: "delete", id: webhookId }
      : {
        ...(action && { action }),
        ...(webhookId && { id: webhookId }),
        url:
          webhookUrl !== undefined && webhookUrl !== ""
            ? webhookUrl
            : action !== "update" && SUPABASE_URL
              ? `${SUPABASE_URL}/functions/v1/uazapi-webhook`
              : undefined,
        events: events ?? ["messages", "messages_update", "connection"],
        excludeMessages: excludeMessages ?? ["wasSentByApi"],
        ...(typeof enabled === "boolean" && { enabled }),
        ...(typeof addUrlEvents === "boolean" && { addUrlEvents }),
        ...(typeof addUrlTypesMessages === "boolean" && { addUrlTypesMessages }),
      };
  if (payload.url === undefined) delete payload.url;

  const response = await fetch(`${UAZAPI_URL}/webhook`, {
    method: "POST",
    headers: {
      "token": instance.uazapi_token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return jsonResponse({ error: "Erro ao configurar webhook", details: errorText }, response.status);
  }

  const result = await response.json();
  return jsonResponse(result);
}

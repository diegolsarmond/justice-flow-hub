import type { HandlerContext } from "../lib/context.ts";
import { checkInstanceAccess, checkRestrictedCanAccessConversation, checkCanAdminister, blockIfRestricted } from "../lib/context.ts";
import { jsonResponse } from "../lib/constants.ts";
import { fetchWithTimeout } from "../lib/fetch.ts";
import { uazapiTimestampToISO } from "../lib/normalize.ts";
import type { UazapiChat } from "../lib/types.ts";

export async function handleGetChatDetails(req: Request, url: URL, ctx: HandlerContext): Promise<Response> {
  const { supabase, UAZAPI_URL } = ctx;
  const instanceId = url.searchParams.get("instanceId");
  const body = await req.json().catch(() => ({}));
  const { number, preview = true } = body as { number?: string; preview?: boolean };

  if (!instanceId || !number) {
    return jsonResponse({ error: "instanceId e number são obrigatórios" }, 400);
  }

  if (!(await checkInstanceAccess(ctx, instanceId))) {
    return jsonResponse({ error: "Sem permissão para acessar esta instância" }, 403);
  }

  const { data: instance, error: instanceError } = await supabase
    .from("instances")
    .select("id, uazapi_token")
    .eq("id", instanceId)
    .single();

  if (instanceError || !instance?.uazapi_token) {
    return jsonResponse({ error: "Instância não encontrada" }, 404);
  }

  const response = await fetch(`${UAZAPI_URL}/chat/details`, {
    method: "POST",
    headers: {
      "token": instance.uazapi_token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ number, preview }),
  });

  if (!response.ok) {
    return jsonResponse({ error: "Erro ao buscar detalhes do chat" }, response.status);
  }

  const chatDetails = await response.json();
  return jsonResponse(chatDetails);
}

export async function handleCheckNumber(req: Request, _url: URL, ctx: HandlerContext): Promise<Response> {
  const { supabase, UAZAPI_URL } = ctx;
  const body = await req.json().catch(() => ({}));
  const { instanceId, numbers } = body as { instanceId?: string; numbers?: string[] };

  if (!instanceId || !Array.isArray(numbers) || numbers.length === 0) {
    return jsonResponse({ error: "instanceId e numbers são obrigatórios" }, 400);
  }

  if (!(await checkInstanceAccess(ctx, instanceId))) {
    return jsonResponse({ error: "Sem permissão para acessar esta instância" }, 403);
  }

  const { data: instance, error: instanceError } = await supabase
    .from("instances")
    .select("id, uazapi_token")
    .eq("id", instanceId)
    .single();

  if (instanceError || !instance?.uazapi_token) {
    return jsonResponse({ error: "Instância não encontrada" }, 404);
  }

  const response = await fetch(`${UAZAPI_URL}/chat/check`, {
    method: "POST",
    headers: {
      "token": instance.uazapi_token,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: JSON.stringify({ numbers }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return jsonResponse({ error: "Erro ao verificar número", details: errorText }, response.status);
  }

  const result = await response.json();
  return jsonResponse({ results: result });
}

export async function handleGetConversationByWaChatId(_req: Request, url: URL, ctx: HandlerContext): Promise<Response> {
  const { supabase } = ctx;
  const waChatId = url.searchParams.get("wa_chat_id");
  const instanceId = url.searchParams.get("instanceId");

  if (!waChatId || !instanceId) {
    return jsonResponse({ error: "wa_chat_id e instanceId são obrigatórios" }, 400);
  }

  if (!(await checkInstanceAccess(ctx, instanceId))) {
    return jsonResponse({ error: "Sem permissão para acessar esta instância" }, 403);
  }

  const { data: conversation, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("wa_chat_id", waChatId)
    .eq("instance_id", instanceId)
    .single();

  if (error || !conversation) {
    return jsonResponse({ error: "Conversa não encontrada" }, 404);
  }

  if (!(await checkRestrictedCanAccessConversation(ctx, conversation))) {
    return jsonResponse({ error: "Sem permissão para acessar esta conversa" }, 403);
  }

  return jsonResponse({ conversation });
}

export async function handleListChats(_req: Request, url: URL, ctx: HandlerContext): Promise<Response> {
  const { supabase, userId, UAZAPI_URL } = ctx;
  const instanceId = url.searchParams.get("instanceId");
  const limit = Math.min(Math.max(1, parseInt(url.searchParams.get("limit") || "25", 10)), 100);
  const offset = Math.max(0, parseInt(url.searchParams.get("offset") || "0", 10));
  const search = (url.searchParams.get("search") ?? "").trim();

  if (!instanceId || !(await checkInstanceAccess(ctx, instanceId))) {
    return jsonResponse({ error: "Sem permissão para acessar esta instância" }, 403);
  }

  const { data: instance, error: instanceError } = await supabase
    .from("instances")
    .select("id, uazapi_token")
    .eq("id", instanceId)
    .single();

  if (instanceError || !instance?.uazapi_token) {
    return jsonResponse({ error: "Instância não encontrada" }, 404);
  }

  const body: Record<string, unknown> = {
    sort: "-wa_lastMsgTimestamp",
    limit,
    offset,
  };
  if (search.length > 0) {
    body.operator = "OR";
    body.name = `~${search}`;
    body.wa_contactName = `~${search}`;
    body.wa_name = `~${search}`;
    body.phone = `~${search}`;
  }

  console.log(`Fetching chats for instance: ${instanceId}, limit=${limit}, offset=${offset}${search ? `, search=${search}` : ""}`);

  const returnFallbackFromDatabase = async (reason: string) => {
    console.warn(`[list-chats] Fallback to database: ${reason}`);

    let q = supabase
      .from("conversations")
      .select("*")
      .eq("instance_id", instanceId)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1);

    if (search.length > 0) {
      q = q.or(`contact_name.ilike.%${search}%,contact_phone.ilike.%${search}%`);
    }

    const { data: dbConversations, error: dbError } = await q;

    if (dbError) {
      console.error(`[list-chats] Fallback database error:`, dbError);
      return jsonResponse({
        error: "A API do WhatsApp está demorando e não foi possível carregar do cache local.",
        code: "FALLBACK_FAILED",
      }, 503);
    }

    let conversations = dbConversations || [];

    const hasMore = conversations.length >= limit;

    return jsonResponse({
      conversations,
      synced: 0,
      hasMore,
      fromCache: true,
      cacheReason: reason,
    });
  };

  let response: Response;
  try {
    response = await fetchWithTimeout(`${UAZAPI_URL}/chat/find`, {
      method: "POST",
      headers: {
        "token": instance.uazapi_token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (fetchErr: unknown) {
    const isTimeout = fetchErr instanceof Error && fetchErr.name === "AbortError";
    console.error(`uazapi list-chats fetch failed (timeout=${isTimeout}):`, fetchErr);
    return returnFallbackFromDatabase(isTimeout ? "TIMEOUT" : "NETWORK_ERROR");
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`uazapi error: ${response.status} - ${errorText}`);
    const isGatewayError = response.status === 502 || response.status === 503 || response.status === 504;
    if (isGatewayError) {
      console.warn(`[list-chats] UAZAPI ${response.status}, falling back to database cache.`);
      return returnFallbackFromDatabase(`GATEWAY_${response.status}`);
    }
    return jsonResponse({
      error: "Erro ao buscar conversas",
      code: `HTTP_${response.status}`,
    }, response.status);
  }

  const findResult = await response.json();
  const chats: UazapiChat[] = findResult.chats || [];
  const pagination = findResult.pagination as { hasNextPage?: boolean } | undefined;
  const hasMoreFromApi = Boolean(pagination?.hasNextPage);
  console.log(`Found ${chats.length} chats, hasMore=${hasMoreFromApi}`);

  for (const chat of chats) {
    const { error: upsertError } = await supabase
      .from("conversations")
      .upsert({
        instance_id: instance.id,
        wa_chat_id: chat.wa_chatid || chat.id,
        contact_name: chat.name || chat.wa_name || chat.wa_contactName || "Contato",
        contact_phone: chat.phone || chat.wa_chatid?.replace("@s.whatsapp.net", "") || "",
        contact_image: chat.image || chat.imagePreview || chat.profilePic || chat.profilePicUrl || null,
        is_group: chat.wa_isGroup || false,
        unread_count: chat.wa_unreadCount || 0,
        last_message_at: uazapiTimestampToISO(chat.wa_lastMsgTimestamp),
        last_message_text: chat.wa_lastMessageTextVote || null,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "wa_chat_id,instance_id",
        ignoreDuplicates: false,
      });

    if (upsertError) {
      console.error(`Error upserting chat ${chat.id}:`, upsertError);
    }
  }

  const waChatIds = chats.map((c) => c.wa_chatid || c.id);
  let conversations: { assigned_to?: string | null;[k: string]: unknown }[] = [];
  if (waChatIds.length > 0) {
    const { data: dbRows } = await supabase
      .from("conversations")
      .select("*")
      .eq("instance_id", instanceId)
      .in("wa_chat_id", waChatIds);
    const byWaChatId = new Map((dbRows || []).map((r: { wa_chat_id: string }) => [r.wa_chat_id, r]));
    conversations = waChatIds.map((id) => byWaChatId.get(id)).filter((c): c is { assigned_to?: string | null;[k: string]: unknown } => Boolean(c));
  }


  const hasMore = hasMoreFromApi || (conversations.length >= limit);

  return jsonResponse({ conversations, synced: chats.length, hasMore });
}

export async function handleListChatsCounts(_req: Request, url: URL, ctx: HandlerContext): Promise<Response> {
  const { supabase, userId } = ctx;
  const instanceIdCounts = url.searchParams.get("instanceId");
  if (!instanceIdCounts || !(await checkInstanceAccess(ctx, instanceIdCounts))) {
    return jsonResponse({ error: "Sem permissão para acessar esta instância" }, 403);
  }

  const buildCountQuery = (statusFilter?: { eq?: string; in?: string[] }) => {
    let q = supabase
      .from("conversations")
      .select("id", { count: "exact", head: true })
      .eq("instance_id", instanceIdCounts);
    if (statusFilter?.eq) q = q.eq("status", statusFilter.eq);
    if (statusFilter?.in) q = q.in("status", statusFilter.in);
    return q.then((r: { count: number | null }) => r.count ?? 0);
  };
  const [countAll, countPending, countOpen, countResolved] = await Promise.all([
    buildCountQuery(),
    buildCountQuery({ eq: "pending" }),
    buildCountQuery({ eq: "open" }),
    buildCountQuery({ in: ["resolved", "archived"] }),
  ]);
  const totalCounts = {
    all: countAll,
    "0": countPending,
    "1": countOpen,
    "2": countResolved,
  };
  return jsonResponse({ totalCounts });
}

export async function handleCreateConversation(req: Request, _url: URL, ctx: HandlerContext): Promise<Response> {
  const { supabase } = ctx;
  const body = await req.json();
  const { instanceId, countryCode, phoneNumber, contactName, waChatId: providedWaChatId } = body;

  if (!instanceId || !countryCode || !phoneNumber) {
    return jsonResponse({ error: "Instância, código do país e número são obrigatórios" }, 400);
  }

  if (!(await checkInstanceAccess(ctx, instanceId))) {
    return jsonResponse({ error: "Sem permissão para acessar esta instância" }, 403);
  }

  const digitsOnly = (phoneNumber as string).replace(/\D/g, "");
  if (digitsOnly.length < 8) {
    return jsonResponse({ error: "Número inválido" }, 400);
  }

  const code = (countryCode as string).replace(/\D/g, "");
  // Use o waChatId validado pelo /chat/check se fornecido, senão monta manualmente
  const waChatId = providedWaChatId || `${code}${digitsOnly}`;
  const contactPhone = `${code}${digitsOnly}`;

  const { data: existing } = await supabase
    .from("conversations")
    .select("id, wa_chat_id, contact_name, contact_phone")
    .eq("instance_id", instanceId)
    .eq("wa_chat_id", waChatId)
    .single();

  if (existing) {
    return jsonResponse({ conversation: existing });
  }

  const { data: newConv, error: insertError } = await supabase
    .from("conversations")
    .insert({
      instance_id: instanceId,
      wa_chat_id: waChatId,
      contact_phone: contactPhone,
      contact_name: (contactName || "").trim() || null,
    })
    .select()
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      const { data: fetched } = await supabase
        .from("conversations")
        .select("*")
        .eq("instance_id", instanceId)
        .eq("wa_chat_id", waChatId)
        .single();
      return jsonResponse({ conversation: fetched });
    }
    return jsonResponse({ error: "Erro ao criar conversa", details: insertError.message }, 500);
  }

  return jsonResponse({ conversation: newConv });
}

export async function handleArchiveChat(req: Request, _url: URL, ctx: HandlerContext): Promise<Response> {
  const { supabase, UAZAPI_URL } = ctx;
  const blocked = await blockIfRestricted(ctx);
  if (blocked) return blocked;

  const body = await req.json();
  const { conversationId, archive } = body;

  const { data: conversation, error: convError } = await supabase
    .from("conversations")
    .select("wa_chat_id, instance_id, instances(uazapi_token)")
    .eq("id", conversationId)
    .single();

  if (convError || !conversation) {
    return jsonResponse({ error: "Conversa não encontrada" }, 404);
  }

  const convInstanceId = (conversation as { instance_id?: string }).instance_id;
  if (!convInstanceId || !(await checkInstanceAccess(ctx, convInstanceId))) {
    return jsonResponse({ error: "Sem permissão para acessar esta conversa" }, 403);
  }

  const adminErr = await checkCanAdminister(ctx, convInstanceId);
  if (adminErr) return adminErr;

  const instanceData = conversation.instances as { uazapi_token: string } | null;
  if (!instanceData?.uazapi_token) {
    return jsonResponse({ error: "Token da instância não encontrado" }, 404);
  }

  const number = conversation.wa_chat_id?.replace("@s.whatsapp.net", "")?.replace("@g.us", "") || conversation.wa_chat_id;
  const response = await fetch(`${UAZAPI_URL}/chat/archive`, {
    method: "POST",
    headers: {
      "token": instanceData.uazapi_token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ number, archive: !!archive }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return jsonResponse({ error: "Erro ao arquivar conversa", details: errorText }, response.status);
  }

  const result = await response.json();
  return jsonResponse(result);
}

export async function handleBlockChat(req: Request, _url: URL, ctx: HandlerContext): Promise<Response> {
  const { supabase, UAZAPI_URL } = ctx;
  const blocked = await blockIfRestricted(ctx);
  if (blocked) return blocked;

  const body = await req.json();
  const { conversationId, block } = body;

  const { data: conversation, error: convError } = await supabase
    .from("conversations")
    .select("wa_chat_id, instance_id, instances(uazapi_token)")
    .eq("id", conversationId)
    .single();

  if (convError || !conversation) {
    return jsonResponse({ error: "Conversa não encontrada" }, 404);
  }

  const convInstanceId = (conversation as { instance_id?: string }).instance_id;
  if (!convInstanceId || !(await checkInstanceAccess(ctx, convInstanceId))) {
    return jsonResponse({ error: "Sem permissão para acessar esta conversa" }, 403);
  }

  const adminErr = await checkCanAdminister(ctx, convInstanceId);
  if (adminErr) return adminErr;

  const instanceData = conversation.instances as { uazapi_token: string } | null;
  if (!instanceData?.uazapi_token) {
    return jsonResponse({ error: "Token da instância não encontrado" }, 404);
  }

  const number = conversation.wa_chat_id?.replace("@s.whatsapp.net", "")?.replace("@g.us", "") || conversation.wa_chat_id;
  const response = await fetch(`${UAZAPI_URL}/chat/block`, {
    method: "POST",
    headers: {
      "token": instanceData.uazapi_token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ number, block: !!block }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return jsonResponse({ error: "Erro ao bloquear/desbloquear contato", details: errorText }, response.status);
  }

  const result = await response.json();
  return jsonResponse(result);
}

export async function handleMuteChat(req: Request, _url: URL, ctx: HandlerContext): Promise<Response> {
  const { supabase, UAZAPI_URL } = ctx;
  const blocked = await blockIfRestricted(ctx);
  if (blocked) return blocked;

  const body = await req.json();
  const { conversationId, muteEndTime } = body;

  const { data: conversation, error: convError } = await supabase
    .from("conversations")
    .select("wa_chat_id, instance_id, instances(uazapi_token)")
    .eq("id", conversationId)
    .single();

  if (convError || !conversation) {
    return jsonResponse({ error: "Conversa não encontrada" }, 404);
  }

  const convInstanceId = (conversation as { instance_id?: string }).instance_id;
  if (!convInstanceId || !(await checkInstanceAccess(ctx, convInstanceId))) {
    return jsonResponse({ error: "Sem permissão para acessar esta conversa" }, 403);
  }

  const adminErr = await checkCanAdminister(ctx, convInstanceId);
  if (adminErr) return adminErr;

  const instanceData = conversation.instances as { uazapi_token: string } | null;
  if (!instanceData?.uazapi_token) {
    return jsonResponse({ error: "Token da instância não encontrado" }, 404);
  }

  const response = await fetch(`${UAZAPI_URL}/chat/mute`, {
    method: "POST",
    headers: {
      "token": instanceData.uazapi_token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      number: conversation.wa_chat_id,
      muteEndTime: muteEndTime ?? 0,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return jsonResponse({ error: "Erro ao silenciar conversa", details: errorText }, response.status);
  }

  const result = await response.json();
  return jsonResponse(result);
}

export async function handlePinChat(req: Request, _url: URL, ctx: HandlerContext): Promise<Response> {
  const { supabase, UAZAPI_URL } = ctx;
  const blocked = await blockIfRestricted(ctx);
  if (blocked) return blocked;

  const body = await req.json();
  const { conversationId, pin } = body;

  const { data: conversation, error: convError } = await supabase
    .from("conversations")
    .select("wa_chat_id, instance_id, instances(uazapi_token)")
    .eq("id", conversationId)
    .single();

  if (convError || !conversation) {
    return jsonResponse({ error: "Conversa não encontrada" }, 404);
  }

  const convInstanceId = (conversation as { instance_id?: string }).instance_id;
  if (!convInstanceId || !(await checkInstanceAccess(ctx, convInstanceId))) {
    return jsonResponse({ error: "Sem permissão para acessar esta conversa" }, 403);
  }

  const adminErr = await checkCanAdminister(ctx, convInstanceId);
  if (adminErr) return adminErr;

  const instanceData = conversation.instances as { uazapi_token: string } | null;
  if (!instanceData?.uazapi_token) {
    return jsonResponse({ error: "Token da instância não encontrado" }, 404);
  }

  const number = conversation.wa_chat_id?.replace("@s.whatsapp.net", "")?.replace("@g.us", "") || conversation.wa_chat_id;
  const response = await fetch(`${UAZAPI_URL}/chat/pin`, {
    method: "POST",
    headers: {
      "token": instanceData.uazapi_token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ number, pin: !!pin }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return jsonResponse({ error: "Erro ao fixar conversa", details: errorText }, response.status);
  }

  const result = await response.json();
  return jsonResponse(result);
}

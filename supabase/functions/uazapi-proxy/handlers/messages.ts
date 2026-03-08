import type { HandlerContext } from "../lib/context.ts";
import {
  checkInstanceAccess,
  checkRestrictedCanAccessConversation,
  blockIfRestricted,
  checkCanAdminister,
} from "../lib/context.ts";
import { jsonResponse } from "../lib/constants.ts";
import { normalizeMediaContent, normalizeMessageStatus, uazapiTimestampToISO } from "../lib/normalize.ts";
import type { UazapiMessage } from "../lib/types.ts";

type AttachmentRow = { message_id: string; media_url: string | null; media_base64: string | null; media_type: string | null; filename: string | null };
type AttachmentItem = { media_url: string | null; media_base64: string | null; media_type: string | null; filename: string | null };
type MsgWithAttachments = {
  id: string;
  wa_message_id: string | null;
  attachments: AttachmentItem[];
  [k: string]: unknown;
};



export async function handleListMessages(_req: Request, url: URL, ctx: HandlerContext): Promise<Response> {
  const { supabase, UAZAPI_URL } = ctx;
  const conversationId = url.searchParams.get("conversationId");
  const limit = Math.min(Math.max(1, parseInt(url.searchParams.get("limit") || "20", 10)), 100);
  const offset = Math.max(0, parseInt(url.searchParams.get("offset") || "0", 10));

  const { data: conversation, error: convError } = await supabase
    .from("conversations")
    .select("id, wa_chat_id, instance_id, assigned_to, instances(uazapi_token)")
    .eq("id", conversationId)
    .single();

  if (convError || !conversation) {
    return jsonResponse({ error: "Conversa não encontrada" }, 404);
  }

  const convInstanceId = (conversation as { instance_id?: string }).instance_id;
  if (!convInstanceId || !(await checkInstanceAccess(ctx, convInstanceId))) {
    return jsonResponse({ error: "Sem permissão para acessar esta conversa" }, 403);
  }

  if (!(await checkRestrictedCanAccessConversation(ctx, conversation as { assigned_to?: string | null }))) {
    return jsonResponse({ error: "Usuário restrito: só pode acessar conversas atribuídas a você" }, 403);
  }

  const instanceData = conversation.instances as unknown as { uazapi_token: string } | null;
  if (!instanceData?.uazapi_token) {
    return jsonResponse({ error: "Token da instância não encontrado" }, 404);
  }

  console.log(`[list-messages] chat=${conversation.wa_chat_id}, limit=${limit}, offset=${offset}`);

  const mergeAttachmentsIntoMessages = async (messageRows: { id: string;[k: string]: unknown }[]) => {
    if (!messageRows?.length) return [];
    const ids = messageRows.map((r) => r.id);
    const { data: attachments } = await supabase
      .from("message_attachments")
      .select("message_id, media_url, media_base64, media_type, filename")
      .in("message_id", ids);
    const byMessageId = (attachments || []).reduce((acc: Record<string, AttachmentItem[]>, a: unknown) => {
      const row = a as AttachmentRow;
      if (!acc[row.message_id]) acc[row.message_id] = [];
      acc[row.message_id].push({ media_url: row.media_url, media_base64: row.media_base64, media_type: row.media_type, filename: row.filename });
      return acc;
    }, {} as Record<string, AttachmentItem[]>);
    return messageRows.map((m) => ({ ...m, attachments: byMessageId[m.id] || [] }));
  };

  // Helper: retorna mensagens do banco
  const returnFromDB = async (synced = 0) => {
    const { data: dbRows } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    const hasMore = (dbRows?.length ?? 0) === limit;
    const withAttachments = await mergeAttachmentsIntoMessages(dbRows || []);
    return jsonResponse({ messages: withAttachments, synced, hasMore });
  };

  // ── DB-FIRST: consulta o banco primeiro ──
  const { data: dbRows } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  const dbRowCount = dbRows?.length ?? 0;

  // Se o banco retornou uma página completa → retorna direto (rápido!)
  // O webhook já mantém o banco atualizado em tempo real.
  if (dbRowCount === limit) {
    console.log(`[list-messages] DB returned full page (${dbRowCount}), returning directly`);
    const withAttachments = await mergeAttachmentsIntoMessages(dbRows || []);
    return jsonResponse({ messages: withAttachments, synced: 0, hasMore: true });
  }

  // Se offset=0 e DB tem mensagens (mesmo que menos que limit) → retorna direto
  // Isso evita chamar UAZAPI desnecessariamente na abertura da conversa
  if (offset === 0 && dbRowCount > 0) {
    console.log(`[list-messages] DB returned ${dbRowCount}/${limit} messages on first page, returning directly`);
    const withAttachments = await mergeAttachmentsIntoMessages(dbRows || []);
    return jsonResponse({ messages: withAttachments, synced: 0, hasMore: false });
  }

  // Se offset > 0 e DB retornou mensagens parciais → retorna o que tem (sem backfill para evitar timeout)
  if (offset > 0 && dbRowCount > 0) {
    console.log(`[list-messages] DB returned ${dbRowCount}/${limit} messages on page offset=${offset}, returning directly`);
    const withAttachments = await mergeAttachmentsIntoMessages(dbRows || []);
    return jsonResponse({ messages: withAttachments, synced: 0, hasMore: false });
  }

  // Se offset > 0 e DB retornou 0 mensagens → backfill da UAZAPI (scroll up case)
  // Se offset = 0 e DB retornou 0 → sync inicial
  console.log(`[list-messages] DB returned 0 messages at offset=${offset}, calling UAZAPI for ${offset === 0 ? 'initial sync' : 'backfill'}`);


  let response: Response;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25_000);
    response = await fetch(`${UAZAPI_URL}/message/find`, {
      method: "POST",
      headers: {
        "token": instanceData.uazapi_token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chatid: conversation.wa_chat_id,
        limit,
        offset,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
  } catch (fetchErr) {
    console.error(`[list-messages] UAZAPI fetch error:`, fetchErr);
    return returnFromDB();
  }

  if (!response.ok) {
    console.warn(`[list-messages] UAZAPI returned ${response.status} during backfill`);
    return returnFromDB();
  }

  let findResult: { messages?: UazapiMessage[] };
  try {
    findResult = await response.json();
  } catch (bodyErr) {
    console.error(`[list-messages] Error reading response body:`, bodyErr);
    return returnFromDB();
  }
  const messages: UazapiMessage[] = findResult.messages || [];
  console.log(`[list-messages] UAZAPI backfill: ${messages.length} messages fetched`);

  const mediaTypes = ["image", "video", "audio", "document", "sticker", "ptt", "voice"];

  for (const msg of messages) {
    const mediaNorm = normalizeMediaContent(msg.text, msg.messageType, msg.content);
    const content = mediaNorm.content;
    const messageType = mediaNorm.messageType !== "text" ? mediaNorm.messageType : (msg.messageType || "text");
    const isMediaMessage = mediaTypes.includes(messageType);

    const { data: upserted, error: upsertError } = await supabase
      .from("messages")
      .upsert({
        conversation_id: conversation.id,
        wa_message_id: msg.messageid || msg.id,
        content,
        message_type: messageType,
        from_me: msg.fromMe || false,
        sender_id: msg.sender || null,
        sender_name: msg.senderName || null,
        status: normalizeMessageStatus(msg.status),
        created_at: uazapiTimestampToISO(msg.messageTimestamp) || new Date().toISOString(),
      }, {
        onConflict: "wa_message_id",
        ignoreDuplicates: false,
      })
      .select("id")
      .single();

    if (upsertError) {
      console.error(`[list-messages] Error upserting message ${msg.id}:`, upsertError);
    } else if (isMediaMessage && upserted?.id) {
      const { data: existingAttachment } = await supabase
        .from("message_attachments")
        .select("id, media_url, media_base64")
        .eq("message_id", upserted.id)
        .maybeSingle();

      const hasCompleteMedia = existingAttachment?.media_url || existingAttachment?.media_base64;
      if (!hasCompleteMedia) {
        try {
          console.log(`[list-messages] Downloading media for message ${upserted.id} (type: ${messageType})`);
          const { data: attachmentId, error: rpcError } = await supabase.rpc('download_and_store_message_media', {
            p_message_id: upserted.id,
            p_uazapi_token: instanceData.uazapi_token,
            p_return_base64: true,
            p_return_link: true,
            p_generate_mp3: messageType === "audio" || messageType === "ptt" || messageType === "voice",
            p_download_quoted: false
          });

          if (rpcError) {
            console.error(`[list-messages] Media download error for ${upserted.id}:`, rpcError.message);
          } else {
            console.log(`[list-messages] Media stored for ${upserted.id}, attachment: ${attachmentId}`);
          }
        } catch (downloadError) {
          console.error(`[list-messages] Media download exception for ${upserted.id}:`, downloadError);
        }
      }
    }
  }

  return returnFromDB(messages.length);
}

/**
 * Download de mídia de uma mensagem usando a função SQL download_and_store_message_media.
 * Esta função faz o POST diretamente via pgsql-http no PostgreSQL.
 */
export async function handleGetMessageMedia(req: Request, _url: URL, ctx: HandlerContext): Promise<Response> {
  const { supabase } = ctx;
  const body = await req.json().catch(() => ({}));
  const messageId = body.messageId as string | undefined;
  if (!messageId) {
    return jsonResponse({ error: "messageId é obrigatório" }, 400);
  }

  // Verifica se a mensagem existe e obtém informações
  const { data: message, error: msgError } = await supabase
    .from("messages")
    .select("id, conversation_id, instance_id, wa_message_id, message_type")
    .eq("id", messageId)
    .single();

  if (msgError || !message) {
    return jsonResponse({ error: "Mensagem não encontrada" }, 404);
  }

  const convInstanceId = (message as { instance_id?: string }).instance_id;
  if (!convInstanceId || !(await checkInstanceAccess(ctx, convInstanceId))) {
    return jsonResponse({ error: "Sem permissão para acessar esta conversa" }, 403);
  }

  const waMessageId = (message as { wa_message_id?: string | null }).wa_message_id;
  if (!waMessageId) {
    return jsonResponse({ error: "Mensagem não possui wa_message_id para download" }, 400);
  }

  const { data: convData } = await supabase
    .from("conversations")
    .select("assigned_to")
    .eq("id", (message as { conversation_id?: string }).conversation_id)
    .single();

  if (!(await checkRestrictedCanAccessConversation(ctx, convData as { assigned_to?: string | null }))) {
    return jsonResponse({ error: "Usuário restrito: só pode acessar conversas atribuídas a você" }, 403);
  }

  // Obtém o token UAZAPI da instância
  const { data: instanceData } = await supabase
    .from("instances")
    .select("uazapi_token")
    .eq("id", convInstanceId)
    .single();

  const token = (instanceData as { uazapi_token?: string } | null)?.uazapi_token;
  if (!token) {
    return jsonResponse({ error: "Token da instância não encontrado" }, 404);
  }

  try {
    // Chama a função SQL que faz o download e armazenamento via pgsql-http
    const { data: attachmentId, error: rpcError } = await supabase.rpc('download_and_store_message_media', {
      p_message_id: messageId,
      p_uazapi_token: token,
      p_return_base64: true,
      p_return_link: true,
      p_generate_mp3: true,
      p_download_quoted: false
    });

    if (rpcError) {
      console.error("download_and_store_message_media error:", rpcError);
      return jsonResponse({ error: "Falha ao baixar mídia", details: rpcError.message }, 502);
    }

    if (!attachmentId) {
      return jsonResponse({ error: "Mídia não disponível" }, 404);
    }

    // Busca o attachment recém-criado para retornar os dados
    const { data: attachment, error: attachError } = await supabase
      .from("message_attachments")
      .select("media_url, media_base64, media_type, filename")
      .eq("id", attachmentId)
      .single();

    if (attachError || !attachment) {
      return jsonResponse({ error: "Attachment não encontrado após download" }, 500);
    }

    return jsonResponse({
      media_base64: attachment.media_base64,
      media_url: attachment.media_url,
      media_type: attachment.media_type,
      filename: attachment.filename
    });
  } catch (e) {
    console.error("get-message-media error:", e);
    return jsonResponse({ error: "Erro ao baixar mídia", details: String(e) }, 500);
  }
}

export async function handleSendMessage(req: Request, _url: URL, ctx: HandlerContext): Promise<Response> {
  const { supabase, UAZAPI_URL } = ctx;
  const body = await req.json();
  const { conversationId, text, type = "text", isPrivate = false } = body;

  const { data: conversation, error: convError } = await supabase
    .from("conversations")
    .select("id, wa_chat_id, contact_phone, instance_id, assigned_to, instances(uazapi_token)")
    .eq("id", conversationId)
    .single();

  if (convError || !conversation) {
    return jsonResponse({ error: "Conversa não encontrada" }, 404);
  }

  const convInstanceId = (conversation as { instance_id?: string }).instance_id;
  if (!convInstanceId || !(await checkInstanceAccess(ctx, convInstanceId))) {
    return jsonResponse({ error: "Sem permissão para acessar esta conversa" }, 403);
  }

  if (!(await checkRestrictedCanAccessConversation(ctx, conversation as { assigned_to?: string | null }))) {
    return jsonResponse({ error: "Usuário restrito: só pode acessar conversas atribuídas a você" }, 403);
  }

  const blocked = await blockIfRestricted(ctx);
  if (blocked) return blocked;

  if (isPrivate) {
    const { data: newMessage, error: msgError } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        wa_message_id: null,
        content: text,
        message_type: type,
        from_me: true,
        status: "private",
        is_private: true,
      })
      .select()
      .single();

    if (msgError) {
      return jsonResponse({ error: "Erro ao salvar mensagem privada", details: msgError.message }, 500);
    }
    return jsonResponse({ message: newMessage });
  }

  const instanceData = conversation.instances as unknown as { uazapi_token: string } | null;
  if (!instanceData?.uazapi_token) {
    return jsonResponse({ error: "Token da instância não encontrado" }, 404);
  }

  const number = conversation.wa_chat_id || conversation.contact_phone;
  console.log(`Sending message to: ${number}`);

  const response = await fetch(`${UAZAPI_URL}/send/text`, {
    method: "POST",
    headers: {
      "token": instanceData.uazapi_token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      number: number,
      text: text,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`uazapi error: ${response.status} - ${errorText}`);
    return jsonResponse({ error: "Erro ao enviar mensagem", details: errorText }, response.status);
  }

  const result = await response.json();
  console.log(`Message sent:`, result);

  const { data: newMessage, error: msgError } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      wa_message_id: result.messageid || result.id,
      content: text,
      message_type: type,
      from_me: true,
      status: "sent",
    })
    .select()
    .single();

  await supabase
    .from("conversations")
    .update({
      last_message_text: text,
      last_message_at: new Date().toISOString(),
    })
    .eq("id", conversationId);

  return jsonResponse({ message: newMessage, uazapi: result });
}

export async function handleSendMedia(req: Request, _url: URL, ctx: HandlerContext): Promise<Response> {
  const { supabase, UAZAPI_URL } = ctx;
  const body = await req.json();
  const { conversationId, type, file, text, docName } = body;

  const { data: conversation, error: convError } = await supabase
    .from("conversations")
    .select("id, wa_chat_id, contact_phone, instance_id, assigned_to, instances(uazapi_token)")
    .eq("id", conversationId)
    .single();

  if (convError || !conversation) {
    return jsonResponse({ error: "Conversa não encontrada" }, 404);
  }

  const convInstanceId = (conversation as { instance_id?: string }).instance_id;
  if (!convInstanceId || !(await checkInstanceAccess(ctx, convInstanceId))) {
    return jsonResponse({ error: "Sem permissão para acessar esta conversa" }, 403);
  }

  if (!(await checkRestrictedCanAccessConversation(ctx, conversation as { assigned_to?: string | null }))) {
    return jsonResponse({ error: "Usuário restrito: só pode acessar conversas atribuídas a você" }, 403);
  }

  const blocked = await blockIfRestricted(ctx);
  if (blocked) return blocked;

  const instanceData = conversation.instances as unknown as { uazapi_token: string } | null;
  if (!instanceData?.uazapi_token) {
    return jsonResponse({ error: "Token da instância não encontrado" }, 404);
  }

  if (!type || !file) {
    return jsonResponse({ error: "Tipo e arquivo são obrigatórios para envio de mídia" }, 400);
  }

  const number = conversation.wa_chat_id || conversation.contact_phone;
  const mediaPayload: Record<string, unknown> = { number, type, file };
  if (text) mediaPayload.text = text;
  if (docName) mediaPayload.docName = docName;

  const response = await fetch(`${UAZAPI_URL}/send/media`, {
    method: "POST",
    headers: {
      "token": instanceData.uazapi_token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(mediaPayload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`uazapi error: ${response.status} - ${errorText}`);
    return jsonResponse({ error: "Erro ao enviar mídia", details: errorText }, response.status);
  }

  const result = await response.json();
  const { data: newMessage } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      wa_message_id: result.messageid || result.id || crypto.randomUUID(),
      content: text || null,
      message_type: type,
      from_me: true,
      status: "sent",
    })
    .select()
    .single();

  if (newMessage?.id && file) {
    const isDataUrl = typeof file === "string" && file.startsWith("data:");
    const mediaUrl = isDataUrl ? null : file;
    const mediaBase64 = isDataUrl ? (file.split(",")[1] ?? null) : null;
    await supabase.from("message_attachments").insert({
      message_id: newMessage.id,
      chat_id: conversation.wa_chat_id,
      media_url: mediaUrl,
      media_base64: mediaBase64,
      media_type: type,
    });
  }

  await supabase
    .from("conversations")
    .update({
      last_message_text: text || "[Mídia]",
      last_message_at: new Date().toISOString(),
    })
    .eq("id", conversationId);

  return jsonResponse({ message: newMessage, uazapi: result });
}

export async function handleMarkMessagesRead(req: Request, url: URL, ctx: HandlerContext): Promise<Response> {
  const { supabase, UAZAPI_URL } = ctx;
  const body = await req.json();
  const { messageIds } = body;

  const conversationId = url.searchParams.get("conversationId");
  if (!conversationId) {
    return jsonResponse({ error: "conversationId é obrigatório" }, 400);
  }

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

  if (!(await checkRestrictedCanAccessConversation(ctx, conversation as { assigned_to?: string | null }))) {
    return jsonResponse({ error: "Usuário restrito: só pode acessar conversas atribuídas a você" }, 403);
  }

  const blocked = await blockIfRestricted(ctx);
  if (blocked) return blocked;

  const instanceData = conversation.instances as unknown as { uazapi_token: string } | null;
  if (!instanceData?.uazapi_token) {
    return jsonResponse({ error: "Token da instância não encontrado" }, 404);
  }

  const ids = Array.isArray(messageIds) ? messageIds : [messageIds];
  if (ids.length === 0) {
    return jsonResponse({ error: "Nenhuma mensagem para marcar como lida" }, 400);
  }

  const response = await fetch(`${UAZAPI_URL}/message/markread`, {
    method: "POST",
    headers: {
      "token": instanceData.uazapi_token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id: ids }),
  });

  const result = await response.json();

  await supabase
    .from("conversations")
    .update({ unread_count: 0, updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  return jsonResponse(result);
}

export async function handleReactMessage(req: Request, _url: URL, ctx: HandlerContext): Promise<Response> {
  const { supabase, UAZAPI_URL } = ctx;
  const blocked = await blockIfRestricted(ctx);
  if (blocked) return blocked;

  const body = await req.json();
  const { conversationId, messageId, emoji } = body;

  const { data: conversation, error: convError } = await supabase
    .from("conversations")
    .select("wa_chat_id, instance_id, assigned_to, instances(uazapi_token)")
    .eq("id", conversationId)
    .single();

  if (convError || !conversation) {
    return jsonResponse({ error: "Conversa não encontrada" }, 404);
  }

  const convInstanceId = (conversation as { instance_id?: string }).instance_id;
  if (!convInstanceId || !(await checkInstanceAccess(ctx, convInstanceId))) {
    return jsonResponse({ error: "Sem permissão para acessar esta conversa" }, 403);
  }

  if (!(await checkRestrictedCanAccessConversation(ctx, conversation as { assigned_to?: string | null }))) {
    return jsonResponse({ error: "Usuário restrito: só pode acessar conversas atribuídas a você" }, 403);
  }

  const adminErr = await checkCanAdminister(ctx, convInstanceId);
  if (adminErr) return adminErr;

  const instanceData = conversation.instances as unknown as { uazapi_token: string } | null;
  if (!instanceData?.uazapi_token) {
    return jsonResponse({ error: "Token da instância não encontrado" }, 404);
  }

  const response = await fetch(`${UAZAPI_URL}/message/react`, {
    method: "POST",
    headers: {
      "token": instanceData.uazapi_token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      number: conversation.wa_chat_id,
      id: messageId,
      text: emoji ?? "",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return jsonResponse({ error: "Erro ao reagir à mensagem", details: errorText }, response.status);
  }

  const result = await response.json();
  return jsonResponse(result);
}

export async function handleDeleteMessage(req: Request, url: URL, ctx: HandlerContext): Promise<Response> {
  const { supabase, UAZAPI_URL } = ctx;
  const blocked = await blockIfRestricted(ctx);
  if (blocked) return blocked;

  const body = await req.json();
  const { messageId } = body;

  const instanceId = url.searchParams.get("instanceId");
  if (!instanceId || !(await checkInstanceAccess(ctx, instanceId))) {
    return jsonResponse({ error: "Sem permissão para acessar esta instância" }, 403);
  }

  const adminErr = await checkCanAdminister(ctx, instanceId);
  if (adminErr) return adminErr;

  const { data: instance, error: instanceError } = await supabase
    .from("instances")
    .select("uazapi_token")
    .eq("id", instanceId)
    .single();

  if (instanceError || !instance?.uazapi_token) {
    return jsonResponse({ error: "Instância não encontrada" }, 404);
  }

  const response = await fetch(`${UAZAPI_URL}/message/delete`, {
    method: "POST",
    headers: {
      "token": instance.uazapi_token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id: messageId }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return jsonResponse({ error: "Erro ao excluir mensagem", details: errorText }, response.status);
  }

  const result = await response.json();
  return jsonResponse(result);
}

export async function handleEditMessage(req: Request, url: URL, ctx: HandlerContext): Promise<Response> {
  const { supabase, UAZAPI_URL } = ctx;
  const blocked = await blockIfRestricted(ctx);
  if (blocked) return blocked;

  const body = await req.json();
  const { messageId, text } = body;

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

  const response = await fetch(`${UAZAPI_URL}/message/edit`, {
    method: "POST",
    headers: {
      "token": instance.uazapi_token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id: messageId, text }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    return jsonResponse({ error: "Erro ao editar mensagem", details: errorText }, response.status);
  }

  const result = await response.json();

  await supabase
    .from("messages")
    .update({ content: text, edited_at: new Date().toISOString() })
    .eq("wa_message_id", messageId);

  return jsonResponse(result);
}

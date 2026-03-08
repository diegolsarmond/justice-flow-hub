import { createClient, RealtimeChannel } from "https://esm.sh/@supabase/supabase-js@2";

// Broadcast de mensagem ao vivo para clientes conectados (antes do upsert no banco)
async function broadcastLiveMessage(
  supabaseUrl: string,
  supabaseKey: string,
  conversationId: string,
  instanceId: string,
  liveMessage: {
    id: string; // ID temporário (temp-${wa_message_id})
    conversation_id: string;
    wa_message_id: string;
    content: string | null;
    message_type: string;
    from_me: boolean;
    sender_id?: string | null;
    sender_name?: string | null;
    status: string;
    created_at: string;
    is_live: true; // Marca como mensagem "live" para desduplicação no frontend
  }
): Promise<void> {
  try {
    // Cria um cliente com Realtime para broadcast
    const client = createClient(supabaseUrl, supabaseKey, {
      realtime: { params: { eventsPerSecond: 10 } },
    });
    const channelName = `live-messages:${instanceId}`;
    const channel: RealtimeChannel = client.channel(channelName, {
      config: { broadcast: { self: false } },
    });

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        channel.unsubscribe();
        reject(new Error("Broadcast subscribe timeout"));
      }, 3000);

      channel.subscribe((status: string) => {
        if (status === "SUBSCRIBED") {
          clearTimeout(timeout);
          channel
            .send({
              type: "broadcast",
              event: "new_message",
              payload: liveMessage,
            })
            .then(() => {
              console.log("[Broadcast] Mensagem live enviada:", liveMessage.wa_message_id);
              channel.unsubscribe();
              resolve();
            })
            .catch((err: unknown) => {
              console.warn("[Broadcast] Erro ao enviar mensagem:", err);
              channel.unsubscribe();
              reject(err);
            });
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          clearTimeout(timeout);
          channel.unsubscribe();
          reject(new Error(`Channel error: ${status}`));
        }
      });
    });
  } catch (err) {
    // Broadcast não deve bloquear o fluxo principal
    console.warn("[Broadcast] Falha ao enviar mensagem live (não bloqueante):", err);
  }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// #region agent log
function dbgLog(location: string, message: string, data: Record<string, unknown>, hypothesisId?: string) {
  fetch("http://127.0.0.1:7246/ingest/ac4cd411-f982-4130-b3d5-286010642e07", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ location, message, data, timestamp: Date.now(), hypothesisId }),
  }).catch(() => {});
}
// #endregion

interface WebhookPayload {
  event?: string;
  instance?: string | { id?: string };
  instanceId?: string;
  instance_id?: string;
  data?: Record<string, unknown>;
}

function asStringId(v: unknown): string | undefined {
  if (typeof v === "string" && v.length > 0) return v;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    const id = o.id ?? o.Id;
    if (typeof id === "string" && id.length > 0) return id;
  }
  return undefined;
}

const INSTANCE_KEYS = ["instance", "instanceid", "instance_id", "instancia"];

/** Retorna apenas a árvore de chaves do objeto (para log sem expor valores). */
function extractKeyTree(obj: unknown): unknown {
  if (obj === null || typeof obj !== "object") return typeof obj;
  if (Array.isArray(obj)) return obj.length > 0 ? [extractKeyTree(obj[0])] : [];
  return Object.fromEntries(
    Object.keys(obj as object).map((k) => [k, extractKeyTree((obj as Record<string, unknown>)[k])])
  );
}

function findInstanceInObject(obj: Record<string, unknown>): string | undefined {
  for (const [k, v] of Object.entries(obj)) {
    if (INSTANCE_KEYS.includes(k.toLowerCase())) {
      const id = asStringId(v);
      if (id) return id;
    }
    if (v && typeof v === "object" && !Array.isArray(v) && v !== null) {
      const nested = findInstanceInObject(v as Record<string, unknown>);
      if (nested) return nested;
    }
  }
  return undefined;
}

/** Extrai URL de avatar de um objeto (profilePic, profilePicUrl, image, imagePreview). */
function extractContactImage(obj: Record<string, unknown> | undefined): string | null {
  if (!obj) return null;
  const v = obj.profilePic ?? obj.profilePicUrl ?? obj.image ?? obj.imagePreview;
  if (typeof v === "string" && v.length > 0) return v;
  return null;
}

function resolveInstanceId(payload: WebhookPayload): string | undefined {
  const data = payload.data && typeof payload.data === "object" ? (payload.data as Record<string, unknown>) : null;
  const fromInstance = asStringId(payload.instance) ?? payload.instanceId ?? payload.instance_id;
  const id =
    fromInstance ??
    data?.instance ??
    data?.instanceId ??
    data?.instance_id ??
    (data && asStringId(data.instance));
  if (typeof id === "string") return id;
  return findInstanceInObject(payload as unknown as Record<string, unknown>);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const raw = await req.json();
    // Payload pode vir como array (formato n8n/UAZ-API: [{ message, token, owner, webhookUrl }]), objeto direto ou encapsulado
    let unwrapped: unknown = raw;
    if (Array.isArray(raw) && raw.length > 0) {
      unwrapped = raw[0];
    } else if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) {
      const obj = raw as Record<string, unknown>;
      const keys = Object.keys(obj);
      if (keys.length === 1 && typeof obj[keys[0]] === "object" && obj[keys[0]] !== null && !Array.isArray(obj[keys[0]])) {
        unwrapped = obj[keys[0]];
      }
    }
    const payload = unwrapped as WebhookPayload & {
      message?: Record<string, unknown>;
      token?: string;
      owner?: string;
      body?: Record<string, unknown>;
      EventType?: string;
      instanceName?: string;
    };
    const body = payload.body && typeof payload.body === "object" ? (payload.body as Record<string, unknown>) : null;
    // UAZ-API Go client pode enviar PascalCase; formato workflow/n8n envia body: { EventType, event, message, instanceName, owner, token }
    const normalized: WebhookPayload = {
      event: (payload.event ?? (payload as Record<string, unknown>).Event ?? body?.EventType ?? body?.event) as string | undefined,
      instance: payload.instance ?? (payload as Record<string, unknown>).Instance as string | { id?: string } | undefined,
      instanceId: (payload.instanceId ?? (payload as Record<string, unknown>).InstanceId ?? body?.instanceName ?? body?.owner) as string | undefined,
      instance_id: (payload.instance_id ?? (payload as Record<string, unknown>).instance_id) as string | undefined,
      data: (payload.data ?? (payload as Record<string, unknown>).Data ?? body?.event ?? body?.message ?? payload.message) as Record<string, unknown> | undefined,
    };
    const payloadRecord = payload as Record<string, unknown>;
    let instanceId =
      resolveInstanceId(normalized) ??
      resolveInstanceId(payload) ??
      (body?.instanceName && typeof body.instanceName === "string" ? body.instanceName : undefined) ??
      (body?.owner && typeof body.owner === "string" ? body.owner : undefined) ??
      (payloadRecord.instanceName && typeof payloadRecord.instanceName === "string" ? payloadRecord.instanceName : undefined) ??
      (payloadRecord.owner && typeof payloadRecord.owner === "string" ? payloadRecord.owner : undefined) ??
      (typeof raw === "object" && raw !== null && !Array.isArray(raw)
        ? findInstanceInObject(raw as Record<string, unknown>)
        : undefined);
    const instanceToken =
      (typeof payload.token === "string" ? payload.token : (payload as Record<string, unknown>).token as string | undefined)
      ?? (body?.token && typeof body.token === "string" ? body.token : undefined);
    const event = normalized.event ?? payload.event ?? (payload.message || body?.message ? "messages" : undefined);
    const data = normalized.data ?? payload.data ?? body?.event ?? body?.message ?? payload.message;

    // #region agent log
    dbgLog("uazapi-webhook/index.ts:webhook-entry", "webhook received", {
      hasInstanceId: !!instanceId,
      instanceIdPreview: instanceId ? `${String(instanceId).slice(0, 12)}...` : null,
      hasInstanceToken: !!instanceToken,
      eventType: event,
      dataIsArray: Array.isArray(data),
      dataKeys: data && typeof data === "object" && !Array.isArray(data) ? Object.keys(data) : null,
      rawTopKeys: typeof raw === "object" && raw !== null ? Object.keys(raw as object) : null,
    }, "H1-H2-H4");
    // #endregion

    if (!instanceId && !instanceToken) {
      const topKeys = Array.isArray(raw)
        ? `[array(${raw.length})]`
        : typeof unwrapped === "object" && unwrapped !== null && !Array.isArray(unwrapped)
          ? Object.keys(unwrapped as object).join(",")
          : typeof raw;
      const keyTree = extractKeyTree(raw);
      console.warn("Webhook missing instance. Top-level keys:", topKeys, "Key tree:", JSON.stringify(keyTree));
      const body400 = JSON.stringify({
        error: "Missing instance",
        keys: topKeys,
        keyTree,
      });
      return new Response(body400, {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let dbInstance: { id: string; uazapi_token?: string } | null = null;
    if (instanceId) {
      const res = await supabase
        .from("instances")
        .select("id, uazapi_token")
        .eq("uazapi_instance_id", instanceId)
        .single();
      dbInstance = res.data;
    }
    if (!dbInstance?.id && instanceToken) {
      const trimmedToken = instanceToken.trim();
      console.log(`[Debug] Token lookup (1st block): exact match for "${trimmedToken.slice(0, 8)}..."`);
      // Try exact match first
      let res = await supabase
        .from("instances")
        .select("id, uazapi_token")
        .eq("uazapi_token", trimmedToken)
        .limit(1);
      if (res.error) console.error(`[Debug] Token exact match error:`, res.error.message);
      dbInstance = Array.isArray(res.data) ? res.data[0] : res.data;
      console.log(`[Debug] Token exact match: ${dbInstance?.id ?? "not found"} (data type: ${typeof res.data}, isArray: ${Array.isArray(res.data)}, length: ${Array.isArray(res.data) ? res.data.length : 'n/a'})`);
      // If not found, try prefix match (first 8 chars) - tokens may be stored truncated
      if (!dbInstance?.id && trimmedToken.length >= 8) {
        const tokenPrefix = trimmedToken.slice(0, 8);
        console.log(`[Debug] Token prefix lookup (1st block): "${tokenPrefix}%"`);
        res = await supabase
          .from("instances")
          .select("id, uazapi_token")
          .ilike("uazapi_token", `${tokenPrefix}%`)
          .limit(1);
        if (res.error) console.error(`[Debug] Token prefix match error:`, res.error.message);
        dbInstance = Array.isArray(res.data) ? res.data[0] : res.data;
        console.log(`[Debug] Token prefix match: ${dbInstance?.id ?? "not found"} (data type: ${typeof res.data}, isArray: ${Array.isArray(res.data)}, length: ${Array.isArray(res.data) ? res.data.length : 'n/a'})`);
      }
    }
    // Fallback: buscar por owner (pode ser telefone ou ID da instância)
    const ownerField = (payload as Record<string, unknown>).owner as string | undefined;
    const instanceNameField = (payload as Record<string, unknown>).instanceName as string | undefined;

    if (!dbInstance?.id && ownerField) {
      // Tentar como uazapi_instance_id
      let res = await supabase
        .from("instances")
        .select("id, uazapi_token")
        .eq("uazapi_instance_id", ownerField)
        .maybeSingle();
      dbInstance = res.data;
      // Se não encontrou, tentar como phone_number
      if (!dbInstance?.id) {
        res = await supabase
          .from("instances")
          .select("id, uazapi_token")
          .eq("phone_number", ownerField)
          .maybeSingle();
        dbInstance = res.data;
      }
      // Se não encontrou, tentar busca parcial (owner pode ter @s.whatsapp.net)
      if (!dbInstance?.id) {
        const cleanOwner = ownerField.replace(/@.*$/, "");
        res = await supabase
          .from("instances")
          .select("id, uazapi_token")
          .or(`uazapi_instance_id.eq.${cleanOwner},phone_number.eq.${cleanOwner}`)
          .maybeSingle();
        dbInstance = res.data;
      }
    }

    // Fallback: buscar por instanceName (pode ser o nome ou uazapi_instance_id)
    if (!dbInstance?.id && instanceNameField) {
      const trimmedName = instanceNameField.trim();
      console.log(`[Debug] Trying instanceName lookup: "${trimmedName}" (len=${trimmedName.length})`);
      let res = await supabase
        .from("instances")
        .select("id, uazapi_token")
        .eq("uazapi_instance_id", trimmedName)
        .limit(1);
      if (res.error) console.error(`[Debug] By uazapi_instance_id error:`, res.error.message);
      dbInstance = Array.isArray(res.data) ? res.data[0] : res.data;
      console.log(`[Debug] By uazapi_instance_id: ${dbInstance?.id ?? "not found"}`);
      if (!dbInstance?.id) {
        // Busca case-insensitive pelo nome exato (limit 1 para não falhar se houver duplicatas)
        res = await supabase
          .from("instances")
          .select("id, uazapi_token")
          .ilike("name", trimmedName)
          .limit(1);
        if (res.error) console.error(`[Debug] By name (ilike exact) error:`, res.error.message);
        dbInstance = Array.isArray(res.data) ? res.data[0] : res.data;
        console.log(`[Debug] By name (ilike exact): ${dbInstance?.id ?? "not found"} (data: ${JSON.stringify(res.data)})`);
      }
      if (!dbInstance?.id) {
        // Busca com wildcard (para pegar nomes com espaços extras ou caracteres invisíveis)
        res = await supabase
          .from("instances")
          .select("id, uazapi_token")
          .ilike("name", `%${trimmedName}%`)
          .limit(1);
        if (res.error) console.error(`[Debug] By name (ilike wildcard) error:`, res.error.message);
        dbInstance = Array.isArray(res.data) ? res.data[0] : res.data;
        console.log(`[Debug] By name (ilike wildcard): ${dbInstance?.id ?? "not found"} (data: ${JSON.stringify(res.data)})`);
      }
    }
    // Último fallback: buscar por token (igualdade exata ou prefixo)
    if (!dbInstance?.id && instanceToken && instanceToken.length >= 8) {
      // Primeiro tenta igualdade exata (token no payload pode ser igual ao armazenado)
      let res = await supabase
        .from("instances")
        .select("id, uazapi_token")
        .eq("uazapi_token", instanceToken)
        .limit(1);
      dbInstance = Array.isArray(res.data) ? res.data[0] : res.data;
      if (!dbInstance?.id) {
        const tokenPrefix = instanceToken.slice(0, 8);
        console.log(`[Debug] Trying token prefix lookup: "${tokenPrefix}"`);
        res = await supabase
          .from("instances")
          .select("id, uazapi_token")
          .ilike("uazapi_token", `${tokenPrefix}%`)
          .limit(1);
        dbInstance = Array.isArray(res.data) ? res.data[0] : res.data;
      }
      console.log(`[Debug] By token (exact or prefix): ${dbInstance?.id ?? "not found"}`);
    }

    if (!dbInstance?.id) {
      // #region agent log
      dbgLog("uazapi-webhook/index.ts:instance-not-found", "dbInstance not found, returning 200 without persist", {
        instanceId: instanceId ?? null,
        hadInstanceToken: !!instanceToken,
        eventType: event,
      }, "H1");
      // #endregion
      // Debug: mostrar mais detalhes para diagnosticar
      const tokenPreview = instanceToken ? `${instanceToken.slice(0, 8)}...${instanceToken.slice(-4)}` : "n/a";
      console.warn(`Instance not found for uazapi id: ${instanceId ?? "n/a"} token: ${tokenPreview}`);
      console.warn(`Payload keys:`, Object.keys(payload));
      console.warn(`Owner field:`, ownerField, "instanceName:", instanceNameField);
      // Listar todas as instâncias para debug
      const { data: allInstances } = await supabase
        .from("instances")
        .select("id, uazapi_instance_id, uazapi_token, phone_number, name")
        .limit(10);
      console.warn(`Available instances:`, allInstances?.map(i => ({
        id: i.id?.slice(0, 8),
        uazapi_id: i.uazapi_instance_id,
        token: i.uazapi_token?.slice(0, 8),
        phone: i.phone_number,
        name: i.name
      })));
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // #region agent log
    dbgLog("uazapi-webhook/index.ts:instance-found", "dbInstance found", {
      dbInstanceId: dbInstance.id?.slice(0, 8),
      instanceId,
    }, "H1");
    // #endregion

    // Token para download de mídia (RPC download_and_store_message_media)
    const instanceUazapiToken = dbInstance.uazapi_token || instanceToken || "";

    const eventType = (event || (data as Record<string, string> | undefined)?.event || "").toString().toLowerCase().trim();

    if (eventType === "connection") {
      const d = data as Record<string, unknown> | undefined;
      const status = (d?.status ?? d?.state) as string | undefined;
      const newStatus = status === "connected" ? "connected" : status === "connecting" ? "connecting" : "disconnected";
      const profilePicUrl = (d?.profilePicUrl ?? d?.profile_pic_url) as string | undefined;
      const profileName = (d?.profileName ?? d?.profile_name) as string | undefined;
      await supabase
        .from("instances")
        .update({
          status: newStatus,
          qr_code: (d?.qrcode as string) || null,
          profile_pic_url: profilePicUrl && typeof profilePicUrl === "string" ? profilePicUrl : null,
          profile_name: profileName && typeof profileName === "string" ? profileName : undefined,
          updated_at: new Date().toISOString(),
        })
        .eq("id", dbInstance.id);
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (
      eventType === "messages" ||
      eventType === "message" ||
      eventType === "messages_update"
    ) {
      const msg = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | undefined;
      // #region agent log
      dbgLog("uazapi-webhook/index.ts:messages-block", "entered messages block", {
        eventType,
        hasMsg: !!msg,
        msgKeys: msg ? Object.keys(msg) : null,
        chatId: msg ? (msg.chatid ?? msg.chatId ?? msg.Chat ?? msg.wa_chatid ?? (msg as Record<string, unknown>).chat_id) : null,
        rawMessageId: msg ? (msg.messageid ?? msg.messageId ?? msg.id ?? (msg.MessageIDs as unknown[])?.[0]) : null,
      }, "H2-H4");
      // #endregion
      if (!msg) {
        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const chatId = (msg.chatid ?? msg.chatId ?? msg.Chat ?? msg.wa_chatid ?? (msg as Record<string, unknown>).chat_id) as string | undefined;
      const messageIdsArray = msg.MessageIDs as string[] | undefined;
      const rawMessageId = Array.isArray(messageIdsArray) && messageIdsArray.length > 0
        ? messageIdsArray[0]
        : (msg.messageid ?? msg.messageId ?? msg.id);
      const messageId = typeof rawMessageId === "string" && rawMessageId.trim() ? rawMessageId : undefined;

      if (!chatId || (typeof chatId === "string" && !chatId.trim())) {
        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: conversation, error: convError } = await supabase
        .from("conversations")
        .select("id")
        .eq("instance_id", dbInstance.id)
        .eq("wa_chat_id", chatId)
        .single();

      if (convError || !conversation?.id) {
        const contactImage = extractContactImage(msg);
        const { data: newConv } = await supabase
          .from("conversations")
          .insert({
            instance_id: dbInstance.id,
            wa_chat_id: chatId,
            contact_phone: chatId.replace(/@.*$/, ""),
            contact_name: (msg.wa_name || msg.wa_contactName || msg.senderName || "Contato") as string,
            contact_image: contactImage,
            is_group: !!(msg.isGroup || msg.wa_isGroup),
            updated_at: new Date().toISOString(),
          })
          .select("id")
          .single();

        if (!newConv?.id) {
          return new Response(JSON.stringify({ received: true }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      const { data: conv } = await supabase
        .from("conversations")
        .select("id")
        .eq("instance_id", dbInstance.id)
        .eq("wa_chat_id", chatId)
        .single();

      if (!conv?.id) {
        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const fromMe = !!(msg.fromMe || msg.from_me);
      let text = (msg.text || msg.content || "") as string;
      let msgType = (msg.messageType || msg.messageType || "text") as string;
      let fileUrl = (msg.fileURL || msg.fileUrl) as string | undefined;
      let fileBase64 = (msg.base64Data ?? msg.base64 ?? msg.fileBase64) as string | undefined;

      // Processar mídia que pode vir como JSON no campo text ou content
      // Suporta: imagem, vídeo, áudio, documento, sticker, ptt, ptv
      const rawContentObj = msg.content && typeof msg.content === "object" ? msg.content as Record<string, unknown> : null;
      let mediaData: Record<string, unknown> | null = null;

      // ExtendedTextMessage com link preview: tem JPEGThumbnail só da prévia do link, NÃO é mídia anexada
      const isExtendedText = (msgType ?? "").toLowerCase().includes("extendedtext");
      const hasLinkPreviewIndicators = rawContentObj && Boolean(
        rawContentObj.matchedText ?? rawContentObj.linkPreviewMetadata ??
        ((rawContentObj.title && rawContentObj.description) || (rawContentObj.title && (rawContentObj as Record<string, unknown>).thumbnailWidth))
      );
      const isLinkPreviewOnly = isExtendedText && hasLinkPreviewIndicators;
      if (isLinkPreviewOnly) msgType = "text";

      // Tentar extrair dados de mídia do objeto content ou do texto JSON
      if (rawContentObj && !isLinkPreviewOnly) {
        mediaData = rawContentObj;
      } else if (typeof text === "string" && text.trim().startsWith("{")) {
        // Verificar se é JSON de mídia - usa padrões específicos que indicam dados de mídia reais
        // NÃO inclui "url" ou "URL" isolados pois detectaria falsos positivos em links simples
        const isMediaJson = /["']?(?:PTT|ptt|mimetype|mimeType|seconds|audio\/|image\/|video\/|application\/|fileLength|waveform|base64|base64Data|JPEGThumbnail|fileBase64)["']?\s*[:=]/.test(text);
        if (isMediaJson) {
          try {
            const parsed = JSON.parse(text) as Record<string, unknown>;
            const parsedLinkPreview = Boolean(parsed.matchedText ?? parsed.linkPreviewMetadata ?? (parsed.title && parsed.description));
            if (isExtendedText && parsedLinkPreview) {
              mediaData = null; // link preview: não tratar como mídia
            } else {
              const hasMimeType = typeof parsed.mimetype === "string" || typeof parsed.mimeType === "string";
              const hasBase64 = typeof parsed.base64 === "string" || typeof parsed.base64Data === "string" || typeof parsed.fileBase64 === "string" || typeof parsed.JPEGThumbnail === "string";
              const hasPtt = parsed.PTT === true || parsed.ptt === true;
              const hasMediaIndicators = hasMimeType || hasBase64 || hasPtt;
              if (hasMediaIndicators) {
                mediaData = parsed;
              }
            }
          } catch {
            mediaData = null;
          }
        }
      }

      // Se temos dados de mídia, extrair URL/base64 e determinar o tipo
      if (mediaData) {
        const url = (mediaData.URL ?? mediaData.url ?? mediaData.fileURL ?? mediaData.fileUrl ?? mediaData.mediaUrl) as string | undefined;
        const base64 = (mediaData.base64Data ?? mediaData.base64 ?? mediaData.fileBase64 ?? mediaData.data ?? mediaData.JPEGThumbnail) as string | undefined;
        const mime = ((mediaData.mimetype as string | undefined) ?? "").toLowerCase();
        const isPtt = mediaData.PTT === true || mediaData.ptt === true;
        const fileName = (mediaData.fileName ?? mediaData.filename ?? mediaData.name) as string | undefined;

        if (url) fileUrl = url;
        if (base64) fileBase64 = base64;

        // Determinar tipo de mídia
        const apiType = msgType.toLowerCase().replace("message", "");
        const typeToCheck = mime || apiType;

        if (typeToCheck.startsWith("image/") || typeToCheck === "image" || apiType === "sticker") {
          msgType = apiType === "sticker" ? "sticker" : "image";
          text = apiType === "sticker" ? "[Sticker]" : "[Imagem]";
        } else if (typeToCheck.startsWith("video/") || typeToCheck === "video" || apiType === "ptv") {
          msgType = apiType === "ptv" ? "ptv" : "video";
          text = "[Vídeo]";
        } else if (typeToCheck.startsWith("audio/") || typeToCheck.includes("ogg") || typeToCheck.includes("opus") || isPtt || ["ptt", "audio", "myaudio", "voice"].includes(apiType)) {
          msgType = isPtt || apiType === "ptt" ? "ptt" : "audio";
          text = "[Áudio]";
        } else if (typeToCheck.startsWith("application/") || typeToCheck.startsWith("text/") || apiType === "document") {
          msgType = "document";
          text = fileName ? `[Documento: ${fileName}]` : "[Documento]";
        } else if (url || base64) {
          // Fallback: temos mídia mas não identificamos o tipo
          if (!text || text.trim().startsWith("{")) {
            text = "[Mídia]";
          }
        }
      }
      // Presença: normalizar status para valores aceitos (sent, delivered, read, deleted, pending)
      const rawStatusSource = msg.Type ?? msg.state ?? msg.status ?? "delivered";
      const rawStatus = String(rawStatusSource).toLowerCase();
      const status =
        ["read", "delivered", "sent", "deleted", "pending"].includes(rawStatus) ? rawStatus : "delivered";
      let timestamp = (msg.Timestamp ?? msg.messageTimestamp ?? Date.now() / 1000) as number;
      if (timestamp > 1e12) timestamp = timestamp / 1000;

      const isUpdate = eventType === "messages_update";
      const isDeleted = status === "Deleted" || (msg as Record<string, string>).status === "Deleted";

      // Mensagem com mídia: tipo indica mídia ou payload trouxe fileUrl/fileBase64
      const mediaTypes = ["image", "video", "ptt", "audio", "document", "sticker", "ptv"];
      const isMediaMessage = mediaTypes.includes((msgType || "").toLowerCase().replace("message", "")) || Boolean(fileUrl || fileBase64);

      let persistedMsgId: string | null = null;

      if (!messageId) {
        // #region agent log
        dbgLog("uazapi-webhook/index.ts:no-messageId", "message skipped, no messageId", {
          chatId,
          msgKeys: Object.keys(msg),
          rawMessageId,
          messageIdsArray: messageIdsArray ?? null,
        }, "H3");
        // #endregion
        console.warn("[webhook] message skipped, no messageId", { chatId, keys: Object.keys(msg) });
        const { data: convDataSkip } = await supabase
          .from("conversations")
          .select("unread_count")
          .eq("id", conv.id)
          .single();
        const newUnreadSkip = fromMe ? 0 : ((convDataSkip?.unread_count ?? 0) + 1);
        const contactImageSkip = extractContactImage(msg);
        const conversationUpdateSkip: Record<string, unknown> = {
          last_message_text: text || "[Mídia]",
          last_message_at: new Date(timestamp * 1000).toISOString(),
          unread_count: newUnreadSkip,
          updated_at: new Date().toISOString(),
        };
        if (contactImageSkip) conversationUpdateSkip.contact_image = contactImageSkip;
        await supabase.from("conversations").update(conversationUpdateSkip).eq("id", conv.id);
        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (isDeleted) {
        await supabase
          .from("messages")
          .update({ status: "deleted" })
          .eq("wa_message_id", messageId);
      } else if (isUpdate) {
        const { data: updatedMsg } = await supabase
          .from("messages")
          .update({
            content: text,
            status,
          })
          .eq("wa_message_id", messageId)
          .select("id")
          .single();
        persistedMsgId = updatedMsg?.id ?? null;
      } else {
        // BROADCAST da mensagem ANTES do upsert no banco (para exibição instantânea no frontend)
        const liveMessagePayload = {
          id: `temp-${messageId}`, // ID temporário para desduplicação
          conversation_id: conv.id,
          wa_message_id: messageId,
          content: text,
          message_type: msgType,
          from_me: fromMe,
          sender_id: (msg.sender || msg.senderId) as string | undefined ?? null,
          sender_name: (msg.senderName || msg.sender_name) as string | undefined ?? null,
          status,
          created_at: new Date(timestamp * 1000).toISOString(),
          is_live: true as const, // Marca como mensagem "live"
        };

        // Aguarda o broadcast para garantir que a mensagem chegue ao frontend antes do retorno
        // (Edge Functions podem encerrar o processo após a resposta, matando o broadcast em background)
        await broadcastLiveMessage(
          SUPABASE_URL,
          SUPABASE_SERVICE_ROLE_KEY,
          conv.id,
          dbInstance.id,
          liveMessagePayload
        ).catch((err: unknown) => {
          console.warn("[Broadcast] Erro não bloqueante:", err);
        });

        const upsertPayload = {
          conversation_id: conv.id,
          wa_message_id: messageId,
          content: text,
          message_type: msgType,
          from_me: fromMe,
          sender_id: (msg.sender || msg.senderId) as string | undefined,
          sender_name: (msg.senderName || msg.sender_name) as string | undefined,
          status,
          created_at: new Date(timestamp * 1000).toISOString(),
        };
        // #region agent log
        dbgLog("uazapi-webhook/index.ts:before-upsert", "about to upsert message", {
          messageId,
          conversation_id: conv.id,
          contentLen: typeof text === "string" ? text.length : 0,
        }, "H5");
        // #endregion
        const { data: insertedMsg, error: upsertError } = await supabase
          .from("messages")
          .upsert(upsertPayload, { onConflict: "wa_message_id", ignoreDuplicates: false })
          .select("id")
          .single();
        // #region agent log
        dbgLog("uazapi-webhook/index.ts:after-upsert", upsertError ? "upsert failed" : "upsert success", {
          messageId,
          insertedId: insertedMsg?.id ?? null,
          error: upsertError ? { message: upsertError.message, code: upsertError.code } : null,
        }, "H5");
        // #endregion
        if (upsertError) {
          console.error("[webhook] messages upsert failed", {
            messageId,
            conversation_id: conv.id,
            error: upsertError.message,
            code: upsertError.code,
          });
        }
        persistedMsgId = insertedMsg?.id ?? null;
      }

      if (isMediaMessage && persistedMsgId) {
        if (!instanceUazapiToken) {
          console.warn("[webhook] skip media download: no uazapi token");
        } else {
          const { error: delErr } = await supabase.from("message_attachments").delete().eq("message_id", persistedMsgId);
          if (delErr) console.error("[webhook] message_attachments delete failed", { message_id: persistedMsgId, error: delErr.message });
          const { error: rpcErr } = await supabase.rpc("download_and_store_message_media", {
            p_message_id: persistedMsgId,
            p_uazapi_token: instanceUazapiToken,
            p_return_base64: true,
            p_return_link: true,
          });
          if (rpcErr) console.error("[webhook] download_and_store_message_media failed", { message_id: persistedMsgId, error: rpcErr.message });
        }
      }

      const { data: convData } = await supabase
        .from("conversations")
        .select("unread_count")
        .eq("id", conv.id)
        .single();

      const newUnread = fromMe ? 0 : ((convData?.unread_count ?? 0) + 1);
      const contactImage = extractContactImage(msg);

      const conversationUpdate: Record<string, unknown> = {
        last_message_text: text || "[Mídia]",
        last_message_at: new Date(timestamp * 1000).toISOString(),
        unread_count: newUnread,
        updated_at: new Date().toISOString(),
      };
      if (contactImage) conversationUpdate.contact_image = contactImage;

      await supabase
        .from("conversations")
        .update(conversationUpdate)
        .eq("id", conv.id);
    }

    /** Atualiza contact_image em conversations a partir de eventos contacts ou chats. */
    const updateConversationsContactImage = async (payloadData: unknown) => {
      let items: unknown[] = [];
      if (Array.isArray(payloadData)) items = payloadData;
      else if (payloadData && typeof payloadData === "object") {
        const obj = payloadData as Record<string, unknown>;
        const nested = obj.contacts ?? obj.chats ?? obj.data;
        if (Array.isArray(nested)) items = nested;
        else if (nested && typeof nested === "object") items = [nested];
        else items = [payloadData];
      }
      for (const item of items) {
        const obj = item && typeof item === "object" ? (item as Record<string, unknown>) : null;
        if (!obj) continue;
        const waChatId = (obj.wa_chatid ?? obj.wa_chat_id ?? obj.chatid ?? obj.chatId ?? obj.id) as string | undefined;
        const img = extractContactImage(obj);
        if (!waChatId || typeof waChatId !== "string" || !img) continue;
        await supabase
          .from("conversations")
          .update({ contact_image: img, updated_at: new Date().toISOString() })
          .eq("instance_id", dbInstance.id)
          .eq("wa_chat_id", waChatId);
      }
    };

    if (eventType === "contacts") {
      await updateConversationsContactImage(data);
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (eventType === "chats") {
      await updateConversationsContactImage(data);
      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ error: "Internal error", details: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

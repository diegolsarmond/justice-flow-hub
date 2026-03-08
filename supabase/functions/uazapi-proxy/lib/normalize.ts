/** Converte timestamp UAZAPI (segundos ou ms) para ISO. A API pode retornar em ms. */
export function uazapiTimestampToISO(value: number | null | undefined): string | null {
  if (value == null || value <= 0) return null;
  const ms = value >= 1e12 ? value : value * 1000;
  const d = new Date(ms);
  const year = d.getUTCFullYear();
  if (year < 2000 || year > 2100) return null;
  return d.toISOString();
}

export function normalizeMessageStatus(value: string | null | undefined): string {
  const s = (value ?? "delivered").toString().toLowerCase();
  return ["read", "delivered", "sent", "deleted", "pending"].includes(s) ? s : "delivered";
}

/**
 * Normalize media content from JSON in message text OR content object.
 * Detects all UAZAPI media types: image, video, audio, document, sticker, ptt, ptv
 */
export function normalizeMediaContent(
  text: string | null | undefined,
  apiMessageType?: string,
  contentObj?: Record<string, unknown> | string
): { content: string; messageType: string; fileURL?: string; base64Data?: string } {
  let t = text ?? "";
  let data: Record<string, unknown> = {};

  if (contentObj && typeof contentObj === "object") {
    data = contentObj as Record<string, unknown>;
    if (!t) t = "";
  } else if (t.trim().startsWith("{")) {
    try {
      data = JSON.parse(t);
    } catch {
      data = {};
    }
  }

  const isExtendedText = (apiMessageType ?? "").toLowerCase().includes("extendedtext");
  const hasLinkPreviewIndicators = Boolean(
    data.matchedText ?? data.linkPreviewMetadata ??
    ((data.title && data.description) || (data.title && (data as Record<string, unknown>).thumbnailWidth))
  );
  if (isExtendedText && hasLinkPreviewIndicators) {
    return { content: t, messageType: "text" };
  }

  const apiType = (apiMessageType ?? "").toLowerCase();
  const isApiMediaType = ["image", "video", "audio", "ptt", "ptv", "document", "sticker", "myaudio", "audiomessage", "voice", "imagemessage", "videomessage", "audiomessage", "documentmessage", "stickermessage"].includes(apiType.replace("message", ""));

  const url = (data.URL ?? data.url ?? data.fileURL ?? data.fileUrl ?? data.mediaUrl) as string | undefined;
  const base64 = (data.base64Data ?? data.base64 ?? data.fileBase64 ?? data.data ?? (hasLinkPreviewIndicators ? undefined : data.JPEGThumbnail)) as string | undefined;
  const mime = ((data.mimetype as string | undefined) ?? "").toLowerCase();
  const isPtt = data.PTT === true || data.ptt === true;
  const fileName = (data.fileName ?? data.filename ?? data.name) as string | undefined;

  const hasRealMediaIndicators = Boolean(mime || base64 || isPtt);
  const urlLooksLikeMedia = url && /\.(jpg|jpeg|png|gif|webp|mp4|mov|avi|webm|mp3|ogg|wav|opus|pdf|doc|docx|xls|xlsx)(\?|$)/i.test(url);
  const hasMediaData = hasRealMediaIndicators || urlLooksLikeMedia;

  if (!hasMediaData && !isApiMediaType) {
    return { content: t, messageType: "text" };
  }

  let mediaType = "document";
  let label = "[Documento]";
  const typeToCheck = (mime || apiType).replace("message", "");

  if (typeToCheck.startsWith("image") || typeToCheck === "sticker") {
    mediaType = typeToCheck === "sticker" ? "sticker" : "image";
    label = typeToCheck === "sticker" ? "[Sticker]" : "[Imagem]";
  } else if (typeToCheck.startsWith("video") || typeToCheck === "ptv") {
    mediaType = typeToCheck === "ptv" ? "ptv" : "video";
    label = "[Vídeo]";
  } else if (typeToCheck.startsWith("audio") || typeToCheck.includes("ogg") || typeToCheck.includes("opus") || isPtt || ["ptt", "myaudio", "voice"].includes(typeToCheck)) {
    mediaType = isPtt || typeToCheck === "ptt" ? "ptt" : "audio";
    label = "[Áudio]";
  } else if (typeToCheck.startsWith("application") || typeToCheck.startsWith("text") || typeToCheck === "document") {
    mediaType = "document";
    label = fileName ? `[Documento: ${fileName}]` : "[Documento]";
  } else if (isApiMediaType) {
    if (apiType.includes("image")) { mediaType = "image"; label = "[Imagem]"; }
    else if (apiType.includes("video")) { mediaType = "video"; label = "[Vídeo]"; }
    else if (apiType.includes("audio") || apiType.includes("ptt")) { mediaType = "audio"; label = "[Áudio]"; }
    else if (apiType.includes("sticker")) { mediaType = "sticker"; label = "[Sticker]"; }
    else { mediaType = "document"; label = "[Mídia]"; }
  }

  return { content: label, messageType: mediaType, fileURL: url, base64Data: base64 };
}

export function normalizeAudioContent(text: string | null | undefined): { content: string; messageType: string; fileURL?: string; base64Data?: string } {
  return normalizeMediaContent(text);
}

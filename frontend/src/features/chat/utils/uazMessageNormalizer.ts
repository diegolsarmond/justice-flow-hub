import type {
  Message,
  MessageAttachment,
  MessagePayload,
  MessageStatus,
} from "../types";
import type { ProviderMessageRecord } from "../services/chatApi";

type JsonRecord = Record<string, unknown>;

interface NormalizeOptions {
  conversationId: string;
  order?: "asc" | "desc";
}

interface LocationInfo {
  label: string;
  name?: string | null;
  address?: string | null;
  latitude: number;
  longitude: number;
}

interface ContactShareInfo {
  label: string;
  name: string | null;
}

interface NormalizeContext {
  attachments: MessageAttachment[] | null;
  interactiveAnswer: string | null;
  location: LocationInfo | null;
  contactShare: ContactShareInfo | null;
}

export const normalizeProviderMessages = (
  records: ProviderMessageRecord[],
  options: NormalizeOptions,
): Message[] => {
  if (!Array.isArray(records)) {
    return [];
  }

  const filtered = records.filter(
    (item): item is JsonRecord => !!item && typeof item === "object" && !Array.isArray(item),
  );

  const ordered = options.order === "desc" ? [...filtered].reverse() : filtered;
  const result: Message[] = [];

  ordered.forEach((record, index) => {
    const normalized = normalizeRecord(record, options, index);
    if (normalized) {
      result.push(normalized);
    }
  });

  return result;
};

const normalizeRecord = (
  record: JsonRecord,
  options: NormalizeOptions,
  index: number,
): Message | null => {
  const sender = resolveSender(record);
  const timestampCandidate = resolveField(record, [
    "timestamp",
    "time",
    "createdAt",
    "created_at",
    "date",
    "eventDate",
    "messageTimestamp",
  ]);
  const timestamp = parseTimestamp(timestampCandidate).toISOString();

  const context: NormalizeContext = {
    attachments: parseAttachments(record),
    interactiveAnswer: parseInteractiveAnswer(record),
    location: parseLocation(record),
    contactShare: parseContactShare(record),
  };

  const content =
    parseMessageContent(record) ||
    context.interactiveAnswer ||
    context.location?.label ||
    context.contactShare?.label ||
    context.attachments?.[0]?.name ||
    (sender === "me" ? "Mensagem enviada" : "Mensagem recebida");

  const type = mapMessageType(record, context.attachments, context);
  const payload = buildPayload(context);
  const id = extractExternalId(record) ?? buildFallbackId(options.conversationId, index, timestamp);
  const status = resolveMessageStatus(record, sender === "me");
  const clientMessageId = normalizeString(
    resolveField(record, [
      "clientMessageId",
      "client_message_id",
      "clientMsgId",
      "client_msg_id",
    ]),
  );

  const message: Message = {
    id,
    conversationId: options.conversationId,
    sender,
    content,
    timestamp,
    status,
    type,
  };

  if (context.attachments && context.attachments.length > 0) {
    message.attachments = context.attachments;
  }

  if (payload) {
    message.payload = payload;
  }

  if (clientMessageId) {
    message.clientMessageId = clientMessageId;
  }

  if (context.location) {
    message.location = {
      latitude: context.location.latitude,
      longitude: context.location.longitude,
      name: context.location.name ?? undefined,
      address: context.location.address ?? undefined,
    };
  }

  return message;
};

const buildPayload = (context: NormalizeContext): MessagePayload | undefined => {
  if (!context.location) {
    return undefined;
  }

  return {
    location: {
      latitude: context.location.latitude,
      longitude: context.location.longitude,
      name: context.location.name ?? undefined,
      address: context.location.address ?? undefined,
    },
  };
};

const resolveSender = (record: JsonRecord): Message["sender"] => {
  const keyRecord = resolveNestedRecord(record, ["key"]);
  const candidates = [
    resolveField(record, ["fromMe", "from_me", "me", "outgoing", "isFromMe"]),
    resolveField(keyRecord, ["fromMe", "from_me"]),
  ];

  for (const candidate of candidates) {
    const parsed = parseBoolean(candidate);
    if (parsed !== null) {
      return parsed ? "me" : "contact";
    }
  }

  return "contact";
};

const resolveMessageStatus = (record: JsonRecord, outgoing: boolean): MessageStatus => {
  const keyRecord = resolveNestedRecord(record, ["key"]);
  const ackCandidates = [
    resolveField(record, ["ack", "statusCode", "status_code", "deliveryStatus", "delivery_status"]),
    resolveField(keyRecord, ["ack"]),
  ];

  for (const candidate of ackCandidates) {
    const ack = parseInteger(candidate);
    if (ack !== null) {
      return mapAckToStatus(ack);
    }
  }

  const statusCandidates = [
    resolveField(record, ["status", "messageStatus", "message_status"]),
    resolveField(resolveNestedRecord(record, ["status"]), ["value", "name"]),
  ];

  for (const candidate of statusCandidates) {
    const text = normalizeString(candidate);
    if (text) {
      const mapped = mapStatusText(text);
      if (mapped) {
        return mapped;
      }
    }
  }

  return outgoing ? "pending" : "delivered";
};

const parseMessageContent = (record: JsonRecord): string | null => {
  const candidates = [
    resolveField(record, ["message", "text", "body", "content", "caption", "description"]),
    resolveField(resolveNestedRecord(record, ["payload"]), ["message", "text", "body"]),
  ];

  for (const candidate of candidates) {
    const value = normalizeString(candidate);
    if (value) {
      return value;
    }
  }

  return null;
};

const parseInteractiveAnswer = (record: JsonRecord): string | null => {
  const candidates = [
    resolveField(record, ["selectedButtonText", "selectedButtonId", "selectedRowTitle", "selectedRowId"]),
    resolveField(resolveNestedRecord(record, ["buttonResponse", "interactiveResponse"]), ["title", "text", "description"]),
    resolveField(resolveNestedRecord(record, ["listResponse"]), ["title", "description"]),
  ];

  for (const candidate of candidates) {
    const value = normalizeString(candidate);
    if (value) {
      return value;
    }
  }

  return null;
};

const parseLocation = (record: JsonRecord): LocationInfo | null => {
  const locationRecord = resolveNestedRecord(record, ["location"]);
  if (!locationRecord) {
    return null;
  }

  const latitude = normalizeNumber(resolveField(locationRecord, ["latitude", "lat"]));
  const longitude = normalizeNumber(resolveField(locationRecord, ["longitude", "lng", "lon"]));
  if (latitude === null || longitude === null) {
    return null;
  }

  const label =
    normalizeString(resolveField(locationRecord, ["name", "title", "address"])) ||
    `Localização (${latitude}, ${longitude})`;

  return {
    label,
    name: normalizeString(resolveField(locationRecord, ["name", "title"])),
    address: normalizeString(resolveField(locationRecord, ["address"])),
    latitude,
    longitude,
  };
};

const parseContactShare = (record: JsonRecord): ContactShareInfo | null => {
  const contactRecord = resolveNestedRecord(record, ["contact"]);
  if (!contactRecord) {
    return null;
  }

  const name = normalizeString(resolveField(contactRecord, ["name", "fullName", "displayName"]));
  if (!name) {
    return null;
  }

  return { label: `Contato compartilhado: ${name}`, name };
};

const parseAttachments = (record: JsonRecord): MessageAttachment[] | null => {
  const sources: JsonRecord[] = [];
  const direct = resolveNestedRecord(record, ["media"]);
  if (direct) {
    sources.push(direct);
  }

  const attachmentField = record.attachments;
  if (Array.isArray(attachmentField)) {
    for (const item of attachmentField) {
      if (item && typeof item === "object" && !Array.isArray(item)) {
        sources.push(item as JsonRecord);
      }
    }
  }

  const mediaUrl = normalizeString(resolveField(record, ["mediaUrl", "url", "fileUrl", "downloadUrl"]));
  if (mediaUrl) {
    sources.push({ url: mediaUrl } as JsonRecord);
  }

  if (sources.length === 0) {
    return null;
  }

  const attachments = sources
    .map((source, idx) => toAttachment(source, `attachment-${idx + 1}`))
    .filter((attachment): attachment is MessageAttachment => Boolean(attachment));

  return attachments.length > 0 ? attachments : null;
};

const toAttachment = (source: JsonRecord, fallbackId: string): MessageAttachment | null => {
  const url = normalizeString(resolveField(source, ["url", "mediaUrl", "fileUrl", "downloadUrl", "href", "path"]));
  if (!url) {
    return null;
  }

  const mimeType = normalizeString(resolveField(source, ["mimeType", "mimetype", "contentType", "content_type"]));
  const type = mapAttachmentType(normalizeString(resolveField(source, ["type", "category", "kind"])), mimeType);
  const name =
    normalizeString(resolveField(source, ["name", "fileName", "filename", "title", "caption"])) ||
    `Anexo ${fallbackId}`;

  return {
    id: normalizeString(resolveField(source, ["id", "mediaId", "fileId"])) ?? fallbackId,
    type,
    url,
    name,
    downloadUrl: url,
    mimeType: mimeType ?? undefined,
  };
};

const mapAttachmentType = (kind: string | null, mimeType: string | null): MessageAttachment["type"] => {
  if (kind) {
    const value = kind.toLowerCase();
    if (value.includes("audio") || value === "ptt" || value === "voice") {
      return "audio";
    }
    if (value.includes("image") || value === "sticker") {
      return "image";
    }
  }

  if (mimeType) {
    if (mimeType.startsWith("audio/")) {
      return "audio";
    }
    if (mimeType.startsWith("image/")) {
      return "image";
    }
  }

  return "file";
};

const mapMessageType = (
  record: JsonRecord,
  attachments: MessageAttachment[] | null,
  context: NormalizeContext,
): Message["type"] => {
  const rawType = normalizeString(resolveField(record, ["type", "messageType", "message_type"]))?.toLowerCase();

  if (context.location) {
    return "location";
  }

  if (context.contactShare) {
    return "contact";
  }

  if (context.interactiveAnswer) {
    return "interactive";
  }

  if (attachments && attachments.length > 0) {
    return attachments[0]!.type === "audio" ? "audio" : attachments[0]!.type === "image" ? "image" : "file";
  }

  if (!rawType) {
    return "text";
  }

  if (rawType.includes("audio") || rawType === "ptt" || rawType === "voice") {
    return "audio";
  }

  if (rawType.includes("image") || rawType === "sticker") {
    return "image";
  }

  if (rawType.includes("document") || rawType.includes("file") || rawType.includes("video")) {
    return "file";
  }

  if (rawType.includes("contact") || rawType === "vcard") {
    return "contact";
  }

  if (rawType.includes("location")) {
    return "location";
  }

  if (rawType.includes("interactive") || rawType.includes("button") || rawType.includes("list")) {
    return "interactive";
  }

  return "text";
};

const MIN_YEAR = 1970;
const MAX_YEAR = 2100;

const parseTimestamp = (value: unknown): Date => {
  let date: Date;

  if (value instanceof Date) {
    date = value;
  } else if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value >= 1e12 ? value : value * 1000;
    date = new Date(ms);
  } else if (typeof value === "string" && value.trim()) {
    const trimmed = value.trim();
    const numeric = Number(trimmed);
    if (!Number.isNaN(numeric)) {
      const ms = numeric >= 1e12 ? numeric : numeric * 1000;
      date = new Date(ms);
    } else {
      const parsed = new Date(trimmed);
      date = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
    }
  } else {
    return new Date();
  }

  const year = date.getFullYear();
  if (year < MIN_YEAR || year > MAX_YEAR) {
    return new Date();
  }
  return date;
};

const parseBoolean = (value: unknown): boolean | null => {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    return value !== 0;
  }
  if (typeof value === "string" && value.trim()) {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "y", "sim", "me"].includes(normalized)) {
      return true;
    }
    if (["false", "0", "no", "n", "nao", "não"].includes(normalized)) {
      return false;
    }
  }
  return null;
};

const normalizeString = (value: unknown): string | null => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
};

const normalizeNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseFloat(value.trim());
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
};

const resolveField = (
  record: JsonRecord | null,
  keys: string[],
  visited: Set<JsonRecord> = new Set(),
): unknown => {
  if (!record || visited.has(record)) {
    return undefined;
  }
  visited.add(record);

  for (const key of keys) {
    if (record[key] !== undefined) {
      return record[key];
    }
  }

  const nestedKeys = ["data", "payload", "value", "message", "event", "details", "body"];
  for (const nestedKey of nestedKeys) {
    const candidate = record[nestedKey];
    if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
      const resolved = resolveField(candidate as JsonRecord, keys, visited);
      if (resolved !== undefined) {
        return resolved;
      }
    }
  }

  return undefined;
};

const resolveNestedRecord = (
  record: JsonRecord | null,
  keys: string[],
  visited: Set<JsonRecord> = new Set(),
): JsonRecord | null => {
  if (!record || visited.has(record)) {
    return null;
  }
  visited.add(record);

  for (const key of keys) {
    const value = record[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value as JsonRecord;
    }
  }

  const nestedKeys = ["data", "payload", "value", "message", "event", "details", "body"];
  for (const nestedKey of nestedKeys) {
    const candidate = record[nestedKey];
    if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
      const resolved = resolveNestedRecord(candidate as JsonRecord, keys, visited);
      if (resolved) {
        return resolved;
      }
    }
  }

  return null;
};

const extractExternalId = (record: JsonRecord): string | null => {
  const keyRecord = resolveNestedRecord(record, ["key"]);
  const messageRecord = resolveNestedRecord(record, ["message"]);
  const candidates = [
    resolveField(record, ["id", "messageId", "messageid", "message_id", "externalId", "external_id"]),
    resolveField(keyRecord, ["id"]),
    resolveField(messageRecord, ["id"]),
  ];

  for (const candidate of candidates) {
    const value = normalizeString(candidate);
    if (value) {
      return value;
    }
  }

  return null;
};

const buildFallbackId = (conversationId: string, index: number, timestamp: string): string => {
  return `${conversationId}-${index}-${timestamp}`;
};

const parseInteger = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value.trim(), 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
};

const mapAckToStatus = (ack: number): MessageStatus => {
  if (ack >= 3) {
    return "read";
  }
  if (ack === 2) {
    return "delivered";
  }
  if (ack === 1) {
    return "sent";
  }
  return "pending";
};

const mapStatusText = (text: string): MessageStatus | null => {
  const normalized = text.trim().toLowerCase();
  if (!normalized) {
    return null;
  }
  if (["pending", "queued", "queue", "sending", "uploading", "send failed", "processing", "aguardando"].includes(normalized)) {
    return "pending";
  }
  if (["sent", "enviada", "enviado", "sended"].includes(normalized)) {
    return "sent";
  }
  if (["delivered", "recebida", "entregue"].includes(normalized)) {
    return "delivered";
  }
  if (["read", "visualizada", "vista", "seen"].includes(normalized)) {
    return "read";
  }
  return null;
};

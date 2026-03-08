export type MessageStatus = "pending" | "sent" | "delivered" | "read" | "failed";
export type MessageType =
  | "text"
  | "image"
  | "audio"
  | "file"
  | "document"
  | "media"
  | "interactive"
  | "contact"
  | "location";

export type MessageAttachmentType = "image" | "audio" | "file" | "document" | "media";

export interface MessageAttachment {
  id: string;
  type: MessageAttachmentType;
  url: string;
  name: string;
  downloadUrl?: string;
  mimeType?: string;
  storedInternally?: boolean;
}

export interface InteractiveMenuOption {
  id: string;
  title: string;
  description?: string;
}

export interface InteractiveMenuSection {
  title?: string;
  rows: InteractiveMenuOption[];
}

export interface InteractiveMenuPayload {
  header?: string;
  body: string;
  footer?: string;
  buttonLabel: string;
  sections: InteractiveMenuSection[];
}

export interface ContactPayloadPhone {
  phone: string;
  type?: string;
  label?: string;
}

export interface ContactPayload {
  name: string;
  organization?: string;
  phones: ContactPayloadPhone[];
  emails?: string[];
}

export interface LocationPayload {
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}

export interface MessagePayload {
  interactive?: InteractiveMenuPayload | null;
  interactiveOptions?: InteractiveMenuOption[] | null;
  contact?: ContactPayload | null;
  contactName?: string | null;
  contactPhone?: string | null;
  location?: LocationPayload | null;
  latitude?: number | null;
  longitude?: number | null;
  placeholders?: Record<string, string | number | boolean | null> | null;
  linkPreview?: {
    enabled?: boolean | null;
    title?: string | null;
    description?: string | null;
    image?: string | null;
    url?: string | null;
  } | null;
  mentions?: string[] | null;
  delay?: number | null;
  replyId?: string | null;
  forward?: Record<string, unknown> | string | null;
  tracking?: Record<string, string | number | boolean | null> | null;
  targetNumber?: string | null;
  targetGroup?: string | null;
}

export interface Message {
  id: string;
  conversationId: string;
  clientMessageId?: string | null;
  credentialId?: string | null;
  waChatId?: string | null;
  clientMessageId?: string | null;
  sender: "me" | "contact";
  content: string;
  timestamp: string;
  status: MessageStatus;
  reaction?: string | null;
  clientMessageId?: string | null;
  type: MessageType;
  attachments?: MessageAttachment[];
  payload?: MessagePayload | null;
  interactive?: InteractiveMenuPayload | null;
  contact?: ContactPayload | null;
  location?: LocationPayload | null;
}

export interface TeamMember {
  id: string;
  name: string;
  avatar: string;
  role: string;
}

export type ConversationResponsible = TeamMember;

export interface ConversationParticipant {
  id: string;
  name: string;
  avatar?: string;
}

export interface ConversationCustomAttribute {
  id: string;
  label: string;
  value: string;
}

export interface ConversationInternalNote {
  id: string;
  author: string;
  content: string;
  createdAt: string;
}

export interface ConversationSummary {
  id: string;
  name: string;
  avatar: string;
  shortStatus: string;
  description?: string;
  unreadCount: number;
  pinned?: boolean;
  muted?: boolean;
  archived?: boolean;
  lastMessage?: ConversationLastMessage;
  phoneNumber?: string;
  responsible?: ConversationResponsible | null;
  tags?: string[];
  isLinkedToClient?: boolean;
  clientId?: number | null;
  clientName?: string | null;
  customAttributes?: ConversationCustomAttribute[];
  isPrivate?: boolean;
  internalNotes?: ConversationInternalNote[];
  participants?: ConversationParticipant[];
  metadata?: Record<string, unknown> | null;
  credentialId?: string | null;
  waChatId?: string | null;
}

export interface ContactSuggestion {
  id: string;
  name: string;
  jid: string;
  avatar?: string | null;
  owner?: string | null;
}

export interface ConversationLastMessage {
  id: string;
  content: string;
  preview: string;
  timestamp: string;
  sender: "me" | "contact";
  type: MessageType;
  status: MessageStatus;
}

export interface ConversationDatasetEntry {
  id: string;
  name: string;
  avatar: string;
  shortStatus: string;
  description?: string;
  unreadCount: number;
  pinned?: boolean;
  muted?: boolean;
  archived?: boolean;
  phoneNumber?: string;
  responsibleId?: string | number | null;
  tags?: string[];
  isLinkedToClient?: boolean;
  clientId?: number | null;
  clientName?: string | null;
  customAttributes?: ConversationCustomAttribute[];
  isPrivate?: boolean;
  internalNotes?: ConversationInternalNote[];
  participants?: ConversationParticipant[];
  metadata?: Record<string, unknown> | null;
}

export interface ChatDataset {
  conversations: ConversationDatasetEntry[];
  messages: Record<string, Message[]>;
}

export interface MessagePage {
  messages: Record<string, unknown>[];
  nextCursor: string | null;
}

export interface NewConversationInput {
  name: string;
  description?: string;
  avatar?: string;
  phoneNumber?: string;
  responsibleId?: string | number | null;
}

export interface SendMessageInput {
  content: string;
  type?: MessageType;
  attachments?: MessageAttachment[];
  interactive?: InteractiveMenuPayload | null;
  contact?: ContactPayload | null;
  location?: LocationPayload | null;
  payload?: MessagePayload | null;
  clientMessageId?: string | null;
}

export interface UpdateConversationPayload {
  responsibleId?: string | number | null;
  tags?: string[];
  phoneNumber?: string;
  isLinkedToClient?: boolean;
  clientId?: string | number | null;
  clientName?: string | null;
  customAttributes?: ConversationCustomAttribute[];
  isPrivate?: boolean;
  internalNotes?: ConversationInternalNote[];
}

export interface UazapiInstance {
  id: string;
  token: string;
  status: string;
  name: string;
  profileName?: string;
  profilePicUrl?: string;
  isBusiness?: boolean;
  qrcode?: string;
  paircode?: string;
  owner?: string;
  created?: string;
  updated?: string;
}

export interface UazapiChat {
  id: string;
  wa_chatid: string;
  wa_name?: string;
  wa_contactName?: string;
  name?: string;
  image?: string;
  imagePreview?: string;
  profilePic?: string;
  profilePicUrl?: string;
  phone?: string;
  wa_isGroup?: boolean;
  wa_unreadCount?: number;
  wa_lastMsgTimestamp?: number;
  wa_lastMessageType?: string;
  wa_lastMessageTextVote?: string;
}

export interface UazapiMessage {
  id: string;
  messageid: string;
  chatid: string;
  sender?: string;
  senderName?: string;
  isGroup?: boolean;
  fromMe?: boolean;
  messageType?: string;
  text?: string;
  content?: Record<string, unknown> | string;
  messageTimestamp?: number;
  status?: string;
  fileURL?: string;
  base64Data?: string;
  base64?: string;
}

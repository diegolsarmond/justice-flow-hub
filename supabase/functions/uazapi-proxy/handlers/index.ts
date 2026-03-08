import type { HandlerContext } from "../lib/context.ts";
import * as instances from "./instances.ts";
import * as chats from "./chats.ts";
import * as messages from "./messages.ts";
import * as contacts from "./contacts.ts";
import * as webhooks from "./webhooks.ts";

export type ActionHandler = (req: Request, url: URL, ctx: HandlerContext) => Promise<Response>;

export const handlers: Record<string, ActionHandler> = {
  "list-instances": instances.handleListInstances,
  "create-instance": instances.handleCreateInstance,
  "connect-instance": instances.handleConnectInstance,
  "disconnect-instance": instances.handleDisconnectInstance,
  "get-status": instances.handleGetStatus,
  "check-number": chats.handleCheckNumber,
  "get-chat-details": chats.handleGetChatDetails,
  "get-conversation-by-wa-chat-id": chats.handleGetConversationByWaChatId,
  "list-chats": chats.handleListChats,
  "list-chats-counts": chats.handleListChatsCounts,
  "create-conversation": chats.handleCreateConversation,
  "archive-chat": chats.handleArchiveChat,
  "block-chat": chats.handleBlockChat,
  "mute-chat": chats.handleMuteChat,
  "pin-chat": chats.handlePinChat,
  "list-messages": messages.handleListMessages,
  "get-message-media": messages.handleGetMessageMedia,
  "send-message": messages.handleSendMessage,
  "send-media": messages.handleSendMedia,
  "mark-messages-read": messages.handleMarkMessagesRead,
  "react-message": messages.handleReactMessage,
  "delete-message": messages.handleDeleteMessage,
  "edit-message": messages.handleEditMessage,
  "contact-remove": contacts.handleContactRemove,
  "contact-add": contacts.handleContactAdd,
  "update-contact": contacts.handleUpdateContact,
  "get-webhook": webhooks.handleGetWebhook,
  "set-webhook": webhooks.handleSetWebhook,
};

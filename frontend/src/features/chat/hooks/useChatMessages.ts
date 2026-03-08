import { useCallback, useEffect, useRef, useState } from "react";
import {
  findChatMessages,
  sendConversationMessage,
  syncConversationMessages,
} from "../services/chatApi";
import type { Message, MessageStatus, SendMessageInput } from "../types";
import type { FindChatMessagesResponse } from "../services/chatApi";

interface UseChatMessagesResult {
  messages: Message[];
  hasMore: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  isHydratingConversation: boolean;
  loadOlder: () => Promise<Message[]>;
  reload: () => Promise<void>;
  sendMessage: (payload: SendMessageInput, clientMessageId?: string) => Promise<Message | null>;
  reset: () => void;
  mergeMessage: (message: Message) => void;
  updateMessageStatus: (messageId: string, status: MessageStatus) => void;
  replaceMessage: (message: Message) => void;
  enqueuePendingMessage: (
    payload: SendMessageInput,
  ) => { message: Message; clientMessageId: string } | null;
}

// Carregamos blocos pequenos para combinar com a janela virtualizada da área de mensagens.
const DEFAULT_PAGE_SIZE = 24;

const normalizeClientMessageId = (value?: string | null): string | null => {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const generateClientMessageId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `client-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
};
export const useChatMessages = (
  conversationId?: string,
  pageSize = DEFAULT_PAGE_SIZE,
): UseChatMessagesResult => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [visibleMessages, setVisibleMessages] = useState<Message[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [lastMessageDate, setLastMessageDate] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isHydratingConversation, setIsHydratingConversation] = useState(false);
  const [useDbFallbackForOlder, setUseDbFallbackForOlder] = useState(false);
  const activeConversationRef = useRef<string | undefined>(conversationId);
  const clientMessageIndexRef = useRef<Map<string, string>>(new Map());

  const rebuildClientMessageIndex = useCallback((list: Message[]) => {
    const index = clientMessageIndexRef.current;
    index.clear();
    list.forEach((item) => {
      const key = normalizeClientMessageId(item.clientMessageId);
      if (key) {
        index.set(key, item.id);
      }
    });
  }, []);

  const findMessageIdByClientId = useCallback((clientMessageId?: string | null) => {
    const key = normalizeClientMessageId(clientMessageId);
    if (!key) {
      return undefined;
    }
    return clientMessageIndexRef.current.get(key);
  }, []);

  useEffect(() => {
    activeConversationRef.current = conversationId;
  }, [conversationId]);

  useEffect(() => {
    if (!isHydratingConversation) {
      setVisibleMessages(messages);
    }
  }, [isHydratingConversation, messages]);

  const applyPage = useCallback(
    (
      page: FindChatMessagesResponse,
      params: { resetList?: boolean; conversationId: string; fallbackHasMore?: boolean | null },
    ) => {
      const normalized = Array.isArray(page.messages) ? [...page.messages] : [];

      setMessages((current) => {
        const next = params.resetList ? normalized : [...normalized, ...current];
        rebuildClientMessageIndex(next);
        return next;
      });
      const cursorValue =
        typeof page.cursor === "string" && page.cursor.trim().length > 0
          ? page.cursor.trim()
          : null;
      setNextCursor(cursorValue);
      const offsetValue =
        typeof page.nextOffset === "number" && Number.isFinite(page.nextOffset)
          ? page.nextOffset
          : null;
      setNextOffset(offsetValue);
      const newestTimestamp =
        (typeof page.lastMessageDate === "string" && page.lastMessageDate.trim().length > 0
          ? page.lastMessageDate.trim()
          : null) ?? normalized.at(-1)?.timestamp ?? null;
      setLastMessageDate(newestTimestamp ?? null);
      const computedHasMore =
        typeof page.hasMore === "boolean"
          ? page.hasMore
          : typeof params.fallbackHasMore === "boolean"
            ? params.fallbackHasMore
            : Boolean(cursorValue ?? offsetValue ?? undefined);
      setHasMore(computedHasMore);
      if (params.resetList) {
        setIsHydratingConversation(false);
      }
      return normalized;
    },
    [rebuildClientMessageIndex],
  );

  const reload = useCallback(async () => {
    if (!conversationId) return;
    setIsLoading(true);
    setUseDbFallbackForOlder(false);
    let applied = false;
    try {
      const syncResult = await syncConversationMessages(conversationId, { limit: pageSize });
      if (activeConversationRef.current !== conversationId) return;
      const page: FindChatMessagesResponse = {
        messages: Array.isArray(syncResult.messages) ? syncResult.messages : [],
        cursor: syncResult.nextCursor ?? null,
        nextOffset:
          typeof syncResult.nextOffset === "number" && Number.isFinite(syncResult.nextOffset)
            ? syncResult.nextOffset
            : null,
        hasMore: typeof syncResult.hasMore === "boolean" ? syncResult.hasMore : false,
        lastMessageDate:
          syncResult.messages?.length && syncResult.messages[syncResult.messages.length - 1]?.timestamp
            ? syncResult.messages[syncResult.messages.length - 1]!.timestamp
            : null,
      };
      applyPage(page, {
        resetList: true,
        conversationId,
        fallbackHasMore: page.hasMore,
      });
      applied = true;
    } finally {
      if (activeConversationRef.current === conversationId) {
        setIsLoading(false);
        if (!applied) {
          setIsHydratingConversation(false);
        }
      }
    }
  }, [applyPage, conversationId, pageSize]);

  const loadOlder = useCallback(async () => {
    if (!conversationId || isLoadingMore || !hasMore) return [];
    setIsLoadingMore(true);
    try {
      const cursorValue =
        typeof nextCursor === "string" && nextCursor.trim().length > 0 ? nextCursor.trim() : null;
      const offsetValue = typeof nextOffset === "number" ? nextOffset : null;

      if (useDbFallbackForOlder) {
        const dbCursor = cursorValue || lastMessageDate;
        const page = await findChatMessages({
          conversationId,
          limit: pageSize,
          cursor: dbCursor,
          offset: offsetValue ?? messages.length,
          lastMessageDate,
        });
        if (activeConversationRef.current !== conversationId) return [];
        return applyPage(page, {
          resetList: false,
          conversationId,
          fallbackHasMore: page.hasMore,
        });
      }

      const syncResult = await syncConversationMessages(conversationId, {
        limit: pageSize,
        cursor: cursorValue,
        offset: offsetValue,
      });

      if (activeConversationRef.current !== conversationId) return [];

      if (syncResult.hasMore === true) {
        const page: FindChatMessagesResponse = {
          messages: Array.isArray(syncResult.messages) ? syncResult.messages : [],
          cursor: syncResult.nextCursor ?? null,
          nextOffset:
            typeof syncResult.nextOffset === "number" && Number.isFinite(syncResult.nextOffset)
              ? syncResult.nextOffset
              : null,
          hasMore: true,
          lastMessageDate:
            syncResult.messages?.length && syncResult.messages[syncResult.messages.length - 1]?.timestamp
              ? syncResult.messages[syncResult.messages.length - 1]!.timestamp
              : null,
        };
        return applyPage(page, {
          resetList: false,
          conversationId,
          fallbackHasMore: true,
        });
      }

      setUseDbFallbackForOlder(true);
      const dbCursor = cursorValue || lastMessageDate;
      const page = await findChatMessages({
        conversationId,
        limit: pageSize,
        cursor: dbCursor,
        offset: offsetValue ?? messages.length,
        lastMessageDate,
      });
      return applyPage(page, {
        resetList: false,
        conversationId,
        fallbackHasMore: page.hasMore,
      });
    } finally {
      if (activeConversationRef.current === conversationId) {
        setIsLoadingMore(false);
      }
    }
  }, [
    applyPage,
    conversationId,
    hasMore,
    isLoadingMore,
    lastMessageDate,
    messages.length,
    nextOffset,
    nextCursor,
    pageSize,
    useDbFallbackForOlder,
  ]);

  const insertMessage = useCallback((list: Message[], incoming: Message) => {
    const existingIndex = list.findIndex(
      (item) =>
        item.id === incoming.id ||
        (item.clientMessageId &&
          incoming.clientMessageId &&
          item.clientMessageId === incoming.clientMessageId),
    );
    if (existingIndex >= 0) {
      const next = list.slice();
      next[existingIndex] = incoming;
      return next;
    }

    const incomingTime = new Date(incoming.timestamp).getTime();
    const next = list.slice();
    const insertIndex = next.findIndex(
      (item) => new Date(item.timestamp).getTime() > incomingTime,
    );
    if (insertIndex === -1) {
      next.push(incoming);
    } else {
      next.splice(insertIndex, 0, incoming);
    }
    return next;
  }, []);

  const replaceMessage = useCallback(
    (incoming: Message) => {
      setMessages((current) => {
        const clientMatchId = findMessageIdByClientId(incoming.clientMessageId);
        let updated = false;
        const next = current.map((item) => {
          if (item.id === incoming.id || (clientMatchId && item.id === clientMatchId)) {
            updated = true;
            return incoming;
          }
          return item;
        });
        if (!updated) {
          return current;
        }
        rebuildClientMessageIndex(next);
        return next;
      });
    },
    [findMessageIdByClientId, rebuildClientMessageIndex],
  );

  const mergeMessage = useCallback(
    (incoming: Message) => {
      if (findMessageIdByClientId(incoming.clientMessageId)) {
        replaceMessage(incoming);
        return;
      }
      setMessages((current) => {
        const next = insertMessage(current, incoming);
        rebuildClientMessageIndex(next);
        return next;
      });
    },
    [findMessageIdByClientId, insertMessage, rebuildClientMessageIndex, replaceMessage],
  );

  const updateMessageStatus = useCallback(
    (messageId: string, status: MessageStatus) => {
      setMessages((current) => {
        let updated = false;
        const next = current.map((item) => {
          if (item.id === messageId && item.status !== status) {
            updated = true;
            return { ...item, status };
          }
          return item;
        });
        if (!updated) {
          return current;
        }
        rebuildClientMessageIndex(next);
        return next;
      });
    },
    [rebuildClientMessageIndex],
  );

  const sendMessage = useCallback(
    async (payload: SendMessageInput, clientMessageId?: string) => {
      if (!conversationId) return null;
      try {
        const message = await sendConversationMessage(conversationId, payload);
        if (activeConversationRef.current !== conversationId) return null;
        replaceMessage(message);
        setHasMore((currentHasMore) => currentHasMore);
        return message;
      } catch (error) {
        if (clientMessageId) {
          setMessages((current) => {
            let updated = false;
            const next = current.map((item) => {
              if (
                item.id === clientMessageId ||
                (item.clientMessageId && item.clientMessageId === clientMessageId)
              ) {
                updated = true;
                return { ...item, status: "failed" };
              }
              return item;
            });
            if (!updated) {
              return current;
            }
            rebuildClientMessageIndex(next);
            return next;
          });
        }
        throw error;
      }
    },
    [conversationId, rebuildClientMessageIndex, replaceMessage],
  );

  const enqueuePendingMessage = useCallback(
    (payload: SendMessageInput) => {
      if (!conversationId) return null;
      const clientMessageId = generateClientMessageId();
      const timestamp = new Date().toISOString();
      const message: Message = {
        id: clientMessageId,
        conversationId,
        clientMessageId,
        sender: "me",
        content: payload.content,
        timestamp,
        status: "pending",
        type: payload.type ?? "text",
        attachments: payload.attachments,
        payload: payload.payload ?? null,
        interactive: payload.interactive ?? null,
        contact: payload.contact ?? null,
        location: payload.location ?? null,
      };
      setMessages((current) => {
        const next = insertMessage(current, message);
        rebuildClientMessageIndex(next);
        return next;
      });
      return { message, clientMessageId };
    },
    [conversationId, insertMessage, rebuildClientMessageIndex],
  );

  const reset = useCallback(() => {
    clientMessageIndexRef.current.clear();
    setMessages([]);
    setNextCursor(null);
    setNextOffset(null);
    setHasMore(false);
    setLastMessageDate(null);
    setIsLoading(false);
    setIsLoadingMore(false);
    setUseDbFallbackForOlder(false);
  }, []);

  useEffect(() => {
    if (!conversationId) {
      reset();
      setVisibleMessages([]);
      setIsHydratingConversation(false);
      return;
    }
    setIsHydratingConversation(true);
    reset();
    void reload();
  }, [conversationId, reload, reset]);

  return {
    messages: visibleMessages,
    hasMore,
    isLoading,
    isLoadingMore,
    isHydratingConversation,
    loadOlder,
    reload,
    sendMessage,
    reset,
    mergeMessage,
    updateMessageStatus,
    replaceMessage,
    enqueuePendingMessage,
  };
};

import { useEffect, useRef, useState } from "react";
import { getApiUrl } from "@/lib/api";
import { useAuth } from "@/features/auth/AuthProvider";
import { toast } from "@/components/ui/use-toast";
import type {
  ConversationSummary,
  Message,
  MessageStatus,
} from "../types";
import {
  setSessionStatusEntry,
  type SessionStatusEntry,
  type SessionConnectionStatus,
} from "../state/sessionStatusStore";

type ConversationUpdatedPayload = ConversationSummary;

interface MessageCreatedPayload {
  conversationId: string;
  message: Message;
  credentialId?: string | null;
}

interface MessageStatusPayload {
  conversationId: string;
  messageId: string;
  status: MessageStatus;
}

interface ConversationReadPayload {
  conversationId: string;
  userId?: string;
}

interface ConversationAvatarPayload {
  conversationId: string;
  avatar: string;
  credentialId?: string | null;
  waChatId?: string | null;
}

interface ConversationAvatarUpdatePayload {
  id: string;
  avatar: string;
}

interface TypingPayload {
  conversationId: string;
  userId: string;
  userName?: string;
  isTyping: boolean;
}

interface SessionStatusPayload {
  credentialId: string;
  empresaId: number | null;
  status: SessionConnectionStatus;
  metadata?: Record<string, unknown>;
}

export type PresenceStatus = 'online' | 'offline' | 'typing';

export interface PresenceEventPayload {
  conversationId: string;
  status: PresenceStatus;
  credentialId?: string | null;
  waChatId?: string | null;
  isOnline?: boolean;
  isTyping?: boolean;
  rawStatus?: string | null;
  lastSeenAt?: string | null;
  updatedAt?: string;
}

type RealtimeConnectionChange =
  | { scope: "stream"; connected: boolean }
  | ({ scope: "session" } & SessionStatusEntry);

export interface ChatRealtimeHandlers {
  onConversationUpdated?: (conversation: ConversationUpdatedPayload) => void;
  onConversationAvatarUpdated?: (
    payload: ConversationAvatarUpdatePayload,
  ) => void;
  onConversationRead?: (payload: ConversationReadPayload) => void;
  onMessageCreated?: (payload: MessageCreatedPayload) => void;
  onMessageStatusUpdated?: (payload: MessageStatusPayload) => void;
  onTyping?: (payload: TypingPayload) => void;
  onPresenceUpdate?: (payload: PresenceEventPayload) => void;
  onConnectionChange?: (change: RealtimeConnectionChange) => void;
}

export interface UseChatRealtimeResult {
  isConnected: boolean;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface ConversationIdentifierOptions {
  credentialId?: string | null;
  waChatId?: string | null;
}

const buildConversationIdentifier = (
  conversationId: unknown,
  options?: ConversationIdentifierOptions,
): string | null => {
  const baseId = typeof conversationId === "string" ? conversationId.trim() : "";
  if (baseId.includes(":")) {
    return baseId;
  }

  const credentialId =
    typeof options?.credentialId === "string" ? options.credentialId.trim() : "";
  const waChatId = typeof options?.waChatId === "string" ? options.waChatId.trim() : "";

  if (credentialId && waChatId) {
    return `${credentialId}:${waChatId}`;
  }

  return baseId || null;
};

const parseSseEvent = (rawEvent: string): { event?: string; data?: unknown } | null => {
  if (!rawEvent) {
    return null;
  }

  const lines = rawEvent.split("\n");
  let eventName: string | undefined;
  const dataLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith(":")) {
      continue;
    }
    if (trimmed.startsWith("event:")) {
      eventName = trimmed.slice(6).trim();
      continue;
    }
    if (trimmed.startsWith("data:")) {
      dataLines.push(trimmed.slice(5).trimStart());
      continue;
    }
  }

  const dataString = dataLines.join("\n");
  let data: unknown;

  if (dataString.length > 0) {
    try {
      data = JSON.parse(dataString);
    } catch (error) {
      console.warn("Failed to parse SSE payload", error, { dataString });
    }
  }

  return { event: eventName, data };
};

export const useChatRealtime = (handlers: ChatRealtimeHandlers): UseChatRealtimeResult => {
  const { token, logout, refreshToken } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const handlersRef = useRef<ChatRealtimeHandlers>(handlers);
  const abortControllerRef = useRef<AbortController | null>(null);
  const unauthorizedToastRef = useRef(false);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    unauthorizedToastRef.current = false;
  }, [token]);

  useEffect(() => {
    if (!token) {
      setIsConnected(false);
      return undefined;
    }

    let isCancelled = false;
    let retryDelay = 1000;

    const connect = async () => {
      while (!isCancelled) {
        const controller = new AbortController();
        abortControllerRef.current = controller;
        let shouldTerminateLoop = false;

        try {
          const response = await fetch(getApiUrl("conversations/stream"), {
            method: "GET",
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
          });

          if (response.status === 401) {
            console.error("Realtime stream unauthorized. Verify authentication token.");
            const refreshResult = await refreshToken();
            if (refreshResult === "unauthorized") {
              if (!unauthorizedToastRef.current) {
                unauthorizedToastRef.current = true;
                toast({
                  title: "Sessão expirada",
                  description: "Faça login novamente para continuar utilizando o chat.",
                });
              }
              logout();
              shouldTerminateLoop = true;
            }
          } else {
            if (!response.ok || !response.body) {
              throw new Error(`Unexpected realtime response: ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let buffer = "";

            setIsConnected(true);
            handlersRef.current.onConnectionChange?.({ scope: "stream", connected: true });
            retryDelay = 1000;

            while (!isCancelled) {
              const { value, done } = await reader.read();
              if (done) {
                buffer += decoder.decode();
                break;
              }
              buffer += decoder.decode(value, { stream: true });

              let separatorMatch = buffer.match(/\r?\n\r?\n/);
              while (separatorMatch && separatorMatch.index !== undefined) {
                const separatorIndex = separatorMatch.index;
                const separatorLength = separatorMatch[0].length;
                const rawEvent = buffer.slice(0, separatorIndex);
                buffer = buffer.slice(separatorIndex + separatorLength);
                const parsed = parseSseEvent(rawEvent);
                if (parsed?.event) {
                  dispatchEvent(parsed.event, parsed.data);
                }
                separatorMatch = buffer.match(/\r?\n\r?\n/);
              }
            }

            if (buffer.trim().length > 0) {
              const parsed = parseSseEvent(buffer.trim());
              if (parsed?.event) {
                dispatchEvent(parsed.event, parsed.data);
              }
            }
          }
        } catch (error) {
          if (controller.signal.aborted || isCancelled) {
            break;
          }
          console.warn("Realtime stream disconnected", error);
        } finally {
          if (!isCancelled) {
            setIsConnected(false);
            handlersRef.current.onConnectionChange?.({ scope: "stream", connected: false });
          }
        }

        if (isCancelled || shouldTerminateLoop) {
          break;
        }

        await sleep(retryDelay);
        retryDelay = Math.min(retryDelay * 2, 15_000);
      }
    };

    const handleSessionStatusEvent = (raw: unknown) => {
      if (!raw || typeof raw !== "object") {
        return;
      }

      const payload = raw as SessionStatusPayload;
      const { credentialId, status } = payload;
      if (typeof credentialId !== "string") {
        return;
      }

      if (status !== "connected" && status !== "connecting" && status !== "disconnected") {
        return;
      }

      const empresaId = typeof payload.empresaId === "number" ? payload.empresaId : null;
      const metadata =
        payload.metadata && typeof payload.metadata === "object"
          ? (payload.metadata as Record<string, unknown>)
          : undefined;

      const entry: SessionStatusEntry = {
        credentialId,
        empresaId,
        status,
        metadata,
        updatedAt: new Date().toISOString(),
      };

      setSessionStatusEntry(entry);
      handlersRef.current.onConnectionChange?.({ scope: "session", ...entry });
    };

    const dispatchEvent = (event: string, data: unknown) => {
      switch (event) {
        case "conversation:update":
          if (data && typeof data === "object") {
            const payload = data as ConversationUpdatedPayload;
            const normalizedId = buildConversationIdentifier(payload.id, {
              credentialId: payload.credentialId,
              waChatId: payload.waChatId ?? undefined,
            });
            if (!normalizedId) {
              return;
            }
            const normalizedPayload =
              normalizedId === payload.id ? payload : { ...payload, id: normalizedId };
            handlersRef.current.onConversationUpdated?.(normalizedPayload);
          }
          break;
        case "conversation:avatar":
          if (data && typeof data === "object") {
            const payload = data as ConversationAvatarPayload;
            const normalizedId = buildConversationIdentifier(
              payload.conversationId,
              {
                credentialId: payload.credentialId,
                waChatId: payload.waChatId ?? undefined,
              },
            );
            if (!normalizedId || typeof payload.avatar !== "string") {
              return;
            }
            handlersRef.current.onConversationAvatarUpdated?.({
              id: normalizedId,
              avatar: payload.avatar,
            });
          }
          break;
        case "conversation:read":
          if (data && typeof data === "object") {
            handlersRef.current.onConversationRead?.(data as ConversationReadPayload);
          }
          break;
        case "message:new":
          if (data && typeof data === "object") {
            const payload = data as MessageCreatedPayload;
            const normalizedId = buildConversationIdentifier(payload.conversationId, {
              credentialId: payload.credentialId ?? payload.message.credentialId ?? undefined,
              waChatId: payload.message.waChatId ?? undefined,
            });
            if (!normalizedId) {
              return;
            }
            const normalizedMessage =
              payload.message.conversationId === normalizedId
                ? payload.message
                : { ...payload.message, conversationId: normalizedId };
            const normalizedPayload =
              normalizedId === payload.conversationId && normalizedMessage === payload.message
                ? payload
                : { ...payload, conversationId: normalizedId, message: normalizedMessage };
            handlersRef.current.onMessageCreated?.(normalizedPayload);
          }
          break;
        case "message:status":
          if (data && typeof data === "object") {
            const payload = data as MessageStatusPayload;
            handlersRef.current.onMessageStatusUpdated?.(payload);
          }
          break;
        case "typing":
          if (data && typeof data === "object") {
            handlersRef.current.onTyping?.(data as TypingPayload);
          }
          break;
        case "presence":
          if (data && typeof data === "object") {
            const payload = data as PresenceEventPayload;
            if (
              payload.status === "online" ||
              payload.status === "offline" ||
              payload.status === "typing"
            ) {
              const normalizedId = buildConversationIdentifier(
                payload.conversationId,
                {
                  credentialId: payload.credentialId ?? undefined,
                  waChatId: payload.waChatId ?? undefined,
                },
              );
              if (!normalizedId) {
                return;
              }
              const normalizedPayload =
                normalizedId === payload.conversationId
                  ? payload
                  : { ...payload, conversationId: normalizedId };
              handlersRef.current.onPresenceUpdate?.(normalizedPayload);
            }
          }
          break;
        case "session:status":
          handleSessionStatusEvent(data);
          break;
        case "ping":
        case "connection":
        default:
          break;
      }
    };

    void connect();

    return () => {
      isCancelled = true;
      abortControllerRef.current?.abort();
    };
  }, [token, logout, refreshToken]);

  return { isConnected };
};

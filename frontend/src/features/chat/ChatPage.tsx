import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  useMutation,
  useInfiniteQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { useAuth } from "@/features/auth/AuthProvider";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import {
  fetchConversations,
  type FetchConversationsResponse,
  createConversation,
  markConversationRead,
  setTypingState,
  updateConversation as updateConversationRequest,
  fetchChatResponsibles,
  type ChatResponsibleOption,
  fetchContactSuggestions,
  type FetchContactSuggestionsResponse,
  toggleConversationMute,
  toggleConversationArchive,
  toggleConversationPin,
  reactToMessage,
  editMessage,
} from "./services/chatApi";
import type {
  ConversationSummary,
  ContactSuggestion,
  Message,
  MessageStatus,
  SendMessageInput,
  UpdateConversationPayload,
} from "./types";
import { ChatSidebar } from "./components/ChatSidebar";
import { ChatWindow } from "./components/ChatWindow";
import { DeviceLinkModal } from "./components/DeviceLinkModal";
import { NewConversationModal } from "./components/NewConversationModal";
import { useChatMessages } from "./hooks/useChatMessages";
import { useChatRealtime, type PresenceEventPayload } from "./hooks/useChatRealtime";
import { useWhatsappSessionStatus, type WhatsappConnectionState } from "./hooks/useWhatsappSessionStatus";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { getMessagePreview } from "./utils/format";
import styles from "./ChatPage.module.css";

type PendingConversation = {
  name: string;
  description?: string;
  hasAttemptedCreate: boolean;
};

type TypingUser = { id: string; name?: string };

type ConversationStateProperty = "muted" | "archived" | "pinned";
type ConversationToggleAction = (
  conversationId: string,
  value: boolean,
) => Promise<ConversationSummary>;

const CONVERSATIONS_PAGE_SIZE = 50;

const removeConversationFromPages = (
  pages: FetchConversationsResponse[],
  conversationId: string,
): FetchConversationsResponse[] =>
  pages.map((page) => ({
    ...page,
    chats: page.chats.filter((item) => item.id !== conversationId),
  }));

const replaceConversationInPages = (
  pages: FetchConversationsResponse[],
  conversation: ConversationSummary,
): FetchConversationsResponse[] =>
  pages.map((page) => ({
    ...page,
    chats: page.chats.map((item) => (item.id === conversation.id ? conversation : item)),
  }));

const promoteConversationInPages = (
  pages: FetchConversationsResponse[],
  conversation: ConversationSummary,
  limitFallback: number,
): FetchConversationsResponse[] => {
  const sanitized = removeConversationFromPages(pages, conversation.id);
  if (sanitized.length === 0) {
    return [
      {
        chats: [conversation],
        total: 1,
        hasMore: false,
        limit: limitFallback,
        offset: 0,
      },
    ];
  }
  const [first, ...rest] = sanitized;
  const limit = typeof first.limit === "number" ? first.limit : limitFallback;
  const updatedFirst = {
    ...first,
    chats: [conversation, ...first.chats].slice(0, limit),
  };
  return [updatedFirst, ...rest];
};

const updateUnreadCountInPages = (
  pages: FetchConversationsResponse[],
  conversationId: string,
  unreadCount: number,
): FetchConversationsResponse[] =>
  pages.map((page) => ({
    ...page,
    chats: page.chats.map((item) =>
      item.id === conversationId ? { ...item, unreadCount } : item,
    ),
  }));

const parseTimestamp = (timestamp?: string | null): number | null => {
  if (!timestamp) {
    return null;
  }
  const value = Date.parse(timestamp);
  return Number.isNaN(value) ? null : value;
};

const hasNewerLastMessage = (
  previous?: ConversationSummary,
  next?: ConversationSummary,
): boolean => {
  const nextTimestamp = parseTimestamp(next?.lastMessage?.timestamp ?? null);
  if (nextTimestamp === null) {
    return false;
  }
  const previousTimestamp = parseTimestamp(
    previous?.lastMessage?.timestamp ?? null,
  );
  if (previousTimestamp === null) {
    return true;
  }
  return nextTimestamp > previousTimestamp;
};

/** Nome que parece jid/remotejid ou número longo deve ser substituído pelo nome legível quando existir. */
const looksLikeJidOrIdentifier = (s: string): boolean => {
  const t = s.trim();
  if (!t) return true;
  // Contém @ (formato JID do WhatsApp)
  if (t.includes("@")) return true;
  // Contém : (formato credentialId:jid)
  if (t.includes(":")) return true;
  // Número longo (provavelmente telefone)
  const digitsOnly = t.replace(/\D/g, "");
  if (digitsOnly.length >= 10 && digitsOnly.length === t.length) return true;
  return false;
};

/** Verifica se o nome parece "humano" (legível) em vez de um identificador técnico */
const isHumanReadableName = (s?: string): boolean => {
  if (!s) return false;
  const t = s.trim();
  if (!t) return false;
  // Se parece com JID/identificador, não é legível
  if (looksLikeJidOrIdentifier(t)) return false;
  // Se contém pelo menos uma letra, provavelmente é um nome
  if (/[a-zA-ZÀ-ÿ]/.test(t)) return true;
  return false;
};

const preferDisplayName = (existing?: string, incoming?: string): string => {
  const inc = typeof incoming === "string" ? incoming.trim() : "";
  const ex = typeof existing === "string" ? existing.trim() : "";

  // Se não há incoming, usar o existente
  if (!inc) return ex || "";

  // Se o existente é legível e o incoming parece um identificador, manter o existente
  if (isHumanReadableName(ex) && looksLikeJidOrIdentifier(inc)) {
    return ex;
  }

  // Se o incoming é legível, usá-lo (pode ser uma atualização do nome)
  if (isHumanReadableName(inc)) {
    return inc;
  }

  // Se nenhum é legível, preferir o existente (se houver)
  return ex || inc;
};

const upsertConversationInPages = (
  pages: FetchConversationsResponse[],
  conversation: ConversationSummary,
  limitFallback: number,
  options?: { promoteOnTimestampChange?: boolean },
): FetchConversationsResponse[] => {
  const promoteOnTimestampChange = options?.promoteOnTimestampChange ?? false;
  let existing: ConversationSummary | undefined;
  for (const page of pages) {
    const match = page.chats.find((item) => item.id === conversation.id);
    if (match) {
      existing = match;
      break;
    }
  }

  if (!existing) {
    return promoteConversationInPages(pages, conversation, limitFallback);
  }

  const merged: ConversationSummary = {
    ...conversation,
    name: preferDisplayName(existing.name, conversation.name),
    avatar: conversation.avatar || existing.avatar || "",
  };

  if (promoteOnTimestampChange && hasNewerLastMessage(existing, conversation)) {
    return promoteConversationInPages(pages, merged, limitFallback);
  }

  return replaceConversationInPages(pages, merged);
};

const patchConversationStateInPages = (
  pages: FetchConversationsResponse[],
  conversationId: string,
  changes: Partial<ConversationSummary>,
): FetchConversationsResponse[] =>
  pages.map((page) => ({
    ...page,
    chats: page.chats.map((item) =>
      item.id === conversationId ? { ...item, ...changes } : item,
    ),
  }));

export const ChatPage = () => {
  const [selectedConversationId, setSelectedConversationId] = useState<string | undefined>();
  const [searchValue, setSearchValue] = useState("");
  const [responsibleFilter, setResponsibleFilter] = useState<string>("all");
  const [newConversationOpen, setNewConversationOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isDeviceLinkOpen, setIsDeviceLinkOpen] = useState(false);
  const [pendingConversation, setPendingConversation] = useState<PendingConversation | null>(
    null,
  );
  const [responsibleOptions, setResponsibleOptions] = useState<ChatResponsibleOption[]>([]);
  const [contactSuggestionsResult, setContactSuggestionsResult] =
    useState<FetchContactSuggestionsResponse | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const debouncedSearchValue = useDebouncedValue(searchValue, 400);
  const lastContactQueryRef = useRef<string | null>(null);
  const typingActivityRef = useRef<{ conversationId?: string; isTyping: boolean; lastSentAt: number }>({
    conversationId: undefined,
    isTyping: false,
    lastSentAt: 0,
  });
  const previousTypingConversationRef = useRef<string | null>(null);
  const lastWhatsappToastStatusRef = useRef<WhatsappConnectionState | null>(null);
  const previousWhatsappConnectionRef = useRef<WhatsappConnectionState | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [loadingConversationsAfterConnect, setLoadingConversationsAfterConnect] = useState(false);

  const whatsappStatus = useWhatsappSessionStatus();

  const updateConversationPages = useCallback(
    (updater: (pages: FetchConversationsResponse[]) => FetchConversationsResponse[]) => {
      queryClient.setQueryData<InfiniteData<FetchConversationsResponse>>(
        ["conversations"],
        (old) => {
          if (!old) {
            return old;
          }
          return {
            ...old,
            pages: updater(old.pages),
          };
        },
      );
    },
    [queryClient],
  );

  const rehydrateConversationCache = useCallback(
    (conversation: ConversationSummary) => {
      updateConversationPages((pages) => replaceConversationInPages(pages, conversation));
      queryClient.setQueryData(["conversation", conversation.id], conversation);
    },
    [queryClient, updateConversationPages],
  );
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const currentUserId = user ? String(user.id) : null;
  const restrictToAssigned = user?.viewAllConversations === false;
  const [typingUsersByConversation, setTypingUsersByConversation] = useState<
    Record<string, TypingUser[]>
  >({});
  const [presenceByConversation, setPresenceByConversation] = useState<
    Record<string, PresenceEventPayload>
  >({});

  useEffect(() => {
    setIsDeviceLinkOpen(false);
    return () => {
      setIsDeviceLinkOpen(false);
    };
  }, [selectedConversationId]);

  useEffect(() => {
    const state = whatsappStatus.connectionState;
    if (state === lastWhatsappToastStatusRef.current) {
      return;
    }
    lastWhatsappToastStatusRef.current = state;

    if (!["disconnected", "error", "unconfigured", "unavailable"].includes(state)) {
      return;
    }

    const descriptionMap: Record<WhatsappConnectionState, string> = {
      disconnected: "A conexão com o WhatsApp foi perdida. Gere um novo QR Code para retomar o atendimento.",
      error: "Detectamos um erro na instância do WhatsApp. Gere um novo QR Code ou contate o suporte.",
      unconfigured: "Finalize a configuração da instância do WhatsApp para liberar o atendimento.",
      unavailable: "A instância do WhatsApp ainda está sendo provisionada. Abra o painel para acompanhar.",
      connected: "",
      connecting: "",
      pending: "",
    };

    toast({
      title: "Integração do WhatsApp",
      description: descriptionMap[state] ?? "Verifique o status da conexão do WhatsApp.",
      action: (
        <ToastAction altText="Abrir configurações" onClick={() => setIsDeviceLinkOpen(true)}>
          Gerenciar
        </ToastAction>
      ),
    });
  }, [toast, whatsappStatus.connectionState]);

  useEffect(() => {
    const state = (location.state ?? null) as
      | {
        contactName?: string;
        contactDescription?: string;
        contactEmail?: string;
        contactPhone?: string;
      }
      | null;

    const searchParams = new URLSearchParams(location.search);
    const queryName = searchParams.get("contato");
    const normalizedName = (state?.contactName ?? queryName ?? "").trim();

    if (!normalizedName) {
      setPendingConversation(null);
      if (!location.search) {
        lastContactQueryRef.current = null;
      }
      return;
    }

    const normalizedLower = normalizedName.toLowerCase();

    if (!state && lastContactQueryRef.current === normalizedLower) {
      return;
    }

    const descriptionCandidates = [
      state?.contactDescription,
      state?.contactEmail,
      state?.contactPhone,
      searchParams.get("descricao") ?? undefined,
    ].filter((item): item is string => !!item && item.trim().length > 0);

    const uniqueDescription =
      Array.from(new Set(descriptionCandidates.map((item) => item.trim()))).join(" · ") ||
      undefined;

    setPendingConversation((prev) => {
      if (
        prev &&
        prev.name.toLowerCase() === normalizedLower &&
        prev.description === uniqueDescription &&
        !prev.hasAttemptedCreate
      ) {
        return prev;
      }

      return {
        name: normalizedName,
        description: uniqueDescription,
        hasAttemptedCreate: false,
      };
    });

    lastContactQueryRef.current = normalizedLower;

    if (state) {
      navigate(location.pathname + location.search, { replace: true });
    }
  }, [location.pathname, location.search, location.state, navigate]);

  const conversationsQuery = useInfiniteQuery({
    queryKey: ["conversations"],
    queryFn: ({ pageParam = 0 }) =>
      fetchConversations({ limit: CONVERSATIONS_PAGE_SIZE, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage) =>
      lastPage.hasMore ? (lastPage.offset ?? 0) + lastPage.chats.length : undefined,
    staleTime: 30_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });

  // Ao conectar o WhatsApp (QR Code lido), fechar o modal, recarregar a lista de conversas e mostrar loading
  useEffect(() => {
    const current = whatsappStatus.connectionState;
    const previous = previousWhatsappConnectionRef.current;
    previousWhatsappConnectionRef.current = current;

    // Só recarregar quando transicionar para "connected" (ex.: após escanear o QR Code)
    if (current !== "connected") return;
    if (previous === "connected" || previous === null) return;

    setIsDeviceLinkOpen(false);
    setLoadingConversationsAfterConnect(true);
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
    queryClient.refetchQueries({ queryKey: ["conversations"] }).finally(() => {
      setLoadingConversationsAfterConnect(false);
    });
  }, [whatsappStatus.connectionState, queryClient]);

  const conversations = useMemo(() => {
    if (!conversationsQuery.data) {
      return [];
    }

    // Helper to extract normalized phone (last 9 digits)
    const normalizePhone = (phone?: string | null): string | null => {
      if (!phone) return null;
      const digits = phone.replace(/\D/g, '');
      // Need at least 8 digits to be considered a valid phone
      return digits.length >= 8 ? digits.slice(-9) : null;
    };

    // Helper to extract waChatId from various ID formats
    const extractWaChatId = (id: string, waChatIdField?: string | null): string | null => {
      // If waChatId field is present, use it
      if (waChatIdField?.trim()) {
        return waChatIdField.trim();
      }

      // Check if ID is in format "credentialId:waChatId" or "prefix:waChatId"
      if (id.includes(':')) {
        const parts = id.split(':');
        if (parts.length === 2 && parts[1]) {
          return parts[1].trim();
        }
      }

      // Check if ID looks like a WhatsApp JID (contains @)
      if (id.includes('@')) {
        return id.trim();
      }

      return null;
    };

    // Helper to extract phone from waChatId (e.g., "5511999999999@s.whatsapp.net" -> "5511999999999")
    const extractPhoneFromJid = (jid?: string | null): string | null => {
      if (!jid) return null;
      const match = jid.match(/^(\d+)@/);
      return match?.[1] ?? null;
    };

    const seenIds = new Set<string>();
    const seenWaChatIds = new Set<string>();
    const seenPhones = new Set<string>();
    const unique: ConversationSummary[] = [];

    for (const page of conversationsQuery.data.pages) {
      for (const chat of page.chats) {
        // Skip if we've already seen this exact ID
        if (seenIds.has(chat.id)) {
          continue;
        }

        // Extract and check waChatId (most reliable for WhatsApp conversations)
        const waChatId = extractWaChatId(chat.id, chat.waChatId);
        if (waChatId) {
          if (seenWaChatIds.has(waChatId)) {
            continue;
          }
          seenWaChatIds.add(waChatId);
        }

        // Collect all possible phone sources
        const phoneSources = [
          chat.phoneNumber,
          extractPhoneFromJid(waChatId),
          extractPhoneFromJid(chat.waChatId),
          // Try to extract phone from name if it looks like a phone number
          chat.name?.replace(/\D/g, '').length >= 10 ? chat.name : null,
        ];

        let isDuplicateByPhone = false;
        for (const phoneSource of phoneSources) {
          const normalizedPhone = normalizePhone(phoneSource);
          if (normalizedPhone) {
            if (seenPhones.has(normalizedPhone)) {
              isDuplicateByPhone = true;
              break;
            }
          }
        }

        if (isDuplicateByPhone) {
          continue;
        }

        // Add all valid phones to seen set
        for (const phoneSource of phoneSources) {
          const normalizedPhone = normalizePhone(phoneSource);
          if (normalizedPhone) {
            seenPhones.add(normalizedPhone);
          }
        }

        seenIds.add(chat.id);
        unique.push(chat);
      }
    }
    // Ordenar: fixadas primeiro, depois pela data da última mensagem (mais recente primeiro)
    return unique.sort((a, b) => {
      const pinnedA = a.pinned ? 1 : 0;
      const pinnedB = b.pinned ? 1 : 0;
      if (pinnedB !== pinnedA) return pinnedB - pinnedA;
      const tsA = parseTimestamp(a.lastMessage?.timestamp ?? null) ?? 0;
      const tsB = parseTimestamp(b.lastMessage?.timestamp ?? null) ?? 0;
      return tsB - tsA;
    });
  }, [conversationsQuery.data]);

  // Conversas já vêm ordenadas por pinned + lastMessage.timestamp no useMemo acima
  // Não é necessário lógica adicional de estabilização - a ordenação é determinística

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedConversationId),
    [conversations, selectedConversationId],
  );

  useEffect(() => {
    if (restrictToAssigned && responsibleFilter === "unassigned") {
      setResponsibleFilter("all");
    }
  }, [restrictToAssigned, responsibleFilter]);

  useEffect(() => {
    let canceled = false;

    const loadResponsibles = async () => {
      try {
        const options = await fetchChatResponsibles();
        if (!canceled) {
          setResponsibleOptions(options);
        }
      } catch (error) {
        console.error("Falha ao carregar responsáveis", error);
      }
    };

    loadResponsibles();

    return () => {
      canceled = true;
    };
  }, []);

  const sidebarResponsibleOptions = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    if (!restrictToAssigned) {
      for (const option of responsibleOptions) {
        map.set(option.id, { id: option.id, name: option.name });
      }
    }
    for (const conversation of conversations) {
      const responsible = conversation.responsible;
      if (!responsible) {
        continue;
      }
      if (!map.has(responsible.id)) {
        map.set(responsible.id, { id: responsible.id, name: responsible.name });
      }
    }
    if (restrictToAssigned && currentUserId && user?.nome_completo) {
      if (!map.has(currentUserId)) {
        map.set(currentUserId, { id: currentUserId, name: user.nome_completo });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [responsibleOptions, conversations, restrictToAssigned, currentUserId, user?.nome_completo]);

  useEffect(() => {
    if (!selectedConversationId && conversations.length > 0) {
      setSelectedConversationId(conversations[0]!.id);
    }
  }, [conversations, selectedConversationId]);

  const { mutate: markConversationAsRead } = useMutation({
    mutationFn: (conversationId: string) => markConversationRead(conversationId),
    onSuccess: (_, conversationId) => {
      updateConversationPages((pages) => updateUnreadCountInPages(pages, conversationId, 0));
    },
  });

  const lastMarkedConversationRef = useRef<string | null>(null);

  useEffect(() => {
    if (!selectedConversationId) {
      lastMarkedConversationRef.current = null;
      return;
    }
    if (lastMarkedConversationRef.current === selectedConversationId) {
      return;
    }
    lastMarkedConversationRef.current = selectedConversationId;
    markConversationAsRead(selectedConversationId);
  }, [markConversationAsRead, selectedConversationId]);

  const createConversationMutation = useMutation({
    mutationFn: createConversation,
    onSuccess: (createdConversation) => {
      updateConversationPages((pages) =>
        upsertConversationInPages(pages, createdConversation, CONVERSATIONS_PAGE_SIZE, {
          promoteOnTimestampChange: true,
        }),
      );
      setSelectedConversationId(createdConversation.id);
      setSearchValue("");
      setPendingConversation(null);
    },
  });

  const applyConversationUpdate = useCallback(
    (conversation: ConversationSummary) => {
      if (
        restrictToAssigned &&
        currentUserId &&
        conversation.responsible?.id !== currentUserId
      ) {
        setSelectedConversationId((prev) => (prev === conversation.id ? undefined : prev));
        updateConversationPages((pages) => removeConversationFromPages(pages, conversation.id));
        return;
      }

      updateConversationPages((pages) =>
        upsertConversationInPages(pages, conversation, CONVERSATIONS_PAGE_SIZE, {
          promoteOnTimestampChange: true,
        }),
      );
    },
    [
      updateConversationPages,
      restrictToAssigned,
      currentUserId,
    ],
  );

  const handleConversationStateChange = useCallback(
    async (
      conversation: ConversationSummary,
      property: ConversationStateProperty,
      action: ConversationToggleAction,
    ) => {
      const currentValue = Boolean(conversation[property]);
      const nextValue = !currentValue;
      updateConversationPages((pages) =>
        patchConversationStateInPages(pages, conversation.id, {
          [property]: nextValue,
        } as Partial<ConversationSummary>),
      );
      try {
        const updated = await action(conversation.id, nextValue);
        applyConversationUpdate(updated);
      } catch (error) {
        updateConversationPages((pages) =>
          patchConversationStateInPages(pages, conversation.id, {
            [property]: currentValue,
          } as Partial<ConversationSummary>),
        );
        toast({
          title: "Não foi possível atualizar a conversa",
          description:
            error instanceof Error
              ? error.message
              : "Tente novamente em instantes.",
          variant: "destructive",
        });
      }
    },
    [applyConversationUpdate, toast, updateConversationPages],
  );

  const {
    messages,
    hasMore,
    isLoading: messagesLoading,
    isLoadingMore,
    isHydratingConversation,
    loadOlder,
    sendMessage,
    mergeMessage,
    updateMessageStatus,
    replaceMessage,
    enqueuePendingMessage,
  } = useChatMessages(selectedConversationId);

  useEffect(() => {
    if (!selectedConversationId) {
      return;
    }
    const conversation = conversations.find((item) => item.id === selectedConversationId);
    const lastMessage = conversation?.lastMessage;
    if (!lastMessage) {
      return;
    }
    if (messages.some((message) => message.id === lastMessage.id)) {
      return;
    }
    mergeMessage({
      id: lastMessage.id,
      conversationId: selectedConversationId,
      sender: lastMessage.sender,
      content: lastMessage.content,
      timestamp: lastMessage.timestamp,
      status: lastMessage.status,
      type: lastMessage.type,
    });
  }, [conversations, mergeMessage, messages, selectedConversationId]);

  const updateConversationMutation = useMutation({
    mutationFn: ({ conversationId, changes }: { conversationId: string; changes: UpdateConversationPayload }) =>
      updateConversationRequest(conversationId, changes),
    onSuccess: (updated) => {
      if (
        restrictToAssigned &&
        currentUserId &&
        updated.responsible?.id !== currentUserId
      ) {
        setSelectedConversationId((prev) => (prev === updated.id ? undefined : prev));
        updateConversationPages((pages) => removeConversationFromPages(pages, updated.id));
        return;
      }

      rehydrateConversationCache(updated);
      const matchesResponsibleFilter =
        responsibleFilter === "all"
          ? true
          : responsibleFilter === "unassigned"
            ? !updated.responsible
            : updated.responsible?.id === responsibleFilter;

      if (!matchesResponsibleFilter) {
        setSelectedConversationId((prev) => (prev === updated.id ? undefined : prev));
      }

      // Atualiza a conversa no cache sem reordenar: a lista deve permanecer ordenada pela mais recente (última mensagem)
      updateConversationPages((pages) =>
        replaceConversationInPages(pages, updated),
      );
    },
  });

  const handleConversationReadEvent = useCallback(
    (conversationId: string) => {
      updateConversationPages((pages) => updateUnreadCountInPages(pages, conversationId, 0));
    },
    [updateConversationPages],
  );

  const handleRealtimeTyping = useCallback(
    ({ conversationId, userId, userName, isTyping }: { conversationId: string; userId: string; userName?: string; isTyping: boolean }) => {
      if (currentUserId && userId === currentUserId) {
        return;
      }

      setTypingUsersByConversation((current) => {
        const existing = current[conversationId] ?? [];
        const filtered = existing.filter((entry) => entry.id !== userId);

        if (isTyping) {
          return {
            ...current,
            [conversationId]: [...filtered, { id: userId, name: userName }],
          };
        }

        if (filtered.length === 0) {
          const { [conversationId]: _removed, ...rest } = current;
          return rest;
        }

        return {
          ...current,
          [conversationId]: filtered,
        };
      });
    },
    [currentUserId],
  );

  const handleRealtimeMessageCreated = useCallback(
    ({ conversationId, message }: { conversationId: string; message: Message }) => {
      const lastMessagePreview = getMessagePreview(message.content, message.type);
      updateConversationPages((pages) => {
        let targetConversation: ConversationSummary | undefined;
        for (const page of pages) {
          const match = page.chats.find((item) => item.id === conversationId);
          if (match) {
            targetConversation = match;
            break;
          }
        }
        if (!targetConversation) {
          return pages;
        }
        const baseUnread =
          typeof targetConversation.unreadCount === "number"
            ? targetConversation.unreadCount
            : 0;
        const shouldIncrementUnread =
          conversationId !== selectedConversationId && message.sender !== "me";
        const unreadCount =
          conversationId === selectedConversationId
            ? 0
            : baseUnread + (shouldIncrementUnread ? 1 : 0);
        const updatedConversation: ConversationSummary = {
          ...targetConversation,
          lastMessage: {
            id: message.id,
            content: message.content,
            preview: lastMessagePreview,
            timestamp: message.timestamp,
            sender: message.sender,
            type: message.type,
            status: message.status,
          },
          unreadCount,
        };
        return upsertConversationInPages(pages, updatedConversation, CONVERSATIONS_PAGE_SIZE, {
          // Só promove quando a mensagem é de outra conversa - mantém ordem fixa ao clicar/visualizar
          promoteOnTimestampChange: conversationId !== selectedConversationId,
        });
      });
      if (conversationId !== selectedConversationId) {
        return;
      }
      if (message.clientMessageId) {
        const existing = messages.find(
          (item) =>
            item.clientMessageId && item.clientMessageId === message.clientMessageId,
        );
        if (existing) {
          replaceMessage(message);
          return;
        }
      }
      mergeMessage(message);
    },
    [
      mergeMessage,
      messages,
      replaceMessage,
      selectedConversationId,
      updateConversationPages,
    ],
  );

  const handleRealtimeMessageStatus = useCallback(
    ({ conversationId, messageId, status }: { conversationId: string; messageId: string; status: MessageStatus }) => {
      updateConversationPages((pages) =>
        pages.map((page) => ({
          ...page,
          chats: page.chats.map((conversation) => {
            if (
              conversation.id !== conversationId ||
              !conversation.lastMessage ||
              conversation.lastMessage.id !== messageId ||
              conversation.lastMessage.status === status
            ) {
              return conversation;
            }
            return {
              ...conversation,
              lastMessage: { ...conversation.lastMessage, status },
            };
          }),
        })),
      );
      if (conversationId === selectedConversationId) {
        updateMessageStatus(messageId, status);
      }
    },
    [selectedConversationId, updateConversationPages, updateMessageStatus],
  );

  const handleRealtimeConversationAvatarUpdate = useCallback(
    ({ id, avatar }: { id: string; avatar: string }) => {
      updateConversationPages((pages) =>
        patchConversationStateInPages(pages, id, { avatar } as Partial<ConversationSummary>),
      );
    },
    [updateConversationPages],
  );

  const handleRealtimeConversationReadEvent = useCallback(
    ({ conversationId }: { conversationId: string }) => {
      if (conversationId) {
        handleConversationReadEvent(conversationId);
      }
    },
    [handleConversationReadEvent],
  );

  const handleRealtimePresenceUpdate = useCallback(
    (payload: PresenceEventPayload) => {
      if (!payload.conversationId) {
        return;
      }
      setPresenceByConversation((previous) => {
        const current = previous[payload.conversationId];
        if (
          current &&
          current.status === payload.status &&
          current.updatedAt === payload.updatedAt &&
          current.lastSeenAt === payload.lastSeenAt
        ) {
          return previous;
        }
        return { ...previous, [payload.conversationId]: payload };
      });
    },
    [],
  );

  useChatRealtime({
    onConversationUpdated: applyConversationUpdate,
    onConversationAvatarUpdated: handleRealtimeConversationAvatarUpdate,
    onConversationRead: handleRealtimeConversationReadEvent,
    onMessageCreated: handleRealtimeMessageCreated,
    onMessageStatusUpdated: handleRealtimeMessageStatus,
    onTyping: handleRealtimeTyping,
    onPresenceUpdate: handleRealtimePresenceUpdate,
    onConnectionChange: (change) => {
      if (change.scope === "stream" && !change.connected) {
        setTypingUsersByConversation({});
        setPresenceByConversation({});
      }
    },
  });

  const emitTypingState = useCallback(async (conversationId: string, isTyping: boolean) => {
    try {
      await setTypingState(conversationId, isTyping);
    } catch (error) {
      console.warn("Falha ao atualizar estado de digitação", error);
    }
  }, []);

  const handleTypingActivity = useCallback(
    (isTyping: boolean) => {
      if (!selectedConversationId) {
        return;
      }

      const state = typingActivityRef.current;
      const now = Date.now();

      if (state.conversationId && state.conversationId !== selectedConversationId) {
        void emitTypingState(state.conversationId, false);
      }

      if (state.conversationId !== selectedConversationId) {
        state.conversationId = selectedConversationId;
        state.isTyping = false;
        state.lastSentAt = 0;
      }

      if (isTyping) {
        const shouldSend = !state.isTyping || now - state.lastSentAt > 1500;
        if (!shouldSend) {
          state.isTyping = true;
          return;
        }
      } else if (!state.isTyping) {
        return;
      }

      state.isTyping = isTyping;
      state.lastSentAt = now;
      void emitTypingState(selectedConversationId, isTyping);
    },
    [emitTypingState, selectedConversationId],
  );

  useEffect(() => {
    const previous = previousTypingConversationRef.current;
    if (previous && previous !== selectedConversationId) {
      void emitTypingState(previous, false);
    }
    previousTypingConversationRef.current = selectedConversationId ?? null;
    typingActivityRef.current = {
      conversationId: selectedConversationId,
      isTyping: false,
      lastSentAt: 0,
    };
  }, [emitTypingState, selectedConversationId]);

  useEffect(() => {
    return () => {
      const previous = typingActivityRef.current.conversationId;
      if (previous) {
        void emitTypingState(previous, false);
      }
    };
  }, [emitTypingState]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia("(max-width: 900px)");
    const handleChange = (event: MediaQueryListEvent | MediaQueryList) => {
      if ("matches" in event) {
        if (!event.matches) {
          setIsSidebarOpen(true);
        }
        return;
      }

      if (!mediaQuery.matches) {
        setIsSidebarOpen(true);
      }
    };

    handleChange(mediaQuery);

    const listener = (event: MediaQueryListEvent) => {
      if (!event.matches) {
        setIsSidebarOpen(true);
      }
    };

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", listener);
    } else if (typeof mediaQuery.addListener === "function") {
      mediaQuery.addListener(listener);
    }

    return () => {
      if (typeof mediaQuery.removeEventListener === "function") {
        mediaQuery.removeEventListener("change", listener);
      } else if (typeof mediaQuery.removeListener === "function") {
        mediaQuery.removeListener(listener);
      }
    };
  }, []);

  const handleSelectConversation = (conversationId: string) => {
    setSelectedConversationId(conversationId);
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 900px)").matches) {
      setIsSidebarOpen(false);
    }
  };

  const handleSendMessage = async (payload: SendMessageInput) => {
    const pending = enqueuePendingMessage(payload);
    if (!pending) {
      return;
    }
    const { clientMessageId, message: pendingMessage } = pending;
    try {
      await sendMessage({ ...payload, clientMessageId }, clientMessageId);
    } catch (error) {
      replaceMessage({ ...pendingMessage, status: "failed" });
      const description =
        error instanceof Error
          ? error.message
          : "Não foi possível enviar a mensagem. Tente novamente.";
      toast({
        title: "Falha ao enviar a mensagem",
        description,
        variant: "destructive",
      });
    }
  };

  const handleReactToMessage = useCallback(
    async (messageId: string, reaction: string) => {
      const trimmedReaction = reaction.trim();
      if (!messageId || !trimmedReaction) {
        return;
      }
      try {
        const updated = await reactToMessage({
          messageId,
          reaction: trimmedReaction,
          conversationId: selectedConversationId,
        });
        replaceMessage(updated);
      } catch (error) {
        toast({
          title: "Falha ao reagir à mensagem",
          description:
            error instanceof Error
              ? error.message
              : "Não foi possível reagir à mensagem. Tente novamente.",
          variant: "destructive",
        });
      }
    },
    [replaceMessage, selectedConversationId, toast],
  );

  const handleEditMessage = useCallback(
    async (messageId: string, content: string) => {
      const trimmedContent = content.trim();
      if (!messageId || !trimmedContent) {
        return;
      }
      try {
        const updated = await editMessage({
          messageId,
          content: trimmedContent,
          conversationId: selectedConversationId,
        });
        replaceMessage(updated);
      } catch (error) {
        toast({
          title: "Falha ao editar a mensagem",
          description:
            error instanceof Error
              ? error.message
              : "Não foi possível editar a mensagem. Tente novamente.",
          variant: "destructive",
        });
      }
    },
    [replaceMessage, selectedConversationId, toast],
  );

  const handleUpdateConversation = async (conversationId: string, changes: UpdateConversationPayload) => {
    if (!conversationId) return;
    await updateConversationMutation.mutateAsync({ conversationId, changes });
  };

  const handleToggleMute = useCallback(
    (conversation: ConversationSummary) => {
      void handleConversationStateChange(conversation, "muted", toggleConversationMute);
    },
    [handleConversationStateChange],
  );

  const handleToggleArchive = useCallback(
    (conversation: ConversationSummary) => {
      void handleConversationStateChange(conversation, "archived", toggleConversationArchive);
    },
    [handleConversationStateChange],
  );

  const handleTogglePin = useCallback(
    (conversation: ConversationSummary) => {
      void handleConversationStateChange(conversation, "pinned", toggleConversationPin);
    },
    [handleConversationStateChange],
  );

  useEffect(() => {
    const handleShortcuts = (event: KeyboardEvent) => {
      if (event.ctrlKey && (event.key === "k" || event.key === "K")) {
        event.preventDefault();
        setNewConversationOpen(false);
        searchInputRef.current?.focus();
      }
      if (event.ctrlKey && (event.key === "n" || event.key === "N")) {
        event.preventDefault();
        setNewConversationOpen(true);
      }
      if (event.key === "Escape") {
        setNewConversationOpen(false);
      }
    };
    window.addEventListener("keydown", handleShortcuts);
    return () => window.removeEventListener("keydown", handleShortcuts);
  }, []);

  useEffect(() => {
    if (!newConversationOpen) {
      return;
    }
    const credentialId = whatsappStatus.sessionEntry?.credentialId;
    const searchQuery = pendingConversation?.name ?? (debouncedSearchValue.trim() || undefined);
    let isSubscribed = true;
    const requestSuggestions = async (useCredential: boolean) => {
      const response = await fetchContactSuggestions(
        useCredential && credentialId
          ? { credentialId, search: searchQuery }
          : { search: searchQuery },
      );
      if (!isSubscribed) {
        return;
      }
      setContactSuggestionsResult(response);
    };
    (async () => {
      try {
        await requestSuggestions(Boolean(credentialId));
      } catch (error) {
        console.error("Failed to fetch contact suggestions", error);
        if (credentialId) {
          try {
            await requestSuggestions(false);
            return;
          } catch (fallbackError) {
            console.error("Failed to fetch fallback contact suggestions", fallbackError);
          }
        }
        if (isSubscribed) {
          setContactSuggestionsResult({ contacts: [] });
        }
      }
    })();
    return () => {
      isSubscribed = false;
    };
  }, [newConversationOpen, pendingConversation, debouncedSearchValue, whatsappStatus.sessionEntry]);

  const activeTypingUsers = useMemo(() => {
    if (!selectedConversationId) {
      return [] as TypingUser[];
    }
    return typingUsersByConversation[selectedConversationId] ?? [];
  }, [selectedConversationId, typingUsersByConversation]);

  const activePresence = useMemo(() => {
    if (!selectedConversationId) {
      return undefined;
    }
    return presenceByConversation[selectedConversationId];
  }, [presenceByConversation, selectedConversationId]);

  const contactSuggestions = contactSuggestionsResult?.contacts ?? [];

  const fallbackContactSuggestions = useMemo<ContactSuggestion[]>(
    () =>
      conversations.map((conversation) => ({
        id: conversation.id,
        name: conversation.name,
        jid: conversation.id,
        avatar: conversation.avatar,
        owner: conversation.description ?? undefined,
      })),
    [conversations],
  );

  const modalContactSuggestions =
    contactSuggestions.length > 0 ? contactSuggestions : fallbackContactSuggestions;

  useEffect(() => {
    if (!pendingConversation) {
      return;
    }

    const normalized = pendingConversation.name.toLowerCase();
    const existing = conversations.find(
      (conversation) => conversation.name.toLowerCase() === normalized,
    );

    if (existing) {
      setSelectedConversationId(existing.id);
      setPendingConversation(null);
      return;
    }

    if (
      !pendingConversation.hasAttemptedCreate &&
      !createConversationMutation.isPending
    ) {
      setPendingConversation((prev) =>
        prev ? { ...prev, hasAttemptedCreate: true } : prev,
      );
      createConversationMutation.mutate({
        name: pendingConversation.name,
        description: pendingConversation.description,
      });
    }
  }, [pendingConversation, conversations, createConversationMutation, createConversationMutation.isPending]);

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen((previous) => !previous);
  }, []);

  const handleLoadMoreConversations = useCallback(() => {
    if (!conversationsQuery.hasNextPage || conversationsQuery.isFetchingNextPage) {
      return;
    }
    void conversationsQuery.fetchNextPage();
  }, [
    conversationsQuery.hasNextPage,
    conversationsQuery.isFetchingNextPage,
    conversationsQuery.fetchNextPage,
  ]);

  const showDeviceLinkFullscreen =
    whatsappStatus.connectionState === "unconfigured" ||
    whatsappStatus.isAwaitingProvisioning ||
    whatsappStatus.connectionState === "unavailable";

  if (showDeviceLinkFullscreen) {
    return (
      <div className={styles.page} data-theme="whatsapp">
        <div className="flex flex-1 flex-col items-center justify-center chat-bg-pattern relative h-full">
          <div className="absolute inset-0 bg-gradient-to-br from-white/80 via-transparent to-primary/5 dark:from-slate-900/80 dark:to-primary/10" />
          <div className="relative z-10 w-full max-w-4xl p-4">
            <DeviceLinkContent isActive layout="inline" whatsappStatus={whatsappStatus} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page} data-theme="whatsapp">
      <div
        className={styles.layout}
        data-sidebar-open={isSidebarOpen ? "true" : "false"}
      >
        <ChatSidebar
          conversations={conversations}
          activeConversationId={selectedConversationId}
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          responsibleFilter={responsibleFilter}
          responsibleOptions={sidebarResponsibleOptions}
          onResponsibleFilterChange={setResponsibleFilter}
          onSelectConversation={handleSelectConversation}
          onNewConversation={() => setNewConversationOpen(true)}
          searchInputRef={searchInputRef}
          loading={
            (conversationsQuery.isLoading && conversations.length === 0) ||
            loadingConversationsAfterConnect
          }
          hasMore={Boolean(conversationsQuery.hasNextPage)}
          onLoadMore={
            conversationsQuery.hasNextPage ? handleLoadMoreConversations : undefined
          }
          isLoadingMore={conversationsQuery.isFetchingNextPage}
          allowUnassignedFilter={!restrictToAssigned}
          isOpen={isSidebarOpen}
          onToggleMute={handleToggleMute}
          onToggleArchive={handleToggleArchive}
          onTogglePin={handleTogglePin}
          isWhatsappConnected={whatsappStatus.isConnected}
        />
        <ChatWindow
          conversation={selectedConversation}
          messages={messages}
          hasMore={hasMore}
          isLoading={messagesLoading}
          isLoadingMore={isLoadingMore}
          isHydratingConversation={isHydratingConversation}
          onSendMessage={handleSendMessage}
          onLoadOlder={loadOlder}
          onUpdateConversation={handleUpdateConversation}
          isUpdatingConversation={updateConversationMutation.isPending}
          typingUsers={activeTypingUsers}
          onTypingActivity={handleTypingActivity}
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={toggleSidebar}
          onOpenDeviceLinkModal={() => setIsDeviceLinkOpen(true)}
          whatsappStatus={whatsappStatus}
          presence={activePresence}
          onReactToMessage={handleReactToMessage}
          onEditMessage={handleEditMessage}
          responsibleOptions={responsibleOptions}
        />
      </div>
      <NewConversationModal
        open={newConversationOpen}
        suggestions={modalContactSuggestions}
        onClose={() => setNewConversationOpen(false)}
        onSelectConversation={(conversationId) => {
          handleSelectConversation(conversationId);
          setNewConversationOpen(false);
        }}
        onCreateConversation={async (name) => {
          const trimmed = name.trim();
          if (!trimmed) return null;
          const created = await createConversationMutation.mutateAsync({ name: trimmed });
          return created.id;
        }}
      />
      <DeviceLinkModal open={isDeviceLinkOpen} onClose={() => setIsDeviceLinkOpen(false)} />
    </div>
  );
};

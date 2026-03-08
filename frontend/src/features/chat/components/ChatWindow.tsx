import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ConversationAvatar } from "./ConversationAvatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList
} from "@/components/ui/command";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
    AlertCircle,
    Bot,
    CalendarClock,
    ChevronLeft,
    ClipboardList,
    Link2,
    Loader2,
    Lock,
    MoreVertical,
    Phone,
    Search,
    Tag,
    Unlock,
    User,
    UserRound,
    X
} from "lucide-react";

import {
    ConversationSummary,
    Message,
    MessageAttachment,
    MessageType,
    SendMessageInput,
    UpdateConversationPayload
} from "../types";
import { fetchChatTags } from "../services/chatApi";

import { ChatInput } from "./ChatInput";
import { MessageViewport } from "./MessageViewport";
import type { PresenceEventPayload } from "../hooks/useChatRealtime";
import type { WhatsappSessionStatusResult } from "../hooks/useWhatsappSessionStatus";
import { fetchClientOptions, type ClientOption } from "../services/chatApi";
import { TaskCreationDialog, type TaskCreationPrefill, type CreatedTaskSummary } from "@/components/tasks/TaskCreationDialog";
import AppointmentCreationDialog, { type AppointmentCreationPrefill } from "@/components/agenda/AppointmentCreationDialog";
import { useToast } from "@/hooks/use-toast";
import type { ChatResponsibleOption } from "../services/chatApi";
import { DeviceLinkContent } from "./DeviceLinkModal";
import chatWindowStyles from "./ChatWindow.module.css";

/* -------------------------------- Utils -------------------------------- */

const getInitials = (name?: string | null) => {
    if (!name) return "";
    const parts = name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2);
    return parts.map((p) => p[0].toUpperCase()).join("");
};

const DOCUMENT_EXTENSIONS = [
    ".pdf", ".doc", ".docx",
    ".xls", ".xlsx", ".ppt", ".pptx",
    ".txt", ".csv", ".zip", ".rar",
    ".7z", ".tar", ".gz",
    ".xml", ".json"
];

const fileToAttachment = async (file: File, fallbackType?: MessageType): Promise<MessageAttachment> => {
    const base64 = await file.arrayBuffer().then(buffer => {
        const bytes = new Uint8Array(buffer);
        let binary = "";
        const chunk = 0x8000;
        for (let i = 0; i < bytes.length; i += chunk) {
            binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
        }
        return btoa(binary);
    });

    const mimeType = file.type || "application/octet-stream";
    const dataUrl = `data:${mimeType};base64,${base64}`;

    const resolvedType =
        fallbackType ||
        (file.type.startsWith("image/") ? "image"
            : file.type.startsWith("audio/") ? "audio"
                : file.type.startsWith("video/") ? "media"
                    : DOCUMENT_EXTENSIONS.some(ext => file.name.toLowerCase().endsWith(ext)) ? "document"
                        : "file");

    return {
        id: `upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: resolvedType as any,
        url: dataUrl,
        name: file.name,
        mimeType
    };
};

const buildTypingIndicator = (typingUsers?: { id: string; name?: string }[] | null) => {
    if (!typingUsers || typingUsers.length === 0) return null;

    const names = typingUsers
        .map(u => u.name?.trim())
        .filter(Boolean);

    if (names.length === 0) {
        return typingUsers.length === 1
            ? "Digitando..."
            : `${typingUsers.length} pessoas digitando...`;
    }

    if (names.length === 1) return `${names[0]} está digitando...`;
    if (names.length === 2) return `${names[0]} e ${names[1]} estão digitando...`;

    return `${names[0]} e mais ${names.length - 1} estão digitando...`;
};

const isWhatsappGroupConversation = (conversation?: ConversationSummary) => {
    if (!conversation) return false;

    const metadata = conversation.metadata;
    if (metadata && typeof metadata === "object") {
        const raw = (metadata as Record<string, unknown>).wa_isGroup;
        if (typeof raw === "boolean") {
            return raw;
        }
    }

    const identifier =
        typeof conversation.waChatId === "string" && conversation.waChatId.trim().length > 0
            ? conversation.waChatId
            : typeof conversation.phoneNumber === "string"
                ? conversation.phoneNumber
                : undefined;

    if (!identifier) {
        return false;
    }

    const normalized = identifier.trim().toLowerCase();
    if (normalized.endsWith("@g.us") || normalized.endsWith("@broadcast")) {
        return true;
    }
    if (normalized.endsWith("@c.us") || normalized.endsWith("@s.whatsapp.net")) {
        return false;
    }

    return false;
};

/* --------------------------- ChatWindow Component --------------------------- */

interface ChatWindowProps {
    conversation?: ConversationSummary;
    messages: Message[];
    hasMore: boolean;
    isLoading: boolean;
    isLoadingMore: boolean;
    isHydratingConversation?: boolean;
    onSendMessage: (payload: SendMessageInput) => Promise<void>;
    onLoadOlder: () => Promise<Message[]>;
    onUpdateConversation: (id: string, c: UpdateConversationPayload) => Promise<void>;
    isUpdatingConversation?: boolean;
    onOpenDeviceLinkModal?: () => void;
    typingUsers?: { id: string; name?: string }[];
    onTypingActivity?: (isTyping: boolean) => void;
    onToggleSidebar?: () => void;
    isSidebarOpen?: boolean;
    whatsappStatus: WhatsappSessionStatusResult;
    onReactToMessage?: (id: string, reaction: string) => void;
    onEditMessage?: (id: string, content: string) => void;
    presence?: PresenceEventPayload;
    responsibleOptions?: ChatResponsibleOption[];
}

export const ChatWindow = ({
    conversation,
    messages,
    hasMore,
    isLoading,
    isLoadingMore,
    onSendMessage,
    onLoadOlder,
    onUpdateConversation,
    isUpdatingConversation,
    onOpenDeviceLinkModal,
    typingUsers,
    onTypingActivity,
    onToggleSidebar,
    isSidebarOpen,
    whatsappStatus,
    onReactToMessage,
    onEditMessage,
    isHydratingConversation,
    presence,
    responsibleOptions
}: ChatWindowProps) => {

    const viewportRef = useRef<HTMLDivElement | null>(null);
    const [isNearBottom, setIsNearBottom] = useState(true);
    const [isTagsDialogOpen, setIsTagsDialogOpen] = useState(false);
    const [pendingTags, setPendingTags] = useState<string[]>([]);
    const [tagSearch, setTagSearch] = useState("");
    const [isDetailsPanelOpen, setIsDetailsPanelOpen] = useState(false);

    const tagsQuery = useQuery({
        queryKey: ["chat-tags"],
        queryFn: fetchChatTags,
        enabled: isTagsDialogOpen
    });

    const normalizedPendingTags = useMemo(() => {
        const unique = new Map<string, string>();
        for (const tag of pendingTags) {
            const trimmed = tag.trim();
            if (!trimmed) continue;
            const normalized = trimmed.toLowerCase();
            if (!unique.has(normalized)) {
                unique.set(normalized, trimmed);
            }
        }
        return Array.from(unique.values());
    }, [pendingTags]);

    const availableTagSuggestions = useMemo(() => {
        const search = tagSearch.trim().toLowerCase();
        const data = tagsQuery.data ?? [];
        return data.filter(tag => {
            if (normalizedPendingTags.some(item => item.toLowerCase() === tag.toLowerCase())) {
                return false;
            }
            if (!search) return true;
            return tag.toLowerCase().includes(search);
        });
    }, [normalizedPendingTags, tagSearch, tagsQuery.data]);

    const handleOpenTagsDialog = useCallback(() => {
        if (!conversation) return;
        setPendingTags(conversation.tags ?? []);
        setTagSearch("");
        setIsTagsDialogOpen(true);
    }, [conversation]);

    const handleAddTag = useCallback((value: string) => {
        const trimmed = value.trim();
        if (!trimmed) return;
        setPendingTags(current => {
            if (current.some(tag => tag.toLowerCase() === trimmed.toLowerCase())) {
                return current;
            }
            return [...current, trimmed];
        });
        setTagSearch("");
    }, []);

    const handleRemoveTag = useCallback((value: string) => {
        setPendingTags(current => current.filter(tag => tag !== value));
    }, []);

    const handleSaveTags = useCallback(async () => {
        if (!conversation) return;
        await onUpdateConversation(conversation.id, { tags: normalizedPendingTags });
        setIsTagsDialogOpen(false);
    }, [conversation, normalizedPendingTags, onUpdateConversation]);
    const [isClientDialogOpen, setIsClientDialogOpen] = useState(false);
    const [isLoadingClients, setIsLoadingClients] = useState(false);
    const [isLoadingMoreClients, setIsLoadingMoreClients] = useState(false);
    const [clientOptions, setClientOptions] = useState<ClientOption[]>([]);
    const [clientPageMeta, setClientPageMeta] = useState({ page: 0, pageSize: 20, total: 0 });
    const [clientError, setClientError] = useState<string | null>(null);
    const [clientOperationError, setClientOperationError] = useState<string | null>(null);
    const [isLinkingClient, setIsLinkingClient] = useState(false);
    const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
    const [isAppointmentDialogOpen, setIsAppointmentDialogOpen] = useState(false);
    const { toast } = useToast();
    const [isChatbotActive, setIsChatbotActive] = useState(true);
    const [selectedResponsibleId, setSelectedResponsibleId] = useState<string>("unassigned");

    const sortedMessages = useMemo(
        () => [...messages].sort((a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        ),
        [messages]
    );

    const typingIndicator = useMemo(
        () => buildTypingIndicator(typingUsers),
        [typingUsers]
    );
    const isGroupConversation = useMemo(() => isWhatsappGroupConversation(conversation), [conversation]);

    const assignmentOptions = useMemo(() => {
        const map = new Map<string, ChatResponsibleOption>();
        if (responsibleOptions) {
            for (const option of responsibleOptions) {
                if (option?.id) {
                    map.set(option.id, option);
                }
            }
        }
        if (conversation?.responsible && !map.has(conversation.responsible.id)) {
            map.set(conversation.responsible.id, {
                id: conversation.responsible.id,
                name: conversation.responsible.name,
                role: conversation.responsible.role
            });
        }
        return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    }, [responsibleOptions, conversation?.responsible]);

    const presenceLabel = useMemo(() => {
        if (!presence) return null;
        if (presence.status === "typing") return "Digitando...";
        if (presence.status === "online") return "Online";
        return "Offline";
    }, [presence]);

    const taskPrefill = useMemo<TaskCreationPrefill | undefined>(() => {
        if (!conversation) return undefined;
        const parts: string[] = [];
        if (conversation.clientName || conversation.name) {
            parts.push(`Contato: ${conversation.clientName || conversation.name}`);
        }
        if (conversation.phoneNumber) {
            parts.push(`Telefone/WhatsApp: ${conversation.phoneNumber}`);
        }
        if (conversation.shortStatus) {
            parts.push(`Contexto: ${conversation.shortStatus}`);
        }
        return {
            title: conversation.name ? `Follow-up - ${conversation.name}` : undefined,
            description: parts.join("\n") || conversation.description,
        } satisfies TaskCreationPrefill;
    }, [conversation]);

    const appointmentPrefill = useMemo<AppointmentCreationPrefill | undefined>(() => {
        if (!conversation) return undefined;
        return {
            title: conversation.name ? `Contato: ${conversation.name}` : undefined,
            description: conversation.description ?? conversation.shortStatus,
            clientName: conversation.clientName ?? conversation.name,
            clientPhone: conversation.phoneNumber,
        } satisfies AppointmentCreationPrefill;
    }, [conversation]);

    const handleTaskCreated = useCallback((task: CreatedTaskSummary) => {
        toast({
            title: "Tarefa criada",
            description: `${task.title} foi adicionada com sucesso.`,
        });
        setIsTaskDialogOpen(false);
    }, [toast]);

    const managementMessage = useMemo(() => {
        if (whatsappStatus.isAwaitingProvisioning) {
            return "Configure a instância do WhatsApp para habilitar o atendimento.";
        }
        if (whatsappStatus.isErrorState) {
            return "É necessário reconectar o WhatsApp para continuar enviando mensagens.";
        }
        if (whatsappStatus.connectionState === "connecting") {
            return "Sincronizando com o WhatsApp. Você pode acompanhar o status no gerenciamento.";
        }
        if (!whatsappStatus.isConnected) {
            return "Gerencie a conexão do WhatsApp para retomar o atendimento.";
        }
        return null;
    }, [whatsappStatus.connectionState, whatsappStatus.isAwaitingProvisioning, whatsappStatus.isConnected, whatsappStatus.isErrorState]);

    const managementCalloutClasses = useMemo(() => {
        const base = {
            container:
                "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-100",
            button:
                "border-amber-300 text-amber-800 hover:bg-amber-100 dark:border-amber-300/50 dark:text-amber-50 dark:hover:bg-amber-400/20",
        };

        if (whatsappStatus.tone === "danger") {
            return {
                container:
                    "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-400/30 dark:bg-rose-500/10 dark:text-rose-100",
                button:
                    "border-rose-300 text-rose-800 hover:bg-rose-100 dark:border-rose-300/50 dark:text-rose-50 dark:hover:bg-rose-400/20",
            };
        }

        if (whatsappStatus.tone === "success") {
            return {
                container:
                    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-400/30 dark:bg-emerald-500/10 dark:text-emerald-100",
                button:
                    "border-emerald-300 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-300/50 dark:text-emerald-50 dark:hover:bg-emerald-400/20",
            };
        }

        return base;
    }, [whatsappStatus.tone]);

    const shouldRenderManagementCallout = useMemo(
        () => Boolean(onOpenDeviceLinkModal && managementMessage),
        [managementMessage, onOpenDeviceLinkModal],
    );

    const toneClasses = useMemo(() => {
        const base = {
            badge: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-100",
            dot: "bg-amber-500"
        };

        if (whatsappStatus.tone === "success") {
            return {
                badge: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-400/10 dark:text-emerald-100",
                dot: "bg-emerald-500"
            };
        }

        if (whatsappStatus.tone === "danger") {
            return {
                badge: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/40 dark:bg-rose-400/10 dark:text-rose-100",
                dot: "bg-rose-500"
            };
        }

        return base;
    }, [whatsappStatus.tone]);

    useEffect(() => {
        if (!conversation) {
            setSelectedResponsibleId("unassigned");
            return;
        }
        setSelectedResponsibleId(conversation.responsible?.id ?? "unassigned");
    }, [conversation?.id, conversation?.responsible?.id]);

    const responsibleSelection = selectedResponsibleId ?? "unassigned";
    const currentResponsibleValue = conversation?.responsible?.id ?? "unassigned";
    const isResponsibleDirty = responsibleSelection !== currentResponsibleValue;

    const handleResponsibleSubmit = useCallback(async () => {
        if (!conversation || isUpdatingConversation) return;
        const value = responsibleSelection;
        const resolved = value === "unassigned" ? null : Number(value);
        if (resolved !== null && !Number.isFinite(resolved)) {
            return;
        }
        await onUpdateConversation(conversation.id, { responsibleId: resolved });
    }, [conversation, responsibleSelection, onUpdateConversation, isUpdatingConversation]);

    const handleResponsibleCancel = useCallback(() => {
        if (conversation) {
            setSelectedResponsibleId(conversation.responsible?.id ?? "unassigned");
        } else {
            setSelectedResponsibleId("unassigned");
        }
    }, [conversation]);

    const handleOpenTaskDialog = useCallback(() => {
        setIsTaskDialogOpen(true);
    }, []);

    const handleOpenAppointmentDialog = useCallback(() => {
        setIsAppointmentDialogOpen(true);
    }, []);

    const loadClientsPage = useCallback(async (targetPage: number) => {
        setClientError(null);
        if (targetPage <= 1) {
            setIsLoadingClients(true);
        } else {
            setIsLoadingMoreClients(true);
        }
        try {
            const result = await fetchClientOptions({ page: targetPage });
            setClientPageMeta({
                page: result.page,
                pageSize: result.pageSize,
                total: result.total
            });
            setClientOptions(prev => {
                if (targetPage <= 1) {
                    return result.clients;
                }
                const existingIds = new Set(prev.map(option => option.id));
                const merged = [...prev];
                for (const option of result.clients) {
                    if (!existingIds.has(option.id)) {
                        merged.push(option);
                    }
                }
                return merged;
            });
        } catch (error) {
            setClientError(
                error instanceof Error
                    ? error.message
                    : "Não foi possível carregar os clientes."
            );
        } finally {
            setIsLoadingClients(false);
            setIsLoadingMoreClients(false);
        }
    }, []);

    useEffect(() => {
        if (!isClientDialogOpen) {
            return;
        }
        if (clientOptions.length > 0 || isLoadingClients || isLoadingMoreClients) {
            return;
        }
        void loadClientsPage(1);
    }, [clientOptions.length, isClientDialogOpen, isLoadingClients, isLoadingMoreClients, loadClientsPage]);

    const handleClientDialogChange = useCallback((open: boolean) => {
        if (open) {
            setClientError(null);
            setClientOperationError(null);
            setIsClientDialogOpen(true);
            return;
        }
        setIsClientDialogOpen(false);
        setClientError(null);
    }, []);

    const handleOpenClientDialog = useCallback(() => {
        handleClientDialogChange(true);
    }, [handleClientDialogChange]);

    const handleSelectClient = useCallback(async (client: ClientOption) => {
        if (!conversation) return;
        setClientOperationError(null);
        setIsLinkingClient(true);
        try {
            await onUpdateConversation(conversation.id, {
                clientId: client.id,
                clientName: client.name,
                isLinkedToClient: true
            });
            setIsClientDialogOpen(false);
        } catch (error) {
            console.error("Falha ao vincular cliente", error);
            setClientOperationError(
                error instanceof Error
                    ? error.message
                    : "Não foi possível vincular o cliente."
            );
        } finally {
            setIsLinkingClient(false);
        }
    }, [conversation, onUpdateConversation]);

    const handleUnlinkClient = useCallback(async () => {
        if (!conversation) return;
        setClientOperationError(null);
        setIsLinkingClient(true);
        try {
            await onUpdateConversation(conversation.id, {
                clientId: null,
                clientName: null,
                isLinkedToClient: false
            });
        } catch (error) {
            console.error("Falha ao desvincular cliente", error);
            setClientOperationError(
                error instanceof Error
                    ? error.message
                    : "Não foi possível desvincular o cliente."
            );
        } finally {
            setIsLinkingClient(false);
        }
    }, [conversation, onUpdateConversation]);

    const hasMoreClients = clientPageMeta.total > 0
        ? clientOptions.length < clientPageMeta.total
        : clientOptions.length > 0 && clientPageMeta.pageSize > 0 && clientOptions.length % clientPageMeta.pageSize === 0;
    const isClientActionDisabled = Boolean(isUpdatingConversation || isLinkingClient);

    /* Scroll */
    const scrollToBottom = useCallback(() => {
        const div = viewportRef.current;
        if (!div) return;
        div.scrollTop = div.scrollHeight;
    }, []);

    useEffect(() => {
        if (conversation) requestAnimationFrame(scrollToBottom);
    }, [conversation?.id]);

    /* Não forçar scroll para o final quando apenas o número de mensagens muda (ex.: carregar mais no topo).
       Isso evitava o salto para o topo ao rolar até o final. Scroll para o final só ao abrir conversa ou enviar mensagem. */

    /* Actions */
    const handleSend = useCallback(async (payload: SendMessageInput) => {
        if (!conversation) return;
        await onSendMessage(payload);
        requestAnimationFrame(scrollToBottom);
    }, [conversation, onSendMessage]);

    const handleAttach = useCallback(async (file: File, type?: MessageType) => {
        if (!conversation) return;
        const attachment = await fileToAttachment(file, type);
        await onSendMessage({
            content: file.name,
            type: attachment.type,
            attachments: [attachment]
        });
        requestAnimationFrame(scrollToBottom);
    }, [conversation, onSendMessage]);

    const createAudioRecorder = useCallback(async () => {
        if (!navigator.mediaDevices) throw new Error("Áudio não suportado.");
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        return new MediaRecorder(stream);
    }, []);

    const togglePrivate = async () => {
        if (!conversation) return;
        await onUpdateConversation(conversation.id, {
            isPrivate: !conversation.isPrivate
        });
    };

    /* Empty state or Disconnected state - Modern WhatsApp Web style */
    if (!conversation || !whatsappStatus.isConnected) {
        return (
            <div
                className={cn(
                    "flex flex-1 flex-col items-center justify-center chat-bg-pattern relative",
                    isSidebarOpen ? "hidden md:flex" : "flex"
                )}
            >
                <div className="absolute inset-0 bg-gradient-to-br from-white/80 via-transparent to-primary/5 dark:from-slate-900/80 dark:to-primary/10" />
                <div className="relative z-10">
                    <DeviceLinkContent isActive layout="inline" whatsappStatus={whatsappStatus} />
                </div>
            </div>
        );
    }

    /* -------------------------------- UI -------------------------------- */

    return (
        <div
            className={cn(
                "relative flex h-full flex-1 flex-col overflow-hidden",
                isSidebarOpen ? "hidden md:flex" : "flex"
            )}
        >
            {/* ------------------------------ Header (Modern glass style) ------------------------------ */}
            <header className={cn(chatWindowStyles.header, "flex h-[64px] items-center gap-3 border-b border-border/20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-4 shadow-sm")}>
                {onToggleSidebar && (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onToggleSidebar}
                        className="h-9 w-9 rounded-full md:hidden text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all duration-200"
                        aria-label="Alternar lista de conversas"
                    >
                        <ChevronLeft className="h-5 w-5" />
                    </Button>
                )}

                {/* Avatar and info - clickable to open details */}
                <button
                    type="button"
                    onClick={() => setIsDetailsPanelOpen(true)}
                    className="flex items-center gap-3 flex-1 min-w-0 text-left hover:bg-muted/40 -ml-2 pl-2 pr-3 py-2 rounded-xl transition-all duration-200 group"
                >
                    <div className="relative">
                        <ConversationAvatar
                            conversationId={conversation.id}
                            avatar={conversation.avatar}
                            name={conversation.name}
                            size="md"
                            className="group-hover:shadow-md transition-shadow duration-200"
                        />
                        {presenceLabel === "Online" && (
                            <div className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
                        )}
                    </div>

                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                            <span className="text-[15px] font-semibold text-foreground truncate group-hover:text-primary transition-colors duration-200">
                                {conversation.name}
                            </span>
                            {conversation.isPrivate && (
                                <Lock size={14} className="shrink-0 text-amber-500" />
                            )}
                        </div>
                        <p className={cn(
                            "text-xs truncate transition-colors duration-200",
                            presenceLabel === "Online" ? "text-emerald-600 dark:text-emerald-400 font-medium" : 
                            presenceLabel === "Digitando..." ? "text-primary font-medium" : "text-muted-foreground"
                        )}>
                            {presenceLabel || (conversation.phoneNumber ? `+${conversation.phoneNumber.replace(/^55/, "55 ")}` : conversation.shortStatus)}
                        </p>
                    </div>
                </button>

                {/* Action buttons - Modern floating style */}
                <div className="flex items-center gap-0.5 bg-muted/40 rounded-xl p-1">
                    <Tooltip delayDuration={100}>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-primary hover:bg-white dark:hover:bg-slate-800 transition-all duration-200"
                                title="Buscar na conversa"
                            >
                                <Search className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs">Buscar mensagens</TooltipContent>
                    </Tooltip>

                    <Tooltip delayDuration={100}>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-primary hover:bg-white dark:hover:bg-slate-800 transition-all duration-200"
                                onClick={handleOpenTaskDialog}
                                title="Nova tarefa"
                            >
                                <ClipboardList className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs">Nova tarefa</TooltipContent>
                    </Tooltip>

                    <Tooltip delayDuration={100}>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-primary hover:bg-white dark:hover:bg-slate-800 transition-all duration-200"
                                onClick={handleOpenAppointmentDialog}
                                title="Agendar compromisso"
                            >
                                <CalendarClock className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs">Agendar compromisso</TooltipContent>
                    </Tooltip>

                    <Tooltip delayDuration={100}>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-lg text-muted-foreground hover:text-primary hover:bg-white dark:hover:bg-slate-800 transition-all duration-200"
                                onClick={() => setIsDetailsPanelOpen(true)}
                                title="Detalhes"
                            >
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs">Detalhes da conversa</TooltipContent>
                    </Tooltip>
                </div>
            </header>

            {/* WhatsApp status callout */}
            {shouldRenderManagementCallout && (
                <div
                    className={cn(
                        "flex items-center justify-between gap-3 px-4 py-2 text-xs font-medium",
                        managementCalloutClasses.container
                    )}
                >
                    <span>{managementMessage}</span>
                    <button
                        type="button"
                        onClick={onOpenDeviceLinkModal}
                        className={cn(
                            "shrink-0 rounded-full border px-3 py-1 text-xs font-semibold transition",
                            managementCalloutClasses.button
                        )}
                    >
                        Gerenciar
                    </button>
                </div>
            )}

            {/* Details Panel (Sheet/Drawer) */}
            <Sheet open={isDetailsPanelOpen} onOpenChange={setIsDetailsPanelOpen}>
                <SheetContent className="w-full max-w-md overflow-y-auto p-0">
                    <SheetHeader className="sr-only">
                        <SheetTitle>Detalhes da conversa</SheetTitle>
                    </SheetHeader>

                    {/* Profile section */}
                    <div className="flex flex-col items-center py-8 px-6 bg-gradient-to-b from-primary/5 to-transparent">
                        <ConversationAvatar
                            conversationId={conversation.id}
                            avatar={conversation.avatar}
                            name={conversation.name}
                            size="xl"
                            className="mb-4"
                        />
                        <h3 className="text-xl font-semibold text-foreground">{conversation.name}</h3>
                        {conversation.phoneNumber && (
                            <p className="mt-1 text-sm text-muted-foreground flex items-center gap-1.5">
                                <Phone size={14} />
                                +{conversation.phoneNumber.replace(/^55/, "55 ")}
                            </p>
                        )}
                    </div>

                    <Separator />

                    {/* Quick actions */}
                    <div className="grid grid-cols-3 gap-2 p-4">
                        <button
                            onClick={togglePrivate}
                            className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-muted/60 transition-colors"
                        >
                            {conversation.isPrivate ? <Lock className="h-5 w-5 text-amber-500" /> : <Unlock className="h-5 w-5 text-muted-foreground" />}
                            <span className="text-xs text-muted-foreground">
                                {conversation.isPrivate ? "Privado" : "Público"}
                            </span>
                        </button>
                        <button
                            onClick={handleOpenTaskDialog}
                            className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-muted/60 transition-colors"
                        >
                            <ClipboardList className="h-5 w-5 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">Tarefa</span>
                        </button>
                        <button
                            onClick={handleOpenAppointmentDialog}
                            className="flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-muted/60 transition-colors"
                        >
                            <CalendarClock className="h-5 w-5 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground">Agendar</span>
                        </button>
                    </div>

                    <Separator />

                    {/* Responsible section */}
                    <div className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                                <UserRound size={16} />
                                Responsável
                            </div>
                        </div>
                        <Select value={responsibleSelection} onValueChange={setSelectedResponsibleId}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Selecione um responsável" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="unassigned">Sem responsável</SelectItem>
                                {assignmentOptions.map((option) => (
                                    <SelectItem key={option.id} value={option.id}>
                                        {option.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {isResponsibleDirty && (
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" className="flex-1" onClick={handleResponsibleCancel}>
                                    Cancelar
                                </Button>
                                <Button size="sm" className="flex-1" onClick={handleResponsibleSubmit} disabled={isUpdatingConversation}>
                                    {isUpdatingConversation && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Aplicar
                                </Button>
                            </div>
                        )}
                    </div>

                    <Separator />

                    {/* Client section */}
                    <div className="p-4 space-y-3">
                        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                            <User size={16} />
                            Cliente vinculado
                        </div>
                        <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-muted/40">
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-foreground truncate">
                                    {conversation.isLinkedToClient && conversation.clientName
                                        ? conversation.clientName
                                        : "Nenhum cliente vinculado"}
                                </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <Button variant="outline" size="sm" onClick={handleOpenClientDialog} disabled={isClientActionDisabled}>
                                    Vincular
                                </Button>
                                {conversation.isLinkedToClient && (
                                    <Button variant="ghost" size="sm" onClick={handleUnlinkClient} disabled={isClientActionDisabled}>
                                        <X size={16} />
                                    </Button>
                                )}
                            </div>
                        </div>
                        {clientOperationError && (
                            <div className="flex items-center gap-2 text-xs text-destructive">
                                <AlertCircle className="h-4 w-4" />
                                <span>{clientOperationError}</span>
                            </div>
                        )}
                    </div>

                    <Separator />

                    {/* Tags section */}
                    <div className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                                <Tag size={16} />
                                Etiquetas
                            </div>
                            <Button variant="ghost" size="sm" onClick={handleOpenTagsDialog}>
                                Gerenciar
                            </Button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {conversation.tags && conversation.tags.length > 0 ? (
                                conversation.tags.map(tag => (
                                    <Badge key={tag} variant="secondary" className="rounded-full">
                                        {tag}
                                    </Badge>
                                ))
                            ) : (
                                <span className="text-sm text-muted-foreground">Nenhuma etiqueta</span>
                            )}
                        </div>
                    </div>

                    <Separator />

                    {/* Chatbot section */}
                    <div className="p-4 space-y-3">
                        <Tooltip delayDuration={0}>
                            <TooltipTrigger asChild>
                                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
                                    <div className="flex items-center gap-3">
                                        <Bot className="h-5 w-5 text-muted-foreground" />
                                        <div>
                                            <p className="text-sm font-medium text-foreground">Chatbot</p>
                                            <p className="text-xs text-muted-foreground">
                                                {isChatbotActive ? "Ativo nesta conversa" : "Desativado"}
                                            </p>
                                        </div>
                                    </div>
                                    <Switch
                                        checked={isChatbotActive}
                                        onCheckedChange={setIsChatbotActive}
                                        aria-label="Alternar chatbot"
                                    />
                                </div>
                            </TooltipTrigger>
                            <TooltipContent>Em breve</TooltipContent>
                        </Tooltip>
                    </div>

                    <Separator />

                    {/* WhatsApp status */}
                    <div className="p-4">
                        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40">
                            <div className="flex items-center gap-2">
                                <div className={cn("h-2 w-2 rounded-full", toneClasses.dot)} />
                                <span className="text-sm font-medium">{whatsappStatus.statusLabel}</span>
                            </div>
                            {onOpenDeviceLinkModal && (
                                <Button variant="ghost" size="sm" onClick={onOpenDeviceLinkModal}>
                                    <Link2 size={16} className="mr-1.5" />
                                    Gerenciar
                                </Button>
                            )}
                        </div>
                    </div>
                </SheetContent>
            </Sheet>

            {/* ------------------------------ Messages ------------------------------ */}
            <div className={cn(chatWindowStyles.viewportWrapper, "relative flex-1 overflow-hidden flex flex-col min-h-0")}>
                <MessageViewport
                    messages={sortedMessages}
                    containerRef={viewportRef}
                    hasMore={hasMore}
                    isLoadingMore={isLoadingMore}
                    onLoadMore={onLoadOlder}
                    onStickToBottomChange={setIsNearBottom}
                    conversationAvatar={conversation.avatar}
                    conversationName={conversation.name}
                    isGroupConversation={isGroupConversation}
                    onReactToMessage={onReactToMessage}
                    onEditMessage={onEditMessage}
                    isHydrating={isHydratingConversation}
                />
            </div>

            {/* ------------------------------ Typing indicator ------------------------------ */}
            {typingIndicator && (
                <div className="px-4 py-2 text-xs font-medium text-primary bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border-t border-border/20 flex items-center gap-2 animate-fade-in">
                    <span className="flex gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
                    </span>
                    {typingIndicator}
                </div>
            )}

            {/* ------------------------------ Input ------------------------------ */}
            <div className={cn(chatWindowStyles.inputContainer, "border-t border-border/20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-3 py-3 shadow-[0_-1px_3px_rgba(0,0,0,0.05)]")}>
                <ChatInput
                    onSend={handleSend}
                    onAttach={handleAttach}
                    createAudioRecorder={createAudioRecorder}
                    onTypingActivity={onTypingActivity}
                    disabled={isLoading}
                    typingIndicator={typingIndicator}
                    isUpdatingConversation={isUpdatingConversation}
                />
            </div>

            <Dialog open={isTagsDialogOpen} onOpenChange={setIsTagsDialogOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Etiquetas da conversa</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                        <div className="flex flex-wrap gap-2">
                            {normalizedPendingTags.length > 0 ? (
                                normalizedPendingTags.map(tag => (
                                    <span
                                        key={tag}
                                        className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs text-foreground"
                                    >
                                        {tag}
                                        <button
                                            type="button"
                                            className="text-muted-foreground/70 transition hover:text-foreground"
                                            onClick={() => handleRemoveTag(tag)}
                                        >
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    </span>
                                ))
                            ) : (
                                <span className="text-xs text-muted-foreground">Nenhuma etiqueta selecionada.</span>
                            )}
                        </div>
                        <div>
                            <Input
                                placeholder="Digite para buscar ou criar uma etiqueta"
                                value={tagSearch}
                                onChange={event => setTagSearch(event.target.value)}
                                onKeyDown={event => {
                                    if (event.key === "Enter") {
                                        event.preventDefault();
                                        handleAddTag(tagSearch);
                                    }
                                }}
                            />
                            <div className="mt-2 max-h-40 overflow-y-auto rounded-md border border-dashed">
                                {tagsQuery.isFetching && (
                                    <div className="px-3 py-2 text-xs text-muted-foreground">Carregando etiquetas...</div>
                                )}
                                {!tagsQuery.isFetching && availableTagSuggestions.length === 0 && tagSearch.trim() && (
                                    <button
                                        type="button"
                                        className="block w-full px-3 py-2 text-left text-xs text-foreground hover:bg-muted"
                                        onClick={() => handleAddTag(tagSearch)}
                                    >
                                        Adicionar "{tagSearch.trim()}"
                                    </button>
                                )}
                                {availableTagSuggestions.map(tag => (
                                    <button
                                        type="button"
                                        key={tag}
                                        className="block w-full px-3 py-2 text-left text-xs text-foreground hover:bg-muted"
                                        onClick={() => handleAddTag(tag)}
                                    >
                                        {tag}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => setIsTagsDialogOpen(false)}>
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            onClick={handleSaveTags}
                            disabled={isUpdatingConversation}
                        >
                            Salvar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <Dialog open={isClientDialogOpen} onOpenChange={handleClientDialogChange}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Vincular cliente</DialogTitle>
                        <DialogDescription>
                            Selecione um cliente cadastrado para associar a esta conversa.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        <Command className="rounded-lg border">
                            <CommandInput placeholder="Buscar cliente..." />
                            <CommandList className="max-h-60 overflow-y-auto">
                                {isLoadingClients ? (
                                    <div className="py-6 text-center text-sm text-muted-foreground">
                                        Carregando clientes...
                                    </div>
                                ) : (
                                    <>
                                        <CommandGroup>
                                            {clientOptions.map(client => {
                                                const detailParts = [client.document, client.email, client.phone]
                                                    .filter(Boolean)
                                                    .join(" · ");
                                                return (
                                                    <CommandItem
                                                        key={client.id}
                                                        value={`${client.name} ${detailParts}`.trim()}
                                                        disabled={isClientActionDisabled}
                                                        onSelect={() => handleSelectClient(client)}
                                                        className="flex w-full flex-col items-start gap-1 py-2"
                                                    >
                                                        <span className="font-medium text-foreground">{client.name}</span>
                                                        <span className="text-xs text-muted-foreground">
                                                            {detailParts || "Sem detalhes adicionais"}
                                                        </span>
                                                    </CommandItem>
                                                );
                                            })}
                                        </CommandGroup>
                                        <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                                    </>
                                )}
                            </CommandList>
                        </Command>
                        {clientError && (
                            <div className="flex items-center gap-2 text-sm text-destructive">
                                <AlertCircle className="h-4 w-4" />
                                <span>{clientError}</span>
                            </div>
                        )}
                        {clientOperationError && isClientDialogOpen && (
                            <div className="flex items-center gap-2 text-sm text-destructive">
                                <AlertCircle className="h-4 w-4" />
                                <span>{clientOperationError}</span>
                            </div>
                        )}
                        {hasMoreClients && (
                            <Button
                                variant="secondary"
                                onClick={() => void loadClientsPage(clientPageMeta.page + 1)}
                                disabled={isLoadingMoreClients}
                            >
                                {isLoadingMoreClients ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Carregando...
                                    </>
                                ) : (
                                    "Carregar mais"
                                )}
                            </Button>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
            <TaskCreationDialog
                open={isTaskDialogOpen}
                onOpenChange={setIsTaskDialogOpen}
                prefill={taskPrefill}
                onCreated={handleTaskCreated}
            />
            <AppointmentCreationDialog
                open={isAppointmentDialogOpen}
                onOpenChange={setIsAppointmentDialogOpen}
                prefill={appointmentPrefill}
            />
        </div >
    );
};

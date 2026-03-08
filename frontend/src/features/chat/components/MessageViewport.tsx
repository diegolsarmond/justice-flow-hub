import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    AlertCircle,
    Check,
    CheckCheck,
    Clock,
    Pencil,
    SmilePlus,
    MessageCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Message, MessageStatus } from "../types";
import { formatMessageTimestamp, parseTimestamp } from "../utils/format";
import { TextMessage } from "./TextMessage";
import { MediaMessage } from "./MediaMessage";
import { AudioMessage } from "./AudioMessage";
import { DocumentMessage } from "./DocumentMessage";
import { ContactMessage } from "./ContactMessage";
import { LocationMessage } from "./LocationMessage";
import { cn } from "@/lib/utils";

// Helper to format date separator label
const formatDateSeparator = (date: Date): string => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const isToday = date.toDateString() === today.toDateString();
    const isYesterday = date.toDateString() === yesterday.toDateString();
    
    if (isToday) {
        return "Hoje";
    }
    if (isYesterday) {
        return "Ontem";
    }
    
    // Format as DD/MM/YYYY
    return date.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    });
};

// Helper to get date key for grouping (YYYY-MM-DD)
const getDateKey = (timestamp: string): string => {
    const date = parseTimestamp(timestamp);
    if (!date) return "";
    return date.toISOString().split("T")[0] ?? "";
};

interface MessageViewportProps {
    messages: Message[];
    conversationAvatar?: string;
    conversationName?: string;
    containerRef: MutableRefObject<HTMLDivElement | null>;
    hasMore: boolean;
    isLoadingMore: boolean;
    onLoadMore: () => Promise<Message[]>;
    onStickToBottomChange?: (isNearBottom: boolean) => void;
    onReactToMessage?: (messageId: string, reaction: string) => Promise<void> | void;
    onEditMessage?: (messageId: string, content: string) => Promise<void> | void;
    isHydrating?: boolean;
    isGroupConversation?: boolean;
}

const getInitials = (value?: string) => {
    if (!value) return "";
    const parts = value.trim().split(/\s+/).filter(Boolean);
    return parts.slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");
};

const resolveMessageSenderName = (message: Message, fallback?: string) => {
    const tracking = message.payload?.tracking;
    if (tracking && typeof tracking === "object") {
        const raw = (tracking as Record<string, unknown>).senderName;
        if (typeof raw === "string") {
            const trimmed = raw.trim();
            if (trimmed.length > 0) {
                return trimmed;
            }
        }
    }

    const contactName = message.payload?.contactName;
    if (typeof contactName === "string") {
        const trimmed = contactName.trim();
        if (trimmed.length > 0) {
            return trimmed;
        }
    }

    return fallback;
};

const REACTION_OPTIONS = ["👍", "❤️", "😂", "🎉", "😮", "😢", "👏", "🔥"];

const STATUS_ICON_META: Record<
    MessageStatus,
    { Icon: LucideIcon; label: string; className: string }
> = {
    pending: { Icon: Clock, label: "Pendente", className: "text-gray-400" },
    sent: { Icon: Check, label: "Enviada", className: "text-gray-400" },
    delivered: { Icon: CheckCheck, label: "Entregue", className: "text-gray-400" },
    read: { Icon: CheckCheck, label: "Lida", className: "text-[#53bdeb]" },
    failed: { Icon: AlertCircle, label: "Falha ao enviar", className: "text-red-400" },
};

const StatusIcon = ({ status }: { status?: MessageStatus }) => {
    const meta = STATUS_ICON_META[status ?? "pending"] ?? STATUS_ICON_META.pending;
    const Icon = meta.Icon;
    return (
        <span
            className={`inline-flex items-center justify-center ${meta.className}`}
            aria-label={`Status: ${meta.label}`}
        >
            <Icon className="h-3.5 w-3.5" />
        </span>
    );
};

export const MessageViewport = ({
    messages,
    conversationAvatar,
    conversationName,
    containerRef,
    hasMore,
    isLoadingMore,
    onLoadMore,
    onStickToBottomChange,
    onReactToMessage,
    onEditMessage,
    isHydrating = false,
    isGroupConversation = false,
}: MessageViewportProps) => {
    const scrollAreaRef = useRef<HTMLDivElement | null>(null);
    const scrollRestoreRef = useRef<{ scrollTop: number; scrollHeight: number } | null>(null);

    const loadingMoreRef = useRef(false);
    useEffect(() => {
        loadingMoreRef.current = isLoadingMore;
    }, [isLoadingMore]);

    useEffect(() => {
        const root = scrollAreaRef.current;
        if (!root) return;

        const viewport = root.querySelector("[data-radix-scroll-area-viewport]") as HTMLDivElement | null;
        if (!viewport) return;

        containerRef.current = viewport;

        const handleScroll = () => {
            const { scrollTop, clientHeight, scrollHeight } = viewport;

            if (scrollTop < 80 && hasMore && !loadingMoreRef.current) {
                loadingMoreRef.current = true;
                scrollRestoreRef.current = { scrollTop, scrollHeight };
                void onLoadMore();
            }

            const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
            onStickToBottomChange?.(distanceFromBottom < 120);
        };

        viewport.addEventListener("scroll", handleScroll);
        return () => viewport.removeEventListener("scroll", handleScroll);
    }, [containerRef, hasMore, onLoadMore, onStickToBottomChange]);

    // Preservar posição do scroll ao carregar mais mensagens (prepend). Evita o salto para o topo.
    const prevMessagesLengthRef = useRef(messages.length);
    const prevLoadingRef = useRef(isLoadingMore);
    useEffect(() => {
        const viewport = scrollAreaRef.current?.querySelector("[data-radix-scroll-area-viewport]") as HTMLDivElement | null;
        const saved = scrollRestoreRef.current;
        const didLoadMore = prevLoadingRef.current && !isLoadingMore && messages.length > prevMessagesLengthRef.current;

        prevMessagesLengthRef.current = messages.length;
        prevLoadingRef.current = isLoadingMore;

        if (viewport && saved && didLoadMore) {
            const savedCopy = { ...saved };
            scrollRestoreRef.current = null;
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    const vp = scrollAreaRef.current?.querySelector("[data-radix-scroll-area-viewport]") as HTMLDivElement | null;
                    if (!vp) return;
                    const delta = vp.scrollHeight - savedCopy.scrollHeight;
                    if (delta > 0) {
                        vp.scrollTop = savedCopy.scrollTop + delta;
                    }
                });
            });
        }
    }, [messages.length, isLoadingMore]);

    return (
        <ScrollArea
            ref={scrollAreaRef}
            className="h-full w-full scrollbar-thin"
        >
            <div className="relative min-h-full w-full px-3 sm:px-4 py-3">
                <div className="flex flex-col gap-1">

                    {hasMore && (
                        <div className="flex justify-center py-4">
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => onLoadMore()}
                                disabled={isLoadingMore}
                                className="rounded-full text-[11px] font-semibold shadow-md backdrop-blur-sm hover:shadow-lg transition-all duration-200 px-4"
                            >
                                {isLoadingMore ? (
                                    <span className="flex items-center gap-2">
                                        <span className="h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
                                        Carregando...
                                    </span>
                                ) : (
                                    "Carregar mensagens anteriores"
                                )}
                            </Button>
                        </div>
                    )}

                    {messages.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-24 text-center animate-fade-in">
                            <div className="rounded-2xl bg-white/90 dark:bg-slate-800/90 p-8 shadow-lg backdrop-blur-sm">
                                <div className="rounded-full bg-gradient-to-br from-primary/10 to-primary/5 p-4 mx-auto w-fit">
                                    <MessageCircle className="h-12 w-12 text-primary/40" />
                                </div>
                                <p className="mt-5 max-w-[260px] text-sm font-medium text-foreground/70">
                                    Inicie o atendimento
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground/60">
                                    As mensagens aparecerão aqui
                                </p>
                            </div>
                        </div>
                    )}

                    {messages.map((message, index) => {
                        const isOwn = message.sender === "me";
                        const shouldShowSender = isGroupConversation && !isOwn;
                        const senderLabel = shouldShowSender
                            ? resolveMessageSenderName(message, conversationName ?? "Contato")
                            : undefined;
                        
                        // Check if we need to show date separator
                        const currentDateKey = getDateKey(message.timestamp);
                        const previousMessage = index > 0 ? messages[index - 1] : null;
                        const previousDateKey = previousMessage ? getDateKey(previousMessage.timestamp) : null;
                        const showDateSeparator = currentDateKey !== previousDateKey;

                        return (
                            <div key={message.id ?? message.clientMessageId} className={cn(isOwn ? "animate-slide-in-right" : "animate-slide-in-left")}>
                                {/* Date Separator - Modern pill style */}
                                {showDateSeparator && (() => {
                                    const date = parseTimestamp(message.timestamp);
                                    if (!date) return null;
                                    return (
                                        <div className="flex justify-center py-3 my-2">
                                            <div className="rounded-full bg-white/95 dark:bg-slate-800/95 px-4 py-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300 shadow-md backdrop-blur-sm uppercase tracking-wide">
                                                {formatDateSeparator(date)}
                                            </div>
                                        </div>
                                    );
                                })()}
                                
                                <div
                                    className={cn(
                                        "flex w-full py-0.5",
                                        isOwn ? "justify-end" : "justify-start"
                                    )}
                                >
                                    <div className={cn(
                                        "flex flex-col group",
                                        "max-w-[85%] sm:max-w-[75%] lg:max-w-[65%]",
                                        isOwn ? "items-end" : "items-start"
                                    )}>
                                        {shouldShowSender && senderLabel && (
                                            <div className="mb-1.5 flex items-center gap-2 px-3">
                                                <Avatar className="h-5 w-5 ring-1 ring-white/50 shadow-sm">
                                                    {conversationAvatar && <AvatarImage src={conversationAvatar} className="object-cover" />}
                                                    <AvatarFallback className="text-[9px] font-bold bg-gradient-to-br from-primary/30 to-primary/20 text-primary">{getInitials(senderLabel)}</AvatarFallback>
                                                </Avatar>
                                                <span className="text-[11px] font-semibold text-primary">{senderLabel}</span>
                                            </div>
                                        )}

                                        {/* Message bubble - Modern WhatsApp style */}
                                        <div
                                            className={cn(
                                                "relative px-3.5 py-2.5 min-w-[90px] transition-shadow duration-200 group-hover:shadow-md",
                                                isOwn
                                                    ? "bg-[var(--bubble-own)] text-slate-900 dark:text-slate-100 rounded-2xl rounded-tr-md shadow-[var(--shadow-bubble)]"
                                                    : "bg-[var(--bubble-other)] text-slate-900 dark:text-slate-100 rounded-2xl rounded-tl-md shadow-[var(--shadow-bubble)]"
                                            )}
                                        >
                                            <div className="text-[14px] leading-relaxed break-words whitespace-pre-wrap">
                                                <MessageContent message={message} />
                                            </div>

                                            <div className={cn(
                                                "mt-1.5 flex items-center gap-1.5 text-[10px] justify-end select-none",
                                                isOwn ? "text-slate-600/60 dark:text-slate-400/60" : "text-slate-500/60 dark:text-slate-400/60"
                                            )}>
                                                <time dateTime={message.timestamp} className="font-medium">
                                                    {formatMessageTimestamp(message.timestamp)}
                                                </time>

                                                {isOwn && <StatusIcon status={message.status ?? "pending"} />}

                                                {isOwn && (
                                                    <div className="opacity-0 transition-all duration-200 group-hover:opacity-100 ml-0.5 scale-90 group-hover:scale-100">
                                                        <OwnMessageActions
                                                            message={message}
                                                            onReact={onReactToMessage}
                                                            onEdit={onEditMessage}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {isHydrating && <HydratingSkeleton />}
                </div>
            </div>
        </ScrollArea>
    );
};

const HydratingSkeleton = () => (
    <div className="pointer-events-none absolute inset-0 bg-[var(--chat-bg)]/95 backdrop-blur-md z-10">
        <div className="flex h-full flex-col justify-end gap-3 p-5">
            {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}>
                    <div className={cn(
                        "rounded-2xl animate-pulse",
                        i % 2 === 0 
                            ? "w-44 sm:w-64 h-14 bg-white/70 dark:bg-[#202c33]/70 rounded-tl-md" 
                            : "w-36 sm:w-52 h-12 bg-[#d9fdd3]/70 dark:bg-[#005c4b]/70 rounded-tr-md"
                    )} style={{ animationDelay: `${i * 100}ms` }} />
                </div>
            ))}
            <div className="flex justify-center pt-4">
                <div className="flex items-center gap-2 bg-white/80 dark:bg-slate-800/80 rounded-full px-4 py-2 shadow-sm">
                    <div className="h-4 w-4 rounded-full border-2 border-primary/40 border-t-primary animate-spin" />
                    <span className="text-xs font-medium text-muted-foreground">Carregando mensagens...</span>
                </div>
            </div>
        </div>
    </div>
);

const MessageContent = ({ message }: { message: Message }) => {
    if (message.attachments?.length) {
        return (
            <div className="space-y-3">
                {message.attachments.map((a) => {
                    if (a.type === "image" || a.type === "media") return <MediaMessage key={a.id} attachment={a} />;
                    if (a.type === "audio") return <AudioMessage key={a.id} attachment={a} />;
                    return <DocumentMessage key={a.id} attachment={a} />;
                })}
                <TextMessage content={message.content} />
            </div>
        );
    }

    if (message.type === "image" || message.type === "media") {
        return (
            <MediaMessage
                attachment={{
                    id: `${message.id}-media`,
                    type: "image",
                    url: message.content,
                    name: "Imagem",
                }}
            />
        );
    }

    if (message.type === "audio") {
        return (
            <AudioMessage
                attachment={{
                    id: `${message.id}-audio`,
                    type: "audio",
                    url: message.content,
                    name: "Áudio",
                }}
            />
        );
    }

    if (message.type === "file" || message.type === "document") {
        return (
            <DocumentMessage
                attachment={{
                    id: `${message.id}-document`,
                    type: "file",
                    url: message.content,
                    name: message.content,
                }}
            />
        );
    }

    if (message.type === "location" && message.payload?.location) {
        return <LocationMessage location={message.payload.location} />;
    }

    if (message.type === "contact" && message.payload?.contact) {
        return <ContactMessage contact={message.payload.contact} />;
    }

    return <p>{message.content}</p>;
};

interface OwnMessageActionsProps {
    message: Message;
    onReact?: (messageId: string, reaction: string) => Promise<void> | void;
    onEdit?: (messageId: string, content: string) => Promise<void> | void;
}

const OwnMessageActions = ({ message, onReact, onEdit }: OwnMessageActionsProps) => {
    const [isReactionOpen, setIsReactionOpen] = useState(false);
    const [isEditOpen, setIsEditOpen] = useState(false);
    const [editValue, setEditValue] = useState(message.content);
    const [isSubmitting, setIsSubmitting] = useState(false);

    return (
        <div className="ml-1 flex gap-1">
            {onReact && (
                <Popover open={isReactionOpen} onOpenChange={setIsReactionOpen}>
                    <PopoverTrigger asChild>
                        <button className="text-gray-500 hover:text-gray-700">
                            <SmilePlus className="h-4 w-4" />
                        </button>
                    </PopoverTrigger>
                    <PopoverContent className="p-2 bg-white rounded-xl shadow">
                        <div className="grid grid-cols-4 gap-1 text-xl">
                            {REACTION_OPTIONS.map((emoji) => (
                                <button
                                    key={emoji}
                                    onClick={() => {
                                        void onReact(message.id, emoji);
                                        setIsReactionOpen(false);
                                    }}
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                    </PopoverContent>
                </Popover>
            )}

            {onEdit && (
                <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
                    <DialogTrigger asChild>
                        <button className="text-gray-500 hover:text-gray-700">
                            <Pencil className="h-4 w-4" />
                        </button>
                    </DialogTrigger>

                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Editar mensagem</DialogTitle>
                        </DialogHeader>

                        <Textarea
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            rows={4}
                        />

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsEditOpen(false)}>
                                Cancelar
                            </Button>
                            <Button
                                onClick={async () => {
                                    setIsSubmitting(true);
                                    await onEdit(message.id, editValue.trim());
                                    setIsSubmitting(false);
                                    setIsEditOpen(false);
                                }}
                                disabled={!editValue.trim() || isSubmitting}
                            >
                                Salvar
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
};

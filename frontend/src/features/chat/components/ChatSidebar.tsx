import { useEffect, useMemo, useRef, useState } from "react";
import {
    Archive,
    CheckCheck,
    ChevronDown,
    Circle,
    Filter,
    MessageCircle,
    MoreVertical,
    Pin,
    Plus,
    Search,
    Smartphone,
    Volume2,
    VolumeX,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useConversationAvatar } from "../hooks/useConversationAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { ConversationSummary } from "../types";
import { formatConversationTimestamp, normalizeText } from "../utils/format";

type FilterTab = "all" | "unread" | "favorites" | "groups";

function SidebarConversationAvatar({
    conversationId,
    avatar,
    name,
}: {
    conversationId: string;
    avatar: string | undefined | null;
    name?: string | null;
}) {
    const resolvedUrl = useConversationAvatar(conversationId, avatar);
    const initials = (name ?? "")
        .replace(/@.*$/, "")
        .trim()
        .slice(0, 2)
        .toUpperCase() || "?";
    return (
        <Avatar className="h-12 w-12 shrink-0 ring-2 ring-white dark:ring-slate-900 shadow-sm">
            {resolvedUrl && (
                <AvatarImage src={resolvedUrl} alt={name ?? ""} className="object-cover" referrerPolicy="no-referrer" />
            )}
            <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-sm font-bold text-primary-foreground">
                {initials}
            </AvatarFallback>
        </Avatar>
    );
}

interface ChatSidebarProps {
    conversations: ConversationSummary[];
    activeConversationId?: string;
    searchValue: string;
    onSearchChange: (value: string) => void;
    responsibleFilter: string;
    responsibleOptions: { id: string; name: string }[];
    onResponsibleFilterChange: (value: string) => void;
    onSelectConversation: (conversationId: string) => void;
    onNewConversation: () => void;
    searchInputRef: React.RefObject<HTMLInputElement>;
    loading?: boolean;
    hasMore?: boolean;
    onLoadMore?: () => void;
    isLoadingMore?: boolean;
    allowUnassignedFilter?: boolean;
    isResponsibleFilterLocked?: boolean;
    isOpen?: boolean;
    onToggleMute?: (conversation: ConversationSummary) => void;
    onToggleArchive?: (conversation: ConversationSummary) => void;
    onTogglePin?: (conversation: ConversationSummary) => void;
    onMarkUnread?: (conversation: ConversationSummary) => void;
    onDeleteConversation?: (conversation: ConversationSummary) => void;
    isWhatsappConnected?: boolean;
}

export const ChatSidebar = ({
    conversations,
    activeConversationId,
    searchValue,
    onSearchChange,
    responsibleFilter,
    responsibleOptions,
    onResponsibleFilterChange,
    onSelectConversation,
    onNewConversation,
    searchInputRef,
    loading = false,
    hasMore = false,
    onLoadMore,
    isLoadingMore = false,
    allowUnassignedFilter = true,
    isResponsibleFilterLocked = false,
    isOpen = true,
    onToggleMute,
    onToggleArchive,
    onTogglePin,
    onMarkUnread,
    onDeleteConversation,
    isWhatsappConnected = true,
}: ChatSidebarProps) => {
    const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
    const [activeTab, setActiveTab] = useState<FilterTab>("all");
    const loadMoreRef = useRef<HTMLDivElement | null>(null);
    const focusChangeByKeyboardRef = useRef(false);

    const filtered = useMemo(() => {
        const normalizedQuery = normalizeText(searchValue);

        // First filter by responsible
        let result = conversations.filter((conversation) => {
            if (responsibleFilter === "all") return true;
            if (responsibleFilter === "unassigned") return !conversation.responsible;
            return conversation.responsible?.id === responsibleFilter;
        });

        // Then filter by tab
        if (activeTab === "unread") {
            result = result.filter((c) => c.unreadCount > 0);
        } else if (activeTab === "favorites") {
            result = result.filter((c) => c.pinned);
        } else if (activeTab === "groups") {
            result = result.filter((c) => {
                const metadata = c.metadata as Record<string, unknown> | undefined;
                return metadata?.wa_isGroup === true || 
                    c.waChatId?.endsWith("@g.us") || 
                    c.waChatId?.endsWith("@broadcast");
            });
        }

        if (!normalizedQuery) {
            return result;
        }

        return result.filter((conversation) => {
            const normalizedName = normalizeText(conversation.name);
            const normalizedDescription = normalizeText(conversation.description ?? "");
            const lastMessage = conversation.lastMessage?.preview
                ? normalizeText(conversation.lastMessage.preview)
                : "";

            return (
                normalizedName.includes(normalizedQuery) ||
                normalizedDescription.includes(normalizedQuery) ||
                lastMessage.includes(normalizedQuery)
            );
        });
    }, [conversations, searchValue, responsibleFilter, activeTab]);

    const tabs: { id: FilterTab; label: string; icon?: React.ReactNode }[] = [
        { id: "all", label: "Tudo" },
        { id: "unread", label: "Não lidas" },
        { id: "favorites", label: "Favoritas" },
        { id: "groups", label: "Grupos" },
    ];

    useEffect(() => {
        if (!filtered.length) {
            setFocusedIndex(null);
            return;
        }
        if (activeConversationId) {
            const index = filtered.findIndex(
                (conversation) => conversation.id === activeConversationId,
            );
            if (index >= 0) {
                setFocusedIndex(index);
                return;
            }
        }
        setFocusedIndex(0);
    }, [activeConversationId, filtered]);

    // Só faz scroll quando o usuário navega com teclado (ArrowUp/Down), não quando a lista reordena.
    // Isso evita o bug de a conversa "pular para o topo" ao receber nova mensagem.
    useEffect(() => {
        if (focusedIndex === null || !focusChangeByKeyboardRef.current) return;
        focusChangeByKeyboardRef.current = false;
        const conversation = filtered[focusedIndex];
        if (!conversation) return;
        const element = document.getElementById(
            `conversation-item-${conversation.id}`,
        );
        element?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, [focusedIndex, filtered]);

    useEffect(() => {
        if (!onLoadMore || !hasMore) {
            return;
        }
        const element = loadMoreRef.current;
        if (!element) return;

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting && hasMore && !isLoadingMore) {
                    onLoadMore();
                }
            });
        });
        observer.observe(element);
        return () => observer.disconnect();
    }, [hasMore, isLoadingMore, onLoadMore]);

    const handleKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (event) => {
        if (!filtered.length) return;

        if (event.key === "ArrowDown") {
            event.preventDefault();
            focusChangeByKeyboardRef.current = true;
            setFocusedIndex((current) => {
                const next = current === null ? 0 : Math.min(filtered.length - 1, current + 1);
                return next;
            });
        } else if (event.key === "ArrowUp") {
            event.preventDefault();
            focusChangeByKeyboardRef.current = true;
            setFocusedIndex((current) => {
                const next = current === null ? 0 : Math.max(0, current - 1);
                return next;
            });
        } else if (event.key === "Enter" && focusedIndex !== null) {
            event.preventDefault();
            const conversation = filtered[focusedIndex];
            if (conversation) {
                onSelectConversation(conversation.id);
            }
        }
    };

    return (
        <aside
            className={cn(
                "relative z-10 flex h-full w-full max-w-md flex-col border-r border-border/40 transition-all duration-300 md:w-[380px]",
                isOpen ? "flex" : "hidden md:flex"
            )}
            aria-label="Lista de conversas"
        >
            {/* Header - estilo WhatsApp Web */}
            <div data-sidebar-header className="flex items-center justify-between px-4 py-3.5 border-b border-border/20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm">
                <h2 className="text-[1.125rem] font-semibold tracking-tight text-foreground">
                    Conversas
                </h2>
                {isWhatsappConnected && (
                    <div className="flex items-center gap-0.5">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 rounded-full text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all duration-200"
                            onClick={onNewConversation}
                            title="Nova conversa"
                        >
                            <Plus size={20} />
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-9 w-9 rounded-full text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-all duration-200"
                                >
                                    <MoreVertical size={20} />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52 rounded-xl shadow-lg border-border/50">
                                <DropdownMenuItem disabled className="text-sm">Status do sistema</DropdownMenuItem>
                                <DropdownMenuItem disabled className="text-sm">Configurações</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                )}
            </div>

            {/* Tabs - Modern pill style (hidden when disconnected) */}
            {isWhatsappConnected && (
                <div className="flex items-center gap-1.5 px-3 py-2.5 border-b border-border/20 overflow-x-auto scrollbar-hide">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={cn(
                                "shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 relative",
                                activeTab === tab.id
                                    ? "bg-primary text-primary-foreground shadow-sm"
                                    : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                            )}
                        >
                            {tab.label}
                        </button>
                    ))}

                    {/* Responsible filter dropdown */}
                    {!isResponsibleFilterLocked && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button className={cn(
                                    "ml-auto shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all duration-200",
                                    responsibleFilter !== "all" 
                                        ? "bg-primary/10 text-primary" 
                                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                                )}>
                                    <Filter size={14} />
                                    <ChevronDown size={14} />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52 rounded-xl shadow-lg border-border/50">
                                <DropdownMenuItem onClick={() => onResponsibleFilterChange("all")} className={cn(responsibleFilter === "all" && "bg-primary/10 text-primary")}>
                                    Todas as conversas
                                </DropdownMenuItem>
                                {allowUnassignedFilter && (
                                    <DropdownMenuItem onClick={() => onResponsibleFilterChange("unassigned")} className={cn(responsibleFilter === "unassigned" && "bg-primary/10 text-primary")}>
                                        Sem responsável
                                    </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                {responsibleOptions.map((opt) => (
                                    <DropdownMenuItem key={opt.id} onClick={() => onResponsibleFilterChange(opt.id)} className={cn(responsibleFilter === opt.id && "bg-primary/10 text-primary")}>
                                        {opt.name}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </div>
            )}

            {/* Search - Modern floating style (hidden when disconnected) */}
            {isWhatsappConnected && (
                <div className="px-3 py-2.5">
                    <div className="relative group">
                        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50 transition-all duration-200 group-focus-within:text-primary group-focus-within:scale-110" />
                        <Input
                            ref={searchInputRef}
                            value={searchValue}
                            onChange={(e) => onSearchChange(e.target.value)}
                            placeholder="Pesquisar ou começar uma nova conversa"
                            className="h-10 rounded-xl bg-muted/50 pl-10 pr-4 border-0 text-sm placeholder:text-muted-foreground/50 focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:bg-white dark:focus-visible:bg-slate-800 transition-all duration-200 shadow-sm"
                        />
                    </div>
                </div>
            )}

            {/* Conversation List */}
            <div
                className="flex-1 overflow-y-auto scrollbar-thin"
                role="listbox"
                tabIndex={0}
                onKeyDown={handleKeyDown}
            >
                {!isWhatsappConnected ? (
                    <div className="flex flex-col items-center justify-center h-full py-12 px-6 text-center animate-fade-in">
                        <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-emerald-100 to-emerald-50 dark:from-emerald-900/30 dark:to-emerald-800/20 shadow-inner">
                            <Smartphone className="h-12 w-12 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <h3 className="text-lg font-semibold text-foreground mb-2">
                            WhatsApp Web
                        </h3>
                        <p className="text-sm text-muted-foreground max-w-[260px] leading-relaxed">
                            Conecte seu WhatsApp para visualizar suas conversas e começar a atender seus clientes.
                        </p>
                        <div className="mt-6 flex flex-col gap-2 text-xs text-muted-foreground/70">
                            <div className="flex items-center gap-2">
                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-bold">1</span>
                                <span>Abra o WhatsApp no celular</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-bold">2</span>
                                <span>Toque em Dispositivos Conectados</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-bold">3</span>
                                <span>Escaneie o QR Code ao lado</span>
                            </div>
                        </div>
                    </div>
                ) : loading ? (
                    <div className="flex flex-col items-center justify-center py-20 text-muted-foreground animate-fade-in">
                        <div className="relative">
                            <Circle className="h-10 w-10 animate-pulse text-primary/30" />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="h-5 w-5 rounded-full border-2 border-primary/40 border-t-primary animate-spin" />
                            </div>
                        </div>
                        <span className="mt-4 text-sm font-medium text-muted-foreground/70">Carregando conversas...</span>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 px-8 text-center animate-fade-in">
                        <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-muted/60 to-muted/30 shadow-inner">
                            <MessageCircle className="h-10 w-10 text-muted-foreground/30" />
                        </div>
                        <p className="text-base font-semibold text-foreground/70">
                            Nenhuma conversa encontrada
                        </p>
                        <p className="mt-2 text-sm text-muted-foreground/60 max-w-[200px]">
                            {activeTab !== "all" ? "Tente mudar o filtro selecionado" : "Clique em + para iniciar uma nova conversa"}
                        </p>
                    </div>
                ) : (
                    <div className="py-1">
                        {filtered.map((conversation, index) => {
                            const isActive = conversation.id === activeConversationId;
                            const isFocused = index === focusedIndex;
                            const preview = conversation.lastMessage?.preview ?? "Inicie a conversa";
                            const timestamp = conversation.lastMessage?.timestamp
                                ? formatConversationTimestamp(conversation.lastMessage.timestamp)
                                : "";
                            const hasUnread = conversation.unreadCount > 0;
                            const isFromMe = conversation.lastMessage?.sender === "me";

                            return (
                                <div
                                    key={conversation.id}
                                    id={`conversation-item-${conversation.id}`}
                                    className={cn(
                                        "group relative flex w-full cursor-pointer items-center gap-3 px-3 py-3 mx-1.5 rounded-xl transition-all duration-200",
                                        isActive
                                            ? "bg-primary/10 dark:bg-primary/20 shadow-sm"
                                            : "hover:bg-muted/70 dark:hover:bg-muted/50",
                                        isFocused && !isActive && "bg-muted/50 ring-1 ring-primary/20"
                                    )}
                                    style={{ width: 'calc(100% - 12px)' }}
                                    onClick={() => onSelectConversation(conversation.id)}
                                >
                                    {/* Avatar com fallback para iniciais quando não houver imagem válida */}
                                    <div className="relative shrink-0">
                                        <SidebarConversationAvatar
                                            conversationId={conversation.id}
                                            avatar={conversation.avatar}
                                            name={conversation.name}
                                        />
                                        {hasUnread && (
                                            <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-primary ring-2 ring-white dark:ring-slate-900" />
                                        )}
                                    </div>

                                    {/* Content */}
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center justify-between gap-2 mb-1">
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                <span className={cn(
                                                    "truncate text-[15px]",
                                                    hasUnread ? "font-semibold text-foreground" : "font-medium text-foreground/90"
                                                )}>
                                                    {conversation.name}
                                                </span>
                                                {conversation.muted && (
                                                    <VolumeX size={13} className="shrink-0 text-muted-foreground/40" />
                                                )}
                                            </div>
                                            <span className={cn(
                                                "shrink-0 text-[11px] font-medium",
                                                hasUnread ? "text-primary" : "text-muted-foreground/70"
                                            )}>
                                                {timestamp}
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between gap-2">
                                            <p className={cn(
                                                "flex-1 truncate text-[13px] leading-snug",
                                                hasUnread ? "text-foreground/80 font-medium" : "text-muted-foreground/80"
                                            )}>
                                                {isFromMe && (
                                                    <span className="inline-flex items-center mr-1 align-middle">
                                                        <CheckCheck size={15} className="text-primary/60" />
                                                    </span>
                                                )}
                                                {preview}
                                            </p>
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                {conversation.pinned && (
                                                    <Pin size={12} className="text-primary/50 rotate-45" />
                                                )}
                                                {hasUnread && (
                                                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground shadow-sm">
                                                        {conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Dropdown menu on hover - floating style */}
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 scale-95 transition-all duration-200 group-hover:opacity-100 group-hover:scale-100">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    variant="secondary"
                                                    size="icon"
                                                    className="h-7 w-7 rounded-lg shadow-md hover:shadow-lg transition-shadow"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <ChevronDown className="h-4 w-4" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end" className="w-48 rounded-xl shadow-lg border-border/50">
                                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onToggleArchive?.(conversation); }}>
                                                    <Archive size={16} className="mr-2 text-muted-foreground" />
                                                    {conversation.archived ? "Desarquivar" : "Arquivar"}
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onTogglePin?.(conversation); }}>
                                                    <Pin size={16} className="mr-2 text-muted-foreground" />
                                                    {conversation.pinned ? "Desafixar" : "Fixar"}
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onToggleMute?.(conversation); }}>
                                                    {conversation.muted ? <Volume2 size={16} className="mr-2 text-muted-foreground" /> : <VolumeX size={16} className="mr-2 text-muted-foreground" />}
                                                    {conversation.muted ? "Ativar som" : "Silenciar"}
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onMarkUnread?.(conversation); }}>
                                                    <MessageCircle size={16} className="mr-2 text-muted-foreground" />
                                                    Marcar como não lida
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    className="text-destructive focus:text-destructive focus:bg-destructive/10"
                                                    onClick={(e) => { e.stopPropagation(); onDeleteConversation?.(conversation); }}
                                                >
                                                    <Archive size={16} className="mr-2" />
                                                    Apagar conversa
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </div>
                            );
                        })}

                        {/* Load more */}
                        {onLoadMore && (hasMore || isLoadingMore) && (
                            <div className="py-4 text-center">
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={isLoadingMore}
                                    onClick={onLoadMore}
                                    className="text-xs font-medium text-muted-foreground hover:text-foreground"
                                >
                                    {isLoadingMore ? (
                                        <>
                                            <Circle className="mr-2 h-3 w-3 animate-spin" />
                                            Carregando...
                                        </>
                                    ) : (
                                        "Carregar mais conversas"
                                    )}
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </aside>
    );
};

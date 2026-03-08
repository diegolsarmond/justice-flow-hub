import { useCallback, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
    AlertTriangle,
    ArrowLeftRight,
    ChevronDown,
    Crown,
    Loader2,
    LogOut,
    Settings,
    User,
    Sparkles,
    CreditCard,
    Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ModeToggle } from "@/components/ui/mode-toggle";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { IntimacaoMenu } from "@/components/notifications/IntimacaoMenu";
import { useAuth } from "@/features/auth/AuthProvider";
import { hasAdminAccess } from "@/features/auth/adminAccess";
import { usePlan } from "@/features/plans/PlanProvider";
import { getPlanDisplayName } from "@/features/plans/planVisuals";
import { routes } from "@/config/routes";
import { useQuery } from "@tanstack/react-query";
import { fetchMeuPerfil } from "@/services/meuPerfil";
import { cn } from "@/lib/utils";

const getInitials = (name: string | undefined) => {
    if (!name) {
        return "--";
    }

    const parts = name
        .split(/\s+/u)
        .filter(Boolean)
        .slice(0, 2);

    if (parts.length === 0) {
        return name.slice(0, 2).toUpperCase();
    }

    return parts
        .map((part) => part.charAt(0).toUpperCase())
        .join("");
};

interface PlanBadgeProps {
    plan: ReturnType<typeof usePlan>["plan"];
    isLoading: boolean;
    error: string | null;
    onClick?: () => void;
}

const PlanBadge = ({ plan, isLoading, error, onClick }: PlanBadgeProps) => {
    const statusLabel = isLoading
        ? "Carregando..."
        : error
            ? "Erro"
            : getPlanDisplayName(plan);

    // Determina o gradiente baseado no tipo de plano
    const planName = plan?.nome?.toLowerCase() ?? "";
    const isPremium = planName.includes("premium") || planName.includes("enterprise") || planName.includes("completo");
    const isPro = planName.includes("pro") || planName.includes("profissional");

    const gradientClass = isPremium
        ? "from-amber-500 via-yellow-500 to-orange-500"
        : isPro
            ? "from-violet-500 via-purple-500 to-fuchsia-500"
            : "from-blue-500 via-cyan-500 to-teal-500";

    const iconClass = isPremium
        ? "text-amber-300"
        : isPro
            ? "text-violet-300"
            : "text-blue-300";

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <button
                        onClick={onClick}
                        className={cn(
                            "group relative flex items-center gap-2 overflow-hidden",
                            "rounded-full px-4 py-2 text-sm font-semibold text-white",
                            "bg-gradient-to-r shadow-lg transition-all duration-300",
                            "hover:scale-[1.03] hover:shadow-xl active:scale-[0.98]",
                            "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 focus:ring-offset-background",
                            gradientClass
                        )}
                    >
                        {/* Efeito de brilho */}
                        <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 opacity-0 transition-opacity group-hover:opacity-100" />

                        {isLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : error ? (
                            <AlertTriangle className="h-4 w-4" />
                        ) : isPremium ? (
                            <Crown className={cn("h-4 w-4", iconClass)} />
                        ) : (
                            <Sparkles className={cn("h-4 w-4", iconClass)} />
                        )}

                        <span className="relative whitespace-nowrap">{statusLabel}</span>
                    </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                    <p className="text-sm">Clique para gerenciar seu plano</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
};

export function HeaderActions() {
    const navigate = useNavigate();
    const location = useLocation();

    const { user, logout } = useAuth();
    const { plan, isLoading, error } = usePlan();
    const { data: profile } = useQuery({
        queryKey: ["meu-perfil", "header"],
        queryFn: () => fetchMeuPerfil(),
        enabled: Boolean(user),
        staleTime: 5 * 60 * 1000,
    });

    const canAccessConfiguracoes =
        user?.modulos?.some((moduleId) => moduleId === "configuracoes" || moduleId.startsWith("configuracoes-")) ?? false;

    const isOnAdminArea = useMemo(() => {
        const adminRoot = routes.admin.root;
        return location.pathname === adminRoot || location.pathname.startsWith(`${adminRoot}/`);
    }, [location.pathname]);

    const profileToggleLabel = isOnAdminArea ? "Voltar ao CRM" : "Painel Admin";

    const canToggleAdmin = useMemo(
        () => hasAdminAccess(user) && user?.empresa_id === 1,
        [user],
    );

    const handleProfileToggle = useCallback(() => {
        if (isOnAdminArea) {
            navigate(routes.dashboard, { replace: true });
            return;
        }
        navigate(routes.admin.dashboard, { replace: true });
    }, [isOnAdminArea, navigate]);

    const handleLogout = useCallback(() => {
        logout();
        navigate(routes.login, { replace: true });
    }, [logout, navigate]);

    const avatarAlt = profile?.name ?? user?.nome_completo ?? "Usuário";
    const avatarSrc = profile?.avatarUrl?.trim() ? profile.avatarUrl : undefined;
    const companyName = user?.empresa_nome?.trim();
    const userName = profile?.name ?? user?.nome_completo ?? "Usuário";
    const userEmail = profile?.email ?? user?.email ?? "";

    const handlePlanClick = () => {
        navigate(routes.meuPlano);
    };

    return (
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2 sm:gap-3">
            {/* Plano com design premium */}
            <div className="hidden sm:block">
                <PlanBadge
                    plan={plan}
                    isLoading={isLoading}
                    error={error}
                    onClick={handlePlanClick}
                />
            </div>

            {/* Separador visual */}
            <div className="hidden h-6 w-px bg-border/50 sm:block" />

            {/* Toggle de tema */}
            <ModeToggle />

            {/* Menu de notificações */}
            <IntimacaoMenu />

            {/* Separador visual */}
            <div className="hidden h-6 w-px bg-border/50 sm:block" />

            {/* Menu do usuário */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        className={cn(
                            "group flex min-w-0 items-center gap-2.5 rounded-full px-2 py-1.5",
                            "transition-all duration-200 hover:bg-muted/80",
                            "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:ring-offset-1 focus:ring-offset-background"
                        )}
                    >
                        {/* Avatar com anel de status */}
                        <div className="relative">
                            <Avatar className="h-9 w-9 ring-2 ring-primary/20 ring-offset-1 ring-offset-background transition-all group-hover:ring-primary/40">
                                <AvatarImage src={avatarSrc} alt={avatarAlt} className="object-cover" />
                                <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-sm font-semibold text-primary-foreground">
                                    {getInitials(user?.nome_completo)}
                                </AvatarFallback>
                            </Avatar>
                            {/* Indicador online */}
                            <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-background" />
                        </div>

                        {/* Info do usuário */}
                        <div className="hidden min-w-0 text-left lg:block">
                            <p className="max-w-[140px] truncate text-sm font-semibold leading-tight text-foreground">
                                {userName}
                            </p>
                            <p className="max-w-[140px] truncate text-xs text-muted-foreground">
                                {companyName && companyName.length > 0 ? companyName : userEmail}
                            </p>
                        </div>

                        {/* Ícone de dropdown */}
                        <ChevronDown className="hidden h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180 lg:block" />
                    </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                    align="end"
                    className="w-64 overflow-hidden rounded-xl border border-border/50 bg-popover/95 p-0 shadow-xl backdrop-blur-sm"
                    sideOffset={8}
                >
                    {/* Header do menu com info do usuário */}
                    <div className="border-b border-border/50 bg-muted/30 px-4 py-3">
                        <div className="flex items-center gap-3">
                            <Avatar className="h-11 w-11 ring-2 ring-primary/20">
                                <AvatarImage src={avatarSrc} alt={avatarAlt} className="object-cover" />
                                <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-sm font-semibold text-primary-foreground">
                                    {getInitials(user?.nome_completo)}
                                </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-foreground">{userName}</p>
                                <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
                            </div>
                        </div>
                    </div>

                    {/* Plano (visível em mobile) */}
                    <div className="border-b border-border/50 p-2 sm:hidden">
                        <button
                            onClick={handlePlanClick}
                            className="flex w-full items-center gap-3 rounded-lg bg-gradient-to-r from-primary/10 to-primary/5 px-3 py-2.5 text-left transition-colors hover:from-primary/15 hover:to-primary/10"
                        >
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                                <Crown className="h-4 w-4 text-primary" />
                            </div>
                            <div className="flex-1">
                                <p className="text-xs font-medium text-muted-foreground">Seu plano</p>
                                <p className="text-sm font-semibold text-foreground">{getPlanDisplayName(plan)}</p>
                            </div>
                        </button>
                    </div>

                    {/* Ações principais */}
                    <div className="p-2">
                        <DropdownMenuItem
                            onSelect={(event) => {
                                event.preventDefault();
                                navigate("/meu-perfil");
                            }}
                            className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors focus:bg-muted"
                        >
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                                <User className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div>
                                <p className="font-medium">Meu Perfil</p>
                                <p className="text-xs text-muted-foreground">Editar informações pessoais</p>
                            </div>
                        </DropdownMenuItem>

                        <DropdownMenuItem
                            onSelect={(event) => {
                                event.preventDefault();
                                navigate(routes.meuPlano);
                            }}
                            className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors focus:bg-muted"
                        >
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                                <CreditCard className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div>
                                <p className="font-medium">Meu Plano</p>
                                <p className="text-xs text-muted-foreground">Gerenciar assinatura</p>
                            </div>
                        </DropdownMenuItem>

                        {canAccessConfiguracoes && (
                            <DropdownMenuItem
                                onSelect={(event) => {
                                    event.preventDefault();
                                    navigate("/configuracoes");
                                }}
                                className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors focus:bg-muted"
                            >
                                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                                    <Settings className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <div>
                                    <p className="font-medium">Configurações</p>
                                    <p className="text-xs text-muted-foreground">Ajustes do sistema</p>
                                </div>
                            </DropdownMenuItem>
                        )}

                        {canToggleAdmin && (
                            <>
                                <DropdownMenuSeparator className="my-2" />
                                <DropdownMenuItem
                                    onSelect={(event) => {
                                        event.preventDefault();
                                        handleProfileToggle();
                                    }}
                                    className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors focus:bg-muted"
                                >
                                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
                                        <Shield className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                                    </div>
                                    <div>
                                        <p className="font-medium">{profileToggleLabel}</p>
                                        <p className="text-xs text-muted-foreground">
                                            {isOnAdminArea ? "Retornar ao CRM" : "Acessar painel administrativo"}
                                        </p>
                                    </div>
                                </DropdownMenuItem>
                            </>
                        )}
                    </div>

                    {/* Ação de logout */}
                    <div className="border-t border-border/50 bg-muted/20 p-2">
                        <DropdownMenuItem
                            onSelect={(event) => {
                                event.preventDefault();
                                handleLogout();
                            }}
                            className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-destructive transition-colors hover:bg-destructive/10 focus:bg-destructive/10 focus:text-destructive"
                        >
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10">
                                <LogOut className="h-4 w-4" />
                            </div>
                            <div>
                                <p className="font-medium">Sair da conta</p>
                                <p className="text-xs opacity-70">Encerrar sessão</p>
                            </div>
                        </DropdownMenuItem>
                    </div>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
}

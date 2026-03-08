import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
    X,
    AlertTriangle,
    Clock,
    CreditCard,
    Timer,
    Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { routes } from "@/config/routes";
import { SUBSCRIPTION_TRIAL_DAYS } from "@/config/subscription";
import { resolveGraceDeadline } from "./subscriptionStatus";

import { useAuth } from "./AuthProvider";

const STORAGE_KEY_PREFIX = "jus-connect:subscription-banner:dismissed";
const MILLISECONDS_IN_DAY = 24 * 60 * 60 * 1000;

type BannerType = "trial" | "grace" | "overdue" | "expired" | null;

interface CountdownParts {
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    totalMs: number;
}

const getStorageKey = (type: BannerType) => `${STORAGE_KEY_PREFIX}:${type}`;

const readDismissedFlag = (type: BannerType): boolean => {
    if (typeof window === "undefined" || !type) {
        return false;
    }

    try {
        const key = getStorageKey(type);
        const sessionValue = window.sessionStorage.getItem(key);
        if (sessionValue !== null) {
            return sessionValue === "true";
        }
    } catch {
        // Ignored
    }

    return false;
};

const persistDismissal = (type: BannerType) => {
    if (typeof window === "undefined" || !type) {
        return;
    }

    try {
        window.sessionStorage.setItem(getStorageKey(type), "true");
    } catch {
        // Ignore
    }
};

const getRemainingMilliseconds = (targetDate: Date): number => {
    return Math.max(targetDate.getTime() - Date.now(), 0);
};

const parseCountdown = (remainingMs: number): CountdownParts => {
    const totalSeconds = Math.floor(remainingMs / 1000);
    const secondsPerMinute = 60;
    const secondsPerHour = 60 * secondsPerMinute;
    const secondsPerDay = 24 * secondsPerHour;

    const days = Math.floor(totalSeconds / secondsPerDay);
    const hours = Math.floor((totalSeconds % secondsPerDay) / secondsPerHour);
    const minutes = Math.floor(
        (totalSeconds % secondsPerHour) / secondsPerMinute
    );
    const seconds = totalSeconds % secondsPerMinute;

    return { days, hours, minutes, seconds, totalMs: remainingMs };
};

interface CountdownDisplayProps {
    countdown: CountdownParts;
    urgency: "low" | "medium" | "high" | "critical";
}

function CountdownDisplay({ countdown, urgency }: CountdownDisplayProps) {
    const { days, hours, minutes, seconds } = countdown;

    const unitClass = cn(
        "flex flex-col items-center justify-center rounded-lg px-2 py-1 min-w-[3rem] transition-all duration-300",
        {
            "bg-amber-500/20 text-amber-100": urgency === "low",
            "bg-orange-500/30 text-orange-100": urgency === "medium",
            "bg-red-500/30 text-red-100": urgency === "high",
            "bg-red-600/40 text-white animate-pulse": urgency === "critical",
        }
    );

    const numberClass = cn("text-lg font-bold tabular-nums", {
        "text-xl": urgency === "critical",
    });

    const labelClass = "text-[10px] uppercase tracking-wider opacity-80";

    return (
        <div className="flex items-center gap-1.5">
            <Timer
                className={cn("h-4 w-4 mr-1", {
                    "animate-bounce": urgency === "critical",
                })}
            />
            {days > 0 && (
                <div className={unitClass}>
                    <span className={numberClass}>{days}</span>
                    <span className={labelClass}>dias</span>
                </div>
            )}
            <div className={unitClass}>
                <span className={numberClass}>{hours.toString().padStart(2, "0")}</span>
                <span className={labelClass}>horas</span>
            </div>
            <div className={unitClass}>
                <span className={numberClass}>
                    {minutes.toString().padStart(2, "0")}
                </span>
                <span className={labelClass}>min</span>
            </div>
            {days === 0 && (
                <div className={unitClass}>
                    <span className={numberClass}>
                        {seconds.toString().padStart(2, "0")}
                    </span>
                    <span className={labelClass}>seg</span>
                </div>
            )}
        </div>
    );
}

interface SubscriptionBannerProps {
    className?: string;
}

export function SubscriptionBanner({ className }: SubscriptionBannerProps) {
    const { user } = useAuth();
    const location = useLocation();
    const subscription = user?.subscription ?? null;
    const status = subscription?.status ?? null;

    const isCompanyResponsible =
        typeof user?.id === "number" &&
        typeof user?.empresa_responsavel_id === "number" &&
        user.id === user.empresa_responsavel_id;

    const bannerType: BannerType = useMemo(() => {
        if (!subscription || !status) {
            return null;
        }

        switch (status) {
            case "trialing":
                return "trial";
            case "grace_period":
            case "grace":
            case "past_due":
                return "grace";
            case "overdue":
            case "expired":
                return "expired";
            case "inactive":
                return "overdue";
            default:
                return null;
        }
    }, [subscription, status]);

    const targetDate = useMemo(() => {
        if (!subscription) {
            return null;
        }

        if (bannerType === "trial") {
            const candidates = [
                subscription.trialEndsAt,
                subscription.currentPeriodEnd,
                subscription.graceEndsAt,
            ];
            for (const candidate of candidates) {
                if (!candidate) continue;
                const parsed = new Date(candidate);
                if (!Number.isNaN(parsed.getTime())) {
                    return parsed;
                }
            }

            if (subscription.startedAt) {
                const startedAt = new Date(subscription.startedAt);
                if (!Number.isNaN(startedAt.getTime())) {
                    return new Date(
                        startedAt.getTime() + SUBSCRIPTION_TRIAL_DAYS * MILLISECONDS_IN_DAY
                    );
                }
            }
        }

        if (bannerType === "grace") {
            return resolveGraceDeadline(subscription);
        }

        return null;
    }, [bannerType, subscription]);

    const [isDismissed, setIsDismissed] = useState(() =>
        readDismissedFlag(bannerType)
    );
    const [countdown, setCountdown] = useState<CountdownParts | null>(() => {
        if (!targetDate) return null;
        return parseCountdown(getRemainingMilliseconds(targetDate));
    });

    useEffect(() => {
        setIsDismissed(readDismissedFlag(bannerType));
    }, [bannerType]);

    useEffect(() => {
        if (!targetDate) {
            setCountdown(null);
            return;
        }

        const updateCountdown = () => {
            const remaining = getRemainingMilliseconds(targetDate);
            setCountdown(parseCountdown(remaining));
            return remaining;
        };

        const initial = updateCountdown();
        if (initial <= 0) {
            return;
        }

        const intervalId = window.setInterval(() => {
            const remaining = updateCountdown();
            if (remaining <= 0) {
                window.clearInterval(intervalId);
            }
        }, 1000);

        return () => {
            window.clearInterval(intervalId);
        };
    }, [targetDate]);

    const handleDismiss = useCallback(() => {
        setIsDismissed(true);
        persistDismissal(bannerType);
    }, [bannerType]);

    const urgency: "low" | "medium" | "high" | "critical" = useMemo(() => {
        if (bannerType === "overdue" || bannerType === "expired") {
            return "critical";
        }

        if (!countdown) {
            return "high";
        }

        if (countdown.days > 7) return "low";
        if (countdown.days > 3) return "medium";
        if (countdown.days > 0) return "high";
        return "critical";
    }, [bannerType, countdown]);

    const config = useMemo(() => {
        switch (bannerType) {
            case "trial":
                return {
                    Icon: Sparkles,
                    gradient:
                        urgency === "low"
                            ? "from-amber-500 via-amber-600 to-orange-600"
                            : urgency === "medium"
                                ? "from-orange-500 via-orange-600 to-red-500"
                                : "from-red-500 via-red-600 to-rose-600",
                    title:
                        urgency === "critical"
                            ? "⏰ Últimas horas do trial!"
                            : "Período de teste",
                    subtitle:
                        urgency === "critical"
                            ? "Seu acesso será bloqueado em breve. Contrate agora!"
                            : "Aproveite todas as funcionalidades. Contrate para não perder o acesso.",
                    buttonText: "Escolher plano",
                    showCountdown: true,
                };
            case "grace":
                return {
                    Icon: Clock,
                    gradient: "from-red-600 via-red-700 to-rose-800",
                    title: "🚨 Atenção: Pagamento pendente",
                    subtitle:
                        "Sua assinatura está em período de carência. Regularize para não perder o acesso.",
                    buttonText: "Regularizar agora",
                    showCountdown: true,
                };
            case "overdue":
            case "expired":
                return {
                    Icon: AlertTriangle,
                    gradient: "from-red-700 via-red-800 to-red-900",
                    title: "⚠️ Assinatura vencida",
                    subtitle:
                        "Seu acesso está limitado. Regularize o pagamento para continuar usando o sistema.",
                    buttonText: "Regularizar pagamento",
                    showCountdown: false,
                };
            default:
                return null;
        }
    }, [bannerType, urgency]);

    const isOnPlanPage = location.pathname.startsWith("/meu-plano");

    if (!bannerType || !isCompanyResponsible || isOnPlanPage) {
        return null;
    }

    const canDismiss = bannerType === "trial" || bannerType === "grace";

    if (canDismiss && isDismissed) {
        return null;
    }

    if ((bannerType === "trial" || bannerType === "grace") && !countdown) {
        return null;
    }

    if (countdown && countdown.totalMs <= 0) {
        return null;
    }

    if (!config) {
        return null;
    }

    const { Icon, gradient, title, subtitle, buttonText, showCountdown } = config;

    return (
        <div
            className={cn(
                "relative overflow-hidden",
                "bg-gradient-to-r",
                gradient,
                "text-white shadow-lg",
                className
            )}
            role="alert"
            aria-live="polite"
        >
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImRpYWdvbmFsIiB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIHBhdHRlcm5Vbml0cz0idXNlclNwYWNlT25Vc2UiPjxwYXRoIGQ9Ik0tMSwxIGwyLC0yIE0wLDEwIGwxMCwtMTAgTTksMTEgbDIsLTIiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjA1KSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2RpYWdvbmFsKSIvPjwvc3ZnPg==')] opacity-50" />

            <div className="relative flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                <div className="flex items-start gap-3 sm:items-center">
                    <div
                        className={cn(
                            "hidden sm:flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                            urgency === "critical"
                                ? "bg-white/20 animate-pulse"
                                : "bg-white/10"
                        )}
                    >
                        <Icon className="h-5 w-5" />
                    </div>

                    <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm sm:text-base leading-tight">
                            {title}
                        </h3>
                        <p className="text-xs sm:text-sm opacity-90 leading-snug mt-0.5">
                            {subtitle}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3 sm:gap-4">
                    {showCountdown && countdown && (
                        <CountdownDisplay countdown={countdown} urgency={urgency} />
                    )}

                    <div className="flex items-center gap-2">
                        <Button
                            asChild
                            size="sm"
                            className={cn(
                                "font-semibold shadow-md transition-all hover:scale-105",
                                urgency === "critical"
                                    ? "bg-white text-red-700 hover:bg-gray-100"
                                    : "bg-white/20 hover:bg-white/30 text-white border border-white/30"
                            )}
                        >
                            <Link to={routes.meuPlano}>
                                <CreditCard className="h-4 w-4 mr-1.5" />
                                {buttonText}
                            </Link>
                        </Button>

                        {canDismiss && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/10"
                                aria-label="Fechar aviso"
                                onClick={handleDismiss}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {urgency === "critical" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-white/50 to-transparent animate-pulse" />
            )}
        </div>
    );
}

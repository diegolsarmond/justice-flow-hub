import { supabase } from "@/lib/supabase";
import { sanitizeModuleList } from "./moduleUtils";
import type { AuthSubscription, AuthUser, SubscriptionStatus } from "./types";

const sanitizeSubscriptionStatus = (
  value: unknown,
  fallback: SubscriptionStatus,
): SubscriptionStatus => {
  if (typeof value !== "string") return fallback;
  const n = value.trim().toLowerCase();
  if (n === "trial") return "trialing";
  const valid: SubscriptionStatus[] = [
    "active", "trialing", "inactive", "grace_period", "grace",
    "past_due", "overdue", "pending", "expired",
  ];
  return (valid as string[]).includes(n) ? (n as SubscriptionStatus) : fallback;
};

const buildSubscription = (empresa: Record<string, unknown> | null): AuthSubscription | null => {
  if (!empresa) return null;

  const planId = typeof empresa.plano === "number" ? empresa.plano : null;
  const statusFallback: SubscriptionStatus = planId === null ? "inactive" : "active";
  const status = sanitizeSubscriptionStatus(empresa.subscription_status, statusFallback);

  const toIso = (v: unknown) => {
    if (typeof v !== "string" || !v.trim()) return null;
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  };

  return {
    planId,
    status,
    startedAt: toIso(empresa.datacadastro) ?? toIso(empresa.current_period_start),
    trialEndsAt: toIso(empresa.subscription_trial_ends_at) ?? toIso(empresa.trial_ends_at),
    currentPeriodEnd: toIso(empresa.subscription_current_period_ends_at) ?? toIso(empresa.current_period_end),
    graceEndsAt: toIso(empresa.subscription_grace_period_ends_at) ?? toIso(empresa.grace_expires_at),
  };
};

export const fetchUserProfile = async (userId: string): Promise<AuthUser | null> => {
  // 1. fetch profile
  const { data: profile, error: profileError } = await supabase
    .from("profiles" as any)
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (profileError || !profile) {
    console.warn("Failed to fetch profile", profileError);
    return null;
  }

  const p = profile as Record<string, any>;

  // 2. fetch perfil (role) for viewAllConversations
  let viewAllConversations = true;
  if (p.perfil_id) {
    const { data: perfil } = await supabase
      .from("perfis")
      .select("ver_todas_conversas")
      .eq("id", p.perfil_id)
      .maybeSingle();
    if (perfil) {
      viewAllConversations = perfil.ver_todas_conversas ?? true;
    }
  }

  // 3. fetch modulos
  let modulos: string[] = [];
  if (p.perfil_id) {
    const { data: modulosData } = await supabase
      .from("perfil_modulos")
      .select("modulo")
      .eq("perfil_id", p.perfil_id);
    if (modulosData) {
      modulos = sanitizeModuleList(modulosData.map((m: any) => m.modulo));
    }
  }

  // 4. fetch empresa for subscription
  let subscription: AuthSubscription | null = null;
  let empresaNome: string | null = p.empresa_nome ?? null;
  let empresaResponsavelId: number | null = null;
  if (p.empresa_id) {
    const { data: empresa } = await supabase
      .from("empresas")
      .select("*")
      .eq("id", p.empresa_id)
      .maybeSingle();
    if (empresa) {
      subscription = buildSubscription(empresa as Record<string, unknown>);
      empresaNome = empresa.nome_empresa ?? empresaNome;
      empresaResponsavelId = empresa.responsavel ?? null;
    }
  }

  return {
    id: userId,
    nome_completo: p.nome ?? p.email ?? "",
    email: p.email ?? "",
    perfil: p.perfil_id ?? null,
    modulos,
    empresa_id: p.empresa_id ?? null,
    empresa_nome: empresaNome,
    empresa_responsavel_id: empresaResponsavelId,
    setor_id: p.setor_id ?? null,
    setor_nome: p.setor_nome ?? null,
    subscription,
    mustChangePassword: p.must_change_password ?? false,
    viewAllConversations,
  };
};

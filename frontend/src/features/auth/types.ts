export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "inactive"
  | "grace_period"
  | "grace"
  | "past_due"
  | "overdue"
  | "pending"
  | "expired";

export interface AuthSubscription {
  planId: number | null;
  status: SubscriptionStatus;
  startedAt: string | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  graceEndsAt: string | null;
}

export interface AuthUser {
  id: number | string;
  nome_completo: string;
  email: string;
  perfil: number | null;
  status?: boolean | null;
  modulos: string[];
  empresa_id: number | null;
  empresa_nome: string | null;
  empresa_responsavel_id: number | null;
  setor_id: number | null;
  setor_nome: string | null;
  subscription: AuthSubscription | null;
  mustChangePassword: boolean;
  viewAllConversations: boolean;
}

export interface LoginCredentials {
  email: string;
  senha: string;
}

export interface LoginResponse {
  token: string;
  refreshToken?: string;
  expiresIn?: number | null;
  redirectTo?: string | null;
  subscriptionMessage?: string | null;
  user: AuthUser;
}

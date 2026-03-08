export interface Empresa {
    id: number;
    nome_empresa: string;
    cnpj?: string;
    telefone?: string;
    email?: string;
    plano?: number;
    responsavel?: number;
    ativo: boolean;
    datacadastro: string; // ISO timestamp

    // Trial
    trial_started_at?: string;
    trial_ends_at?: string;

    // Legacy subscription fields? Or maybe just simple period tracking
    current_period_start?: string;
    current_period_end?: string;
    grace_expires_at?: string;

    // New Subscription/Asaas fields
    subscription_cadence?: 'monthly' | 'annual';
    subscription_trial_ends_at?: string;
    subscription_current_period_ends_at?: string;
    subscription_grace_period_ends_at?: string;
    asaas_subscription_id?: string;
    asaas_customer_id?: string;
    subscription_status?: 'pending' | 'active' | 'grace' | 'inactive' | 'overdue';
    subscription_pending_plan?: string;
}

export interface Usuario {
    id: number; // ID numérico da tabela (serial)
    nome_completo: string;
    email: string;
    cpf?: string;
    telefone?: string;
    empresa?: number; // Foreign Key to empresas(id)
    status: boolean;
    perfil?: number;
    setor?: number;
    oab?: string;
    ultimo_login?: string;
    datacriacao?: string;
    must_change_password?: boolean;
    auth_user_id?: string; // UUID from Supabase Auth
}

export interface Perfil {
    id: number;
    nome: string;
    ativo: boolean;
    datacriacao: string;
    idempresa?: number;
    ver_todas_conversas: boolean;
}

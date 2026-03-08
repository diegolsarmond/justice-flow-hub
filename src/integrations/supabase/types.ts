export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      clientes: {
        Row: {
          ativo: boolean
          bairro: string | null
          cep: string | null
          cidade: string | null
          complemento: string | null
          datacadastro: string
          documento: string | null
          email: string | null
          id: number
          idempresa: number | null
          idusuario: number | null
          nome: string
          numero: string | null
          rua: string | null
          telefone: string | null
          tipo: string
          uf: string | null
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          datacadastro?: string
          documento?: string | null
          email?: string | null
          id?: number
          idempresa?: number | null
          idusuario?: number | null
          nome: string
          numero?: string | null
          rua?: string | null
          telefone?: string | null
          tipo: string
          uf?: string | null
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          datacadastro?: string
          documento?: string | null
          email?: string | null
          id?: number
          idempresa?: number | null
          idusuario?: number | null
          nome?: string
          numero?: string | null
          rua?: string | null
          telefone?: string | null
          tipo?: string
          uf?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clientes_idempresa_fkey"
            columns: ["idempresa"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          asaas_customer_id: string | null
          asaas_subscription_id: string | null
          ativo: boolean
          cnpj: string | null
          current_period_end: string | null
          current_period_start: string | null
          datacadastro: string
          email: string | null
          grace_expires_at: string | null
          id: number
          nome_empresa: string
          plano: number | null
          responsavel: number | null
          subscription_cadence: string | null
          subscription_current_period_ends_at: string | null
          subscription_grace_period_ends_at: string | null
          subscription_pending_plan: string | null
          subscription_status: string | null
          subscription_trial_ends_at: string | null
          telefone: string | null
          trial_ends_at: string | null
          trial_started_at: string | null
        }
        Insert: {
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          ativo?: boolean
          cnpj?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          datacadastro?: string
          email?: string | null
          grace_expires_at?: string | null
          id?: number
          nome_empresa: string
          plano?: number | null
          responsavel?: number | null
          subscription_cadence?: string | null
          subscription_current_period_ends_at?: string | null
          subscription_grace_period_ends_at?: string | null
          subscription_pending_plan?: string | null
          subscription_status?: string | null
          subscription_trial_ends_at?: string | null
          telefone?: string | null
          trial_ends_at?: string | null
          trial_started_at?: string | null
        }
        Update: {
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          ativo?: boolean
          cnpj?: string | null
          current_period_end?: string | null
          current_period_start?: string | null
          datacadastro?: string
          email?: string | null
          grace_expires_at?: string | null
          id?: number
          nome_empresa?: string
          plano?: number | null
          responsavel?: number | null
          subscription_cadence?: string | null
          subscription_current_period_ends_at?: string | null
          subscription_grace_period_ends_at?: string | null
          subscription_pending_plan?: string | null
          subscription_status?: string | null
          subscription_trial_ends_at?: string | null
          telefone?: string | null
          trial_ends_at?: string | null
          trial_started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "empresas_plano_fkey"
            columns: ["plano"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["id"]
          },
        ]
      }
      perfil_modulos: {
        Row: {
          modulo: string
          perfil_id: number
        }
        Insert: {
          modulo: string
          perfil_id: number
        }
        Update: {
          modulo?: string
          perfil_id?: number
        }
        Relationships: []
      }
      perfis: {
        Row: {
          ativo: boolean
          datacriacao: string
          empresa_id: number | null
          id: number
          idempresa: number | null
          nome: string
          ver_todas_conversas: boolean
        }
        Insert: {
          ativo?: boolean
          datacriacao?: string
          empresa_id?: number | null
          id?: number
          idempresa?: number | null
          nome: string
          ver_todas_conversas?: boolean
        }
        Update: {
          ativo?: boolean
          datacriacao?: string
          empresa_id?: number | null
          id?: number
          idempresa?: number | null
          nome?: string
          ver_todas_conversas?: boolean
        }
        Relationships: []
      }
      planos: {
        Row: {
          ativo: boolean
          datacadastro: string
          id: number
          limite_advogados_intimacao: number | null
          limite_advogados_processos: number | null
          limite_clientes: number | null
          limite_processos: number | null
          limite_propostas: number | null
          limite_usuarios: number | null
          max_propostas: number | null
          modulos: string | null
          modulos_jsonb: Json | null
          nome: string
          recursos: string | null
          sincronizacao_intimacoes_habilitada: boolean | null
          sincronizacao_intimacoes_limite: number | null
          sincronizacao_processos_cota: number | null
          sincronizacao_processos_habilitada: boolean
          sincronizacao_processos_limite: number | null
          valor_anual: number
          valor_mensal: number
        }
        Insert: {
          ativo?: boolean
          datacadastro?: string
          id?: number
          limite_advogados_intimacao?: number | null
          limite_advogados_processos?: number | null
          limite_clientes?: number | null
          limite_processos?: number | null
          limite_propostas?: number | null
          limite_usuarios?: number | null
          max_propostas?: number | null
          modulos?: string | null
          modulos_jsonb?: Json | null
          nome: string
          recursos?: string | null
          sincronizacao_intimacoes_habilitada?: boolean | null
          sincronizacao_intimacoes_limite?: number | null
          sincronizacao_processos_cota?: number | null
          sincronizacao_processos_habilitada?: boolean
          sincronizacao_processos_limite?: number | null
          valor_anual: number
          valor_mensal: number
        }
        Update: {
          ativo?: boolean
          datacadastro?: string
          id?: number
          limite_advogados_intimacao?: number | null
          limite_advogados_processos?: number | null
          limite_clientes?: number | null
          limite_processos?: number | null
          limite_propostas?: number | null
          limite_usuarios?: number | null
          max_propostas?: number | null
          modulos?: string | null
          modulos_jsonb?: Json | null
          nome?: string
          recursos?: string | null
          sincronizacao_intimacoes_habilitada?: boolean | null
          sincronizacao_intimacoes_limite?: number | null
          sincronizacao_processos_cota?: number | null
          sincronizacao_processos_habilitada?: boolean
          sincronizacao_processos_limite?: number | null
          valor_anual?: number
          valor_mensal?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          id: string
          nome: string
          oab_numero: string | null
          oab_uf: string | null
          telefone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nome: string
          oab_numero?: string | null
          oab_uf?: string | null
          telefone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nome?: string
          oab_numero?: string | null
          oab_uf?: string | null
          telefone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      usuarios: {
        Row: {
          ativo: boolean
          auth_user_id: string | null
          cpf: string | null
          datacriacao: string
          email: string
          email_confirmed_at: string | null
          empresa: number
          empresa_id: number | null
          id: number
          must_change_password: boolean | null
          nome_completo: string
          oab: string | null
          observacoes: string | null
          perfil: number
          perfil_id: number | null
          senha: string | null
          setor: number | null
          status: boolean
          telefone: string | null
          ultimo_login: string | null
          welcome_email_pending: boolean
        }
        Insert: {
          ativo?: boolean
          auth_user_id?: string | null
          cpf?: string | null
          datacriacao?: string
          email: string
          email_confirmed_at?: string | null
          empresa: number
          empresa_id?: number | null
          id?: number
          must_change_password?: boolean | null
          nome_completo: string
          oab?: string | null
          observacoes?: string | null
          perfil: number
          perfil_id?: number | null
          senha?: string | null
          setor?: number | null
          status?: boolean
          telefone?: string | null
          ultimo_login?: string | null
          welcome_email_pending?: boolean
        }
        Update: {
          ativo?: boolean
          auth_user_id?: string | null
          cpf?: string | null
          datacriacao?: string
          email?: string
          email_confirmed_at?: string | null
          empresa?: number
          empresa_id?: number | null
          id?: number
          must_change_password?: boolean | null
          nome_completo?: string
          oab?: string | null
          observacoes?: string | null
          perfil?: number
          perfil_id?: number | null
          senha?: string | null
          setor?: number | null
          status?: boolean
          telefone?: string | null
          ultimo_login?: string | null
          welcome_email_pending?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "usuarios_empresa_fkey"
            columns: ["empresa"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuarios_perfil_fkey"
            columns: ["perfil"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      is_office_member: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "advogado" | "estagiario"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "advogado", "estagiario"],
    },
  },
} as const

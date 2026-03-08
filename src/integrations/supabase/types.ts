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
      api_tokens: {
        Row: {
          access_token: string
          created_at: string
          expires_at: string | null
          id: string
          metadata: Json | null
          oab_numero: string | null
          oab_uf: string | null
          provider: string
          refresh_token: string | null
          token_type: string | null
          updated_at: string
        }
        Insert: {
          access_token: string
          created_at?: string
          expires_at?: string | null
          id?: string
          metadata?: Json | null
          oab_numero?: string | null
          oab_uf?: string | null
          provider?: string
          refresh_token?: string | null
          token_type?: string | null
          updated_at?: string
        }
        Update: {
          access_token?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          metadata?: Json | null
          oab_numero?: string | null
          oab_uf?: string | null
          provider?: string
          refresh_token?: string | null
          token_type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      clientes: {
        Row: {
          cep: string | null
          cidade: string | null
          cpf_cnpj: string | null
          created_at: string
          email: string | null
          endereco: string | null
          id: string
          nome: string
          observacoes: string | null
          telefone: string | null
          tipo_pessoa: string
          uf: string | null
          updated_at: string
        }
        Insert: {
          cep?: string | null
          cidade?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          telefone?: string | null
          tipo_pessoa?: string
          uf?: string | null
          updated_at?: string
        }
        Update: {
          cep?: string | null
          cidade?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          telefone?: string | null
          tipo_pessoa?: string
          uf?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      intimacoes: {
        Row: {
          codigo_classe: string | null
          comunicacao_id: number | null
          created_at: string
          data_disponibilizacao: string | null
          destinatario_advogados: Json | null
          destinatarios: Json | null
          hash: string | null
          id: string
          link: string | null
          meio: string | null
          meio_completo: string | null
          nome_classe: string | null
          nome_orgao: string | null
          numero_comunicacao: number | null
          numero_processo: string | null
          processo_id: string | null
          sigla_tribunal: string | null
          status: string | null
          texto: string | null
          tipo_comunicacao: string | null
          tipo_documento: string | null
          updated_at: string
        }
        Insert: {
          codigo_classe?: string | null
          comunicacao_id?: number | null
          created_at?: string
          data_disponibilizacao?: string | null
          destinatario_advogados?: Json | null
          destinatarios?: Json | null
          hash?: string | null
          id?: string
          link?: string | null
          meio?: string | null
          meio_completo?: string | null
          nome_classe?: string | null
          nome_orgao?: string | null
          numero_comunicacao?: number | null
          numero_processo?: string | null
          processo_id?: string | null
          sigla_tribunal?: string | null
          status?: string | null
          texto?: string | null
          tipo_comunicacao?: string | null
          tipo_documento?: string | null
          updated_at?: string
        }
        Update: {
          codigo_classe?: string | null
          comunicacao_id?: number | null
          created_at?: string
          data_disponibilizacao?: string | null
          destinatario_advogados?: Json | null
          destinatarios?: Json | null
          hash?: string | null
          id?: string
          link?: string | null
          meio?: string | null
          meio_completo?: string | null
          nome_classe?: string | null
          nome_orgao?: string | null
          numero_comunicacao?: number | null
          numero_processo?: string | null
          processo_id?: string | null
          sigla_tribunal?: string | null
          status?: string | null
          texto?: string | null
          tipo_comunicacao?: string | null
          tipo_documento?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "intimacoes_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      partes_processo: {
        Row: {
          created_at: string
          documento_numero: string | null
          documento_tipo: string | null
          id: string
          nome: string
          oab_numero: string | null
          oab_uf: string | null
          polo: string | null
          processo_id: string
          representante_cpf: string | null
          representante_nome: string | null
          representante_situacao: string | null
          representante_tipo: string | null
          sigilosa: boolean | null
          tipo_parte: string | null
          tipo_pessoa: string | null
        }
        Insert: {
          created_at?: string
          documento_numero?: string | null
          documento_tipo?: string | null
          id?: string
          nome: string
          oab_numero?: string | null
          oab_uf?: string | null
          polo?: string | null
          processo_id: string
          representante_cpf?: string | null
          representante_nome?: string | null
          representante_situacao?: string | null
          representante_tipo?: string | null
          sigilosa?: boolean | null
          tipo_parte?: string | null
          tipo_pessoa?: string | null
        }
        Update: {
          created_at?: string
          documento_numero?: string | null
          documento_tipo?: string | null
          id?: string
          nome?: string
          oab_numero?: string | null
          oab_uf?: string | null
          polo?: string | null
          processo_id?: string
          representante_cpf?: string | null
          representante_nome?: string | null
          representante_situacao?: string | null
          representante_tipo?: string | null
          sigilosa?: boolean | null
          tipo_parte?: string | null
          tipo_pessoa?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "partes_processo_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
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
      prazos: {
        Row: {
          created_at: string
          data_inicio: string
          data_vencimento: string
          descricao: string
          id: string
          intimacao_id: string | null
          observacoes: string | null
          prioridade: string | null
          processo_id: string | null
          responsavel_id: string | null
          status: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_inicio?: string
          data_vencimento: string
          descricao: string
          id?: string
          intimacao_id?: string | null
          observacoes?: string | null
          prioridade?: string | null
          processo_id?: string | null
          responsavel_id?: string | null
          status?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_inicio?: string
          data_vencimento?: string
          descricao?: string
          id?: string
          intimacao_id?: string | null
          observacoes?: string | null
          prioridade?: string | null
          processo_id?: string | null
          responsavel_id?: string | null
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prazos_intimacao_id_fkey"
            columns: ["intimacao_id"]
            isOneToOne: false
            referencedRelation: "intimacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prazos_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
      }
      processos: {
        Row: {
          advogado_responsavel: string | null
          assunto: string | null
          ativo: boolean | null
          classe_judicial: string | null
          cliente_id: string | null
          created_at: string
          data_distribuicao: string | null
          data_ultimo_movimento: string | null
          grau: string | null
          id: string
          instancia: string | null
          monitorar_processo: boolean | null
          nivel_sigilo: number | null
          numero_cnj: string
          observacoes: string | null
          orgao_julgador: string | null
          permite_peticionar: boolean | null
          status: string | null
          tribunal: string | null
          updated_at: string
          valor_acao: number | null
        }
        Insert: {
          advogado_responsavel?: string | null
          assunto?: string | null
          ativo?: boolean | null
          classe_judicial?: string | null
          cliente_id?: string | null
          created_at?: string
          data_distribuicao?: string | null
          data_ultimo_movimento?: string | null
          grau?: string | null
          id?: string
          instancia?: string | null
          monitorar_processo?: boolean | null
          nivel_sigilo?: number | null
          numero_cnj: string
          observacoes?: string | null
          orgao_julgador?: string | null
          permite_peticionar?: boolean | null
          status?: string | null
          tribunal?: string | null
          updated_at?: string
          valor_acao?: number | null
        }
        Update: {
          advogado_responsavel?: string | null
          assunto?: string | null
          ativo?: boolean | null
          classe_judicial?: string | null
          cliente_id?: string | null
          created_at?: string
          data_distribuicao?: string | null
          data_ultimo_movimento?: string | null
          grau?: string | null
          id?: string
          instancia?: string | null
          monitorar_processo?: boolean | null
          nivel_sigilo?: number | null
          numero_cnj?: string
          observacoes?: string | null
          orgao_julgador?: string | null
          permite_peticionar?: boolean | null
          status?: string | null
          tribunal?: string | null
          updated_at?: string
          valor_acao?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "processos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
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
      tarefas: {
        Row: {
          created_at: string
          data_vencimento: string | null
          descricao: string | null
          id: string
          prioridade: string | null
          processo_id: string | null
          responsavel_id: string | null
          status: string | null
          titulo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_vencimento?: string | null
          descricao?: string | null
          id?: string
          prioridade?: string | null
          processo_id?: string | null
          responsavel_id?: string | null
          status?: string | null
          titulo: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_vencimento?: string | null
          descricao?: string | null
          id?: string
          prioridade?: string | null
          processo_id?: string | null
          responsavel_id?: string | null
          status?: string | null
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tarefas_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "processos"
            referencedColumns: ["id"]
          },
        ]
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

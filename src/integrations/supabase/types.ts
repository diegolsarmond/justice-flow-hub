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
      accounts: {
        Row: {
          agency: string | null
          bank: string | null
          created_at: string | null
          created_by: string | null
          currency: string | null
          id: string
          idempresa: number | null
          initial_balance: number | null
          name: string
          number: string | null
        }
        Insert: {
          agency?: string | null
          bank?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          id?: string
          idempresa?: number | null
          initial_balance?: number | null
          name: string
          number?: string | null
        }
        Update: {
          agency?: string | null
          bank?: string | null
          created_at?: string | null
          created_by?: string | null
          currency?: string | null
          id?: string
          idempresa?: number | null
          initial_balance?: number | null
          name?: string
          number?: string | null
        }
        Relationships: []
      }
      agenda: {
        Row: {
          cliente: number | null
          data: string
          dataatualizacao: string | null
          datacadastro: string
          descricao: string | null
          hora_fim: string | null
          hora_inicio: string | null
          id: number
          id_tarefa: number | null
          idempresa: number | null
          idusuario: number | null
          lembrete: boolean | null
          local: string | null
          status: number | null
          tipo: number | null
          tipo_local: string | null
          titulo: string
        }
        Insert: {
          cliente?: number | null
          data: string
          dataatualizacao?: string | null
          datacadastro?: string
          descricao?: string | null
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: number
          id_tarefa?: number | null
          idempresa?: number | null
          idusuario?: number | null
          lembrete?: boolean | null
          local?: string | null
          status?: number | null
          tipo?: number | null
          tipo_local?: string | null
          titulo: string
        }
        Update: {
          cliente?: number | null
          data?: string
          dataatualizacao?: string | null
          datacadastro?: string
          descricao?: string | null
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: number
          id_tarefa?: number | null
          idempresa?: number | null
          idusuario?: number | null
          lembrete?: boolean | null
          local?: string | null
          status?: number | null
          tipo?: number | null
          tipo_local?: string | null
          titulo?: string
        }
        Relationships: []
      }
      api_config: {
        Row: {
          id: number
          uazapi_admin_token: string | null
          uazapi_url: string | null
          updated_at: string | null
        }
        Insert: {
          id?: number
          uazapi_admin_token?: string | null
          uazapi_url?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: number
          uazapi_admin_token?: string | null
          uazapi_url?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      area_atuacao: {
        Row: {
          ativo: boolean
          datacriacao: string
          id: number
          idempresa: number | null
          nome: string
        }
        Insert: {
          ativo?: boolean
          datacriacao?: string
          id?: number
          idempresa?: number | null
          nome: string
        }
        Update: {
          ativo?: boolean
          datacriacao?: string
          id?: number
          idempresa?: number | null
          nome?: string
        }
        Relationships: []
      }
      asaas_charges: {
        Row: {
          asaas_charge_id: string
          billing_type: string
          boleto_url: string | null
          card_brand: string | null
          card_last4: string | null
          cliente_id: number | null
          created_at: string
          credential_id: number | null
          due_date: string
          financial_flow_id: string
          id: number
          integration_api_key_id: number | null
          invoice_url: string | null
          last_event: string | null
          paid_at: string | null
          payload: Json | null
          pix_payload: string | null
          pix_qr_code: string | null
          raw_response: Json | null
          status: string
          updated_at: string
          value: number
        }
        Insert: {
          asaas_charge_id: string
          billing_type: string
          boleto_url?: string | null
          card_brand?: string | null
          card_last4?: string | null
          cliente_id?: number | null
          created_at?: string
          credential_id?: number | null
          due_date: string
          financial_flow_id: string
          id?: number
          integration_api_key_id?: number | null
          invoice_url?: string | null
          last_event?: string | null
          paid_at?: string | null
          payload?: Json | null
          pix_payload?: string | null
          pix_qr_code?: string | null
          raw_response?: Json | null
          status: string
          updated_at?: string
          value: number
        }
        Update: {
          asaas_charge_id?: string
          billing_type?: string
          boleto_url?: string | null
          card_brand?: string | null
          card_last4?: string | null
          cliente_id?: number | null
          created_at?: string
          credential_id?: number | null
          due_date?: string
          financial_flow_id?: string
          id?: number
          integration_api_key_id?: number | null
          invoice_url?: string | null
          last_event?: string | null
          paid_at?: string | null
          payload?: Json | null
          pix_payload?: string | null
          pix_qr_code?: string | null
          raw_response?: Json | null
          status?: string
          updated_at?: string
          value?: number
        }
        Relationships: []
      }
      asaas_credentials: {
        Row: {
          created_at: string
          id: number
          idempresa: number | null
          integration_api_key_id: number | null
          updated_at: string
          webhook_secret: string
        }
        Insert: {
          created_at?: string
          id?: number
          idempresa?: number | null
          integration_api_key_id?: number | null
          updated_at?: string
          webhook_secret: string
        }
        Update: {
          created_at?: string
          id?: number
          idempresa?: number | null
          integration_api_key_id?: number | null
          updated_at?: string
          webhook_secret?: string
        }
        Relationships: []
      }
      asaas_customers: {
        Row: {
          asaas_customer_id: string | null
          cliente_id: number
          integration_api_key_id: number
          last_payload: Json | null
          status: string
          synced_at: string | null
        }
        Insert: {
          asaas_customer_id?: string | null
          cliente_id: number
          integration_api_key_id: number
          last_payload?: Json | null
          status?: string
          synced_at?: string | null
        }
        Update: {
          asaas_customer_id?: string | null
          cliente_id?: number
          integration_api_key_id?: number
          last_payload?: Json | null
          status?: string
          synced_at?: string | null
        }
        Relationships: []
      }
      blog_posts: {
        Row: {
          author: string
          category: number
          content: string | null
          created_at: string
          description: string
          featured: boolean
          id: string
          image: string | null
          published_at: string
          read_time: string
          slug: string
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          author: string
          category: number
          content?: string | null
          created_at?: string
          description: string
          featured?: boolean
          id: string
          image?: string | null
          published_at: string
          read_time: string
          slug: string
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          author?: string
          category?: number
          content?: string | null
          created_at?: string
          description?: string
          featured?: boolean
          id?: string
          image?: string | null
          published_at?: string
          read_time?: string
          slug?: string
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      categorias: {
        Row: {
          ativo: boolean
          datacriacao: string
          id: number
          nome: string
        }
        Insert: {
          ativo?: boolean
          datacriacao?: string
          id?: number
          nome: string
        }
        Update: {
          ativo?: boolean
          datacriacao?: string
          id?: number
          nome?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          id: number
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: number
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: number
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      chat_conversations: {
        Row: {
          client_id: number | null
          client_name: string | null
          contact_avatar: string | null
          contact_identifier: string
          contact_name: string | null
          created_at: string
          credential_id: string | null
          custom_attributes: Json | null
          description: string | null
          id: string
          internal_notes: Json | null
          is_linked_to_client: boolean
          is_private: boolean
          last_message_id: string | null
          last_message_preview: string | null
          last_message_sender: string | null
          last_message_status: string | null
          last_message_timestamp: string | null
          last_message_type: string | null
          metadata: Json | null
          phone_number: string | null
          pinned: boolean
          responsible_id: number | null
          responsible_snapshot: Json | null
          short_status: string | null
          tags: Json | null
          unread_count: number
          updated_at: string
          wa_chat_id: string | null
        }
        Insert: {
          client_id?: number | null
          client_name?: string | null
          contact_avatar?: string | null
          contact_identifier: string
          contact_name?: string | null
          created_at?: string
          credential_id?: string | null
          custom_attributes?: Json | null
          description?: string | null
          id: string
          internal_notes?: Json | null
          is_linked_to_client?: boolean
          is_private?: boolean
          last_message_id?: string | null
          last_message_preview?: string | null
          last_message_sender?: string | null
          last_message_status?: string | null
          last_message_timestamp?: string | null
          last_message_type?: string | null
          metadata?: Json | null
          phone_number?: string | null
          pinned?: boolean
          responsible_id?: number | null
          responsible_snapshot?: Json | null
          short_status?: string | null
          tags?: Json | null
          unread_count?: number
          updated_at?: string
          wa_chat_id?: string | null
        }
        Update: {
          client_id?: number | null
          client_name?: string | null
          contact_avatar?: string | null
          contact_identifier?: string
          contact_name?: string | null
          created_at?: string
          credential_id?: string | null
          custom_attributes?: Json | null
          description?: string | null
          id?: string
          internal_notes?: Json | null
          is_linked_to_client?: boolean
          is_private?: boolean
          last_message_id?: string | null
          last_message_preview?: string | null
          last_message_sender?: string | null
          last_message_status?: string | null
          last_message_timestamp?: string | null
          last_message_type?: string | null
          metadata?: Json | null
          phone_number?: string | null
          pinned?: boolean
          responsible_id?: number | null
          responsible_snapshot?: Json | null
          short_status?: string | null
          tags?: Json | null
          unread_count?: number
          updated_at?: string
          wa_chat_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_conversations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          attachments: Json | null
          client_message_id: string | null
          content: string
          conversation_id: string
          created_at: string
          deleted_at: string | null
          deleted_by: string | null
          external_id: string | null
          id: string
          message_type: string
          reaction: string | null
          sender: string
          status: string
          timestamp: string
        }
        Insert: {
          attachments?: Json | null
          client_message_id?: string | null
          content: string
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          external_id?: string | null
          id: string
          message_type: string
          reaction?: string | null
          sender: string
          status: string
          timestamp: string
        }
        Update: {
          attachments?: Json | null
          client_message_id?: string | null
          content?: string
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          deleted_by?: string | null
          external_id?: string | null
          id?: string
          message_type?: string
          reaction?: string | null
          sender?: string
          status?: string
          timestamp?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      cliente_atributos: {
        Row: {
          datacadastro: string
          id: number
          idclientes: number
          idtipodocumento: number
          valor: string
        }
        Insert: {
          datacadastro?: string
          id?: number
          idclientes: number
          idtipodocumento: number
          valor: string
        }
        Update: {
          datacadastro?: string
          id?: number
          idclientes?: number
          idtipodocumento?: number
          valor?: string
        }
        Relationships: []
      }
      cliente_documento: {
        Row: {
          arquivo_base64: string
          cliente_id: number
          data_upload: string | null
          id: number
          nome_arquivo: string
          tipo_documento_id: number
        }
        Insert: {
          arquivo_base64: string
          cliente_id: number
          data_upload?: string | null
          id?: number
          nome_arquivo: string
          tipo_documento_id: number
        }
        Update: {
          arquivo_base64?: string
          cliente_id?: number
          data_upload?: string | null
          id?: number
          nome_arquivo?: string
          tipo_documento_id?: number
        }
        Relationships: []
      }
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
      email_confirmation_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: number
          token_hash: string
          used_at: string | null
          user_id: number
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: number
          token_hash: string
          used_at?: string | null
          user_id: number
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: number
          token_hash?: string
          used_at?: string | null
          user_id?: number
        }
        Relationships: []
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
      escritorios: {
        Row: {
          ativo: boolean
          datacriacao: string
          empresa: number
          id: number
          nome: string
        }
        Insert: {
          ativo?: boolean
          datacriacao?: string
          empresa: number
          id?: number
          nome: string
        }
        Update: {
          ativo?: boolean
          datacriacao?: string
          empresa?: number
          id?: number
          nome?: string
        }
        Relationships: []
      }
      etiquetas: {
        Row: {
          ativo: boolean
          datacriacao: string
          exibe_pipeline: boolean
          id: number
          id_fluxo_trabalho: number
          idempresa: number | null
          nome: string
          ordem: number
        }
        Insert: {
          ativo?: boolean
          datacriacao?: string
          exibe_pipeline?: boolean
          id?: number
          id_fluxo_trabalho: number
          idempresa?: number | null
          nome: string
          ordem: number
        }
        Update: {
          ativo?: boolean
          datacriacao?: string
          exibe_pipeline?: boolean
          id?: number
          id_fluxo_trabalho?: number
          idempresa?: number | null
          nome?: string
          ordem?: number
        }
        Relationships: []
      }
      financial_flows: {
        Row: {
          anexos: Json | null
          categoria_id: string | null
          cliente_id: number | null
          competencia: string | null
          conta_id: string | null
          created_at: string | null
          created_by: string | null
          descricao: string | null
          empresa: string | null
          empresa_id: number | null
          external_provider: string | null
          external_reference_id: string | null
          fornecedor_id: number | null
          id: string
          idempresa: number | null
          pagamento: string | null
          parcelas: Json | null
          recorrente: boolean | null
          status: string | null
          tipo: string
          updated_at: string | null
          valor: number
          valor_pago: number | null
          vencimento: string | null
        }
        Insert: {
          anexos?: Json | null
          categoria_id?: string | null
          cliente_id?: number | null
          competencia?: string | null
          conta_id?: string | null
          created_at?: string | null
          created_by?: string | null
          descricao?: string | null
          empresa?: string | null
          empresa_id?: number | null
          external_provider?: string | null
          external_reference_id?: string | null
          fornecedor_id?: number | null
          id?: string
          idempresa?: number | null
          pagamento?: string | null
          parcelas?: Json | null
          recorrente?: boolean | null
          status?: string | null
          tipo: string
          updated_at?: string | null
          valor: number
          valor_pago?: number | null
          vencimento?: string | null
        }
        Update: {
          anexos?: Json | null
          categoria_id?: string | null
          cliente_id?: number | null
          competencia?: string | null
          conta_id?: string | null
          created_at?: string | null
          created_by?: string | null
          descricao?: string | null
          empresa?: string | null
          empresa_id?: number | null
          external_provider?: string | null
          external_reference_id?: string | null
          fornecedor_id?: number | null
          id?: string
          idempresa?: number | null
          pagamento?: string | null
          parcelas?: Json | null
          recorrente?: boolean | null
          status?: string | null
          tipo?: string
          updated_at?: string | null
          valor?: number
          valor_pago?: number | null
          vencimento?: string | null
        }
        Relationships: []
      }
      fluxo_trabalho: {
        Row: {
          ativo: boolean
          datacriacao: string
          exibe_menu: boolean
          id: number
          idempresa: number | null
          nome: string
          ordem: number | null
        }
        Insert: {
          ativo?: boolean
          datacriacao?: string
          exibe_menu?: boolean
          id?: number
          idempresa?: number | null
          nome: string
          ordem?: number | null
        }
        Update: {
          ativo?: boolean
          datacriacao?: string
          exibe_menu?: boolean
          id?: number
          idempresa?: number | null
          nome?: string
          ordem?: number | null
        }
        Relationships: []
      }
      fornecedores: {
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
          nome: string
          numero: string | null
          rua: string | null
          telefone: string | null
          tipo: string | null
          uf: string | null
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
          nome: string
          numero?: string | null
          rua?: string | null
          telefone?: string | null
          tipo?: string | null
          uf?: string | null
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
          nome?: string
          numero?: string | null
          rua?: string | null
          telefone?: string | null
          tipo?: string | null
          uf?: string | null
        }
        Relationships: []
      }
      integration_api_keys: {
        Row: {
          active: boolean
          created_at: string
          environment: string
          global: boolean
          id: number
          idempresa: number | null
          key_value: string
          last_used: string | null
          provider: string
          updated_at: string
          url_api: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          environment: string
          global?: boolean
          id?: number
          idempresa?: number | null
          key_value: string
          last_used?: string | null
          provider: string
          updated_at?: string
          url_api?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          environment?: string
          global?: boolean
          id?: number
          idempresa?: number | null
          key_value?: string
          last_used?: string | null
          provider?: string
          updated_at?: string
          url_api?: string | null
        }
        Relationships: []
      }
      integration_webhook_deliveries: {
        Row: {
          body: Json
          created_at: string
          delivered_at: string | null
          delivery_attempts: number
          empresa_id: number
          event: string
          id: number
          last_error: string | null
          occurred_at: string
          webhook_id: number
        }
        Insert: {
          body: Json
          created_at?: string
          delivered_at?: string | null
          delivery_attempts?: number
          empresa_id: number
          event: string
          id?: number
          last_error?: string | null
          occurred_at: string
          webhook_id: number
        }
        Update: {
          body?: Json
          created_at?: string
          delivered_at?: string | null
          delivery_attempts?: number
          empresa_id?: number
          event?: string
          id?: number
          last_error?: string | null
          occurred_at?: string
          webhook_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "integration_webhook_deliveries_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "integration_webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_webhooks: {
        Row: {
          active: boolean
          created_at: string
          events: string[]
          id: number
          idempresa: number | null
          last_delivery: string | null
          name: string
          secret: string
          target_url: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          events?: string[]
          id?: number
          idempresa?: number | null
          last_delivery?: string | null
          name: string
          secret: string
          target_url: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          events?: string[]
          id?: number
          idempresa?: number | null
          last_delivery?: string | null
          name?: string
          secret?: string
          target_url?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_webhooks_idempresa_fkey"
            columns: ["idempresa"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          base_url: string
          created_at: string | null
          id: number
          instance_name: string
          owner: string | null
          token: string
          updated_at: string | null
        }
        Insert: {
          base_url: string
          created_at?: string | null
          id?: number
          instance_name: string
          owner?: string | null
          token: string
          updated_at?: string | null
        }
        Update: {
          base_url?: string
          created_at?: string | null
          id?: number
          instance_name?: string
          owner?: string | null
          token?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      intimacoes: {
        Row: {
          arquivada: boolean
          ativo: boolean
          codigoclasse: string | null
          created_at: string
          data_cancelamento: string | null
          data_disponibilizacao: string | null
          destinatarios: string[] | null
          destinatarios_advogados: string[] | null
          external_id: string
          hash: string | null
          id: number
          idempresa: number | null
          idusuario: number | null
          idusuario_leitura: number | null
          lida_em: string | null
          link: string | null
          meio: string | null
          motivo_cancelamento: string | null
          nao_lida: boolean
          nomeclasse: string | null
          nomeorgao: string | null
          numero_processo: string
          numerocomunicacao: string | null
          prazo: string | null
          siglatribunal: string
          status: string | null
          texto: string | null
          tipocomunicacao: string | null
          tipodocumento: string | null
          updated_at: string
        }
        Insert: {
          arquivada?: boolean
          ativo?: boolean
          codigoclasse?: string | null
          created_at?: string
          data_cancelamento?: string | null
          data_disponibilizacao?: string | null
          destinatarios?: string[] | null
          destinatarios_advogados?: string[] | null
          external_id: string
          hash?: string | null
          id?: number
          idempresa?: number | null
          idusuario?: number | null
          idusuario_leitura?: number | null
          lida_em?: string | null
          link?: string | null
          meio?: string | null
          motivo_cancelamento?: string | null
          nao_lida?: boolean
          nomeclasse?: string | null
          nomeorgao?: string | null
          numero_processo: string
          numerocomunicacao?: string | null
          prazo?: string | null
          siglatribunal?: string
          status?: string | null
          texto?: string | null
          tipocomunicacao?: string | null
          tipodocumento?: string | null
          updated_at?: string
        }
        Update: {
          arquivada?: boolean
          ativo?: boolean
          codigoclasse?: string | null
          created_at?: string
          data_cancelamento?: string | null
          data_disponibilizacao?: string | null
          destinatarios?: string[] | null
          destinatarios_advogados?: string[] | null
          external_id?: string
          hash?: string | null
          id?: number
          idempresa?: number | null
          idusuario?: number | null
          idusuario_leitura?: number | null
          lida_em?: string | null
          link?: string | null
          meio?: string | null
          motivo_cancelamento?: string | null
          nao_lida?: boolean
          nomeclasse?: string | null
          nomeorgao?: string | null
          numero_processo?: string
          numerocomunicacao?: string | null
          prazo?: string | null
          siglatribunal?: string
          status?: string | null
          texto?: string | null
          tipocomunicacao?: string | null
          tipodocumento?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "intimacoes_idempresa_fkey"
            columns: ["idempresa"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      labels: {
        Row: {
          color: string
          company_id: number | null
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          color?: string
          company_id?: number | null
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          color?: string
          company_id?: number | null
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          created_at: string
          preferences: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          preferences: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          preferences?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          action_url: string | null
          category: string
          created_at: string
          id: number
          message: string
          metadata: Json | null
          read: boolean
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          category: string
          created_at?: string
          id?: number
          message: string
          metadata?: Json | null
          read?: boolean
          read_at?: string | null
          title: string
          type?: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          category?: string
          created_at?: string
          id?: number
          message?: string
          metadata?: Json | null
          read?: boolean
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      oab_monitoradas: {
        Row: {
          created_at: string
          dias_semana: number[] | null
          empresa_id: number
          id: number
          numero: string
          sync_from: string | null
          tipo: string
          uf: string
          updated_at: string
          usuario_id: number | null
        }
        Insert: {
          created_at?: string
          dias_semana?: number[] | null
          empresa_id: number
          id?: number
          numero: string
          sync_from?: string | null
          tipo: string
          uf: string
          updated_at?: string
          usuario_id?: number | null
        }
        Update: {
          created_at?: string
          dias_semana?: number[] | null
          empresa_id?: number
          id?: number
          numero?: string
          sync_from?: string | null
          tipo?: string
          uf?: string
          updated_at?: string
          usuario_id?: number | null
        }
        Relationships: []
      }
      oportunidade_documentos: {
        Row: {
          content: string
          created_at: string
          id: number
          oportunidade_id: number
          template_id: number | null
          title: string
          variables: Json
        }
        Insert: {
          content: string
          created_at?: string
          id?: number
          oportunidade_id: number
          template_id?: number | null
          title: string
          variables?: Json
        }
        Update: {
          content?: string
          created_at?: string
          id?: number
          oportunidade_id?: number
          template_id?: number | null
          title?: string
          variables?: Json
        }
        Relationships: []
      }
      oportunidade_envolvidos: {
        Row: {
          documento: string | null
          endereco: string | null
          id: number
          nome: string | null
          oportunidade_id: number
          polo: string | null
          relacao: string | null
          telefone: string | null
        }
        Insert: {
          documento?: string | null
          endereco?: string | null
          id?: number
          nome?: string | null
          oportunidade_id: number
          polo?: string | null
          relacao?: string | null
          telefone?: string | null
        }
        Update: {
          documento?: string | null
          endereco?: string | null
          id?: number
          nome?: string | null
          oportunidade_id?: number
          polo?: string | null
          relacao?: string | null
          telefone?: string | null
        }
        Relationships: []
      }
      oportunidade_faturamentos: {
        Row: {
          condicao_pagamento: string | null
          criado_em: string | null
          data_faturamento: string | null
          forma_pagamento: string
          id: number
          observacoes: string | null
          oportunidade_id: number
          parcelas: number | null
          valor: number | null
        }
        Insert: {
          condicao_pagamento?: string | null
          criado_em?: string | null
          data_faturamento?: string | null
          forma_pagamento: string
          id?: number
          observacoes?: string | null
          oportunidade_id: number
          parcelas?: number | null
          valor?: number | null
        }
        Update: {
          condicao_pagamento?: string | null
          criado_em?: string | null
          data_faturamento?: string | null
          forma_pagamento?: string
          id?: number
          observacoes?: string | null
          oportunidade_id?: number
          parcelas?: number | null
          valor?: number | null
        }
        Relationships: []
      }
      oportunidade_parcelas: {
        Row: {
          atualizado_em: string | null
          criado_em: string | null
          data_prevista: string | null
          faturamento_id: number | null
          id: number
          idempresa: number | null
          numero_parcela: number
          oportunidade_id: number
          quitado_em: string | null
          status: string
          valor: number
          valor_pago: number | null
        }
        Insert: {
          atualizado_em?: string | null
          criado_em?: string | null
          data_prevista?: string | null
          faturamento_id?: number | null
          id?: number
          idempresa?: number | null
          numero_parcela: number
          oportunidade_id: number
          quitado_em?: string | null
          status?: string
          valor: number
          valor_pago?: number | null
        }
        Update: {
          atualizado_em?: string | null
          criado_em?: string | null
          data_prevista?: string | null
          faturamento_id?: number | null
          id?: number
          idempresa?: number | null
          numero_parcela?: number
          oportunidade_id?: number
          quitado_em?: string | null
          status?: string
          valor?: number
          valor_pago?: number | null
        }
        Relationships: []
      }
      oportunidade_sequence: {
        Row: {
          atual: number
          empresa_id: number
        }
        Insert: {
          atual: number
          empresa_id: number
        }
        Update: {
          atual?: number
          empresa_id?: number
        }
        Relationships: []
      }
      oportunidades: {
        Row: {
          area_atuacao_id: number | null
          audiencia_data: string | null
          audiencia_horario: string | null
          audiencia_local: string | null
          comarca: string | null
          contingenciamento: string | null
          criado_por: number | null
          data_criacao: string
          detalhes: string | null
          documentos_anexados: number | null
          etapa_id: number | null
          fase_id: number | null
          forma_pagamento: string | null
          id: number
          idempresa: number | null
          numero_processo_cnj: string | null
          numero_protocolo: string | null
          percentual_honorarios: number | null
          prazo_proximo: string | null
          qtde_parcelas: number | null
          responsavel_id: number | null
          sequencial_empresa: number
          solicitante_id: number | null
          status_id: number | null
          tipo_processo_id: number
          ultima_atualizacao: string
          valor_causa: number | null
          valor_entrada: number | null
          valor_honorarios: number | null
          vara_ou_orgao: string | null
        }
        Insert: {
          area_atuacao_id?: number | null
          audiencia_data?: string | null
          audiencia_horario?: string | null
          audiencia_local?: string | null
          comarca?: string | null
          contingenciamento?: string | null
          criado_por?: number | null
          data_criacao?: string
          detalhes?: string | null
          documentos_anexados?: number | null
          etapa_id?: number | null
          fase_id?: number | null
          forma_pagamento?: string | null
          id?: number
          idempresa?: number | null
          numero_processo_cnj?: string | null
          numero_protocolo?: string | null
          percentual_honorarios?: number | null
          prazo_proximo?: string | null
          qtde_parcelas?: number | null
          responsavel_id?: number | null
          sequencial_empresa: number
          solicitante_id?: number | null
          status_id?: number | null
          tipo_processo_id: number
          ultima_atualizacao?: string
          valor_causa?: number | null
          valor_entrada?: number | null
          valor_honorarios?: number | null
          vara_ou_orgao?: string | null
        }
        Update: {
          area_atuacao_id?: number | null
          audiencia_data?: string | null
          audiencia_horario?: string | null
          audiencia_local?: string | null
          comarca?: string | null
          contingenciamento?: string | null
          criado_por?: number | null
          data_criacao?: string
          detalhes?: string | null
          documentos_anexados?: number | null
          etapa_id?: number | null
          fase_id?: number | null
          forma_pagamento?: string | null
          id?: number
          idempresa?: number | null
          numero_processo_cnj?: string | null
          numero_protocolo?: string | null
          percentual_honorarios?: number | null
          prazo_proximo?: string | null
          qtde_parcelas?: number | null
          responsavel_id?: number | null
          sequencial_empresa?: number
          solicitante_id?: number | null
          status_id?: number | null
          tipo_processo_id?: number
          ultima_atualizacao?: string
          valor_causa?: number | null
          valor_entrada?: number | null
          valor_honorarios?: number | null
          vara_ou_orgao?: string | null
        }
        Relationships: []
      }
      ops_uaz_sse_tokens: {
        Row: {
          credential_id: string
          sse_base_url: string | null
          sse_token: string
        }
        Insert: {
          credential_id: string
          sse_base_url?: string | null
          sse_token: string
        }
        Update: {
          credential_id?: string
          sse_base_url?: string | null
          sse_token?: string
        }
        Relationships: []
      }
      password_reset_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: number
          token_hash: string
          used_at: string | null
          user_id: number
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: number
          token_hash: string
          used_at?: string | null
          user_id: number
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: number
          token_hash?: string
          used_at?: string | null
          user_id?: number
        }
        Relationships: []
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
      pje_processo_documentos: {
        Row: {
          created_at: string
          data_hora_juntada: string | null
          href_binario: string | null
          href_texto: string | null
          id: number
          id_codex: number | null
          id_origem: string | null
          nivel_sigilo: string | null
          nome: string | null
          numero_processo: string
          payload: Json
          processo_id: number
          sequencia: number | null
          tipo_codigo: number | null
          tipo_nome: string | null
        }
        Insert: {
          created_at?: string
          data_hora_juntada?: string | null
          href_binario?: string | null
          href_texto?: string | null
          id?: number
          id_codex?: number | null
          id_origem?: string | null
          nivel_sigilo?: string | null
          nome?: string | null
          numero_processo: string
          payload?: Json
          processo_id: number
          sequencia?: number | null
          tipo_codigo?: number | null
          tipo_nome?: string | null
        }
        Update: {
          created_at?: string
          data_hora_juntada?: string | null
          href_binario?: string | null
          href_texto?: string | null
          id?: number
          id_codex?: number | null
          id_origem?: string | null
          nivel_sigilo?: string | null
          nome?: string | null
          numero_processo?: string
          payload?: Json
          processo_id?: number
          sequencia?: number | null
          tipo_codigo?: number | null
          tipo_nome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pje_processo_documentos_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "pje_processos"
            referencedColumns: ["id"]
          },
        ]
      }
      pje_processo_movimentos: {
        Row: {
          created_at: string
          data_hora: string | null
          descricao: string | null
          id: number
          numero_processo: string
          payload: Json
          processo_id: number
        }
        Insert: {
          created_at?: string
          data_hora?: string | null
          descricao?: string | null
          id?: number
          numero_processo: string
          payload?: Json
          processo_id: number
        }
        Update: {
          created_at?: string
          data_hora?: string | null
          descricao?: string | null
          id?: number
          numero_processo?: string
          payload?: Json
          processo_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "pje_processo_movimentos_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "pje_processos"
            referencedColumns: ["id"]
          },
        ]
      }
      pje_processo_partes: {
        Row: {
          created_at: string
          documentos_principais: Json | null
          id: number
          nome: string | null
          numero_processo: string
          outros_nomes: Json | null
          payload: Json
          polo: string | null
          processo_id: number
          representantes: Json | null
          sigilosa: boolean | null
          tipo_parte: string | null
          tipo_pessoa: string | null
        }
        Insert: {
          created_at?: string
          documentos_principais?: Json | null
          id?: number
          nome?: string | null
          numero_processo: string
          outros_nomes?: Json | null
          payload?: Json
          polo?: string | null
          processo_id: number
          representantes?: Json | null
          sigilosa?: boolean | null
          tipo_parte?: string | null
          tipo_pessoa?: string | null
        }
        Update: {
          created_at?: string
          documentos_principais?: Json | null
          id?: number
          nome?: string | null
          numero_processo?: string
          outros_nomes?: Json | null
          payload?: Json
          polo?: string | null
          processo_id?: number
          representantes?: Json | null
          sigilosa?: boolean | null
          tipo_parte?: string | null
          tipo_pessoa?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pje_processo_partes_processo_id_fkey"
            columns: ["processo_id"]
            isOneToOne: false
            referencedRelation: "pje_processos"
            referencedColumns: ["id"]
          },
        ]
      }
      pje_processos: {
        Row: {
          assunto: Json | null
          classe: Json | null
          cliente_id: number | null
          created_at: string
          data_ajuizamento: string | null
          data_ultima_distribuicao: string | null
          grau: Json | null
          id: number
          id_codex_tribunal: number | null
          idempresa: number
          idusuario: number
          nivel_sigilo: number | null
          numero_processo: string
          orgao_julgador: Json | null
          payload: Json
          permite_peticionar: boolean
          semcliente: string | null
          sigla_tribunal: string
          synced_at: string
          tramitacao_ativa: Json | null
          tribunal: Json | null
          ultimo_movimento: Json | null
          ultimo_movimento_data: string | null
          updated_at: string
          valor_acao: number | null
        }
        Insert: {
          assunto?: Json | null
          classe?: Json | null
          cliente_id?: number | null
          created_at?: string
          data_ajuizamento?: string | null
          data_ultima_distribuicao?: string | null
          grau?: Json | null
          id?: number
          id_codex_tribunal?: number | null
          idempresa: number
          idusuario: number
          nivel_sigilo?: number | null
          numero_processo: string
          orgao_julgador?: Json | null
          payload?: Json
          permite_peticionar?: boolean
          semcliente?: string | null
          sigla_tribunal: string
          synced_at?: string
          tramitacao_ativa?: Json | null
          tribunal?: Json | null
          ultimo_movimento?: Json | null
          ultimo_movimento_data?: string | null
          updated_at?: string
          valor_acao?: number | null
        }
        Update: {
          assunto?: Json | null
          classe?: Json | null
          cliente_id?: number | null
          created_at?: string
          data_ajuizamento?: string | null
          data_ultima_distribuicao?: string | null
          grau?: Json | null
          id?: number
          id_codex_tribunal?: number | null
          idempresa?: number
          idusuario?: number
          nivel_sigilo?: number | null
          numero_processo?: string
          orgao_julgador?: Json | null
          payload?: Json
          permite_peticionar?: boolean
          semcliente?: string | null
          sigla_tribunal?: string
          synced_at?: string
          tramitacao_ativa?: Json | null
          tribunal?: Json | null
          ultimo_movimento?: Json | null
          ultimo_movimento_data?: string | null
          updated_at?: string
          valor_acao?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pje_processos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
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
      process_sync: {
        Row: {
          completed_at: string | null
          created_at: string
          id: number
          integration_api_key_id: number | null
          metadata: Json | null
          processo_id: number | null
          remote_request_id: string | null
          request_headers: Json | null
          request_payload: Json
          request_type: string
          requested_at: string
          requested_by: number | null
          status: string
          status_reason: string | null
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: number
          integration_api_key_id?: number | null
          metadata?: Json | null
          processo_id?: number | null
          remote_request_id?: string | null
          request_headers?: Json | null
          request_payload?: Json
          request_type?: string
          requested_at?: string
          requested_by?: number | null
          status?: string
          status_reason?: string | null
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: number
          integration_api_key_id?: number | null
          metadata?: Json | null
          processo_id?: number | null
          remote_request_id?: string | null
          request_headers?: Json | null
          request_payload?: Json
          request_type?: string
          requested_at?: string
          requested_by?: number | null
          status?: string
          status_reason?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      processo_consultas_api: {
        Row: {
          consultado_em: string
          detalhes: string | null
          id: number
          processo_id: number
          sucesso: boolean
        }
        Insert: {
          consultado_em?: string
          detalhes?: string | null
          id?: number
          processo_id: number
          sucesso?: boolean
        }
        Update: {
          consultado_em?: string
          detalhes?: string | null
          id?: number
          processo_id?: number
          sucesso?: boolean
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
      quick_answers: {
        Row: {
          created_at: string
          empresa_id: number
          id: number
          media_type: string | null
          media_url: string | null
          message: string
          shortcut: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          empresa_id: number
          id?: number
          media_type?: string | null
          media_url?: string | null
          message: string
          shortcut: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          empresa_id?: number
          id?: number
          media_type?: string | null
          media_url?: string | null
          message?: string
          shortcut?: string
          updated_at?: string
        }
        Relationships: []
      }
      schema_migrations: {
        Row: {
          applied_at: string
          id: number
          name: string
        }
        Insert: {
          applied_at?: string
          id?: number
          name: string
        }
        Update: {
          applied_at?: string
          id?: number
          name?: string
        }
        Relationships: []
      }
      sistema_cnj: {
        Row: {
          id: number
          nome: string
        }
        Insert: {
          id?: number
          nome: string
        }
        Update: {
          id?: number
          nome?: string
        }
        Relationships: []
      }
      situacao_cliente: {
        Row: {
          ativo: boolean
          datacriacao: string
          id: number
          nome: string
        }
        Insert: {
          ativo?: boolean
          datacriacao?: string
          id?: number
          nome: string
        }
        Update: {
          ativo?: boolean
          datacriacao?: string
          id?: number
          nome?: string
        }
        Relationships: []
      }
      situacao_processo: {
        Row: {
          ativo: boolean
          datacriacao: string
          id: number
          idempresa: number | null
          nome: string
        }
        Insert: {
          ativo?: boolean
          datacriacao?: string
          id?: number
          idempresa?: number | null
          nome: string
        }
        Update: {
          ativo?: boolean
          datacriacao?: string
          id?: number
          idempresa?: number | null
          nome?: string
        }
        Relationships: []
      }
      situacao_proposta: {
        Row: {
          ativo: boolean
          datacriacao: string
          id: number
          idempresa: number | null
          nome: string
        }
        Insert: {
          ativo?: boolean
          datacriacao?: string
          id?: number
          idempresa?: number | null
          nome: string
        }
        Update: {
          ativo?: boolean
          datacriacao?: string
          id?: number
          idempresa?: number | null
          nome?: string
        }
        Relationships: []
      }
      support_request_attachments: {
        Row: {
          content_type: string | null
          created_at: string
          data: string
          file_size: number | null
          filename: string
          id: number
          message_id: number
        }
        Insert: {
          content_type?: string | null
          created_at?: string
          data: string
          file_size?: number | null
          filename: string
          id?: number
          message_id: number
        }
        Update: {
          content_type?: string | null
          created_at?: string
          data?: string
          file_size?: number | null
          filename?: string
          id?: number
          message_id?: number
        }
        Relationships: []
      }
      support_request_messages: {
        Row: {
          created_at: string
          id: number
          message: string
          sender: string
          support_request_id: number
        }
        Insert: {
          created_at?: string
          id?: number
          message: string
          sender: string
          support_request_id: number
        }
        Update: {
          created_at?: string
          id?: number
          message?: string
          sender?: string
          support_request_id?: number
        }
        Relationships: []
      }
      support_requests: {
        Row: {
          created_at: string
          description: string
          id: number
          requester_email: string | null
          requester_id: number | null
          requester_name: string | null
          status: string
          subject: string
          support_agent_id: number | null
          support_agent_name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          id?: number
          requester_email?: string | null
          requester_id?: number | null
          requester_name?: string | null
          status?: string
          subject: string
          support_agent_id?: number | null
          support_agent_name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: number
          requester_email?: string | null
          requester_id?: number | null
          requester_name?: string | null
          status?: string
          subject?: string
          support_agent_id?: number | null
          support_agent_name?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sync_audit: {
        Row: {
          created_at: string
          event_details: Json
          event_type: string
          id: number
          integration_api_key_id: number | null
          observed_at: string
          process_response_id: number | null
          process_sync_id: number | null
          processo_id: number | null
        }
        Insert: {
          created_at?: string
          event_details?: Json
          event_type: string
          id?: number
          integration_api_key_id?: number | null
          observed_at?: string
          process_response_id?: number | null
          process_sync_id?: number | null
          processo_id?: number | null
        }
        Update: {
          created_at?: string
          event_details?: Json
          event_type?: string
          id?: number
          integration_api_key_id?: number | null
          observed_at?: string
          process_response_id?: number | null
          process_sync_id?: number | null
          processo_id?: number | null
        }
        Relationships: []
      }
      sync_intimacoes_log: {
        Row: {
          created_at: string
          detalhes: Json
          duration_ms: number | null
          enfileiradas: number
          erro: string | null
          execution_id: string
          falhas: number
          finished_at: string | null
          id: number
          processadas: number
          started_at: string
          status: string
          total_oabs: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          detalhes?: Json
          duration_ms?: number | null
          enfileiradas?: number
          erro?: string | null
          execution_id?: string
          falhas?: number
          finished_at?: string | null
          id?: number
          processadas?: number
          started_at?: string
          status?: string
          total_oabs?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          detalhes?: Json
          duration_ms?: number | null
          enfileiradas?: number
          erro?: string | null
          execution_id?: string
          falhas?: number
          finished_at?: string | null
          id?: number
          processadas?: number
          started_at?: string
          status?: string
          total_oabs?: number
          updated_at?: string
        }
        Relationships: []
      }
      sync_processos_log: {
        Row: {
          created_at: string
          detalhes: Json
          duration_ms: number | null
          enfileiradas: number
          erro: string | null
          execution_id: string
          falhas: number
          finished_at: string | null
          id: number
          processadas: number
          started_at: string
          status: string
          total_oabs: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          detalhes?: Json
          duration_ms?: number | null
          enfileiradas?: number
          erro?: string | null
          execution_id?: string
          falhas?: number
          finished_at?: string | null
          id?: number
          processadas?: number
          started_at?: string
          status?: string
          total_oabs?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          detalhes?: Json
          duration_ms?: number | null
          enfileiradas?: number
          erro?: string | null
          execution_id?: string
          falhas?: number
          finished_at?: string | null
          id?: number
          processadas?: number
          started_at?: string
          status?: string
          total_oabs?: number
          updated_at?: string
        }
        Relationships: []
      }
      tags: {
        Row: {
          example: string | null
          group_name: string | null
          id: number
          key: string
          label: string
        }
        Insert: {
          example?: string | null
          group_name?: string | null
          id?: number
          key: string
          label: string
        }
        Update: {
          example?: string | null
          group_name?: string | null
          id?: number
          key?: string
          label?: string
        }
        Relationships: []
      }
      tarefas: {
        Row: {
          ativo: boolean
          atualizado_em: string | null
          concluido: boolean
          criado_em: string | null
          data: string
          descricao: string | null
          dia_inteiro: boolean | null
          hora: string | null
          id: number
          id_oportunidades: number | null
          idempresa: number
          idusuario: number
          mostrar_na_agenda: boolean | null
          prioridade: number | null
          privada: boolean | null
          recorrente: boolean | null
          repetir_cada_unidade: string | null
          repetir_intervalo: number | null
          repetir_quantas_vezes: number | null
          titulo: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string | null
          concluido?: boolean
          criado_em?: string | null
          data: string
          descricao?: string | null
          dia_inteiro?: boolean | null
          hora?: string | null
          id?: number
          id_oportunidades?: number | null
          idempresa: number
          idusuario: number
          mostrar_na_agenda?: boolean | null
          prioridade?: number | null
          privada?: boolean | null
          recorrente?: boolean | null
          repetir_cada_unidade?: string | null
          repetir_intervalo?: number | null
          repetir_quantas_vezes?: number | null
          titulo: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string | null
          concluido?: boolean
          criado_em?: string | null
          data?: string
          descricao?: string | null
          dia_inteiro?: boolean | null
          hora?: string | null
          id?: number
          id_oportunidades?: number | null
          idempresa?: number
          idusuario?: number
          mostrar_na_agenda?: boolean | null
          prioridade?: number | null
          privada?: boolean | null
          recorrente?: boolean | null
          repetir_cada_unidade?: string | null
          repetir_intervalo?: number | null
          repetir_quantas_vezes?: number | null
          titulo?: string
        }
        Relationships: []
      }
      tarefas_responsaveis: {
        Row: {
          id_tarefa: number
          id_usuario: number
        }
        Insert: {
          id_tarefa: number
          id_usuario: number
        }
        Update: {
          id_tarefa?: number
          id_usuario?: number
        }
        Relationships: []
      }
      templates: {
        Row: {
          content: string
          datacriacao: string
          id: number
          idempresa: number | null
          idusuario: number | null
          title: string
        }
        Insert: {
          content: string
          datacriacao?: string
          id?: number
          idempresa?: number | null
          idusuario?: number | null
          title: string
        }
        Update: {
          content?: string
          datacriacao?: string
          id?: number
          idempresa?: number | null
          idusuario?: number | null
          title?: string
        }
        Relationships: []
      }
      tipo_documento: {
        Row: {
          ativo: boolean | null
          datacriacao: string | null
          id: number
          idempresa: number | null
          nome: string
        }
        Insert: {
          ativo?: boolean | null
          datacriacao?: string | null
          id?: number
          idempresa?: number | null
          nome: string
        }
        Update: {
          ativo?: boolean | null
          datacriacao?: string | null
          id?: number
          idempresa?: number | null
          nome?: string
        }
        Relationships: []
      }
      tipo_envolvimento: {
        Row: {
          descricao: string
          id: number
        }
        Insert: {
          descricao: string
          id?: number
        }
        Update: {
          descricao?: string
          id?: number
        }
        Relationships: []
      }
      tipo_evento: {
        Row: {
          agenda: boolean
          ativo: boolean
          datacriacao: string
          id: number
          idempresa: number | null
          nome: string
          tarefa: boolean
        }
        Insert: {
          agenda?: boolean
          ativo?: boolean
          datacriacao?: string
          id?: number
          idempresa?: number | null
          nome: string
          tarefa?: boolean
        }
        Update: {
          agenda?: boolean
          ativo?: boolean
          datacriacao?: string
          id?: number
          idempresa?: number | null
          nome?: string
          tarefa?: boolean
        }
        Relationships: []
      }
      tipo_processo: {
        Row: {
          ativo: boolean
          datacriacao: string
          id: number
          idareaatuacao: number | null
          idempresa: number | null
          nome: string
        }
        Insert: {
          ativo?: boolean
          datacriacao?: string
          id?: number
          idareaatuacao?: number | null
          idempresa?: number | null
          nome: string
        }
        Update: {
          ativo?: boolean
          datacriacao?: string
          id?: number
          idareaatuacao?: number | null
          idempresa?: number | null
          nome?: string
        }
        Relationships: []
      }
      trigger_movimentacao_processo: {
        Row: {
          data_cadastro: string
          data_movimentacao: string | null
          descricao: string | null
          id: number
          instancia_processo: number | null
          numero_cnj: string | null
          sigiloso: boolean | null
          tipo_andamento: string | null
        }
        Insert: {
          data_cadastro?: string
          data_movimentacao?: string | null
          descricao?: string | null
          id?: never
          instancia_processo?: number | null
          numero_cnj?: string | null
          sigiloso?: boolean | null
          tipo_andamento?: string | null
        }
        Update: {
          data_cadastro?: string
          data_movimentacao?: string | null
          descricao?: string | null
          id?: never
          instancia_processo?: number | null
          numero_cnj?: string | null
          sigiloso?: boolean | null
          tipo_andamento?: string | null
        }
        Relationships: []
      }
      trigger_sincronizar_processo: {
        Row: {
          created_at: string
          on_demand: boolean
          request_id: string
          response_type: string
          search_key: string
          search_type: string
          status: string
          updated_at: string | null
          user_id: string
          with_attachments: boolean
        }
        Insert: {
          created_at: string
          on_demand: boolean
          request_id: string
          response_type: string
          search_key: string
          search_type: string
          status: string
          updated_at?: string | null
          user_id: string
          with_attachments: boolean
        }
        Update: {
          created_at?: string
          on_demand?: boolean
          request_id?: string
          response_type?: string
          search_key?: string
          search_type?: string
          status?: string
          updated_at?: string | null
          user_id?: string
          with_attachments?: boolean
        }
        Relationships: []
      }
      uaz_credentials: {
        Row: {
          connected: boolean
          created_at: string
          empresa_id: number | null
          id: string
          pair_code: string | null
          phone_number: string | null
          profile_name: string | null
          qr_code: string | null
          sse_base_url: string | null
          sse_token: string | null
          status: string | null
          subdomain: string
          token: string
          updated_at: string
          webhook_id: string | null
          webhook_url: string | null
        }
        Insert: {
          connected?: boolean
          created_at?: string
          empresa_id?: number | null
          id: string
          pair_code?: string | null
          phone_number?: string | null
          profile_name?: string | null
          qr_code?: string | null
          sse_base_url?: string | null
          sse_token?: string | null
          status?: string | null
          subdomain: string
          token: string
          updated_at?: string
          webhook_id?: string | null
          webhook_url?: string | null
        }
        Update: {
          connected?: boolean
          created_at?: string
          empresa_id?: number | null
          id?: string
          pair_code?: string | null
          phone_number?: string | null
          profile_name?: string | null
          qr_code?: string | null
          sse_base_url?: string | null
          sse_token?: string | null
          status?: string | null
          subdomain?: string
          token?: string
          updated_at?: string
          webhook_id?: string | null
          webhook_url?: string | null
        }
        Relationships: []
      }
      uazapi_conversations: {
        Row: {
          assigned_to: string | null
          contact_display_name: string | null
          contact_image: string | null
          contact_name: string | null
          contact_phone: string
          created_at: string
          desativar_bot: boolean
          id: string
          instance_id: string
          is_group: boolean | null
          last_message_at: string | null
          last_message_text: string | null
          notes: string | null
          status: string | null
          tags: string | null
          unread_count: number | null
          updated_at: string
          wa_chat_id: string
        }
        Insert: {
          assigned_to?: string | null
          contact_display_name?: string | null
          contact_image?: string | null
          contact_name?: string | null
          contact_phone: string
          created_at?: string
          desativar_bot?: boolean
          id?: string
          instance_id: string
          is_group?: boolean | null
          last_message_at?: string | null
          last_message_text?: string | null
          notes?: string | null
          status?: string | null
          tags?: string | null
          unread_count?: number | null
          updated_at?: string
          wa_chat_id: string
        }
        Update: {
          assigned_to?: string | null
          contact_display_name?: string | null
          contact_image?: string | null
          contact_name?: string | null
          contact_phone?: string
          created_at?: string
          desativar_bot?: boolean
          id?: string
          instance_id?: string
          is_group?: boolean | null
          last_message_at?: string | null
          last_message_text?: string | null
          notes?: string | null
          status?: string | null
          tags?: string | null
          unread_count?: number | null
          updated_at?: string
          wa_chat_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "uazapi_conversations_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "uazapi_instances"
            referencedColumns: ["id"]
          },
        ]
      }
      uazapi_instances: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_business: boolean | null
          name: string
          phone_number: string | null
          profile_name: string | null
          profile_pic_url: string | null
          qr_code: string | null
          status: string | null
          uazapi_instance_id: string | null
          uazapi_token: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_business?: boolean | null
          name: string
          phone_number?: string | null
          profile_name?: string | null
          profile_pic_url?: string | null
          qr_code?: string | null
          status?: string | null
          uazapi_instance_id?: string | null
          uazapi_token?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_business?: boolean | null
          name?: string
          phone_number?: string | null
          profile_name?: string | null
          profile_pic_url?: string | null
          qr_code?: string | null
          status?: string | null
          uazapi_instance_id?: string | null
          uazapi_token?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      uazapi_message_attachments: {
        Row: {
          chat_id: string | null
          created_at: string
          filename: string | null
          id: string
          media_base64: string | null
          media_type: string | null
          media_url: string | null
          message_id: string
        }
        Insert: {
          chat_id?: string | null
          created_at?: string
          filename?: string | null
          id?: string
          media_base64?: string | null
          media_type?: string | null
          media_url?: string | null
          message_id: string
        }
        Update: {
          chat_id?: string | null
          created_at?: string
          filename?: string | null
          id?: string
          media_base64?: string | null
          media_type?: string | null
          media_url?: string | null
          message_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "uazapi_message_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "uazapi_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      uazapi_messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          edited_at: string | null
          from_me: boolean | null
          id: string
          is_private: boolean
          message_type: string | null
          quoted_message_id: string | null
          sender_id: string | null
          sender_name: string | null
          status: string | null
          wa_message_id: string | null
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          edited_at?: string | null
          from_me?: boolean | null
          id?: string
          is_private?: boolean
          message_type?: string | null
          quoted_message_id?: string | null
          sender_id?: string | null
          sender_name?: string | null
          status?: string | null
          wa_message_id?: string | null
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          edited_at?: string | null
          from_me?: boolean | null
          id?: string
          is_private?: boolean
          message_type?: string | null
          quoted_message_id?: string | null
          sender_id?: string | null
          sender_name?: string | null
          status?: string | null
          wa_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "uazapi_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "uazapi_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profile_audit_logs: {
        Row: {
          action: string
          created_at: string
          description: string
          id: number
          performed_by: number | null
          performed_by_name: string | null
          user_id: number
        }
        Insert: {
          action: string
          created_at?: string
          description: string
          id?: number
          performed_by?: number | null
          performed_by_name?: string | null
          user_id: number
        }
        Update: {
          action?: string
          created_at?: string
          description?: string
          id?: number
          performed_by?: number | null
          performed_by_name?: string | null
          user_id?: number
        }
        Relationships: []
      }
      user_profile_sessions: {
        Row: {
          approved_at: string | null
          created_at: string
          device: string
          id: number
          is_active: boolean
          is_approved: boolean
          last_activity: string
          location: string | null
          revoked_at: string | null
          user_id: number
        }
        Insert: {
          approved_at?: string | null
          created_at?: string
          device: string
          id?: number
          is_active?: boolean
          is_approved?: boolean
          last_activity?: string
          location?: string | null
          revoked_at?: string | null
          user_id: number
        }
        Update: {
          approved_at?: string | null
          created_at?: string
          device?: string
          id?: number
          is_active?: boolean
          is_approved?: boolean
          last_activity?: string
          location?: string | null
          revoked_at?: string | null
          user_id?: number
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          address_city: string | null
          address_state: string | null
          address_street: string | null
          address_zip: string | null
          avatar_url: string | null
          bio: string | null
          created_at: string
          hourly_rate: number | null
          language: string | null
          linkedin_url: string | null
          member_since: string | null
          notifications_agenda_reminders: boolean
          notifications_newsletter: boolean
          notifications_security_alerts: boolean
          oab_number: string | null
          oab_uf: string | null
          office: string | null
          security_device_approval: boolean
          security_login_alerts: boolean
          security_two_factor: boolean
          security_two_factor_activated_at: string | null
          security_two_factor_backup_codes: string[]
          security_two_factor_secret: string | null
          specialties: string[]
          timezone: string | null
          title: string | null
          updated_at: string
          user_id: string
          website_url: string | null
        }
        Insert: {
          address_city?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          hourly_rate?: number | null
          language?: string | null
          linkedin_url?: string | null
          member_since?: string | null
          notifications_agenda_reminders?: boolean
          notifications_newsletter?: boolean
          notifications_security_alerts?: boolean
          oab_number?: string | null
          oab_uf?: string | null
          office?: string | null
          security_device_approval?: boolean
          security_login_alerts?: boolean
          security_two_factor?: boolean
          security_two_factor_activated_at?: string | null
          security_two_factor_backup_codes?: string[]
          security_two_factor_secret?: string | null
          specialties?: string[]
          timezone?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
          website_url?: string | null
        }
        Update: {
          address_city?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          hourly_rate?: number | null
          language?: string | null
          linkedin_url?: string | null
          member_since?: string | null
          notifications_agenda_reminders?: boolean
          notifications_newsletter?: boolean
          notifications_security_alerts?: boolean
          oab_number?: string | null
          oab_uf?: string | null
          office?: string | null
          security_device_approval?: boolean
          security_login_alerts?: boolean
          security_two_factor?: boolean
          security_two_factor_activated_at?: string | null
          security_two_factor_backup_codes?: string[]
          security_two_factor_secret?: string | null
          specialties?: string[]
          timezone?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
          website_url?: string | null
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
      webhook_logs: {
        Row: {
          event_type: string | null
          id: number
          instance_token: string
          payload: Json | null
          received_at: string | null
        }
        Insert: {
          event_type?: string | null
          id?: number
          instance_token: string
          payload?: Json | null
          received_at?: string | null
        }
        Update: {
          event_type?: string | null
          id?: number
          instance_token?: string
          payload?: Json | null
          received_at?: string | null
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

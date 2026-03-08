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

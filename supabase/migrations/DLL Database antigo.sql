-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE IF NOT EXISTS public.accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  bank text,
  agency text,
  number text,
  currency text DEFAULT 'BRL'::text,
  initial_balance numeric DEFAULT 0,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  idempresa bigint,
  CONSTRAINT accounts_pkey PRIMARY KEY (id),
  CONSTRAINT accounts_empresas_fk FOREIGN KEY (idempresa) REFERENCES public.empresas(id)
);
CREATE TABLE IF NOT EXISTS public.agenda (
  id integer NOT NULL DEFAULT nextval('agenda_id_seq'::regclass),
  titulo text NOT NULL,
  tipo integer,
  descricao text,
  data date NOT NULL,
  hora_inicio time without time zone,
  hora_fim time without time zone,
  cliente integer,
  tipo_local character varying CHECK (tipo_local::text = ANY (ARRAY['INTERNO'::character varying::text, 'EXTERNO'::character varying::text])),
  local text,
  lembrete boolean DEFAULT false,
  status integer,
  datacadastro timestamp without time zone NOT NULL DEFAULT now(),
  idempresa integer,
  idusuario integer,
  dataatualizacao timestamp without time zone,
  id_tarefa integer,
  CONSTRAINT agenda_pkey PRIMARY KEY (id),
  CONSTRAINT agenda_tarefas_fk FOREIGN KEY (id_tarefa) REFERENCES public.tarefas(id)
);
CREATE TABLE IF NOT EXISTS public.api_config (
  id integer NOT NULL DEFAULT 1 CHECK (id = 1),
  uazapi_url text,
  uazapi_admin_token text,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT api_config_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.area_atuacao (
  id integer NOT NULL DEFAULT nextval('area_atuacao_id_seq'::regclass),
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  datacriacao timestamp without time zone NOT NULL DEFAULT now(),
  idempresa integer,
  CONSTRAINT area_atuacao_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.asaas_charges (
  id bigint NOT NULL DEFAULT nextval('asaas_charges_id_seq'::regclass),
  financial_flow_id text NOT NULL UNIQUE,
  cliente_id integer,
  integration_api_key_id bigint,
  asaas_charge_id text NOT NULL,
  billing_type text NOT NULL CHECK (billing_type = ANY (ARRAY['PIX'::text, 'BOLETO'::text, 'CREDIT_CARD'::text])),
  status text NOT NULL,
  due_date date NOT NULL,
  value numeric NOT NULL,
  invoice_url text,
  pix_payload text,
  pix_qr_code text,
  boleto_url text,
  card_last4 text,
  card_brand text,
  raw_response jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  credential_id bigint,
  last_event text,
  payload jsonb,
  paid_at timestamp with time zone,
  CONSTRAINT asaas_charges_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.asaas_credentials (
  id integer NOT NULL DEFAULT nextval('asaas_credentials_id_seq'::regclass),
  integration_api_key_id bigint UNIQUE,
  webhook_secret text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  idempresa bigint,
  CONSTRAINT asaas_credentials_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.asaas_customers (
  cliente_id bigint NOT NULL,
  integration_api_key_id bigint NOT NULL,
  asaas_customer_id text,
  status text NOT NULL DEFAULT 'pending'::text,
  synced_at timestamp with time zone,
  last_payload jsonb,
  CONSTRAINT asaas_customers_pkey PRIMARY KEY (cliente_id, integration_api_key_id)
);
CREATE TABLE IF NOT EXISTS public.blog_posts (
  id uuid NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  content text,
  author text NOT NULL,
  published_at timestamp with time zone NOT NULL,
  read_time text NOT NULL,
  category integer NOT NULL,
  image text,
  slug text NOT NULL UNIQUE,
  tags ARRAY NOT NULL DEFAULT '{}'::text[],
  featured boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT blog_posts_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.categorias (
  id integer NOT NULL DEFAULT nextval('categorias_id_seq'::regclass),
  nome text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  datacriacao timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT categorias_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.categories (
  id integer NOT NULL DEFAULT nextval('categories_id_seq'::regclass),
  name text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT categories_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.chat_conversations (
  id text NOT NULL,
  contact_identifier text NOT NULL,
  contact_name text,
  contact_avatar text,
  short_status text,
  description text,
  pinned boolean NOT NULL DEFAULT false,
  unread_count integer NOT NULL DEFAULT 0,
  last_message_id text,
  last_message_preview text,
  last_message_timestamp timestamp with time zone,
  last_message_sender text,
  last_message_type text,
  last_message_status text,
  metadata jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  phone_number text,
  responsible_id integer,
  responsible_snapshot jsonb,
  tags jsonb,
  client_name text,
  is_linked_to_client boolean NOT NULL DEFAULT false,
  custom_attributes jsonb,
  is_private boolean NOT NULL DEFAULT false,
  internal_notes jsonb,
  client_id integer,
  credential_id text,
  wa_chat_id text,
  CONSTRAINT chat_conversations_pkey PRIMARY KEY (id),
  CONSTRAINT chat_conversations_client_fk FOREIGN KEY (client_id) REFERENCES public.clientes(id)
);
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id text NOT NULL,
  conversation_id text NOT NULL,
  external_id text,
  client_message_id text,
  sender text NOT NULL,
  content text NOT NULL,
  message_type text NOT NULL,
  status text NOT NULL,
  timestamp timestamp with time zone NOT NULL,
  attachments jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  deleted_by text,
  reaction text,
  CONSTRAINT chat_messages_pkey PRIMARY KEY (id),
  CONSTRAINT chat_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.chat_conversations(id)
);
CREATE TABLE IF NOT EXISTS public.cliente_atributos (
  id bigint NOT NULL DEFAULT nextval('cliente_atributos_id_seq'::regclass),
  idclientes bigint NOT NULL,
  idtipodocumento integer NOT NULL,
  valor text NOT NULL,
  datacadastro time with time zone NOT NULL DEFAULT now(),
  CONSTRAINT cliente_atributos_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.cliente_documento (
  id integer NOT NULL DEFAULT nextval('cliente_documento_id_seq'::regclass),
  cliente_id integer NOT NULL,
  tipo_documento_id integer NOT NULL,
  nome_arquivo character varying NOT NULL,
  arquivo_base64 text NOT NULL,
  data_upload timestamp without time zone DEFAULT now(),
  CONSTRAINT cliente_documento_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.clientes (
  id integer NOT NULL DEFAULT nextval('clientes_id_seq'::regclass),
  nome character varying NOT NULL,
  tipo character varying NOT NULL,
  documento character varying,
  email character varying,
  telefone character varying,
  cep character varying,
  rua text,
  numero character varying,
  complemento text,
  bairro text,
  cidade text,
  uf character,
  ativo boolean NOT NULL DEFAULT true,
  idempresa integer,
  datacadastro timestamp without time zone NOT NULL DEFAULT now(),
  idusuario integer,
  updated_at timestamp without time zone,
  CONSTRAINT clientes_pkey PRIMARY KEY (id),
  CONSTRAINT clientes_empresas_fk FOREIGN KEY (idempresa) REFERENCES public.empresas(id)
);
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL,
  wa_chat_id text NOT NULL,
  contact_name text,
  contact_phone text,
  contact_image text,
  is_group boolean NOT NULL DEFAULT false,
  unread_count integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending'::text,
  assigned_to uuid,
  last_message_at timestamp with time zone,
  last_message_text text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT conversations_pkey PRIMARY KEY (id),
  CONSTRAINT conversations_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES public.instances(id)
);
CREATE TABLE IF NOT EXISTS public.email_confirmation_tokens (
  id integer NOT NULL DEFAULT nextval('email_confirmation_tokens_id_seq'::regclass),
  user_id integer NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamp with time zone NOT NULL,
  used_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT email_confirmation_tokens_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.empresas (
  id integer NOT NULL DEFAULT nextval('empresas_id_seq'::regclass),
  nome_empresa text NOT NULL,
  cnpj character varying UNIQUE,
  telefone character varying,
  email character varying,
  plano integer,
  responsavel integer,
  ativo boolean NOT NULL DEFAULT true,
  datacadastro timestamp without time zone NOT NULL DEFAULT now(),
  trial_started_at timestamp with time zone,
  trial_ends_at timestamp with time zone,
  current_period_start timestamp with time zone,
  current_period_end timestamp with time zone,
  grace_expires_at timestamp with time zone,
  subscription_cadence text DEFAULT 'monthly'::text CHECK (subscription_cadence = ANY (ARRAY['monthly'::text, 'annual'::text])),
  subscription_trial_ends_at timestamp with time zone,
  subscription_current_period_ends_at timestamp with time zone,
  subscription_grace_period_ends_at timestamp with time zone,
  asaas_subscription_id text,
  asaas_customer_id text,
  subscription_status text DEFAULT 'inactive'::text CHECK (subscription_status = ANY (ARRAY['pending'::text, 'active'::text, 'grace'::text, 'inactive'::text, 'overdue'::text])),
  subscription_pending_plan text,
  CONSTRAINT empresas_pkey PRIMARY KEY (id),
  CONSTRAINT empresas_plano_fkey FOREIGN KEY (plano) REFERENCES public.planos(id)
);
CREATE TABLE IF NOT EXISTS public.escritorios (
  id integer NOT NULL DEFAULT nextval('escritorios_id_seq'::regclass) UNIQUE,
  nome text NOT NULL,
  empresa integer NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  datacriacao timestamp without time zone NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.etiquetas (
  id integer NOT NULL DEFAULT nextval('etiquetas_id_seq'::regclass) UNIQUE,
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  datacriacao timestamp without time zone NOT NULL DEFAULT now(),
  exibe_pipeline boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL,
  id_fluxo_trabalho integer NOT NULL,
  idempresa integer
);
CREATE TABLE IF NOT EXISTS public.financial_flows (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  tipo text NOT NULL,
  conta_id uuid,
  categoria_id uuid,
  descricao text,
  vencimento date,
  pagamento date,
  competencia text,
  valor numeric NOT NULL,
  valor_pago numeric,
  status text DEFAULT 'pendente'::text,
  parcelas jsonb,
  recorrente boolean DEFAULT false,
  anexos jsonb DEFAULT '[]'::jsonb,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  external_provider text,
  external_reference_id text,
  cliente_id bigint,
  fornecedor_id bigint,
  idempresa integer,
  empresa_id bigint,
  empresa character varying,
  CONSTRAINT financial_flows_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.fluxo_trabalho (
  id integer NOT NULL DEFAULT nextval('fluxo_trabalho_id_seq'::regclass) UNIQUE,
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  datacriacao timestamp without time zone NOT NULL DEFAULT now(),
  exibe_menu boolean NOT NULL DEFAULT true,
  ordem integer,
  idempresa integer
);
CREATE TABLE IF NOT EXISTS public.fornecedores (
  id integer NOT NULL DEFAULT nextval('fornecedores_id_seq'::regclass),
  nome text NOT NULL,
  tipo text,
  documento text,
  email text,
  telefone text,
  cep text,
  rua text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  uf text,
  ativo boolean NOT NULL DEFAULT true,
  idempresa integer,
  datacadastro timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT fornecedores_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.instance_id_type (
  typname name
);
CREATE TABLE IF NOT EXISTS public.instances (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  uazapi_instance_id text NOT NULL,
  uazapi_token text,
  name text,
  status text DEFAULT 'disconnected'::text,
  qr_code text,
  phone_number text,
  profile_name text,
  profile_pic_url text,
  is_business boolean DEFAULT false,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT instances_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.integration_api_keys (
  id bigint NOT NULL DEFAULT nextval('integration_api_keys_id_seq'::regclass),
  provider text NOT NULL,
  url_api text,
  key_value text NOT NULL,
  environment text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  last_used timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  global boolean NOT NULL DEFAULT false,
  idempresa bigint,
  CONSTRAINT integration_api_keys_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.integration_webhook_deliveries (
  id bigint NOT NULL DEFAULT nextval('integration_webhook_deliveries_id_seq'::regclass),
  webhook_id bigint NOT NULL,
  empresa_id bigint NOT NULL,
  event text NOT NULL,
  body jsonb NOT NULL,
  occurred_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  delivered_at timestamp with time zone,
  delivery_attempts integer NOT NULL DEFAULT 0,
  last_error text,
  CONSTRAINT integration_webhook_deliveries_pkey PRIMARY KEY (id),
  CONSTRAINT integration_webhook_deliveries_webhook_id_fkey FOREIGN KEY (webhook_id) REFERENCES public.integration_webhooks(id)
);
CREATE TABLE IF NOT EXISTS public.integration_webhooks (
  id bigint NOT NULL DEFAULT nextval('integration_webhooks_id_seq'::regclass),
  name text NOT NULL,
  target_url text NOT NULL,
  events ARRAY NOT NULL DEFAULT '{}'::text[],
  secret text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  last_delivery timestamp with time zone,
  idempresa bigint,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT integration_webhooks_pkey PRIMARY KEY (id),
  CONSTRAINT integration_webhooks_idempresa_fkey FOREIGN KEY (idempresa) REFERENCES public.empresas(id)
);
CREATE TABLE IF NOT EXISTS public.integrations (
  id integer NOT NULL DEFAULT nextval('integrations_id_seq'::regclass),
  instance_name character varying NOT NULL,
  base_url text NOT NULL,
  owner character varying,
  token uuid NOT NULL UNIQUE,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  CONSTRAINT integrations_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.intimacoes (
  id bigint NOT NULL DEFAULT nextval('intimacoes_id_seq'::regclass),
  siglaTribunal text NOT NULL DEFAULT 'projudi'::text,
  external_id text NOT NULL,
  numero_processo text NOT NULL,
  nomeOrgao text,
  tipoComunicacao text,
  texto text,
  prazo timestamp with time zone,
  data_disponibilizacao date,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  meio character varying,
  link text,
  tipodocumento character varying,
  nomeclasse character varying,
  codigoclasse character varying,
  numerocomunicacao character varying,
  ativo boolean NOT NULL DEFAULT true,
  hash character varying,
  status character varying,
  motivo_cancelamento character varying,
  data_cancelamento timestamp without time zone,
  destinatarios ARRAY,
  destinatarios_advogados ARRAY,
  idusuario integer,
  idempresa integer,
  nao_lida boolean NOT NULL DEFAULT true,
  arquivada boolean NOT NULL DEFAULT false,
  idusuario_leitura bigint,
  lida_em timestamp with time zone,
  CONSTRAINT intimacoes_pkey PRIMARY KEY (id),
  CONSTRAINT intimacoes_empresas_fk FOREIGN KEY (idempresa) REFERENCES public.empresas(id),
  CONSTRAINT intimacoes_idusuario_fkey FOREIGN KEY (idusuario) REFERENCES public.usuarios(id)
);
CREATE TABLE IF NOT EXISTS public.labels (
  id text NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color text NOT NULL DEFAULT '#00a884'::text,
  company_id bigint,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT labels_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.message_attachments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL,
  chat_id text,
  media_url text,
  media_base64 text,
  media_type text,
  filename text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT message_attachments_pkey PRIMARY KEY (id),
  CONSTRAINT message_attachments_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.messages(id)
);
CREATE TABLE IF NOT EXISTS public.messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL,
  instance_id uuid,
  wa_message_id text,
  content text,
  message_type text NOT NULL DEFAULT 'text'::text,
  from_me boolean NOT NULL DEFAULT false,
  sender_id text,
  sender_name text,
  status text,
  is_private boolean NOT NULL DEFAULT false,
  edited_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT messages_pkey PRIMARY KEY (id),
  CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id),
  CONSTRAINT messages_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES public.instances(id)
);
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id text NOT NULL,
  preferences jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT notification_preferences_pkey PRIMARY KEY (user_id)
);
CREATE TABLE IF NOT EXISTS public.notifications (
  id bigint NOT NULL DEFAULT nextval('notifications_id_seq'::regclass),
  user_id text NOT NULL,
  category text NOT NULL,
  type text NOT NULL DEFAULT 'info'::text CHECK (type = ANY (ARRAY['info'::text, 'success'::text, 'warning'::text, 'error'::text])),
  title text NOT NULL,
  message text NOT NULL,
  metadata jsonb,
  action_url text,
  read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  read_at timestamp with time zone,
  CONSTRAINT notifications_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.oab_monitoradas (
  id bigint NOT NULL DEFAULT nextval('oab_monitoradas_id_seq'::regclass),
  empresa_id integer NOT NULL,
  usuario_id integer,
  tipo text NOT NULL,
  uf character NOT NULL,
  numero character varying NOT NULL,
  dias_semana ARRAY,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  sync_from date,
  CONSTRAINT oab_monitoradas_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.oportunidade_documentos (
  id integer NOT NULL DEFAULT nextval('oportunidade_documentos_id_seq'::regclass),
  oportunidade_id integer NOT NULL,
  template_id integer,
  title text NOT NULL,
  content text NOT NULL,
  variables jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT oportunidade_documentos_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.oportunidade_envolvidos (
  id integer NOT NULL DEFAULT nextval('oportunidade_envolvidos_id_seq'::regclass),
  oportunidade_id integer NOT NULL,
  nome text,
  documento text,
  telefone text,
  endereco text,
  relacao text,
  polo character varying,
  CONSTRAINT oportunidade_envolvidos_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.oportunidade_faturamentos (
  id integer NOT NULL DEFAULT nextval('oportunidade_faturamentos_id_seq'::regclass),
  oportunidade_id integer NOT NULL,
  forma_pagamento text NOT NULL,
  condicao_pagamento text,
  valor numeric,
  parcelas integer,
  observacoes text,
  data_faturamento timestamp with time zone DEFAULT now(),
  criado_em timestamp with time zone DEFAULT now(),
  CONSTRAINT oportunidade_faturamentos_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.oportunidade_parcelas (
  id integer NOT NULL DEFAULT nextval('oportunidade_parcelas_id_seq'::regclass),
  oportunidade_id integer NOT NULL,
  numero_parcela integer NOT NULL,
  valor numeric NOT NULL,
  valor_pago numeric DEFAULT 0,
  status text NOT NULL DEFAULT 'pendente'::text,
  data_prevista date,
  quitado_em timestamp with time zone,
  faturamento_id integer,
  criado_em timestamp with time zone DEFAULT now(),
  atualizado_em timestamp with time zone DEFAULT now(),
  idempresa integer,
  CONSTRAINT oportunidade_parcelas_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.oportunidade_sequence (
  empresa_id integer NOT NULL,
  atual integer NOT NULL,
  CONSTRAINT oportunidade_sequence_pkey PRIMARY KEY (empresa_id)
);
CREATE TABLE IF NOT EXISTS public.oportunidades (
  id integer NOT NULL DEFAULT nextval('oportunidades_id_seq'::regclass),
  tipo_processo_id integer NOT NULL,
  area_atuacao_id integer,
  responsavel_id integer,
  numero_processo_cnj text,
  numero_protocolo text,
  vara_ou_orgao text,
  comarca text,
  fase_id integer,
  etapa_id integer,
  prazo_proximo date,
  status_id integer,
  solicitante_id integer,
  valor_causa numeric,
  valor_honorarios numeric,
  percentual_honorarios numeric,
  forma_pagamento text,
  contingenciamento text,
  detalhes text,
  documentos_anexados integer,
  criado_por integer,
  data_criacao timestamp without time zone NOT NULL DEFAULT now(),
  ultima_atualizacao timestamp without time zone NOT NULL DEFAULT now(),
  qtde_parcelas integer,
  idempresa integer,
  sequencial_empresa integer NOT NULL,
  audiencia_data date,
  audiencia_horario time without time zone,
  audiencia_local text,
  valor_entrada numeric,
  CONSTRAINT oportunidades_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.ops_uaz_sse_tokens (
  credential_id text NOT NULL,
  sse_token text NOT NULL,
  sse_base_url text,
  CONSTRAINT ops_uaz_sse_tokens_pkey PRIMARY KEY (credential_id)
);
CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
  id integer NOT NULL DEFAULT nextval('password_reset_tokens_id_seq'::regclass),
  user_id integer NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamp with time zone NOT NULL,
  used_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.perfil_modulos (
  perfil_id integer NOT NULL,
  modulo text NOT NULL,
  CONSTRAINT perfil_modulos_pkey PRIMARY KEY (perfil_id, modulo)
);
CREATE TABLE IF NOT EXISTS public.perfis (
  id integer NOT NULL DEFAULT nextval('perfis_id_seq'::regclass) UNIQUE,
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  datacriacao timestamp without time zone NOT NULL DEFAULT now(),
  idempresa integer,
  ver_todas_conversas boolean NOT NULL DEFAULT true,
  empresa_id integer,
  CONSTRAINT perfis_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.pje_processo_documentos (
  id bigint NOT NULL DEFAULT nextval('pje_processo_documentos_id_seq'::regclass),
  processo_id bigint NOT NULL,
  numero_processo text NOT NULL,
  sequencia bigint,
  data_hora_juntada timestamp with time zone,
  id_codex bigint,
  id_origem text,
  nome text,
  nivel_sigilo text,
  tipo_codigo bigint,
  tipo_nome text,
  href_binario text,
  href_texto text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT pje_processo_documentos_pkey PRIMARY KEY (id),
  CONSTRAINT pje_processo_documentos_processo_id_fkey FOREIGN KEY (processo_id) REFERENCES public.pje_processos(id)
);
CREATE TABLE IF NOT EXISTS public.pje_processo_movimentos (
  id bigint NOT NULL DEFAULT nextval('pje_processo_movimentos_id_seq'::regclass),
  processo_id bigint NOT NULL,
  numero_processo text NOT NULL,
  data_hora timestamp with time zone,
  descricao text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT pje_processo_movimentos_pkey PRIMARY KEY (id),
  CONSTRAINT pje_processo_movimentos_processo_id_fkey FOREIGN KEY (processo_id) REFERENCES public.pje_processos(id)
);
CREATE TABLE IF NOT EXISTS public.pje_processo_partes (
  id bigint NOT NULL DEFAULT nextval('pje_processo_partes_id_seq'::regclass),
  processo_id bigint NOT NULL,
  numero_processo text NOT NULL,
  polo text,
  tipo_parte text,
  nome text,
  tipo_pessoa text,
  sigilosa boolean,
  documentos_principais jsonb,
  representantes jsonb,
  outros_nomes jsonb,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT pje_processo_partes_pkey PRIMARY KEY (id),
  CONSTRAINT pje_processo_partes_processo_id_fkey FOREIGN KEY (processo_id) REFERENCES public.pje_processos(id)
);
CREATE TABLE IF NOT EXISTS public.pje_processos (
  id bigint NOT NULL DEFAULT nextval('pje_processos_id_seq'::regclass),
  idempresa integer NOT NULL,
  idusuario integer NOT NULL,
  numero_processo text NOT NULL,
  sigla_tribunal text NOT NULL,
  nivel_sigilo integer,
  id_codex_tribunal bigint,
  data_ajuizamento timestamp with time zone,
  data_ultima_distribuicao timestamp with time zone,
  valor_acao numeric,
  permite_peticionar boolean NOT NULL DEFAULT false,
  orgao_julgador jsonb,
  grau jsonb,
  tribunal jsonb,
  classe jsonb,
  assunto jsonb,
  ultimo_movimento jsonb,
  ultimo_movimento_data timestamp with time zone,
  tramitacao_ativa jsonb,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  synced_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  semCliente text,
  cliente_id integer,
  CONSTRAINT pje_processos_pkey PRIMARY KEY (id),
  CONSTRAINT pje_processos_cliente_id_fkey FOREIGN KEY (cliente_id) REFERENCES public.clientes(id)
);
CREATE TABLE IF NOT EXISTS public.planos (
  id integer NOT NULL DEFAULT nextval('planos_id_seq'::regclass),
  nome text NOT NULL,
  valor_mensal numeric NOT NULL,
  valor_anual numeric NOT NULL,
  limite_processos integer,
  limite_usuarios integer,
  recursos text,
  modulos text DEFAULT '[]'::jsonb,
  limite_propostas integer,
  sincronizacao_processos_habilitada boolean NOT NULL DEFAULT true,
  sincronizacao_processos_limite integer,
  ativo boolean NOT NULL DEFAULT true,
  datacadastro timestamp without time zone NOT NULL DEFAULT now(),
  sincronizacao_processos_cota integer,
  max_propostas integer,
  limite_clientes integer,
  sincronizacao_intimacoes_habilitada boolean,
  sincronizacao_intimacoes_limite integer,
  limite_advogados_processos integer,
  limite_advogados_intimacao integer,
  modulos_jsonb jsonb,
  CONSTRAINT planos_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.planos_modulos_backup (
  id integer,
  modulos text,
  backup_at timestamp with time zone
);
CREATE TABLE IF NOT EXISTS public.process_sync (
  id bigint NOT NULL DEFAULT nextval('process_sync_id_seq'::regclass),
  processo_id integer,
  integration_api_key_id integer,
  remote_request_id text,
  request_type text NOT NULL DEFAULT 'manual'::text,
  requested_by integer,
  requested_at timestamp with time zone NOT NULL DEFAULT now(),
  request_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  request_headers jsonb,
  status text NOT NULL DEFAULT 'pending'::text,
  status_reason text,
  completed_at timestamp with time zone,
  metadata jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT process_sync_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.processo_consultas_api (
  id integer NOT NULL DEFAULT nextval('processo_consultas_api_id_seq'::regclass),
  processo_id integer NOT NULL,
  consultado_em timestamp without time zone NOT NULL DEFAULT now(),
  sucesso boolean NOT NULL DEFAULT true,
  detalhes text,
  CONSTRAINT processo_consultas_api_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.quick_answers (
  id integer NOT NULL DEFAULT nextval('quick_answers_id_seq'::regclass),
  empresa_id integer NOT NULL,
  shortcut text NOT NULL,
  message text NOT NULL,
  media_url text,
  media_type text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT quick_answers_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.schema_migrations (
  id integer NOT NULL DEFAULT nextval('schema_migrations_id_seq'::regclass),
  name text NOT NULL UNIQUE,
  applied_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT schema_migrations_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.sistema_cnj (
  id integer NOT NULL DEFAULT nextval('sistema_cnj_id_seq'::regclass),
  nome character varying NOT NULL,
  CONSTRAINT sistema_cnj_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.situacao_cliente (
  id integer NOT NULL DEFAULT nextval('situacao_cliente_id_seq'::regclass),
  nome text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  datacriacao timestamp without time zone NOT NULL DEFAULT now(),
  CONSTRAINT situacao_cliente_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.situacao_processo (
  id integer NOT NULL DEFAULT nextval('situacao_processo_id_seq'::regclass),
  nome text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  datacriacao timestamp without time zone NOT NULL DEFAULT now(),
  idempresa integer,
  CONSTRAINT situacao_processo_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.situacao_proposta (
  id integer NOT NULL DEFAULT nextval('situacao_proposta_id_seq'::regclass),
  nome text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  datacriacao timestamp without time zone NOT NULL DEFAULT now(),
  idempresa integer,
  CONSTRAINT situacao_proposta_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.support_request_attachments (
  id integer NOT NULL DEFAULT nextval('support_request_attachments_id_seq'::regclass),
  message_id integer NOT NULL,
  filename text NOT NULL,
  content_type text,
  file_size integer,
  data bytea NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT support_request_attachments_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.support_request_messages (
  id integer NOT NULL DEFAULT nextval('support_request_messages_id_seq'::regclass),
  support_request_id integer NOT NULL,
  sender text NOT NULL CHECK (sender = ANY (ARRAY['requester'::text, 'support'::text])),
  message text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT support_request_messages_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.support_requests (
  id integer NOT NULL DEFAULT nextval('support_requests_id_seq'::regclass),
  subject text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'open'::text CHECK (status = ANY (ARRAY['open'::text, 'in_progress'::text, 'resolved'::text, 'closed'::text])),
  requester_name text,
  requester_email text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  requester_id integer,
  support_agent_id integer,
  support_agent_name text,
  CONSTRAINT support_requests_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.sync_audit (
  id bigint NOT NULL DEFAULT nextval('sync_audit_id_seq'::regclass),
  processo_id integer,
  process_sync_id bigint,
  process_response_id bigint,
  integration_api_key_id integer,
  event_type text NOT NULL,
  event_details jsonb NOT NULL DEFAULT '{}'::jsonb,
  observed_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT sync_audit_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.sync_intimacoes_log (
  id bigint NOT NULL DEFAULT nextval('sync_intimacoes_log_id_seq'::regclass),
  execution_id uuid NOT NULL DEFAULT gen_random_uuid(),
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  finished_at timestamp with time zone,
  duration_ms integer,
  status text NOT NULL DEFAULT 'running'::text CHECK (status = ANY (ARRAY['running'::text, 'success'::text, 'partial_success'::text, 'failed'::text, 'skipped'::text])),
  erro text,
  total_oabs integer NOT NULL DEFAULT 0,
  processadas integer NOT NULL DEFAULT 0,
  enfileiradas integer NOT NULL DEFAULT 0,
  falhas integer NOT NULL DEFAULT 0,
  detalhes jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT sync_intimacoes_log_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.sync_processos_log (
  id bigint NOT NULL DEFAULT nextval('sync_processos_log_id_seq'::regclass),
  execution_id uuid NOT NULL DEFAULT gen_random_uuid(),
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  finished_at timestamp with time zone,
  duration_ms integer,
  status text NOT NULL DEFAULT 'running'::text CHECK (status = ANY (ARRAY['running'::text, 'success'::text, 'partial_success'::text, 'failed'::text, 'skipped'::text])),
  erro text,
  total_oabs integer NOT NULL DEFAULT 0,
  processadas integer NOT NULL DEFAULT 0,
  enfileiradas integer NOT NULL DEFAULT 0,
  falhas integer NOT NULL DEFAULT 0,
  detalhes jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT sync_processos_log_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.tags (
  id integer NOT NULL DEFAULT nextval('tags_id_seq'::regclass),
  key text NOT NULL,
  label text NOT NULL,
  example text,
  group_name text,
  CONSTRAINT tags_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.tarefas (
  id integer NOT NULL DEFAULT nextval('tarefas_id_seq'::regclass),
  id_oportunidades integer,
  titulo text NOT NULL,
  descricao text,
  data date NOT NULL,
  hora time without time zone,
  dia_inteiro boolean DEFAULT false,
  prioridade integer CHECK (prioridade >= 1 AND prioridade <= 5),
  mostrar_na_agenda boolean DEFAULT true,
  privada boolean DEFAULT true,
  recorrente boolean DEFAULT false,
  repetir_quantas_vezes integer DEFAULT 1,
  repetir_cada_unidade text CHECK (repetir_cada_unidade = ANY (ARRAY['Minutos'::text, 'Horas'::text, 'Dias'::text, 'Semanas'::text, 'Meses'::text])),
  repetir_intervalo integer DEFAULT 1,
  criado_em timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  atualizado_em timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  concluido boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  idempresa integer NOT NULL,
  idusuario integer NOT NULL,
  CONSTRAINT tarefas_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.tarefas_responsaveis (
  id_tarefa integer NOT NULL,
  id_usuario integer NOT NULL,
  CONSTRAINT tarefas_responsaveis_pkey PRIMARY KEY (id_tarefa, id_usuario)
);
CREATE TABLE IF NOT EXISTS public.templates (
  id integer NOT NULL DEFAULT nextval('templates_id_seq'::regclass) UNIQUE,
  title text NOT NULL,
  content text NOT NULL,
  datacriacao timestamp without time zone NOT NULL DEFAULT now(),
  idempresa integer,
  idusuario integer
);
CREATE TABLE IF NOT EXISTS public.tipo_documento (
  id integer NOT NULL DEFAULT nextval('tipo_documento_id_seq'::regclass),
  nome character varying NOT NULL,
  ativo boolean DEFAULT true,
  datacriacao timestamp without time zone DEFAULT now(),
  idempresa integer,
  CONSTRAINT tipo_documento_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.tipo_envolvimento (
  id integer NOT NULL DEFAULT nextval('tipo_envolvimento_id_seq'::regclass),
  descricao text NOT NULL,
  CONSTRAINT tipo_envolvimento_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.tipo_evento (
  id integer NOT NULL DEFAULT nextval('tipo_evento_id_seq'::regclass) UNIQUE,
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  datacriacao timestamp without time zone NOT NULL DEFAULT now(),
  agenda boolean NOT NULL DEFAULT true,
  tarefa boolean NOT NULL DEFAULT true,
  idempresa integer
);
CREATE TABLE IF NOT EXISTS public.tipo_processo (
  id integer NOT NULL DEFAULT nextval('tipo_processo_id_seq'::regclass) UNIQUE,
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  datacriacao timestamp without time zone NOT NULL DEFAULT now(),
  idempresa integer,
  idareaatuacao integer
);
CREATE TABLE IF NOT EXISTS public.token_jusbr (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  access_token text,
  expires_in integer,
  refresh_expires_in integer,
  refresh_token text,
  token_type character varying,
  id_token text NOT NULL,
  not-before-policy integer,
  session_state character varying,
  scope character varying,
  expired boolean NOT NULL,
  datatimerenewal timestamp without time zone NOT NULL,
  timestamp_expirate timestamp without time zone,
  CONSTRAINT token_jusbr_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.trigger_movimentacao_processo (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  numero_cnj character varying,
  instancia_processo integer,
  tipo_andamento character varying,
  descricao text,
  sigiloso boolean DEFAULT false,
  data_movimentacao timestamp without time zone,
  data_cadastro timestamp without time zone NOT NULL DEFAULT now(),
  cnj_norm text DEFAULT regexp_replace((numero_cnj)::text, '\D'::text, ''::text, 'g'::text),
  CONSTRAINT trigger_movimentacao_processo_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.trigger_sincronizar_processo (
  request_id uuid NOT NULL,
  on_demand boolean NOT NULL,
  search_type character varying NOT NULL,
  search_key character varying NOT NULL,
  response_type character varying NOT NULL,
  with_attachments boolean NOT NULL,
  user_id uuid NOT NULL,
  status character varying NOT NULL,
  created_at timestamp without time zone NOT NULL,
  updated_at timestamp without time zone,
  CONSTRAINT trigger_sincronizar_processo_pkey PRIMARY KEY (request_id)
);
CREATE TABLE IF NOT EXISTS public.uaz_credentials (
  id text NOT NULL,
  empresa_id bigint,
  subdomain text NOT NULL,
  token text NOT NULL,
  status text,
  webhook_id text,
  webhook_url text,
  qr_code text,
  pair_code text,
  profile_name text,
  phone_number text,
  connected boolean NOT NULL DEFAULT false,
  sse_token text,
  sse_base_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT uaz_credentials_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.uazapi_conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  instance_id uuid NOT NULL,
  wa_chat_id text NOT NULL,
  contact_name text,
  contact_phone text NOT NULL,
  contact_image text,
  is_group boolean DEFAULT false,
  status text,
  unread_count integer DEFAULT 0,
  last_message_text text,
  last_message_at timestamp with time zone,
  assigned_to uuid,
  tags text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  contact_display_name text,
  desativar_bot boolean NOT NULL DEFAULT false,
  CONSTRAINT uazapi_conversations_pkey PRIMARY KEY (id),
  CONSTRAINT conversations_instance_id_fkey FOREIGN KEY (instance_id) REFERENCES public.uazapi_instances(id)
);
CREATE TABLE IF NOT EXISTS public.uazapi_instances (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone_number text,
  status text,
  uazapi_instance_id text UNIQUE,
  uazapi_token text,
  qr_code text,
  profile_name text,
  profile_pic_url text,
  is_business boolean DEFAULT false,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT uazapi_instances_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.uazapi_message_attachments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL,
  media_url text,
  media_type text,
  filename text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  media_base64 text,
  chat_id text,
  CONSTRAINT uazapi_message_attachments_pkey PRIMARY KEY (id),
  CONSTRAINT message_attachments_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.uazapi_messages(id)
);
CREATE TABLE IF NOT EXISTS public.uazapi_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL,
  wa_message_id text UNIQUE,
  sender_id text,
  sender_name text,
  content text,
  message_type text DEFAULT 'text'::text,
  from_me boolean DEFAULT false,
  status text DEFAULT 'sent'::text,
  quoted_message_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  is_private boolean NOT NULL DEFAULT false,
  edited_at timestamp with time zone,
  CONSTRAINT uazapi_messages_pkey PRIMARY KEY (id),
  CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.uazapi_conversations(id),
  CONSTRAINT messages_quoted_message_id_fkey FOREIGN KEY (quoted_message_id) REFERENCES public.uazapi_messages(id)
);
CREATE TABLE IF NOT EXISTS public.user_profile_audit_logs (
  id bigint NOT NULL DEFAULT nextval('user_profile_audit_logs_id_seq'::regclass),
  user_id integer NOT NULL,
  action text NOT NULL,
  description text NOT NULL,
  performed_by integer,
  performed_by_name text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_profile_audit_logs_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.user_profile_sessions (
  id bigint NOT NULL DEFAULT nextval('user_profile_sessions_id_seq'::regclass),
  user_id integer NOT NULL,
  device text NOT NULL,
  location text,
  last_activity timestamp with time zone NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  revoked_at timestamp with time zone,
  is_approved boolean NOT NULL DEFAULT false,
  approved_at timestamp with time zone,
  CONSTRAINT user_profile_sessions_pkey PRIMARY KEY (id)
);
CREATE TABLE IF NOT EXISTS public.user_profiles (
  user_id uuid NOT NULL,
  title text,
  bio text,
  office text,
  oab_number text,
  oab_uf text,
  specialties ARRAY NOT NULL DEFAULT ARRAY[]::text[],
  hourly_rate numeric,
  timezone text,
  language text,
  linkedin_url text,
  website_url text,
  address_street text,
  address_city text,
  address_state text,
  address_zip text,
  notifications_security_alerts boolean NOT NULL DEFAULT true,
  notifications_agenda_reminders boolean NOT NULL DEFAULT true,
  notifications_newsletter boolean NOT NULL DEFAULT false,
  security_two_factor boolean NOT NULL DEFAULT false,
  security_login_alerts boolean NOT NULL DEFAULT false,
  security_device_approval boolean NOT NULL DEFAULT false,
  avatar_url text,
  member_since timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  security_two_factor_secret text,
  security_two_factor_activated_at timestamp with time zone,
  security_two_factor_backup_codes ARRAY NOT NULL DEFAULT ARRAY[]::text[],
  CONSTRAINT user_profiles_pkey PRIMARY KEY (user_id)
);
CREATE TABLE IF NOT EXISTS public.usuarios (
  id integer NOT NULL DEFAULT nextval('usuarios_id_seq'::regclass),
  nome_completo text NOT NULL,
  cpf character varying UNIQUE,
  email character varying NOT NULL UNIQUE,
  perfil integer NOT NULL,
  empresa integer NOT NULL,
  setor integer,
  status boolean NOT NULL DEFAULT true,
  senha character varying,
  telefone character varying,
  ultimo_login timestamp without time zone,
  observacoes text,
  datacriacao timestamp without time zone NOT NULL DEFAULT now(),
  must_change_password boolean,
  email_confirmed_at timestamp without time zone,
  welcome_email_pending boolean NOT NULL DEFAULT false,
  auth_user_id uuid,
  empresa_id integer,
  perfil_id integer,
  ativo boolean NOT NULL DEFAULT true,
  oab character varying,
  CONSTRAINT usuarios_pkey PRIMARY KEY (id),
  CONSTRAINT usuarios_auth_user_id_fkey FOREIGN KEY (auth_user_id) REFERENCES auth.users(id),
  CONSTRAINT usuarios_empresa_fkey FOREIGN KEY (empresa) REFERENCES public.empresas(id),
  CONSTRAINT usuarios_perfil_fkey FOREIGN KEY (perfil) REFERENCES public.perfis(id)
);
CREATE TABLE IF NOT EXISTS public.webhook_logs (
  id bigint NOT NULL DEFAULT nextval('webhook_logs_id_seq'::regclass),
  instance_token character varying NOT NULL,
  event_type character varying,
  payload jsonb,
  received_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT webhook_logs_pkey PRIMARY KEY (id)
);
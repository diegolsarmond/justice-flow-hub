
-- Financial tables
CREATE TABLE IF NOT EXISTS public.accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  bank text,
  agency text,
  number text,
  currency text DEFAULT 'BRL',
  initial_balance numeric DEFAULT 0,
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  idempresa bigint
);

CREATE TABLE IF NOT EXISTS public.financial_flows (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipo text NOT NULL,
  conta_id uuid,
  categoria_id uuid,
  descricao text,
  vencimento date,
  pagamento date,
  competencia text,
  valor numeric NOT NULL,
  valor_pago numeric,
  status text DEFAULT 'pendente',
  parcelas jsonb,
  recorrente boolean DEFAULT FALSE,
  anexos jsonb DEFAULT '[]',
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  external_provider text,
  external_reference_id text,
  cliente_id bigint,
  fornecedor_id bigint,
  idempresa integer,
  empresa_id bigint,
  empresa varchar
);

-- Asaas tables
CREATE SEQUENCE IF NOT EXISTS asaas_charges_id_seq;
CREATE SEQUENCE IF NOT EXISTS asaas_credentials_id_seq;

CREATE TABLE IF NOT EXISTS public.asaas_credentials (
  id integer NOT NULL DEFAULT nextval('asaas_credentials_id_seq') PRIMARY KEY,
  integration_api_key_id bigint UNIQUE,
  webhook_secret text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  idempresa bigint
);

CREATE TABLE IF NOT EXISTS public.asaas_charges (
  id bigint NOT NULL DEFAULT nextval('asaas_charges_id_seq') PRIMARY KEY,
  financial_flow_id text NOT NULL UNIQUE,
  cliente_id integer,
  integration_api_key_id bigint,
  asaas_charge_id text NOT NULL,
  billing_type text NOT NULL,
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
  paid_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.asaas_customers (
  cliente_id bigint NOT NULL,
  integration_api_key_id bigint NOT NULL,
  asaas_customer_id text,
  status text NOT NULL DEFAULT 'pending',
  synced_at timestamp with time zone,
  last_payload jsonb,
  PRIMARY KEY (cliente_id, integration_api_key_id)
);

-- Integration tables
CREATE SEQUENCE IF NOT EXISTS integration_api_keys_id_seq;
CREATE SEQUENCE IF NOT EXISTS integration_webhooks_id_seq;
CREATE SEQUENCE IF NOT EXISTS integration_webhook_deliveries_id_seq;
CREATE SEQUENCE IF NOT EXISTS integrations_id_seq;

CREATE TABLE IF NOT EXISTS public.integration_api_keys (
  id bigint NOT NULL DEFAULT nextval('integration_api_keys_id_seq') PRIMARY KEY,
  provider text NOT NULL,
  url_api text,
  key_value text NOT NULL,
  environment text NOT NULL,
  active boolean NOT NULL DEFAULT TRUE,
  last_used timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  global boolean NOT NULL DEFAULT FALSE,
  idempresa bigint
);

CREATE TABLE IF NOT EXISTS public.integration_webhooks (
  id bigint NOT NULL DEFAULT nextval('integration_webhooks_id_seq') PRIMARY KEY,
  name text NOT NULL,
  target_url text NOT NULL,
  events text[] NOT NULL DEFAULT '{}',
  secret text NOT NULL,
  active boolean NOT NULL DEFAULT TRUE,
  last_delivery timestamp with time zone,
  idempresa bigint REFERENCES public.empresas(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.integration_webhook_deliveries (
  id bigint NOT NULL DEFAULT nextval('integration_webhook_deliveries_id_seq') PRIMARY KEY,
  webhook_id bigint NOT NULL REFERENCES public.integration_webhooks(id),
  empresa_id bigint NOT NULL,
  event text NOT NULL,
  body jsonb NOT NULL,
  occurred_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  delivered_at timestamp with time zone,
  delivery_attempts integer NOT NULL DEFAULT 0,
  last_error text
);

CREATE TABLE IF NOT EXISTS public.integrations (
  id integer NOT NULL DEFAULT nextval('integrations_id_seq') PRIMARY KEY,
  instance_name varchar NOT NULL,
  base_url text NOT NULL,
  owner varchar,
  token uuid NOT NULL UNIQUE,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now()
);

-- API config
CREATE TABLE IF NOT EXISTS public.api_config (
  id integer NOT NULL DEFAULT 1 PRIMARY KEY,
  uazapi_url text,
  uazapi_admin_token text,
  updated_at timestamp with time zone DEFAULT now()
);

-- Sync tables
CREATE SEQUENCE IF NOT EXISTS process_sync_id_seq;
CREATE SEQUENCE IF NOT EXISTS processo_consultas_api_id_seq;
CREATE SEQUENCE IF NOT EXISTS sync_audit_id_seq;
CREATE SEQUENCE IF NOT EXISTS sync_intimacoes_log_id_seq;
CREATE SEQUENCE IF NOT EXISTS sync_processos_log_id_seq;
CREATE SEQUENCE IF NOT EXISTS webhook_logs_id_seq;

CREATE TABLE IF NOT EXISTS public.process_sync (
  id bigint NOT NULL DEFAULT nextval('process_sync_id_seq') PRIMARY KEY,
  processo_id integer,
  integration_api_key_id integer,
  remote_request_id text,
  request_type text NOT NULL DEFAULT 'manual',
  requested_by integer,
  requested_at timestamp with time zone NOT NULL DEFAULT now(),
  request_payload jsonb NOT NULL DEFAULT '{}',
  request_headers jsonb,
  status text NOT NULL DEFAULT 'pending',
  status_reason text,
  completed_at timestamp with time zone,
  metadata jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.processo_consultas_api (
  id integer NOT NULL DEFAULT nextval('processo_consultas_api_id_seq') PRIMARY KEY,
  processo_id integer NOT NULL,
  consultado_em timestamp without time zone NOT NULL DEFAULT now(),
  sucesso boolean NOT NULL DEFAULT TRUE,
  detalhes text
);

CREATE TABLE IF NOT EXISTS public.sync_audit (
  id bigint NOT NULL DEFAULT nextval('sync_audit_id_seq') PRIMARY KEY,
  processo_id integer,
  process_sync_id bigint,
  process_response_id bigint,
  integration_api_key_id integer,
  event_type text NOT NULL,
  event_details jsonb NOT NULL DEFAULT '{}',
  observed_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sync_intimacoes_log (
  id bigint NOT NULL DEFAULT nextval('sync_intimacoes_log_id_seq') PRIMARY KEY,
  execution_id uuid NOT NULL DEFAULT gen_random_uuid(),
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  finished_at timestamp with time zone,
  duration_ms integer,
  status text NOT NULL DEFAULT 'running',
  erro text,
  total_oabs integer NOT NULL DEFAULT 0,
  processadas integer NOT NULL DEFAULT 0,
  enfileiradas integer NOT NULL DEFAULT 0,
  falhas integer NOT NULL DEFAULT 0,
  detalhes jsonb NOT NULL DEFAULT '[]',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sync_processos_log (
  id bigint NOT NULL DEFAULT nextval('sync_processos_log_id_seq') PRIMARY KEY,
  execution_id uuid NOT NULL DEFAULT gen_random_uuid(),
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  finished_at timestamp with time zone,
  duration_ms integer,
  status text NOT NULL DEFAULT 'running',
  erro text,
  total_oabs integer NOT NULL DEFAULT 0,
  processadas integer NOT NULL DEFAULT 0,
  enfileiradas integer NOT NULL DEFAULT 0,
  falhas integer NOT NULL DEFAULT 0,
  detalhes jsonb NOT NULL DEFAULT '[]',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.webhook_logs (
  id bigint NOT NULL DEFAULT nextval('webhook_logs_id_seq') PRIMARY KEY,
  instance_token varchar NOT NULL,
  event_type varchar,
  payload jsonb,
  received_at timestamp without time zone DEFAULT now()
);

-- Support tables
CREATE SEQUENCE IF NOT EXISTS support_requests_id_seq;
CREATE SEQUENCE IF NOT EXISTS support_request_messages_id_seq;
CREATE SEQUENCE IF NOT EXISTS support_request_attachments_id_seq;

CREATE TABLE IF NOT EXISTS public.support_requests (
  id integer NOT NULL DEFAULT nextval('support_requests_id_seq') PRIMARY KEY,
  subject text NOT NULL,
  description text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  requester_name text,
  requester_email text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  requester_id integer,
  support_agent_id integer,
  support_agent_name text
);

CREATE TABLE IF NOT EXISTS public.support_request_messages (
  id integer NOT NULL DEFAULT nextval('support_request_messages_id_seq') PRIMARY KEY,
  support_request_id integer NOT NULL,
  sender text NOT NULL,
  message text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.support_request_attachments (
  id integer NOT NULL DEFAULT nextval('support_request_attachments_id_seq') PRIMARY KEY,
  message_id integer NOT NULL,
  filename text NOT NULL,
  content_type text,
  file_size integer,
  data bytea NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- User profile tables
CREATE TABLE IF NOT EXISTS public.user_profiles (
  user_id uuid NOT NULL PRIMARY KEY,
  title text,
  bio text,
  office text,
  oab_number text,
  oab_uf text,
  specialties text[] NOT NULL DEFAULT ARRAY[]::text[],
  hourly_rate numeric,
  timezone text,
  language text,
  linkedin_url text,
  website_url text,
  address_street text,
  address_city text,
  address_state text,
  address_zip text,
  notifications_security_alerts boolean NOT NULL DEFAULT TRUE,
  notifications_agenda_reminders boolean NOT NULL DEFAULT TRUE,
  notifications_newsletter boolean NOT NULL DEFAULT FALSE,
  security_two_factor boolean NOT NULL DEFAULT FALSE,
  security_login_alerts boolean NOT NULL DEFAULT FALSE,
  security_device_approval boolean NOT NULL DEFAULT FALSE,
  avatar_url text,
  member_since timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  security_two_factor_secret text,
  security_two_factor_activated_at timestamp with time zone,
  security_two_factor_backup_codes text[] NOT NULL DEFAULT ARRAY[]::text[]
);

CREATE SEQUENCE IF NOT EXISTS user_profile_audit_logs_id_seq;
CREATE SEQUENCE IF NOT EXISTS user_profile_sessions_id_seq;

CREATE TABLE IF NOT EXISTS public.user_profile_audit_logs (
  id bigint NOT NULL DEFAULT nextval('user_profile_audit_logs_id_seq') PRIMARY KEY,
  user_id integer NOT NULL,
  action text NOT NULL,
  description text NOT NULL,
  performed_by integer,
  performed_by_name text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_profile_sessions (
  id bigint NOT NULL DEFAULT nextval('user_profile_sessions_id_seq') PRIMARY KEY,
  user_id integer NOT NULL,
  device text NOT NULL,
  location text,
  last_activity timestamp with time zone NOT NULL DEFAULT now(),
  is_active boolean NOT NULL DEFAULT TRUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  revoked_at timestamp with time zone,
  is_approved boolean NOT NULL DEFAULT FALSE,
  approved_at timestamp with time zone
);

-- Auth tokens
CREATE SEQUENCE IF NOT EXISTS email_confirmation_tokens_id_seq;
CREATE SEQUENCE IF NOT EXISTS password_reset_tokens_id_seq;
CREATE SEQUENCE IF NOT EXISTS schema_migrations_id_seq;

CREATE TABLE IF NOT EXISTS public.email_confirmation_tokens (
  id integer NOT NULL DEFAULT nextval('email_confirmation_tokens_id_seq') PRIMARY KEY,
  user_id integer NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamp with time zone NOT NULL,
  used_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
  id integer NOT NULL DEFAULT nextval('password_reset_tokens_id_seq') PRIMARY KEY,
  user_id integer NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamp with time zone NOT NULL,
  used_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.schema_migrations (
  id integer NOT NULL DEFAULT nextval('schema_migrations_id_seq') PRIMARY KEY,
  name text NOT NULL UNIQUE,
  applied_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Blog
CREATE TABLE IF NOT EXISTS public.blog_posts (
  id uuid NOT NULL PRIMARY KEY,
  title text NOT NULL,
  description text NOT NULL,
  content text,
  author text NOT NULL,
  published_at timestamp with time zone NOT NULL,
  read_time text NOT NULL,
  category integer NOT NULL,
  image text,
  slug text NOT NULL UNIQUE,
  tags text[] NOT NULL DEFAULT '{}',
  featured boolean NOT NULL DEFAULT FALSE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Trigger tables
CREATE TABLE IF NOT EXISTS public.trigger_movimentacao_processo (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  numero_cnj varchar,
  instancia_processo integer,
  tipo_andamento varchar,
  descricao text,
  sigiloso boolean DEFAULT FALSE,
  data_movimentacao timestamp without time zone,
  data_cadastro timestamp without time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.trigger_sincronizar_processo (
  request_id uuid NOT NULL PRIMARY KEY,
  on_demand boolean NOT NULL,
  search_type varchar NOT NULL,
  search_key varchar NOT NULL,
  response_type varchar NOT NULL,
  with_attachments boolean NOT NULL,
  user_id uuid NOT NULL,
  status varchar NOT NULL,
  created_at timestamp without time zone NOT NULL,
  updated_at timestamp without time zone
);

-- Enable RLS on all new tables
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asaas_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asaas_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asaas_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.process_sync ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processo_consultas_api ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_intimacoes_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_processos_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_request_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_request_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profile_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profile_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_confirmation_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schema_migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trigger_movimentacao_processo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trigger_sincronizar_processo ENABLE ROW LEVEL SECURITY;

-- RLS policies for remaining tables
CREATE POLICY "Members view" ON public.accounts FOR SELECT TO authenticated USING (public.is_office_member());
CREATE POLICY "Admins manage" ON public.accounts FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Members view" ON public.financial_flows FOR SELECT TO authenticated USING (public.is_office_member());
CREATE POLICY "Members manage" ON public.financial_flows FOR ALL TO authenticated USING (public.is_office_member());
CREATE POLICY "Admins manage" ON public.asaas_credentials FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Members view" ON public.asaas_charges FOR SELECT TO authenticated USING (public.is_office_member());
CREATE POLICY "Admins manage" ON public.asaas_charges FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Members view" ON public.asaas_customers FOR SELECT TO authenticated USING (public.is_office_member());
CREATE POLICY "Admins manage" ON public.asaas_customers FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Admins manage" ON public.integration_api_keys FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Admins manage" ON public.integration_webhooks FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Admins manage" ON public.integration_webhook_deliveries FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Admins manage" ON public.integrations FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Admins manage" ON public.api_config FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Members view" ON public.process_sync FOR SELECT TO authenticated USING (public.is_office_member());
CREATE POLICY "Admins manage" ON public.process_sync FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Members view" ON public.processo_consultas_api FOR SELECT TO authenticated USING (public.is_office_member());
CREATE POLICY "Admins manage" ON public.sync_audit FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Admins manage" ON public.sync_intimacoes_log FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Admins manage" ON public.sync_processos_log FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Admins manage" ON public.webhook_logs FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Members view" ON public.support_requests FOR SELECT TO authenticated USING (public.is_office_member());
CREATE POLICY "Members manage" ON public.support_requests FOR ALL TO authenticated USING (public.is_office_member());
CREATE POLICY "Members view" ON public.support_request_messages FOR SELECT TO authenticated USING (public.is_office_member());
CREATE POLICY "Members manage" ON public.support_request_messages FOR ALL TO authenticated USING (public.is_office_member());
CREATE POLICY "Members view" ON public.support_request_attachments FOR SELECT TO authenticated USING (public.is_office_member());
CREATE POLICY "Members manage" ON public.support_request_attachments FOR ALL TO authenticated USING (public.is_office_member());
CREATE POLICY "Users view own" ON public.user_profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users update own" ON public.user_profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins manage" ON public.user_profiles FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Members view" ON public.user_profile_audit_logs FOR SELECT TO authenticated USING (public.is_office_member());
CREATE POLICY "Admins manage" ON public.user_profile_audit_logs FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Members view" ON public.user_profile_sessions FOR SELECT TO authenticated USING (public.is_office_member());
CREATE POLICY "Admins manage" ON public.user_profile_sessions FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Admins manage" ON public.email_confirmation_tokens FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Admins manage" ON public.password_reset_tokens FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Admins manage" ON public.schema_migrations FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Anyone can view" ON public.blog_posts FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage" ON public.blog_posts FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Admins manage" ON public.trigger_movimentacao_processo FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Admins manage" ON public.trigger_sincronizar_processo FOR ALL TO authenticated USING (public.is_admin());

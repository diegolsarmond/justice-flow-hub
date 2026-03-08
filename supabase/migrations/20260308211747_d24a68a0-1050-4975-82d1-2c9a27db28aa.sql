
-- Drop existing tables that conflict with the external schema
-- (they use UUID IDs, external uses integer serial IDs)
DROP TABLE IF EXISTS public.partes_processo CASCADE;
DROP TABLE IF EXISTS public.prazos CASCADE;
DROP TABLE IF EXISTS public.intimacoes CASCADE;
DROP TABLE IF EXISTS public.tarefas CASCADE;
DROP TABLE IF EXISTS public.processos CASCADE;
DROP TABLE IF EXISTS public.clientes CASCADE;
DROP TABLE IF EXISTS public.api_tokens CASCADE;

-- Create sequences
CREATE SEQUENCE IF NOT EXISTS planos_id_seq;
CREATE SEQUENCE IF NOT EXISTS empresas_id_seq;
CREATE SEQUENCE IF NOT EXISTS perfis_id_seq;
CREATE SEQUENCE IF NOT EXISTS usuarios_id_seq;

-- Core: planos
CREATE TABLE IF NOT EXISTS public.planos (
  id integer NOT NULL DEFAULT nextval('planos_id_seq') PRIMARY KEY,
  nome text NOT NULL,
  valor_mensal numeric NOT NULL,
  valor_anual numeric NOT NULL,
  limite_processos integer,
  limite_usuarios integer,
  recursos text,
  modulos text DEFAULT '[]',
  limite_propostas integer,
  sincronizacao_processos_habilitada boolean NOT NULL DEFAULT TRUE,
  sincronizacao_processos_limite integer,
  ativo boolean NOT NULL DEFAULT TRUE,
  datacadastro timestamp without time zone NOT NULL DEFAULT now(),
  sincronizacao_processos_cota integer,
  max_propostas integer,
  limite_clientes integer,
  sincronizacao_intimacoes_habilitada boolean,
  sincronizacao_intimacoes_limite integer,
  limite_advogados_processos integer,
  limite_advogados_intimacao integer,
  modulos_jsonb jsonb
);

-- Core: empresas
CREATE TABLE IF NOT EXISTS public.empresas (
  id integer NOT NULL DEFAULT nextval('empresas_id_seq') PRIMARY KEY,
  nome_empresa text NOT NULL,
  cnpj varchar UNIQUE,
  telefone varchar,
  email varchar,
  plano integer REFERENCES public.planos(id),
  responsavel integer,
  ativo boolean NOT NULL DEFAULT TRUE,
  datacadastro timestamp without time zone NOT NULL DEFAULT now(),
  trial_started_at timestamp with time zone,
  trial_ends_at timestamp with time zone,
  current_period_start timestamp with time zone,
  current_period_end timestamp with time zone,
  grace_expires_at timestamp with time zone,
  subscription_cadence text DEFAULT 'monthly',
  subscription_trial_ends_at timestamp with time zone,
  subscription_current_period_ends_at timestamp with time zone,
  subscription_grace_period_ends_at timestamp with time zone,
  asaas_subscription_id text,
  asaas_customer_id text,
  subscription_status text DEFAULT 'inactive',
  subscription_pending_plan text
);

-- Core: perfis
CREATE TABLE IF NOT EXISTS public.perfis (
  id integer NOT NULL DEFAULT nextval('perfis_id_seq') PRIMARY KEY,
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT TRUE,
  datacriacao timestamp without time zone NOT NULL DEFAULT now(),
  idempresa integer,
  ver_todas_conversas boolean NOT NULL DEFAULT TRUE,
  empresa_id integer
);

-- Core: usuarios
CREATE TABLE IF NOT EXISTS public.usuarios (
  id integer NOT NULL DEFAULT nextval('usuarios_id_seq') PRIMARY KEY,
  nome_completo text NOT NULL,
  cpf varchar UNIQUE,
  email varchar NOT NULL UNIQUE,
  perfil integer NOT NULL REFERENCES public.perfis(id),
  empresa integer NOT NULL REFERENCES public.empresas(id),
  setor integer,
  status boolean NOT NULL DEFAULT TRUE,
  senha varchar,
  telefone varchar,
  ultimo_login timestamp without time zone,
  observacoes text,
  datacriacao timestamp without time zone NOT NULL DEFAULT now(),
  must_change_password boolean,
  email_confirmed_at timestamp without time zone,
  welcome_email_pending boolean NOT NULL DEFAULT FALSE,
  auth_user_id uuid REFERENCES auth.users(id),
  empresa_id integer,
  perfil_id integer,
  ativo boolean NOT NULL DEFAULT TRUE,
  oab varchar
);

-- Core: perfil_modulos
CREATE TABLE IF NOT EXISTS public.perfil_modulos (
  perfil_id integer NOT NULL,
  modulo text NOT NULL,
  PRIMARY KEY (perfil_id, modulo)
);

-- Core: clientes (integer IDs matching external)
CREATE SEQUENCE IF NOT EXISTS clientes_id_seq;
CREATE TABLE IF NOT EXISTS public.clientes (
  id integer NOT NULL DEFAULT nextval('clientes_id_seq') PRIMARY KEY,
  nome varchar NOT NULL,
  tipo varchar NOT NULL,
  documento varchar,
  email varchar,
  telefone varchar,
  cep varchar,
  rua text,
  numero varchar,
  complemento text,
  bairro text,
  cidade text,
  uf character,
  ativo boolean NOT NULL DEFAULT TRUE,
  idempresa integer REFERENCES public.empresas(id),
  datacadastro timestamp without time zone NOT NULL DEFAULT now(),
  idusuario integer,
  updated_at timestamp without time zone
);

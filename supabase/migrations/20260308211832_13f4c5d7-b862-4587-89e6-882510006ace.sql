
-- Parameter tables
CREATE SEQUENCE IF NOT EXISTS area_atuacao_id_seq;
CREATE SEQUENCE IF NOT EXISTS tipo_documento_id_seq;
CREATE SEQUENCE IF NOT EXISTS tipo_processo_id_seq;
CREATE SEQUENCE IF NOT EXISTS tipo_evento_id_seq;
CREATE SEQUENCE IF NOT EXISTS tipo_envolvimento_id_seq;
CREATE SEQUENCE IF NOT EXISTS situacao_cliente_id_seq;
CREATE SEQUENCE IF NOT EXISTS situacao_processo_id_seq;
CREATE SEQUENCE IF NOT EXISTS situacao_proposta_id_seq;
CREATE SEQUENCE IF NOT EXISTS fluxo_trabalho_id_seq;
CREATE SEQUENCE IF NOT EXISTS etiquetas_id_seq;
CREATE SEQUENCE IF NOT EXISTS escritorios_id_seq;
CREATE SEQUENCE IF NOT EXISTS sistema_cnj_id_seq;
CREATE SEQUENCE IF NOT EXISTS categorias_id_seq;
CREATE SEQUENCE IF NOT EXISTS categories_id_seq;
CREATE SEQUENCE IF NOT EXISTS tags_id_seq;

CREATE TABLE IF NOT EXISTS public.area_atuacao (
  id integer NOT NULL DEFAULT nextval('area_atuacao_id_seq') PRIMARY KEY,
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT TRUE,
  datacriacao timestamp without time zone NOT NULL DEFAULT now(),
  idempresa integer
);

CREATE TABLE IF NOT EXISTS public.tipo_documento (
  id integer NOT NULL DEFAULT nextval('tipo_documento_id_seq') PRIMARY KEY,
  nome varchar NOT NULL,
  ativo boolean DEFAULT TRUE,
  datacriacao timestamp without time zone DEFAULT now(),
  idempresa integer
);

CREATE TABLE IF NOT EXISTS public.tipo_processo (
  id integer NOT NULL DEFAULT nextval('tipo_processo_id_seq') PRIMARY KEY,
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT TRUE,
  datacriacao timestamp without time zone NOT NULL DEFAULT now(),
  idempresa integer,
  idareaatuacao integer
);

CREATE TABLE IF NOT EXISTS public.tipo_evento (
  id integer NOT NULL DEFAULT nextval('tipo_evento_id_seq') PRIMARY KEY,
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT TRUE,
  datacriacao timestamp without time zone NOT NULL DEFAULT now(),
  agenda boolean NOT NULL DEFAULT TRUE,
  tarefa boolean NOT NULL DEFAULT TRUE,
  idempresa integer
);

CREATE TABLE IF NOT EXISTS public.tipo_envolvimento (
  id integer NOT NULL DEFAULT nextval('tipo_envolvimento_id_seq') PRIMARY KEY,
  descricao text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.situacao_cliente (
  id integer NOT NULL DEFAULT nextval('situacao_cliente_id_seq') PRIMARY KEY,
  nome text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT TRUE,
  datacriacao timestamp without time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.situacao_processo (
  id integer NOT NULL DEFAULT nextval('situacao_processo_id_seq') PRIMARY KEY,
  nome text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT TRUE,
  datacriacao timestamp without time zone NOT NULL DEFAULT now(),
  idempresa integer
);

CREATE TABLE IF NOT EXISTS public.situacao_proposta (
  id integer NOT NULL DEFAULT nextval('situacao_proposta_id_seq') PRIMARY KEY,
  nome text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT TRUE,
  datacriacao timestamp without time zone NOT NULL DEFAULT now(),
  idempresa integer
);

CREATE TABLE IF NOT EXISTS public.fluxo_trabalho (
  id integer NOT NULL DEFAULT nextval('fluxo_trabalho_id_seq') UNIQUE,
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT TRUE,
  datacriacao timestamp without time zone NOT NULL DEFAULT now(),
  exibe_menu boolean NOT NULL DEFAULT TRUE,
  ordem integer,
  idempresa integer
);

CREATE TABLE IF NOT EXISTS public.etiquetas (
  id integer NOT NULL DEFAULT nextval('etiquetas_id_seq') UNIQUE,
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT TRUE,
  datacriacao timestamp without time zone NOT NULL DEFAULT now(),
  exibe_pipeline boolean NOT NULL DEFAULT TRUE,
  ordem integer NOT NULL,
  id_fluxo_trabalho integer NOT NULL,
  idempresa integer
);

CREATE TABLE IF NOT EXISTS public.escritorios (
  id integer NOT NULL DEFAULT nextval('escritorios_id_seq') UNIQUE,
  nome text NOT NULL,
  empresa integer NOT NULL,
  ativo boolean NOT NULL DEFAULT TRUE,
  datacriacao timestamp without time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sistema_cnj (
  id integer NOT NULL DEFAULT nextval('sistema_cnj_id_seq') PRIMARY KEY,
  nome varchar NOT NULL
);

CREATE TABLE IF NOT EXISTS public.categorias (
  id integer NOT NULL DEFAULT nextval('categorias_id_seq') PRIMARY KEY,
  nome text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT TRUE,
  datacriacao timestamp without time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.categories (
  id integer NOT NULL DEFAULT nextval('categories_id_seq') PRIMARY KEY,
  name text NOT NULL UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tags (
  id integer NOT NULL DEFAULT nextval('tags_id_seq') PRIMARY KEY,
  key text NOT NULL,
  label text NOT NULL,
  example text,
  group_name text
);

-- Enable RLS on all parameter tables
ALTER TABLE public.area_atuacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tipo_documento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tipo_processo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tipo_evento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tipo_envolvimento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.situacao_cliente ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.situacao_processo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.situacao_proposta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fluxo_trabalho ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.etiquetas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.escritorios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sistema_cnj ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;

-- RLS policies for parameter tables (members view, admins manage)
CREATE POLICY "Members can view" ON public.area_atuacao FOR SELECT TO authenticated USING (public.is_office_member());
CREATE POLICY "Admins can manage" ON public.area_atuacao FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Members can view" ON public.tipo_documento FOR SELECT TO authenticated USING (public.is_office_member());
CREATE POLICY "Admins can manage" ON public.tipo_documento FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Members can view" ON public.tipo_processo FOR SELECT TO authenticated USING (public.is_office_member());
CREATE POLICY "Admins can manage" ON public.tipo_processo FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Members can view" ON public.tipo_evento FOR SELECT TO authenticated USING (public.is_office_member());
CREATE POLICY "Admins can manage" ON public.tipo_evento FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Members can view" ON public.tipo_envolvimento FOR SELECT TO authenticated USING (public.is_office_member());
CREATE POLICY "Admins can manage" ON public.tipo_envolvimento FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Members can view" ON public.situacao_cliente FOR SELECT TO authenticated USING (public.is_office_member());
CREATE POLICY "Admins can manage" ON public.situacao_cliente FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Members can view" ON public.situacao_processo FOR SELECT TO authenticated USING (public.is_office_member());
CREATE POLICY "Admins can manage" ON public.situacao_processo FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Members can view" ON public.situacao_proposta FOR SELECT TO authenticated USING (public.is_office_member());
CREATE POLICY "Admins can manage" ON public.situacao_proposta FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Members can view" ON public.fluxo_trabalho FOR SELECT TO authenticated USING (public.is_office_member());
CREATE POLICY "Admins can manage" ON public.fluxo_trabalho FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Members can view" ON public.etiquetas FOR SELECT TO authenticated USING (public.is_office_member());
CREATE POLICY "Admins can manage" ON public.etiquetas FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Members can view" ON public.escritorios FOR SELECT TO authenticated USING (public.is_office_member());
CREATE POLICY "Admins can manage" ON public.escritorios FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Members can view" ON public.sistema_cnj FOR SELECT TO authenticated USING (public.is_office_member());
CREATE POLICY "Admins can manage" ON public.sistema_cnj FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Members can view" ON public.categorias FOR SELECT TO authenticated USING (public.is_office_member());
CREATE POLICY "Admins can manage" ON public.categorias FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Members can view" ON public.categories FOR SELECT TO authenticated USING (public.is_office_member());
CREATE POLICY "Admins can manage" ON public.categories FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Members can view" ON public.tags FOR SELECT TO authenticated USING (public.is_office_member());
CREATE POLICY "Admins can manage" ON public.tags FOR ALL TO authenticated USING (public.is_admin());

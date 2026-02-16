
-- ============================================
-- CRM JURÍDICO - SCHEMA COMPLETO
-- ============================================

-- 1. ENUM DE ROLES
CREATE TYPE public.app_role AS ENUM ('admin', 'advogado', 'estagiario');

-- 2. TABELA DE PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  email TEXT,
  oab_numero TEXT,
  oab_uf TEXT,
  telefone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. TABELA DE USER_ROLES (separada conforme exigido)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- 4. TABELA DE CLIENTES
CREATE TABLE public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  tipo_pessoa TEXT NOT NULL DEFAULT 'fisica', -- fisica, juridica
  cpf_cnpj TEXT,
  email TEXT,
  telefone TEXT,
  endereco TEXT,
  cidade TEXT,
  uf TEXT,
  cep TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. TABELA DE PROCESSOS (baseada no modelo n8n)
CREATE TABLE public.processos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_cnj TEXT NOT NULL,
  grau TEXT,
  instancia TEXT,
  tribunal TEXT,
  orgao_julgador TEXT,
  classe_judicial TEXT,
  assunto TEXT,
  valor_acao NUMERIC,
  nivel_sigilo INTEGER DEFAULT 0,
  data_distribuicao TIMESTAMPTZ,
  data_ultimo_movimento TIMESTAMPTZ,
  ativo BOOLEAN DEFAULT true,
  permite_peticionar BOOLEAN DEFAULT false,
  monitorar_processo BOOLEAN DEFAULT true,
  status TEXT DEFAULT 'em_andamento', -- em_andamento, suspenso, arquivado, encerrado
  advogado_responsavel TEXT,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(numero_cnj, grau)
);

-- 6. TABELA DE PARTES DO PROCESSO
CREATE TABLE public.partes_processo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID REFERENCES public.processos(id) ON DELETE CASCADE NOT NULL,
  nome TEXT NOT NULL,
  polo TEXT, -- A (ativo), P (passivo), T (terceiro)
  tipo_parte TEXT,
  tipo_pessoa TEXT,
  documento_numero TEXT,
  documento_tipo TEXT,
  sigilosa BOOLEAN DEFAULT false,
  representante_nome TEXT,
  representante_tipo TEXT,
  representante_situacao TEXT,
  representante_cpf TEXT,
  oab_numero TEXT,
  oab_uf TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. TABELA DE INTIMAÇÕES
CREATE TABLE public.intimacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comunicacao_id BIGINT UNIQUE, -- ID da API ComunicaPJE
  processo_id UUID REFERENCES public.processos(id) ON DELETE SET NULL,
  numero_processo TEXT,
  data_disponibilizacao DATE,
  sigla_tribunal TEXT,
  tipo_comunicacao TEXT,
  nome_orgao TEXT,
  texto TEXT,
  meio TEXT,
  meio_completo TEXT,
  link TEXT,
  tipo_documento TEXT,
  nome_classe TEXT,
  codigo_classe TEXT,
  numero_comunicacao INTEGER,
  hash TEXT,
  status TEXT DEFAULT 'pendente', -- pendente, lida, respondida
  destinatarios JSONB,
  destinatario_advogados JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. TABELA DE PRAZOS
CREATE TABLE public.prazos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID REFERENCES public.processos(id) ON DELETE CASCADE,
  intimacao_id UUID REFERENCES public.intimacoes(id) ON DELETE SET NULL,
  descricao TEXT NOT NULL,
  data_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  data_vencimento DATE NOT NULL,
  status TEXT DEFAULT 'pendente', -- pendente, em_andamento, cumprido, vencido
  responsavel_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  prioridade TEXT DEFAULT 'media', -- baixa, media, alta, urgente
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. TABELA DE TAREFAS
CREATE TABLE public.tarefas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id UUID REFERENCES public.processos(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  responsavel_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  data_vencimento DATE,
  status TEXT DEFAULT 'pendente', -- pendente, em_andamento, concluida, cancelada
  prioridade TEXT DEFAULT 'media', -- baixa, media, alta, urgente
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. TABELA DE API TOKENS (JUS.BR OAuth)
CREATE TABLE public.api_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL DEFAULT 'jusbr',
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_type TEXT DEFAULT 'Bearer',
  expires_at TIMESTAMPTZ,
  oab_numero TEXT,
  oab_uf TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- FUNÇÕES HELPER (SECURITY DEFINER)
-- ============================================

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin')
$$;

CREATE OR REPLACE FUNCTION public.is_office_member()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
  )
$$;

-- ============================================
-- ENABLE RLS
-- ============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.processos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partes_processo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intimacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prazos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tarefas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_tokens ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES
-- ============================================

-- PROFILES
CREATE POLICY "Members can view profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.is_office_member());
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage profiles" ON public.profiles
  FOR ALL TO authenticated USING (public.is_admin());

-- USER_ROLES
CREATE POLICY "Members can view roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.is_office_member());
CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.is_admin());

-- CLIENTES
CREATE POLICY "Members can view clientes" ON public.clientes
  FOR SELECT TO authenticated USING (public.is_office_member());
CREATE POLICY "Members can insert clientes" ON public.clientes
  FOR INSERT TO authenticated WITH CHECK (public.is_office_member());
CREATE POLICY "Members can update clientes" ON public.clientes
  FOR UPDATE TO authenticated USING (public.is_office_member());
CREATE POLICY "Admins can delete clientes" ON public.clientes
  FOR DELETE TO authenticated USING (public.is_admin());

-- PROCESSOS
CREATE POLICY "Members can view processos" ON public.processos
  FOR SELECT TO authenticated USING (public.is_office_member());
CREATE POLICY "Members can insert processos" ON public.processos
  FOR INSERT TO authenticated WITH CHECK (public.is_office_member());
CREATE POLICY "Members can update processos" ON public.processos
  FOR UPDATE TO authenticated USING (public.is_office_member());
CREATE POLICY "Admins can delete processos" ON public.processos
  FOR DELETE TO authenticated USING (public.is_admin());

-- PARTES_PROCESSO
CREATE POLICY "Members can view partes" ON public.partes_processo
  FOR SELECT TO authenticated USING (public.is_office_member());
CREATE POLICY "Members can insert partes" ON public.partes_processo
  FOR INSERT TO authenticated WITH CHECK (public.is_office_member());
CREATE POLICY "Members can update partes" ON public.partes_processo
  FOR UPDATE TO authenticated USING (public.is_office_member());
CREATE POLICY "Admins can delete partes" ON public.partes_processo
  FOR DELETE TO authenticated USING (public.is_admin());

-- INTIMACOES
CREATE POLICY "Members can view intimacoes" ON public.intimacoes
  FOR SELECT TO authenticated USING (public.is_office_member());
CREATE POLICY "Members can insert intimacoes" ON public.intimacoes
  FOR INSERT TO authenticated WITH CHECK (public.is_office_member());
CREATE POLICY "Members can update intimacoes" ON public.intimacoes
  FOR UPDATE TO authenticated USING (public.is_office_member());
CREATE POLICY "Admins can delete intimacoes" ON public.intimacoes
  FOR DELETE TO authenticated USING (public.is_admin());

-- PRAZOS
CREATE POLICY "Members can view prazos" ON public.prazos
  FOR SELECT TO authenticated USING (public.is_office_member());
CREATE POLICY "Members can insert prazos" ON public.prazos
  FOR INSERT TO authenticated WITH CHECK (public.is_office_member());
CREATE POLICY "Members can update prazos" ON public.prazos
  FOR UPDATE TO authenticated USING (public.is_office_member());
CREATE POLICY "Admins can delete prazos" ON public.prazos
  FOR DELETE TO authenticated USING (public.is_admin());

-- TAREFAS
CREATE POLICY "Members can view tarefas" ON public.tarefas
  FOR SELECT TO authenticated USING (public.is_office_member());
CREATE POLICY "Members can insert tarefas" ON public.tarefas
  FOR INSERT TO authenticated WITH CHECK (public.is_office_member());
CREATE POLICY "Members can update tarefas" ON public.tarefas
  FOR UPDATE TO authenticated USING (public.is_office_member());
CREATE POLICY "Admins can delete tarefas" ON public.tarefas
  FOR DELETE TO authenticated USING (public.is_admin());

-- API_TOKENS (somente admin)
CREATE POLICY "Admins can manage tokens" ON public.api_tokens
  FOR ALL TO authenticated USING (public.is_admin());

-- ============================================
-- TRIGGERS
-- ============================================

-- Função para updated_at automático
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers de updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_clientes_updated_at BEFORE UPDATE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_processos_updated_at BEFORE UPDATE ON public.processos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_intimacoes_updated_at BEFORE UPDATE ON public.intimacoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_prazos_updated_at BEFORE UPDATE ON public.prazos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tarefas_updated_at BEFORE UPDATE ON public.tarefas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_api_tokens_updated_at BEFORE UPDATE ON public.api_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para criar profile automaticamente no signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, nome, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email), NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Índices para performance
CREATE INDEX idx_processos_numero_cnj ON public.processos(numero_cnj);
CREATE INDEX idx_processos_status ON public.processos(status);
CREATE INDEX idx_processos_cliente_id ON public.processos(cliente_id);
CREATE INDEX idx_intimacoes_numero_processo ON public.intimacoes(numero_processo);
CREATE INDEX idx_intimacoes_status ON public.intimacoes(status);
CREATE INDEX idx_intimacoes_data ON public.intimacoes(data_disponibilizacao);
CREATE INDEX idx_prazos_vencimento ON public.prazos(data_vencimento);
CREATE INDEX idx_prazos_status ON public.prazos(status);
CREATE INDEX idx_tarefas_responsavel ON public.tarefas(responsavel_id);
CREATE INDEX idx_tarefas_status ON public.tarefas(status);
CREATE INDEX idx_partes_processo_id ON public.partes_processo(processo_id);

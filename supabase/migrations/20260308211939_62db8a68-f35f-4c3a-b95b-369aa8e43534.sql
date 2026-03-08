
-- CRM: Oportunidades and related tables
CREATE SEQUENCE IF NOT EXISTS oportunidades_id_seq;
CREATE SEQUENCE IF NOT EXISTS oportunidade_envolvidos_id_seq;
CREATE SEQUENCE IF NOT EXISTS oportunidade_documentos_id_seq;
CREATE SEQUENCE IF NOT EXISTS oportunidade_faturamentos_id_seq;
CREATE SEQUENCE IF NOT EXISTS oportunidade_parcelas_id_seq;
CREATE SEQUENCE IF NOT EXISTS tarefas_id_seq;
CREATE SEQUENCE IF NOT EXISTS agenda_id_seq;
CREATE SEQUENCE IF NOT EXISTS templates_id_seq;
CREATE SEQUENCE IF NOT EXISTS cliente_documento_id_seq;
CREATE SEQUENCE IF NOT EXISTS cliente_atributos_id_seq;
CREATE SEQUENCE IF NOT EXISTS fornecedores_id_seq;
CREATE SEQUENCE IF NOT EXISTS intimacoes_id_seq;
CREATE SEQUENCE IF NOT EXISTS oab_monitoradas_id_seq;
CREATE SEQUENCE IF NOT EXISTS pje_processos_id_seq;
CREATE SEQUENCE IF NOT EXISTS pje_processo_partes_id_seq;
CREATE SEQUENCE IF NOT EXISTS pje_processo_movimentos_id_seq;
CREATE SEQUENCE IF NOT EXISTS pje_processo_documentos_id_seq;

CREATE TABLE IF NOT EXISTS public.oportunidades (
  id integer NOT NULL DEFAULT nextval('oportunidades_id_seq') PRIMARY KEY,
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
  valor_entrada numeric
);

CREATE TABLE IF NOT EXISTS public.oportunidade_sequence (
  empresa_id integer NOT NULL PRIMARY KEY,
  atual integer NOT NULL
);

CREATE TABLE IF NOT EXISTS public.oportunidade_envolvidos (
  id integer NOT NULL DEFAULT nextval('oportunidade_envolvidos_id_seq') PRIMARY KEY,
  oportunidade_id integer NOT NULL,
  nome text,
  documento text,
  telefone text,
  endereco text,
  relacao text,
  polo varchar
);

CREATE TABLE IF NOT EXISTS public.oportunidade_documentos (
  id integer NOT NULL DEFAULT nextval('oportunidade_documentos_id_seq') PRIMARY KEY,
  oportunidade_id integer NOT NULL,
  template_id integer,
  title text NOT NULL,
  content text NOT NULL,
  variables jsonb NOT NULL DEFAULT '{}',
  created_at timestamp without time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.oportunidade_faturamentos (
  id integer NOT NULL DEFAULT nextval('oportunidade_faturamentos_id_seq') PRIMARY KEY,
  oportunidade_id integer NOT NULL,
  forma_pagamento text NOT NULL,
  condicao_pagamento text,
  valor numeric,
  parcelas integer,
  observacoes text,
  data_faturamento timestamp with time zone DEFAULT now(),
  criado_em timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.oportunidade_parcelas (
  id integer NOT NULL DEFAULT nextval('oportunidade_parcelas_id_seq') PRIMARY KEY,
  oportunidade_id integer NOT NULL,
  numero_parcela integer NOT NULL,
  valor numeric NOT NULL,
  valor_pago numeric DEFAULT 0,
  status text NOT NULL DEFAULT 'pendente',
  data_prevista date,
  quitado_em timestamp with time zone,
  faturamento_id integer,
  criado_em timestamp with time zone DEFAULT now(),
  atualizado_em timestamp with time zone DEFAULT now(),
  idempresa integer
);

-- Tarefas (integer IDs)
CREATE TABLE IF NOT EXISTS public.tarefas (
  id integer NOT NULL DEFAULT nextval('tarefas_id_seq') PRIMARY KEY,
  id_oportunidades integer,
  titulo text NOT NULL,
  descricao text,
  data date NOT NULL,
  hora time without time zone,
  dia_inteiro boolean DEFAULT FALSE,
  prioridade integer,
  mostrar_na_agenda boolean DEFAULT TRUE,
  privada boolean DEFAULT TRUE,
  recorrente boolean DEFAULT FALSE,
  repetir_quantas_vezes integer DEFAULT 1,
  repetir_cada_unidade text,
  repetir_intervalo integer DEFAULT 1,
  criado_em timestamp without time zone DEFAULT now(),
  atualizado_em timestamp without time zone DEFAULT now(),
  concluido boolean NOT NULL DEFAULT FALSE,
  ativo boolean NOT NULL DEFAULT TRUE,
  idempresa integer NOT NULL,
  idusuario integer NOT NULL
);

CREATE TABLE IF NOT EXISTS public.tarefas_responsaveis (
  id_tarefa integer NOT NULL,
  id_usuario integer NOT NULL,
  PRIMARY KEY (id_tarefa, id_usuario)
);

-- Agenda
CREATE TABLE IF NOT EXISTS public.agenda (
  id integer NOT NULL DEFAULT nextval('agenda_id_seq') PRIMARY KEY,
  titulo text NOT NULL,
  tipo integer,
  descricao text,
  data date NOT NULL,
  hora_inicio time without time zone,
  hora_fim time without time zone,
  cliente integer,
  tipo_local varchar,
  local text,
  lembrete boolean DEFAULT FALSE,
  status integer,
  datacadastro timestamp without time zone NOT NULL DEFAULT now(),
  idempresa integer,
  idusuario integer,
  dataatualizacao timestamp without time zone,
  id_tarefa integer
);

-- Templates
CREATE TABLE IF NOT EXISTS public.templates (
  id integer NOT NULL DEFAULT nextval('templates_id_seq') UNIQUE,
  title text NOT NULL,
  content text NOT NULL,
  datacriacao timestamp without time zone NOT NULL DEFAULT now(),
  idempresa integer,
  idusuario integer
);

-- Cliente documentos e atributos
CREATE TABLE IF NOT EXISTS public.cliente_documento (
  id integer NOT NULL DEFAULT nextval('cliente_documento_id_seq') PRIMARY KEY,
  cliente_id integer NOT NULL,
  tipo_documento_id integer NOT NULL,
  nome_arquivo varchar NOT NULL,
  arquivo_base64 text NOT NULL,
  data_upload timestamp without time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.cliente_atributos (
  id bigint NOT NULL DEFAULT nextval('cliente_atributos_id_seq') PRIMARY KEY,
  idclientes bigint NOT NULL,
  idtipodocumento integer NOT NULL,
  valor text NOT NULL,
  datacadastro time with time zone NOT NULL DEFAULT now()
);

-- Fornecedores
CREATE TABLE IF NOT EXISTS public.fornecedores (
  id integer NOT NULL DEFAULT nextval('fornecedores_id_seq') PRIMARY KEY,
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
  ativo boolean NOT NULL DEFAULT TRUE,
  idempresa integer,
  datacadastro timestamp without time zone NOT NULL DEFAULT now()
);

-- Intimacoes (integer IDs)
CREATE TABLE IF NOT EXISTS public.intimacoes (
  id bigint NOT NULL DEFAULT nextval('intimacoes_id_seq') PRIMARY KEY,
  siglaTribunal text NOT NULL DEFAULT 'projudi',
  external_id text NOT NULL,
  numero_processo text NOT NULL,
  nomeOrgao text,
  tipoComunicacao text,
  texto text,
  prazo timestamp with time zone,
  data_disponibilizacao date,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  meio varchar,
  link text,
  tipodocumento varchar,
  nomeclasse varchar,
  codigoclasse varchar,
  numerocomunicacao varchar,
  ativo boolean NOT NULL DEFAULT TRUE,
  hash varchar,
  status varchar,
  motivo_cancelamento varchar,
  data_cancelamento timestamp without time zone,
  destinatarios text[],
  destinatarios_advogados text[],
  idusuario integer,
  idempresa integer REFERENCES public.empresas(id),
  nao_lida boolean NOT NULL DEFAULT TRUE,
  arquivada boolean NOT NULL DEFAULT FALSE,
  idusuario_leitura bigint,
  lida_em timestamp with time zone
);

-- OAB monitoradas
CREATE TABLE IF NOT EXISTS public.oab_monitoradas (
  id bigint NOT NULL DEFAULT nextval('oab_monitoradas_id_seq') PRIMARY KEY,
  empresa_id integer NOT NULL,
  usuario_id integer,
  tipo text NOT NULL,
  uf character NOT NULL,
  numero varchar NOT NULL,
  dias_semana integer[],
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  sync_from date
);

-- PJE Processos
CREATE TABLE IF NOT EXISTS public.pje_processos (
  id bigint NOT NULL DEFAULT nextval('pje_processos_id_seq') PRIMARY KEY,
  idempresa integer NOT NULL,
  idusuario integer NOT NULL,
  numero_processo text NOT NULL,
  sigla_tribunal text NOT NULL,
  nivel_sigilo integer,
  id_codex_tribunal bigint,
  data_ajuizamento timestamp with time zone,
  data_ultima_distribuicao timestamp with time zone,
  valor_acao numeric,
  permite_peticionar boolean NOT NULL DEFAULT FALSE,
  orgao_julgador jsonb,
  grau jsonb,
  tribunal jsonb,
  classe jsonb,
  assunto jsonb,
  ultimo_movimento jsonb,
  ultimo_movimento_data timestamp with time zone,
  tramitacao_ativa jsonb,
  payload jsonb NOT NULL DEFAULT '{}',
  synced_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  semCliente text,
  cliente_id integer REFERENCES public.clientes(id)
);

CREATE TABLE IF NOT EXISTS public.pje_processo_partes (
  id bigint NOT NULL DEFAULT nextval('pje_processo_partes_id_seq') PRIMARY KEY,
  processo_id bigint NOT NULL REFERENCES public.pje_processos(id),
  numero_processo text NOT NULL,
  polo text,
  tipo_parte text,
  nome text,
  tipo_pessoa text,
  sigilosa boolean,
  documentos_principais jsonb,
  representantes jsonb,
  outros_nomes jsonb,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pje_processo_movimentos (
  id bigint NOT NULL DEFAULT nextval('pje_processo_movimentos_id_seq') PRIMARY KEY,
  processo_id bigint NOT NULL REFERENCES public.pje_processos(id),
  numero_processo text NOT NULL,
  data_hora timestamp with time zone,
  descricao text,
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pje_processo_documentos (
  id bigint NOT NULL DEFAULT nextval('pje_processo_documentos_id_seq') PRIMARY KEY,
  processo_id bigint NOT NULL REFERENCES public.pje_processos(id),
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
  payload jsonb NOT NULL DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.oportunidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oportunidade_sequence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oportunidade_envolvidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oportunidade_documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oportunidade_faturamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oportunidade_parcelas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tarefas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tarefas_responsaveis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cliente_documento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cliente_atributos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fornecedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intimacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oab_monitoradas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pje_processos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pje_processo_partes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pje_processo_movimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pje_processo_documentos ENABLE ROW LEVEL SECURITY;

-- RLS policies (members view, admins manage)
CREATE POLICY "Members view" ON public.oportunidades FOR SELECT TO authenticated USING (public.is_office_member());
CREATE POLICY "Members insert" ON public.oportunidades FOR INSERT TO authenticated WITH CHECK (public.is_office_member());
CREATE POLICY "Members update" ON public.oportunidades FOR UPDATE TO authenticated USING (public.is_office_member());
CREATE POLICY "Admins delete" ON public.oportunidades FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY "Members view" ON public.oportunidade_sequence FOR SELECT TO authenticated USING (public.is_office_member());
CREATE POLICY "Admins manage" ON public.oportunidade_sequence FOR ALL TO authenticated USING (public.is_admin());

CREATE POLICY "Members view" ON public.oportunidade_envolvidos FOR SELECT TO authenticated USING (public.is_office_member());
CREATE POLICY "Members insert" ON public.oportunidade_envolvidos FOR INSERT TO authenticated WITH CHECK (public.is_office_member());
CREATE POLICY "Members update" ON public.oportunidade_envolvidos FOR UPDATE TO authenticated USING (public.is_office_member());
CREATE POLICY "Admins delete" ON public.oportunidade_envolvidos FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY "Members view" ON public.oportunidade_documentos FOR SELECT TO authenticated USING (public.is_office_member());
CREATE POLICY "Members insert" ON public.oportunidade_documentos FOR INSERT TO authenticated WITH CHECK (public.is_office_member());
CREATE POLICY "Members update" ON public.oportunidade_documentos FOR UPDATE TO authenticated USING (public.is_office_member());
CREATE POLICY "Admins delete" ON public.oportunidade_documentos FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY "Members view" ON public.oportunidade_faturamentos FOR SELECT TO authenticated USING (public.is_office_member());
CREATE POLICY "Members insert" ON public.oportunidade_faturamentos FOR INSERT TO authenticated WITH CHECK (public.is_office_member());
CREATE POLICY "Admins manage" ON public.oportunidade_faturamentos FOR ALL TO authenticated USING (public.is_admin());

CREATE POLICY "Members view" ON public.oportunidade_parcelas FOR SELECT TO authenticated USING (public.is_office_member());
CREATE POLICY "Members insert" ON public.oportunidade_parcelas FOR INSERT TO authenticated WITH CHECK (public.is_office_member());
CREATE POLICY "Members update" ON public.oportunidade_parcelas FOR UPDATE TO authenticated USING (public.is_office_member());
CREATE POLICY "Admins delete" ON public.oportunidade_parcelas FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY "Members view" ON public.tarefas FOR SELECT TO authenticated USING (public.is_office_member());
CREATE POLICY "Members insert" ON public.tarefas FOR INSERT TO authenticated WITH CHECK (public.is_office_member());
CREATE POLICY "Members update" ON public.tarefas FOR UPDATE TO authenticated USING (public.is_office_member());
CREATE POLICY "Admins delete" ON public.tarefas FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY "Members view" ON public.tarefas_responsaveis FOR SELECT TO authenticated USING (public.is_office_member());
CREATE POLICY "Members manage" ON public.tarefas_responsaveis FOR ALL TO authenticated USING (public.is_office_member());

CREATE POLICY "Members view" ON public.agenda FOR SELECT TO authenticated USING (public.is_office_member());
CREATE POLICY "Members insert" ON public.agenda FOR INSERT TO authenticated WITH CHECK (public.is_office_member());
CREATE POLICY "Members update" ON public.agenda FOR UPDATE TO authenticated USING (public.is_office_member());
CREATE POLICY "Admins delete" ON public.agenda FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY "Members view" ON public.templates FOR SELECT TO authenticated USING (public.is_office_member());
CREATE POLICY "Members insert" ON public.templates FOR INSERT TO authenticated WITH CHECK (public.is_office_member());
CREATE POLICY "Members update" ON public.templates FOR UPDATE TO authenticated USING (public.is_office_member());
CREATE POLICY "Admins delete" ON public.templates FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY "Members view" ON public.cliente_documento FOR SELECT TO authenticated USING (public.is_office_member());
CREATE POLICY "Members insert" ON public.cliente_documento FOR INSERT TO authenticated WITH CHECK (public.is_office_member());
CREATE POLICY "Admins manage" ON public.cliente_documento FOR ALL TO authenticated USING (public.is_admin());

CREATE POLICY "Members view" ON public.cliente_atributos FOR SELECT TO authenticated USING (public.is_office_member());
CREATE POLICY "Members insert" ON public.cliente_atributos FOR INSERT TO authenticated WITH CHECK (public.is_office_member());
CREATE POLICY "Admins manage" ON public.cliente_atributos FOR ALL TO authenticated USING (public.is_admin());

CREATE POLICY "Members view" ON public.fornecedores FOR SELECT TO authenticated USING (public.is_office_member());
CREATE POLICY "Members insert" ON public.fornecedores FOR INSERT TO authenticated WITH CHECK (public.is_office_member());
CREATE POLICY "Members update" ON public.fornecedores FOR UPDATE TO authenticated USING (public.is_office_member());
CREATE POLICY "Admins delete" ON public.fornecedores FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY "Members view" ON public.intimacoes FOR SELECT TO authenticated USING (public.is_office_member());
CREATE POLICY "Members insert" ON public.intimacoes FOR INSERT TO authenticated WITH CHECK (public.is_office_member());
CREATE POLICY "Members update" ON public.intimacoes FOR UPDATE TO authenticated USING (public.is_office_member());
CREATE POLICY "Admins delete" ON public.intimacoes FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY "Members view" ON public.oab_monitoradas FOR SELECT TO authenticated USING (public.is_office_member());
CREATE POLICY "Admins manage" ON public.oab_monitoradas FOR ALL TO authenticated USING (public.is_admin());

CREATE POLICY "Members view" ON public.pje_processos FOR SELECT TO authenticated USING (public.is_office_member());
CREATE POLICY "Members insert" ON public.pje_processos FOR INSERT TO authenticated WITH CHECK (public.is_office_member());
CREATE POLICY "Members update" ON public.pje_processos FOR UPDATE TO authenticated USING (public.is_office_member());
CREATE POLICY "Admins delete" ON public.pje_processos FOR DELETE TO authenticated USING (public.is_admin());

CREATE POLICY "Members view" ON public.pje_processo_partes FOR SELECT TO authenticated USING (public.is_office_member());
CREATE POLICY "Members manage" ON public.pje_processo_partes FOR ALL TO authenticated USING (public.is_office_member());

CREATE POLICY "Members view" ON public.pje_processo_movimentos FOR SELECT TO authenticated USING (public.is_office_member());
CREATE POLICY "Members manage" ON public.pje_processo_movimentos FOR ALL TO authenticated USING (public.is_office_member());

CREATE POLICY "Members view" ON public.pje_processo_documentos FOR SELECT TO authenticated USING (public.is_office_member());
CREATE POLICY "Members manage" ON public.pje_processo_documentos FOR ALL TO authenticated USING (public.is_office_member());

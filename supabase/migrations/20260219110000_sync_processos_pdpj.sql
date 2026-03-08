-- Estrutura para sincronização de processos PDPJ no Supabase
-- Nota de migração: em migrações Postgres -> Supabase, erros comuns vieram de incompatibilidades
-- de tipos/DDL legados. Esta estrutura isola a sincronização em tabelas dedicadas.

CREATE TABLE IF NOT EXISTS public.pje_processos (
  id bigserial primary key,
  idempresa integer not null,
  idusuario integer not null,
  numero_processo text not null,
  sigla_tribunal text not null,
  nivel_sigilo integer,
  id_codex_tribunal bigint,
  data_ajuizamento timestamptz,
  data_ultima_distribuicao timestamptz,
  valor_acao numeric,
  permite_peticionar boolean not null default false,
  orgao_julgador jsonb,
  grau jsonb,
  tribunal jsonb,
  classe jsonb,
  assunto jsonb,
  ultimo_movimento jsonb,
  ultimo_movimento_data timestamptz,
  tramitacao_ativa jsonb,
  payload jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pje_processos_unique unique (numero_processo, sigla_tribunal, idempresa)
);

create index if not exists idx_pje_processos_empresa_usuario
  on public.pje_processos (idempresa, idusuario);
create index if not exists idx_pje_processos_numero
  on public.pje_processos (numero_processo);
create index if not exists idx_pje_processos_ultimo_mov
  on public.pje_processos (ultimo_movimento_data desc);

CREATE TABLE IF NOT EXISTS public.pje_processo_partes (
  id bigserial primary key,
  processo_id bigint not null references public.pje_processos(id) on delete cascade,
  numero_processo text not null,
  polo text,
  tipo_parte text,
  nome text,
  tipo_pessoa text,
  sigilosa boolean,
  documentos_principais jsonb,
  representantes jsonb,
  outros_nomes jsonb,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_pje_processo_partes_processo
  on public.pje_processo_partes (processo_id);
create index if not exists idx_pje_processo_partes_numero
  on public.pje_processo_partes (numero_processo);

CREATE TABLE IF NOT EXISTS public.pje_processo_movimentos (
  id bigserial primary key,
  processo_id bigint not null references public.pje_processos(id) on delete cascade,
  numero_processo text not null,
  data_hora timestamptz,
  descricao text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_pje_processo_movimentos_processo
  on public.pje_processo_movimentos (processo_id);
create index if not exists idx_pje_processo_movimentos_data
  on public.pje_processo_movimentos (data_hora desc);

CREATE TABLE IF NOT EXISTS public.pje_processo_documentos (
  id bigserial primary key,
  processo_id bigint not null references public.pje_processos(id) on delete cascade,
  numero_processo text not null,
  sequencia bigint,
  data_hora_juntada timestamptz,
  id_codex bigint,
  id_origem text,
  nome text,
  nivel_sigilo text,
  tipo_codigo bigint,
  tipo_nome text,
  href_binario text,
  href_texto text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_pje_processo_documentos_processo
  on public.pje_processo_documentos (processo_id);
create index if not exists idx_pje_processo_documentos_sequencia
  on public.pje_processo_documentos (numero_processo, sequencia desc);

CREATE TABLE IF NOT EXISTS public.pje_sync_processos_log (
  id bigserial primary key,
  idempresa integer not null,
  idusuario integer not null,
  oab_uf text not null,
  oab_numero text not null,
  fetched integer not null default 0,
  persisted integer not null default 0,
  partes_persistidas integer not null default 0,
  movimentos_persistidos integer not null default 0,
  documentos_persistidos integer not null default 0,
  status text not null default 'success',
  erro text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint pje_sync_processos_log_status_ck check (status in ('success', 'partial_success', 'failed'))
);

create index if not exists idx_pje_sync_processos_log_created_at
  on public.pje_sync_processos_log (created_at desc);

create or replace function public.set_updated_at_pje_processos()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_set_updated_at_pje_processos on public.pje_processos;
create trigger trg_set_updated_at_pje_processos
before update on public.pje_processos
for each row
execute function public.set_updated_at_pje_processos();

create schema if not exists governance;

drop view if exists governance.v_supabase_migration_processos_diag;
create or replace view governance.v_supabase_migration_processos_diag as
select
  (to_regclass('public.pje_processos') is not null) as has_pje_processos,
  (to_regclass('public.pje_processo_partes') is not null) as has_pje_processo_partes,
  (to_regclass('public.pje_processo_movimentos') is not null) as has_pje_processo_movimentos,
  (to_regclass('public.pje_processo_documentos') is not null) as has_pje_processo_documentos,
  (to_regclass('public.pje_sync_processos_log') is not null) as has_pje_sync_processos_log,
  exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'planos'
      and column_name = 'modulos'
      and data_type in ('json', 'jsonb', 'text')
  ) as planos_modulos_tipo_esperado;

comment on view governance.v_supabase_migration_processos_diag is
'Diagnóstico rápido para checar se erros atuais podem vir da migração Postgres -> Supabase.';

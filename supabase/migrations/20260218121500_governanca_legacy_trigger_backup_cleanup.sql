-- Governança e limpeza de tabelas legadas (prefixo trigger_ e planos_modulos_backup)
-- Contexto: pós-migração Postgres -> Supabase.

create schema if not exists governance;
create schema if not exists cold_archive;

CREATE TABLE IF NOT EXISTS governance.legacy_cleanup_audit (
  id bigserial primary key,
  snapshot_label text not null,
  table_name text not null,
  snapshot_table text not null,
  exported_at timestamptz not null default now(),
  legal_hold_confirmed boolean not null default false,
  legal_hold_confirmed_by text,
  legal_hold_confirmed_at timestamptz,
  notes text
);

comment on table governance.legacy_cleanup_audit is
'Auditoria da exportação para cold storage e confirmação de retenção legal antes do DROP.';

create or replace view governance.v_legacy_objects_references as
with legacy_tables as (
  select unnest(array[
    'trigger_anexos_processo',
    'trigger_assuntos_processo',
    'trigger_dados_processo',
    'trigger_envolvidos_processo',
    'trigger_movimentacao_processo',
    'trigger_sincronizar_processo',
    'planos_modulos_backup'
  ]) as table_name
)
select
  'function'::text as object_type,
  n.nspname as object_schema,
  p.proname as object_name,
  lt.table_name,
  pg_get_functiondef(p.oid) as object_definition
from legacy_tables lt
join pg_proc p on pg_get_functiondef(p.oid) ilike format('%%public.%I%%', lt.table_name)
join pg_namespace n on n.oid = p.pronamespace

union all

select
  'view'::text as object_type,
  n.nspname as object_schema,
  c.relname as object_name,
  lt.table_name,
  pg_get_viewdef(c.oid, true) as object_definition
from legacy_tables lt
join pg_class c on c.relkind in ('v', 'm')
join pg_namespace n on n.oid = c.relnamespace
where pg_get_viewdef(c.oid, true) ilike format('%%public.%I%%', lt.table_name)

union all

select
  'trigger'::text as object_type,
  n.nspname as object_schema,
  t.tgname as object_name,
  lt.table_name,
  pg_get_triggerdef(t.oid, true) as object_definition
from legacy_tables lt
join pg_trigger t on not t.tgisinternal
join pg_class c on c.oid = t.tgrelid
join pg_namespace n on n.oid = c.relnamespace
where pg_get_triggerdef(t.oid, true) ilike format('%%public.%I%%', lt.table_name);

comment on view governance.v_legacy_objects_references is
'Relatório de jobs/funções/rotinas (funções, views e triggers) com referência às tabelas legadas.';

create or replace view governance.v_legacy_table_activity as
select
  st.relname as table_name,
  st.seq_scan,
  st.idx_scan,
  st.n_tup_ins,
  st.n_tup_upd,
  st.n_tup_del,
  st.n_tup_hot_upd,
  st.n_live_tup,
  st.n_dead_tup,
  st.last_vacuum,
  st.last_autovacuum,
  st.last_analyze,
  st.last_autoanalyze
from pg_stat_user_tables st
where st.schemaname = 'public'
  and st.relname in (
    'trigger_anexos_processo',
    'trigger_assuntos_processo',
    'trigger_dados_processo',
    'trigger_envolvidos_processo',
    'trigger_movimentacao_processo',
    'trigger_sincronizar_processo',
    'planos_modulos_backup'
  );

comment on view governance.v_legacy_table_activity is
'Indicadores de leitura/escrita para validar inatividade antes do DROP.';

create or replace function governance.export_legacy_snapshot(
  p_snapshot_label text,
  p_tables text[] default array[
    'trigger_anexos_processo',
    'trigger_assuntos_processo',
    'trigger_dados_processo',
    'trigger_envolvidos_processo',
    'trigger_movimentacao_processo',
    'trigger_sincronizar_processo',
    'planos_modulos_backup'
  ]
)
returns void
language plpgsql
as $$
declare
  v_table text;
  v_snapshot_table text;
begin
  foreach v_table in array p_tables loop
    if to_regclass(format('public.%I', v_table)) is null then
      continue;
    end if;

    v_snapshot_table := format('%I_%s', v_table, p_snapshot_label);

    execute format(
      'CREATE TABLE IF NOT EXISTS cold_archive.%I as table public.%I',
      v_snapshot_table,
      v_table
    );

    insert into governance.legacy_cleanup_audit (
      snapshot_label,
      table_name,
      snapshot_table,
      notes
    )
    values (
      p_snapshot_label,
      v_table,
      format('cold_archive.%I', v_snapshot_table),
      'Snapshot exportado para armazenamento frio lógico (schema cold_archive).'
    );
  end loop;
end;
$$;

comment on function governance.export_legacy_snapshot(text, text[]) is
'Exporta snapshot das tabelas legadas para schema cold_archive antes de remoção.';

create or replace function governance.prevent_public_backup_tables()
returns event_trigger
language plpgsql
as $$
declare
  cmd record;
begin
  for cmd in select * from pg_event_trigger_ddl_commands() loop
    if cmd.schema_name = 'public'
       and cmd.object_type = 'table'
       and (
         cmd.object_identity ilike 'public.%\\_backup'
         or cmd.object_identity ilike 'public.backup\\_%'
       ) then
      raise exception 'Governança: tabelas de backup permanentes não são permitidas no schema public (%). Use schema cold_archive.', cmd.object_identity;
    end if;
  end loop;
end;
$$;

drop event trigger if exists trg_prevent_public_backup_tables;

create event trigger trg_prevent_public_backup_tables
on ddl_command_end
when tag in ('CREATE TABLE IF NOT EXISTS', 'CREATE TABLE IF NOT EXISTS AS', 'SELECT INTO')
execute function governance.prevent_public_backup_tables();

comment on function governance.prevent_public_backup_tables() is
'Impede criação de novas tabelas de backup permanentes no schema public.';

-- Pré-check pós-migração Postgres -> Supabase: tipo de public.planos.modulos
-- (evita tratar erro de aplicação como se fosse atividade das tabelas legadas).
create or replace view governance.v_supabase_planos_modulos_tipo as
select
  table_schema,
  table_name,
  column_name,
  data_type,
  udt_name
from information_schema.columns
where table_schema = 'public'
  and table_name = 'planos'
  and column_name = 'modulos';

comment on view governance.v_supabase_planos_modulos_tipo is
'Pré-check para confirmar se erro vem da migração para Supabase (tipo de planos.modulos).';

-- Batch DROP protegido: qualquer erro aborta o bloco e a transação da migration.
do $$
declare
  v_dependency_count integer;
  v_table text;
  v_tables text[] := array[
    'trigger_anexos_processo',
    'trigger_assuntos_processo',
    'trigger_dados_processo',
    'trigger_envolvidos_processo',
    'trigger_movimentacao_processo',
    'trigger_sincronizar_processo',
    'planos_modulos_backup'
  ];
  v_snapshot_label text := to_char(clock_timestamp(), 'YYYYMMDDHH24MISS');
begin
  perform governance.export_legacy_snapshot(v_snapshot_label, v_tables);

  -- Dependências em funções, views/materialized views e triggers.
  select count(*)
  into v_dependency_count
  from governance.v_legacy_objects_references;

  if v_dependency_count > 0 then
    raise exception
      'DROP abortado: foram encontradas % dependências em jobs/funções/rotinas. Consulte governance.v_legacy_objects_references.',
      v_dependency_count;
  end if;

  foreach v_table in array v_tables loop
    execute format('drop table if exists public.%I', v_table);
  end loop;
end;
$$;

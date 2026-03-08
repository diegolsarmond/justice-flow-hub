-- =============================================================================
-- Migration: intimacoes_scheduler
-- Origem:    backend/sql/supabase_intimacoes_scheduler.sql
-- Objetivo:
--   1) habilitar extensões de agendamento/chamada HTTP (pg_cron + pg_net)
--   2) criar log de execução
--   3) criar função de orquestração por OAB monitorada (tipo='intimacoes')
--   4) criar helpers para agendar/pausar/reconfigurar
--   5) agendar job padrão (*/30 * * * *) via pg_cron
--
-- Diagnóstico rápido (pós-migração PostgreSQL -> Supabase):
--   select * from public.check_intimacoes_scheduler_prereqs();
--
-- Configurações recomendadas (Database > Settings > Parameters no Supabase):
--   app.settings.supabase_url       = https://<project-ref>.supabase.co
--   app.settings.service_role_key   = <service-role-key>
--
-- Alternativa segura: passar URL/chave por parâmetro ao chamar
-- public.orquestrar_sync_intimacoes_oab(...).
-- =============================================================================

-- 1) Extensões -----------------------------------------------------------
create extension if not exists pgcrypto;
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 2) Tabela de log -------------------------------------------------------
create table if not exists public.sync_intimacoes_log (
  id bigserial primary key,
  execution_id uuid not null default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz null,
  duration_ms integer null,
  status text not null default 'running',
  erro text null,
  total_oabs integer not null default 0,
  processadas integer not null default 0,
  enfileiradas integer not null default 0,
  falhas integer not null default 0,
  detalhes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sync_intimacoes_log_status_ck
    check (status in ('running', 'success', 'partial_success', 'failed', 'skipped'))
);

create index if not exists idx_sync_intimacoes_log_started_at
  on public.sync_intimacoes_log (started_at desc);

-- Trigger de updated_at --------------------------------------------------
create or replace function public.set_sync_intimacoes_log_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_sync_intimacoes_log_updated_at on public.sync_intimacoes_log;
create trigger trg_sync_intimacoes_log_updated_at
before update on public.sync_intimacoes_log
for each row
execute function public.set_sync_intimacoes_log_updated_at();

-- 3) Diagnóstico de pré-requisitos ---------------------------------------
create or replace function public.check_intimacoes_scheduler_prereqs()
returns table(item text, ok boolean, details text)
language sql
as $$
  with ext as (
    select extname
    from pg_extension
    where extname in ('pg_cron', 'pg_net')
  )
  select 'extensão pg_cron'::text,
         exists(select 1 from ext where extname = 'pg_cron') as ok,
         'Necessária para agendamento recorrente.'::text
  union all
  select 'extensão pg_net'::text,
         exists(select 1 from ext where extname = 'pg_net') as ok,
         'Necessária para chamada HTTP interna à Edge Function.'::text
  union all
  select 'app.settings.supabase_url'::text,
         nullif(current_setting('app.settings.supabase_url', true), '') is not null as ok,
         'URL base para compor /functions/v1/sync-intimacoes-oab.'::text
  union all
  select 'app.settings.service_role_key'::text,
         nullif(current_setting('app.settings.service_role_key', true), '') is not null as ok,
         'Bearer token da Edge Function (service_role).'::text;
$$;

-- 4) Função de orquestração ----------------------------------------------
create or replace function public.orquestrar_sync_intimacoes_oab(
  p_fallback_days integer default 7,
  p_batch_limit integer default 500,
  p_edge_function_url text default null,
  p_service_role_key text default null
)
returns table(log_id bigint, total_oabs integer, processadas integer, enfileiradas integer, falhas integer, status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_log_id bigint;
  v_started_at timestamptz := clock_timestamp();
  v_finished_at timestamptz;
  v_lock_key bigint := hashtextextended('public.orquestrar_sync_intimacoes_oab', 0);
  v_today smallint := extract(isodow from now())::smallint;
  v_edge_url text := coalesce(nullif(p_edge_function_url, ''), nullif(current_setting('app.settings.supabase_url', true), '') || '/functions/v1/sync-intimacoes-oab');
  v_service_key text := coalesce(nullif(p_service_role_key, ''), nullif(current_setting('app.settings.service_role_key', true), ''));
  v_total integer := 0;
  v_done integer := 0;
  v_queued integer := 0;
  v_failed integer := 0;
  v_request_id bigint;
  v_details jsonb := '[]'::jsonb;
  v_err text;
  v_status text := 'success';
  r record;
begin
  if p_fallback_days < 0 then
    raise exception 'p_fallback_days não pode ser negativo';
  end if;

  if p_batch_limit is null or p_batch_limit <= 0 then
    p_batch_limit := 500;
  end if;

  if not pg_try_advisory_lock(v_lock_key) then
    insert into public.sync_intimacoes_log(status, erro)
    values ('skipped', 'Execução ignorada: já existe uma rodada em andamento (advisory lock).')
    returning id into v_log_id;

    return query
    select v_log_id, 0, 0, 0, 0, 'skipped'::text;
    return;
  end if;

  insert into public.sync_intimacoes_log(status)
  values ('running')
  returning id into v_log_id;

  if v_edge_url is null or v_service_key is null then
    v_finished_at := clock_timestamp();
    update public.sync_intimacoes_log
       set status = 'failed',
           erro = 'Configuração ausente: informe app.settings.supabase_url e app.settings.service_role_key (ou passe parâmetros na função).',
           finished_at = v_finished_at,
           duration_ms = (extract(epoch from (v_finished_at - v_started_at)) * 1000)::int
     where id = v_log_id;

    return query
    select v_log_id, 0, 0, 0, 0, 'failed'::text;

    perform pg_advisory_unlock(v_lock_key);
    return;
  end if;

  for r in
    select om.id,
           om.empresa_id,
           om.usuario_id,
           btrim(om.uf::text) as uf,
           om.numero,
           coalesce(om.sync_from, current_date - p_fallback_days) as data_inicio_fallback,
           current_date as data_fim_fallback
      from public.oab_monitoradas om
     where om.tipo = 'intimacoes'
       and (
            om.dias_semana is null
         or cardinality(om.dias_semana) = 0
         or v_today = any(om.dias_semana)
       )
     order by om.id
     limit p_batch_limit
  loop
    v_total := v_total + 1;

    -- Verifica se é a primeira sincronização do usuário
    -- Se não existem intimações, busca tudo (sem filtro de data)
    -- Se já existem, sincroniza apenas o dia atual
    declare
      v_existing_count bigint := 0;
      v_is_first_sync boolean;
      v_data_inicio text;
      v_data_fim text;
      v_body jsonb;
    begin
      select count(*) into v_existing_count
        from public.intimacoes i
       where i.idempresa = r.empresa_id
         and i.idusuario = r.usuario_id
       limit 1;

      v_is_first_sync := (v_existing_count = 0);

      -- Primeira sync: sem filtro de data (busca tudo)
      -- Syncs posteriores: apenas o dia atual
      if v_is_first_sync then
        v_data_inicio := null;
        v_data_fim := null;
      else
        v_data_inicio := current_date::text;
        v_data_fim := current_date::text;
      end if;

      v_body := jsonb_build_object(
        'oab_monitorada_id', r.id,
        'empresa_id', r.empresa_id,
        'usuario_id', r.usuario_id,
        'uf', r.uf,
        'numero', r.numero,
        'idempotency_key', format('intimacoes:%s:%s:%s', r.id, coalesce(v_data_inicio, 'all'), coalesce(v_data_fim, 'all'))
      );

      -- Adiciona datas ao body apenas se não for primeira sync
      if not v_is_first_sync then
        v_body := v_body || jsonb_build_object(
          'data_inicio', v_data_inicio,
          'data_fim', v_data_fim
        );
      end if;

      select net.http_post(
        url := v_edge_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_service_key,
          'x-scheduler-source', 'pg_cron'
        ),
        body := v_body
      ) into v_request_id;

      v_done := v_done + 1;
      v_queued := v_queued + 1;
      v_details := v_details || jsonb_build_object(
        'oab_monitorada_id', r.id,
        'status', 'queued',
        'request_id', v_request_id,
        'data_inicio', v_data_inicio,
        'data_fim', v_data_fim,
        'is_first_sync', v_is_first_sync
      );
    exception when others then
      v_failed := v_failed + 1;
      v_err := sqlerrm;
      v_details := v_details || jsonb_build_object(
        'oab_monitorada_id', r.id,
        'status', 'failed',
        'error', v_err
      );
    end;
  end loop;

  if v_total = 0 then
    v_status := 'skipped';
  elsif v_failed = 0 then
    v_status := 'success';
  elsif v_done > 0 then
    v_status := 'partial_success';
  else
    v_status := 'failed';
  end if;

  v_finished_at := clock_timestamp();

  update public.sync_intimacoes_log
     set status = v_status,
         erro = case when v_failed > 0 then format('%s falha(s) ao enfileirar chamadas HTTP.', v_failed) else null end,
         total_oabs = v_total,
         processadas = v_done,
         enfileiradas = v_queued,
         falhas = v_failed,
         detalhes = v_details,
         finished_at = v_finished_at,
         duration_ms = (extract(epoch from (v_finished_at - v_started_at)) * 1000)::int
   where id = v_log_id;

  return query
  select v_log_id, v_total, v_done, v_queued, v_failed, v_status;

  perform pg_advisory_unlock(v_lock_key);
exception when others then
  v_finished_at := clock_timestamp();
  update public.sync_intimacoes_log
     set status = 'failed',
         erro = sqlerrm,
         total_oabs = v_total,
         processadas = v_done,
         enfileiradas = v_queued,
         falhas = v_failed,
         detalhes = v_details,
         finished_at = v_finished_at,
         duration_ms = (extract(epoch from (v_finished_at - v_started_at)) * 1000)::int
   where id = v_log_id;

  perform pg_advisory_unlock(v_lock_key);
  raise;
end;
$$;

comment on function public.orquestrar_sync_intimacoes_oab(integer, integer, text, text)
is 'Lê OABs monitoradas (tipo=intimacoes), respeita dias_semana/sync_from e enfileira chamadas HTTP para a Edge Function sync-intimacoes-oab.';

-- 5) Helper: agendar via pg_cron -----------------------------------------
create or replace function public.configurar_agendamento_sync_intimacoes(
  p_cron text default '*/30 * * * *',
  p_fallback_days integer default 7,
  p_batch_limit integer default 500,
  p_edge_function_url text default null,
  p_service_role_key text default null
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_job_id bigint;
  v_command text;
begin
  begin
    perform cron.unschedule('sync-intimacoes-oab-job');
  exception when others then
    null;
  end;

  v_command := format(
    $cmd$
      select public.orquestrar_sync_intimacoes_oab(
        %s,
        %s,
        %L,
        %L
      );
    $cmd$,
    p_fallback_days,
    p_batch_limit,
    p_edge_function_url,
    p_service_role_key
  );

  select cron.schedule('sync-intimacoes-oab-job', p_cron, v_command) into v_job_id;
  return v_job_id;
end;
$$;

comment on function public.configurar_agendamento_sync_intimacoes(text, integer, integer, text, text)
is 'Cria/reconfigura job do pg_cron para executar o orquestrador de intimações.';

-- 6) Helper: pausar agendamento ------------------------------------------
create or replace function public.pausar_agendamento_sync_intimacoes()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform cron.unschedule('sync-intimacoes-oab-job');
exception
  when others then
    null;
end;
$$;

comment on function public.pausar_agendamento_sync_intimacoes()
is 'Pausa o job recorrente de sincronização de intimações.';

-- 7) Índice de idempotência em intimacoes --------------------------------
create unique index if not exists idx_intimacoes_empresa_origem_external
  on public.intimacoes (idempresa, "siglaTribunal", external_id);

-- 8) Agendamento padrão inicial (30 min) ---------------------------------
-- Envolvido em DO block para não quebrar a migração caso pg_cron não esteja
-- habilitado (o diagnóstico check_intimacoes_scheduler_prereqs() indicará).
do $$
begin
  perform public.configurar_agendamento_sync_intimacoes('*/30 * * * *');
exception when others then
  raise notice 'Agendamento padrão de intimações não aplicado (pg_cron pode não estar habilitado): %', sqlerrm;
end;
$$;

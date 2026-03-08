-- Migração Supabase: orquestração/agendamento da Edge Function de processos
-- Objetivo:
--   1) habilitar extensões de agendamento/chamada HTTP (pg_cron + pg_net)
--   2) criar log de execução
--   3) criar função de orquestração por OAB monitorada (tipo='processos')
--   4) criar helper para agendar/pausar/reconfigurar
--
-- Diagnóstico rápido (pós-migração PostgreSQL -> Supabase):
--   select * from public.check_processos_scheduler_prereqs();
--
-- Parâmetros necessários:
--   app.settings.supabase_url         = https://<project-ref>.supabase.co
--   app.settings.service_role_key     = <service-role-key>
--   edge function name (default)      = sync-processos-pdpj
--
-- Alternativa segura: passar URL/chave/nome da função por parâmetro ao chamar
-- public.orquestrar_sync_processos_oab(...).

create extension if not exists pgcrypto;
create extension if not exists pg_cron;
create extension if not exists pg_net;

CREATE TABLE IF NOT EXISTS public.sync_processos_log (
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
  constraint sync_processos_log_status_ck
    check (status in ('running', 'success', 'partial_success', 'failed', 'skipped'))
);

create index if not exists idx_sync_processos_log_started_at
  on public.sync_processos_log (started_at desc);

create or replace function public.set_sync_processos_log_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_sync_processos_log_updated_at on public.sync_processos_log;
create trigger trg_sync_processos_log_updated_at
before update on public.sync_processos_log
for each row
execute function public.set_sync_processos_log_updated_at();

create or replace function public.check_processos_scheduler_prereqs(
  p_edge_function_name text default 'sync-processos-pdpj'
)
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
         'URL base para compor /functions/v1/<nome-edge-function>.'::text
  union all
  select 'app.settings.service_role_key'::text,
         nullif(current_setting('app.settings.service_role_key', true), '') is not null as ok,
         'Bearer token da Edge Function (service_role).'::text
  union all
  select 'edge_function_name'::text,
         nullif(p_edge_function_name, '') is not null as ok,
         'Nome da edge function de processos (ex.: sync-processos-pdpj).'::text;
$$;

create or replace function public.orquestrar_sync_processos_oab(
  p_fallback_days integer default 7,
  p_batch_limit integer default 500,
  p_edge_function_name text default 'sync-processos-pdpj',
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
  v_lock_key bigint := hashtextextended('public.orquestrar_sync_processos_oab', 0);
  v_today smallint := extract(isodow from now())::smallint;
  v_edge_function_name text := coalesce(nullif(p_edge_function_name, ''), 'sync-processos-pdpj');
  v_supabase_url text := nullif(current_setting('app.settings.supabase_url', true), '');
  v_edge_url text;
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
    insert into public.sync_processos_log(status, erro)
    values ('skipped', 'Execução ignorada: já existe uma rodada em andamento (advisory lock).')
    returning id into v_log_id;

    return query
    select v_log_id, 0, 0, 0, 0, 'skipped'::text;
    return;
  end if;

  insert into public.sync_processos_log(status)
  values ('running')
  returning id into v_log_id;

  v_edge_url := coalesce(
    nullif(p_edge_function_url, ''),
    case
      when v_supabase_url is null then null
      else v_supabase_url || '/functions/v1/' || v_edge_function_name
    end
  );

  if v_edge_url is null or v_service_key is null then
    v_finished_at := clock_timestamp();
    update public.sync_processos_log
       set status = 'failed',
           erro = 'Configuração ausente: informe app.settings.supabase_url, app.settings.service_role_key e nome da edge function (ou passe parâmetros na função).',
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
           coalesce(om.sync_from, current_date - p_fallback_days) as data_inicio,
           current_date as data_fim
      from public.oab_monitoradas om
     where om.tipo = 'processos'
       and (
            om.dias_semana is null
         or cardinality(om.dias_semana) = 0
         or v_today = any(om.dias_semana)
       )
     order by om.id
     limit p_batch_limit
  loop
    v_total := v_total + 1;

    begin
      select net.http_post(
        url := v_edge_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_service_key,
          'x-scheduler-source', 'pg_cron'
        ),
        body := jsonb_build_object(
          'oabMonitoradaId', r.id,
          'empresaId', r.empresa_id,
          'usuarioId', r.usuario_id,
          'ufOab', r.uf,
          'numeroOab', r.numero,
          'dataInicio', r.data_inicio::text,
          'dataFim', r.data_fim::text,
          'idempotencyKey', format('processos:%s:%s:%s', r.id, r.data_inicio, r.data_fim)
        )
      ) into v_request_id;

      v_done := v_done + 1;
      v_queued := v_queued + 1;
      v_details := v_details || jsonb_build_object(
        'oab_monitorada_id', r.id,
        'status', 'queued',
        'request_id', v_request_id,
        'data_inicio', r.data_inicio,
        'data_fim', r.data_fim
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

  update public.sync_processos_log
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
  update public.sync_processos_log
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

comment on function public.orquestrar_sync_processos_oab(integer, integer, text, text, text)
is 'Lê OABs monitoradas (tipo=processos), respeita dias_semana/sync_from e enfileira chamadas HTTP para a Edge Function de processos.';

create or replace function public.configurar_agendamento_sync_processos(
  p_cron text default '*/30 * * * *',
  p_fallback_days integer default 7,
  p_batch_limit integer default 500,
  p_edge_function_name text default 'sync-processos-pdpj',
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
    perform cron.unschedule('sync-processos-pdpj-job');
  exception when others then
    null;
  end;

  v_command := format(
    $cmd$
      select public.orquestrar_sync_processos_oab(
        %s,
        %s,
        %L,
        %L,
        %L
      );
    $cmd$,
    p_fallback_days,
    p_batch_limit,
    p_edge_function_name,
    p_edge_function_url,
    p_service_role_key
  );

  select cron.schedule('sync-processos-pdpj-job', p_cron, v_command) into v_job_id;
  return v_job_id;
end;
$$;

comment on function public.configurar_agendamento_sync_processos(text, integer, integer, text, text, text)
is 'Cria/reconfigura job do pg_cron para executar o orquestrador de processos.';

create or replace function public.pausar_agendamento_sync_processos()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform cron.unschedule('sync-processos-pdpj-job');
exception
  when others then
    null;
end;
$$;

comment on function public.pausar_agendamento_sync_processos()
is 'Pausa o job recorrente de sincronização de processos.';

-- Agendamento padrão inicial (30 min).
-- Reconfigure depois com public.configurar_agendamento_sync_processos('*/15 * * * *', ...)
select public.configurar_agendamento_sync_processos('*/30 * * * *');

-- Migration: Auto-create cliente from pje_processo_partes
-- When a party (parte) is inserted during process sync, this trigger
-- automatically creates the corresponding client in the clientes table
-- using the CPF/CNPJ from documentos_principais.

-- ── 1. Ensure unique constraint on (documento, idempresa) ─────────────────────
-- This is needed for the ON CONFLICT clause in the trigger function.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'clientes_documento_idempresa_unique'
  ) then
    -- Only add if the constraint does not already exist
    alter table public.clientes
      add constraint clientes_documento_idempresa_unique
      unique (documento, idempresa);
  end if;
end;
$$;

-- ── 2. Create the trigger function ────────────────────────────────────────────
create or replace function public.fn_auto_create_cliente_from_parte()
returns trigger
language plpgsql
security definer
as $$
declare
  v_idempresa   integer;
  v_documento   text;
  v_tipo_doc    text;
  v_tipo_cliente text;
  v_nome        text;
  v_doc_item    jsonb;
begin
  -- Skip if no name
  v_nome := trim(coalesce(new.nome, ''));
  if v_nome = '' then
    return new;
  end if;

  -- Get idempresa from the parent pje_processos row
  select p.idempresa into v_idempresa
  from public.pje_processos p
  where p.id = new.processo_id;

  if v_idempresa is null then
    return new;
  end if;

  -- Extract the first CPF or CNPJ from documentos_principais JSONB array
  -- Expected format: [{"tipo":"CPF","numero":"12345678900"}, ...]
  if new.documentos_principais is not null
     and jsonb_typeof(new.documentos_principais) = 'array'
     and jsonb_array_length(new.documentos_principais) > 0
  then
    for v_doc_item in select * from jsonb_array_elements(new.documentos_principais)
    loop
      v_tipo_doc := upper(trim(coalesce(v_doc_item->>'tipo', '')));
      v_documento := regexp_replace(trim(coalesce(v_doc_item->>'numero', '')), '\D', '', 'g');

      if v_documento <> '' and v_tipo_doc in ('CPF', 'CNPJ') then
        exit; -- found a valid document, stop
      end if;

      -- reset if not valid
      v_documento := null;
      v_tipo_doc := null;
    end loop;
  end if;

  -- If no document found, skip (we can't upsert without a unique key)
  if v_documento is null or v_documento = '' then
    return new;
  end if;

  -- Map tipo_pessoa to clientes.tipo: FISICA -> '1', JURIDICA -> '2'
  v_tipo_cliente := case
    when upper(coalesce(new.tipo_pessoa, '')) like '%JURIDICA%' then '2'
    when upper(coalesce(new.tipo_pessoa, '')) like '%FISICA%' then '1'
    when v_tipo_doc = 'CNPJ' then '2'
    else '1'
  end;

  -- Insert the client only if it doesn't already exist for this empresa+documento
  insert into public.clientes (nome, tipo, documento, idempresa, ativo)
  values (v_nome, v_tipo_cliente, v_documento, v_idempresa, true)
  on conflict (documento, idempresa) do nothing;

  return new;
end;
$$;

-- ── 3. Create the trigger ─────────────────────────────────────────────────────
drop trigger if exists trg_auto_create_cliente_from_parte on public.pje_processo_partes;

create trigger trg_auto_create_cliente_from_parte
after insert on public.pje_processo_partes
for each row
execute function public.fn_auto_create_cliente_from_parte();

comment on function public.fn_auto_create_cliente_from_parte() is
'Trigger function: automatically creates a client in the clientes table when a party is inserted into pje_processo_partes, using the CPF/CNPJ from documentos_principais.';

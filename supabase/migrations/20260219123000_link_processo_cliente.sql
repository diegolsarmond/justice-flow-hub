-- Migration: Add cliente_id to pje_processos and link on trigger
-- Created at: 2026-02-19

-- ── 1. Add column cliente_id to pje_processos if it doesn't exist ────────────────
-- We use a DO block to safely check column existence before altering.
do $$
begin
    -- Check if column exists in information_schema
    if not exists (
      select 1 
      from information_schema.columns 
      where table_schema = 'public' 
        and table_name = 'pje_processos' 
        and column_name = 'cliente_id'
    ) then
        alter table public.pje_processos
        add column cliente_id integer references public.clientes(id);
    end if;
end;
$$;

-- ── 2. Update the trigger function to link the process to the client ──────────────
create or replace function public.fn_auto_create_cliente_from_parte()
returns trigger
language plpgsql
security definer
as $$
declare
  v_idempresa    integer;
  v_cliente_id   integer;
  v_documento    text;
  v_cpf_cnpj_raw text;
  v_tipo_doc     text;
  v_doc_item     jsonb;
  v_tipo_cliente text; -- '1' = PF, '2' = PJ
  v_nome_parte   text;
begin
  -- 2.1. Validar nome da parte
  v_nome_parte := trim(coalesce(new.nome, ''));
  if v_nome_parte = '' then
    return new;
  end if;

  -- 2.2. Obter empresa do processo pai
  select p.idempresa into v_idempresa
  from public.pje_processos p
  where p.id = new.processo_id;

  if v_idempresa is null then
    return new; -- Processo sem empresa vinculada
  end if;

  -- 2.3. Extrair CPF/CNPJ dos documentos_principais
  -- Expected format: [{"tipo":"CPF","numero":"123.456.789-00"}, ...]
  v_documento := null;
  
  if new.documentos_principais is not null
     and jsonb_typeof(new.documentos_principais) = 'array'
     and jsonb_array_length(new.documentos_principais) > 0
  then
    for v_doc_item in select * from jsonb_array_elements(new.documentos_principais)
    loop
      v_tipo_doc := upper(trim(coalesce(v_doc_item->>'tipo', '')));
      v_cpf_cnpj_raw := trim(coalesce(v_doc_item->>'numero', ''));
      
      -- Remove caracteres não numéricos
      v_cpf_cnpj_raw := regexp_replace(v_cpf_cnpj_raw, '\D', '', 'g');

      if v_cpf_cnpj_raw <> '' and v_tipo_doc in ('CPF', 'CNPJ') then
        v_documento := v_cpf_cnpj_raw;
        -- Sai do loop ao encontrar o primeiro documento válido
        exit; 
      end if;
    end loop;
  end if;

  -- Se não encontrou documento válido, não é possível vincular/criar cliente único
  if v_documento is null or v_documento = '' then
    return new;
  end if;

  -- 2.4. Definir tipo de cliente (Física/Jurídica)
  if v_tipo_doc = 'CNPJ' then
     v_tipo_cliente := '2'; -- PJ
  elsif v_tipo_doc = 'CPF' then
     v_tipo_cliente := '1'; -- PF
  else
     -- Fallback por nome ou tipo_pessoa
     if upper(coalesce(new.tipo_pessoa, '')) like '%JURIDICA%' then
       v_tipo_cliente := '2';
     else
       v_tipo_cliente := '1';
     end if;
  end if;

  -- 2.5. Upsert na tabela de clientes
  -- Tenta inserir. Se der conflito (documento + idempresa), não faz nada.
  -- A constraint unique(documento, idempresa) deve existir (criada na migration anterior).
  insert into public.clientes (nome, tipo, documento, idempresa, ativo)
  values (v_nome_parte, v_tipo_cliente, v_documento, v_idempresa, true)
  on conflict (documento, idempresa) 
  do update set 
     -- Opcional: atualizar nome se estiver vazio ou desatualizado? 
     -- Por segurança, melhor manter o cadastro original do cliente se já existir.
     updated_at = now() 
  returning id into v_cliente_id;

  -- Se o cliente já existia (DO NOTHING ou UPDATE sem mudança de ID), precisamos buscar o ID manualmente
  if v_cliente_id is null then
      select id into v_cliente_id
      from public.clientes
      where documento = v_documento
        and idempresa = v_idempresa
      limit 1;
  end if;

  -- 2.6. Vincular o Cliente ao Processo
  -- Atualiza o processo pai com o ID do cliente encontrado/criado.
  if v_cliente_id is not null then
      update public.pje_processos
      set cliente_id = v_cliente_id
      where id = new.processo_id
        -- Só atualiza se estiver vazio ou diferente (evita writes desnecessários)
        -- OBS: Se houver múltiplas partes (Autor e Réu) que são clientes,
        -- o último a ser processado pela trigger ganhará o vínculo.
        and (cliente_id is null or cliente_id <> v_cliente_id);
  end if;

  return new;
end;
$$;

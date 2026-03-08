-- Canonicalização final do chat após migração para Supabase.
-- Objetivo:
-- 1) manter public.conversations como fonte única;
-- 2) migrar remanescentes de tabelas legadas;
-- 3) congelar escrita legada;
-- 4) remover FKs dependentes e dropar tabelas legadas.

create extension if not exists pgcrypto;

-- =====================================================
-- 1) Migração complementar de dados legados -> canônico
-- =====================================================
DO $$
BEGIN
  -- legado 1: chat_conversations
  IF to_regclass('public.chat_conversations') IS NOT NULL THEN
    EXECUTE $m$
      INSERT INTO public.conversations (
        id,
        instance_id,
        wa_chat_id,
        contact_name,
        contact_phone,
        contact_image,
        unread_count,
        last_message_at,
        last_message_text,
        created_at,
        updated_at
      )
      SELECT
        CASE
          WHEN cc.id ~ '^[0-9a-fA-F-]{36}$' THEN cc.id::uuid
          ELSE gen_random_uuid()
        END,
        i.id,
        COALESCE(cc.wa_chat_id, cc.contact_identifier),
        COALESCE(cc.contact_name, cc.client_name),
        cc.phone_number,
        cc.contact_avatar,
        COALESCE(cc.unread_count, 0),
        cc.last_message_timestamp,
        cc.last_message_preview,
        COALESCE(cc.created_at, now()),
        COALESCE(cc.updated_at, now())
      FROM public.chat_conversations cc
      JOIN public.instances i
        ON i.uazapi_instance_id = cc.credential_id
      ON CONFLICT (wa_chat_id, instance_id) DO UPDATE SET
        contact_name = EXCLUDED.contact_name,
        contact_phone = EXCLUDED.contact_phone,
        contact_image = EXCLUDED.contact_image,
        unread_count = EXCLUDED.unread_count,
        last_message_at = EXCLUDED.last_message_at,
        last_message_text = EXCLUDED.last_message_text,
        updated_at = EXCLUDED.updated_at
    $m$;
  END IF;

  -- legado 2: uazapi_conversations
  IF to_regclass('public.uazapi_conversations') IS NOT NULL THEN
    IF (
      SELECT count(*)
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'uazapi_conversations'
        AND column_name IN ('instance_id', 'wa_chat_id')
    ) = 2 THEN
      EXECUTE $m$
        INSERT INTO public.conversations (
          id,
          instance_id,
          wa_chat_id,
          contact_name,
          contact_phone,
          contact_image,
          unread_count,
          status,
          assigned_to,
          last_message_at,
          last_message_text,
          created_at,
          updated_at
        )
        SELECT
          COALESCE(uc.id, gen_random_uuid()),
          uc.instance_id,
          uc.wa_chat_id,
          uc.contact_name,
          uc.contact_phone,
          uc.contact_image,
          COALESCE(uc.unread_count, 0),
          COALESCE(uc.status, 'pending'),
          uc.assigned_to,
          uc.last_message_at,
          uc.last_message_text,
          COALESCE(uc.created_at, now()),
          COALESCE(uc.updated_at, now())
        FROM public.uazapi_conversations uc
        ON CONFLICT (wa_chat_id, instance_id) DO UPDATE SET
          contact_name = EXCLUDED.contact_name,
          contact_phone = EXCLUDED.contact_phone,
          contact_image = EXCLUDED.contact_image,
          unread_count = EXCLUDED.unread_count,
          status = EXCLUDED.status,
          assigned_to = EXCLUDED.assigned_to,
          last_message_at = EXCLUDED.last_message_at,
          last_message_text = EXCLUDED.last_message_text,
          updated_at = EXCLUDED.updated_at
      $m$;
    END IF;
  END IF;
END $$;

-- =====================================================
-- 2) Congela escrita em tabelas legadas (janela de validação)
-- =====================================================
create or replace function public.block_legacy_chat_writes()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Tabela legada de chat em modo somente leitura. Use public.conversations.';
end;
$$;

DO $$
BEGIN
  IF to_regclass('public.chat_conversations') IS NOT NULL THEN
    EXECUTE 'drop trigger if exists trg_block_legacy_chat_conversations_writes on public.chat_conversations';
    EXECUTE 'create trigger trg_block_legacy_chat_conversations_writes before insert or update or delete on public.chat_conversations for each row execute function public.block_legacy_chat_writes()';
  END IF;

  IF to_regclass('public.uazapi_conversations') IS NOT NULL THEN
    EXECUTE 'drop trigger if exists trg_block_legacy_uazapi_conversations_writes on public.uazapi_conversations';
    EXECUTE 'create trigger trg_block_legacy_uazapi_conversations_writes before insert or update or delete on public.uazapi_conversations for each row execute function public.block_legacy_chat_writes()';
  END IF;
END $$;

-- =====================================================
-- 3) Remove FKs dependentes e elimina legados
-- =====================================================
DO $$
DECLARE
  fk record;
BEGIN
  FOR fk IN
    SELECT con.conname,
           con.conrelid::regclass AS ref_table
    FROM pg_constraint con
    WHERE con.contype = 'f'
      AND con.confrelid = ANY (
        ARRAY_REMOVE(ARRAY[
          to_regclass('public.chat_conversations'),
          to_regclass('public.uazapi_conversations')
        ], NULL)::regclass[]
      )
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT IF EXISTS %I', fk.ref_table, fk.conname);
  END LOOP;
END $$;

-- auxiliares legados dependentes de chat_conversations
drop table if exists public.chat_messages;
drop table if exists public.uazapi_messages;

drop view if exists public.chat_conversations;
drop view if exists public.uazapi_conversations;

drop table if exists public.chat_conversations;
drop table if exists public.uazapi_conversations;

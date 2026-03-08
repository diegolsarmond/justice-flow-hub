-- Migração de compatibilidade do módulo UAZAPI
-- Objetivo: alinhar schema Supabase com o contrato usado em
-- supabase/functions/uazapi-proxy/handlers/*.ts

create extension if not exists pgcrypto;

-- =====================================================
-- 1) INSTANCES
-- =====================================================
create table if not exists public.instances (
  id uuid primary key default gen_random_uuid(),
  uazapi_instance_id text not null,
  uazapi_token text,
  name text,
  status text default 'disconnected',
  qr_code text,
  phone_number text,
  profile_name text,
  profile_pic_url text,
  is_business boolean default false,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.instances add column if not exists id uuid;
alter table public.instances alter column id set default gen_random_uuid();
update public.instances set id = gen_random_uuid() where id is null;
alter table public.instances alter column id set not null;

alter table public.instances add column if not exists uazapi_instance_id text;
alter table public.instances add column if not exists uazapi_token text;
alter table public.instances add column if not exists name text;
alter table public.instances add column if not exists status text;
alter table public.instances add column if not exists qr_code text;
alter table public.instances add column if not exists phone_number text;
alter table public.instances add column if not exists profile_name text;
alter table public.instances add column if not exists profile_pic_url text;
alter table public.instances add column if not exists is_business boolean default false;
alter table public.instances add column if not exists created_by uuid;
alter table public.instances add column if not exists created_at timestamptz not null default now();
alter table public.instances add column if not exists updated_at timestamptz not null default now();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.instances WHERE uazapi_instance_id IS NULL) THEN
    ALTER TABLE public.instances ALTER COLUMN uazapi_instance_id SET NOT NULL;
  END IF;
END $$;

create unique index if not exists instances_uazapi_instance_id_key on public.instances (uazapi_instance_id);
create index if not exists idx_instances_created_at on public.instances (created_at desc);
create index if not exists idx_instances_created_by on public.instances (created_by);

-- garante PK mesmo em tabelas antigas sem PK em id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.instances'::regclass
      AND contype = 'p'
  ) THEN
    ALTER TABLE public.instances ADD CONSTRAINT instances_pkey PRIMARY KEY (id);
  END IF;
END $$;

-- =====================================================
-- 2) CONVERSATIONS
-- =====================================================
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  instance_id uuid not null,
  wa_chat_id text not null,
  contact_name text,
  contact_phone text,
  contact_image text,
  is_group boolean not null default false,
  unread_count integer not null default 0,
  status text not null default 'pending',
  assigned_to uuid,
  last_message_at timestamptz,
  last_message_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint conversations_instance_id_fkey
    foreign key (instance_id) references public.instances(id) on delete cascade
);

alter table public.conversations add column if not exists id uuid;
alter table public.conversations alter column id set default gen_random_uuid();
update public.conversations set id = gen_random_uuid() where id is null;
alter table public.conversations alter column id set not null;

alter table public.conversations add column if not exists instance_id uuid;
alter table public.conversations add column if not exists wa_chat_id text;
alter table public.conversations add column if not exists contact_name text;
alter table public.conversations add column if not exists contact_phone text;
alter table public.conversations add column if not exists contact_image text;
alter table public.conversations add column if not exists is_group boolean not null default false;
alter table public.conversations add column if not exists unread_count integer not null default 0;
alter table public.conversations add column if not exists status text not null default 'pending';
alter table public.conversations add column if not exists assigned_to uuid;
alter table public.conversations add column if not exists last_message_at timestamptz;
alter table public.conversations add column if not exists last_message_text text;
alter table public.conversations add column if not exists created_at timestamptz not null default now();
alter table public.conversations add column if not exists updated_at timestamptz not null default now();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.conversations WHERE instance_id IS NULL) THEN
    ALTER TABLE public.conversations ALTER COLUMN instance_id SET NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.conversations WHERE wa_chat_id IS NULL) THEN
    ALTER TABLE public.conversations ALTER COLUMN wa_chat_id SET NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.conversations'::regclass
      AND conname = 'conversations_instance_id_fkey'
  ) THEN
    ALTER TABLE public.conversations
      ADD CONSTRAINT conversations_instance_id_fkey
      FOREIGN KEY (instance_id) REFERENCES public.instances(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.conversations'::regclass
      AND contype = 'p'
  ) THEN
    ALTER TABLE public.conversations ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);
  END IF;
END $$;

create unique index if not exists conversations_wa_chat_id_instance_id_key
  on public.conversations (wa_chat_id, instance_id);
create index if not exists idx_conversations_instance_last_message_at
  on public.conversations (instance_id, last_message_at desc);
create index if not exists idx_conversations_instance_status
  on public.conversations (instance_id, status);
create index if not exists idx_conversations_assigned_to
  on public.conversations (assigned_to);

-- =====================================================
-- 3) MESSAGES
-- =====================================================
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null,
  instance_id uuid,
  wa_message_id text,
  content text,
  message_type text not null default 'text',
  from_me boolean not null default false,
  sender_id text,
  sender_name text,
  status text,
  is_private boolean not null default false,
  edited_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint messages_conversation_id_fkey
    foreign key (conversation_id) references public.conversations(id) on delete cascade,
  constraint messages_instance_id_fkey
    foreign key (instance_id) references public.instances(id) on delete set null
);

alter table public.messages add column if not exists id uuid;
alter table public.messages alter column id set default gen_random_uuid();
update public.messages set id = gen_random_uuid() where id is null;
alter table public.messages alter column id set not null;

alter table public.messages add column if not exists conversation_id uuid;
alter table public.messages add column if not exists instance_id uuid;
alter table public.messages add column if not exists wa_message_id text;
alter table public.messages add column if not exists content text;
alter table public.messages add column if not exists message_type text not null default 'text';
alter table public.messages add column if not exists from_me boolean not null default false;
alter table public.messages add column if not exists sender_id text;
alter table public.messages add column if not exists sender_name text;
alter table public.messages add column if not exists status text;
alter table public.messages add column if not exists is_private boolean not null default false;
alter table public.messages add column if not exists edited_at timestamptz;
alter table public.messages add column if not exists created_at timestamptz not null default now();
alter table public.messages add column if not exists updated_at timestamptz not null default now();

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.messages WHERE conversation_id IS NULL) THEN
    ALTER TABLE public.messages ALTER COLUMN conversation_id SET NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.messages'::regclass
      AND conname = 'messages_conversation_id_fkey'
  ) THEN
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_conversation_id_fkey
      FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.messages'::regclass
      AND conname = 'messages_instance_id_fkey'
  ) THEN
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_instance_id_fkey
      FOREIGN KEY (instance_id) REFERENCES public.instances(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.messages'::regclass
      AND contype = 'p'
  ) THEN
    ALTER TABLE public.messages ADD CONSTRAINT messages_pkey PRIMARY KEY (id);
  END IF;
END $$;

create unique index if not exists messages_wa_message_id_key on public.messages (wa_message_id);
create index if not exists idx_messages_conversation_created_at
  on public.messages (conversation_id, created_at desc);
create index if not exists idx_messages_instance_created_at
  on public.messages (instance_id, created_at desc);

-- preenche instance_id em mensagens antigas e novas (se vier nulo)
update public.messages m
set instance_id = c.instance_id
from public.conversations c
where m.conversation_id = c.id
  and m.instance_id is null;

create or replace function public.set_message_instance_id()
returns trigger
language plpgsql
as $$
begin
  if new.instance_id is null then
    select c.instance_id into new.instance_id
    from public.conversations c
    where c.id = new.conversation_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_messages_set_instance_id on public.messages;
create trigger trg_messages_set_instance_id
before insert or update of conversation_id, instance_id
on public.messages
for each row
execute function public.set_message_instance_id();

-- =====================================================
-- 4) MESSAGE ATTACHMENTS (usado pelos handlers)
-- =====================================================
create table if not exists public.message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null,
  chat_id text,
  media_url text,
  media_base64 text,
  media_type text,
  filename text,
  created_at timestamptz not null default now(),
  constraint message_attachments_message_id_fkey
    foreign key (message_id) references public.messages(id) on delete cascade
);

alter table public.message_attachments add column if not exists id uuid;
alter table public.message_attachments alter column id set default gen_random_uuid();
update public.message_attachments set id = gen_random_uuid() where id is null;
alter table public.message_attachments alter column id set not null;

alter table public.message_attachments add column if not exists message_id uuid;
alter table public.message_attachments add column if not exists chat_id text;
alter table public.message_attachments add column if not exists media_url text;
alter table public.message_attachments add column if not exists media_base64 text;
alter table public.message_attachments add column if not exists media_type text;
alter table public.message_attachments add column if not exists filename text;
alter table public.message_attachments add column if not exists created_at timestamptz not null default now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.message_attachments'::regclass
      AND conname = 'message_attachments_message_id_fkey'
  ) THEN
    ALTER TABLE public.message_attachments
      ADD CONSTRAINT message_attachments_message_id_fkey
      FOREIGN KEY (message_id) REFERENCES public.messages(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.message_attachments'::regclass
      AND contype = 'p'
  ) THEN
    ALTER TABLE public.message_attachments ADD CONSTRAINT message_attachments_pkey PRIMARY KEY (id);
  END IF;
END $$;

create index if not exists idx_message_attachments_message_id
  on public.message_attachments (message_id);

-- =====================================================
-- 5) Compatibilidade com nomes antigos (chat_*)
-- =====================================================
-- Migra dados de chat_conversations -> conversations (se existir schema legado)
DO $$
BEGIN
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
        i.id AS instance_id,
        COALESCE(cc.wa_chat_id, cc.contact_identifier) AS wa_chat_id,
        COALESCE(cc.contact_name, cc.client_name) AS contact_name,
        cc.phone_number AS contact_phone,
        cc.contact_avatar AS contact_image,
        COALESCE(cc.unread_count, 0) AS unread_count,
        cc.last_message_timestamp AS last_message_at,
        cc.last_message_preview AS last_message_text,
        COALESCE(cc.created_at, now()) AS created_at,
        COALESCE(cc.updated_at, now()) AS updated_at
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
END $$;

-- Migra dados de chat_messages -> messages (se existir schema legado)
DO $$
BEGIN
  IF to_regclass('public.chat_messages') IS NOT NULL
     AND to_regclass('public.chat_conversations') IS NOT NULL THEN
    EXECUTE $m$
      INSERT INTO public.messages (
        id,
        conversation_id,
        instance_id,
        wa_message_id,
        content,
        message_type,
        from_me,
        sender_name,
        status,
        created_at,
        updated_at
      )
      SELECT
        CASE
          WHEN cm.id ~ '^[0-9a-fA-F-]{36}$' THEN cm.id::uuid
          ELSE gen_random_uuid()
        END,
        c.id AS conversation_id,
        c.instance_id,
        cm.external_id AS wa_message_id,
        cm.content,
        COALESCE(cm.message_type, 'text') AS message_type,
        (cm.sender = 'agent') AS from_me,
        cm.sender AS sender_name,
        cm.status,
        COALESCE(cm."timestamp", cm.created_at, now()) AS created_at,
        now() AS updated_at
      FROM public.chat_messages cm
      JOIN public.chat_conversations cc ON cc.id = cm.conversation_id
      JOIN public.instances i ON i.uazapi_instance_id = cc.credential_id
      JOIN public.conversations c
        ON c.instance_id = i.id
       AND c.wa_chat_id = COALESCE(cc.wa_chat_id, cc.contact_identifier)
      ON CONFLICT (wa_message_id) DO NOTHING
    $m$;
  END IF;
END $$;

-- Views de compatibilidade para clientes legados, caso as tabelas antigas não existam
DO $$
BEGIN
  IF to_regclass('public.chat_conversations') IS NULL THEN
    EXECUTE $v$
      CREATE VIEW public.chat_conversations AS
      SELECT
        c.id::text AS id,
        c.wa_chat_id AS contact_identifier,
        c.contact_name,
        c.contact_image AS contact_avatar,
        NULL::text AS short_status,
        NULL::text AS description,
        false AS pinned,
        c.unread_count,
        NULL::text AS last_message_id,
        c.last_message_text AS last_message_preview,
        c.last_message_at AS last_message_timestamp,
        NULL::text AS last_message_sender,
        NULL::text AS last_message_type,
        NULL::text AS last_message_status,
        NULL::jsonb AS metadata,
        c.created_at,
        c.updated_at,
        c.contact_phone AS phone_number,
        NULL::integer AS responsible_id,
        NULL::jsonb AS responsible_snapshot,
        NULL::jsonb AS tags,
        NULL::text AS client_name,
        false AS is_linked_to_client,
        NULL::jsonb AS custom_attributes,
        false AS is_private,
        NULL::jsonb AS internal_notes,
        NULL::integer AS client_id,
        i.uazapi_instance_id AS credential_id,
        c.wa_chat_id
      FROM public.conversations c
      JOIN public.instances i ON i.id = c.instance_id
    $v$;
  END IF;

  IF to_regclass('public.chat_messages') IS NULL THEN
    EXECUTE $v$
      CREATE VIEW public.chat_messages AS
      SELECT
        m.id::text AS id,
        m.conversation_id::text AS conversation_id,
        m.wa_message_id AS external_id,
        NULL::text AS client_message_id,
        COALESCE(m.sender_name, CASE WHEN m.from_me THEN 'agent' ELSE 'contact' END) AS sender,
        COALESCE(m.content, '') AS content,
        m.message_type,
        COALESCE(m.status, 'sent') AS status,
        m.created_at AS "timestamp",
        NULL::jsonb AS attachments,
        m.created_at,
        NULL::timestamptz AS deleted_at,
        NULL::text AS deleted_by,
        NULL::text AS reaction
      FROM public.messages m
    $v$;
  END IF;
END $$;

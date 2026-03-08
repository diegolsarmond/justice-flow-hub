
-- Chat/Messaging tables
CREATE TABLE IF NOT EXISTS public.chat_conversations (
  id text NOT NULL PRIMARY KEY,
  contact_identifier text NOT NULL,
  contact_name text,
  contact_avatar text,
  short_status text,
  description text,
  pinned boolean NOT NULL DEFAULT FALSE,
  unread_count integer NOT NULL DEFAULT 0,
  last_message_id text,
  last_message_preview text,
  last_message_timestamp timestamp with time zone,
  last_message_sender text,
  last_message_type text,
  last_message_status text,
  metadata jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  phone_number text,
  responsible_id integer,
  responsible_snapshot jsonb,
  tags jsonb,
  client_name text,
  is_linked_to_client boolean NOT NULL DEFAULT FALSE,
  custom_attributes jsonb,
  is_private boolean NOT NULL DEFAULT FALSE,
  internal_notes jsonb,
  client_id integer REFERENCES public.clientes(id),
  credential_id text,
  wa_chat_id text
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id text NOT NULL PRIMARY KEY,
  conversation_id text NOT NULL REFERENCES public.chat_conversations(id),
  external_id text,
  client_message_id text,
  sender text NOT NULL,
  content text NOT NULL,
  message_type text NOT NULL,
  status text NOT NULL,
  timestamp timestamp with time zone NOT NULL,
  attachments jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  deleted_at timestamp with time zone,
  deleted_by text,
  reaction text
);

-- UAZapi instances and conversations
CREATE TABLE IF NOT EXISTS public.uazapi_instances (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  phone_number text,
  status text,
  uazapi_instance_id text UNIQUE,
  uazapi_token text,
  qr_code text,
  profile_name text,
  profile_pic_url text,
  is_business boolean DEFAULT FALSE,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.uazapi_conversations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  instance_id uuid NOT NULL REFERENCES public.uazapi_instances(id),
  wa_chat_id text NOT NULL,
  contact_name text,
  contact_phone text NOT NULL,
  contact_image text,
  is_group boolean DEFAULT FALSE,
  status text,
  unread_count integer DEFAULT 0,
  last_message_text text,
  last_message_at timestamp with time zone,
  assigned_to uuid,
  tags text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  contact_display_name text,
  desativar_bot boolean NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS public.uazapi_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES public.uazapi_conversations(id),
  wa_message_id text UNIQUE,
  sender_id text,
  sender_name text,
  content text,
  message_type text DEFAULT 'text',
  from_me boolean DEFAULT FALSE,
  status text DEFAULT 'sent',
  quoted_message_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  is_private boolean NOT NULL DEFAULT FALSE,
  edited_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.uazapi_message_attachments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id uuid NOT NULL REFERENCES public.uazapi_messages(id),
  media_url text,
  media_type text,
  filename text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  media_base64 text,
  chat_id text
);

-- UAZ credentials
CREATE TABLE IF NOT EXISTS public.uaz_credentials (
  id text NOT NULL PRIMARY KEY,
  empresa_id bigint,
  subdomain text NOT NULL,
  token text NOT NULL,
  status text,
  webhook_id text,
  webhook_url text,
  qr_code text,
  pair_code text,
  profile_name text,
  phone_number text,
  connected boolean NOT NULL DEFAULT FALSE,
  sse_token text,
  sse_base_url text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ops_uaz_sse_tokens (
  credential_id text NOT NULL PRIMARY KEY,
  sse_token text NOT NULL,
  sse_base_url text
);

-- Labels
CREATE TABLE IF NOT EXISTS public.labels (
  id text NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#00a884',
  company_id bigint,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Quick answers
CREATE SEQUENCE IF NOT EXISTS quick_answers_id_seq;
CREATE TABLE IF NOT EXISTS public.quick_answers (
  id integer NOT NULL DEFAULT nextval('quick_answers_id_seq') PRIMARY KEY,
  empresa_id integer NOT NULL,
  shortcut text NOT NULL,
  message text NOT NULL,
  media_url text,
  media_type text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Notifications
CREATE SEQUENCE IF NOT EXISTS notifications_id_seq;
CREATE TABLE IF NOT EXISTS public.notifications (
  id bigint NOT NULL DEFAULT nextval('notifications_id_seq') PRIMARY KEY,
  user_id text NOT NULL,
  category text NOT NULL,
  type text NOT NULL DEFAULT 'info',
  title text NOT NULL,
  message text NOT NULL,
  metadata jsonb,
  action_url text,
  read boolean NOT NULL DEFAULT FALSE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  read_at timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id text NOT NULL PRIMARY KEY,
  preferences jsonb NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uazapi_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uazapi_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uazapi_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uazapi_message_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uaz_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ops_uaz_sse_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quick_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Members view" ON public.chat_conversations FOR SELECT TO authenticated USING (public.is_office_member());
CREATE POLICY "Members manage" ON public.chat_conversations FOR ALL TO authenticated USING (public.is_office_member());
CREATE POLICY "Members view" ON public.chat_messages FOR SELECT TO authenticated USING (public.is_office_member());
CREATE POLICY "Members manage" ON public.chat_messages FOR ALL TO authenticated USING (public.is_office_member());
CREATE POLICY "Members view" ON public.uazapi_instances FOR SELECT TO authenticated USING (public.is_office_member());
CREATE POLICY "Admins manage" ON public.uazapi_instances FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Members view" ON public.uazapi_conversations FOR SELECT TO authenticated USING (public.is_office_member());
CREATE POLICY "Members manage" ON public.uazapi_conversations FOR ALL TO authenticated USING (public.is_office_member());
CREATE POLICY "Members view" ON public.uazapi_messages FOR SELECT TO authenticated USING (public.is_office_member());
CREATE POLICY "Members manage" ON public.uazapi_messages FOR ALL TO authenticated USING (public.is_office_member());
CREATE POLICY "Members view" ON public.uazapi_message_attachments FOR SELECT TO authenticated USING (public.is_office_member());
CREATE POLICY "Members manage" ON public.uazapi_message_attachments FOR ALL TO authenticated USING (public.is_office_member());
CREATE POLICY "Members view" ON public.uaz_credentials FOR SELECT TO authenticated USING (public.is_office_member());
CREATE POLICY "Admins manage" ON public.uaz_credentials FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Admins manage" ON public.ops_uaz_sse_tokens FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Members view" ON public.labels FOR SELECT TO authenticated USING (public.is_office_member());
CREATE POLICY "Members manage" ON public.labels FOR ALL TO authenticated USING (public.is_office_member());
CREATE POLICY "Members view" ON public.quick_answers FOR SELECT TO authenticated USING (public.is_office_member());
CREATE POLICY "Admins manage" ON public.quick_answers FOR ALL TO authenticated USING (public.is_admin());
CREATE POLICY "Members view" ON public.notifications FOR SELECT TO authenticated USING (public.is_office_member());
CREATE POLICY "Members manage" ON public.notifications FOR ALL TO authenticated USING (public.is_office_member());
CREATE POLICY "Members view" ON public.notification_preferences FOR SELECT TO authenticated USING (public.is_office_member());
CREATE POLICY "Members manage" ON public.notification_preferences FOR ALL TO authenticated USING (public.is_office_member());

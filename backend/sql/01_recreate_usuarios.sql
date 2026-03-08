-- WARNING: This script recreates the table and will preserve data only if you backup first or use ALTER.
-- For a clean recreation:

DROP TABLE IF EXISTS public.usuarios CASCADE;

CREATE TABLE IF NOT EXISTS public.usuarios (
  id serial not null,
  nome_completo text not null,
  cpf character varying null,
  email character varying not null,
  perfil integer not null,
  empresa integer not null,
  setor integer null,
  oab character varying null,
  status boolean not null default true,
  senha character varying null,
  telefone character varying null,
  ultimo_login timestamp without time zone null,
  observacoes text null,
  datacriacao timestamp without time zone not null default now(),
  must_change_password boolean null,
  email_confirmed_at timestamp without time zone null,
  welcome_email_pending boolean not null default false,
  auth_user_id uuid null,
  empresa_id integer null,
  perfil_id integer null,
  ativo boolean null,
  constraint usuarios_pkey primary key (id),
  constraint usuarios_email_key unique (email),
  constraint usuarios_unique unique (cpf),
  constraint usuarios_auth_user_id_fkey foreign KEY (auth_user_id) references auth.users (id),
  constraint usuarios_empresa_fkey foreign KEY (empresa) references public.empresas (id) on update CASCADE on delete CASCADE,
  constraint usuarios_perfil_fkey foreign KEY (perfil) references public.perfis (id)
) TABLESPACE pg_default;

create index IF not exists idx_usuarios_auth_user_id on public.usuarios using btree (auth_user_id) TABLESPACE pg_default;

create index IF not exists idx_usuarios_email_lower on public.usuarios using btree (
  lower(
    TRIM(
      both
      from
        email
    )
  )
) TABLESPACE pg_default;

create index IF not exists idx_usuarios_empresa on public.usuarios using btree (empresa) TABLESPACE pg_default;

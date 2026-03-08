-- Create perfis table
CREATE TABLE IF NOT EXISTS public.perfis (
  id serial not null,
  nome text not null,
  ativo boolean not null default true,
  datacriacao timestamp without time zone not null default now(),
  idempresa integer null,
  ver_todas_conversas boolean not null default true,
  constraint perfis_unique unique (id)
) TABLESPACE pg_default;

-- Create Administrator profile
INSERT INTO public.perfis (nome, ver_todas_conversas)
VALUES ('Administrador', true);

-- Assign the Administrator profile (ID 1, usually) to a specific user
-- Replace 'seu_email@dominio.com' with the actual user's email
UPDATE public.usuarios
SET perfil = (SELECT id FROM public.perfis WHERE nome = 'Administrador' LIMIT 1)
WHERE email = 'seu_email@dominio.com';

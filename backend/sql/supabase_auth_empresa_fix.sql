-- Correções de compatibilidade pós-migração para Supabase
-- Objetivo: garantir vínculo auth.users -> usuarios e sincronizar colunas legado/novas

BEGIN;

-- 1) Garantir colunas de compatibilidade na tabela usuarios
ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS auth_user_id uuid,
  ADD COLUMN IF NOT EXISTS empresa_id integer,
  ADD COLUMN IF NOT EXISTS perfil_id integer,
  ADD COLUMN IF NOT EXISTS ativo boolean,
  ADD COLUMN IF NOT EXISTS must_change_password boolean;

-- 2) Sincronizar valores entre colunas antigas e novas
UPDATE public.usuarios
SET
  empresa = COALESCE(empresa, empresa_id),
  empresa_id = COALESCE(empresa_id, empresa),
  perfil = COALESCE(perfil, perfil_id),
  perfil_id = COALESCE(perfil_id, perfil),
  status = COALESCE(status, ativo, true),
  ativo = COALESCE(ativo, status, true),
  must_change_password = COALESCE(must_change_password, false);

-- 2.1) Compatibilidade também na tabela perfis (legado: idempresa / novo: empresa_id)
ALTER TABLE public.perfis
  ADD COLUMN IF NOT EXISTS empresa_id integer;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'perfis'
      AND column_name = 'idempresa'
  ) THEN
    EXECUTE '
      UPDATE public.perfis
      SET empresa_id = COALESCE(empresa_id, idempresa),
          idempresa = COALESCE(idempresa, empresa_id)
    ';
  END IF;
END $$;

-- 3) Vincular auth_user_id por e-mail (case-insensitive)
UPDATE public.usuarios u
SET auth_user_id = au.id
FROM auth.users au
WHERE u.auth_user_id IS NULL
  AND lower(trim(u.email)) = lower(trim(au.email));

-- 4) Índices para lookup rápido no login/autenticação
CREATE INDEX IF NOT EXISTS idx_usuarios_auth_user_id ON public.usuarios(auth_user_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_email_lower ON public.usuarios((lower(trim(email))));
CREATE INDEX IF NOT EXISTS idx_usuarios_empresa ON public.usuarios(empresa);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'perfis'
      AND column_name = 'idempresa'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_perfis_idempresa ON public.perfis(idempresa)';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_perfis_empresa_id ON public.perfis(empresa_id);

-- 5) Constraint de FK (somente se ainda não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'usuarios_auth_user_id_fkey'
  ) THEN
    ALTER TABLE public.usuarios
      ADD CONSTRAINT usuarios_auth_user_id_fkey
      FOREIGN KEY (auth_user_id) REFERENCES auth.users(id);
  END IF;
END $$;

COMMIT;

-- Diagnóstico rápido
SELECT
  u.id,
  u.email,
  u.auth_user_id,
  u.empresa,
  u.perfil,
  CASE
    WHEN u.auth_user_id IS NULL THEN 'PENDENTE_VINCULO_AUTH'
    WHEN u.empresa IS NULL THEN 'PENDENTE_EMPRESA'
    ELSE 'OK'
  END AS status_migracao
FROM public.usuarios u
ORDER BY u.id DESC
LIMIT 100;

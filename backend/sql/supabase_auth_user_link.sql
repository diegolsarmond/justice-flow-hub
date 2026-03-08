-- Script operacional/manual para vincular usuarios.auth_user_id com auth.users(id)
-- Convenção: scripts manuais ficam em backend/sql/
-- Observação: este script NÃO cria colunas/constraints/índices.
-- Para correções completas de compatibilidade pós-migração use:
--   backend/sql/supabase_auth_empresa_fix.sql

BEGIN;

-- 1) Vincular registros pendentes por e-mail (case-insensitive)
UPDATE public.usuarios u
SET auth_user_id = au.id
FROM auth.users au
WHERE u.auth_user_id IS NULL
  AND lower(trim(u.email)) = lower(trim(au.email));

COMMIT;

-- 2) Validação rápida
SELECT
  au.email AS auth_email,
  au.id AS auth_user_id,
  u.id AS usuario_id,
  u.auth_user_id AS usuario_auth_user_id,
  CASE
    WHEN u.auth_user_id = au.id THEN 'SINCRONIZADO'
    ELSE 'ERRO'
  END AS status
FROM auth.users au
JOIN public.usuarios u
  ON lower(trim(au.email)) = lower(trim(u.email))
LIMIT 20;

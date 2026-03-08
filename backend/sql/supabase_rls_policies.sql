-- Supabase RLS hardening for routes based on createCrudController.
-- Diagnóstico de causa raiz observado após migração PostgreSQL -> Supabase:
-- em ambientes migrados, a coluna public.usuarios.auth_user_id costuma ficar sem vínculo
-- para parte dos usuários, o que quebra o resolve de empresa por auth.uid().
-- Este script padroniza a função de resolução + policies por tabela.

BEGIN;

-- 1) Função única para resolver empresa do usuário autenticado
--    usando public.usuarios.auth_user_id (fonte de verdade no Supabase Auth).
CREATE OR REPLACE FUNCTION public.current_empresa_id()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.empresa
  FROM public.usuarios u
  WHERE u.auth_user_id = auth.uid()
    AND COALESCE(u.status, true) = true
    AND u.empresa IS NOT NULL
  ORDER BY u.id
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.current_empresa_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_empresa_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_empresa_id() TO service_role;

-- 1.1) Resolver id interno do usuário autenticado.
--      Necessário para policies por dono (notifications/support_requests).
CREATE OR REPLACE FUNCTION public.current_usuario_id()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id
  FROM public.usuarios u
  WHERE u.auth_user_id = auth.uid()
    AND COALESCE(u.status, true) = true
  ORDER BY u.id
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.current_usuario_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_usuario_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_usuario_id() TO service_role;

-- 2) Diagnóstico rápido de vínculo auth -> usuarios (pós-migração)
--    Se houver linhas com auth_user_id_null > 0, execute também backend/sql/supabase_auth_empresa_fix.sql
--    para preencher auth_user_id por e-mail e corrigir compatibilidade legado/novo.
DO $$
DECLARE
  auth_user_id_null bigint;
BEGIN
  SELECT COUNT(*) INTO auth_user_id_null
  FROM public.usuarios
  WHERE auth_user_id IS NULL;

  IF auth_user_id_null > 0 THEN
    RAISE NOTICE '[RLS] usuarios sem auth_user_id: % (execute supabase_auth_empresa_fix.sql antes de validar RLS).', auth_user_id_null;
  END IF;
END
$$;

-- 3) Mapeamento direto das tabelas usadas por createCrudController em backend/src/routes/
--    Multi-tenant (idempresa/empresa):
--      area_atuacao(idempresa), perfis(idempresa), situacao_processo(idempresa), situacao_proposta(idempresa),
--      etiquetas(idempresa), escritorios(empresa), tipo_processo(idempresa), tipo_evento(idempresa),
--      tipo_documento(idempresa), fornecedores(idempresa), fluxo_trabalho(idempresa), templates(idempresa),
--      tarefas(idempresa), agenda(idempresa), intimacoes(idempresa), usuarios(empresa), clientes(idempresa),
--      oportunidades(idempresa), processos(idempresa), oab_monitoradas(empresa_id)
--    Globais (sem idempresa/empresa no CRUD):
--      planos, categorias, situacao_cliente, tipo_envolvimento, notifications, support_requests, empresas

DO $$
DECLARE
  target_table text;
  tenant_column text;
  policy_prefix text;
BEGIN
  FOR target_table, tenant_column IN
    SELECT *
    FROM (
      VALUES
        ('area_atuacao', 'idempresa'),
        ('perfis', 'idempresa'),
        ('situacao_processo', 'idempresa'),
        ('situacao_proposta', 'idempresa'),
        ('etiquetas', 'idempresa'),
        ('escritorios', 'empresa'),
        ('tipo_processo', 'idempresa'),
        ('tipo_evento', 'idempresa'),
        ('tipo_documento', 'idempresa'),
        ('fornecedores', 'idempresa'),
        ('fluxo_trabalho', 'idempresa'),
        ('templates', 'idempresa'),
        ('tarefas', 'idempresa'),
        ('agenda', 'idempresa'),
        ('intimacoes', 'idempresa'),
        ('usuarios', 'empresa'),
        ('clientes', 'idempresa'),
        ('oportunidades', 'idempresa'),
        ('processos', 'idempresa'),
        ('oab_monitoradas', 'empresa_id')
    ) AS mapped_tables(target_table, tenant_column)
  LOOP
    -- Só aplica se tabela e coluna existirem no ambiente.
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.tables t
      WHERE t.table_schema = 'public'
        AND t.table_name = target_table
    ) THEN
      RAISE NOTICE '[RLS] Tabela % não encontrada, pulando.', target_table;
      CONTINUE;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name = target_table
        AND c.column_name = tenant_column
    ) THEN
      RAISE NOTICE '[RLS] Coluna %.% não encontrada, pulando.', target_table, tenant_column;
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', target_table);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', target_table);

    policy_prefix := format('rls_%s_empresa', target_table);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_prefix || '_select', target_table);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_prefix || '_insert', target_table);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_prefix || '_update', target_table);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_prefix || '_delete', target_table);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (%I = public.current_empresa_id())',
      policy_prefix || '_select',
      target_table,
      tenant_column
    );

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (%I = public.current_empresa_id())',
      policy_prefix || '_insert',
      target_table,
      tenant_column
    );

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (%I = public.current_empresa_id()) WITH CHECK (%I = public.current_empresa_id())',
      policy_prefix || '_update',
      target_table,
      tenant_column,
      tenant_column
    );

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (%I = public.current_empresa_id())',
      policy_prefix || '_delete',
      target_table,
      tenant_column
    );
  END LOOP;
END
$$;

-- 3.1) Garantia explícita para oab_monitoradas sob RLS estrito.
ALTER TABLE IF EXISTS public.oab_monitoradas ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.oab_monitoradas FORCE ROW LEVEL SECURITY;

-- 4) Policy dedicada para empresas (tabela top-level no CRUD).
--    Regra: usuário autenticado só enxerga sua própria empresa (id = current_empresa_id()).
ALTER TABLE IF EXISTS public.empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.empresas FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_empresas_select_own ON public.empresas;
DROP POLICY IF EXISTS rls_empresas_insert_service_role ON public.empresas;
DROP POLICY IF EXISTS rls_empresas_update_service_role ON public.empresas;
DROP POLICY IF EXISTS rls_empresas_delete_service_role ON public.empresas;

CREATE POLICY rls_empresas_select_own
ON public.empresas
FOR SELECT
TO authenticated
USING (id = public.current_empresa_id());

CREATE POLICY rls_empresas_insert_service_role
ON public.empresas
FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY rls_empresas_update_service_role
ON public.empresas
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY rls_empresas_delete_service_role
ON public.empresas
FOR DELETE
TO service_role
USING (true);

-- 5) Catálogos globais: leitura global para authenticated + escrita restrita ao service_role.
DO $$
DECLARE
  target_table text;
BEGIN
  FOREACH target_table IN ARRAY ARRAY[
    'planos',
    'categorias',
    'situacao_cliente',
    'tipo_envolvimento'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.tables t
      WHERE t.table_schema = 'public'
        AND t.table_name = target_table
    ) THEN
      RAISE NOTICE '[RLS] Tabela global % não encontrada, pulando.', target_table;
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', target_table);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', target_table);

    EXECUTE format('DROP POLICY IF EXISTS rls_%s_select_authenticated ON public.%I', target_table, target_table);
    EXECUTE format('DROP POLICY IF EXISTS rls_%s_insert_service_role ON public.%I', target_table, target_table);
    EXECUTE format('DROP POLICY IF EXISTS rls_%s_update_service_role ON public.%I', target_table, target_table);
    EXECUTE format('DROP POLICY IF EXISTS rls_%s_delete_service_role ON public.%I', target_table, target_table);

    EXECUTE format(
      'CREATE POLICY rls_%s_select_authenticated ON public.%I FOR SELECT TO authenticated USING (true)',
      target_table,
      target_table
    );

    EXECUTE format(
      'CREATE POLICY rls_%s_insert_service_role ON public.%I FOR INSERT TO service_role WITH CHECK (true)',
      target_table,
      target_table
    );

    EXECUTE format(
      'CREATE POLICY rls_%s_update_service_role ON public.%I FOR UPDATE TO service_role USING (true) WITH CHECK (true)',
      target_table,
      target_table
    );

    EXECUTE format(
      'CREATE POLICY rls_%s_delete_service_role ON public.%I FOR DELETE TO service_role USING (true)',
      target_table,
      target_table
    );
  END LOOP;
END
$$;

-- 5.1) notifications: usuário autenticado só pode ler/escrever suas próprias notificações.
ALTER TABLE IF EXISTS public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.notifications FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_notifications_select_authenticated ON public.notifications;
DROP POLICY IF EXISTS rls_notifications_insert_authenticated ON public.notifications;
DROP POLICY IF EXISTS rls_notifications_update_authenticated ON public.notifications;
DROP POLICY IF EXISTS rls_notifications_delete_authenticated ON public.notifications;
DROP POLICY IF EXISTS rls_notifications_insert_service_role ON public.notifications;
DROP POLICY IF EXISTS rls_notifications_update_service_role ON public.notifications;
DROP POLICY IF EXISTS rls_notifications_delete_service_role ON public.notifications;

CREATE POLICY rls_notifications_select_authenticated
ON public.notifications
FOR SELECT
TO authenticated
USING (user_id = auth.uid()::text);

CREATE POLICY rls_notifications_insert_authenticated
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY rls_notifications_update_authenticated
ON public.notifications
FOR UPDATE
TO authenticated
USING (user_id = auth.uid()::text)
WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY rls_notifications_delete_authenticated
ON public.notifications
FOR DELETE
TO authenticated
USING (user_id = auth.uid()::text);

CREATE POLICY rls_notifications_insert_service_role
ON public.notifications
FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY rls_notifications_update_service_role
ON public.notifications
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY rls_notifications_delete_service_role
ON public.notifications
FOR DELETE
TO service_role
USING (true);

-- 5.2) support_requests: usuário autenticado só pode acessar chamados em que é solicitante
--      ou agente responsável. service_role mantém escrita irrestrita para rotinas internas.
ALTER TABLE IF EXISTS public.support_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.support_requests FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS rls_support_requests_select_authenticated ON public.support_requests;
DROP POLICY IF EXISTS rls_support_requests_insert_authenticated ON public.support_requests;
DROP POLICY IF EXISTS rls_support_requests_update_authenticated ON public.support_requests;
DROP POLICY IF EXISTS rls_support_requests_delete_authenticated ON public.support_requests;
DROP POLICY IF EXISTS rls_support_requests_insert_service_role ON public.support_requests;
DROP POLICY IF EXISTS rls_support_requests_update_service_role ON public.support_requests;
DROP POLICY IF EXISTS rls_support_requests_delete_service_role ON public.support_requests;

CREATE POLICY rls_support_requests_select_authenticated
ON public.support_requests
FOR SELECT
TO authenticated
USING (
  requester_id = public.current_usuario_id()
  OR support_agent_id = public.current_usuario_id()
);

CREATE POLICY rls_support_requests_insert_authenticated
ON public.support_requests
FOR INSERT
TO authenticated
WITH CHECK (requester_id = public.current_usuario_id());

CREATE POLICY rls_support_requests_update_authenticated
ON public.support_requests
FOR UPDATE
TO authenticated
USING (
  requester_id = public.current_usuario_id()
  OR support_agent_id = public.current_usuario_id()
)
WITH CHECK (
  requester_id = public.current_usuario_id()
  OR support_agent_id = public.current_usuario_id()
);

CREATE POLICY rls_support_requests_delete_authenticated
ON public.support_requests
FOR DELETE
TO authenticated
USING (requester_id = public.current_usuario_id());

CREATE POLICY rls_support_requests_insert_service_role
ON public.support_requests
FOR INSERT
TO service_role
WITH CHECK (true);

CREATE POLICY rls_support_requests_update_service_role
ON public.support_requests
FOR UPDATE
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY rls_support_requests_delete_service_role
ON public.support_requests
FOR DELETE
TO service_role
USING (true);

COMMIT;

-- 6) Consulta de validação pós-execução
SELECT
  n.nspname AS schema,
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN (
    'area_atuacao', 'perfis', 'situacao_processo', 'situacao_proposta',
    'etiquetas', 'escritorios', 'tipo_processo', 'tipo_evento', 'tipo_documento',
    'fornecedores', 'fluxo_trabalho', 'templates', 'tarefas', 'agenda',
    'intimacoes', 'usuarios', 'clientes', 'oportunidades', 'processos',
    'oab_monitoradas',
    'planos', 'categorias', 'situacao_cliente', 'tipo_envolvimento',
    'notifications', 'support_requests', 'empresas'
  )
ORDER BY c.relname;

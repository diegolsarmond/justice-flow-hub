-- Remove artefato de migração (PostgreSQL -> Supabase):
-- a relação public.instance_id_type não é usada pela aplicação e pode ter sido
-- criada indevidamente durante export/import do catálogo.

DO $$
DECLARE
  dependency_count integer;
BEGIN
  SELECT COUNT(*)
    INTO dependency_count
  FROM pg_depend d
  JOIN pg_class c ON c.oid = d.refobjid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'instance_id_type'
    AND d.classid = 'pg_class'::regclass
    AND d.deptype = 'n';

  IF dependency_count > 0 THEN
    RAISE EXCEPTION
      'A tabela public.instance_id_type possui % dependências no catálogo; DROP abortado.',
      dependency_count;
  END IF;

  DROP TABLE IF EXISTS public.instance_id_type;
END $$;

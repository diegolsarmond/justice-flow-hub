# Changelog

## 2026-02-18

- Removido o artefato de migração `public.instance_id_type`, identificado após migração de PostgreSQL para Supabase.
- Adicionada migração defensiva que verifica dependências reais no catálogo (`pg_depend`, tipo `n`) antes de executar `DROP TABLE IF EXISTS public.instance_id_type`.

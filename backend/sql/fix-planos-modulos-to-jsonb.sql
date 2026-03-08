-- ============================================================================
-- MIGRAÇÃO: Converter planos.modulos de text[] para jsonb
-- 
-- Execute este SQL no Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- 
-- ANTES: coluna "modulos" é text[] → retorna '{"a","b","c"}' (string)
-- DEPOIS: coluna "modulos" é jsonb  → retorna ["a","b","c"] (JSON array)
-- ============================================================================

-- 1) Adicionar coluna temporária jsonb (idempotente)
ALTER TABLE public.planos ADD COLUMN IF NOT EXISTS modulos_jsonb jsonb;

-- 2) Copiar de text[] para jsonb via unnest + jsonb_agg
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'planos'
      AND column_name = 'modulos'
      AND udt_name = '_text'
  ) THEN
    EXECUTE $sql$
      UPDATE public.planos
      SET modulos_jsonb = COALESCE((
        SELECT jsonb_agg(elem)
        FROM unnest(modulos) AS elem
      ), '[]'::jsonb)
      WHERE modulos_jsonb IS NULL
    $sql$;
  END IF;
END
$$;

-- 3) Garantir [] para nulos
UPDATE public.planos
SET modulos_jsonb = '[]'::jsonb
WHERE modulos_jsonb IS NULL;

-- 4) Substituir coluna antiga pela nova apenas quando necessário
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'planos'
      AND column_name = 'modulos'
      AND udt_name = '_text'
  ) THEN
    ALTER TABLE public.planos DROP COLUMN modulos;
    ALTER TABLE public.planos RENAME COLUMN modulos_jsonb TO modulos;
  ELSIF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'planos'
      AND column_name = 'modulos'
      AND udt_name = 'jsonb'
  ) THEN
    ALTER TABLE public.planos DROP COLUMN IF EXISTS modulos_jsonb;
  ELSIF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'planos'
      AND column_name = 'modulos_jsonb'
      AND udt_name = 'jsonb'
  ) THEN
    ALTER TABLE public.planos RENAME COLUMN modulos_jsonb TO modulos;
  END IF;
END
$$;

-- 5) Default final em []::jsonb
ALTER TABLE public.planos
  ALTER COLUMN modulos SET DEFAULT '[]'::jsonb;

-- 6) Harden: garantir ausência de nulos após migração
UPDATE public.planos
SET modulos = '[]'::jsonb
WHERE modulos IS NULL;

-- Verificar resultado
SELECT id, nome, jsonb_typeof(modulos) AS tipo, jsonb_array_length(modulos) AS qtd_modulos
FROM public.planos
ORDER BY id;

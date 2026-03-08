
-- Create perfil for existing empresa_id=5 if not exists
INSERT INTO public.perfis (nome, ver_todas_conversas, idempresa)
SELECT 'Administrador', true, 5
WHERE NOT EXISTS (SELECT 1 FROM public.perfis WHERE idempresa = 5 AND nome = 'Administrador');

-- Link it to the current user profile
UPDATE public.profiles
SET perfil_id = (SELECT id FROM public.perfis WHERE idempresa = 5 AND nome = 'Administrador' LIMIT 1)
WHERE user_id = '0e91b264-5ae0-4df7-871b-9586dd2b484d' AND perfil_id IS NULL;

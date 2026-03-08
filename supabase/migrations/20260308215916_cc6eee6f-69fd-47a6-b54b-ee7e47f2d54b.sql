
-- Add empresa_id and perfil_id to profiles for user context
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS empresa_id integer REFERENCES public.empresas(id),
  ADD COLUMN IF NOT EXISTS perfil_id integer REFERENCES public.perfis(id),
  ADD COLUMN IF NOT EXISTS empresa_nome text,
  ADD COLUMN IF NOT EXISTS setor_id integer,
  ADD COLUMN IF NOT EXISTS setor_nome text;

-- Update handle_new_user to include metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, nome, email, telefone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.email,
    NEW.raw_user_meta_data->>'telefone'
  );
  RETURN NEW;
END;
$function$;

-- Create trigger if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END
$$;

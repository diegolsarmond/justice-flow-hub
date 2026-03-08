CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  new_empresa_id integer;
  empresa_name text;
  plan_id integer;
BEGIN
  empresa_name := COALESCE(NEW.raw_user_meta_data->>'empresa', '');
  
  BEGIN
    plan_id := (NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'planId', '')), ''))::integer;
  EXCEPTION WHEN OTHERS THEN
    plan_id := NULL;
  END;

  IF empresa_name <> '' THEN
    INSERT INTO public.empresas (nome_empresa, plano, subscription_status, trial_started_at, trial_ends_at)
    VALUES (empresa_name, plan_id, 'trialing', now(), now() + interval '14 days')
    RETURNING id INTO new_empresa_id;
  END IF;

  INSERT INTO public.profiles (user_id, nome, email, telefone, empresa_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'telefone', '')), ''),
    new_empresa_id
  );

  -- Grant admin role to the company creator
  IF new_empresa_id IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin');
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'handle_new_user error for user %: % (state: %)', NEW.id, SQLERRM, SQLSTATE;
  RAISE;
END;
$function$;
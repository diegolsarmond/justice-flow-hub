
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
  plan_id := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'planId', '')), '')::integer;

  -- Create empresa if name provided
  IF empresa_name <> '' THEN
    INSERT INTO public.empresas (nome_empresa, plano, subscription_status, trial_started_at, trial_ends_at)
    VALUES (
      empresa_name,
      plan_id,
      'trialing',
      now(),
      now() + interval '14 days'
    )
    RETURNING id INTO new_empresa_id;
  END IF;

  INSERT INTO public.profiles (user_id, nome, email, telefone, empresa_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.email,
    NEW.raw_user_meta_data->>'telefone',
    new_empresa_id
  );

  -- Set empresa responsavel to the new user's legacy id if empresa was created
  IF new_empresa_id IS NOT NULL THEN
    UPDATE public.empresas SET responsavel = (
      SELECT id FROM public.profiles WHERE user_id = NEW.id LIMIT 1
    )::integer WHERE id = new_empresa_id;
  END IF;

  RETURN NEW;
END;
$function$;

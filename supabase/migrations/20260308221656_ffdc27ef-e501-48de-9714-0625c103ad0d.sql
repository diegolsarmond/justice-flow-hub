-- Allow users to read their own profile (even without a role)
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Also allow users to read their empresa
CREATE POLICY "Users can view own empresa"
ON public.empresas
FOR SELECT
TO authenticated
USING (
  id IN (SELECT empresa_id FROM public.profiles WHERE user_id = auth.uid())
);
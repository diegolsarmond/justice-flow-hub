CREATE POLICY "Anyone can view active planos"
ON public.planos
FOR SELECT
TO anon, authenticated
USING (ativo = true);
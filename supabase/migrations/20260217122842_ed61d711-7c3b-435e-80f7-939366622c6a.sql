
-- Allow office members to insert and update api_tokens
CREATE POLICY "Members can insert tokens"
ON public.api_tokens
FOR INSERT
TO authenticated
WITH CHECK (is_office_member());

CREATE POLICY "Members can view tokens"
ON public.api_tokens
FOR SELECT
TO authenticated
USING (is_office_member());

CREATE POLICY "Members can update tokens"
ON public.api_tokens
FOR UPDATE
TO authenticated
USING (is_office_member());

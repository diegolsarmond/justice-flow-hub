
-- Enable RLS on new tables
ALTER TABLE public.planos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfil_modulos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;

-- RLS policies for all new tables
CREATE POLICY "Members can view planos" ON public.planos FOR SELECT TO authenticated USING (public.is_office_member());
CREATE POLICY "Admins can manage planos" ON public.planos FOR ALL TO authenticated USING (public.is_admin());

CREATE POLICY "Members can view empresas" ON public.empresas FOR SELECT TO authenticated USING (public.is_office_member());
CREATE POLICY "Admins can manage empresas" ON public.empresas FOR ALL TO authenticated USING (public.is_admin());

CREATE POLICY "Members can view perfis" ON public.perfis FOR SELECT TO authenticated USING (public.is_office_member());
CREATE POLICY "Admins can manage perfis" ON public.perfis FOR ALL TO authenticated USING (public.is_admin());

CREATE POLICY "Members can view usuarios" ON public.usuarios FOR SELECT TO authenticated USING (public.is_office_member());
CREATE POLICY "Admins can manage usuarios" ON public.usuarios FOR ALL TO authenticated USING (public.is_admin());

CREATE POLICY "Members can view perfil_modulos" ON public.perfil_modulos FOR SELECT TO authenticated USING (public.is_office_member());
CREATE POLICY "Admins can manage perfil_modulos" ON public.perfil_modulos FOR ALL TO authenticated USING (public.is_admin());

CREATE POLICY "Members can view clientes" ON public.clientes FOR SELECT TO authenticated USING (public.is_office_member());
CREATE POLICY "Members can insert clientes" ON public.clientes FOR INSERT TO authenticated WITH CHECK (public.is_office_member());
CREATE POLICY "Members can update clientes" ON public.clientes FOR UPDATE TO authenticated USING (public.is_office_member());
CREATE POLICY "Admins can delete clientes" ON public.clientes FOR DELETE TO authenticated USING (public.is_admin());

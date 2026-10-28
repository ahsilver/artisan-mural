CREATE TABLE public.design_listing (
  slug text PRIMARY KEY,
  hidden boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT ON public.design_listing TO anon, authenticated;
GRANT INSERT, UPDATE ON public.design_listing TO authenticated;
GRANT ALL ON public.design_listing TO service_role;
ALTER TABLE public.design_listing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads design listing" ON public.design_listing FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Studio adds design listing" ON public.design_listing FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Studio updates design listing" ON public.design_listing FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
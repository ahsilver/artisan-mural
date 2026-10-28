CREATE TABLE public.designer_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  designer_slug text NOT NULL,
  owner_id uuid,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  design_slugs text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.designer_collections TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.designer_collections TO authenticated;
GRANT ALL ON public.designer_collections TO service_role;
ALTER TABLE public.designer_collections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads collections" ON public.designer_collections FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Studio manages collections" ON public.designer_collections FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Designers manage own collections" ON public.designer_collections FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
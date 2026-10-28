CREATE TABLE public.design_overrides (
  slug text PRIMARY KEY,
  title text,
  description text,
  story text,
  price_per_sqft numeric CHECK (price_per_sqft IS NULL OR (price_per_sqft > 0 AND price_per_sqft < 1000)),
  image_path text,
  removed_photos text[] NOT NULL DEFAULT '{}',
  added_photos text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
GRANT SELECT ON public.design_overrides TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.design_overrides TO authenticated;
GRANT ALL ON public.design_overrides TO service_role;
ALTER TABLE public.design_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads design overrides" ON public.design_overrides FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Studio manages design overrides" ON public.design_overrides FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.designer_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  designer_slug text NOT NULL,
  user_id uuid NOT NULL,
  reviewer_name text NOT NULL CHECK (char_length(reviewer_name) BETWEEN 1 AND 80),
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body text NOT NULL DEFAULT '' CHECK (char_length(body) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (designer_slug, user_id)
);
GRANT SELECT ON public.designer_reviews TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.designer_reviews TO authenticated;
GRANT ALL ON public.designer_reviews TO service_role;
ALTER TABLE public.designer_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads reviews" ON public.designer_reviews FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Customers write own review" ON public.designer_reviews FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Customers edit own review" ON public.designer_reviews FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Customers or studio delete reviews" ON public.designer_reviews FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE INDEX designer_reviews_slug_idx ON public.designer_reviews (designer_slug);

CREATE POLICY "Studio uploads studio photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'studio-photos' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Studio deletes studio photos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'studio-photos' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Studio reads studio photos" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'studio-photos' AND public.has_role(auth.uid(), 'admin'));
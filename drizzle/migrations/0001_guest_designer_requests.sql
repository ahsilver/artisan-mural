CREATE TABLE public.guest_designer_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  designer_slug text NOT NULL CHECK (length(designer_slug) BETWEEN 1 AND 60),
  design_slug text NOT NULL CHECK (length(design_slug) BETWEEN 1 AND 60),
  customer_name text NOT NULL CHECK (length(customer_name) BETWEEN 1 AND 100),
  customer_email text NOT NULL CHECK (length(customer_email) BETWEEN 3 AND 255),
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 3000),
  selection jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.guest_designer_requests TO anon;
GRANT SELECT ON public.guest_designer_requests TO authenticated;
GRANT ALL ON public.guest_designer_requests TO service_role;
ALTER TABLE public.guest_designer_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Guests submit private designer requests" ON public.guest_designer_requests FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Assigned designer reads guest requests" ON public.guest_designer_requests FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.designer_accounts a WHERE a.slug = designer_slug AND a.user_id = auth.uid()));
CREATE INDEX guest_requests_designer_idx ON public.guest_designer_requests(designer_slug, created_at);
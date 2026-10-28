ALTER TABLE public.order_requests ADD COLUMN IF NOT EXISTS user_id uuid, ADD COLUMN IF NOT EXISTS cart_id uuid;
CREATE INDEX IF NOT EXISTS order_requests_user_idx ON public.order_requests(user_id);
CREATE POLICY "Customers read own orders" ON public.order_requests FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.custom_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  room text NOT NULL,
  wall_size text NOT NULL,
  budget text,
  brief text NOT NULL,
  material text NOT NULL,
  designer_slug text NOT NULL DEFAULT 'open',
  photo_paths text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.custom_requests TO authenticated;
GRANT ALL ON public.custom_requests TO service_role;
ALTER TABLE public.custom_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customers create own requests" ON public.custom_requests FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND status = 'new' AND cardinality(photo_paths) <= 6);
CREATE POLICY "Customers read own requests" ON public.custom_requests FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Customers upload own reference photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'custom-request-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Customers and studio read reference photos" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'custom-request-photos' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'admin')));
CREATE TABLE public.designer_profiles (
  user_id uuid PRIMARY KEY,
  full_name text NOT NULL,
  studio_name text,
  country text NOT NULL,
  bio text NOT NULL,
  styles text[] NOT NULL DEFAULT '{}',
  portfolio_links text[] NOT NULL DEFAULT '{}',
  payout_method text NOT NULL,
  payout_details text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);
GRANT SELECT, INSERT, UPDATE ON public.designer_profiles TO authenticated;
GRANT ALL ON public.designer_profiles TO service_role;
ALTER TABLE public.designer_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Designer reads own profile" ON public.designer_profiles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Studio reads designer profiles" ON public.designer_profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Designer applies" ON public.designer_profiles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND status = 'pending');

ALTER TABLE public.artwork_uploads ADD COLUMN review_status text NOT NULL DEFAULT 'pending';
ALTER TABLE public.artwork_uploads ADD COLUMN review_note text;
ALTER TABLE public.artwork_uploads ADD COLUMN story text;
CREATE POLICY "Studio reads all uploads" ON public.artwork_uploads FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Studio reads all colorways" ON public.artwork_colorways FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Studio reads all mockups" ON public.artwork_mockups FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.designer_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  designer_user_id uuid NOT NULL,
  amount numeric NOT NULL,
  note text,
  paid_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL
);
GRANT SELECT ON public.designer_payouts TO authenticated;
GRANT ALL ON public.designer_payouts TO service_role;
ALTER TABLE public.designer_payouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Designer reads own payouts" ON public.designer_payouts FOR SELECT TO authenticated USING (designer_user_id = auth.uid());
CREATE POLICY "Studio reads payouts" ON public.designer_payouts FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Studio reads order requests" ON public.order_requests FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
GRANT SELECT ON public.order_requests TO authenticated;
ALTER TABLE public.designer_profiles ALTER COLUMN payout_method DROP NOT NULL;
ALTER TABLE public.designer_profiles ALTER COLUMN payout_details DROP NOT NULL;
DROP POLICY IF EXISTS "Designers update own payout details" ON public.designer_profiles;
CREATE POLICY "Designers update own payout details" ON public.designer_profiles FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE TABLE public.print_originals (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL, colorway_id uuid REFERENCES public.artwork_colorways(id), storage_path text NOT NULL UNIQUE, filename text NOT NULL, mime_type text NOT NULL, byte_size bigint NOT NULL, pixel_width integer, pixel_height integer, validation_status text NOT NULL DEFAULT 'pending' CHECK (validation_status IN ('pending','verified','preflight')), effective_dpi numeric, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.print_originals TO authenticated;
GRANT ALL ON public.print_originals TO service_role;
ALTER TABLE public.print_originals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Original owners and studio read metadata" ON public.print_originals FOR SELECT TO authenticated USING (owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
ALTER TABLE public.artwork_colorways ADD COLUMN current_original_id uuid REFERENCES public.print_originals(id);
ALTER TABLE public.order_requests ADD COLUMN print_original_id uuid REFERENCES public.print_originals(id), ADD COLUMN print_design_snapshot jsonb, ADD COLUMN custom_offer_id uuid;
ALTER TABLE public.conversations ADD COLUMN custom_request_id uuid REFERENCES public.custom_requests(id);
CREATE UNIQUE INDEX conversations_request_designer_unique ON public.conversations(custom_request_id, designer_slug) WHERE custom_request_id IS NOT NULL;
ALTER TABLE public.design_offers ADD COLUMN delivery_days integer CHECK (delivery_days BETWEEN 1 AND 365), ADD COLUMN proof_status text NOT NULL DEFAULT 'awaiting' CHECK (proof_status IN ('awaiting','delivered','approved')), ADD COLUMN proof_path text, ADD COLUMN proof_note text, ADD COLUMN delivered_at timestamptz, ADD COLUMN proof_approved_at timestamptz;
CREATE POLICY "Approved designers read available request briefs" ON public.custom_requests FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.designer_profiles p WHERE p.user_id=auth.uid() AND p.status='approved') AND (designer_slug='open' OR EXISTS (SELECT 1 FROM public.designer_accounts a WHERE a.user_id=auth.uid() AND a.slug=designer_slug)));
CREATE OR REPLACE FUNCTION public.capture_order_print_original() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE u public.artwork_uploads; c public.artwork_colorways; pos integer;
BEGIN
 IF NEW.design_slug LIKE 'u-%' THEN
  SELECT * INTO u FROM public.artwork_uploads WHERE id::text=substring(NEW.design_slug from 3);
  IF FOUND THEN
   pos := CASE WHEN COALESCE(NEW.selection->>'color','c0') ~ '^c[0-9]+$' THEN substring(COALESCE(NEW.selection->>'color','c0') from 2)::integer ELSE 0 END;
   SELECT * INTO c FROM public.artwork_colorways WHERE upload_id=u.id ORDER BY position OFFSET pos LIMIT 1;
   NEW.print_original_id := c.current_original_id;
   NEW.print_design_snapshot := jsonb_build_object('kind',u.kind,'repeat',u.repeat_style,'repeatCm',u.width_cm,'printHeightCm',u.height_cm,'title',u.title);
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER save_order_print_source BEFORE INSERT ON public.order_requests FOR EACH ROW EXECUTE FUNCTION public.capture_order_print_original();
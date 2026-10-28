DROP POLICY "Approved designers read available request briefs" ON public.custom_requests;
CREATE OR REPLACE FUNCTION public.accept_project_quote(_offer uuid, _customer uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE o public.design_offers; c public.conversations;
BEGIN
 SELECT * INTO o FROM public.design_offers WHERE id=_offer AND conversation_kind='account' FOR UPDATE;
 IF NOT FOUND OR o.status<>'sent' THEN RETURN false; END IF;
 SELECT * INTO c FROM public.conversations WHERE id=o.conversation_id AND customer_id=_customer;
 IF NOT FOUND THEN RETURN false; END IF;
 IF c.custom_request_id IS NOT NULL THEN
  PERFORM 1 FROM public.custom_requests WHERE id=c.custom_request_id FOR UPDATE;
  IF EXISTS(SELECT 1 FROM public.design_offers f JOIN public.conversations v ON v.id=f.conversation_id WHERE v.custom_request_id=c.custom_request_id AND f.status IN ('accepted','paid')) THEN RETURN false; END IF;
  UPDATE public.custom_requests SET status='in_progress' WHERE id=c.custom_request_id;
  UPDATE public.design_offers SET status='cancelled' WHERE status='sent' AND id<>o.id AND conversation_id IN (SELECT id FROM public.conversations WHERE custom_request_id=c.custom_request_id);
 END IF;
 UPDATE public.design_offers SET status='accepted',accepted_at=now() WHERE id=o.id;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.accept_project_quote(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.accept_project_quote(uuid,uuid) TO service_role;
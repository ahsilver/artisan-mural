ALTER TABLE public.custom_requests ADD COLUMN design_slug text, ADD COLUMN selection jsonb;
CREATE OR REPLACE FUNCTION public.link_custom_project_order(_order uuid,_offer uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 UPDATE public.order_requests o SET custom_offer_id=f.id FROM public.design_offers f JOIN public.conversations c ON c.id=f.conversation_id WHERE o.id=_order AND f.id=_offer AND f.conversation_kind='account' AND f.status IN ('accepted','paid') AND f.proof_status='approved' AND o.user_id=c.customer_id;
 RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.link_custom_project_order(uuid,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.link_custom_project_order(uuid,uuid) TO service_role;
DROP POLICY IF EXISTS "Assigned designer reads guest requests" ON public.guest_designer_requests;
REVOKE SELECT ON public.guest_designer_requests FROM authenticated;
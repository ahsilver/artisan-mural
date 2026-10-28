ALTER TABLE public.order_requests DROP CONSTRAINT order_requests_status_check;
ALTER TABLE public.order_requests ADD CONSTRAINT order_requests_status_check CHECK (status = ANY (ARRAY['awaiting_payment','paid','processing','printing','shipped','delivered','cancelled']));
ALTER TABLE public.order_requests ADD COLUMN payment_method text;
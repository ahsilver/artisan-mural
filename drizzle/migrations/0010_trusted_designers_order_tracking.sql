ALTER TABLE public.designer_profiles ADD COLUMN IF NOT EXISTS trusted boolean NOT NULL DEFAULT false;
ALTER TABLE public.order_requests ADD COLUMN IF NOT EXISTS carrier text;
ALTER TABLE public.order_requests ADD COLUMN IF NOT EXISTS tracking_number text;
ALTER TABLE public.order_requests ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'website';
ALTER TABLE public.order_requests ADD COLUMN IF NOT EXISTS delivery_date date;
ALTER TABLE public.order_requests ADD COLUMN IF NOT EXISTS status_updated_at timestamptz NOT NULL DEFAULT now();
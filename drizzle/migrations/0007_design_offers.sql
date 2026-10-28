CREATE TABLE public.design_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_kind text NOT NULL CHECK (conversation_kind IN ('account','guest')),
  conversation_id uuid NOT NULL,
  designer_slug text NOT NULL,
  created_by uuid NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0 AND amount <= 100000),
  description text NOT NULL,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','accepted','paid','cancelled')),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.design_offers TO service_role;
ALTER TABLE public.design_offers ENABLE ROW LEVEL SECURITY;
CREATE INDEX design_offers_conversation_idx ON public.design_offers(conversation_id);
COMMENT ON TABLE public.design_offers IS 'Price offers in chats; read and written only through verified server functions.';
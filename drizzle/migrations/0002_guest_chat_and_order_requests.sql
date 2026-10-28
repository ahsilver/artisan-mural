CREATE TABLE public.guest_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL CHECK (length(token_hash) = 64),
  designer_slug text NOT NULL CHECK (length(designer_slug) BETWEEN 1 AND 60),
  design_slug text CHECK (design_slug IS NULL OR length(design_slug) BETWEEN 1 AND 60),
  customer_name text NOT NULL CHECK (length(customer_name) BETWEEN 1 AND 100),
  title text NOT NULL CHECK (length(title) BETWEEN 1 AND 200),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.guest_conversations TO authenticated;
GRANT ALL ON public.guest_conversations TO service_role;
ALTER TABLE public.guest_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Assigned designer reads guest conversations" ON public.guest_conversations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.designer_accounts a WHERE a.slug = designer_slug AND a.user_id = auth.uid()));

CREATE TABLE public.guest_conversation_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.guest_conversations(id) ON DELETE CASCADE,
  sender text NOT NULL CHECK (sender IN ('customer', 'designer')),
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 3000),
  selection jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.guest_conversation_messages TO authenticated;
GRANT ALL ON public.guest_conversation_messages TO service_role;
ALTER TABLE public.guest_conversation_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Assigned designer reads guest conversation messages" ON public.guest_conversation_messages FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.guest_conversations c JOIN public.designer_accounts a ON a.slug = c.designer_slug WHERE c.id = conversation_id AND a.user_id = auth.uid()));
CREATE INDEX guest_conversation_messages_idx ON public.guest_conversation_messages(conversation_id, created_at);

CREATE OR REPLACE FUNCTION public.start_guest_conversation(_token_hash text, _designer text, _design text, _name text, _title text, _body text, _selection jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_id uuid;
BEGIN
  INSERT INTO public.guest_conversations(token_hash, designer_slug, design_slug, customer_name, title)
  VALUES (_token_hash, _designer, _design, _name, _title) RETURNING id INTO new_id;
  INSERT INTO public.guest_conversation_messages(conversation_id, sender, body, selection) VALUES (new_id, 'customer', _body, _selection);
  RETURN new_id;
END $$;

CREATE OR REPLACE FUNCTION public.send_guest_conversation_message(_id uuid, _token_hash text, _body text, _selection jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.guest_conversations WHERE id = _id AND token_hash = _token_hash) THEN RETURN false; END IF;
  INSERT INTO public.guest_conversation_messages(conversation_id, sender, body, selection) VALUES (_id, 'customer', _body, _selection);
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.read_guest_conversation(_id uuid, _token_hash text)
RETURNS TABLE(id uuid, sender text, body text, selection jsonb, created_at timestamptz, designer_slug text, design_slug text, title text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.id, m.sender, m.body, m.selection, m.created_at, c.designer_slug, c.design_slug, c.title
  FROM public.guest_conversations c JOIN public.guest_conversation_messages m ON m.conversation_id = c.id
  WHERE c.id = _id AND c.token_hash = _token_hash ORDER BY m.created_at;
$$;

REVOKE ALL ON FUNCTION public.start_guest_conversation(text, text, text, text, text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.send_guest_conversation_message(uuid, text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.read_guest_conversation(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_guest_conversation(text, text, text, text, text, text, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.send_guest_conversation_message(uuid, text, text, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.read_guest_conversation(uuid, text) TO anon, authenticated;

CREATE TABLE public.order_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  design_slug text NOT NULL CHECK (length(design_slug) BETWEEN 1 AND 60),
  finish text NOT NULL CHECK (length(finish) BETWEEN 1 AND 60),
  selection jsonb NOT NULL,
  square_feet numeric NOT NULL CHECK (square_feet > 0),
  estimated_total numeric NOT NULL CHECK (estimated_total >= 0),
  customer_name text NOT NULL CHECK (length(customer_name) BETWEEN 1 AND 100),
  customer_email text NOT NULL CHECK (length(customer_email) BETWEEN 3 AND 255),
  phone text CHECK (phone IS NULL OR length(phone) <= 40),
  shipping_address text NOT NULL CHECK (length(shipping_address) BETWEEN 5 AND 600),
  notes text CHECK (notes IS NULL OR length(notes) <= 1000),
  status text NOT NULL DEFAULT 'awaiting_payment' CHECK (status IN ('awaiting_payment', 'paid', 'printing', 'shipped', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.order_requests TO anon, authenticated;
GRANT ALL ON public.order_requests TO service_role;
ALTER TABLE public.order_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Customers submit order requests" ON public.order_requests FOR INSERT TO anon, authenticated WITH CHECK (status = 'awaiting_payment');
DO $$ BEGIN CREATE TYPE public.app_role AS ENUM ('admin'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

ALTER TABLE public.designer_messages ADD COLUMN IF NOT EXISTS attachment_path text;
ALTER TABLE public.designer_messages ADD COLUMN IF NOT EXISTS sender_role text NOT NULL DEFAULT 'customer';
ALTER TABLE public.guest_conversation_messages ADD COLUMN IF NOT EXISTS attachment_path text;
ALTER TABLE public.artwork_uploads ADD COLUMN IF NOT EXISTS made_for text[] NOT NULL DEFAULT '{}';

CREATE POLICY "Studio reads all conversations" ON public.conversations FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Studio reads guest conversations" ON public.guest_conversations FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Studio reads guest conversation messages" ON public.guest_conversation_messages FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.read_guest_conversation_v2(_id uuid, _token_hash text)
 RETURNS TABLE(id uuid, sender text, body text, selection jsonb, attachment_path text, created_at timestamptz, designer_slug text, design_slug text, title text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT m.id, m.sender, m.body, m.selection, m.attachment_path, m.created_at, c.designer_slug, c.design_slug, c.title
  FROM public.guest_conversations c JOIN public.guest_conversation_messages m ON m.conversation_id = c.id
  WHERE c.id = _id AND c.token_hash = _token_hash ORDER BY m.created_at;
$$;

CREATE OR REPLACE FUNCTION public.send_guest_conversation_message_v2(_id uuid, _token_hash text, _body text, _selection jsonb, _attachment text)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.guest_conversations WHERE id = _id AND token_hash = _token_hash) THEN RETURN false; END IF;
  IF _attachment IS NOT NULL AND _attachment NOT LIKE ('guest/' || _id::text || '/%') THEN RETURN false; END IF;
  INSERT INTO public.guest_conversation_messages(conversation_id, sender, body, selection, attachment_path) VALUES (_id, 'customer', _body, _selection, _attachment);
  RETURN true;
END $$;
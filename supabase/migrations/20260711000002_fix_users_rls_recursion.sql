-- Fix infinite recursion in users RLS (admin check queried users inside users policy).
-- Also harden reride_is_admin + support chat admin checks. Idempotent.

CREATE OR REPLACE FUNCTION public.reride_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = (SELECT auth.uid())::text
      AND u.role = 'admin'
  );
$$;

DROP POLICY IF EXISTS "Users read access" ON users;
DROP POLICY IF EXISTS "Users update access" ON users;

CREATE POLICY "Users read access"
ON users FOR SELECT
USING (
  public.is_admin()
  OR (SELECT auth.uid())::text = id
  OR (status = 'active' AND role IN ('seller', 'service_provider'))
);

CREATE POLICY "Users update access"
ON users FOR UPDATE
USING (
  public.is_admin()
  OR (SELECT auth.uid())::text = id
)
WITH CHECK (
  public.is_admin()
  OR (
    (SELECT auth.uid())::text = id
    AND role <> 'admin'
  )
);

DROP POLICY IF EXISTS "Support chat session owner" ON support_chat_sessions;
DROP POLICY IF EXISTS "Support chat messages owner" ON support_chat_messages;

CREATE POLICY "Support chat session owner"
ON support_chat_sessions FOR ALL
USING (
  user_id IS NULL
  OR user_id = (SELECT auth.uid())::text
  OR public.reride_is_admin()
)
WITH CHECK (
  user_id IS NULL
  OR user_id = (SELECT auth.uid())::text
  OR public.reride_is_admin()
);

CREATE POLICY "Support chat messages owner"
ON support_chat_messages FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM support_chat_sessions s
    WHERE s.session_id = support_chat_messages.session_id
      AND (
        s.user_id IS NULL
        OR s.user_id = (SELECT auth.uid())::text
        OR public.reride_is_admin()
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM support_chat_sessions s
    WHERE s.session_id = support_chat_messages.session_id
      AND (
        s.user_id IS NULL
        OR s.user_id = (SELECT auth.uid())::text
        OR public.reride_is_admin()
      )
  )
);

REVOKE SELECT (password) ON public.users FROM anon, authenticated;

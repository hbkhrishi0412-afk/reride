-- Fix infinite recursion in users RLS (admin check queried users inside users policy).
-- Split policies by role so anon is not required to EXECUTE is_admin() (revoked in deal migration).

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
DROP POLICY IF EXISTS "Users public directory read" ON users;
DROP POLICY IF EXISTS "Users owner read" ON users;
DROP POLICY IF EXISTS "Users admin read" ON users;
DROP POLICY IF EXISTS "Users owner update" ON users;
DROP POLICY IF EXISTS "Users admin update" ON users;

CREATE POLICY "Users public directory read"
ON users FOR SELECT
TO anon, authenticated
USING (status = 'active' AND role IN ('seller', 'service_provider'));

CREATE POLICY "Users owner read"
ON users FOR SELECT
TO authenticated
USING ((SELECT auth.uid())::text = id);

CREATE POLICY "Users admin read"
ON users FOR SELECT
TO authenticated
USING (public.reride_is_admin());

CREATE POLICY "Users owner update"
ON users FOR UPDATE
TO authenticated
USING ((SELECT auth.uid())::text = id)
WITH CHECK (
  (SELECT auth.uid())::text = id
  AND role <> 'admin'
);

CREATE POLICY "Users admin update"
ON users FOR UPDATE
TO authenticated
USING (public.reride_is_admin())
WITH CHECK (public.reride_is_admin());

REVOKE EXECUTE ON FUNCTION public.reride_is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reride_is_admin() TO authenticated;

DROP POLICY IF EXISTS "Support chat session owner" ON support_chat_sessions;
DROP POLICY IF EXISTS "Support chat messages owner" ON support_chat_messages;
DROP POLICY IF EXISTS "Support chat session guest" ON support_chat_sessions;
DROP POLICY IF EXISTS "Support chat session auth owner" ON support_chat_sessions;
DROP POLICY IF EXISTS "Support chat session admin" ON support_chat_sessions;
DROP POLICY IF EXISTS "Support chat messages guest" ON support_chat_messages;
DROP POLICY IF EXISTS "Support chat messages auth owner" ON support_chat_messages;
DROP POLICY IF EXISTS "Support chat messages admin" ON support_chat_messages;

CREATE POLICY "Support chat session guest"
ON support_chat_sessions FOR ALL
USING (user_id IS NULL)
WITH CHECK (user_id IS NULL);

CREATE POLICY "Support chat session auth owner"
ON support_chat_sessions FOR ALL
TO authenticated
USING (user_id = (SELECT auth.uid())::text)
WITH CHECK (user_id = (SELECT auth.uid())::text);

CREATE POLICY "Support chat session admin"
ON support_chat_sessions FOR ALL
TO authenticated
USING (public.reride_is_admin())
WITH CHECK (public.reride_is_admin());

CREATE POLICY "Support chat messages guest"
ON support_chat_messages FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM support_chat_sessions s
    WHERE s.session_id = support_chat_messages.session_id
      AND s.user_id IS NULL
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM support_chat_sessions s
    WHERE s.session_id = support_chat_messages.session_id
      AND s.user_id IS NULL
  )
);

CREATE POLICY "Support chat messages auth owner"
ON support_chat_messages FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM support_chat_sessions s
    WHERE s.session_id = support_chat_messages.session_id
      AND s.user_id = (SELECT auth.uid())::text
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM support_chat_sessions s
    WHERE s.session_id = support_chat_messages.session_id
      AND s.user_id = (SELECT auth.uid())::text
  )
);

CREATE POLICY "Support chat messages admin"
ON support_chat_messages FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM support_chat_sessions s
    WHERE s.session_id = support_chat_messages.session_id
  )
  AND public.reride_is_admin()
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM support_chat_sessions s
    WHERE s.session_id = support_chat_messages.session_id
  )
  AND public.reride_is_admin()
);

REVOKE SELECT (password) ON public.users FROM anon, authenticated;

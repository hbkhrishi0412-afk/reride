-- Support chat tables (without PostGIS — apply add-support-chat-and-postgis.sql separately for geo)
CREATE TABLE IF NOT EXISTS support_chat_sessions (
  session_id TEXT PRIMARY KEY,
  user_id TEXT,
  user_name TEXT NOT NULL DEFAULT 'Guest',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'archived')),
  message_count INTEGER NOT NULL DEFAULT 0,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS support_chat_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES support_chat_sessions(session_id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_chat_messages_session ON support_chat_messages(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_support_chat_sessions_user ON support_chat_sessions(user_id);

ALTER TABLE support_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Support chat session owner" ON support_chat_sessions;
DROP POLICY IF EXISTS "Support chat messages owner" ON support_chat_messages;

CREATE POLICY "Support chat session owner"
ON support_chat_sessions FOR ALL
USING (
  user_id IS NULL
  OR user_id = (SELECT auth.uid())::text
  OR EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = (SELECT auth.uid())::text AND u.role = 'admin'
  )
)
WITH CHECK (
  user_id IS NULL
  OR user_id = (SELECT auth.uid())::text
  OR EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = (SELECT auth.uid())::text AND u.role = 'admin'
  )
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
        OR EXISTS (
          SELECT 1 FROM users u
          WHERE u.id = (SELECT auth.uid())::text AND u.role = 'admin'
        )
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
        OR EXISTS (
          SELECT 1 FROM users u
          WHERE u.id = (SELECT auth.uid())::text AND u.role = 'admin'
        )
      )
  )
);

-- ReRide: marketplace performance indexes + messages backfill.
-- Matches live schema: messages.id bigint, messages.conversation_id uuid.

-- ============================================================================
-- 1) Listing / inbox indexes
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_vehicles_status_city_created_at
  ON vehicles (status, city, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_vehicles_status_price
  ON vehicles (status, price);

CREATE INDEX IF NOT EXISTS idx_vehicles_status_state_created_at
  ON vehicles (status, state, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_vehicles_seller_email_status_created_at
  ON vehicles (seller_email, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_vehicles_status_category_created_at
  ON vehicles (status, category, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_vehicles_status_make_model
  ON vehicles (status, make, model);

CREATE INDEX IF NOT EXISTS idx_vehicles_published_featured_created
  ON vehicles (created_at DESC)
  WHERE status = 'published' AND is_featured = true;

CREATE INDEX IF NOT EXISTS idx_conversations_customer_updated
  ON conversations (customer_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversations_seller_updated
  ON conversations (seller_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
  ON messages (conversation_id, created_at ASC);

-- ============================================================================
-- 2) Backfill metadata.messages → messages (id = client numeric id when present)
-- ============================================================================
INSERT INTO messages (id, conversation_id, sender, text, message_type, payload, is_read, created_at)
SELECT
  CASE
    WHEN (m.elem->>'id') ~ '^[0-9]+$' THEN (m.elem->>'id')::bigint
    ELSE (('x' || substr(md5(c.id::text || ':' || m.ordinal::text), 1, 16))::bit(64)::bigint)
  END AS id,
  c.id::uuid AS conversation_id,
  COALESCE(m.elem->>'sender', 'user') AS sender,
  COALESCE(m.elem->>'text', '') AS text,
  COALESCE(m.elem->>'type', 'text') AS message_type,
  CASE WHEN m.elem ? 'payload' THEN m.elem->'payload' ELSE NULL END AS payload,
  COALESCE((m.elem->>'isRead')::boolean, false) AS is_read,
  COALESCE((m.elem->>'timestamp')::timestamptz, c.created_at, NOW()) AS created_at
FROM conversations c
CROSS JOIN LATERAL jsonb_array_elements(
  CASE
    WHEN jsonb_typeof(COALESCE(c.metadata, '{}'::jsonb)->'messages') = 'array'
      THEN c.metadata->'messages'
    ELSE '[]'::jsonb
  END
) WITH ORDINALITY AS m(elem, ordinal)
WHERE c.id::text ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
ON CONFLICT (id) DO NOTHING;

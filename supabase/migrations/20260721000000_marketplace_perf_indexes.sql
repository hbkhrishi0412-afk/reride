-- Performance indexes for marketplace listing filters (status + geo + price + seller).
-- Safe to re-run: all statements use IF NOT EXISTS.

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

CREATE INDEX IF NOT EXISTS idx_vehicles_published_featured_created
  ON vehicles (created_at DESC)
  WHERE status = 'published' AND is_featured = true;

CREATE INDEX IF NOT EXISTS idx_conversations_customer_updated
  ON conversations (customer_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversations_seller_updated
  ON conversations (seller_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON notifications (user_id, created_at DESC);

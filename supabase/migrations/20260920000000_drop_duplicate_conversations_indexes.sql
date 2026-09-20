-- Remove duplicate indexes on public.conversations.
-- idx_conversations_customer_id_updated_at / idx_conversations_seller_id_updated_at
-- are byte-for-byte identical to idx_conversations_customer_updated /
-- idx_conversations_seller_updated (same columns, same order), which are the
-- versions created by 20260721000000_marketplace_perf_indexes.sql and
-- 20260722000000_messages_normalize_and_perf_indexes.sql. Confirmed via
-- Supabase performance advisor (duplicate_index lint) and pg_indexes.
-- Safe: dropping an index never removes data and never changes query results,
-- only removes redundant write/storage overhead.

DROP INDEX IF EXISTS public.idx_conversations_customer_id_updated_at;
DROP INDEX IF EXISTS public.idx_conversations_seller_id_updated_at;

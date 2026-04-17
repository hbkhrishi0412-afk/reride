-- Service request observability: audit log table + performance indexes.
-- Run in Supabase SQL editor.

create table if not exists public.service_request_audit_logs (
  id bigserial primary key,
  request_id text not null,
  actor_id text not null,
  actor_role text not null default 'unknown',
  action text not null,
  previous_status text null,
  next_status text null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_service_request_audit_logs_request_id
  on public.service_request_audit_logs (request_id);

create index if not exists idx_service_request_audit_logs_created_at
  on public.service_request_audit_logs (created_at desc);

create index if not exists idx_service_requests_status_created_at
  on public.service_requests (status, created_at desc);

create index if not exists idx_service_requests_provider_status
  on public.service_requests (provider_id, status);

alter table public.service_request_audit_logs enable row level security;

-- RLS policies for this table are now managed centrally in
-- scripts/enable-rls-production.sql (section "10i. SERVICE_REQUEST_AUDIT_LOGS").
-- That script wraps auth.jwt() in (SELECT ...) to avoid the "Auth RLS
-- Initialization Plan" performance warning, and drops the legacy policy
-- (service_request_audit_logs_admin_read) before recreating it. After creating
-- the table, run scripts/enable-rls-production.sql once to apply the policies.

-- No INSERT policy is needed for service role writes done from server-side admin key.

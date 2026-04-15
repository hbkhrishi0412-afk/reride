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

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'service_request_audit_logs'
      and policyname = 'service_request_audit_logs_admin_read'
  ) then
    create policy service_request_audit_logs_admin_read
      on public.service_request_audit_logs
      for select
      to authenticated
      using (
        exists (
          select 1
          from public.users u
          where lower(trim(u.email)) = lower(trim(auth.jwt() ->> 'email'))
            and u.role = 'admin'
        )
      );
  end if;
end $$;

-- No INSERT policy is needed for service role writes done from server-side admin key.

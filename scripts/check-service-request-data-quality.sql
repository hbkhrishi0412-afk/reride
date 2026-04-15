-- Service request data quality checks
-- Run manually or schedule with pg_cron.

-- 1) Open requests that are incorrectly assigned to a provider.
select
  id,
  status,
  provider_id,
  created_at
from public.service_requests
where status = 'open'
  and provider_id is not null
order by created_at desc;

-- 2) Assigned requests missing expected status.
select
  id,
  status,
  provider_id,
  created_at
from public.service_requests
where provider_id is not null
  and status = 'open'
order by created_at desc;

-- 3) Missing required metadata fields for routing.
select
  id,
  status,
  metadata ->> 'city' as city,
  metadata ->> 'serviceType' as service_type,
  created_at
from public.service_requests
where coalesce(metadata ->> 'city', '') = ''
   or coalesce(metadata ->> 'serviceType', '') = ''
order by created_at desc;

-- 4) Old open requests that may need re-notification / escalation.
select
  id,
  status,
  provider_id,
  created_at,
  now() - created_at as age
from public.service_requests
where status = 'open'
  and created_at < now() - interval '2 hours'
order by created_at asc;

-- 5) Requests with malformed candidateProviderIds metadata.
select
  id,
  status,
  metadata -> 'candidateProviderIds' as candidate_provider_ids,
  created_at
from public.service_requests
where metadata ? 'candidateProviderIds'
  and jsonb_typeof(metadata -> 'candidateProviderIds') <> 'array'
order by created_at desc;

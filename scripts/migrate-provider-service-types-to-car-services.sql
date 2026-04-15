-- Migration: normalize provider service types to Car Services catalog names
-- Uses public.service_providers.services (text[]) and is safe to run multiple times.

begin;

-- 1) Preview current provider service distribution before migration.
-- select lower(trim(s.service)) as service_type, count(*) as cnt
-- from public.service_providers sp
-- cross join lateral unnest(coalesce(sp.services, '{}'::text[])) as s(service)
-- group by lower(trim(s.service))
-- order by cnt desc, service_type;

-- 2) Map legacy service names to Car Services canonical names inside services[].
-- Also removes duplicates created by normalization while preserving first-seen order.
with expanded as (
  select
    sp.id as provider_id,
    u.ordinality as ord,
    case lower(trim(u.service))
      when 'general' then 'Car Diagnostics'
      when 'periodic service' then 'Periodic Services'
      when 'engine & transmission' then 'Engine Maintenance & Repairs'
      when 'ac & cooling' then 'Car AC Servicing'
      when 'electrical & battery' then 'Car AC Servicing'
      when 'brakes & suspension' then 'Clutch & Suspension'
      when 'body work & paint' then 'Denting & Painting'
      when 'tyres & alignment' then 'Wheel Alignment & Balancing'
      when 'detailing & cleaning' then 'Interior Deep Cleaning'
      else nullif(trim(u.service), '')
    end as mapped_service
  from public.service_providers sp
  cross join lateral unnest(coalesce(sp.services, '{}'::text[])) with ordinality as u(service, ordinality)
),
deduped as (
  select
    provider_id,
    mapped_service,
    min(ord) as first_ord
  from expanded
  where mapped_service is not null
  group by provider_id, mapped_service
),
rebuilt as (
  select
    provider_id,
    array_agg(mapped_service order by first_ord) as mapped_services
  from deduped
  group by provider_id
)
update public.service_providers sp
set services = rebuilt.mapped_services
from rebuilt
where sp.id = rebuilt.provider_id;

commit;

-- 3) Verify after migration.
-- select lower(trim(s.service)) as service_type, count(*) as cnt
-- from public.service_providers sp
-- cross join lateral unnest(coalesce(sp.services, '{}'::text[])) as s(service)
-- group by lower(trim(s.service))
-- order by cnt desc, service_type;

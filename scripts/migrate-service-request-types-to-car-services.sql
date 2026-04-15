-- Migration: normalize service request types to Car Services catalog names
-- Safe to run multiple times (idempotent mapping).

begin;

-- 1) Preview current request service type distribution before migration.
-- select service_type, count(*) as cnt
-- from service_requests
-- group by service_type
-- order by cnt desc, service_type;

-- 2) Map legacy service names to Car Services canonical names.
update service_requests
set
  service_type = case lower(trim(service_type))
    when 'general' then 'Car Diagnostics'
    when 'periodic service' then 'Periodic Services'
    when 'engine & transmission' then 'Engine Maintenance & Repairs'
    when 'ac & cooling' then 'Car AC Servicing'
    when 'electrical & battery' then 'Car AC Servicing'
    when 'brakes & suspension' then 'Clutch & Suspension'
    when 'body work & paint' then 'Denting & Painting'
    when 'tyres & alignment' then 'Wheel Alignment & Balancing'
    when 'detailing & cleaning' then 'Interior Deep Cleaning'
    else service_type
  end
where service_type is not null
  and trim(service_type) <> '';

commit;

-- 3) Verify after migration.
-- select service_type, count(*) as cnt
-- from service_requests
-- group by service_type
-- order by cnt desc, service_type;

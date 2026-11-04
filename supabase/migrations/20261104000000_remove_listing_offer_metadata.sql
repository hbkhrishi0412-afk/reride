-- Strip per-listing promotional offer keys from vehicles.metadata.
-- These were never real columns; they lived only in JSONB metadata.
UPDATE public.vehicles
SET metadata = metadata
  - 'offerEnabled'
  - 'offerTitle'
  - 'offerStartDate'
  - 'offerEndDate'
  - 'offerDateLabel'
  - 'offerDescription'
  - 'offerHighlight'
  - 'offerDisclaimer'
  - 'offerDetails'
WHERE metadata ?| ARRAY[
  'offerEnabled',
  'offerTitle',
  'offerStartDate',
  'offerEndDate',
  'offerDateLabel',
  'offerDescription',
  'offerHighlight',
  'offerDisclaimer',
  'offerDetails'
];

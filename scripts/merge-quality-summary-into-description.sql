-- =============================================================================
-- Merge legacy qualityReport.summary into the top-level description column
-- =============================================================================
-- Context:
--   The seller form previously had two free-text descriptions:
--     1. metadata->'qualityReport'->>'summary'  (Quality Report > Summary)
--     2. description                            (Vehicle Description)
--   They were redundant. The app now uses ONLY the top-level `description`
--   column. `qualityReport.fixesDone` (chip list) is preserved.
--
-- This migration:
--   1. Backfills `description` from the legacy summary when description is
--      empty so no seller copy is lost.
--   2. Removes `summary` from metadata->'qualityReport' so the JSONB shape
--      stays clean.
--
-- Safe to run multiple times (idempotent).
-- =============================================================================

BEGIN;

-- 1. Backfill: copy legacy summary into description where description is missing/empty
UPDATE vehicles
SET
    description = NULLIF(TRIM(metadata->'qualityReport'->>'summary'), ''),
    updated_at  = NOW()
WHERE
    metadata ? 'qualityReport'
    AND metadata->'qualityReport' ? 'summary'
    AND NULLIF(TRIM(metadata->'qualityReport'->>'summary'), '') IS NOT NULL
    AND (description IS NULL OR TRIM(description) = '');

-- 2. (Optional, recommended) If both existed and they differ, append the legacy
--    summary to the description so nothing is lost. Comment this block out if
--    you'd rather keep description untouched when it already has content.
UPDATE vehicles
SET
    description = description || E'\n\n' || TRIM(metadata->'qualityReport'->>'summary'),
    updated_at  = NOW()
WHERE
    metadata ? 'qualityReport'
    AND metadata->'qualityReport' ? 'summary'
    AND NULLIF(TRIM(metadata->'qualityReport'->>'summary'), '') IS NOT NULL
    AND description IS NOT NULL
    AND TRIM(description) <> ''
    AND POSITION(TRIM(metadata->'qualityReport'->>'summary') IN description) = 0;

-- 3. Strip the deprecated `summary` key from metadata->'qualityReport'
UPDATE vehicles
SET
    metadata   = jsonb_set(
                    metadata,
                    '{qualityReport}',
                    (metadata->'qualityReport') - 'summary',
                    false
                 ),
    updated_at = NOW()
WHERE
    metadata ? 'qualityReport'
    AND metadata->'qualityReport' ? 'summary';

-- 4. Verification (read-only) — uncomment to inspect after running
-- SELECT id, description, metadata->'qualityReport' AS quality_report
-- FROM vehicles
-- WHERE metadata ? 'qualityReport'
-- LIMIT 50;

COMMIT;

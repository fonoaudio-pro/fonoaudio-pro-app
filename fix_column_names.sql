-- =============================================================================
-- FIX: Rename incorrectly named columns in appointments table
-- The previous fix_schema_and_rls.sql created columns with camelCase names
-- which PostgreSQL folded to lowercase. cleanPayload() converts camelCase
-- to snake_case, so we need DB columns to match.
-- =============================================================================

-- 1. Rename columns that exist with wrong names
DO $$
BEGIN
  -- cancellationreason → cancellation_reason
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='appointments' AND column_name='cancellationreason') THEN
    ALTER TABLE appointments RENAME COLUMN cancellationreason TO cancellation_reason;
  END IF;

  -- reschedulereason → reschedule_reason
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='appointments' AND column_name='reschedulereason') THEN
    ALTER TABLE appointments RENAME COLUMN reschedulereason TO reschedule_reason;
  END IF;

  -- statuschangedat → status_changed_at
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='appointments' AND column_name='statuschangedat') THEN
    ALTER TABLE appointments RENAME COLUMN statuschangedat TO status_changed_at;
  END IF;

  -- statuschangedby → status_changed_by
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='appointments' AND column_name='statuschangedby') THEN
    ALTER TABLE appointments RENAME COLUMN statuschangedby TO status_changed_by;
  END IF;

  -- meetlink → meet_link
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='appointments' AND column_name='meetlink') THEN
    ALTER TABLE appointments RENAME COLUMN meetlink TO meet_link;
  END IF;

  -- roomid → room_id
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='appointments' AND column_name='roomid') THEN
    ALTER TABLE appointments RENAME COLUMN roomid TO room_id;
  END IF;
END $$;

-- 2. Add columns with correct names if they don't already exist
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reschedule_reason TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS status_changed_by UUID;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS meet_link TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS room_id TEXT;

-- 3. Ensure time column exists (used by the app)
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS time TEXT;

-- 4. Drop problematic CHECK constraint on status if it exists
DO $$
DECLARE
    constraint_record RECORD;
BEGIN
    FOR constraint_record IN 
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'appointments'::regclass 
        AND contype = 'c'
        AND conname LIKE '%status%'
    LOOP
        EXECUTE format('ALTER TABLE appointments DROP CONSTRAINT IF EXISTS %I', constraint_record.conname);
    END LOOP;
END $$;

-- 5. Verify columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'appointments' 
ORDER BY ordinal_position;

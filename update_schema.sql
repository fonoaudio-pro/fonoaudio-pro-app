-- Update patients table
ALTER TABLE patients ADD COLUMN IF NOT EXISTS "treatmentPlan" jsonb DEFAULT '{}'::jsonb;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS history jsonb DEFAULT '[]'::jsonb;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS evaluations jsonb DEFAULT '[]'::jsonb;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS documents jsonb DEFAULT '[]'::jsonb;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS reports jsonb DEFAULT '[]'::jsonb;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS document text;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS diagnosis text;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS age numeric;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS name text;

-- Update appointments table
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS "patientId" text;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS "patientName" text;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS type text;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS date text;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS time text;

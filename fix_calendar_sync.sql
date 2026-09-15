-- =============================================================================
-- FIX: Google Calendar Sync - Base de Datos
-- Ejecutar este script en el SQL Editor de Supabase
-- =============================================================================

-- 1. Agregar columna sync_token a google_auth (falta en la tabla actual)
ALTER TABLE google_auth ADD COLUMN IF NOT EXISTS sync_token TEXT;

-- 2. Asegurar que google_auth tenga todas las columnas necesarias
ALTER TABLE google_auth ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 3. Asegurar que appointments tenga todas las columnas necesarias para Google Calendar
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS google_event_id TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS origin TEXT DEFAULT 'manual';
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS professional_id UUID;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS duration INTEGER;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS patient_contact TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS start_time TIMESTAMP WITH TIME ZONE;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS end_time TIMESTAMP WITH TIME ZONE;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS meet_link TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS consultorio TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reschedule_reason TEXT;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS status_changed_by UUID;

-- 4. Eliminar restricciones CHECK problemáticas en status de appointments
-- La app usa: pending, confirmed, cancelled, rescheduled, completed, no_show, attended
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

-- 5. Asegurar que la tabla appointments NO tenga NOT NULL en columnas que la app envía como opcionales
ALTER TABLE appointments ALTER COLUMN date DROP NOT NULL;

-- 6. RLS: Políticas permisivas para google_auth
ALTER TABLE google_auth ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for all users" ON google_auth;
CREATE POLICY "Enable all access for all users" ON google_auth FOR ALL USING (true) WITH CHECK (true);

-- 7. RLS: Políticas permisivas para appointments
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for all users" ON appointments;
DROP POLICY IF EXISTS "Professionals manage own appointments" ON appointments;
CREATE POLICY "Enable all access for all users" ON appointments FOR ALL USING (true) WITH CHECK (true);

-- 8. RLS: Políticas permisivas para patients (si no existen)
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for all users" ON patients;
DROP POLICY IF EXISTS "Professionals manage own patients" ON patients;
CREATE POLICY "Enable all access for all users" ON patients FOR ALL USING (true) WITH CHECK (true);

-- 9. Verificar que calendar_event_mappings tenga RLS permisivo
ALTER TABLE calendar_event_mappings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for all users" ON calendar_event_mappings;
CREATE POLICY "Enable all access for all users" ON calendar_event_mappings FOR ALL USING (true) WITH CHECK (true);

-- 10. Tabla user_sync_tokens (por si se necesita en el futuro)
CREATE TABLE IF NOT EXISTS user_sync_tokens (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    module TEXT NOT NULL,
    token TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);
ALTER TABLE user_sync_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for all users" ON user_sync_tokens;
CREATE POLICY "Enable all access for all users" ON user_sync_tokens FOR ALL USING (true) WITH CHECK (true);

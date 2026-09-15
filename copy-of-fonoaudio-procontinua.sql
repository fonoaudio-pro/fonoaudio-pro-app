-- ==========================================
-- 1. MÓDULO: AUTENTICACIÓN GOOGLE
-- ==========================================
CREATE TABLE IF NOT EXISTS google_auth (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE google_auth ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "User manage own auth" ON google_auth;
CREATE POLICY "User manage own auth" ON google_auth FOR ALL USING (auth.uid() = user_id);

-- ==========================================
-- 2. MÓDULO: MATERIALES
-- ==========================================
CREATE TABLE IF NOT EXISTS materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    clinical_area TEXT,
    resource_type TEXT,
    media_type TEXT,
    target_profile TEXT,
    url TEXT,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access" ON materials;
CREATE POLICY "Allow public read access" ON materials FOR SELECT USING (true);

-- ==========================================
-- 3. MÓDULO: HORARIOS (DISPONIBILIDAD)
-- ==========================================
CREATE TABLE IF NOT EXISTS user_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_working BOOLEAN DEFAULT true,
    UNIQUE(user_id, day_of_week)
);
ALTER TABLE user_schedules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "User manage own schedules" ON user_schedules;
CREATE POLICY "User manage own schedules" ON user_schedules FOR ALL USING (auth.uid() = user_id);

-- ==========================================
-- 4. MÓDULO: CITAS (Sincronización Real)
-- ==========================================
-- Borramos la tabla appointments para asegurar que la estructura sea la correcta
DROP TABLE IF EXISTS appointments CASCADE;
CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    patient_name TEXT,
    date DATE NOT NULL,
    time TIME,
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'pending',
    type TEXT,
    google_event_id TEXT,
    professional_id UUID REFERENCES auth.users(id),
    origin TEXT DEFAULT 'manual',
    duration INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Professionals manage own appointments" ON appointments;
CREATE POLICY "Professionals manage own appointments" ON appointments FOR ALL USING (auth.uid() = professional_id);

-- ==========================================
-- 5. SEGURIDAD GENERAL (TABLAS EXISTENTES)
-- ==========================================
-- Aplicamos RLS a tablas que ya deberían existir (Patients y Sessions)
DO $$ 
BEGIN 
    ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
    ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN others THEN 
    RAISE NOTICE 'Patients/Sessions RLS already enabled or table missing';
END $$;

DROP POLICY IF EXISTS "Professionals manage own patients" ON patients;
CREATE POLICY "Professionals manage own patients" ON patients FOR ALL USING (auth.uid() = professional_id);

DROP POLICY IF EXISTS "Professionals manage own sessions" ON sessions;
CREATE POLICY "Professionals manage own sessions" ON sessions FOR ALL USING (auth.uid() = professional_id);

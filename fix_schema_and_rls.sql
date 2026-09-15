-- =============================================================================
-- SCRIPT DE CORRECCIÓN Y ESTRUCTURA INTEGRAL (EJECUTAR TODO JUNTO)
-- =============================================================================

-- 1. PREPARAR TABLAS EXISTENTES (Añadir columnas de propiedad)
-- Añadimos professional_id a patients para poder aplicar RLS
ALTER TABLE patients ADD COLUMN IF NOT EXISTS professional_id UUID REFERENCES auth.users(id);

-- Añadimos professional_id a sessions para poder aplicar RLS
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS professional_id UUID REFERENCES auth.users(id);

-- 2. CREAR TABLAS NUEVAS (Si no existen)
DROP TABLE IF EXISTS google_auth CASCADE;
CREATE TABLE google_auth (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS user_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    is_working BOOLEAN DEFAULT true,
    UNIQUE(user_id, day_of_week)
);

CREATE TABLE IF NOT EXISTS calendar_event_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    google_event_id TEXT NOT NULL UNIQUE,
    patient_id UUID REFERENCES patients(id) ON DELETE CASCADE,
    session_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
    sync_status text CHECK (sync_status IN ('mapped', 'pending')) DEFAULT 'pending',
    last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. RECREAR APPOINTMENTS (Para asegurar estructura Capa 1 completa)
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
    patient_contact TEXT,
    cancellationReason TEXT,
    rescheduleReason TEXT,
    statusChangedAt TIMESTAMP WITH TIME ZONE,
    statusChangedBy UUID REFERENCES auth.users(id),
    meetLink TEXT,
    location TEXT,
    roomId TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. HABILITAR SEGURIDAD (RLS)
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_auth ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_event_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;

-- 5. APLICAR POLÍTICAS (Seguridad por Profesional)
-- Políticas para Google Auth
DROP POLICY IF EXISTS "User manage own auth" ON google_auth;
CREATE POLICY "User manage own auth" ON google_auth FOR ALL USING (auth.uid() = user_id);

-- Políticas para Schedules
DROP POLICY IF EXISTS "User manage own schedules" ON user_schedules;
CREATE POLICY "User manage own schedules" ON user_schedules FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Enable all access for mappings" ON calendar_event_mappings;
CREATE POLICY "Enable all access for mappings" ON calendar_event_mappings FOR ALL USING (true) WITH CHECK (true);

-- Políticas para Appointments
DROP POLICY IF EXISTS "Professionals manage own appointments" ON appointments;
CREATE POLICY "Professionals manage own appointments" ON appointments FOR ALL USING (auth.uid() = professional_id);

-- Políticas para Patients
DROP POLICY IF EXISTS "Professionals manage own patients" ON patients;
CREATE POLICY "Professionals manage own patients" ON patients FOR ALL USING (auth.uid() = professional_id);

-- Políticas para Sessions
DROP POLICY IF EXISTS "Professionals manage own sessions" ON sessions;
CREATE POLICY "Professionals manage own sessions" ON sessions FOR ALL USING (auth.uid() = professional_id);

-- Políticas para Materials (Lectura pública para evitar errores de carga en frontend)
DROP POLICY IF EXISTS "Allow public read access" ON materials;
CREATE POLICY "Allow public read access" ON materials FOR SELECT USING (true);

```,filePath:
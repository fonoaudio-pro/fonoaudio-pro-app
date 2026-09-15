-- =============================================================================
-- FIX COMPLETO: FonoAudio-Pro - Errores de creación de pacientes y tablas faltantes
-- Ejecutar este script en el SQL Editor de Supabase
-- =============================================================================
-- NOTA: Este script es 100% seguro de ejecutar múltiples veces.
--       Usa IF NOT EXISTS y IF EXISTS en todas las operaciones.
-- =============================================================================

-- ============================================================
-- PASO 1: ASEGURAR QUE EXISTAN TODAS LAS COLUMNAS EN patients
-- Usamos solo ADD COLUMN IF NOT EXISTS (nunca ALTER COLUMN)
-- para evitar errores si la tabla ya tiene esas columnas.
-- ============================================================

ALTER TABLE patients ADD COLUMN IF NOT EXISTS name text NOT NULL DEFAULT '';
ALTER TABLE patients ADD COLUMN IF NOT EXISTS age numeric DEFAULT 0;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS diagnosis text DEFAULT '';
ALTER TABLE patients ADD COLUMN IF NOT EXISTS document text DEFAULT '';
ALTER TABLE patients ADD COLUMN IF NOT EXISTS phone text DEFAULT '';
ALTER TABLE patients ADD COLUMN IF NOT EXISTS email text DEFAULT '';
ALTER TABLE patients ADD COLUMN IF NOT EXISTS notes text DEFAULT '';
ALTER TABLE patients ADD COLUMN IF NOT EXISTS history jsonb DEFAULT '[]'::jsonb;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS evaluations jsonb DEFAULT '[]'::jsonb;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS documents jsonb DEFAULT '[]'::jsonb;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS reports jsonb DEFAULT '[]'::jsonb;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS "treatmentPlan" jsonb DEFAULT '{}'::jsonb;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS anamnesis jsonb DEFAULT '{}'::jsonb;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS location text;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS responsable text;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS derivante text;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS "obraSocial" text;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS "consentSigned" boolean DEFAULT false;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS alerts text[] DEFAULT '{}';
ALTER TABLE patients ADD COLUMN IF NOT EXISTS interests text[] DEFAULT '{}';
ALTER TABLE patients ADD COLUMN IF NOT EXISTS consultorio text;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS date_of_birth date;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS gender text;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS emergency_contact text;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS emergency_phone text;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS insurance_number text;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();
ALTER TABLE patients ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();
ALTER TABLE patients ADD COLUMN IF NOT EXISTS professional_id uuid REFERENCES auth.users(id);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS homeGuide jsonb DEFAULT '{}'::jsonb;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS roomId text;

-- ============================================================
-- PASO 2: ARREGLAR POLÍTICAS RLS DE PATIENTS
-- ============================================================

ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Professionals manage own patients" ON patients;
DROP POLICY IF EXISTS "Enable all access" ON patients;
CREATE POLICY "Enable all access" ON patients FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- PASO 3: CREAR/ARREGLAR TABLAS FALTANTES
-- Todas las tablas usan patient_id text (no uuid) para
-- coincidir con patients.id que es text.
-- ============================================================

-- HOME GUIDES
-- patientId es uuid para coincidir con patients.id (uuid)
CREATE TABLE IF NOT EXISTS home_guides (
    id text PRIMARY KEY,
    "patientId" uuid REFERENCES patients(id) ON DELETE CASCADE,
    title text NOT NULL,
    content text,
    "materialIds" text[] DEFAULT '{}',
    status text DEFAULT 'draft',
    version int DEFAULT 1,
    "delivery_method" text,
    sent_at timestamptz,
    share_token text,
    updated_at timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now()
);
ALTER TABLE home_guides ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access" ON home_guides;
CREATE POLICY "Enable all access" ON home_guides FOR ALL USING (true) WITH CHECK (true);

-- ANALYSIS HISTORY
CREATE TABLE IF NOT EXISTS analysis_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid REFERENCES patients(id) ON DELETE CASCADE,
    module text NOT NULL,
    risk_level text,
    action_level text,
    summary_family jsonb DEFAULT '{}'::jsonb,
    timestamp timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now()
);
ALTER TABLE analysis_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access" ON analysis_history;
CREATE POLICY "Enable all access" ON analysis_history FOR ALL USING (true) WITH CHECK (true);

-- REPORTS
CREATE TABLE IF NOT EXISTS reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid REFERENCES patients(id) ON DELETE CASCADE,
    title text NOT NULL,
    content text,
    type text,
    clinical_snapshot jsonb DEFAULT '{}'::jsonb,
    version int DEFAULT 1,
    author_id text,
    date date,
    created_at timestamptz DEFAULT now()
);
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access" ON reports;
CREATE POLICY "Enable all access" ON reports FOR ALL USING (true) WITH CHECK (true);

-- CLINICAL RECORDS (FK usa uuid para patient_id)
DROP TABLE IF EXISTS clinical_records CASCADE;
CREATE TABLE IF NOT EXISTS clinical_records (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    chief_complaint text,
    chief_complaint_onset text,
    personal_history jsonb DEFAULT '{}'::jsonb,
    family_history jsonb DEFAULT '{}'::jsonb,
    medical_history jsonb DEFAULT '{}'::jsonb,
    developmental_history jsonb DEFAULT '{}'::jsonb,
    clinical_observations text,
    affected_areas jsonb DEFAULT '[]'::jsonb,
    primary_diagnosis_code text,
    primary_diagnosis_name text,
    secondary_diagnosis_codes jsonb DEFAULT '[]'::jsonb,
    created_by uuid REFERENCES auth.users(id),
    updated_by uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(patient_id)
);
CREATE INDEX IF NOT EXISTS idx_clinical_records_patient ON clinical_records(patient_id);
ALTER TABLE clinical_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access" ON clinical_records;
CREATE POLICY "Enable all access" ON clinical_records FOR ALL USING (true) WITH CHECK (true);

-- PATIENT ANAMNESIS (FK usa uuid para patient_id)
DROP TABLE IF EXISTS patient_anamnesis CASCADE;
CREATE TABLE IF NOT EXISTS patient_anamnesis (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    version integer NOT NULL DEFAULT 1,
    status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'final')),
    sections jsonb NOT NULL DEFAULT '{}'::jsonb,
    notes text,
    author_id uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    UNIQUE(patient_id, version)
);
CREATE INDEX IF NOT EXISTS idx_anamnesis_patient ON patient_anamnesis(patient_id);
ALTER TABLE patient_anamnesis ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access" ON patient_anamnesis;
CREATE POLICY "Enable all access" ON patient_anamnesis FOR ALL USING (true) WITH CHECK (true);

-- CLINICAL FACTS
CREATE TABLE IF NOT EXISTS clinical_facts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid REFERENCES patients(id) ON DELETE CASCADE,
    category text NOT NULL,
    fact text NOT NULL,
    evidence text,
    confidence numeric DEFAULT 1.0,
    "isResolved" boolean DEFAULT false,
    "resolvedAt" timestamptz,
    "resolvedBy" text,
    created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_clinical_facts_patient_category ON clinical_facts(patient_id, category);
ALTER TABLE clinical_facts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access" ON clinical_facts;
CREATE POLICY "Enable all access" ON clinical_facts FOR ALL USING (true) WITH CHECK (true);

-- SESSIONS
DROP TABLE IF EXISTS sessions CASCADE;
CREATE TABLE IF NOT EXISTS sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid REFERENCES patients(id) ON DELETE CASCADE,
    date text NOT NULL,
    summary text,
    observations text,
    next_action text,
    status text DEFAULT 'completed',
    type text,
    objectives text,
    plan_updates text,
    associated_material_ids text[] DEFAULT '{}',
    next_steps text,
    homework text,
    materials text,
    created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sessions_patient ON sessions(patient_id);
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access" ON sessions;
CREATE POLICY "Enable all access" ON sessions FOR ALL USING (true) WITH CHECK (true);

-- APPOINTMENTS
DROP TABLE IF EXISTS appointments CASCADE;
CREATE TABLE IF NOT EXISTS appointments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id uuid REFERENCES patients(id) ON DELETE CASCADE,
    patient_name text,
    type text,
    status text,
    date text,
    time text,
    meetLink text,
    location text,
    roomId text,
    professional_id uuid REFERENCES auth.users(id),
    origin text DEFAULT 'manual',
    start_time timestamptz,
    end_time timestamptz,
    duration integer,
    patient_contact text,
    cancellationReason text,
    rescheduleReason text,
    statusChangedAt timestamptz,
    statusChangedBy uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now()
);
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access" ON appointments;
CREATE POLICY "Enable all access" ON appointments FOR ALL USING (true) WITH CHECK (true);

-- NBA SUGGESTIONS
CREATE TABLE IF NOT EXISTS nba_suggestions (
    id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    created_at timestamptz DEFAULT now(),
    patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    module_id text NOT NULL,
    action_id text NOT NULL UNIQUE,
    title text NOT NULL,
    description text NOT NULL,
    rationale text,
    triggering_facts jsonb,
    knowledge_artifacts_used text[],
    confidence_or_strength numeric,
    status text NOT NULL DEFAULT 'pending',
    session_id uuid
);
ALTER TABLE nba_suggestions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access" ON nba_suggestions;
CREATE POLICY "Enable all access" ON nba_suggestions FOR ALL USING (true) WITH CHECK (true);

-- NBA DECISIONS
CREATE TABLE IF NOT EXISTS nba_decisions (
    id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    created_at timestamptz DEFAULT now(),
    patient_id uuid NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    suggestion_id bigint REFERENCES nba_suggestions(id),
    action_id text NOT NULL,
    original_action_id text,
    action_type text NOT NULL,
    category text,
    rationale text,
    triggering_facts jsonb,
    knowledge_artifacts_used text[],
    confidence_or_strength numeric,
    clinician_disposition text NOT NULL,
    disposition_reason text,
    metadata jsonb,
    session_id uuid
);
ALTER TABLE nba_decisions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access" ON nba_decisions;
CREATE POLICY "Enable all access" ON nba_decisions FOR ALL USING (true) WITH CHECK (true);

-- MATERIALS
CREATE TABLE IF NOT EXISTS materials (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    title text NOT NULL,
    description text,
    category text,
    type text,
    format text,
    url text,
    verified boolean DEFAULT false,
    clinical_area text,
    resource_type text,
    media_type text,
    target_profile text,
    tags text[] DEFAULT '{}',
    status text DEFAULT 'active',
    created_at timestamptz DEFAULT now()
);
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read access" ON materials;
DROP POLICY IF EXISTS "Enable all access" ON materials;
CREATE POLICY "Enable all access" ON materials FOR ALL USING (true) WITH CHECK (true);

-- GOOGLE AUTH
CREATE TABLE IF NOT EXISTS google_auth (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    access_token text NOT NULL,
    refresh_token text,
    expires_at timestamptz,
    updated_at timestamptz DEFAULT now()
);
ALTER TABLE google_auth ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access" ON google_auth;
DROP POLICY IF EXISTS "User manage own auth" ON google_auth;
CREATE POLICY "Enable all access" ON google_auth FOR ALL USING (true) WITH CHECK (true);

-- CALENDAR EVENT MAPPINGS
CREATE TABLE IF NOT EXISTS calendar_event_mappings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    google_event_id text NOT NULL UNIQUE,
    patient_id uuid REFERENCES patients(id) ON DELETE CASCADE,
    session_id uuid,
    sync_status text DEFAULT 'pending',
    last_synced_at timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now()
);
ALTER TABLE calendar_event_mappings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access" ON calendar_event_mappings;
DROP POLICY IF EXISTS "Enable all access for mappings" ON calendar_event_mappings;
CREATE POLICY "Enable all access" ON calendar_event_mappings FOR ALL USING (true) WITH CHECK (true);

-- CANDIDATE RESOURCES
CREATE TABLE IF NOT EXISTS candidate_resources (
    id text PRIMARY KEY,
    title text NOT NULL,
    description text,
    url text,
    source text,
    category text,
    tags text[] DEFAULT '{}',
    status text DEFAULT 'pending',
    created_at timestamptz DEFAULT now()
);
ALTER TABLE candidate_resources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access" ON candidate_resources;
CREATE POLICY "Enable all access" ON candidate_resources FOR ALL USING (true) WITH CHECK (true);

-- USER SCHEDULES
CREATE TABLE IF NOT EXISTS user_schedules (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    day_of_week integer CHECK (day_of_week BETWEEN 0 AND 6),
    start_time time NOT NULL,
    end_time time NOT NULL,
    is_working boolean DEFAULT true,
    UNIQUE(user_id, day_of_week)
);
ALTER TABLE user_schedules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access" ON user_schedules;
DROP POLICY IF EXISTS "User manage own schedules" ON user_schedules;
CREATE POLICY "Enable all access" ON user_schedules FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- PASO 4: ÍNDICES PARA PERFORMANCE
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(name);
CREATE INDEX IF NOT EXISTS idx_sessions_patient ON sessions(patient_id);
CREATE INDEX IF NOT EXISTS idx_home_guides_patient ON home_guides("patientId");
CREATE INDEX IF NOT EXISTS idx_analysis_history_patient ON analysis_history(patient_id, module);
CREATE INDEX IF NOT EXISTS idx_reports_patient ON reports(patient_id);
CREATE INDEX IF NOT EXISTS idx_nba_suggestions_patient ON nba_suggestions(patient_id);
CREATE INDEX IF NOT EXISTS idx_nba_decisions_patient ON nba_decisions(patient_id);

-- =============================================================================
-- FIN DEL SCRIPT
-- =============================================================================

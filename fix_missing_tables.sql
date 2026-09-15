-- =============================================================================
-- FIX: Tablas faltantes que causan errores 404 en consola
-- Ejecutar este script en el SQL Editor de Supabase
-- =============================================================================

-- 1. distribution_logs (usado por FollowUpService y DistributionHistory)
CREATE TABLE IF NOT EXISTS distribution_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distribution_id uuid,
  patient_id text NOT NULL,
  material_id text,
  material_title text NOT NULL,
  medium text CHECK (medium IN ('whatsapp', 'email')) NOT NULL,
  status text CHECK (status IN ('queued', 'sent', 'failed')) NOT NULL DEFAULT 'queued',
  recipient_contact text,
  error_message text,
  provider_response jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. follow_up_decisions (usado por FollowUpService)
CREATE TABLE IF NOT EXISTS follow_up_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id text NOT NULL,
  reason_hash text NOT NULL,
  status text CHECK (status IN ('resolved', 'snoozed', 'ignored')) NOT NULL DEFAULT 'ignored',
  snoozed_until timestamp with time zone,
  resolved_at timestamp with time zone,
  notes text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(patient_id, reason_hash)
);

-- 3. follow_up_audit_log (usado por FollowUpService)
CREATE TABLE IF NOT EXISTS follow_up_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id text NOT NULL,
  reason_hash text NOT NULL,
  action text NOT NULL,
  notes text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. clinical_suggestion_events (usado por FollowUpService)
CREATE TABLE IF NOT EXISTS clinical_suggestion_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text CHECK (event_type IN ('shown', 'applied', 'snoozed', 'ignored')) NOT NULL,
  suggestion_type text NOT NULL,
  signal text NOT NULL,
  severity text CHECK (severity IN ('low', 'medium', 'high')) NOT NULL,
  confidence numeric DEFAULT 0.5,
  reason_hash text NOT NULL,
  patient_id text NOT NULL,
  source_surface text CHECK (source_surface IN ('dashboard', 'patient_card')) NOT NULL,
  timestamp timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  schema_version text DEFAULT '1.0'
);

-- 5. clinical_facts (usado por los analysis services)
CREATE TABLE IF NOT EXISTS clinical_facts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id text NOT NULL,
  category text NOT NULL,
  sign text NOT NULL,
  details text,
  is_resolved boolean DEFAULT false,
  resolved_at timestamp with time zone,
  resolved_by text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. analysis_history (usado por los analysis services para snapshots)
CREATE TABLE IF NOT EXISTS analysis_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id text NOT NULL,
  module text NOT NULL,
  risk_level text,
  action_level text,
  summary_family text,
  timestamp timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS: Políticas permisivas para todas las tablas nuevas
ALTER TABLE distribution_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for all users" ON distribution_logs;
CREATE POLICY "Enable all access for all users" ON distribution_logs FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE follow_up_decisions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for all users" ON follow_up_decisions;
CREATE POLICY "Enable all access for all users" ON follow_up_decisions FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE follow_up_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for all users" ON follow_up_audit_log;
CREATE POLICY "Enable all access for all users" ON follow_up_audit_log FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE clinical_suggestion_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for all users" ON clinical_suggestion_events;
CREATE POLICY "Enable all access for all users" ON clinical_suggestion_events FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE clinical_facts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for all users" ON clinical_facts;
CREATE POLICY "Enable all access for all users" ON clinical_facts FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE analysis_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all access for all users" ON analysis_history;
CREATE POLICY "Enable all access for all users" ON analysis_history FOR ALL USING (true) WITH CHECK (true);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_distribution_logs_patient ON distribution_logs (patient_id);
CREATE INDEX IF NOT EXISTS idx_follow_up_decisions_patient ON follow_up_decisions (patient_id, reason_hash);
CREATE INDEX IF NOT EXISTS idx_clinical_facts_patient ON clinical_facts (patient_id);
CREATE INDEX IF NOT EXISTS idx_analysis_history_patient ON analysis_history (patient_id);

-- Patient Documents OCR: tablas para documentos escaneados del paciente
-- Almacena informes ORL, resultados, consentimientos, etc. con texto OCR extraído
-- Idempotente: puede ejecutarse múltiples veces sin errores

-- ============================================
-- 1. TABLA: patient_documents
-- Documentos escaneados/subidos por el profesional
-- ============================================
CREATE TABLE IF NOT EXISTS patient_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id text NOT NULL,
  clinic_id text,
  
  -- Archivo
  file_name text NOT NULL,
  file_type text NOT NULL,
  file_size integer,
  storage_path text,       -- ruta en Supabase Storage
  public_url text,         -- URL pública de descarga
  
  -- OCR y procesamiento
  ocr_text text,           -- texto extraído por OCR
  ocr_confidence float,    -- confianza del OCR (0-100)
  ocr_engine text,         -- motor utilizado (Tesseract, OCR.space, Gemini, etc.)
  
  -- Datos estructurados extraídos
  extracted_data jsonb DEFAULT '{}'::jsonb,  -- datos médicos estructurados
  document_category text CHECK (document_category IN (
    'informe_orl', 'audiometria', 'ecografia', 'laringoscopia',
    'analisis_laboratorio', 'consentimiento', 'evolucion',
    'estudio_complementario', 'otro'
  )),
  
  -- Metadata
  uploaded_by uuid REFERENCES profiles(id),
  uploaded_by_name text,
  notes text,
  tags text[] DEFAULT '{}',
  
  -- Estados
  status text DEFAULT 'uploaded' CHECK (status IN (
    'uploading', 'processing', 'ocr_ready', 'reviewed', 'archived'
  )),
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================
-- 2. RLS Policies
-- ============================================
ALTER TABLE patient_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS patient_documents_select ON patient_documents;
CREATE POLICY patient_documents_select ON patient_documents
  FOR SELECT USING (
    user_role() IN ('admin', 'supervisor', 'profesional')
  );

DROP POLICY IF EXISTS patient_documents_insert ON patient_documents;
CREATE POLICY patient_documents_insert ON patient_documents
  FOR INSERT WITH CHECK (
    user_role() IN ('admin', 'profesional', 'supervisor')
    AND uploaded_by = auth.uid()
  );

DROP POLICY IF EXISTS patient_documents_update ON patient_documents;
CREATE POLICY patient_documents_update ON patient_documents
  FOR UPDATE USING (
    uploaded_by = auth.uid() OR user_role() = 'admin'
  );

DROP POLICY IF EXISTS patient_documents_delete ON patient_documents;
CREATE POLICY patient_documents_delete ON patient_documents
  FOR DELETE USING (
    uploaded_by = auth.uid() OR user_role() = 'admin'
  );

-- ============================================
-- 3. Índices para performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_patient_documents_patient_id ON patient_documents(patient_id);
CREATE INDEX IF NOT EXISTS idx_patient_documents_clinic_id ON patient_documents(clinic_id);
CREATE INDEX IF NOT EXISTS idx_patient_documents_category ON patient_documents(document_category);
CREATE INDEX IF NOT EXISTS idx_patient_documents_status ON patient_documents(status);
CREATE INDEX IF NOT EXISTS idx_patient_documents_created_at ON patient_documents(created_at DESC);

-- ============================================
-- 4. Auto-update updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_patient_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_patient_documents_updated_at ON patient_documents;
CREATE TRIGGER trigger_patient_documents_updated_at
  BEFORE UPDATE ON patient_documents
  FOR EACH ROW EXECUTE FUNCTION update_patient_documents_updated_at();

-- ============================================
-- 5. Storage bucket para documentos de pacientes
-- ============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('patient-documents', 'patient-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies
DROP POLICY IF EXISTS "Patient documents: professional upload" ON storage.objects;
CREATE POLICY "Patient documents: professional upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'patient-documents'
    AND (storage.foldername(name))[1] = 'patient-documents'
  );

DROP POLICY IF EXISTS "Patient documents: professional read" ON storage.objects;
CREATE POLICY "Patient documents: professional read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'patient-documents');

DROP POLICY IF EXISTS "Patient documents: professional delete" ON storage.objects;
CREATE POLICY "Patient documents: professional delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'patient-documents');

-- ============================================
-- 6. Vista para documentos con contexto del paciente
-- ============================================
CREATE OR REPLACE VIEW patient_documents_with_patient AS
SELECT 
  pd.*,
  p.name AS patient_name,
  p.age AS patient_age,
  p.diagnosis AS patient_diagnosis
FROM patient_documents pd
LEFT JOIN patients p ON pd.patient_id = p.id::text;

COMMENT ON TABLE patient_documents IS 'Documentos escaneados/subidos por profesionales (informes ORL, resultados, etc.) con OCR integrado';
COMMENT ON COLUMN patient_documents.ocr_text IS 'Texto extraído del documento mediante OCR';
COMMENT ON COLUMN patient_documents.extracted_data IS 'Datos médicos estructurados extraídos del OCR (JSON)';

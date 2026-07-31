-- Report Templates System
-- Allows fonoaudiólogos to load custom report examples for AI-powered generation

CREATE TABLE IF NOT EXISTS report_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    area TEXT NOT NULL DEFAULT 'general',
    type TEXT NOT NULL DEFAULT 'valoracion',
    target_age TEXT NOT NULL DEFAULT 'all',
    sections JSONB NOT NULL DEFAULT '[]',
    example_paragraphs JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    author_id TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    tags TEXT[] DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_report_templates_area ON report_templates(area);
CREATE INDEX IF NOT EXISTS idx_report_templates_type ON report_templates(type);
CREATE INDEX IF NOT EXISTS idx_report_templates_active ON report_templates(is_active);

-- Example Paragraphs (separate table for better querying)
CREATE TABLE IF NOT EXISTS report_example_paragraphs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID REFERENCES report_templates(id) ON DELETE CASCADE,
    section_id TEXT NOT NULL,
    area TEXT NOT NULL DEFAULT 'general',
    age_group TEXT NOT NULL DEFAULT 'all',
    diagnosis TEXT NOT NULL DEFAULT '',
    text TEXT NOT NULL,
    quality_score INTEGER NOT NULL DEFAULT 3 CHECK (quality_score >= 1 AND quality_score <= 5),
    tags TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_example_paragraphs_section ON report_example_paragraphs(section_id);
CREATE INDEX IF NOT EXISTS idx_example_paragraphs_area ON report_example_paragraphs(area);
CREATE INDEX IF NOT EXISTS idx_example_paragraphs_quality ON report_example_paragraphs(quality_score DESC);

-- RLS Policies
ALTER TABLE report_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_example_paragraphs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to report_templates" ON report_templates FOR ALL USING (true);
CREATE POLICY "Allow all access to report_example_paragraphs" ON report_example_paragraphs FOR ALL USING (true);

-- Seed with the existing built-in templates as examples
INSERT INTO report_templates (name, area, type, target_age, sections, is_active, tags) VALUES
(
    'Informe de Valoración Fonoaudiológica - Plantilla Base',
    'general',
    'valoracion',
    'all',
    '[
        {"id": "info_general", "title": "Información General", "description": "Proporcionar detalles sobre el propósito del informe.", "order": 1, "required": true},
        {"id": "motivo_consulta", "title": "Motivo de Consulta", "description": "Detallar la razón de la consulta.", "order": 2, "required": true},
        {"id": "comportamiento", "title": "Comportamiento y Equilibrio Afectivo-Emocional", "description": "Observaciones de conducta durante la valoración.", "order": 3, "required": true},
        {"id": "dba", "title": "Dispositivos Básicos de Aprendizaje (DBA)", "description": "Evaluación de motivación, atención, sensopercepción y memoria.", "order": 4, "required": true},
        {"id": "interaccion_social", "title": "Interacción Social", "description": "Observación en contextos sociales.", "order": 5, "required": true},
        {"id": "expresivo_morfosintaxis", "title": "Lenguaje Expresivo: Morfosintaxis", "description": "Aspectos gramaticales y sintácticos.", "order": 6, "required": true},
        {"id": "expresivo_semantica", "title": "Lenguaje Expresivo: Léxico-Semántico", "description": "Vocabulario y repertorio productivo.", "order": 7, "required": true},
        {"id": "pragmatico", "title": "Nivel Pragmático y Habilidades Sociales", "description": "Uso funcional del lenguaje en contexto social.", "order": 8, "required": true},
        {"id": "comprensivo", "title": "Lenguaje Comprensivo", "description": "Habilidades receptivas.", "order": 9, "required": true},
        {"id": "habla", "title": "Habla y Fonética-Fonología", "description": "Calidad de producción verbal.", "order": 10, "required": true},
        {"id": "voz", "title": "Voz", "description": "Calidad vocal.", "order": 11, "required": false},
        {"id": "juego", "title": "Desarrollo del Juego", "description": "Participación lúdica.", "order": 12, "required": false},
        {"id": "impresion_diagnostica", "title": "Impresión Diagnóstica", "description": "Diagnóstico presuntivo.", "order": 13, "required": true},
        {"id": "pronostico", "title": "Pronóstico Clínico", "description": "Tipo de pronóstico.", "order": 14, "required": true},
        {"id": "objetivos", "title": "Objetivos de Intervención", "description": "Metas terapéuticas.", "order": 15, "required": true},
        {"id": "recomendaciones", "title": "Recomendaciones Fonoaudiológicas", "description": "Recomendaciones terapéuticas.", "order": 16, "required": true}
    ]',
    true,
    ARRAY['general', 'valoración', 'plantilla base']
),
(
    'Informe de Proceso Terapéutico - Lenguaje',
    'lenguaje',
    'proceso',
    'pediatria',
    '[
        {"id": "info_evolucion", "title": "Datos de Evolución Clínica", "description": "Generalidades del tratamiento.", "order": 1, "required": true},
        {"id": "actitud_terapeutica", "title": "Actitud del Paciente", "description": "Predisposición frente a la intervención.", "order": 2, "required": true},
        {"id": "logros_alcanzados", "title": "Logros Clínicos Alcanzados", "description": "Objetivos conquistados.", "order": 3, "required": true},
        {"id": "objetivos_pendientes", "title": "Objetivos en Desarrollo", "description": "Aspectos que precisan estimulación continua.", "order": 4, "required": true},
        {"id": "pronostico_evolutivo", "title": "Pronóstico y Continuidad", "description": "Evolución del pronóstico.", "order": 5, "required": true}
    ]',
    true,
    ARRAY['lenguaje', 'proceso', 'pediatría']
);

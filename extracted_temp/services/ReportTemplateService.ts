import { supabase } from '../utils/supabaseClient';

export interface ReportTemplate {
    id: string;
    name: string;
    area: string; // 'lenguaje' | 'habla' | 'voz' | 'audiologia' | 'deglucion' | 'cognicion' | 'adulto' | 'pediatria' | 'general'
    type: 'valoracion' | 'proceso' | 'seguimiento' | 'alta' | 'derivacion' | 'interconsulta' | 'custom';
    target_age: 'pediatrico' | 'adulto' | 'geriatrico' | 'all';
    sections: TemplateSection[];
    example_paragraphs: ExampleParagraph[];
    created_at: string;
    updated_at: string;
    author_id: string;
    is_active: boolean;
    tags: string[];
}

export interface TemplateSection {
    id: string;
    title: string;
    description: string;
    order: number;
    required: boolean;
    default_content?: string;
    variables?: TemplateVariable[];
    scenarios?: TemplateScenario[];
}

export interface TemplateVariable {
    id: string;
    label: string;
    placeholder: string;
    auto_fill_from?: string; // patient field name
}

export interface TemplateScenario {
    label: string;
    level: 'adecuado' | 'leve' | 'severo' | 'favorable' | 'reservado' | 'generico';
    text: string;
}

export interface ExampleParagraph {
    id: string;
    section_id: string;
    area: string;
    age_group: string;
    diagnosis: string;
    text: string;
    quality_score: number; // 1-5, how good is this as an example
    tags: string[];
}

export const AREA_OPTIONS = [
    { value: 'lenguaje', label: 'Lenguaje' },
    { value: 'habla', label: 'Habla y Fonología' },
    { value: 'voz', label: 'Voz' },
    { value: 'audiologia', label: 'Audiología' },
    { value: 'deglucion', label: 'Deglución' },
    { value: 'cognicion', label: 'Cognición' },
    { value: 'motricidad', label: 'Motricidad Orofacial' },
    { value: 'adulto', label: 'Adulto' },
    { value: 'pediatria', label: 'Pediatría' },
    { value: 'geriatria', label: 'Geriatría' },
    { value: 'general', label: 'General' },
];

export const AGE_GROUP_OPTIONS = [
    { value: '0-2', label: '0-2 años' },
    { value: '3-5', label: '3-5 años' },
    { value: '6-12', label: '6-12 años' },
    { value: '13-17', label: '13-17 años' },
    { value: '18-60', label: '18-60 años' },
    { value: '60+', label: '60+ años' },
    { value: 'all', label: 'Todas las edades' },
];

class ReportTemplateService {

    /**
     * Get all active templates, optionally filtered by area/age/type.
     */
    async getTemplates(filters?: { area?: string; type?: string; age_group?: string }): Promise<ReportTemplate[]> {
        let query = supabase
            .from('report_templates')
            .select('*')
            .eq('is_active', true)
            .order('updated_at', { ascending: false });

        if (filters?.area) query = query.eq('area', filters.area);
        if (filters?.type) query = query.eq('type', filters.type);

        const { data, error } = await query;
        if (error) {
            console.error('[ReportTemplateService] Error fetching templates:', error);
            return this.getFallbackTemplates();
        }
        if (!data || data.length === 0) return this.getFallbackTemplates();
        return data;
    }

    /**
     * Fallback templates when DB is empty or inaccessible (RLS, table missing, etc.)
     */
    private getFallbackTemplates(): ReportTemplate[] {
        return [
            {
                id: 'fallback-1',
                name: 'Evaluación de Lenguaje - Niño',
                area: 'lenguaje',
                type: 'valoracion',
                target_age: 'pediatrico',
                author_id: 'system',
                is_active: true,
                tags: ['lenguaje', 'pediatria', 'evaluación'],
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                sections: [
                    { id: 's1', title: 'Motivo de Consulta', description: 'Motivo por el que la familia consulta', order: 0, required: true, default_content: '' },
                    { id: 's2', title: 'Antecedentes', description: 'Historia del desarrollo y antecedentes familiares', order: 1, required: true, default_content: '' },
                    { id: 's3', title: 'Evaluación', description: 'Resultados de la evaluación logopédica', order: 2, required: true, default_content: '' },
                    { id: 's4', title: 'Impresión Diagnóstica', description: 'Diagnóstico funcional', order: 3, required: true, default_content: '' },
                    { id: 's5', title: 'Plan de Tratamiento', description: 'Objetivos y estrategias de intervención', order: 4, required: true, default_content: '' },
                ],
                example_paragraphs: [],
            },
            {
                id: 'fallback-2',
                name: 'Evaluación de Habla - Niño',
                area: 'habla',
                type: 'valoracion',
                target_age: 'pediatrico',
                author_id: 'system',
                is_active: true,
                tags: ['habla', 'pediatria', 'evaluación'],
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                sections: [
                    { id: 's1', title: 'Motivo de Consulta', description: 'Motivo de consulta', order: 0, required: true, default_content: '' },
                    { id: 's2', title: 'Historia del Desarrollo del Habla', description: 'Hitos del desarrollo del habla y lenguaje', order: 1, required: true, default_content: '' },
                    { id: 's3', title: 'Evaluación Articulatoria', description: 'Evaluación de fonemas y procesos fonológicos', order: 2, required: true, default_content: '' },
                    { id: 's4', title: 'Diagnóstico', description: 'Diagnóstico logopédico', order: 3, required: true, default_content: '' },
                    { id: 's5', title: 'Tratamiento', description: 'Plan de intervención', order: 4, required: true, default_content: '' },
                ],
                example_paragraphs: [],
            },
            {
                id: 'fallback-3',
                name: 'Seguimiento - Adulto',
                area: 'general',
                type: 'seguimiento',
                target_age: 'adulto',
                author_id: 'system',
                is_active: true,
                tags: ['seguimiento', 'adulto'],
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                sections: [
                    { id: 's1', title: 'Evolución desde la Última Sesión', description: 'Cambios observados', order: 0, required: true, default_content: '' },
                    { id: 's2', title: 'Actividad Realizada', description: 'Intervención aplicada', order: 1, required: true, default_content: '' },
                    { id: 's3', title: 'Resultados', description: 'Respuesta del paciente', order: 2, required: true, default_content: '' },
                    { id: 's4', title: 'Próximos Pasos', description: 'Objetivos para la próxima sesión', order: 3, required: true, default_content: '' },
                ],
                example_paragraphs: [],
            },
            {
                id: 'fallback-4',
                name: 'Evaluación de Voz - Adulto',
                area: 'voz',
                type: 'valoracion',
                target_age: 'adulto',
                author_id: 'system',
                is_active: true,
                tags: ['voz', 'adulto', 'evaluación'],
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                sections: [
                    { id: 's1', title: 'Motivo de Consulta', description: 'Motivo de consulta y tiempo de evolución', order: 0, required: true, default_content: '' },
                    { id: 's2', title: 'Historia Clínica', description: 'Antecedentes médicos y medicación', order: 1, required: true, default_content: '' },
                    { id: 's3', title: 'Evaluación Foniatrica', description: 'Inspección, audiometría, estudios', order: 2, required: true, default_content: '' },
                    { id: 's4', title: 'Análisis Acústico de la Voz', description: 'Frecuencia, intensidad, calidad', order: 3, required: true, default_content: '' },
                    { id: 's5', title: 'Diagnóstico y Tratamiento', description: 'Diagnóstico funcional y plan terapéutico', order: 4, required: true, default_content: '' },
                ],
                example_paragraphs: [],
            },
            {
                id: 'fallback-5',
                name: 'Interconsulta Fonoaudiológica',
                area: 'general',
                type: 'interconsulta',
                target_age: 'all',
                author_id: 'system',
                is_active: true,
                tags: ['interconsulta', 'derivación'],
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                sections: [
                    { id: 's1', title: 'Datos del Paciente', description: 'Identificación y motivo', order: 0, required: true, default_content: '' },
                    { id: 's2', title: 'Resumen de Evaluación', description: 'Hallazgos principales', order: 1, required: true, default_content: '' },
                    { id: 's3', title: 'Diagnóstico Fonoaudiológico', description: 'CIE-10 o descripción', order: 2, required: true, default_content: '' },
                    { id: 's4', title: 'Recomendaciones', description: 'Derivaciones y pautas', order: 3, required: true, default_content: '' },
                ],
                example_paragraphs: [],
            },
        ];
    }

    /**
     * Seed default templates if table is empty.
     */
    async seedDefaultTemplates(): Promise<number> {
        const existing = await this.getTemplates();
        if (existing.length > 0) return 0;

        const defaults: Omit<ReportTemplate, 'id' | 'created_at' | 'updated_at'>[] = [
            {
                name: 'Evaluación de Lenguaje - Niño',
                area: 'lenguaje',
                type: 'valoracion',
                target_age: 'pediatrico',
                author_id: 'system',
                is_active: true,
                tags: ['lenguaje', 'pediatria', 'evaluación'],
                sections: [
                    { id: 's1', title: 'Motivo de Consulta', description: 'Motivo por el que la familia consulta', order: 0, required: true, default_content: '' },
                    { id: 's2', title: 'Datos Anamnésicos', description: 'Historia del desarrollo del lenguaje', order: 1, required: true, default_content: '' },
                    { id: 's3', title: 'Evaluación del Lenguaje Receptivo', description: 'Comprensión auditiva, vocabulario', order: 2, required: true, default_content: '' },
                    { id: 's4', title: 'Evaluación del Lenguaje Expresivo', description: 'Producción fonológica, morfosintaxis', order: 3, required: true, default_content: '' },
                    { id: 's5', title: 'Habilidades Pragmáticas', description: 'Uso funcional del lenguaje', order: 4, required: false, default_content: '' },
                    { id: 's6', title: 'Impresión Diagnóstica', description: 'Diagnóstico fonoaudiológico', order: 5, required: true, default_content: '' },
                    { id: 's7', title: 'Plan de Tratamiento', description: 'Objetivos y estrategias', order: 6, required: true, default_content: '' },
                ],
                example_paragraphs: [],
            },
            {
                name: 'Evaluación de Habla - Niño',
                area: 'habla',
                type: 'valoracion',
                target_age: 'pediatrico',
                author_id: 'system',
                is_active: true,
                tags: ['habla', 'pediatria', 'evaluación'],
                sections: [
                    { id: 's1', title: 'Motivo de Consulta', description: 'Motivo de la consulta', order: 0, required: true, default_content: '' },
                    { id: 's2', title: 'Historia del Desarrollo', description: 'Hitos del desarrollo motor y del habla', order: 1, required: true, default_content: '' },
                    { id: 's3', title: 'Evaluación Articulatoria', description: 'Producción de fonemas en distintas posiciones', order: 2, required: true, default_content: '' },
                    { id: 's4', title: 'Fluidez Verbal', description: 'Evaluación de disfluencias', order: 3, required: false, default_content: '' },
                    { id: 's5', title: 'Impresión Diagnóstica', description: 'Diagnóstico y clasificación', order: 4, required: true, default_content: '' },
                    { id: 's6', title: 'Plan de Tratamiento', description: 'Objetivos, frecuencia y duración', order: 5, required: true, default_content: '' },
                ],
                example_paragraphs: [],
            },
            {
                name: 'Informe de Seguimiento',
                area: 'general',
                type: 'seguimiento',
                target_age: 'all',
                author_id: 'system',
                is_active: true,
                tags: ['seguimiento', 'informe'],
                sections: [
                    { id: 's1', title: 'Evolución del Paciente', description: 'Progreso desde la última sesión', order: 0, required: true, default_content: '' },
                    { id: 's2', title: 'Actividades Realizadas', description: 'Intervenciones aplicadas', order: 1, required: true, default_content: '' },
                    { id: 's3', title: 'Observaciones', description: 'Notas clínicas relevantes', order: 2, required: false, default_content: '' },
                    { id: 's4', title: 'Próximos Pasos', description: 'Objetivos para las próximas sesiones', order: 3, required: true, default_content: '' },
                ],
                example_paragraphs: [],
            },
            {
                name: 'Evaluación de Voz - Adulto',
                area: 'voz',
                type: 'valoracion',
                target_age: 'adulto',
                author_id: 'system',
                is_active: true,
                tags: ['voz', 'adulto', 'evaluación'],
                sections: [
                    { id: 's1', title: 'Motivo de Consulta', description: 'Presentación del cuadro voice', order: 0, required: true, default_content: '' },
                    { id: 's2', title: 'Historia Clínica', description: 'Antecedentes médicos relevantes', order: 1, required: true, default_content: '' },
                    { id: 's3', title: 'Análisis Acústico', description: 'Jitter, shimmer, F0, GNE', order: 2, required: false, default_content: '' },
                    { id: 's4', title: 'Evaluación Perceptiva', description: 'Escala GRBAS o similar', order: 3, required: true, default_content: '' },
                    { id: 's5', title: 'Impresión Diagnóstica', description: 'Diagnóstico funcional', order: 4, required: true, default_content: '' },
                    { id: 's6', title: 'Plan de Tratamiento', description: 'Pautas y frecuencia', order: 5, required: true, default_content: '' },
                ],
                example_paragraphs: [],
            },
            {
                name: 'Interconsulta Fonoaudiológica',
                area: 'general',
                type: 'interconsulta',
                target_age: 'all',
                author_id: 'system',
                is_active: true,
                tags: ['interconsulta', 'derivación'],
                sections: [
                    { id: 's1', title: 'Datos del Paciente', description: 'Identificación y motivo', order: 0, required: true, default_content: '' },
                    { id: 's2', title: 'Resumen de Evaluación', description: 'Hallazgos principales', order: 1, required: true, default_content: '' },
                    { id: 's3', title: 'Diagnóstico Fonoaudiológico', description: 'CIE-10 o descripción', order: 2, required: true, default_content: '' },
                    { id: 's4', title: 'Recomendaciones', description: 'Derivaciones y pautas', order: 3, required: true, default_content: '' },
                ],
                example_paragraphs: [],
            },
        ];

        let count = 0;
        for (const template of defaults) {
            const result = await this.saveTemplate(template);
            if (result) count++;
        }
        return count;
    }

    /**
     * Get a single template by ID.
     */
    async getTemplate(id: string): Promise<ReportTemplate | null> {
        const { data, error } = await supabase
            .from('report_templates')
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            console.error('[ReportTemplateService] Error fetching template:', error);
            return null;
        }
        return data;
    }

    /**
     * Save a new template.
     */
    async saveTemplate(template: Omit<ReportTemplate, 'id' | 'created_at' | 'updated_at'>): Promise<ReportTemplate | null> {
        const { data, error } = await supabase
            .from('report_templates')
            .insert([{
                ...template,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            }])
            .select()
            .single();

        if (error) {
            console.error('[ReportTemplateService] Error saving template:', error);
            return null;
        }
        return data;
    }

    /**
     * Update an existing template.
     */
    async updateTemplate(id: string, updates: Partial<ReportTemplate>): Promise<boolean> {
        const { error } = await supabase
            .from('report_templates')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id);

        if (error) {
            console.error('[ReportTemplateService] Error updating template:', error);
            return false;
        }
        return true;
    }

    /**
     * Delete a template (soft delete).
     */
    async deleteTemplate(id: string): Promise<boolean> {
        const { error } = await supabase
            .from('report_templates')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq('id', id);

        if (error) {
            console.error('[ReportTemplateService] Error deleting template:', error);
            return false;
        }
        return true;
    }

    /**
     * Get example paragraphs for AI context, filtered by area and age.
     */
    async getExampleParagraphs(filters: { section_id?: string; area?: string; age_group?: string; diagnosis?: string }): Promise<ExampleParagraph[]> {
        let query = supabase
            .from('report_example_paragraphs')
            .select('*')
            .order('quality_score', { ascending: false })
            .limit(10);

        if (filters.section_id) query = query.eq('section_id', filters.section_id);
        if (filters.area) query = query.eq('area', filters.area);
        if (filters.age_group) query = query.eq('age_group', filters.age_group);

        const { data, error } = await query;
        if (error) {
            console.error('[ReportTemplateService] Error fetching examples:', error);
            return [];
        }
        return data || [];
    }

    /**
     * Save an example paragraph.
     */
    async saveExampleParagraph(example: Omit<ExampleParagraph, 'id'>): Promise<ExampleParagraph | null> {
        const { data, error } = await supabase
            .from('report_example_paragraphs')
            .insert([example])
            .select()
            .single();

        if (error) {
            console.error('[ReportTemplateService] Error saving example:', error);
            return null;
        }
        return data;
    }

    /**
     * Convert a ReportTemplate to the format expected by the report builder.
     * This bridges custom templates with the existing template system.
     */
    templateToBuilderFormat(template: ReportTemplate): Record<string, any> {
        return {
            title: template.name,
            sections: template.sections
                .sort((a, b) => a.order - b.order)
                .map(s => ({
                    id: s.id,
                    title: s.title,
                    explicacion: s.description,
                    defaultContent: s.default_content || '',
                    variables: (s.variables || []).map(v => ({
                        id: v.id,
                        label: v.label,
                        placeholder: v.placeholder,
                        defaultValue: '',
                    })),
                    options: (s.scenarios || []).map(sc => ({
                        label: sc.label,
                        level: sc.level,
                        color: sc.level === 'adecuado' || sc.level === 'favorable' ? 'emerald'
                            : sc.level === 'leve' || sc.level === 'reservado' ? 'amber'
                            : 'red',
                        text: sc.text,
                    })),
                    editable: true,
                    allowsMaterials: true,
                })),
        };
    }

    /**
     * Build AI context from template examples for smarter generation.
     */
    buildTemplateContext(examples: ExampleParagraph[], sectionId: string): string {
        if (examples.length === 0) return '';

        const relevant = examples.filter(e => e.section_id === sectionId || !e.section_id);
        if (relevant.length === 0) return '';

        let ctx = `\n[EJEMPLOS DE PÁRRAFOS CLÍNICOS PARA SECCIÓN "${sectionId}"]\n`;
        ctx += `Usá estos ejemplos como referencia de estilo y contenido:\n\n`;

        relevant.slice(0, 5).forEach((ex, i) => {
            ctx += `Ejemplo ${i + 1} (${ex.area}, ${ex.age_group}, ${ex.diagnosis}):\n`;
            ctx += `${ex.text}\n\n`;
        });

        return ctx;
    }
}

export const reportTemplateService = new ReportTemplateService();

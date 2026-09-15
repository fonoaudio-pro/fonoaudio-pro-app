import { supabase } from '../utils/supabaseClient';
import { generateText } from '../utils/geminiHelpers';

export type AssetType = 'image' | 'activity_image' | 'infographic' | 'social_post' | 'worksheet' | 'exercise_card' | 'flashcard' | 'pictogram' | 'pictogram_sequence';
export type TemplateCategory = 'activity' | 'infographic' | 'social' | 'worksheet' | 'flashcard' | 'pictogram';

export interface MaterialAsset {
  id: string;
  material_id: string | null;
  consultorio_id: string | null;
  asset_type: AssetType;
  title: string;
  description: string | null;
  prompt_used: string | null;
  generation_model: string | null;
  file_url: string | null;
  file_path: string | null;
  file_size: number | null;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  metadata: Record<string, any>;
  status: 'active' | 'archived' | 'processing' | 'failed';
  error_message: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface MultimediaTemplate {
  id: string;
  name: string;
  description: string | null;
  category: TemplateCategory;
  clinical_area: string | null;
  template_config: Record<string, any>;
  prompt_template: string | null;
  example_output_url: string | null;
  is_active: boolean;
  created_at: string;
}

export interface GenerateMaterialInput {
  template_id?: string;
  title: string;
  description?: string;
  asset_type: AssetType;
  clinical_area?: string;
  parameters: Record<string, string>;
  patient_id?: string;
  consultorio_id?: string;
  uploaded_image_url?: string;
  image_url?: string;
  sequence_items?: string[];
  source?: 'local' | 'arasaac' | 'ai';
}

export interface MaterialWithAssets {
  id: string;
  title: string;
  description: string;
  clinical_area: string;
  resource_type: string;
  media_type: string;
  status: string;
  tags: string[];
  assets: MaterialAsset[];
  created_at: string;
}

export const MultimediaMaterialService = {

  async getTemplates(category?: TemplateCategory): Promise<MultimediaTemplate[]> {
    let query = supabase.from('multimedia_templates').select('*').eq('is_active', true);
    if (category) query = query.eq('category', category);
    const { data, error } = await query.order('name');
    if (error) throw error;
    return data || [];
  },

  async getTemplateById(id: string): Promise<MultimediaTemplate | null> {
    const { data, error } = await supabase
      .from('multimedia_templates')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async getAssetsByMaterial(materialId: string): Promise<MaterialAsset[]> {
    const { data, error } = await supabase
      .from('material_assets')
      .select('*')
      .eq('material_id', materialId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async getAllAssets(consultorioId?: string): Promise<MaterialAsset[]> {
    let query = supabase
      .from('material_assets')
      .select('*')
      .order('created_at', { ascending: false });
    if (consultorioId) query = query.eq('consultorio_id', consultorioId);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async getAssetById(id: string): Promise<MaterialAsset | null> {
    const { data, error } = await supabase
      .from('material_assets')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data;
  },

  async createAsset(asset: Partial<MaterialAsset>): Promise<MaterialAsset> {
    const { data, error } = await supabase
      .from('material_assets')
      .insert([{
        ...asset,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateAsset(id: string, updates: Partial<MaterialAsset>): Promise<MaterialAsset> {
    const { data, error } = await supabase
      .from('material_assets')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteAsset(id: string): Promise<void> {
    const { error } = await supabase.from('material_assets').delete().eq('id', id);
    if (error) throw error;
  },

  // ============================================
  // AI GENERATION
  // ============================================

  async generateMaterial(input: GenerateMaterialInput, userId: string): Promise<MaterialAsset> {
    let prompt = '';
    if (input.template_id) {
      const template = await this.getTemplateById(input.template_id);
      if (template?.prompt_template) {
        prompt = template.prompt_template;
        for (const [key, value] of Object.entries(input.parameters)) {
          prompt = prompt.replace(new RegExp(`\\[${key.toUpperCase()}\\]`, 'g'), value);
        }
      }
    }

    if (!prompt) {
      prompt = this.buildDefaultPrompt(input);
    }

    // Crear material lightweight primero para vincular el asset
    const { data: material, error: matError } = await supabase
      .from('materials')
      .insert([{
        title: input.title,
        category: input.asset_type,
        type: 'multimedia',
        clinical_area: input.clinical_area || null,
        tags: [input.asset_type, input.clinical_area || 'general'].filter(Boolean),
      }])
      .select('id')
      .single();

    if (matError) {
      console.warn('[MultimediaMaterial] No se pudo crear material base:', matError.message);
    }

    const isAiGenerated = !!(input.image_url && input.image_url.startsWith('http'));
    const isLocalPictogram = !!(input.image_url && input.image_url.startsWith('data:'));
    const generationModel = isAiGenerated ? 'dreamshaper-xl' : isLocalPictogram ? 'local-canvas' : input.source === 'arasaac' ? 'arasaac' : 'local-canvas';

    const asset = await this.createAsset({
      material_id: material?.id || null,
      consultorio_id: input.consultorio_id || null,
      asset_type: input.asset_type,
      title: input.title,
      description: input.description || null,
      prompt_used: prompt,
      generation_model: generationModel,
      file_url: input.image_url || input.uploaded_image_url || null,
      status: 'processing',
      metadata: {
        parameters: input.parameters,
        clinical_area: input.clinical_area,
        uploaded_image_url: input.uploaded_image_url,
        sequence_items: input.sequence_items,
        image_url: input.image_url || null,
      },
      created_by: userId,
    });

    try {
      let description = '';

      if (input.asset_type === 'pictogram_sequence' && input.sequence_items?.length) {
        description = await this.generateSequenceDescription(input);
      } else if (input.uploaded_image_url) {
        description = await this.generatePictogramFromImage(input);
      } else {
        description = await this.generateStandardDescription(prompt, input);
      }

      const updated = await this.updateAsset(asset.id, {
        description,
        status: 'active',
        metadata: {
          ...asset.metadata,
          ai_description: description,
          generated_at: new Date().toISOString(),
        },
      });

      await this.recordAnalyticsEvent({
        material_id: asset.id,
        event_type: 'generated_by_ai',
        event_context: 'ai_generation',
        user_id: userId,
        metadata: { asset_id: asset.id, prompt_length: prompt.length, asset_type: input.asset_type },
      });

      return updated;
    } catch (error: any) {
      await this.updateAsset(asset.id, {
        status: 'failed',
        error_message: error?.message || 'Error generating content',
      });
      throw error;
    }
  },

  async generateStandardDescription(prompt: string, input: GenerateMaterialInput): Promise<string> {
    const enhancementPrompt = `Sos un asistente de logopedia profesional. Generá una descripción detallada para este material:

PROMPT: "${prompt}"
ÁREA CLÍNICA: ${input.clinical_area || 'general'}
TIPO: ${input.asset_type}

Respondé con:
1. DESCRIPCIÓN VISUAL: Qué debe contener la imagen/material
2. INSTRUCCIONES TERAPÉUTICAS: Cómo usarlo en sesión
3. ADAPTACIONES: Variaciones por edad/nivel
4. PALETA DE COLORES: Colores sugeridos
5. FORMATO: Dimensiones y resolución recomendada`;

    return await generateText(enhancementPrompt);
  },

  async generatePictogramFromImage(input: GenerateMaterialInput): Promise<string> {
    const enhancementPrompt = `Sos un asistente de logopedia. El profesional subió una imagen para crear un pictograma terapéutico.

TÍTULO: ${input.title}
ÁREA: ${input.clinical_area || 'general'}
DESCRIPCIÓN ORIGINAL: ${input.description || 'Sin descripción'}

Generá:
1. DESCRIPCIÓN DEL PICTOGRAMA: Qué representar con la imagen
2. SIMPLIFICACIÓN: Cómo reducir la imagen a pictograma simple
3. COLORES: Paleta clara y contrastante
4. TEXTO ACOMPAÑANTE: Frase corta para el pictograma
5. USO CLÍNICO: En qué actividades se puede usar`;

    return await generateText(enhancementPrompt);
  },

  async generateSequenceDescription(input: GenerateMaterialInput): Promise<string> {
    const items = input.sequence_items || [];
    const sequenceText = items.map((item, i) => `${i + 1}. ${item}`).join('\n');

    const prompt = `Sos un asistente de logopedia. Generá una secuencia de pictogramas para una guía de actividades para la familia.

TÍTULO: ${input.title}
ÁREA: ${input.clinical_area || 'general'}
SEQUENCIA:
${sequenceText}

Generá:
1. DESCRIPCIÓN DE CADA PICTOGRAMA: Qué representar visualmente en cada paso
2. INSTRUCCIONES PARA LA FAMILIA: Explicación paso a paso
3. CONSEJOS: Tips para los padres/cuidadores
4. FRECUENCIA: Cuántas veces por semana realizar
5. SEÑALES DE AVANCE: Qué indicadores de progreso observar`;

    return await generateText(prompt);
  },

  buildDefaultPrompt(input: GenerateMaterialInput): string {
    const area = input.clinical_area || 'general';
    const type = input.asset_type;

    const prompts: Record<string, string> = {
      activity_image: `Genera una actividad terapéutica para logopedia. Área: ${area}. Título: ${input.title}. Parámetros: ${JSON.stringify(input.parameters)}.`,
      infographic: `Crea una infografía profesional sobre ${input.title}. Área clínica: ${area}. Estilo limpio y educativo.`,
      social_post: `Diseña un post para redes sociales sobre logopedia. Tema: ${input.title}. Estilo moderno y llamativo.`,
      flashcard: `Crea una tarjeta de ejercicio para logopedia. Tema: ${input.title}. Área: ${area}. Estilo lúdico y colorido.`,
      exercise_card: `Genera una tarjeta de ejercicio para pacientes. Tema: ${input.title}. Instrucciones claras paso a paso.`,
      worksheet: `Crea una hoja de trabajo imprimible para logopedia. Tema: ${input.title}. Espacios para completar.`,
      pictogram: `Crea un pictograma terapéutico simple para ${input.title}. Área: ${area}. Colores claros, formas simples.`,
      pictogram_sequence: `Crea una secuencia de pictogramas paso a paso para: ${input.title}. Área: ${area}.`,
      image: `Genera una imagen clínica sobre ${input.title}. Área: ${area}.`,
    };

    return prompts[type] || `Genera un material de logopedia: ${input.title}`;
  },

  async uploadImage(file: File, userId: string, consultorioId?: string): Promise<string> {
    const consultorio = consultorioId || 'default';
    const filePath = `${consultorio}/${userId}/${Date.now()}_${file.name}`;
    
    // Check if bucket exists first
    const { data: buckets } = await supabase.storage.listBuckets();
    const materialsBucket = buckets?.find(b => b.name === 'materials');
    
    if (!materialsBucket) {
      // Try to create the bucket
      const { error: createError } = await supabase.storage.createBucket('materials', { public: true });
      if (createError) {
        throw new Error(`El bucket "materials" no existe en Supabase Storage. Crealo manualmente en el Dashboard de Supabase → Storage → New Bucket con nombre "materials" y acceso público.`);
      }
    }

    const { data, error } = await supabase.storage
      .from('materials')
      .upload(filePath, file, { contentType: file.type });

    if (error) {
      if (error.message?.includes('bucket')) {
        throw new Error('Error con el bucket de Storage. Verificá que exista un bucket llamado "materials" con acceso público.');
      }
      throw error;
    }

    const { data: urlData } = supabase.storage
      .from('materials')
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  },

  async getAssetsForPatient(patientId: string): Promise<MaterialAsset[]> {
    const { data, error } = await supabase
      .from('material_assets')
      .select('*')
      .eq('metadata->>patient_id', patientId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async recordAnalyticsEvent(event: {
    material_id?: string;
    event_type: string;
    event_context?: string;
    guide_id?: string;
    user_id?: string;
    patient_id?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    const { error } = await supabase.from('material_analytics').insert([{
      material_id: event.material_id || null,
      event_type: event.event_type,
      event_context: event.event_context || 'system',
      guide_id: event.guide_id || null,
      user_id: event.user_id || null,
      patient_id: event.patient_id || null,
      metadata: event.metadata || {},
      created_at: new Date().toISOString(),
    }]);
    if (error) console.error('[MultimediaMaterial] Analytics error:', error);
  },

  async getMaterialAnalytics(materialId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('material_analytics')
      .select('*')
      .eq('material_id', materialId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },
};

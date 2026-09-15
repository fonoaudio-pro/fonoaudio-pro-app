export interface ClinicalTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'therapy' | 'social' | 'education' | 'emotions';
  prefix: string;
  suffix: string;
  exampleFields: string[];
  defaultParams?: {
    width?: number;
    height?: number;
  };
}

export const CLINICAL_TEMPLATES: ClinicalTemplate[] = [
  // ============================================
  // ESCENAS TERAPÉUTICAS
  // ============================================
  {
    id: 'therapy_session',
    name: 'Escena de Terapia',
    description: 'Sesión fonoaudiológica en consultorio colorido y acogedor',
    icon: '🏥',
    category: 'therapy',
    prefix: 'Professional clinical illustration of a speech therapy session in a bright, child-friendly therapy room. A friendly speech therapist working with a young child. Warm lighting, colorful educational posters on walls, therapy tools visible. Clean, modern, professional medical illustration style.',
    suffix: ', high quality, professional medical illustration, warm and inviting atmosphere, detailed background',
    exampleFields: ['Actividad de respiración con globos', 'niño de 5 años'],
    defaultParams: { width: 1024, height: 768 },
  },
  {
    id: 'therapy_tools',
    name: 'Herramientas Terapéuticas',
    description: 'Instrumentos y materiales de logopedia en contexto',
    icon: '🩺',
    category: 'therapy',
    prefix: 'Professional still life illustration of speech therapy tools arranged on a clean desk: mirrors, tongue depressors, whistles, straws, small mirrors, picture cards, timer. Bright, clinical yet warm setting. Clean medical illustration style.',
    suffix: ', detailed, professional, clean composition, bright lighting, educational medical material',
    exampleFields: ['Material para ejercicios de articulación', 'contexto clínico'],
    defaultParams: { width: 1024, height: 768 },
  },

  // ============================================
  // GUÍAS VISUALES PARA FAMILIA
  // ============================================
  {
    id: 'family_routine',
    name: 'Rutina Familiar',
    description: 'Rutina diaria ilustrada para padres y niños',
    icon: '👨‍👩‍👧',
    category: 'education',
    prefix: 'Warm, colorful illustration of a family daily routine for children. Happy family (parents and young child) performing a daily activity together at home. Bright, friendly cartoon-realistic style. Clean background, easy to understand composition. Educational material for parents.',
    suffix: ', warm colors, family-friendly, educational illustration, clear and simple composition, high quality',
    exampleFields: ['Rutina de juego interactivo', 'actividad de estimulación del lenguaje'],
    defaultParams: { width: 1024, height: 768 },
  },
  {
    id: 'home_activity',
    name: 'Actividad en Casa',
    description: 'Ejercicio terapéutico para realizar en el hogar',
    icon: '🏠',
    category: 'education',
    prefix: 'Illustrated guide showing a parent and child doing a speech therapy exercise at home. Living room setting, playful atmosphere. The parent is modeling a mouth movement while the child watches and imitates. Warm, encouraging, educational illustration style.',
    suffix: ', educational material, clear demonstration, warm home setting, high quality illustration, step-by-step feel',
    exampleFields: ['Ejercicio de imitación de sonidos', 'juego de palabras'],
    defaultParams: { width: 1024, height: 768 },
  },

  // ============================================
  // POST PARA REDES SOCIALES
  // ============================================
  {
    id: 'social_tip',
    name: 'Tip para Redes',
    description: 'Consejo profesional para Instagram/Facebook',
    icon: '📱',
    category: 'social',
    prefix: 'Modern, eye-catching social media post design for a speech therapy clinic. Bold, clean typography area at top. Professional yet warm color palette (teal, coral, white). Minimalist design with space for text overlay. Instagram-ready format.',
    suffix: ', modern design, professional social media graphic, clean layout, vibrant colors, high engagement style',
    exampleFields: ['5 señales de alerta en el lenguaje infantil', 'tip de comunicación'],
    defaultParams: { width: 1080, height: 1080 },
  },
  {
    id: 'social_awareness',
    name: 'Concientización',
    description: 'Publicación de concientización sobre salud auditiva',
    icon: '📢',
    category: 'social',
    prefix: 'Professional social media awareness post about speech therapy and hearing health. Modern graphic design with medical illustration elements. Clean, authoritative, yet approachable design. Space for text overlay at center.',
    suffix: ', professional health awareness design, modern medical graphic, clean composition, high quality social media',
    exampleFields: ['Día Mundial de la Audición', 'concientización sobre hipoacusia'],
    defaultParams: { width: 1080, height: 1080 },
  },

  // ============================================
  // INFOGRAFÍA EDUCATIVA
  // ============================================
  {
    id: 'infographic_education',
    name: 'Infografía Educativa',
    description: 'Contenido educativo con datos y secciones visuales',
    icon: '📊',
    category: 'education',
    prefix: 'Professional educational infographic layout about speech therapy. Clean, modern design with distinct sections for content. Medical illustration style with icons and visual hierarchy. Space for text, numbers, and bullet points. Light background, professional color scheme.',
    suffix: ', infographic design, clean layout, professional medical education material, visual hierarchy, high quality',
    exampleFields: ['Etapas del desarrollo del lenguaje', '5 ejercicios para la articulación'],
    defaultParams: { width: 1024, height: 1536 },
  },
  {
    id: 'infographic_diagram',
    name: 'Diagrama Anatómico',
    description: 'Anatomía del sistema auditivo o articulatorio',
    icon: '🔬',
    category: 'education',
    prefix: 'Professional medical diagram of the human speech mechanism or auditory system. Clean anatomical illustration with labeled areas visible. Educational medical illustration style, precise and detailed. Clinical white background with clear visual hierarchy.',
    suffix: ', medical illustration, anatomical diagram, educational, precise details, professional clinical style',
    exampleFields: ['Órganos articulatorios', 'sistema auditivo'],
    defaultParams: { width: 1024, height: 1024 },
  },

  // ============================================
  // FLASHCARD EMOCIONAL
  // ============================================
  {
    id: 'emotion_face',
    name: 'Cara de Emoción',
    description: 'Expresión facial clara para identificar emociones',
    icon: '😊',
    category: 'emotions',
    prefix: 'Expressive cartoon-style face showing a clear, distinct emotion. Large, expressive eyes, exaggerated but friendly facial expression. Simple, bold colors on clean background. Perfect for children\'s emotional recognition cards. Bright and approachable.',
    suffix: ', expressive, clear emotion, cartoon style for children, bold colors, simple background, high quality illustration',
    exampleFields: ['Alegría', 'tristeza, enojo, sorpresa'],
    defaultParams: { width: 768, height: 768 },
  },
  {
    id: 'emotion_scene',
    name: 'Escena Emocional',
    description: 'Personaje viviendo una emoción en contexto',
    icon: '🎭',
    category: 'emotions',
    prefix: 'Illustrated scene showing a child experiencing a specific emotion in a relatable situation. Child-friendly, warm illustration style. Clear emotional expression, relatable context (home, school, playground). Educational material for emotional development.',
    suffix: ', emotional recognition, child-friendly illustration, clear expression, relatable scenario, educational',
    exampleFields: ['Un niño que se siente frustrado con un rompecabezas', 'una niña contenta recibiendo un regalo'],
    defaultParams: { width: 1024, height: 768 },
  },
  {
    id: 'emotion_card',
    name: 'Tarjeta de Emoción',
    description: 'Tarjeta PECS-style con emoción y pictograma',
    icon: '🃏',
    category: 'emotions',
    prefix: 'Simple emotion flashcard design. Bold, clean illustration of a face showing one specific emotion. Large, clear features. Solid color background (blue for sadness, red for anger, yellow for happiness, green for calm). Minimalist, PECS-compatible style.',
    suffix: ', flashcard design, PECS compatible, simple, bold, clear emotion, minimal text, high contrast',
    exampleFields: ['Feliz', 'triste, enojado, asustado, tranquilo'],
    defaultParams: { width: 768, height: 768 },
  },
];

export const TEMPLATE_CATEGORIES = [
  { id: 'therapy' as const, label: 'Escenas Terapéuticas', icon: '🏥', color: 'blue' },
  { id: 'education' as const, label: 'Guías & Educación', icon: '📚', color: 'emerald' },
  { id: 'social' as const, label: 'Redes Sociales', icon: '📱', color: 'purple' },
  { id: 'emotions' as const, label: 'Emociones & Flashcards', icon: '😊', color: 'amber' },
];

export function buildPrompt(template: ClinicalTemplate, userFields: string[]): string {
  const fieldText = userFields.filter(f => f.trim()).join(', ');
  let prompt = template.prefix;
  if (fieldText) {
    prompt += ` Specifically showing: ${fieldText}.`;
  }
  prompt += template.suffix;
  return prompt;
}

export function getTemplatesByCategory(category: string): ClinicalTemplate[] {
  return CLINICAL_TEMPLATES.filter(t => t.category === category);
}

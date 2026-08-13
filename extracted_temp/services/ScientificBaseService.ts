import { NotebookLMResult, NotebookLMSource } from '../types/notebooklm';

const CURATED_SOURCES: NotebookLMSource[] = [
  {
    document_id: 'gpc_tdl_2024',
    title: 'Guía de Práctica Clínica: Trastorno del Desarrollo del Lenguaje',
    source: 'Ministerio de Salud Chile',
    axis: 'lenguaje',
    year: 2024,
    relevance: 0.95,
  },
  {
    document_id: 'gpc_voz_2023',
    title: 'Guía de Práctica Clínica: Trastornos de la Voz',
    source: 'Ministerio de Salud Chile',
    axis: 'voz',
    year: 2023,
    relevance: 0.9,
  },
  {
    document_id: 'gpc_motricidad_2024',
    title: 'Guía de Práctica Clínica: Rehabilitación de Motricidad Orofacial',
    source: 'Ministerio de Salud Chile',
    axis: 'motricidad',
    year: 2024,
    relevance: 0.88,
  },
  {
    document_id: 'rev_disfagia_2025',
    title: 'Revisión Sistemática: Intervención en Disfagia Pediátrica',
    source: 'PubMed / SciELO',
    axis: 'motricidad',
    year: 2025,
    relevance: 0.85,
  },
  {
    document_id: 'gpc_audicion_2024',
    title: 'Guía de Cribado Auditivo Neonatal',
    source: 'Ministerio de Salud Chile',
    axis: 'audicion',
    year: 2024,
    relevance: 0.92,
  },
  {
    document_id: 'protocolo_eval_lenguaje',
    title: 'Protocolo de Evaluación del Lenguaje en Edad Temprana',
    source: 'Sociedad Chilena de Fonoaudiología',
    axis: 'lenguaje',
    year: 2024,
    relevance: 0.87,
  },
];

const CURATED_EXCERPTS: Record<string, string[]> = {
  gpc_tdl_2024: [
    'La intervención en TDL debe iniciarse lo antes posible, preferentemente antes de los 4 años.',
    'El abordaje debe ser interdisciplinario, incluyendo fonoaudiólogo, psicólogo y pediatra.',
    'La evidencia nivel A respalda la intervención temprana basada en juego estructurado.',
  ],
  gpc_voz_2023: [
    'La higiene vocal es la base del tratamiento de disfonía funcional.',
    'La reeducación respiratoria-fonatoria muestra evidencia nivel B en adultos.',
    'En niños, la terapia indirecta mediante modelado vocal es el abordaje preferido.',
  ],
  gpc_motricidad_2024: [
    'La estimulación sensorial oral debe ser progresiva y respetar el tono muscular.',
    'Los ejercicios de fortalecimiento muscular muestran mejoría en 8-12 semanas.',
    'La evaluación motriz debe incluir observación funcional y no solo estructural.',
  ],
  rev_disfagia_2025: [
    'La displasia oromotora en prematuros requiere abordaje multimodal.',
    'La alimentación guiada por señales es superior a la intervención directa.',
    'Los resultados a largo plazo muestran mejoría sostenida con intervención temprana.',
  ],
  gpc_audicion_2024: [
    'El cribado auditivo neonatal debe realizarse antes del alta hospitalaria.',
    'La detección temprana de hipoacusia permite intervención antes de los 6 meses.',
    'El seguimiento audiológico es obligatorio para todos los neonatos con resultado referido.',
  ],
  protocolo_eval_lenguaje: [
    'La evaluación del lenguaje en menores de 3 años debe incluir observación naturalista.',
    'Los instrumentos validados en español son preferibles a escalas traducidas.',
    'La evaluación debe considerar el contexto sociocultural del niño.',
  ],
};

export class ScientificBaseService {
  static async query(query: string, axis?: string): Promise<NotebookLMResult[]> {
    const queryLower = query.toLowerCase();

    let candidates = CURATED_SOURCES;
    if (axis) {
      candidates = candidates.filter(s => s.axis === axis);
    }

    const scored = candidates.map(source => {
      let score = source.relevance;
      const titleLower = source.title.toLowerCase();
      if (queryLower.includes('lenguaje') && source.axis === 'lenguaje') score += 0.1;
      if (queryLower.includes('voz') && source.axis === 'voz') score += 0.1;
      if (queryLower.includes('motricidad') && source.axis === 'motricidad') score += 0.1;
      if (queryLower.includes('audición') && source.axis === 'audicion') score += 0.1;
      if (queryLower.includes('disfagia') && source.document_id.includes('disfagia')) score += 0.15;
      if (queryLower.includes('trastorno') && titleLower.includes('trastorno')) score += 0.1;
      if (queryLower.includes('evaluación') && titleLower.includes('evaluación')) score += 0.1;
      if (queryLower.includes('intervención') && titleLower.includes('práctica')) score += 0.05;
      return { source, score };
    });

    scored.sort((a, b) => b.score - a.score);

    return scored.slice(0, 3).map(({ source, score }) => ({
      document_id: source.document_id,
      title: source.title,
      source: source.source,
      excerpt: this.getExcerpt(source.document_id),
      relevance: Math.min(score, 1),
      axis: source.axis,
    }));
  }

  static getSourceList(): NotebookLMSource[] {
    return [...CURATED_SOURCES];
  }

  private static getExcerpt(documentId: string): string {
    const excerpts = CURATED_EXCERPTS[documentId];
    if (!excerpts || excerpts.length === 0) return 'Extracto no disponible.';
    return excerpts[Math.floor(Math.random() * excerpts.length)];
  }
}

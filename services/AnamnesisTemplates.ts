import { AdaptiveBranch, AnamnesisSectionDef, ClinicalAxis, AgeGroup } from '../types/clinical_history';
import { AGE_BRANCHES } from '../templates/adaptiveAnamnesisAge';
import { AREA_BRANCHES } from '../templates/adaptiveAnamnesisArea';

const MOTIVO_TO_AREAS: Record<string, ClinicalAxis[]> = {
  'no habla': ['lenguaje'],
  'habla poco': ['lenguaje'],
  'lenguaje': ['lenguaje'],
  'peech therapy': ['lenguaje'],
  'speech therapy': ['lenguaje'],
  'terapia del lenguaje': ['lenguaje'],
  'retraso del lenguaje': ['lenguaje'],
  'no camina': ['motricidad_orofacial'],
  'motricidad': ['motricidad_orofacial'],
  'orofacial': ['motricidad_orofacial'],
  'ronquera': ['voz'],
  'voz': ['voz'],
  'disfonia': ['voz'],
  'no escucha': ['audicion'],
  'auditivo': ['audicion'],
  'audicion': ['audicion'],
  'sordera': ['audicion'],
  'no come': ['deglucion'],
  'atraganta': ['deglucion'],
  'deglucion': ['deglucion'],
  'alimentacion': ['deglucion'],
  'cognicion': ['cognicion'],
  'memoria': ['cognicion'],
  'atencion': ['cognicion'],
  'aprendizaje': ['lenguaje', 'cognicion'],
  'lectura': ['lenguaje'],
  'escritura': ['lenguaje'],
  'neurodesarrollo': ['lenguaje', 'motricidad_orofacial', 'cognicion'],
  'desarrollo': ['lenguaje', 'motricidad_orofacial'],
  'tea': ['lenguaje', 'motricidad_orofacial'],
  'autismo': ['lenguaje', 'motricidad_orofacial'],
};

function dedupeSections(sections: AnamnesisSectionDef[]): AnamnesisSectionDef[] {
  const seen = new Set<string>();
  return sections.filter(s => {
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });
}

export function getAdaptiveTemplate(
  ageGroup: AgeGroup,
  affectedAreas: ClinicalAxis[]
): { sections: AnamnesisSectionDef[] } {
  const ageBranch = AGE_BRANCHES.find(b =>
    b.conditions.ageGroup?.includes(ageGroup)
  );

  const areaBranches = AREA_BRANCHES.filter(b =>
    b.conditions.affectedAreas?.some(a => affectedAreas.includes(a as ClinicalAxis))
  );

  const allSections: AnamnesisSectionDef[] = [];

  if (ageBranch) {
    allSections.push(...ageBranch.sections);
  }

  for (const branch of areaBranches) {
    allSections.push(...branch.sections);
  }

  return { sections: dedupeSections(allSections) };
}

export function getAffectedAreasFromMotivo(motivoConsulta: string): ClinicalAxis[] {
  if (!motivoConsulta) return [];

  const lower = motivoConsulta.toLowerCase();
  const matched = new Set<ClinicalAxis>();

  for (const [keyword, areas] of Object.entries(MOTIVO_TO_AREAS)) {
    if (lower.includes(keyword)) {
      areas.forEach(a => matched.add(a));
    }
  }

  return Array.from(matched);
}

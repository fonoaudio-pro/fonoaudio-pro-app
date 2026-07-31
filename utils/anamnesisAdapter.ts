import { AdaptiveAnamnesisResponse, ClinicalAxis } from '../types/clinical_history';
import { AnamnesisSections } from '../types/clinical';
import { getAdaptiveTemplate } from '../services/AnamnesisTemplates';

/**
 * Converts an AdaptiveAnamnesisResponse to the standard AnamnesisSections format
 * so it can be saved to the `patient_anamnesis` table via AnamnesisService.
 */
export function adaptResponseToSections(
  response: AdaptiveAnamnesisResponse
): AnamnesisSections {
  const { sections } = getAdaptiveTemplate(
    response.metadata.ageGroup,
    response.affectedAreas
  );

  const result: AnamnesisSections = {};

  for (const section of sections) {
    const sectionAnswers: Record<string, string | boolean | number> = {};
    for (const field of section.fields) {
      if (response.answers[field.id] !== undefined) {
        sectionAnswers[field.id] = response.answers[field.id];
      }
    }
    if (Object.keys(sectionAnswers).length > 0) {
      result[section.id] = sectionAnswers;
    }
  }

  return result;
}

/**
 * Converts an AdaptiveAnamnesisResponse to the legacy patients.anamnesis jsonb format.
 * This maintains compatibility with code that reads from patients.anamnesis.sections.*
 */
export function adaptResponseToLegacyJson(
  response: AdaptiveAnamnesisResponse
): Record<string, any> {
  const answers = response.answers;

  const motivoConsulta = answers['motivo_principal']
    || answers['motivo_consulta']
    || response.metadata.motivoConsulta
    || '';

  const personalHistory = [
    answers['antecedentes_personales'],
    answers['historia_medica'],
    answers['medicaciones'],
    answers['alergias'],
    answers['cirugias_previas'],
  ].filter(Boolean).join('\n');

  const familyHistory = [
    answers['antecedentes_familiares'],
    answers['enfermedades_familia'],
    answers['historia_lenguaje_familiar'],
    answers['historia_auditiva_familiar'],
  ].filter(Boolean).join('\n');

  const medicalHistory = [
    answers['historia_neurologica'],
    answers['historia_otologica'],
    answers['historia_pediátrica'],
    answers['condiciones_cronicas'],
  ].filter(Boolean).join('\n');

  const educationHistory = [
    answers['desarrollo_escolar'],
    answers['nivel_escolaridad'],
    answers['actividades_extracurriculares'],
  ].filter(Boolean).join('\n');

  return {
    sections: {
      reasonForConsultation: motivoConsulta,
      personalHistory: personalHistory || undefined,
      familyHistory: familyHistory || undefined,
      medicalHistory: medicalHistory || undefined,
      educationHistory: educationHistory || undefined,
    },
    affectedAreas: response.affectedAreas,
    ageGroup: response.metadata.ageGroup,
    completedAt: response.metadata.completedAt,
    templateId: response.templateId,
  };
}

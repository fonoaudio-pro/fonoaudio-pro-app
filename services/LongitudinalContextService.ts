import {
  ClinicalEvolutionEntry,
  ClinicalAxis,
  AxisSnapshot,
  CLINICAL_AXES
} from '../types/clinical_history';
import { ClinicalEvolutionService } from './ClinicalEvolutionService';
import { supabase } from '../utils/supabaseClient';

export interface PatientContext {
  patientId: string;
  patientName: string;
  ageGroup: string;
  motivoConsulta: string;
  latestAnamnesis?: Record<string, any>;
  axisSnapshots: Record<ClinicalAxis, AxisSnapshot>;
  recentEvolution: ClinicalEvolutionEntry[];
  summary: string;
}

interface AnamnesisRecord {
  id: string;
  patient_id: string;
  answers: Record<string, any>;
  age_group: string;
  motivo_consulta: string;
  created_at: string;
}

export class LongitudinalContextService {
  static async getPatientContext(
    patientId: string,
    patientName: string,
    birthDate: string,
    motivoConsulta: string
  ): Promise<PatientContext> {
    const { getAgeGroup } = await import('../types/clinical_history');
    const ageGroup = getAgeGroup(birthDate);

    const [axisSnapshots, recentEvolution, latestAnamnesis] = await Promise.all([
      ClinicalEvolutionService.getPatientSnapshotSummary(patientId),
      ClinicalEvolutionService.getEvolutionEntries(patientId, 10),
      this.getLatestAnamnesis(patientId)
    ]);

    const summary = this.generateSummary(
      ageGroup,
      motivoConsulta,
      axisSnapshots,
      recentEvolution,
      latestAnamnesis
    );

    return {
      patientId,
      patientName,
      ageGroup,
      motivoConsulta,
      latestAnamnesis: latestAnamnesis?.answers,
      axisSnapshots,
      recentEvolution,
      summary
    };
  }

  static buildSystemPromptContext(context: PatientContext): string {
    const parts: string[] = [];

    parts.push(`PACIENTE: ${context.patientName}`);
    parts.push(`Grupo etario: ${context.ageGroup}`);
    parts.push(`Motivo de consulta: ${context.motivoConsulta}`);

    if (context.latestAnamnesis) {
      const relevantAnswers = Object.entries(context.latestAnamnesis)
        .filter(([_, value]) => value !== undefined && value !== null && value !== '')
        .slice(0, 10);
      
      if (relevantAnswers.length > 0) {
        parts.push('\nANAMNESIS RELEVANTE:');
        relevantAnswers.forEach(([key, value]) => {
          parts.push(`- ${key}: ${value}`);
        });
      }
    }

    const activeAxes = CLINICAL_AXES.filter(
      axis => context.axisSnapshots[axis]?.currentRisk !== 'normal'
    );

    if (activeAxes.length > 0) {
      parts.push('\nEJES CON ALTERACIONES:');
      activeAxes.forEach(axis => {
        const snapshot = context.axisSnapshots[axis];
        parts.push(`- ${axis}: riesgo ${snapshot.currentRisk}, tendencia ${snapshot.trend}`);
        if (snapshot.keyFindings.length > 0) {
          parts.push(`  Hallazgos: ${snapshot.keyFindings.slice(0, 3).join(', ')}`);
        }
      });
    }

    if (context.recentEvolution.length > 0) {
      parts.push('\nEVOLUCIÓN RECIENTE:');
      context.recentEvolution.slice(0, 3).forEach(entry => {
        const date = new Date(entry.date).toLocaleDateString('es-CL');
        parts.push(`- ${date}: ${entry.axis} - ${entry.riskLevel} (${entry.source})`);
      });
    }

    parts.push('\nINSTRUCCIONES:');
    parts.push('- Usa esta información para entender el contexto longitudinal del paciente');
    parts.push('- No improvises diagnósticos; respeta la información curada');
    parts.push('- Si necesitas más detalles, solicita la información específica');
    parts.push('- Mantén confirmación para acciones sensibles');

    return parts.join('\n');
  }

  static formatContextForDisplay(context: PatientContext): string {
    const lines: string[] = [];

    lines.push(`Paciente: ${context.patientName}`);
    lines.push(`Edad: ${context.ageGroup}`);
    lines.push(`Motivo: ${context.motivoConsulta}`);

    const alteredAxes = CLINICAL_AXES.filter(
      axis => context.axisSnapshots[axis]?.currentRisk !== 'normal'
    );

    if (alteredAxes.length > 0) {
      lines.push('\nEjes alterados:');
      alteredAxes.forEach(axis => {
        const snapshot = context.axisSnapshots[axis];
        lines.push(`• ${ClinicalEvolutionService.getAxisLabel(axis)}: ${snapshot.currentRisk} (${snapshot.trend})`);
      });
    }

    if (context.recentEvolution.length > 0) {
      lines.push('\nÚltima evolución:');
      context.recentEvolution.slice(0, 2).forEach(entry => {
        const date = new Date(entry.date).toLocaleDateString('es-CL');
        lines.push(`• ${date}: ${ClinicalEvolutionService.getAxisLabel(entry.axis)} - ${entry.riskLevel}`);
      });
    }

    return lines.join('\n');
  }

  private static async getLatestAnamnesis(
    patientId: string
  ): Promise<AnamnesisRecord | null> {
    try {
      const { data, error } = await supabase
        .from('patient_anamnesis')
        .select('*')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error || !data) return null;

      return {
        id: data.id,
        patient_id: data.patient_id,
        answers: data.answers || {},
        age_group: data.age_group || '',
        motivo_consulta: data.motivo_consulta || '',
        created_at: data.created_at
      };
    } catch {
      return null;
    }
  }

  private static generateSummary(
    ageGroup: string,
    motivoConsulta: string,
    axisSnapshots: Record<ClinicalAxis, AxisSnapshot>,
    recentEvolution: ClinicalEvolutionEntry[],
    latestAnamnesis: AnamnesisRecord | null
  ): string {
    const parts: string[] = [];

    parts.push(`Paciente en grupo ${ageGroup}.`);
    parts.push(`Consulta por: ${motivoConsulta}.`);

    const alteredAxes = CLINICAL_AXES.filter(
      axis => axisSnapshots[axis]?.currentRisk !== 'normal'
    );

    if (alteredAxes.length > 0) {
      parts.push(`Ejes con alteraciones: ${alteredAxes.map(axis => 
        `${axis} (${axisSnapshots[axis].currentRisk})`
      ).join(', ')}.`);
    } else {
      parts.push('Sin alteraciones significativas en ejes clínicos.');
    }

    if (recentEvolution.length > 0) {
      const latest = recentEvolution[0];
      parts.push(`Última evaluación: ${latest.axis} - ${latest.riskLevel} el ${new Date(latest.date).toLocaleDateString('es-CL')}.`);
    }

    return parts.join(' ');
  }
}

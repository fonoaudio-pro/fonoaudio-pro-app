import {
  ClinicalAlert,
  AlertCategory,
  AlertSeverity,
  AlertSource,
  AlertDisposition
} from '../types/clinical_alert';
import { ClinicalAxis } from '../types/clinical_history';
import { RedFlagRulesService, RedFlagMatch } from './RedFlagRules';

interface AnamnesisAlertInput {
  patientId: string;
  patientName?: string;
  answers: Record<string, any>;
  affectedAreas: ClinicalAxis[];
  ageGroup: string;
  motivoConsulta: string;
}

interface GeneratedAlert {
  id: string;
  patientId: string;
  patientName?: string;
  category: AlertCategory;
  severity: AlertSeverity;
  source: AlertSource;
  title: string;
  description: string;
  suggestedAction?: string;
  immediateAction?: string;
  evidence: string;
  confidence: number;
  disposition: AlertDisposition;
  createdAt: string;
  metadata: {
    ruleId?: string;
    fieldId?: string;
    axis?: ClinicalAxis;
    ageGroup?: string;
    motivoConsulta?: string;
    answers?: Record<string, any>;
  };
}

export class AnamnesisAlertService {
  static generateAlerts(input: AnamnesisAlertInput): GeneratedAlert[] {
    const alerts: GeneratedAlert[] = [];
    const timestamp = new Date().toISOString();

    const redFlagMatches = RedFlagRulesService.evaluateAnswers(
      input.answers,
      input.affectedAreas
    );

    for (const match of redFlagMatches) {
      alerts.push(this.createRedFlagAlert(match, input, timestamp));
    }

    const followUpAlerts = this.detectFollowUpNeeds(input, timestamp);
    alerts.push(...followUpAlerts);

    const suggestionAlerts = this.detectSuggestions(input, timestamp);
    alerts.push(...suggestionAlerts);

    return alerts;
  }

  static generateAlertId(prefix: string, ruleId: string, patientId: string): string {
    const hash = this.simpleHash(`${ruleId}-${patientId}`);
    return `${prefix}-${hash}-${Date.now()}`;
  }

  private static createRedFlagAlert(
    match: RedFlagMatch,
    input: AnamnesisAlertInput,
    timestamp: string
  ): GeneratedAlert {
    return {
      id: this.generateAlertId('redflag', match.ruleId, input.patientId),
      patientId: input.patientId,
      patientName: input.patientName,
      category: 'red_flag',
      severity: match.severity,
      source: 'anamnesis',
      title: match.title,
      description: match.description,
      suggestedAction: match.suggestedAction,
      immediateAction: match.severity === 'critical' ? match.suggestedAction : undefined,
      evidence: match.evidence,
      confidence: 1.0,
      disposition: 'pending',
      createdAt: timestamp,
      metadata: {
        ruleId: match.ruleId,
        fieldId: match.fieldId,
        axis: match.axis,
        ageGroup: input.ageGroup,
        motivoConsulta: input.motivoConsulta,
        answers: { [match.fieldId]: match.fieldValue }
      }
    };
  }

  private static detectFollowUpNeeds(
    input: AnamnesisAlertInput,
    timestamp: string
  ): GeneratedAlert[] {
    const alerts: GeneratedAlert[] = [];

    // Check which red flags already fired to avoid duplication
    const redFlagFields = new Set(
      RedFlagRulesService.evaluateAnswers(input.answers, input.affectedAreas)
        .map(m => m.fieldId)
    );

    if (input.affectedAreas.includes('lenguaje')) {
      const oraciones = input.answers['oraciones'];
      // Skip "No habla" — already handled by preescolar_no_habla red_flag
      if (oraciones && oraciones !== 'Frases complejas' && oraciones !== 'No habla') {
        alerts.push({
          id: this.generateAlertId('followup', 'lenguaje_seguimiento', input.patientId),
          patientId: input.patientId,
          patientName: input.patientName,
          category: 'follow_up',
          severity: 'medium',
          source: 'anamnesis',
          title: 'Seguimiento de lenguaje expresivo requerido',
          description: `El nivel de lenguaje expresivo (${oraciones}) requiere seguimiento periódico.`,
          suggestedAction: 'Programar evaluación de lenguaje en 1 mes para reevaluar progreso.',
          evidence: `Nivel de lenguaje: ${oraciones}`,
          confidence: 0.9,
          disposition: 'pending',
          createdAt: timestamp,
          metadata: {
            fieldId: 'oraciones',
            axis: 'lenguaje',
            ageGroup: input.ageGroup,
            motivoConsulta: input.motivoConsulta
          }
        });
      }
    }

    if (input.affectedAreas.includes('deglucion')) {
      const atragantamientos = input.answers['atragantamientos'];
      const frecuencia = input.answers['frecuencia_atragantamientos'];
      // Skip if red_flag already fired for frecuencia (Diario/Semanal)
      const hasRedFlagForFrecuencia = redFlagFields.has('frecuencia_atragantamientos');
      if (atragantamientos === true && !hasRedFlagForFrecuencia) {
        alerts.push({
          id: this.generateAlertId('followup', 'deglucion_seguimiento', input.patientId),
          patientId: input.patientId,
          patientName: input.patientName,
          category: 'follow_up',
          severity: 'high',
          source: 'anamnesis',
          title: 'Seguimiento de deglución requerido',
          description: 'Se reportan episodios de atragantamiento que requieren evaluación.',
          suggestedAction: 'Evaluación fonoaudiológica de deglución con video fluoroscopia o FEES.',
          evidence: 'Atragantamientos: presentes',
          confidence: 0.95,
          disposition: 'pending',
          createdAt: timestamp,
          metadata: {
            fieldId: 'atragantamientos',
            axis: 'deglucion',
            ageGroup: input.ageGroup
          }
        });
      }
    }

    // Cribado auditivo: RedFlagRules already handles this as red_flag — no follow_up needed

    return alerts;
  }

  private static detectSuggestions(
    input: AnamnesisAlertInput,
    timestamp: string
  ): GeneratedAlert[] {
    const alerts: GeneratedAlert[] = [];

    if (input.affectedAreas.includes('lenguaje')) {
      const socializacion = input.answers['socializacion'];
      if (socializacion && socializacion !== 'Normal') {
        alerts.push({
          id: this.generateAlertId('suggestion', 'socializacion_sugerencia', input.patientId),
          patientId: input.patientId,
          patientName: input.patientName,
          category: 'suggestion',
          severity: 'medium',
          source: 'anamnesis',
          title: 'Socialización reducida detectada',
          description: `La socialización con pares está ${socializacion}. Considerar intervención en habilidades sociales.`,
          suggestedAction: 'Incluir objetivos de habilidades sociales en el plan de intervención.',
          evidence: `Socialización: ${socializacion}`,
          confidence: 0.8,
          disposition: 'pending',
          createdAt: timestamp,
          metadata: {
            fieldId: 'socializacion',
            axis: 'lenguaje',
            ageGroup: input.ageGroup
          }
        });
      }
    }

    if (input.affectedAreas.includes('motricidad_orofacial')) {
      const tono = input.answers['tono_muscular'];
      if (tono && (tono.includes('Hipotonía') || tono.includes('Hipertonía'))) {
        alerts.push({
          id: this.generateAlertId('suggestion', 'tono_muscular_sugerencia', input.patientId),
          patientId: input.patientId,
          patientName: input.patientName,
          category: 'suggestion',
          severity: 'medium',
          source: 'anamnesis',
          title: 'Tono muscular orofacial alterado',
          description: `Se detecta ${tono}. Esto puede afectar la articulación y la alimentación.`,
          suggestedAction: 'Evaluación de motricidad orofacial y considerar ejercicios de tonificación.',
          evidence: `Tono muscular: ${tono}`,
          confidence: 0.85,
          disposition: 'pending',
          createdAt: timestamp,
          metadata: {
            fieldId: 'tono_muscular',
            axis: 'motricidad_orofacial',
            ageGroup: input.ageGroup
          }
        });
      }
    }

    return alerts;
  }

  private static simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }
}

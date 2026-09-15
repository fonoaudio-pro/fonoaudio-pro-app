import { VoiceSign } from '../types';

interface AudienceMapping {
  professional: {
    title: string;
    reasoning: string;
    action: string;
  };
  family: {
    title: string;
    reasoning: string;
    action: string;
  };
}

export const VOICE_MAPPING: Record<VoiceSign, AudienceMapping> = {
  'disfonia_persistente': {
    professional: {
      title: 'Disfonía Persistente',
      reasoning: 'Alteración del timbre vocal que se mantiene en el tiempo, sugerente de lesión orgánica.',
      action: 'Valorar laringoscopía.'
    },
    family: {
      title: 'Cambio de voz duradero',
      reasoning: 'Hemos notado que la voz ha estado ronca o diferente por varias semanas.',
      action: 'Siga la indicación del profesional sobre la necesidad de una revisión médica especializada.'
    }
  },
  'estridor': {
    professional: {
      title: 'Estridor Laríngeo',
      reasoning: 'Ruido inspiratorio audible indicativo de obstrucción de la vía aérea superior.',
      action: 'Derivación inmediata a urgencias ORL.'
    },
    family: {
      title: 'Ruido al respirar',
      reasoning: 'Se escucha un sonido fuerte o silbido al tomar aire.',
      action: 'SOPORTE VITAL: Busque atención médica de urgencia inmediatamente.'
    }
  },
  'fatiga_vocal': {
    professional: {
      title: 'Astenia Vocal',
      reasoning: 'Sensación de cansancio al hablar, sugerente de ineficiencia glótica.',
      action: 'Implementar terapia de higiene vocal.'
    },
    family: {
      title: 'Cansancio al hablar',
      reasoning: 'El paciente siente que la voz se "agota" o pierde fuerza rápidamente.',
      action: 'Si el profesional lo indica, implemente periodos de reposo vocal.'
    }
  },
  'esfuerzo_fonatorio': {
    professional: {
      title: 'Hiperfunción Vocal',
      reasoning: 'Uso excesivo de musculatura suprahiodea para la producción del sonido.',
      action: 'Técnicas de relajación y resonancia.'
    },
    family: {
      title: 'Esfuerzo al hablar',
      reasoning: 'Se observa tensión en el cuello o esfuerzo evidente al intentar emitir la voz.',
      action: 'Siga las pautas del terapeuta para hablar sin tensión.'
    }
  },
  'perdida_peso': {
    professional: {
      title: 'Pérdida de Peso Inexplicable',
      reasoning: 'Signo sistémico que, asociado a cambios vocales, aumenta la sospecha de malignidad.',
      action: 'Evaluación sistémica urgente.'
    },
    family: {
      title: 'Baja de peso',
      reasoning: 'Se ha observado una pérdida de peso sin causa aparente.',
      action: 'Informar al médico tratante.'
    }
  },
  'hemoptisis': {
    professional: {
      title: 'Hemoptisis',
      reasoning: 'Expulsión de sangre por las vías respiratorias, signo crítico de alerta.',
      action: 'Intervención inmediata por ORL/Neumología.'
    },
    family: {
      title: 'Sangre en la tos',
      reasoning: 'Se ha detectado presencia de sangre al toser.',
      action: 'Acudir a urgencias inmediatamente.'
    }
  },
  'masa_cuello': {
    professional: {
      title: 'Masa Cervical',
      reasoning: 'Presencia de adenopatías o masas palpables en el cuello.',
      action: 'Realizar ecografía y biopsia si es necesario.'
    },
    family: {
      title: 'Bulto en el cuello',
      reasoning: 'Se palpa una masa o bulto en la zona del cuello.',
      action: 'Consultar con el especialista para valoración.'
    }
  },
  'cambio_voz_repentino': {
    professional: {
      title: 'Cambio Vocal Brusco',
      reasoning: 'Alteración súbita de la calidad vocal sin antecedente de trauma o infección.',
      action: 'Valorar parálisis cordal o lesión aguda.'
    },
    family: {
      title: 'Cambio repentino de la voz',
      reasoning: 'La voz cambió de forma muy rápida y sin motivo aparente.',
      action: 'Solicitar revisión especializada.'
    }
  },
  'disfagia': {
    professional: {
      title: 'Disfagia Asociada',
      reasoning: 'Dificultad para deglutir que puede indicar compromiso extrínseco de la laringe.',
      action: 'Evaluación coordinada con el equipo de deglución.'
    },
    family: {
      title: 'Dificultad para tragar',
      reasoning: 'El paciente refiere molestias o dificultad al pasar alimentos o líquidos.',
      action: 'Seguir las pautas de alimentación segura.'
    }
  }
};

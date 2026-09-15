import { SwallowingSign } from '../types';

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

export const SWALLOWING_MAPPING: Record<SwallowingSign, AudienceMapping> = {
  'tos_post_ingesta': {
    professional: {
      title: 'Tos post-deglutoria',
      reasoning: 'Presencia de tos inmediatamente después de la ingesta, sugerente de aspiración.',
      action: 'Evaluar consistencias y realizar test de deglución.'
    },
    family: {
      title: 'Tose al tragar',
      reasoning: 'Hemos notado que el paciente tose justo después de pasar la comida o bebida.',
      action: 'Siga la indicación de su profesional sobre la consistencia de los alimentos; observe si ocurre más con agua que con espesos.'
    }
  },
  'voz_humeda': {
    professional: {
      title: 'Voz húmeda (Gurgling)',
      reasoning: 'Cambio en la calidad vocal post-ingesta, indicativo de residuo en el vestíbulo laríngeo.',
      action: 'Evaluar control glótico y maniobras de protección.'
    },
    family: {
      title: 'Voz "con burbujas"',
      reasoning: 'La voz suena húmeda o con burbujas justo después de beber.',
      action: 'Anotar en qué momento ocurre para comentarlo con el especialista y seguir sus instrucciones.'
    }
  },
  'deglucion_lenta': {
    professional: {
      title: 'Deglución prolongada',
      reasoning: 'Aumento del tiempo de tránsito orofaríngeo.',
      action: 'Evaluar propulsión lingual y fuerza faríngea.'
    },
    family: {
      title: 'Tarda en tragar',
      reasoning: 'Se observa que el paciente demora más tiempo de lo habitual en pasar el alimento.',
      action: 'Si el profesional lo indica, asegure que termine cada bocado antes de ofrecer el siguiente.'
    }
  },
  'residuo_oral': {
    professional: {
      title: 'Estasis oral',
      reasoning: 'Presencia de bolo alimenticio en cavidad oral post-deglución.',
      action: 'Implementar técnicas de limpieza orofaríngea.'
    },
    family: {
      title: 'Queda comida en la boca',
      reasoning: 'Se observan restos de comida en las mejillas o lengua después de tragar.',
      action: 'Siguiendo la guía del profesional, ayude a limpiar la boca suavemente entre bocados.'
    }
  },
  'carraspeo_repetido': {
    professional: {
      title: 'Aclaramiento laríngeo repetitivo',
      reasoning: 'Intentos frecuentes de limpiar la vía aérea superior.',
      action: 'Evaluar presencia de moco o residuo faríngeo.'
    },
    family: {
      title: 'Se aclara la garganta seguido',
      reasoning: 'El paciente siente la necesidad de carraspear constantemente.',
      action: 'Consulte con su terapeuta si es recomendable ofrecer pequeños sorbos de agua para hidratar la zona.'
    }
  },
  'distress_respiratorio': {
    professional: {
      title: 'Compromiso respiratorio agudo',
      reasoning: 'Signos de hipoxia o distress respiratorio severo durante la alimentación.',
      action: 'Cese inmediato de ingesta y soporte ventilatorio si es necesario.'
    },
    family: {
      title: 'Dificultad grave para respirar',
      reasoning: 'El paciente lucha por respirar o cambia de color al comer.',
      action: 'SOPORTE VITAL: Detenga la comida inmediatamente y pida ayuda médica.'
    }
  }
};

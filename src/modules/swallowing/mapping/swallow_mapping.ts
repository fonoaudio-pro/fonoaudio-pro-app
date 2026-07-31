import { Sw swallowingSign } from '../types';

export const SWALLOWING_MAPPING: Record<Sw swallowingSign, any> = {
  'tos': {
    professional: {
      title: 'Alerta de Tos',
      reasoning: 'Se detectó tos durante la ingesta, lo que puede indicar aspiración.',
      action: 'Evaluar consistencias y realizar test de deglución.'
    },
    family: {
      title: 'Observación al comer',
      reasoning: 'Hemos notado que el paciente tose al comer.',
      action: 'Prueba con alimentos más espesos y observa si mejora.'
    }
  },
  'disfagia': {
    professional: {
      title: 'Dificultad en deglución',
      reasoning: 'El paciente manifiesta dificultad para tragar.',
      action: 'Evaluar motricidad orofaríngea.'
    },
    family: {
      title: 'Dificultad para tragar',
      reasoning: 'El paciente menciona que le cuesta tragar.',
      action: 'Consulta con el equipo para ajustar texturas.'
    }
  },
  'cambio_voz_humeda': {
    professional: {
      title: 'Voz húmeda',
      reasoning: 'Presencia de voz con características de humedad post-deglución.',
      action: 'Evaluar control glótico.'
    },
    family: {
      title: 'Voz con cambios',
      reasoning: 'Se nota un cambio en el sonido de su voz al hablar.',
      action: 'Observar si hay cambios después de beber líquidos.'
    }
  },
  'regurgitacion': {
    professional: {
      title: 'Regurgitación',
      reasoning: 'Presencia de material en la zona orofaríngea.',
      action: 'Evaluar maniobras de protección.'
    },
    family: {
      title: 'Regurgitación',
      reasoning: 'Se observa que la comida regresa a la boca.',
      action: 'Vigilar la postura durante la alimentación.'
    }
  },
  'sensacion_obstruccion': {
    professional: {
      title: 'Sensación de obstrucción',
      reasoning: 'El paciente reporta sensación de cuerpo extraño.',
      action: 'Evaluar tránsito esofágico/faríngeo.'
    },
    family: {
      title: 'Sensación de algo trabado',
      reasoning: 'El paciente siente que la comida se queda atrapada.',
      action: 'Brindar apoyo con líquidos o cambios de textura.'
    }
  }
};

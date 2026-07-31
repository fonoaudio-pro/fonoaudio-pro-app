import { LanguageSign } from '../types';

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

export const LANGUAGE_MAPPING: Record<LanguageSign, AudienceMapping> = {
  'vocabulario_reducido': {
    professional: {
      title: 'Reducción del Léxico',
      reasoning: 'Limitación en la disponibilidad de palabras durante la expresión oral.',
      action: 'Terapia de expansión léxica.'
    },
    family: {
      title: 'Dificultad para encontrar palabras',
      reasoning: 'Hemos notado que el paciente usa menos palabras de las habituales o palabras muy simples.',
      action: 'Fomentar la comunicación sin presionar la respuesta.'
    }
  },
  'errores_sustitucion': {
    professional: {
      title: 'Sustituciones Semánticas/Fonémicas',
      reasoning: 'Sustitución de una palabra por otra similar en significado o sonido.',
      action: 'Análisis de patrones de error.'
    },
    family: {
      title: 'Confusión de palabras',
      reasoning: 'A veces el paciente dice una palabra por otra (ej. "mesa" por "silla").',
      action: 'Ayudar suavemente a encontrar la palabra correcta.'
    }
  },
  'agramatismo': {
    professional: {
      title: 'Agramatismo',
      reasoning: 'Omisión de elementos gramaticales básicos (artículos, preposiciones), lenguaje telegráfico.',
      action: 'Terapia de estructuración sintáctica.'
    },
    family: {
      title: 'Habla simplificada',
      reasoning: 'El paciente habla de forma muy resumida, omitiendo palabras que conectan las ideas.',
      action: 'Usar frases cortas y claras al hablar con él.'
    }
  },
  'anomia': {
    professional: {
      title: 'Anomia',
      reasoning: 'Incapacidad para evocar el nombre de objetos o personas.',
      action: 'Terapia de denominación.'
    },
    family: {
      title: 'Olvido de nombres',
      reasoning: 'El paciente sabe qué es el objeto pero no recuerda cómo se llama.',
      action: 'Dar pistas sobre la utilidad del objeto.'
    }
  },
  'parafasias': {
    professional: {
      title: 'Parafasias',
      reasoning: 'Producción de palabras incorrectas o sonidos distorsionados.',
      action: 'Evaluación de control fonológico.'
    },
    family: {
      title: 'Palabras distorsionadas',
      reasoning: 'El paciente dice palabras que no existen o que suenan parecido a la correcta.',
      action: 'Mantener la calma y pedir que lo intente de nuevo.'
    }
  },
  'disfluencia': {
    professional: {
      title: 'Disfluencia Verbal',
      reasoning: 'Interrupciones en el flujo del habla (bloqueos, repeticiones).',
      action: 'Terapia de fluidez.'
    },
    family: {
      title: 'Habla entrecortada',
      reasoning: 'El habla no fluye con naturalidad, con pausas o repeticiones frecuentes.',
      action: 'Darle tiempo suficiente para terminar sus frases.'
    }
  },
  'dificultad_comprension': {
    professional: {
      title: 'Déficit de Comprensión',
      reasoning: 'Incapacidad para procesar el significado del lenguaje hablado o escrito.',
      action: 'Evaluación de comprensión auditiva.'
    },
    family: {
      title: 'Dificultad para entender',
      reasoning: 'El paciente parece no comprender las instrucciones o lo que se le dice.',
      action: 'Usar apoyos visuales y gestos para ayudar la comprensión.'
    }
  }
};

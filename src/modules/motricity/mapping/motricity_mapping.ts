import { MotricitySign } from '../types';

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

export const MOTRICITY_MAPPING: Record<MotricitySign, AudienceMapping> = {
  'hipotonia_lingual': {
    professional: {
      title: 'Hipotonia Lingual',
      reasoning: 'Reducción del tono muscular de la lengua, limitando la precisión motora.',
      action: 'Implementar ejercicios de fortalecimiento lingual.'
    },
    family: {
      title: 'Tono lingual bajo',
      reasoning: 'La lengua se siente más débil o flácida de lo habitual.',
      action: 'Realizar los ejercicios de lengua indicados por el terapeuta.'
    }
  },
  'hipotonia_labial': {
    professional: {
      title: 'Hipotonia Labial',
      reasoning: 'Bajo tono muscular en el complejo orbicular de los labios.',
      action: 'Terapia de cierre labial y fortalecimiento.'
    },
    family: {
      title: 'Labios débiles',
      reasoning: 'Se observa dificultad para mantener los labios cerrados naturalmente.',
      action: 'Siga las pautas para mejorar el sellado labial.'
    }
  },
  'respiracion_bucal': {
    professional: {
      title: 'Respiración Bucal',
      reasoning: 'Patrón respiratorio predominantemente oral, sugestivo de obstrucción nasal o hábito.',
      action: 'Derivación a ORL para evaluación nasal.'
    },
    family: {
      title: 'Respiración por la boca',
      reasoning: 'El paciente tiende a respirar por la boca en lugar de por la nariz.',
      action: 'Consultar con el especialista sobre la causa de la respiración bucal.'
    }
  },
  'interposicion_lingual': {
    professional: {
      title: 'Interposición Lingual',
      reasoning: 'Posicionamiento anterior de la lengua contra los dientes durante la deglución o reposo.',
      action: 'Terapia de reposicionamiento lingual.'
    },
    family: {
      title: 'Lengua adelantada',
      reasoning: 'La lengua empuja los dientes o se coloca delante de ellos al tragar.',
      action: 'Ayudar al paciente a recordar la posición correcta de la lengua.'
    }
  },
  'disfuncion_masticatoria': {
    professional: {
      title: 'Disfunción Masticatoria',
      reasoning: 'Patrón ineficiente de trituración alimentaria, sugiriendo debilidad o falta de coordinación.',
      action: 'Ejercicios de masticación coordinada y evaluación dental.'
    },
    family: {
      title: 'Dificultad al masticar',
      reasoning: 'Se observa que el paciente tiene problemas para masticar los alimentos correctamente.',
      action: 'Ofrecer alimentos de texturas adecuadas y supervisar la masticación.'
    }
  },
  'deglucion_atipica': {
    professional: {
      title: 'Deglución Atípica',
      reasoning: 'Patrón motor de deglución que no sigue la norma fisiológica.',
      action: 'Reeducación del patrón deglutorio.'
    },
    family: {
      title: 'Forma inusual de tragar',
      reasoning: 'El movimiento de tragar no es el habitual, pudiendo afectar la postura facial.',
      action: 'Seguir la guía de ejercicios para tragar correctamente.'
    }
  },
  'asimetria_facial': {
    professional: {
      title: 'Asimetría Facial',
      reasoning: 'Desviación en la simetría de los rasgos faciales durante el reposo o la función.',
      action: 'Evaluación neurológica y miofuncional detallada.'
    },
    family: {
      title: 'Asimetría en la cara',
      reasoning: 'Se nota que un lado de la cara se mueve diferente al otro.',
      action: 'Informar cualquier cambio repentino al médico inmediatamente.'
    }
  }
};

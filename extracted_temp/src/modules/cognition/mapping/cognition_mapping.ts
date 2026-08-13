import { CognitionSign } from '../types';

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

export const COGNITION_MAPPING: Record<CognitionSign, AudienceMapping> = {
  'desorientacion_temporal': {
    professional: {
      title: 'Desorientación Temporal',
      reasoning: 'Incapacidad para situar la fecha, hora o estación actual.',
      action: 'Evaluar severidad del déficit orientativo.'
    },
    family: {
      title: 'Confusión con el tiempo',
      reasoning: 'El paciente no recuerda la fecha actual o el momento del día.',
      action: 'Utilizar calendarios visibles y recordatorios temporales en casa.'
    }
  },
  'desorientacion_espacial': {
    professional: {
      title: 'Desorientación Espacial',
      reasoning: 'Dificultad para identificar la ubicación actual o navegar en entornos conocidos.',
      action: 'Evaluar memoria topográfica.'
    },
    family: {
      title: 'Confusión de lugar',
      reasoning: 'El paciente se siente perdido en lugares que debería conocer.',
      action: 'Acompañar en desplazamientos y usar identificadores personales.'
    }
  },
  'deficit_atencional': {
    professional: {
      title: 'Déficit de Atención',
      reasoning: 'Incapacidad para mantener la concentración o filtrar distractores.',
      action: 'Terapia de estimulación atencional.'
    },
    family: {
      title: 'Dificultad para concentrarse',
      reasoning: 'Se distrae fácilmente o le cuesta seguir una conversación prolongada.',
      action: 'Hablarle de forma clara, pausada y en entornos sin ruido.'
    }
  },
  'fallas_memoria_corto_plazo': {
    professional: {
      title: 'Fallas de Memoria Reciente',
      reasoning: 'Déficit en la codificación o recuperación de información reciente.',
      action: 'Entrenamiento en estrategias de memoria.'
    },
    family: {
      title: 'Olvidos recientes',
      reasoning: 'Olvida eventos que sucedieron hace poco tiempo o conversaciones recientes.',
      action: 'Sugerir el uso de notas y apoyos visuales.'
    }
  },
  'anosognosia': {
    professional: {
      title: 'Anosognosia',
      reasoning: 'Falta de conciencia sobre los propios déficits cognitivos.',
      action: 'Abordaje terapéutico adaptado a la baja conciencia de enfermedad.'
    },
    family: {
      title: 'Falta de conciencia de los olvidos',
      reasoning: 'El paciente no percibe que está cometiendo errores o que ha olvidado cosas.',
      action: 'Evitar confrontaciones directas; guiar la actividad con suavidad.'
    }
  },
  'deterioro_funciones_ejecutivas': {
    professional: {
      title: 'Déficit en Funciones Ejecutivas',
      reasoning: 'Falla en la capacidad de organizar, secuenciar y monitorear la propia conducta.',
      action: 'Terapia de rehabilitación ejecutiva.'
    },
    family: {
      title: 'Dificultad para organizarse',
      reasoning: 'Le cuesta planear pasos simples o terminar una tarea iniciada.',
      action: 'Dividir las tareas en pasos muy pequeños y claros.'
    }
  },
  'dificultad_planificacion': {
    professional: {
      title: 'Dificultad en la Planificación',
      reasoning: 'Incapacidad para establecer metas y los pasos necesarios para alcanzarlas.',
      action: 'Entrenamiento en resolución de problemas.'
    },
    family: {
      title: 'Problemas para planear',
      reasoning: 'Se siente abrumado ante actividades que requieren varios pasos.',
      action: 'Ayudarle a hacer listas de tareas sencillas.'
    }
  }
};

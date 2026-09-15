import { AudiologySign } from '../types';

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

export const AUDIOLOGY_MAPPING: Record<AudiologySign, AudienceMapping> = {
  'tinnitus': {
    professional: {
      title: 'Tinnitus',
      reasoning: 'Percepción de sonido sin fuente externa, sugestivo de compromiso coclear o neural.',
      action: 'Evaluar frecuencia y severidad.'
    },
    family: {
      title: 'Zumbidos en el oído',
      reasoning: 'El paciente refiere escuchar sonidos como pitidos o zumbidos.',
      action: 'Evitar ruidos fuertes y seguir las pautas del profesional.'
    }
  },
  'hiperacusia': {
    professional: {
      title: 'Hiperacusia',
      reasoning: 'Hipersensibilidad a sonidos ambientales normales.',
      action: 'Valorar terapia de desensibilización sonora.'
    },
    family: {
      title: 'Sensibilidad al ruido',
      reasoning: 'Sonidos normales resultan molestos o dolorosos para el paciente.',
      action: 'Utilizar protectores auditivos en entornos ruidosos si se recomienda.'
    }
  },
  'otalgia': {
    professional: {
      title: 'Otalgia',
      reasoning: 'Dolor localizado en el pabellón auricular o conducto auditivo externo.',
      action: 'Realizar otoscopia inmediata.'
    },
    family: {
      title: 'Dolor de oído',
      reasoning: 'El paciente reporta dolor en el oído.',
      action: 'Consultar con el médico para descartar infección.'
    }
  },
  'plenitud_auricular': {
    professional: {
      title: 'Plenitud Auricular',
      reasoning: 'Sensación de oído tapado, compatible con disfunción tubaria o efusión.',
      action: 'Realizar timpanometría.'
    },
    family: {
      title: 'Oído tapado',
      reasoning: 'El paciente siente el oído lleno o con presión.',
      action: 'Evitar introducir objetos en el canal auditivo.'
    }
  },
  'hipoacusia_percibida': {
    professional: {
      title: 'Hipoacusia Percibida',
      reasoning: 'Disminución subjetiva de la capacidad auditiva.',
      action: 'Realizar audiometría tonal y vocal.'
    },
    family: {
      title: 'Dificultad para oír',
      reasoning: 'El paciente refiere que no escucha bien o que los demás hablan bajo.',
      action: 'Programar una cita para una prueba de audición.'
    }
  },
  'vertigo_desequilibrio': {
    professional: {
      title: 'Síndrome Vestibular',
      reasoning: 'Sensación de giro o inestabilidad, sugiriendo compromiso del sistema vestibular.',
      action: 'Realizar maniobras de diagnóstico vestibular.'
    },
    family: {
      title: 'Mareos o Vértigo',
      reasoning: 'El paciente siente que todo gira o tiene dificultad para mantener el equilibrio.',
      action: 'Evitar cambios bruscos de posición y buscar atención médica.'
    }
  },
  'otorragia': {
    professional: {
      title: 'Otorragia',
      reasoning: 'Presencia de sangrado en el conducto auditivo externo.',
      action: 'Derivación inmediata a urgencias ORL.'
    },
    family: {
      title: 'Sangrado en el oído',
      reasoning: 'Se ha detectado salida de sangre por el oído.',
      action: 'Acudir a urgencias inmediatamente.'
    }
  }
};

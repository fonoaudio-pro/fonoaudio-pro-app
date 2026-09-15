import { AdaptiveBranch } from '../types/clinical_history';

export const AREA_BRANCHES: AdaptiveBranch[] = [
  {
    id: 'lenguaje_expresivo',
    label: 'Lenguaje Expresivo',
    conditions: { affectedAreas: ['lenguaje'] },
    sections: [
      {
        id: 'lenguaje_expresivo_eval',
        title: 'Evaluación del Lenguaje Expresivo',
        description: 'Análisis detallado de la producción verbal',
        required: true,
        fields: [
          {
            id: 'nivel_lenguaje',
            label: 'Nivel de lenguaje expresivo',
            type: 'select',
            required: true,
            options: [
              'Preverbal/Gestual',
              'Holofrases',
              'Frases de 2 palabras',
              'Frases de 3+ palabras',
              'Discurso conectado',
              'Sin alteración'
            ],
            helpText: 'Nivel más alto alcanzado en la producción espontánea'
          },
          {
            id: 'caracteristicas_voz',
            label: 'Características de la voz',
            type: 'multiselect',
            required: false,
            options: [
              'Ronquera',
              'Débil',
              'Nasalizada',
              'Aprosodia',
              'Voz infantilizada',
              'Normal'
            ]
          },
          {
            id: 'fluidez',
            label: 'Fluidez verbal',
            type: 'select',
            required: true,
            options: [
              'Fluida',
              'Con titubeos',
              'Bloqueos',
              'Tartamudeo',
              'Disfluencia neurogénica'
            ]
          },
          {
            id: 'articulacion',
            label: 'Articulación',
            type: 'multiselect',
            required: false,
            options: [
              'Normal',
              'Sustituciones',
              'Omisiones',
              'Distorsiones',
              'Accesorias',
              'Dislalia múltiple'
            ]
          },
          {
            id: 'habilidades_morfosintacticas',
            label: 'Habilidades morfosintácticas',
            type: 'select',
            required: false,
            options: [
              'Ausentes',
              'Primitivas',
              'En desarrollo',
              'Consolidadas',
              'Normal'
            ]
          }
        ]
      }
    ]
  },
  {
    id: 'lenguaje_comprension',
    label: 'Comprensión del Lenguaje',
    conditions: { affectedAreas: ['lenguaje'] },
    sections: [
      {
        id: 'lenguaje_comprension_eval',
        title: 'Evaluación de Comprensión',
        description: 'Capacidad de procesamiento del lenguaje recibido',
        required: true,
        fields: [
          {
            id: 'comprension_instrucciones',
            label: 'Comprensión de instrucciones',
            type: 'select',
            required: true,
            options: [
              'No comprende consignas',
              'Solo 1 paso concreto',
              '2 pasos concretos',
              'Instrucciones complejas',
              'Normal'
            ]
          },
          {
            id: 'vocabulario_receptivo',
            label: 'Vocabulario receptivo',
            type: 'select',
            required: true,
            options: [
              'Ausente',
              'Muy limitado',
              'Básico',
              'Extendido',
              'Normal'
            ]
          },
          {
            id: 'comprension_narrativa',
            label: 'Comprensión narrativa',
            type: 'select',
            required: false,
            options: [
              'No comprende historias',
              'Identifica protagonista',
              'Secuencia básica',
              'Secuencia completa',
              'Inferencias'
            ]
          },
          {
            id: 'procesamiento_auditivo',
            label: 'Procesamiento auditivo',
            type: 'select',
            required: false,
            options: [
              'Normal',
              'Demora en respuesta',
              'Confusiones fonológicas',
              'Dificultad en ruido',
              'No evaluado'
            ]
          }
        ]
      }
    ]
  },
  {
    id: 'habilidades_sociales',
    label: 'Habilidades Sociales',
    conditions: { affectedAreas: ['comunicacion'] },
    sections: [
      {
        id: 'habilidades_sociales_eval',
        title: 'Evaluación de Habilidades Sociales',
        description: 'Comunicación pragmática e interacción',
        required: true,
        fields: [
          {
            id: 'contacto_visual',
            label: 'Contacto visual',
            type: 'select',
            required: true,
            options: [
              'Ausente',
              'Evita',
              'Intermitente',
              'Adecuado',
              'Normal'
            ]
          },
          {
            id: 'gestualidad',
            label: 'Gestualidad comunicativa',
            type: 'select',
            required: true,
            options: [
              'Ausente',
              'Solo necesidades',
              'Comentativa',
              'Compleja',
              'Normal'
            ]
          },
          {
            id: 'turno_conversacional',
            label: 'Turno conversacional',
            type: 'select',
            required: false,
            options: [
              'No espera turno',
              'Turno forzado',
              'Ayuda para turnos',
              'Turno simple',
              'Normal'
            ]
          },
          {
            id: 'temas_interes',
            label: 'Temas de interés',
            type: 'select',
            required: false,
            options: [
              'No muestra',
              'Limitados/repetitivos',
              'Pocos temas',
              'Variedad',
              'Normal'
            ]
          }
        ]
      }
    ]
  },
  {
    id: 'motricidad_oral',
    label: 'Motricidad Orofacial',
    conditions: { affectedAreas: ['motricidad_orofacial'] },
    sections: [
      {
        id: 'motricidad_oral_eval',
        title: 'Evaluación de Motricidad Orofacial',
        description: 'Función muscular orofacial y articulatoria',
        required: true,
        fields: [
          {
            id: 'tono_muscular',
            label: 'Tono muscular orofacial',
            type: 'select',
            required: true,
            options: [
              'Hipotonía severa',
              'Hipotonía leve',
              'Normal',
              'Hipertonía leve',
              'Hipertonía severa'
            ]
          },
          {
            id: 'fuerza_labial',
            label: 'Fuerza labial',
            type: 'select',
            required: true,
            options: [
              'Ausente',
              'Muy débil',
              'Débil',
              'Normal',
              'Excesiva'
            ]
          },
          {
            id: 'resistencia_lingual',
            label: 'Resistencia lingual',
            type: 'select',
            required: true,
            options: [
              'Ausente',
              'Muy débil',
              'Débil',
              'Normal',
              'Espástica'
            ]
          },
          {
            id: 'movimientos_isolados',
            label: 'Movimientos aislados',
            type: 'multiselect',
            required: false,
            options: [
              'Apertura',
              'Cierre',
              'Protusión',
              'Lateralización',
              'Elevación',
              'Ninguno aislado'
            ]
          },
          {
            id: 'respiracion',
            label: 'Patrón respiratorio',
            type: 'select',
            required: false,
            options: [
              'Oral puro',
              'Mixto',
              'Nasal predominante',
              'Compensatorio',
              'Normal'
            ]
          }
        ]
      }
    ]
  },
  {
    id: 'deglucion',
    label: 'Deglución',
    conditions: { affectedAreas: ['deglucion'] },
    sections: [
      {
        id: 'deglucion_eval',
        title: 'Evaluación de Deglución',
        description: 'Función deglutoria en todas las fases',
        required: true,
        fields: [
          {
            id: 'fase_oral',
            label: 'Fase oral',
            type: 'select',
            required: true,
            options: [
              'No puede probar',
              'Babeo severo',
              'Dificultad masticación',
              'Adaptaciones leves',
              'Normal'
            ]
          },
          {
            id: 'fase_faringea',
            label: 'Fase faríngea',
            type: 'select',
            required: true,
            options: [
              'Aspiración severa',
              'Residuos faríngeos',
              'Elevación laríngea reducida',
              'Normal'
            ]
          },
          {
            id: 'texturas_toleradas',
            label: 'Texturas toleradas',
            type: 'select',
            required: true,
            options: [
              'Nada por vía oral',
              'Líquidos espesos',
              'Semisólidos',
              'Sólidos blandos',
              'Todas las texturas'
            ]
          },
          {
            id: 'sintomas_alarma',
            label: 'Síntomas de alarma',
            type: 'multiselect',
            required: false,
            options: [
              'Tos al tragar',
              'Voz húmeda',
              'Pérdida de peso',
              'Neumonías recurrentes',
              'Fiebre al comer'
            ]
          }
        ]
      }
    ]
  },
  {
    id: 'voz',
    label: 'Voz',
    conditions: { affectedAreas: ['voz'] },
    sections: [
      {
        id: 'voz_eval',
        title: 'Evaluación de la Voz',
        description: 'Análisis acústico y perceptivo',
        required: true,
        fields: [
          {
            id: 'calidad_vocal',
            label: 'Calidad vocal',
            type: 'select',
            required: true,
            options: [
              'Normal',
              'Disfonía leve',
              'Disfonía moderada',
              'Disfonía severa',
              'Afonía'
            ]
          },
          {
            id: 'tipo_disfonia',
            label: 'Tipo de disfonía',
            type: 'multiselect',
            required: false,
            options: [
              'Nódulos',
              'Pólipos',
              'Parálisis',
              'Espasmo',
              'Tensión muscular',
              'Funcional',
              'Otra'
            ]
          },
          {
            id: 'rango_frecuencial',
            label: 'Rango de frecuencia',
            type: 'select',
            required: false,
            options: [
              'Muy reducido (<1 octava)',
              'Reducido (1-1.5 octavas)',
              'Normal (2+ octavas)',
              'No evaluado'
            ]
          },
          {
            id: 'resistencia_vocal',
            label: 'Resistencia vocal',
            type: 'select',
            required: false,
            options: [
              'Muy baja (<5 min)',
              'Baja (5-15 min)',
              'Normal (>30 min)',
              'No evaluado'
            ]
          },
          {
            id: 'habitos_vocales',
            label: 'Hábitos vocales',
            type: 'multiselect',
            required: false,
            options: [
              'Grito',
              'Susurro',
              'Voz nasaleada',
              'Habla rápida',
              'Poca hidratación',
              'Ninguno identificado'
            ]
          }
        ]
      }
    ]
  },
  {
    id: 'audicion',
    label: 'Audición',
    conditions: { affectedAreas: ['audicion'] },
    sections: [
      {
        id: 'audicion_eval',
        title: 'Evaluación Auditiva',
        description: 'Estado del sistema auditivo y comunicación',
        required: true,
        fields: [
          {
            id: 'tipo_perdida',
            label: 'Tipo de pérdida auditiva',
            type: 'select',
            required: true,
            options: [
              'No tiene pérdida',
              'Conductiva',
              'Neurosensorial',
              'Mixta',
              'Desconocido'
            ]
          },
          {
            id: 'nivel_perdida',
            label: 'Nivel de pérdida',
            type: 'select',
            required: true,
            options: [
              'Normal (0-25 dB)',
              'Leve (26-40 dB)',
              'Moderada (41-55 dB)',
              'Severa (56-70 dB)',
              'Profunda (>70 dB)'
            ]
          },
          {
            id: 'uso_auxiliares',
            label: 'Uso de auxiliares',
            type: 'multiselect',
            required: false,
            options: [
              'Ninguno',
              'Auxiliares auditivos',
              'Implante coclear',
              'Fonópantófono',
              'Otros'
            ]
          },
          {
            id: 'adaptacion_auxiliares',
            label: 'Adaptación a auxiliares',
            type: 'select',
            required: false,
            options: [
              'No usa',
              'Rechaza',
              'Uso parcial',
              'Uso diario',
              'Bien adaptado'
            ]
          }
        ]
      }
    ]
  }
];

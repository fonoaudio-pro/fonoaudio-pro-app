export interface ReportScenario {
  label: string;
  level: "adecuado" | "leve" | "severo" | "favorable" | "reservado" | "generico";
  color: "emerald" | "amber" | "red" | "blue" | "slate";
  text: string;
}

export interface ReportVariable {
  id: string;
  label: string;
  placeholder: string;
  defaultValue: string;
}

export interface ReportSection {
  id: string;
  title: string;
  explicacion?: string; // Grey instruction note
  variables?: ReportVariable[];
  options?: ReportScenario[];
  defaultContent?: string;
  editable?: boolean;
  allowsMaterials?: boolean;
}

export interface ReportGuide {
  title: string;
  sections: ReportSection[];
}

export const REPORT_GUIDES: Record<string, ReportGuide> = {
  valoracion: {
    title: "Informe de Valoración Fonoaudiológica",
    sections: [
       {
         id: "info_general",
         title: "Información General",
         explicacion: "Proporcionar detalles sobre el propósito del informe y observaciones de la valoración (modalidad, cantidad de sesiones, etc.).",
         variables: [
           { id: "CANTIDAD_SESIONES", label: "Cantidad de Sesiones", placeholder: "Ej. 3 encuentros", defaultValue: "3 encuentros" },
           { id: "FECHA_VALORACION", label: "Fecha de Valoración", placeholder: "Ej. 10 de Mayo de 2026", defaultValue: new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) },
           { id: "MODALIDAD", label: "Modalidad", placeholder: "presencial / online / híbrida", defaultValue: "presencial" }
         ],
         defaultContent: `
           <p>Se extiende el presente informe a quien corresponda a fin de notificar el proceso de valoración fonoaudiológica del paciente <strong>[NOMBRE]</strong>.</p>
           <p>El diagnóstico, los objetivos terapéuticos a conquistar y las recomendaciones se encuentran al final del documento.</p>
           <p>La valoración fonoaudiológica fue llevada a cabo en <strong>[CANTIDAD_SESIONES]</strong> a partir del día <strong>[FECHA_VALORACION]</strong> en la modalidad <strong>[MODALIDAD]</strong>.</p>
         `,
         editable: true,
         allowsMaterials: true
       },

       {
         id: "motivo_consulta",
         title: "Motivo de Consulta",
         explicacion: "Detallar la razón específica por la cual el paciente acude a la consulta fonoaudiológica. Puede incluir citas del informante.",
         variables: [
           { id: "PARENTESTCO_INFORMANTE", label: "Parentesco Informante", placeholder: "Ej. la mamá, el papá, su abuela", defaultValue: "la mamá" },
           { id: "INFORMANTE_NOMBRE", label: "Nombre del Informante", placeholder: "Ej. María", defaultValue: "" },
           { id: "MOTIVO_TEXTO", label: "Detalle del Motivo", placeholder: "Cita del informante entre comillas", defaultValue: "le cuesta pronunciar algunos sonidos del habla en su comunicación espontánea" }
         ],
         defaultContent: `
           <p>El/La <strong>[PARENTESTCO_INFORMANTE]</strong> de <strong>[NOMBRE]</strong>, refiere que <em>\"[MOTIVO_TEXTO]\"</em>. El paciente asiste a la consulta acompañado/a por su familia con el fin de esclarecer el estado del desarrollo lingüístico-comunicativo.</p>
         `,
         editable: true,
         allowsMaterials: true
       },

       {
         id: "comportamiento",
         title: "Comportamiento y Equilibrio Afectivo-Emocional",
         explicacion: "Detallar observaciones sobre su conducta durante la valoración, respeto de límites, cooperación, vínculo, episodios de frustración o adecuación al espacio.",
         options: [
           {
             label: "Adecuado / Cooperativo",
             level: "adecuado",
             color: "emerald",
             text: "Se observó que [NOMBRE] logra respetar los tiempos de espera para entrar al consultorio. Ingresa y permanece solo/a sin dificultad adecuándose a las normas de trabajo y del espacio. Ha logrado establecer un adecuado vínculo paciente-terapeuta para el desarrollo de las sesiones, desenvolviéndose con entusiasmo, manteniendo una participación activa y convocando al terapeuta en las distintas actividades. Se muestra como un/a niño/a sumamente colaborador/a y predispuesto/a ante las consignas propuestas."
           },
           {
             label: "Fluctuante / Ansioso",
             level: "leve",
             color: "amber",
             text: "[NOMBRE] presentó cierta dificultad para respetar los tiempos de espera para ingresar al consultorio mostrándose ansioso/a por su turno. Luego logra ingresar y permanecer dentro para desarrollar la sesión, sin embargo precisa que el terapeuta lo/a reestructure y reorganice constantemente. Se observó cierta resistencia ante los límites y respeto por las reglas de trabajo; adoptando una conducta que por momentos interrumpe el desarrollo lúdico. También se detectaron episodios de frustración y ansiedad ante situaciones de desafío o cambio. Ha podido establecer un adecuado vínculo con el profesional, aunque en ocasiones experimentó dificultades para compartir el juego y controlar sus impulsos."
           },
           {
             label: "Desafíos Marcados / Disruptivo",
             level: "severo",
             color: "red",
             text: "Fue posible identificar en [NOMBRE] dificultades marcadas en su comportamiento general y equilibrio afectivo-emocional, impactando negativamente en el transcurso de las sesiones de valoración. Se observaron patrones de conducta disruptivos, resistencia constante a las consignas y dificultades severas para regular sus emociones de manera adaptativa. Su capacidad para establecer relaciones sociales y de colaboración se vio comprometida, resultando complejo establecer un adecuado vínculo para el desarrollo de las pruebas formales propuestas, requiriendo adaptaciones lúdicas muy libres para evitar frustración extrema."
           }
         ],
         allowsMaterials: true
       },

      {
        id: "dba",
        title: "Dispositivos Básicos de Aprendizaje (DBA)",
        explicacion: "Registrar la evaluación de la motivación, atención, sensopercepción y memoria del paciente.",
        options: [
          {
            label: "Sostenido / Acorde",
            level: "adecuado",
            color: "emerald",
            text: "Durante el proceso de valoración [NOMBRE] se mostró motivado/a y predispuesto/a ante las actividades ofrecidas. Logró sostener su atención focalizada y sostenida durante periodos de tiempo acorde a lo esperado y estructuró adecuadamente los pasos a seguir para cumplir con el trabajo solicitado. En cuanto a la sensopercepción y memoria, integró eficazmente la información para comprender las consignas. Por tanto, no hubo factores atencionales que hayan interferido en el proceso de valoración lingüística."
          },
          {
            label: "Fluctuante / Disperso",
            level: "leve",
            color: "amber",
            text: "Si bien [NOMBRE] se mostró interesado/a por la mayoría de las actividades lúdicas-terapéuticas, su atención era fluctuante, dispersándose con facilidad y precisando de una reestructuración frecuente por parte del profesional para poder desarrollar y culminar las tareas propuestas. Su memoria puede ser variable, con ciertas dificultades para recordar secuencias auditivas complejas de manera consistente. Es muy factible que los resultados de la valoración de las habilidades comunicativas y lingüísticas se hayan visto influenciados por esta fluctuación atencional."
          },
          {
            label: "Compromiso Severo / Pruebas Limitadas",
            level: "severo",
            color: "red",
            text: "Tras la valoración de los dispositivos básicos de aprendizaje, se identificaron en [NOMBRE] dificultades marcadas en la atención sostenida, manifestando un foco sumamente disperso y brevísimo ante cualquier tarea estructurada. Estas dificultades interfirieron de manera severa con los resultados de la valoración, impidiendo la aplicación de la totalidad de los protocolos previstos o la culminación de las tareas requeridas de manera formal."
          }
        ]
      },
      {
        id: "interaccion_social",
        title: "Interacción Social",
        explicacion: "Detallar la observación del paciente en contextos sociales, juego compartido, contacto visual y adaptación psicosocial.",
        options: [
          {
            label: "Activa y Cooperativa",
            level: "adecuado",
            color: "emerald",
            text: "[NOMBRE] participó activamente en interacciones sociales, mostrando curiosidad por su entorno y estableciendo relaciones altamente positivas con el terapeuta. Se observó un comportamiento cooperativo y adaptable, lo que sugiere un muy buen ajuste social y comunicativo. Frente a los materiales que se presentaron, fijó la mirada, exploró, manipuló de manera funcional y creó actividades lúdicas convocando al profesional con una sonrisa e iniciativa."
          },
          {
            label: "Pasiva / Dificultades Leves",
            level: "leve",
            color: "amber",
            text: "Se evidenciaron algunas dificultades en la interacción psicosocial de [NOMBRE], manifestadas principalmente en su iniciativa para participar activamente en situaciones lúdicas interactivas. Aunque muestra interés en interactuar con el adulto, tiende a adoptar una postura pasiva, esperando indicaciones, presentando dificultades ocasionales para interpretar señales sociales complejas y regular sus propias intenciones dentro del juego."
          },
          {
            label: "Limitada / Aislamiento",
            level: "severo",
            color: "red",
            text: "[NOMBRE] presenta marcadas dificultades en su interacción psicosocial. Muestra limitaciones significativas en el establecimiento de vínculos, evidenciando dificultades para sostener la mirada de forma intencional y responder a las señales emocionales del terapeuta. Se observan conductas de evitación, juego solitario repetitivo y aislamiento, rechazando o ignorando la participación del profesional en sus dinámicas lúdicas."
          }
        ]
      },
      {
        id: "expresivo_morfosintaxis",
        title: "Lenguaje Expresivo: Morfosintaxis",
        explicacion: "Analizar aspectos gramaticales, sintácticos, formación de oraciones, pronombres, nexos y longitud del enunciado.",
        variables: [
          { id: "ESTRUCTURA_EJEMPLO", label: "Ejemplo de Oración Producida", placeholder: "Ej. 'Mamá dame auto' / 'Quiero jugar con el tren rojo'", defaultValue: "Quiero jugar con el tren" },
          { id: "DESCRIPCION_EDAD", label: "Descripción Esperada para Edad", placeholder: "Ej. oraciones completas de 4 o más elementos", defaultValue: "oraciones complejas coordinadas utilizando nexos y preposiciones" }
        ],
        options: [
          {
            label: "Estructura Acorde a la Edad",
            level: "adecuado",
            color: "emerald",
            text: "Con respecto al componente morfosintáctico del lenguaje, se observa que [NOMBRE] estructura de manera espontánea oraciones complejas acorde a lo esperado para su edad, como por ejemplo: <em>\"[ESTRUCTURA_EJEMPLO]\"</em>. Demuestra un uso adecuado de artículos, pronombres, preposiciones y concordancia de género y número. La longitud media del enunciado es totalmente funcional y óptima para su edad cronológica."
          },
          {
            label: "Simplificación / Dificultades Leves",
            level: "leve",
            color: "amber",
            text: "En relación al componente morfosintáctico, se ha observado que [NOMBRE] estructuró frases mayormente de tipo simple o yuxtapuestas, tales como: <em>\"[ESTRUCTURA_EJEMPLO]\"</em>. Para su edad cronológica, se espera que logre producir: <strong>[DESCRIPCION_EDAD]</strong>. Por tanto, es posible evidenciar que produce oraciones con una estructura gramatical por debajo de lo esperado, con omisión ocasional de conectores, artículos o preposiciones, y leves errores en la concordancia de género-número en el habla espontánea."
          },
          {
            label: "Descendido / Estructuras Básicas",
            level: "severo",
            color: "red",
            text: "El nivel morfosintáctico de [NOMBRE] se encuentra significativamente descendido. Presenta una habla telegráfica o reducida a palabras aisladas o frases de solo dos elementos (ej. <em>\"[ESTRUCTURA_EJEMPLO]\"</em>). Se observa una ausencia casi total de nexos gramaticales, artículos y conjugaciones verbales correctas. Su estructuración está muy por debajo de las expectativas clínicas para su edad, dificultando la expresión clara de ideas o deseos complejos."
          }
        ]
      },
      {
        id: "expresivo_semantica",
        title: "Lenguaje Expresivo: Léxico-Semántico",
        explicacion: "Vocabulario, repertorio productivo, denominación de objetos, categorización y descripción.",
        variables: [
          { id: "CANTIDAD_PALABRAS", label: "Cantidad de palabras estimadas (si es bajo)", placeholder: "Ej. 50 palabras", defaultValue: "alrededor de 50 palabras" }
        ],
        options: [
          {
            label: "Vocabulario Amplio y Funcional",
            level: "adecuado",
            color: "emerald",
            text: "Se ha observado que [NOMBRE] cuenta con un repertorio productivo acorde a lo esperado para su edad, demostrando la capacidad para producir una amplia variedad de palabras y expresar sus deseos de manera efectiva. Logra identificar y nombrar elementos cotidianos con rapidez y precisión (denominación por contraste). Además, no solo denomina, sino que produce descripciones semánticas indicando la función de los objetos, mostrando una rica organización de su almacén léxico."
          },
          {
            label: "Vocabulario Restringido / Por debajo de lo esperado",
            level: "leve",
            color: "amber",
            text: "[NOMBRE] emplea un repertorio productivo estimado de <strong>[CANTIDAD_PALABRAS]</strong> en su comunicación habitual, complementándola con señalamientos o gestos descriptivos. Muestra limitaciones en la evocación rápida de palabras específicas (anomia) y sus definiciones suelen ser exclusivamente de tipo instrumental ('sirve para...'), situándose por debajo de las expectativas para su grupo etario, lo que restringe levemente su fluidez comunicativa."
          },
          {
            label: "Descendido / Muy Limitado",
            level: "severo",
            color: "red",
            text: "El nivel léxico-semántico expresivo de [NOMBRE] se encuentra severamente descendido. Su vocabulario activo es extremadamente reducido, limitándose a términos familiares muy básicos y onomatopeyas. Presenta serias dificultades para denominar elementos comunes aun con imágenes facilitadoras, y no logra agrupar palabras por campos semánticos básicos, dependiendo casi exclusivamente de la comunicación no verbal o instrumental."
          }
        ]
      },
      {
        id: "pragmatico",
        title: "Nivel Pragmático y Habilidades Sociales",
        explicacion: "Uso funcional del lenguaje en el contexto social: contacto visual, turnos de palabra, inicio y mantenimiento de tópicos, intención comunicativa.",
        options: [
          {
            label: "Adecuado e Intencional",
            level: "adecuado",
            color: "emerald",
            text: "Desde el inicio de la valoración fue posible evidenciar que [NOMBRE] cuenta con un nivel pragmático del lenguaje y habilidades sociales acordes a su edad cronológica. Demuestra una comprensión adecuada de las reglas sociales, mantiene un contacto visual sostenido, inicia y sostiene tópicos de conversación lúdica de forma pertinente y respeta la toma de turnos espontánea. Adapta con facilidad su expresión a las necesidades de su interlocutor."
          },
          {
            label: "Dificultades en Iniciación / Regulación de Turnos",
            level: "leve",
            color: "amber",
            text: "[NOMBRE] demuestra adecuadas intenciones comunicativas, pero presenta dificultades específicas en el componente pragmático, tales como mantener la mirada sostenida al hablar o respetar la toma de turnos de manera consistente, tendiendo a interrumpir o perder el hilo temático. Requiere de andamiaje y guía constante del terapeuta para regular el volumen de su voz y adaptarse a las dinámicas del intercambio recíproco."
          },
          {
            label: "Uso Instrumental / Dificultades Marcadas",
            level: "severo",
            color: "red",
            text: "Se identifican severas dificultades en el uso pragmático del lenguaje en [NOMBRE]. Su intención es mayormente instrumental (hacer uso del adulto como un 'medio' para alcanzar objetos). No establece contacto visual intencional durante los intercambios, no responde al llamado por su nombre de manera sistemática y carece de habilidades conversacionales recíprocas elementales, mostrando escaso interés por el diálogo compartido."
          }
        ]
      },
      {
        id: "comprensivo",
        title: "Lenguaje Comprensivo",
        explicacion: "Habilidades receptivas: seguimiento de órdenes simples y complejas, conceptos espaciales/temporales, comprensión de categorías.",
        variables: [
          { id: "HABILIDADES_COMPRENSION", label: "Habilidades logradas", placeholder: "Ej. identificar objetos por uso", defaultValue: "identificar objetos cotidianos y seguir órdenes directas de un paso" },
          { id: "DIFICULTADES_COMPRENSION", label: "Dificultades observadas", placeholder: "Ej. oraciones negativas o espaciales", defaultValue: "órdenes complejas de múltiples pasos y conceptos espaciales (dentro/fuera)" }
        ],
        options: [
          {
            label: "Comprensión Óptima / Acorde",
            level: "adecuado",
            color: "emerald",
            text: "El componente comprensivo del lenguaje en [NOMBRE] se encuentra totalmente preservado y acorde a lo esperado. Es capaz de decodificar y procesar de manera rápida instrucciones complejas de varios pasos de forma secuencial. Comprende a la perfección términos espaciales, cuantitativos y pronombres personales. Resuelve tareas de inferencia semántica y comprende narraciones cortas, respondiendo coherentemente a preguntas sobre las mismas."
          },
          {
            label: "Dificultades en Órdenes Complejas / Conceptos",
            level: "leve",
            color: "amber",
            text: "En cuanto a las habilidades comprensivas, se observó que [NOMBRE] cuenta con habilidades para <strong>[HABILIDADES_COMPRENSION]</strong>. Sin embargo, se evidenciaron dificultades marcadas para <strong>[DIFICULTADES_COMPRENSION]</strong>. Requiere apoyo visual o repetición pausada del mensaje para procesar con éxito directivas de más de dos pasos secuenciales o estructuras gramaticales pasivas o negativas."
          },
          {
            label: "Comprensión Severamente Afectada",
            level: "severo",
            color: "red",
            text: "Se evidencian dificultades profundas y generalizadas en el lenguaje comprensivo de [NOMBRE]. Presenta problemas para responder a consignas muy simples de un solo paso, aun cuando están acompañadas de modelado gestual. Su comprensión está limitada a palabras aisladas de alta familiaridad en contextos sumamente rutinarios, lo cual interfiere de manera severa en todas sus actividades diarias."
          }
        ]
      },
      {
        id: "habla",
        title: "Habla y Fonética-Fonología",
        explicacion: "Calidad de producción verbal: articulación aislada, procesos de simplificación fonológica en palabras (PSF), prosodia y fluidez.",
        variables: [
          { id: "PROCESOS_SIMPLIFICACION", label: "Procesos de Simplificación (PSF)", placeholder: "Ej. omisión de sílabas átonas, sustituciones de /r/", defaultValue: "sustitución de fonemas líquidos (/l/ por /r/) y asimilaciones silábicas" }
        ],
        options: [
          {
            label: "Articulación y Fluidez Adecuada",
            level: "adecuado",
            color: "emerald",
            text: "Tras la valoración del habla de [NOMBRE], se ha identificado que produce y combina adecuadamente todos los sonidos esperados para su edad cronológica. Su articulación es clara, no se observan Procesos de Simplificación Fonológica (PSF) fuera de la norma. Su prosodia es natural y variada, utilizando entonaciones y ritmos adecuados. Asimismo, su fluidez es continua, continua y sin esfuerzo."
          },
          {
            label: "Errores Fonológicos / Inteligibilidad Comprometida",
            level: "leve",
            color: "amber",
            text: "Se identifican ciertas dificultades en el habla de [NOMBRE] que afectan su claridad y comprensión en el discurso continuo. Si bien articula correctamente la mayoría de los sonidos de forma aislada, al producirlos dentro de palabras y oraciones se presentan procesos de simplificación fonológica (PSF), tales como: <strong>[PROCESOS_SIMPLIFICACION]</strong>. Su habla es inteligible para familiares directos, pero disminuye ante interlocutores desconocidos."
          },
          {
            label: "Dificultades Articulatorias Severas / Inconsistencias",
            level: "severo",
            color: "red",
            text: "El habla de [NOMBRE] presenta una inteligibilidad severamente comprometida. Presenta múltiples PSF de carácter inmaduro o atípico, con abundantes omisiones de consonantes iniciales y trabantes, y sustituciones generalizadas. Esto genera que su discurso espontáneo sea catalogado como jerga incomprensible fuera de contexto. Requiere de un abordaje fonético-fonológico prioritario y sistemático."
          }
        ]
      },
      {
        id: "voz",
        title: "Voz",
        explicacion: "Calidad vocal: resonancia, intensidad, tonalidad y salud vocal general.",
        options: [
          {
            label: "Voz Normal / Típica",
            level: "adecuado",
            color: "emerald",
            text: "Por medio de la valoración clínica se evidencia que el paciente presenta una voz acorde a los parámetros típicos para su edad cronológica. Demuestra una buena capacidad para ajustar el tono, el volumen y la velocidad de su habla según el contexto comunicativo. Su voz refleja una adecuada resonancia y calidad vocal, sin presencia de tensión laríngea o fatiga."
          },
          {
            label: "Alteraciones Leves / Intensidad Inadecuada",
            level: "leve",
            color: "amber",
            text: "Se evidencian algunas dificultades en el uso de la voz de [NOMBRE], manifestadas principalmente por emplear una intensidad vocal sumamente elevada (habla a los gritos) o débil de manera sostenida en el tiempo. Se observa un patrón de abuso vocal con carraspeo frecuente que podría inducir fatiga laringea, recomendándose pautas de higiene vocal familiar."
          },
          {
            label: "Alteración Moderada/Severa (Sospecha Disfonía)",
            level: "severo",
            color: "red",
            text: "Se detectaron en el paciente alteraciones notables en la producción vocal tales como una voz crónicamente ronca, soplosa, áspera y con quiebres tonales frecuentes. Estos signos son compatibles con disfonía funcional o sospecha de patología orgánica (nódulos cordales). Es prioritario realizar interconsulta otorrinolaringológica previa a la terapia vocal focalizada."
          }
        ]
      },
      {
        id: "juego",
        title: "Desarrollo del Juego",
        explicacion: "Participación lúdica, etapa del juego (sensoriomotor, simbólico, reglado), elementos de preferencia y flexibilidad.",
        variables: [
          { id: "JUEGO_PREFERIDO", label: "Juego o Material de Preferencia", placeholder: "Ej. autitos, bloques, dinosaurios", defaultValue: "bloques de construcción y autitos" },
          { id: "JUEGO_MENOR_INTERES", label: "Actividades de Menor Interés", placeholder: "Ej. rompecabezas estructurados", defaultValue: "rompecabezas y tareas de mesa estructuradas" }
        ],
        options: [
          {
            label: "Juego Simbólico / Rico y Flexible",
            level: "adecuado",
            color: "emerald",
            text: "[NOMBRE] muestra un nivel de juego acorde a su etapa de desarrollo, encontrándose en una rica etapa de juego simbólico y de representación. Demuestra creatividad y gran flexibilidad en su juego, adaptándose a diferentes escenarios y roles. Disfruta de actividades con <strong>[JUEGO_PREFERIDO]</strong>. Participa activamente compartiendo su juego con el terapeuta e involucrándolo de forma cooperativa en sus guiones lúdicos."
          },
          {
            label: "Juego Repetitivo / Rigidez Leve",
            level: "leve",
            color: "amber",
            text: "Se identificó que [NOMBRE] presenta algunas dificultades en el juego cooperativo. Si bien muestra interés en participar en actividades, su juego puede tornarse repetitivo o limitado en cuanto a la variedad de roles explorados. Se observa menor preferencia por actividades de tipo <strong>[JUEGO_MENOR_INTERES]</strong>, prefiriendo juegos libres y exploratorios individuales. Le cuesta aceptar cambios en las reglas sugeridas."
          },
          {
            label: "Juego Sensorio-motor / Limitación Significativa",
            level: "severo",
            color: "red",
            text: "Se observa una limitada participación en actividades lúdicas complejas, permaneciendo en una etapa de juego sensoriomotor básico (arrojar, alinear, chupar objetos) no acorde a su edad. Carece de juego simbólico o representativo. Su juego es sumamente rígido, solitario y con conductas repetitivas ante sus materiales preferidos (<strong>[JUEGO_PREFERIDO]</strong>), rechazando la intrusión lúdica del terapeuta."
          }
        ]
      },
      {
        id: "impresion_diagnostica",
        title: "Impresión Diagnóstica",
        explicacion: "Detallar la o las dificultades detectadas en el paciente, grado de severidad y diagnóstico presuntivo.",
        variables: [
          { id: "DIAGNOSTICO_FONOAUDIOLOGICO", label: "Diagnóstico Fonoaudiológico Presuntivo", placeholder: "Ej. Trastorno del Lenguaje (TEL) / Trastorno de los Sonidos del Habla (TSH)", defaultValue: "Trastorno del Lenguaje Expresivo (TEL)" },
          { id: "AREAS_AFECTADAS", label: "Áreas Clínicas Afectadas", placeholder: "Ej. morfosintaxis y fonología expresiva", defaultValue: "morfosintáctica y léxico-semántica expresiva" }
        ],
        defaultContent: `
          <p>Teniendo en cuenta la información recopilada en el proceso de valoración clínica, la anamnesis y las pruebas aplicadas, es posible concluir que <strong>[NOMBRE]</strong> presenta dificultades de grado moderado en las áreas <strong>[AREAS_AFECTADAS]</strong>, lo que resulta compatible con una impression diagnóstica fonoaudiológica presuntiva de: <strong>[DIAGNOSTICO_FONOAUDIOLOGICO]</strong>.</p>
        `,
        editable: true
      },
      {
        id: "pronostico",
        title: "Pronóstico Clínico",
        explicacion: "Indicar el tipo de pronóstico en función de la implicación familiar, la asistencia, y el potencial de aprendizaje.",
        options: [
          {
            label: "Pronóstico Favorable",
            level: "favorable",
            color: "emerald",
            text: "El pronóstico de [NOMBRE] se considera <strong>FAVORABLE</strong>. Esta presunción se fundamenta en su excelente predisposición, su alta motivación hacia las tareas de juego terapéutico, un adecuado potencial de aprendizaje demostrado en el andamiaje clínico, y la sólida presencia y compromiso de su familia para acompañar y reproducir las sugerencias en el entorno cotidiano."
          },
          {
            label: "Pronóstico Reservado / Sujeto a evolución",
            level: "reservado",
            color: "amber",
            text: "El pronóstico de [NOMBRE] se considera <strong>RESERVADO</strong> en esta instancia. El mismo se encuentra estrictamente sujeto a la regularidad y asistencia sistemática a los encuentros terapéuticos, a la evolución clínica individual del paciente ante los objetivos planteados y al compromiso familiar para implementar las adaptaciones en el hogar. Se reevaluará clínicamente en un lapso de 6 meses."
          }
        ]
      },
      {
        id: "objetivos",
        title: "Objetivos de Intervención / Tratamiento",
        explicacion: "Metas terapéuticas claras para guiar el tratamiento posterior.",
        defaultContent: `
          <p>De acuerdo con las necesidades clínicas y habilidades evidenciadas en la valoración, se plantean los siguientes objetivos terapéuticos principales:</p>
          <ul style="list-style-type: disc; padding-left: 20px;">
            <li><strong>Estimular</strong> la estructuración de oraciones completas y funcionales, fomentando la incorporación de artículos y conectores.</li>
            <li><strong>Ampliar</strong> el vocabulario expresivo activo (léxico) del niño/a por medio de campos semánticos de interés.</li>
            <li><strong>Optimizar</strong> las habilidades pragmáticas, especialmente el contacto visual espontáneo y la alternancia de turnos de habla.</li>
            <li><strong>Adecuar</strong> la claridad articulatoria y articulación de fonemas descendidos mediante el juego fonológico.</li>
            <li><strong>Brindar</strong> pautas y estrategias de andamiaje lingüístico y estimulación a los padres en el hogar.</li>
          </ul>
        `,
        editable: true
      },
      {
        id: "recomendaciones",
        title: "Recomendaciones Fonoaudiológicas",
        explicacion: "Recomendaciones terapéuticas, escolares y derivaciones.",
        variables: [
          { id: "FRECUENCIA_TERAPIA", label: "Sesiones por semana sugeridas", placeholder: "Ej. 2 veces", defaultValue: "2 veces" }
        ],
        defaultContent: `
          <p>En consecuencia a los resultados del presente informe, se sugiere con carácter prioritario:</p>
          <ol style="list-style-type: decimal; padding-left: 20px; margin-bottom: 15px;">
            <li><strong>Dar inicio al proceso terapéutico fonoaudiológico sistemático</strong> con una frecuencia sugerida de <strong>[FRECUENCIA_TERAPIA]</strong> por semana en la modalidad <strong>[MODALIDAD]</strong>.</li>
            <li>Realizar interconsulta especializada con el área de <strong>Psicopedagogía / Neuropediatría / Otorrinolaringología</strong> para un abordaje interdisciplinario.</li>
            <li>Brindar las sugerencias correspondientes al equipo docente escolar a fin de unificar criterios de estimulación en el aula.</li>
          </ol>
          <p>Ante cualquier inquietud u observación, me encuentro a entera disposición.</p>
          <p style="margin-top: 30px;">Saluda atentamente,</p>
          <p style="margin-top: 40px; line-height: 1.2;"><strong>[PROFESIONAL_NOMBRE]</strong><br/>[PROFESIONAL_TITULO]<br/>M.P. [PROFESIONAL_MATE]</p>
        `,
        editable: true
      }
    ]
  },
  proceso: {
    title: "Informe de Proceso y Avances Terapéuticos",
    sections: [
      {
        id: "info_evolucion",
        title: "Datos de Evolución Clínica",
        explicacion: "Generalidades del tratamiento y estado temporal actual.",
        variables: [
          { id: "FECHA_INICIO_TRATAMIENTO", label: "Fecha de Inicio del Tratamiento", placeholder: "Ej. Marzo de 2025", defaultValue: "Marzo de 2025" },
          { id: "SESIONES_REALIZADAS", label: "Sesiones Realizadas", placeholder: "Ej. 24 sesiones", defaultValue: "24 encuentros" }
        ],
        defaultContent: `
          <p>Se emite el presente informe de evolución clínica a fin de consignar el estado terapéutico del paciente <strong>[NOMBRE]</strong>, quien asiste a tratamiento fonoaudiológico desde <strong>[FECHA_INICIO_TRATAMIENTO]</strong> a la fecha, habiéndose completado un total de <strong>[SESIONES_REALIZADAS]</strong>.</p>
        `,
        editable: true
      },
      {
        id: "actitud_terapeutica",
        title: "Actitud del Paciente en Sesión",
        explicacion: "Predisposición del niño/a frente a la intervención, tolerancia a la frustración y juego.",
        options: [
          {
            label: "Predispuesto / Proactivo",
            level: "adecuado",
            color: "emerald",
            text: "[NOMBRE] se muestra con una excelente actitud y compromiso frente a las propuestas clínicas. Ingresa con alegría al consultorio, acepta los límites y las reglas de juego estructuradas con agrado, y muestra una alta tolerancia ante desafíos lingüísticos difíciles, persistiendo con entusiasmo y proactividad."
          },
          {
            label: "Fluctuante / Requiere reestructuración",
            level: "leve",
            color: "amber",
            text: "Durante el proceso terapéutico, la actitud de [NOMBRE] se ha manifestado de manera variable. Hay sesiones en las que se involucra con alto interés, mientras que en otras se muestra disperso/a o cansado/a, requiriendo que el profesional modifique constantemente las actividades y brinde un andamiaje continuo para sostener su motivación y evitar la frustración."
          }
        ]
      },
      {
        id: "logros_alcanzados",
        title: "Logros Clínicos Alcanzados",
        explicacion: "Describir detalladamente los objetivos terapéuticos conquistados en el lenguaje y habla.",
        defaultContent: `
          <p>Durante este período de tratamiento, ha sido posible consolidar avances significativos en el desarrollo comunicativo de <strong>[NOMBRE]</strong>:</p>
          <ul style="list-style-type: check; padding-left: 20px;">
            <li><strong>Incremento</strong> sustancial en su vocabulario activo expresivo cotidiano, reduciendo el uso de gestos instrumentales.</li>
            <li><strong>Adquisición y generalización</strong> de estructuras oracionales simples completas (Sujeto + Verbo + Objeto) con concordancia correcta.</li>
            <li><strong>Establecimiento y mantenimiento</strong> del contacto visual intencional durante los intercambios conversacionales lúdicos.</li>
            <li><strong>Avances notorios</strong> en la claridad fonética, logrando articular de forma aislada y en palabras simples los fonemas previamente omitidos.</li>
          </ul>
        `,
        editable: true
      },
      {
        id: "objetivos_pendientes",
        title: "Objetivos en Desarrollo / Faltantes",
        explicacion: "Objetivos que aún precisan estimulación continua o que no han logrado generalizarse por completo.",
        defaultContent: `
          <p>Para consolidar de forma integral el bienestar comunicativo de <strong>[NOMBRE]</strong>, se continuará trabajando activamente sobre los siguientes aspectos:</p>
          <ul style="list-style-type: circle; padding-left: 20px;">
            <li><strong>Generalizar</strong> la correcta articulación de fonemas complejos dentro de oraciones espontáneas de discurso continuo.</li>
            <li><strong>Estimular</strong> la producción morfosintáctica de oraciones coordinadas y subordinadas usando nexos diversos.</li>
            <li><strong>Consolidar</strong> el respeto por los turnos de habla ante conversaciones con pares y en contextos grupales.</li>
            <li><strong>Fomentar</strong> la autorregulación emocional y persistencia frente a consignas que presenten dificultades académicas.</li>
          </ul>
        `,
        editable: true
      },
      {
        id: "pronostico_evolutivo",
        title: "Pronóstico y Continuidad",
        explicacion: "Alineación de pronósticos con respecto a los avances.",
        options: [
          {
            label: "Favorable debido a Avances",
            level: "favorable",
            color: "emerald",
            text: "A la luz de los logros clínicos documentados, el pronóstico terapéutico de [NOMBRE] continúa siendo <strong>altamente favorable</strong>. Los significativos avances observados en este ciclo demuestran un excelente potencial evolutivo, respaldado firmemente por el continuo soporte escolar y familiar."
          },
          {
            label: "Reservado sujeto a sistematicidad",
            level: "reservado",
            color: "amber",
            text: "El pronóstico terapéutico se mantiene <strong>reservado</strong> en esta fase, sujeto de manera indispensable a sostener una regularidad estricta en la asistencia a las sesiones (evitando faltas sucesivas) y a fortalecer la realización sistemática de las tareas de refuerzo fonológico acordadas con la familia en el hogar."
          }
        ]
      }
    ]
  },
  seguimiento: {
    title: "Informe de Seguimiento",
    sections: [
      {
        id: "datos_seguimiento",
        title: "Datos del Seguimiento",
        explicacion: "Período cubierto y frecuencia de sesiones.",
        variables: [
          { id: "FECHA_VALORACION", label: "Fecha del Informe", placeholder: "Ej. 20 de Junio de 2026", defaultValue: new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) },
          { id: "SESIONES_REALIZADAS", label: "Sesiones en el Período", placeholder: "Ej. 8 encuentros", defaultValue: "8 encuentros" },
          { id: "FECHA_INICIO_TRATAMIENTO", label: "Período", placeholder: "Ej. Abril - Junio 2026", defaultValue: "" }
        ],
        defaultContent: `
          <p>Se extiende el presente informe de seguimiento correspondiente al período <strong>[FECHA_INICIO_TRATAMIENTO]</strong>, durante el cual el paciente <strong>[NOMBRE]</strong> concurre a terapia fonoaudiológica con una frecuencia de <strong>[SESIONES_REALIZADAS]</strong>.</p>
        `,
        editable: true
      },
      {
        id: "estado_actual",
        title: "Estado Actual del Paciente",
        explicacion: "Describir el estado clínico actual y comparación con eval previa.",
        options: [
          {
            label: "Evolutivamente estable / Mejoría sostenida",
            level: "adecuado",
            color: "emerald",
            text: "En el presente período se observa un paciente con evolución clínica favorable, mostrando mejoría sostenida en las áreas trabajadas. Se consolida lo abordado en etapas previas y se evidencia transferencia espontánea de habilidades a contextos comunicativos naturales."
          },
          {
            label: "Estancamiento parcial",
            level: "leve",
            color: "amber",
            text: "Si bien se observan avances en algunas áreas del abordaje, se detecta un estancamiento parcial en la consolidación de objetivos específicos, lo cual requiere reevaluar las estrategias terapéuticas y considerar la modificación del plan de tratamiento."
          },
          {
            label: "Sin cambios significativos",
            level: "severo",
            color: "red",
            text: "Durante el período analizado no se registran cambios significativos respecto a la evaluación anterior. Se sugiere una reevaluación completa del enfoque terapéutico y considerar la interconsulta con otros profesionales."
          }
        ]
      },
      {
        id: "avances_periodo",
        title: "Avances del Período",
        explicacion: "Logros específicos de este período de tratamiento.",
        editable: true,
        defaultContent: `
          <p>Los principales logros alcanzados durante este período incluyen:</p>
          <ul style="list-style-type: check; padding-left: 20px;">
            <li>[Completar con avances específicos del período]</li>
          </ul>
        `
      },
      {
        id: "objetivos_proximo_periodo",
        title: "Objetivos para el Próximo Período",
        explicacion: "Objetivos terapéuticos a trabajar en el siguiente ciclo.",
        editable: true,
        defaultContent: `
          <p>Para el próximo período se propone continuar con:</p>
          <ul style="list-style-type: circle; padding-left: 20px;">
            <li>[Completar con objetivos futuros]</li>
          </ul>
        `
      },
      {
        id: "recomendaciones_seguimiento",
        title: "Recomendaciones",
        explicacion: "Indicaciones para la familia y/o profesional derivante.",
        editable: true,
        defaultContent: `
          <p>Se recomienda:</p>
          <ol style="padding-left: 20px;">
            <li>Mantener la asistencia regular a las sesiones.</li>
            <li>Continuar con las actividades de refuerzo en el hogar.</li>
          </ol>
          <p style="margin-top: 20px;">Saluda atentamente,</p>
          <p style="margin-top: 30px; line-height: 1.2;"><strong>[PROFESIONAL_NOMBRE]</strong><br/>[PROFESIONAL_TITULO]<br/>[PROFESIONAL_MATE]</p>
        `
      }
    ]
  },
  alta: {
    title: "Informe de Alta",
    sections: [
      {
        id: "datos_alta",
        title: "Datos de la Alta",
        explicacion: "Fecha de alta, duración total del tratamiento y motivo.",
        variables: [
          { id: "FECHA_VALORACION", label: "Fecha de Alta", placeholder: "Ej. 20 de Junio de 2026", defaultValue: new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) },
          { id: "FECHA_INICIO_TRATAMIENTO", label: "Fecha de Inicio del Tratamiento", placeholder: "Ej. Enero de 2025", defaultValue: "" },
          { id: "SESIONES_REALIZADAS", label: "Total de Sesiones", placeholder: "Ej. 48 encuentros", defaultValue: "" }
        ],
        defaultContent: `
          <p>Por medio del presente informe, se deja constancia de la <strong>alta terapéutica</strong> del paciente <strong>[NOMBRE]</strong>, quien estuvo en tratamiento fonoaudiológico desde <strong>[FECHA_INICIO_TRATAMIENTO]</strong> hasta la fecha, con un total de <strong>[SESIONES_REALIZADAS]</strong> realizadas.</p>
        `,
        editable: true
      },
      {
        id: "resumen_tratamiento",
        title: "Resumen del Tratamiento",
        explicacion: "Síntesis de los objetivos trabajados y resultados obtenidos.",
        editable: true,
        defaultContent: `
          <p>A lo largo del proceso terapéutico se abordaron los siguientes ejes de intervención:</p>
          <ul style="list-style-type: check; padding-left: 20px;">
            <li>[Completar objetivos trabajados]</li>
          </ul>
          <p style="margin-top: 12px;">Los resultados obtenidos han sido satisfactorios, habiéndose alcanzado los objetivos propuestos al inicio del tratamiento.</p>
        `
      },
      {
        id: "estado_final",
        title: "Estado Final del Paciente",
        explicacion: "Estado clínico al momento de la alta.",
        options: [
          {
            label: "Alta por alta achieved",
            level: "favorable",
            color: "emerald",
            text: "Al momento de la alta, [NOMBRE] presenta un estado clínico que permite considerar finalizado el tratamiento fonoaudiológico. Las habilidades comunicativas, lingüísticas y/o articulatorias han alcanzado un nivel funcional acorde a su edad y contexto, requiriendo únicamente controles de seguimiento periódicos."
          },
          {
            label: "Alta por mejoría parcial (seguimiento sugerido)",
            level: "reservado",
            color: "amber",
            text: "Si bien [NOMBRE] ha demostrado mejoría significativa durante el tratamiento, se recomienda un seguimiento periódico cada 3 meses para monitorear la evolución y prevenir recaídas. El paciente egresa con habilidades funcionales mejoradas pero con áreas que continúan en maduración."
          }
        ]
      },
      {
        id: "controles_futuros",
        title: "Controles y Seguimiento",
        explicacion: "Indicaciones de control post-alta.",
        editable: true,
        defaultContent: `
          <p>Se sugiere:</p>
          <ul style="padding-left: 20px;">
            <li>Control de seguimiento a los 3 meses post-alta.</li>
            <li>Reevaluación completa a los 6 meses si fuera necesario.</li>
            <li>Mantener estimulación en el hogar según pautas entregadas.</li>
          </ul>
          <p style="margin-top: 20px;">Saluda atentamente,</p>
          <p style="margin-top: 30px; line-height: 1.2;"><strong>[PROFESIONAL_NOMBRE]</strong><br/>[PROFESIONAL_TITULO]<br/>[PROFESIONAL_MATE]</p>
        `
      }
    ]
  },
  derivacion: {
    title: "Informe de Derivación",
    sections: [
      {
        id: "datos_derivacion",
        title: "Datos de la Derivación",
        explicacion: "Profesional/centro derivador y motivo de la derivación.",
        variables: [
          { id: "DERIVANTE", label: "Profesional Derivante", placeholder: "Ej. Dr. García - Neurología", defaultValue: "" },
          { id: "FECHA_VALORACION", label: "Fecha", placeholder: "Ej. 20 de Junio de 2026", defaultValue: new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) }
        ],
        defaultContent: `
          <p>Se comunica a <strong>[DERIVANTE]</strong> el resultado de la evaluación fonoaudiológica realizada al paciente <strong>[NOMBRE]</strong> con fecha <strong>[FECHA_VALORACION]</strong>, a fin de contribuir al abordaje interdisciplinario del caso.</p>
        `,
        editable: true
      },
      {
        id: "motivo_evaluacion",
        title: "Motivo de la Evaluación",
        explicacion: "Razón por la cual se realizó la evaluación fonoaudiológica.",
        editable: true,
        defaultContent: `<p>[Completar motivo de la evaluación]</p>`
      },
      {
        id: "resultados_evaluacion",
        title: "Resultados de la Evaluación",
        explicacion: "Hallazgos principales de la evaluación fonoaudiológica.",
        editable: true,
        defaultContent: `<p>[Completar resultados y hallazgos]</p>`
      },
      {
        id: "diagnostico_fono",
        title: "Diagnóstico Fonoaudiológico",
        explicacion: "Impresión diagnóstica fonoaudiológica.",
        editable: true,
        defaultContent: `<p>[Completar diagnóstico fonoaudiológico]</p>`
      },
      {
        id: "tratamiento_sugerido",
        title: "Tratamiento Sugerido",
        explicacion: "Plan de tratamiento recomendado y derivación a tratamiento.",
        editable: true,
        defaultContent: `
          <p>Se recomienda iniciar tratamiento fonoaudiológico con la siguiente frecuencia y objetivos:</p>
          <ul style="padding-left: 20px;">
            <li>[Completar plan sugerido]</li>
          </ul>
        `
      },
      {
        id: "cierre_derivacion",
        title: "Cierre",
        explicacion: "Disponibilidad para coordinar y contacto.",
        editable: true,
        defaultContent: `
          <p>Quedo a disposición para coordinar el abordaje interdisciplinario y realizar seguimiento conjunto del caso.</p>
          <p style="margin-top: 20px;">Saluda atentamente,</p>
          <p style="margin-top: 30px; line-height: 1.2;"><strong>[PROFESIONAL_NOMBRE]</strong><br/>[PROFESIONAL_TITULO]<br/>[PROFESIONAL_MATE]</p>
        `
      }
    ]
  },
  interconsulta: {
    title: "Informe de Interconsulta",
    sections: [
      {
        id: "datos_interconsulta",
        title: "Datos de la Interconsulta",
        explicacion: "Profesionales intervinientes y contexto.",
        variables: [
          { id: "DERIVANTE", label: "Profesional Interconsultado", placeholder: "Ej. Lic. Martínez - Psicología", defaultValue: "" },
          { id: "FECHA_VALORACION", label: "Fecha", placeholder: "Ej. 20 de Junio de 2026", defaultValue: new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) }
        ],
        defaultContent: `
          <p>Se realiza la presente interconsulta a <strong>[DERIVANTE]</strong> con el objetivo de coordinar el abordaje interdisciplinario del paciente <strong>[NOMBRE]</strong>.</p>
        `,
        editable: true
      },
      {
        id: "resumen_caso",
        title: "Resumen del Caso",
        explicacion: "Breve reseña del caso clínico desde la perspectiva fonoaudiológica.",
        editable: true,
        defaultContent: `<p>[Completar resumen del caso]</p>`
      },
      {
        id: "consulta_especifica",
        title: "Consulta Específica",
        explicacion: "Qué se consulta al profesional interconsultado.",
        editable: true,
        defaultContent: `<p>[Completar consulta específica al profesional]</p>`
      },
      {
        id: "coordinacion_abordaje",
        title: "Propuesta de Coordinación",
        explicacion: "Propuesta de trabajo conjunto.",
        editable: true,
        defaultContent: `
          <p>Se propone:</p>
          <ul style="padding-left: 20px;">
            <li>[Completar propuesta de coordinación]</li>
          </ul>
        `
      },
      {
        id: "cierre_interconsulta",
        title: "Cierre",
        explicacion: "Disponibilidad y contacto.",
        editable: true,
        defaultContent: `
          <p>Saludo cordialmente y quedo a disposición para coordinar.</p>
          <p style="margin-top: 20px; line-height: 1.2;"><strong>[PROFESIONAL_NOMBRE]</strong><br/>[PROFESIONAL_TITULO]<br/>[PROFESIONAL_MATE]</p>
        `
      }
    ]
  }
};

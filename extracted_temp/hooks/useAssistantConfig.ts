import { useMemo } from 'react';
import { useSettings } from '../context/SettingsContext';
import { Patient, Appointment } from '../types';

interface AssistantConfig {
  voice: {
    name: string;
    speed: number;
    language: string;
    tone: 'neutral' | 'professional' | 'warm';
  };
  proactivity: 'minimal' | 'balanced' | 'proactive';
  contextAwareness: boolean;
  chatPersistence: boolean;
  permissions: {
    canAccessAgenda: boolean;
    canAccessPatients: boolean;
    canAccessHistory: boolean;
    canAccessDatabase: boolean;
    canCreateSuggestions: boolean;
    canAutoAlert: boolean;
  };
  buildSystemInstruction: (
    today: string,
    todayAppointments: Appointment[],
    patients: Patient[],
    longitudinalContext?: string,
    professionalName?: string,
    professionalRole?: string,
    professionalId?: string
  ) => string;
  buildVoiceSystemInstruction: (
    today: string,
    todayAppointments: Appointment[],
    patients: Patient[],
    professionalName?: string,
    professionalRole?: string,
    professionalId?: string
  ) => string;
  filterToolsByPermissions: (tools: any[]) => any[];
}

const VOICE_MAP: Record<string, string> = {
  neutral: 'Charon',
  professional: 'Aoede',
  warm: 'Puck',
};

const TONE_INSTRUCTIONS: Record<string, string> = {
  neutral: 'Respondé de forma natural y directa.',
  professional: 'Usá un tono clínico profesional, preciso y formal.',
  warm: 'Sé cálido, empático y cercano, como un colega de confianza.',
};

const PROACTIVITY_INSTRUCTIONS: Record<string, string> = {
  minimal: 'Solo respondé cuando te pidan algo explícitamente. No sugieras acciones adicionales.',
  balanced: 'Respondé a lo que te piden y, si ves algo relevante en los datos del paciente, mencionalo brevemente.',
  proactive: 'Sé proactivo: analizá los datos del paciente, sugirí acciones, alertá sobre problemas potenciales y proponé planes de seguimiento. Iniciá conversación sobre lo que veas relevante.',
};

const TOOL_PERMISSIONS: Record<string, keyof AssistantConfig['permissions']> = {
  navigate: 'canAccessAgenda',
  get_agenda: 'canAccessAgenda',
  open_editor: 'canAccessPatients',
  write_in_editor: 'canAccessPatients',
  update_patient_info: 'canAccessPatients',
  analyze_patient_case: 'canAccessHistory',
  check_missing_data: 'canAccessDatabase',
  create_patient: 'canAccessPatients',
  create_appointment: 'canAccessAgenda',
  update_appointment_status: 'canAccessAgenda',
  send_telegram_message: 'canAccessDatabase',
  send_patient_summary: 'canAccessPatients',
  send_telegram_media: 'canAccessDatabase',
  send_telegram_reminder: 'canAccessDatabase',
  create_report: 'canAccessPatients',
  get_patient_documents: 'canAccessPatients',
  list_all_patients: 'canAccessPatients',
  get_patient_info: 'canAccessPatients',
  search_patients: 'canAccessPatients',
  list_consultorios: 'canAccessDatabase',
  get_patients_by_consultorio: 'canAccessPatients',
  get_statistics: 'canAccessDatabase',
  update_treatment_plan: 'canAccessPatients',
  add_evaluation: 'canAccessPatients',
  get_patient_reports: 'canAccessPatients',
  delete_appointment: 'canAccessAgenda',
  update_appointment: 'canAccessAgenda',
  delete_patient: 'canAccessPatients',
  add_patient_note: 'canAccessPatients',
  get_recent_activity: 'canAccessDatabase',
  add_clinical_fact: 'canAccessHistory',
  get_clinical_facts: 'canAccessHistory',
  get_module_analysis: 'canAccessHistory',
  list_sessions: 'canAccessHistory',
  get_followup_alerts: 'canAccessPatients',
  add_evolution_entry: 'canAccessHistory',
  get_evolution_status: 'canAccessHistory',
  get_nba_suggestions: 'canAccessPatients',
  generate_home_guide: 'canAccessPatients',
  search_materials: 'canAccessDatabase',
  generate_content: 'canAccessDatabase',
  get_test_results: 'canAccessPatients',
  sync_google_calendar: 'canAccessAgenda',
  create_meet_link: 'canAccessAgenda',
  get_finance_summary: 'canAccessDatabase',
  record_payment: 'canAccessDatabase',
  toggle_dark_mode: 'canAccessDatabase',
  get_professional_info: 'canAccessDatabase',
  notebook_list: 'canAccessDatabase',
  notebook_create: 'canAccessDatabase',
  notebook_add_source: 'canAccessDatabase',
  notebook_ask: 'canAccessDatabase',
  notebook_generate: 'canAccessDatabase',
  notebook_summary: 'canAccessDatabase',
  notebook_list_artifacts: 'canAccessDatabase',
};

export function useAssistantConfig(): AssistantConfig {
  const { settings } = useSettings();
  const { assistant } = settings;

  return useMemo(() => ({
    voice: {
      name: VOICE_MAP[assistant.voiceTone] || 'Charon',
      speed: assistant.voiceSpeed,
      language: assistant.voiceLanguage,
      tone: assistant.voiceTone,
    },
    proactivity: assistant.proactivity,
    contextAwareness: assistant.contextAwareness,
    chatPersistence: assistant.chatPersistence,
    permissions: assistant.permissions,
    buildSystemInstruction: (today: string, todayAppointments: Appointment[], patients: Patient[], longitudinalContext?: string, professionalName?: string, professionalRole?: string, professionalId?: string) => {
      const toneInstruction = TONE_INSTRUCTIONS[assistant.voiceTone] || TONE_INSTRUCTIONS.neutral;
      const proactivityInstruction = PROACTIVITY_INSTRUCTIONS[assistant.proactivity] || PROACTIVITY_INSTRUCTIONS.balanced;
      const pendingCount = todayAppointments.filter(a => a.status === 'pending').length;
      const completedCount = todayAppointments.filter(a => a.status === 'completed').length;
      const patientCount = patients.length;

      // Time awareness for voice assistant
      const now = new Date();
      const timeOpts = { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit', hour12: false };
      const currentTime = now.toLocaleTimeString('es-AR', timeOpts as any);
      const currentHour = parseInt(now.toLocaleTimeString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', hour12: false }));

      // Build appointment schedule with time-relative labels
      let appointmentSchedule = '';
      if (todayAppointments.length > 0) {
        appointmentSchedule = '\nAGENDA DE HOY (con hora actual: ' + currentTime + ' hs):\n';
        appointmentSchedule += todayAppointments.map(a => {
          const timeStr = a.time || '';
          const [aH, aM] = timeStr.split(':').map(Number);
          const diffMin = (aH * 60 + aM) - (currentHour * 60 + parseInt(now.toLocaleTimeString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', minute: '2-digit', hour12: false })));
          let timing = '';
          if (diffMin < -60) timing = 'YA PASÓ';
          else if (diffMin < 0) timing = 'EN CURSO';
          else if (diffMin <= 30) timing = 'PRÓXIMA (' + diffMin + ' min)';
          else timing = 'AÚN NO LLEGA';
          return `- ${timeStr} hs: ${a.patient_name || 'Sin nombre'} (${a.status || 'pending'}) — ${timing}`;
        }).join('\n');
      }

      let contextBlock = '';
      if (assistant.contextAwareness) {
        const recentPatients = patients.slice(0, 5).map(p =>
          `- ${p.name}: ${p.diagnosis || 'sin diagnóstico'}`
        ).join('\n');
        contextBlock = `
CONTEXTO CLÍNICO ACTIVO:
- ${patientCount} pacientes en sistema
- Citas hoy: ${pendingCount} pendientes, ${completedCount} completadas
Pacientes recientes:
${recentPatients || '(ninguno cargado aún)'}`;
      }

      let longitudinalBlock = '';
      if (longitudinalContext) {
        longitudinalBlock = `
CONTEXTO LONGITUDINAL DEL PACIENTE:
${longitudinalContext}`;
      }

      const professionalBlock = professionalName
        ? `\n═══ PROFESIONAL LOGUEADO ═══\nNombre: ${professionalName}\nRol: ${professionalRole || 'Profesional'}\nID: ${professionalId || 'no disponible'}\nCuando crees una cita, usá "${professionalId || professionalName}" como professional_id en los datos de la cita.`
        : '';

      return `Sos Fono-Pro AI, asistente de fonoaudiología clínica. Sos experto en manejar TODA la información de la app.

═══ HORA ACTUAL (CRÍTICO) ═══
Hoy es ${today}. Son las ${currentTime} hs (hora Buenos Aires, Argentina).
USÁ ESTA HORA PARA INTERPRETAR LA AGENDA: si una cita es a las 09:00 y son las 00:30, esa cita AÚN NO LLEGÓ. Si son las 14:00 y la cita era a las 09:00, YA PASÓ.
${appointmentSchedule}
${professionalBlock}
${toneInstruction}
${proactivityInstruction}
${contextBlock}
${longitudinalBlock}

═══ CAPACIDADES COMPLETAS ═══

NAVEGACIÓN:
- navigate: Navegá a cualquier sección (dashboard, consultorios, patients, agenda, telegram, followup, metrics, analytics, reports, library, multimedia, settings, sources, notebooklm)
  - navigate view:"consultorios" → Abre la grilla de consultorios
  - navigate view:"patients" → Abre la sección de pacientes
  - navigate view:"telegram" → Abre el Canal Clínico (Telegram)
  - navigate view:"sources" → Abre Fuentes Clínicas (base de conocimiento + generación IA)
  - navigate view:"notebooklm" → Abre NotebookLM (investigación con IA de Google)
  - navigate view:"multimedia" → Abre el creador de materiales multimedia
  - navigate patientName:"Juan" → Abre la ficha de Juan

PACIENTES:
- list_all_patients: Lista todos los pacientes (nombre, edad, diagnóstico, consultorio)
- get_patient_info: Info completa de un paciente (demografía, diagnóstico, historial, tratamientos, informes)
- search_patients: Busca por nombre, diagnóstico o notas
- create_patient: Crea paciente nuevo (nombre, edad, diagnóstico, teléfono)
- update_patient_info: Actualiza diagnóstico, notas o teléfono
- delete_patient: Elimina un paciente
- add_patient_note: Agrega nota clínica con timestamp
- check_missing_data: Detecta pacientes sin documento, teléfono, etc.

CONSULTORIOS:
- list_consultorios: Lista todos los consultorios/ambulatorios del sistema
- get_patients_by_consultorio: Muestra pacientes de un consultorio específico

AGENDA:
- get_agenda: Agenda de hoy + futuras (NUNCA muestra pasadas)
- create_appointment: Crea cita (paciente, fecha, hora, tipo)
- update_appointment: Modifica cita existente
- update_appointment_status: Cambia estado (completada, cancelada, confirmada)
- delete_appointment: Elimina una cita
- sync_google_calendar: Sincroniza con Google Calendar
- create_meet_link: Genera enlace de Google Meet

CLÍNICA:
- open_editor: Abre plan de tratamiento o informe
- update_treatment_plan: Actualiza plan de tratamiento
- add_evaluation: Agrega evaluación clínica (test, puntuación, notas)
- get_patient_reports: Lista informes de un paciente
- create_report: Genera informe (valoración, proceso, seguimiento, alta, derivación, interconsulta)
- get_patient_documents: Documentos y reportes del paciente

MÓDULOS CLÍNICOS (voz, audición, cognición, lenguaje, motricidad, deglución):
- add_clinical_fact: Registra signo/hecho clínico en un módulo
- get_clinical_facts: Muestra signos/hechos clínicos de un paciente
- get_module_analysis: Análisis de un módulo (riesgo, banderas rojas, observaciones)

EVOLUCIÓN:
- add_evolution_entry: Registra entrada de evolución (eje, notas, nivel de riesgo)
- get_evolution_status: Estado actual de un eje (riesgo, tendencia, hallazgos)

SESIONES:
- list_sessions: Lista sesiones de un paciente

SEGUIMIENTO:
- get_followup_alerts: Alertas de seguimiento pendientes

NBA (SUGERENCIAS INTELIGENTES):
- get_nba_suggestions: Sugierencias pendientes de un paciente

GUÍAS PARA EL HOGAR:
- generate_home_guide: Genera borrador de guía

TESTS:
- get_test_results: Resultados de tests estandarizados

MATERIALES:
- search_materials: Busca materiales por título, área o tipo
- generate_content: Genera contenido clínico con IA (listas de palabras, actividades, guías para padres, posts para redes, etc.)
  - generate_content prompt:"lista de 30 palabras con complejo LRD" clinicalArea:"Lenguaje"
  - generate_content prompt:"guía para padres de niño con dislalia" clinicalArea:"Habla"
  - generate_content prompt:"post de Instagram sobre terapia de voz" clinicalArea:"Voz"

ESTADÍSTICAS Y ACTIVIDAD:
- get_statistics: Resumen general (total pacientes, citas, consultorios)
- get_recent_activity: Actividad reciente de la app

FINANZAS:
- get_finance_summary: Resumen financiero (ingresos, pendientes)
- record_payment: Registra un pago

INTEGRACIONES:
- send_telegram_message: Envía mensaje por Telegram
- send_patient_summary: Envía resumen clínico por Telegram
- send_telegram_reminder: Envía recordatorio con emojis
- NotebookLM: crear cuadernos, buscar fuentes, generar materiales

CONFIGURACIÓN:
- toggle_dark_mode: Cambia modo claro/oscuro
- get_professional_info: Info del profesional logueado

Cuando te pregunten por la agenda, USÁ LA HORA ACTUAL para decir qué citas ya pasaron, cuál está próxima y cuál es más tarde.
NUNCA recomiendas acciones para citas que YA PASARON. Si el usuario pregunta por una cita pasada, decile que esa fecha ya pasó y preguntá si quiere reprogramarla.
Cuando filtres o listes citas, PRIORIZÁ las de HOY y las FUTURAS. Las citas pasadas solo mencionalas si el usuario pregunta explícitamente por historial.
Siempre priorizá la precisión clínica y la seguridad del paciente.

═══ REGLAS DE COMPORTAMIENTO ═══
DESPUÉS de ejecutar cualquier herramienta, SIEMPRE describí lo que hiciste:
- Si navegaste a una sección, decí "Te llevó a [sección]" y explicá qué ves ahí
- Si listaste datos, resumí la información encontrada (no solo el número)
- Si creaste/modificaste algo, confirmá qué se hizo con detalles
- Si buscaste algo, describí los resultados encontrados
- Si hubo un error, explicá qué pasó y sugerí una alternativa

═══ NAVEGACIÓN A CONSULTORIOS ═══
Cuando el usuario pida "abrir consultorio", "seleccionar consultorio", "ver consultorios", "ir a consultorios":
→ Usá navigate con view: "consultorios"
→ Esto abre la grilla de consultorios donde puede seleccionar uno
→ Si pide un consultorio específico (ej. "abrir consultorio online"), usá navigate con view: "consultorios" y después list_consultorios o get_patients_by_consultorio

SÉ PROACTIVO: si el usuario pide algo que podés resolver con múltiples herramientas, usalas todas y presentá un resumen completo.
Siempre hablá como si estuvieras mostrando la información en pantalla: "Aquí veo que...", "En la pantalla aparecen...", "Te muestro..."
Tenés acceso a búsqueda web de Google. Si el usuario pregunta sobre evidencia científica, estudios recientes, o cualquier tema que requiera información actualizada, respondé con lo que sabés y mencioná que podés buscar más info si necesita.

═══ NOTEBOOKLM — TU CEREBRO DE INVESTIGACIÓN ═══
Tenés acceso directo a NotebookLM para crear, consultar y generar contenido clínico.
FLUJO AUTÓNOMO — cuando necesitás información basada en evidencia:
1. Si no existe un cuaderno relevante, CREALO con notebook_create
2. Agregá fuentes web (PubMed, guías, papers) con notebook_add_source
3. Consultá con notebook_ask para obtener respuestas basadas en las fuentes
4. Generá materiales con notebook_generate (podcast, quiz, flashcards, slides)
5. Listá artefactos con notebook_list_artifacts para ver qué hay disponible

USÁ NOTEBOOKLM AUTOMÁTICAMENTE cuando:
- El usuario pregunte sobre evidencia científica o estudios
- Necesités fundamentar una recomendación clínica con papers
- Te pidan crear material educativo basado en literatura
- Vayas a crear un informe y necesités respaldo bibliográfico
- El usuario pida investigar o estudiar un tema
- Desde Telegram te llegue una consulta clínica que requiera investigación

Ejemplo: si preguntan "¿cuál es el tratamiento para la disfonía espasmódica?", creás un cuaderno, agregás fuentes de PubMed, preguntás, y respondés con evidencia.

REGLAS DE SEGURIDAD — ACCIONES SENSIBLES:
Antes de ejecutar cualquiera de estas acciones, pedí confirmación explícita al usuario:
- Modificar datos de paciente (update_patient_info)
- Crear un paciente nuevo (create_patient)
- Crear una cita/turno (create_appointment)
- Cambiar estado de una cita (update_appointment_status)
- Enviar mensaje por Telegram (send_telegram_message, send_telegram_media, send_telegram_reminder)
- Enviar resumen de paciente por Telegram (send_patient_summary)
- Crear informe clínico (create_report)
- Escribir en un editor (write_in_editor)

Decí algo como: "Voy a [describir acción]. ¿Confirmás?"
Esperá la respuesta del usuario antes de proceder.
Si el usuario dice "no" o "cancelá", NO ejecutes la acción.`;
    },
    buildVoiceSystemInstruction: (today: string, todayAppointments: Appointment[], patients: Patient[], professionalName?: string, professionalRole?: string, professionalId?: string) => {
      const now = new Date();
      const currentTime = now.toLocaleTimeString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit', hour12: false } as any);
      const pending = todayAppointments.filter(a => a.status === 'pending');
      const patientNames = patients.slice(0, 8).map(p => p.name).join(', ');

      return `Sos Fono-Pro AI. Hoy es ${today} ${currentTime} hs (Buenos Aires, Argentina). Profesional: ${professionalName || 'Profesional'} (${professionalRole || 'fonoaudiólogo'}).
Pacientes: ${patientNames || 'ninguno'}. Citas pendientes HOY: ${pending.length}.
USÁ LA HORA ACTUAL para saber qué citas ya pasaron, cuál está próxima y cuál es después. NUNCA recomiendes acciones para citas pasadas.
Sé breve y directo. Respondé en 1-2 oraciones. Acciones: navigate, open_editor, update_patient_info, get_agenda, create_appointment, update_appointment_status, send_telegram_message, send_patient_summary, send_telegram_reminder, create_report.
Pedí confirmación antes de crear/modificar/enviar algo.`;
    },
    filterToolsByPermissions: (tools: any[]) => {
      if (!tools.length) return tools;
      return tools.map(toolGroup => {
        if (!toolGroup.functionDeclarations) return toolGroup;
        return {
          ...toolGroup,
          functionDeclarations: toolGroup.functionDeclarations.filter((decl: any) => {
            const permission = TOOL_PERMISSIONS[decl.name];
            return !permission || assistant.permissions[permission];
          }),
        };
      });
    },
  }), [assistant]);
}

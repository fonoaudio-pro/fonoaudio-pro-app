import { Type as GenAIType } from "@google/genai";

// Comprehensive tool definitions for voice assistant with full control
export const assistantTools = [
    {
        functionDeclarations: [
            // ===== NAVIGATION & UI =====
            {
                name: "navigate",
                description: "Navega a diferentes secciones de la app y muestra la pantalla al usuario.",
                parameters: {
                    type: GenAIType.OBJECT,
                    properties: {
                        view: { type: GenAIType.STRING, enum: ["dashboard", "consultorios", "patients", "agenda", "reports", "sources", "notebooklm", "multimedia", "telegram"], description: "Vista a mostrar" },
                        patientName: { type: GenAIType.STRING, description: "Nombre del paciente para navegar a su perfil" },
                        tab: { type: GenAIType.STRING, enum: ["general", "evaluations", "notes"], description: "Pestaña específica del perfil del paciente" }
                    },
                    required: ["view"]
                }
            },
            {
                name: "show_visual_feedback",
                description: "Muestra un mensaje visual en pantalla mientras hablas con el usuario.",
                parameters: {
                    type: GenAIType.OBJECT,
                    properties: {
                        message: { type: GenAIType.STRING, description: "Mensaje a mostrar visualmente" },
                        type: { type: GenAIType.STRING, enum: ["info", "success", "warning", "error"], description: "Tipo de mensaje" }
                    },
                    required: ["message"]
                }
            },

            // ===== PATIENT MANAGEMENT (FULL CRUD) =====
            {
                name: "create_patient",
                description: "Crea un nuevo paciente con todos los datos proporcionados.",
                parameters: {
                    type: GenAIType.OBJECT,
                    properties: {
                        name: { type: GenAIType.STRING, description: "Nombre completo" },
                        age: { type: GenAIType.NUMBER, description: "Edad" },
                        diagnosis: { type: GenAIType.STRING, description: "Diagnóstico" },
                        phone: { type: GenAIType.STRING, description: "Teléfono" },
                        email: { type: GenAIType.STRING, description: "Email" },
                        document: { type: GenAIType.STRING, description: "DNI/Documento" },
                        location: { type: GenAIType.STRING, description: "Centro, consultorio, clínica o lugar de atención" },
                        notes: { type: GenAIType.STRING, description: "Notas adicionales" }
                    },
                    required: ["name", "age"]
                }
            },
            {
                name: "update_patient",
                description: "Actualiza CUALQUIER campo de un paciente existente. Puedes actualizar múltiples campos a la vez.",
                parameters: {
                    type: GenAIType.OBJECT,
                    properties: {
                        patientName: { type: GenAIType.STRING, description: "Nombre del paciente a actualizar" },
                        name: { type: GenAIType.STRING, description: "Nuevo nombre" },
                        age: { type: GenAIType.NUMBER, description: "Nueva edad" },
                        diagnosis: { type: GenAIType.STRING, description: "Nuevo diagnóstico" },
                        phone: { type: GenAIType.STRING, description: "Nuevo teléfono" },
                        email: { type: GenAIType.STRING, description: "Nuevo email" },
                        document: { type: GenAIType.STRING, description: "Nuevo documento" },
                        location: { type: GenAIType.STRING, description: "Nuevo centro, consultorio o clínica" },
                        notes: { type: GenAIType.STRING, description: "Nuevas notas" }
                    },
                    required: ["patientName"]
                }
            },
            {
                name: "delete_patient",
                description: "Elimina un paciente y todos sus datos asociados.",
                parameters: {
                    type: GenAIType.OBJECT,
                    properties: {
                        patientName: { type: GenAIType.STRING, description: "Nombre del paciente a eliminar" }
                    },
                    required: ["patientName"]
                }
            },
            {
                name: "get_patient_info",
                description: "Obtiene TODA la información de un paciente: historial completo, evaluaciones, documentos, reportes y alertas de datos faltantes.",
                parameters: {
                    type: GenAIType.OBJECT,
                    properties: {
                        patientName: { type: GenAIType.STRING, description: "Nombre del paciente" }
                    },
                    required: ["patientName"]
                }
            },
            {
                name: "get_patient_reports",
                description: "Obtiene el contenido completo de los informes de un paciente.",
                parameters: {
                    type: GenAIType.OBJECT,
                    properties: {
                        patientName: { type: GenAIType.STRING, description: "Nombre del paciente" },
                        reportType: { type: GenAIType.STRING, description: "Tipo de informe a buscar (opcional)" },
                        limit: { type: GenAIType.NUMBER, description: "Cantidad de informes a traer (default: 3)" }
                    },
                    required: ["patientName"]
                }
            },
            {
                name: "add_patient_general_note",
                description: "Agrega una nota general al perfil del paciente (no es una nota de sesión, sino una observación general en su ficha).",
                parameters: {
                    type: GenAIType.OBJECT,
                    properties: {
                        patientName: { type: GenAIType.STRING, description: "Nombre del paciente" },
                        note: { type: GenAIType.STRING, description: "Contenido de la nota a agregar" }
                    },
                    required: ["patientName", "note"]
                }
            },
            {
                name: "list_all_patients",
                description: "Lista todos los pacientes con sus datos básicos.",
                parameters: {
                    type: GenAIType.OBJECT,
                    properties: {}
                }
            },

            // ===== APPOINTMENTS (FULL CRUD) =====
            {
                name: "create_appointment",
                description: "Crea una nueva cita para un paciente.",
                parameters: {
                    type: GenAIType.OBJECT,
                    properties: {
                        patientName: { type: GenAIType.STRING, description: "Nombre del paciente" },
                        date: { type: GenAIType.STRING, description: "Fecha en formato YYYY-MM-DD" },
                        time: { type: GenAIType.STRING, description: "Hora en formato HH:MM" },
                        type: { type: GenAIType.STRING, description: "Tipo de cita (terapia, evaluación, etc.)" },
                        notes: { type: GenAIType.STRING, description: "Notas de la cita" }
                    },
                    required: ["patientName", "date", "time"]
                }
            },
            {
                name: "update_appointment",
                description: "Actualiza una cita existente (fecha, hora, estado, tipo, notas).",
                parameters: {
                    type: GenAIType.OBJECT,
                    properties: {
                        patientName: { type: GenAIType.STRING, description: "Nombre del paciente" },
                        date: { type: GenAIType.STRING, description: "Nueva fecha YYYY-MM-DD" },
                        time: { type: GenAIType.STRING, description: "Nueva hora HH:MM" },
                        status: { type: GenAIType.STRING, enum: ["pending", "completed", "cancelled"], description: "Nuevo estado" },
                        type: { type: GenAIType.STRING, description: "Nuevo tipo" },
                        notes: { type: GenAIType.STRING, description: "Nuevas notas" }
                    },
                    required: ["patientName"]
                }
            },
            {
                name: "delete_appointment",
                description: "Elimina una cita.",
                parameters: {
                    type: GenAIType.OBJECT,
                    properties: {
                        patientName: { type: GenAIType.STRING, description: "Nombre del paciente" },
                        date: { type: GenAIType.STRING, description: "Fecha de la cita YYYY-MM-DD" }
                    },
                    required: ["patientName", "date"]
                }
            },
            {
                name: "get_agenda",
                description: "Consulta la agenda. Puede filtrar por fecha o mostrar todas las citas pendientes.",
                parameters: {
                    type: GenAIType.OBJECT,
                    properties: {
                        date: { type: GenAIType.STRING, description: "Fecha específica YYYY-MM-DD (opcional)" }
                    }
                }
            },

            // ===== REPORTS & DOCUMENTS =====
            {
                name: "create_report",
                description: "Crea un nuevo informe para un paciente.",
                parameters: {
                    type: GenAIType.OBJECT,
                    properties: {
                        patientName: { type: GenAIType.STRING, description: "Nombre del paciente" },
                        type: { type: GenAIType.STRING, enum: ["valoracion", "seguimiento", "area_especifica", "vocal", "perito"], description: "Tipo de informe" },
                        title: { type: GenAIType.STRING, description: "Título del informe" },
                        content: { type: GenAIType.STRING, description: "Contenido HTML del informe" }
                    },
                    required: ["patientName", "type", "title", "content"]
                }
            },
            {
                name: "update_report",
                description: "Actualiza un informe existente.",
                parameters: {
                    type: GenAIType.OBJECT,
                    properties: {
                        patientName: { type: GenAIType.STRING, description: "Nombre del paciente" },
                        reportId: { type: GenAIType.STRING, description: "ID del informe" },
                        title: { type: GenAIType.STRING, description: "Nuevo título" },
                        content: { type: GenAIType.STRING, description: "Nuevo contenido HTML" }
                    },
                    required: ["patientName", "reportId"]
                }
            },
            {
                name: "delete_report",
                description: "Elimina un informe.",
                parameters: {
                    type: GenAIType.OBJECT,
                    properties: {
                        patientName: { type: GenAIType.STRING, description: "Nombre del paciente" },
                        reportId: { type: GenAIType.STRING, description: "ID del informe" }
                    },
                    required: ["patientName", "reportId"]
                }
            },

            // ===== EVALUATIONS =====
            {
                name: "add_evaluation",
                description: "Agrega una evaluación/prueba a un paciente.",
                parameters: {
                    type: GenAIType.OBJECT,
                    properties: {
                        patientName: { type: GenAIType.STRING, description: "Nombre del paciente" },
                        testName: { type: GenAIType.STRING, description: "Nombre de la prueba" },
                        score: { type: GenAIType.NUMBER, description: "Puntuación obtenida" },
                        maxScore: { type: GenAIType.NUMBER, description: "Puntuación máxima" },
                        date: { type: GenAIType.STRING, description: "Fecha YYYY-MM-DD" },
                        notes: { type: GenAIType.STRING, description: "Notas adicionales" }
                    },
                    required: ["patientName", "testName", "score", "maxScore"]
                }
            },
            {
                name: "update_evaluation",
                description: "Actualiza una evaluación existente.",
                parameters: {
                    type: GenAIType.OBJECT,
                    properties: {
                        patientName: { type: GenAIType.STRING, description: "Nombre del paciente" },
                        evaluationId: { type: GenAIType.STRING, description: "ID de la evaluación" },
                        score: { type: GenAIType.NUMBER, description: "Nueva puntuación" },
                        notes: { type: GenAIType.STRING, description: "Nuevas notas" }
                    },
                    required: ["patientName", "evaluationId"]
                }
            },

            // ===== TREATMENT PLAN =====
            {
                name: "update_treatment_plan",
                description: "Actualiza el plan de tratamiento de un paciente.",
                parameters: {
                    type: GenAIType.OBJECT,
                    properties: {
                        patientName: { type: GenAIType.STRING, description: "Nombre del paciente" },
                        general: { type: GenAIType.STRING, description: "Objetivo general" },
                        specific: { type: GenAIType.ARRAY, items: { type: GenAIType.STRING }, description: "Objetivos específicos" },
                        strategies: { type: GenAIType.STRING, description: "Estrategias y metodología (HTML)" }
                    },
                    required: ["patientName"]
                }
            },

            // ===== EDITOR CONTROL (REAL-TIME) =====
            {
                name: "get_editor_content",
                description: "Obtiene el contenido actual del editor (HTML o texto). Útil para leer lo que hay antes de editar.",
                parameters: {
                    type: GenAIType.OBJECT,
                    properties: {
                        format: { type: GenAIType.STRING, enum: ["html", "text"], description: "Formato deseado (default: html)" }
                    }
                }
            },
            {
                name: "open_editor",
                description: "Abre un editor visual (plan de tratamiento o informe) y navega a esa pantalla.",
                parameters: {
                    type: GenAIType.OBJECT,
                    properties: {
                        type: { type: GenAIType.STRING, enum: ["treatment_plan", "report"], description: "Tipo de editor" },
                        patientName: { type: GenAIType.STRING, description: "Nombre del paciente" },
                        reportType: { type: GenAIType.STRING, enum: ["evaluacion", "seguimiento"], description: "Tipo de informe si type=report" }
                    },
                    required: ["type"]
                }
            },
            {
                name: "write_in_editor",
                description: "Escribe texto en el editor abierto. El usuario verá el texto aparecer en tiempo real mientras hablas.",
                parameters: {
                    type: GenAIType.OBJECT,
                    properties: {
                        content: { type: GenAIType.STRING, description: "Contenido a escribir (puede ser HTML)" },
                        mode: { type: GenAIType.STRING, enum: ["replace", "append", "insert"], description: "Reemplazar todo, agregar al final, o insertar en cursor" }
                    },
                    required: ["content"]
                }
            },
            {
                name: "insert_at_cursor",
                description: "Inserta texto en la posición actual del cursor en el editor abierto. Útil para agregar contenido específico sin alterar el resto.",
                parameters: {
                    type: GenAIType.OBJECT,
                    properties: {
                        content: { type: GenAIType.STRING, description: "Contenido a insertar" },
                        formatting: { type: GenAIType.STRING, enum: ["normal", "bold", "italic", "heading"], description: "Formato del texto (opcional)" }
                    },
                    required: ["content"]
                }
            },
            {
                name: "replace_text",
                description: "Busca y reemplaza texto específico en el editor actual. Úsalo para corregir datos puntuales, actualizar secciones específicas (ej: cambiar solo el diagnóstico) o llenar placeholders. NO uses esto para reescribir todo el documento.",
                parameters: {
                    type: GenAIType.OBJECT,
                    properties: {
                        searchText: { type: GenAIType.STRING, description: "Texto exacto a buscar o fragmento único que identifique la sección" },
                        replaceWith: { type: GenAIType.STRING, description: "Nuevo contenido para esa sección" },
                        replaceAll: { type: GenAIType.BOOLEAN, description: "Si es true, reemplaza todas las ocurrencias. Usar con cuidado." }
                    },
                    required: ["searchText", "replaceWith"]
                }
            },
            {
                name: "update_field",
                description: "Actualiza un campo específico del paciente actual directamente y sincroniza con la base de datos. Más rápido que update_patient para cambios simples.",
                parameters: {
                    type: GenAIType.OBJECT,
                    properties: {
                        patientName: { type: GenAIType.STRING, description: "Nombre del paciente" },
                        field: { type: GenAIType.STRING, enum: ["name", "age", "diagnosis", "phone", "email", "document", "notes"], description: "Campo a actualizar" },
                        value: { type: GenAIType.STRING, description: "Nuevo valor del campo" }
                    },
                    required: ["patientName", "field", "value"]
                }
            },
            {
                name: "save_and_sync",
                description: "Guarda el contenido actual del editor (plan de tratamiento o informe) y sincroniza inmediatamente con la base de datos.",
                parameters: {
                    type: GenAIType.OBJECT,
                    properties: {
                        closeEditor: { type: GenAIType.BOOLEAN, description: "Si es true, cierra el editor después de guardar" }
                    }
                }
            },

            // ===== SESSION HISTORY =====
            {
                name: "add_session_note",
                description: "Agrega una nota de sesión al historial del paciente.",
                parameters: {
                    type: GenAIType.OBJECT,
                    properties: {
                        patientName: { type: GenAIType.STRING, description: "Nombre del paciente" },
                        date: { type: GenAIType.STRING, description: "Fecha YYYY-MM-DD" },
                        type: { type: GenAIType.STRING, description: "Tipo de sesión" },
                        summary: { type: GenAIType.STRING, description: "Resumen de la sesión" },
                        observations: { type: GenAIType.STRING, description: "Observaciones" }
                    },
                    required: ["patientName", "summary"]
                }
            },

            // ===== ANALYTICS & SEARCH =====
            {
                name: "search_patients",
                description: "Busca pacientes por nombre, diagnóstico o cualquier criterio.",
                parameters: {
                    type: GenAIType.OBJECT,
                    properties: {
                        query: { type: GenAIType.STRING, description: "Término de búsqueda" }
                    },
                    required: ["query"]
                }
            },
            {
                name: "get_statistics",
                description: "Obtiene estadísticas generales de la aplicación.",
                parameters: {
                    type: GenAIType.OBJECT,
                    properties: {}
                }
            },
            {
                name: "check_missing_data",
                description: "Verifica qué pacientes tienen datos faltantes (DNI, email, etc.).",
                parameters: {
                    type: GenAIType.OBJECT,
                    properties: {}
                }
            },

            // ===== KNOWLEDGE BASE =====
            {
                name: "search_knowledge",
                description: "Busca información en la base de conocimientos del asistente (protocolos, guías, información general).",
                parameters: {
                    type: GenAIType.OBJECT,
                    properties: {
                        query: { type: GenAIType.STRING, description: "Término de búsqueda" }
                    },
                    required: ["query"]
                }
            },
            {
                name: "add_knowledge",
                description: "Agrega nueva información a la base de conocimientos del asistente.",
                parameters: {
                    type: GenAIType.OBJECT,
                    properties: {
                        title: { type: GenAIType.STRING, description: "Título del conocimiento" },
                        content: { type: GenAIType.STRING, description: "Contenido detallado" },
                        tags: { type: GenAIType.ARRAY, items: { type: GenAIType.STRING }, description: "Etiquetas para categorizar (opcional)" }
                    },
                    required: ["title", "content"]
                }
            },

            // ===== CLINICAL SYNTHESIS ENGINE =====
            {
                name: "generate_report",
                description: "Genera un informe clínico fonoaudiológico autónomo usando la plantilla real de la biblioteca de documentos y los datos del paciente. Úsalo cuando el usuario pida 'crear informe', 'preparar informe', 'generar informe' o mencione el tipo de plantilla (valoración, proceso terapéutico, etc.).",
                parameters: {
                    type: GenAIType.OBJECT,
                    properties: {
                        patientName: { type: GenAIType.STRING, description: "Nombre del paciente para el informe. Si no se menciona, usa el paciente actualmente seleccionado." },
                        templateKeyword: { type: GenAIType.STRING, description: "Palabra clave del tipo de plantilla a usar: 'valoracion', 'proceso', 'seguimiento', 'alta', 'derivacion', o el nombre parcial del archivo de plantilla." },
                        additionalInstructions: { type: GenAIType.STRING, description: "Instrucciones clínicas específicas del fonoaudiólogo para personalizar el informe generado." }
                    },
                    required: []
                }
            },
            {
                name: "list_report_templates",
                description: "Lista las plantillas de informes clínicos disponibles en la biblioteca del sistema. Úsalo cuando el usuario pregunte qué tipos de informes hay o qué plantillas están disponibles.",
                parameters: {
                    type: GenAIType.OBJECT,
                    properties: {}
                }
            },

            // ===== NOTEBOOKLM — CEREBRO DE INVESTIGACIÓN =====
            {
                name: "notebook_list",
                description: "Lista todos los cuadernos de NotebookLM. Úsalos para ver qué investigación existe o para elegir un cuaderno antes de agregar fuentes.",
                parameters: {
                    type: GenAIType.OBJECT,
                    properties: {}
                }
            },
            {
                name: "notebook_create",
                description: "Crea un cuaderno nuevo en NotebookLM para investigar un tema clínico. Usalo cuando necesites estudiar un tema, preparar material basado en evidencia, o cuando el usuario pida crear investigación sobre algo.",
                parameters: {
                    type: GenAIType.OBJECT,
                    properties: {
                        title: { type: GenAIType.STRING, description: "Título descriptivo del cuaderno (ej: 'Disfonía infantil - revisión 2025')" }
                    },
                    required: ["title"]
                }
            },
            {
                name: "notebook_add_source",
                description: "Agrega una fuente web a un cuaderno de NotebookLM. Puede ser una URL de PubMed, artículo científico, guía de práctica clínica, etc. El cuaderno analizará la fuente y la hará consultable.",
                parameters: {
                    type: GenAIType.OBJECT,
                    properties: {
                        notebookId: { type: GenAIType.STRING, description: "ID del cuaderno (si no se provee, usa el último cuaderno creado)" },
                        url: { type: GenAIType.STRING, description: "URL de la fuente web a agregar" }
                    },
                    required: ["url"]
                }
            },
            {
                name: "notebook_ask",
                description: "Hace una pregunta a un cuaderno de NotebookLM sobre sus fuentes. El cuaderno responde usando SOLO la información de sus fuentes. Ideal para consultas clínicas basadas en evidencia.",
                parameters: {
                    type: GenAIType.OBJECT,
                    properties: {
                        notebookId: { type: GenAIType.STRING, description: "ID del cuaderno (si no se provee, usa el primero disponible)" },
                        question: { type: GenAIType.STRING, description: "Pregunta clínica o de investigación" }
                    },
                    required: ["question"]
                }
            },
            {
                name: "notebook_generate",
                description: "Genera un artefacto en un cuaderno de NotebookLM: podcast, quiz, flashcards, mapa mental, reporte o diapositivas. Ideal para crear materiales de estudio o clínicos.",
                parameters: {
                    type: GenAIType.OBJECT,
                    properties: {
                        notebookId: { type: GenAIType.STRING, description: "ID del cuaderno (si no se provee, usa el primero disponible)" },
                        type: { type: GenAIType.STRING, enum: ["podcast", "quiz", "flashcards", "mind_map", "report", "slide_deck"], description: "Tipo de artefacto a generar" }
                    },
                    required: ["type"]
                }
            },
            {
                name: "notebook_summary",
                description: "Obtiene un resumen del contenido total de un cuaderno de NotebookLM. Útil para entender rápidamente qué información hay disponible.",
                parameters: {
                    type: GenAIType.OBJECT,
                    properties: {
                        notebookId: { type: GenAIType.STRING, description: "ID del cuaderno (si no se provee, usa el primero disponible)" }
                    }
                }
            },
            {
                name: "notebook_list_artifacts",
                description: "Lista los artefactos generados en un cuaderno de NotebookLM (podcasts, quizzes, slides, etc). Muestra el estado de cada uno.",
                parameters: {
                    type: GenAIType.OBJECT,
                    properties: {
                        notebookId: { type: GenAIType.STRING, description: "ID del cuaderno (si no se provee, usa el primero disponible)" }
                    }
                }
            }
        ]
    }
];

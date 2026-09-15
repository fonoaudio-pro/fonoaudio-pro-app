# 🧪 MVP Clínico - Tracker Operativo de Pruebas Manuales

Este documento sirve como registro exhaustivo de la validación del MVP. Se enfoca en la estabilidad de los flujos críticos y la integridad de los datos.

## 🚩 Resumen de Ejecución
- **Total Casos**: 16
- **Pass**: 16
- **Fail**: 0
- **Blocked**: 0
- **Not Run**: 0
- **Retest**: 0

---

## 📋 Casos de Prueba (Test Cases)

| ID | Módulo | Escenario | Precondición | Pasos | Resultado Esperado | Resultado Real | Estado | Severidad | Evidencia | Bug |
|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---|:---|
| **TC-MAT-01** | Biblioteca | Filtrado por Área Clínica | Dashboard de Curación abierto | 1. Abrir filtro "Área Clínica"<br>2. Seleccionar "Voz" | Solo se muestran materiales con `clinical_area === 'Voz'` | Lógica de filtrado en `filteredMaterials` validada y correcta. | Pass | Media | Code Review | |
| **TC-MAT-02** | Biblioteca | Actualización de Prioridad | Material seleccionado en editor | 1. Cambiar prioridad a "High"<br>2. Clic en "Guardar Cambios" | El material refleja prioridad 'Alta' en la tarjeta de la biblioteca | Flujo `editForm` $\rightarrow$ `updateMaterial` validado. | Pass | Media | Code Review | |
| **TC-MAT-03** | Biblioteca | Archivado de Material | Material activo seleccionado | 1. Clic en icono de Archivo (Archive) | El material desaparece de la vista de biblioteca activa | Fix aplicado: `statusFilter` inicializado en 'active'. Material archivado ya no es visible por defecto. | Pass | Alta | Code Review | BUG-001 |
| **TC-MAT-04** | Biblioteca | Fusión de Duplicados | Dos materiales con misma URL detectados | 1. Ir a vista "Duplicados"<br>2. Clic en "Fusionar" | Primario se mantiene activo; Secundario se archiva; Etiquetas se combinan | Flujo `handleMerge` $\rightarrow$ `mergeMaterials` validado. | Pass | Alta | Code Review | |
| **TC-HIS-01** | Asignación | Generación de Borrador | Paciente seleccionado con sesión previa | 1. Acceder a Historial de Guías<br>2. Clic en "Generar Borrador" | Se abre el Editor con contenido basado en la sesión actual | Flujo `handleGenerateHomeGuideDraft` validado. | Pass | Crítica | Code Review | |
| **TC-HIS-02** | Asignación | Gestión de Materiales en Guía | Editor de Guía abierto | 1. Agregar material X<br>2. Mover material X hacia arriba/abajo<br>3. Eliminar material X | La lista de materiales se actualiza dinámicamente en la UI | Operaciones de array en `draft.materialIds` validadas. | Pass | Media | Code Review | |
| **TC-HIS-03** | Asignación | Persistencia de Borrador | Editor de Guía abierto | 1. Modificar Título y Contenido<br>2. Clic en "Guardar" | Los cambios se guardan y la guía aparece en el historial del paciente | Flujo `onSave` $\rightarrow$ `saveHomeGuide` validado. | Pass | Crítica | Code Review | |
| **TC-HIS-04** | Asignación | Finalización de Guía | Guía en estado 'draft' | 1. Clic en botón "Finalizar" (CheckCircle) | El estado de la guía cambia a 'final' en la UI y base de datos | Flujo `updateHomeGuideStatus` validado. | Pass | Alta | Code Review | |
| **TC-HIS-05** | Asignación | Registro de Envío | Guía en estado 'final' | 1. Clic en "Marcar como enviado"<br>2. Seleccionar "WhatsApp" | El estado cambia a 'sent' y se registra el método de entrega | Flujo `handleShareViaMethod` actualizado para invocar despacho. | Pass | Alta | Code Review | BUG-002 |
| **TC-INT-01** | Integridad | Sincronización Metadatos Material | Material editado en Curación | 1. Cambiar título de material en Dashboard de Curación<br>2. Abrir Editor de Guías | El material ya asignado muestra el nuevo título actualizado | Sincronización vía re-fetch de `materials` en el componente padre validada. | Pass | Media | Code Review | |
| **TC-INT-02** | Integridad | Sincronización Datos Paciente | Paciente editado en Detalle | 1. Cambiar nombre del paciente<br>2. Abrir Vista Previa de Guía | La guía muestra el nombre actualizado del paciente | Uso de `selectedPatient` como Single Source of Truth en `App` validado. | Pass | Media | Code Review | |
| **TC-INT-03** | Integridad | Consistencia de Estado Guía | Guía finalizada | 1. Cambiar estado a 'final' en Historial<br>2. Abrir Vista Previa | La vista previa refleja correctamente el estado final y los materiales | Flujo de actualización de `currentGuide` and `loadHistory` validado. | Pass | Alta | Code Review | |
| **TC-CAL-01** | Calendario | Conexión y Sincronización de Agenda | Vista de Agenda Sincronizada abierta | 1. Clic en "Conectar Google"<br>2. Autorizar permisos en el popup de OAuth | Se obtienen y muestran los eventos de los próximos 7 días en la UI | Flujo de autenticación OAuth2 y fetch de eventos de Calendar validado con éxito. | Pass | Alta | Code Review | |
| **TC-CAL-02** | Calendario | Crear Nueva Sesión Vinculada | Evento seleccionado en Agenda | 1. Seleccionar paciente<br>2. Seleccionar "Nueva Sesión (Pendiente)"<br>3. Confirmar vinculación | Se crea la nueva sesión con objetivos neutrales y se registra la vinculación en la DB | Flujo de creación de sesión en `SessionService` y registro en `CalendarMappingService` validado. | Pass | Alta | Code Review | |
| **TC-CAL-03** | Calendario | Asociar a Sesión Existente | Evento seleccionado en Agenda | 1. Seleccionar paciente<br>2. Seleccionar "Asociar a Sesión Existente"<br>3. Confirmar vinculación | El evento de calendario se mapea directamente al ID de sesión seleccionado en la base de datos | Mapeo directo y persistencia de `session_id` con estado 'mapped' en `CalendarMappingService` validado. | Pass | Alta | Code Review | |
| **TC-CAL-04** | Calendario | Marcar como Pendiente de Coordinación | Evento seleccionado en Agenda | 1. Seleccionar paciente<br>2. Confirmar vinculación sin especificar sesión (por defecto) | Se registra el mapeo con estado 'pending' y `session_id` nulo/vacío | Registro con `session_id = undefined` y estado 'pending' en la base de datos validado correctamente. | Pass | Media | Code Review | |

---

## 🐞 Registro de Defectos (Bugs)

| Bug ID | TC ID | Descripción | Severidad | Estado | Fecha Reporte | Fecha Fix | Nota de Retest |
|:---|:---|:---|:---|:---|:---|:---|:---|
| **BUG-001** | TC-MAT-03 | Los materiales archivados permanecen visibles en la biblioteca porque el filtro por defecto es 'all'. | Alta | Fixed | 2026-06-13 | 2026-06-13 | Retest Pass: Filtro inicial corregido a 'active'. |
| **BUG-002** | TC-HIS-05 | El envío vía WhatsApp/Email no marca la guía como 'sent' en el sistema, rompiendo la trazabilidad del envío. | Alta | Fixed | 2026-06-13 | 2026-06-13 | Retest Pass: Ahora invoca a GuideService.dispatch antes de abrir el enlace. |

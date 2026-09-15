# Roadmap de Frentes Congelados — Plan de Reactivación

## Regla de Oro
> Ningún frente se reactiva como feature suelta. Cada uno vuelve solo si encaja en el flujo clínico y si no rompe trazabilidad, control ni consistencia.

---

## Estado: Baseline Visible Consolidado

**Fecha**: 2026-06-30
**Estado**: Phase 1 Stubs complete — Baseline visible consolidado

### Qué significa este estado
- La app refleja visualmente todos los módulos nuevos (Historia Clínica, Asistente, Telegram, Scanner, Multimedia)
- Los stubs están identificados con badge `STUB` visible en UI
- La experiencia base se puede recorrer sin endpoints rotos
- Dark mode consistente en todos los componentes
- Cero `fetch()` a `localhost:3001` en source code
- SessionWizard y ClinicalPlanningModule funcionan con stubs locales

### Cómo verificar
1. Abrir `http://localhost:3002`
2. Dashboard carga sin errores
3. Google Calendar muestra mock events con badge STUB
4. Paciente → Historia Clínica: ChannelActions (Telegram STUB + Scanner STUB), MaterialRequestForm STUB, MaterialReviewTray STUB
5. Asistente IA: panel visible, input texto, badges de fuente, indicador de voice mode pendiente
6. SessionWizard: genera resumen stub desde observaciones
7. ClinicalPlanningModule: genera análisis stub con badge STUB

### Próxima integración real
**Telegram real** — primer canal trazable. Ver `docs/TELEGRAM_REAL_INTEGRATION_PLAN.md`

---

## Jerarquía de Prioridades

| Orden | Frente | Estado | Condición de reactivación |
|-------|--------|--------|--------------------------|
| 1 | Historia Clínica Inteligente | **VALIDADO** ✅ | QA manual: 6 casos verdes |
| 2 | Asistente IA + NotebookLM | **VALIDADO EN TEXTO** ✅ | Wiring completo, badges, logs, base científica |
| 3 | Telegram | **FASE 1 COMPLETA** ✅ | Stub + UI + logging + persistencia |
| 4 | Celular/Scanner | **FASE 1 COMPLETA** ✅ | Stub + UI + documentos mock + OCR simulado |
| 5 | Multimedia/Canva | **FASE 1 COMPLETA** ✅ | Pipeline + Bandeja de Revisión + ARASAAC

---

## Frente 2: Asistente IA + NotebookLM

### 2.1 Contexto
El asistente IA es el copiloto clínico del sistema. No es un chatbot general: asiste sobre conocimiento curado, no actúa de forma autónoma. Su valor está en:
- Proveer contexto clínico longitudinal al profesional
- Generar borradores de documentos (informes, guías, planes)
- Detectar patrones en evolución de pacientes
- Apoyar decisiones con base científica (NotebookLM)

### 2.2 NotebookLM como Base Científica

**Qué es**: NotebookLM de Google es un asistente de investigación que permite cargar documentos científicos (artículos, guías, protocols) y consultarlos con contexto. Funciona como base de conocimiento curada.

**Cómo entra en el roadmap**:

| Capa | Uso | Función |
|------|-----|---------|
| **Base científica para IA** | Alimentar el system prompt del asistente con referencias validadas | El asistente cita fuentes específicas cuando responde |
| **Generación de contenido** | Crear borradores de materiales clínicos basados en evidencia | NotebookLM genera esquemas que el profesional revisa |
| **Recursos clínicos curados** | Mantener biblioteca viva de guías y protocols | Actualización continua sin reentrenar modelos |
| **Trazabilidad de fuentes** | Cada respuesta del asistente referencia el documento de origen | Auditable: de dónde viene cada recomendación |

**Qué usa NotebookLM**:
- Artículos científicos de fonoaudiología (PDFs)
- Guías de práctica clínica (nacionales e internacionales)
- Protocolos institucionales cargados por el usuario
- Evidencia científica actualizada periódicamente

**Qué habilita**:
- Asistente que respponde con referencias bibliográficas
- Generación de materiales basados en evidencia
- Detección de cambios en guías de práctica
- Capacitación continua del profesional

**Controles necesarios**:
- Solo documentos aprobados por el profesional (no scraping automático)
- Cada respuesta indica la fuente y fecha de la referencia
- El profesional aprueba antes de usar contenido generado
- Versionado de documentos cargados (quién cargó, cuándo, qué versión)
- Límite de contexto: máximo N documentos activos por consulta

### 2.3 Permisos y Límites del Asistente

| Acción | Permiso | Control |
|--------|---------|---------|
| Consultar contexto clínico del paciente | Automático | Solo datos del paciente actual |
| Generar borrador de informe | Requiere confirmación | Profesional revisa antes de guardar |
| Sugerir seguimiento | Automático | Basado en reglas clínicas, no autonomía |
| Modificar plan de tratamiento | Bloqueado | Solo el profesional modifica |
| Enviar comunicaciones externas | Bloqueado | Sin envío sin confirmación explícita |
| Acceder a NotebookLM | Automático | Solo documentos del workspace del usuario |
| Generar contenido multimedia | Requiere confirmación | Borrador → revisión → aprobación |

### 2.4 Flujo Mínimo

```
1. Profesional selecciona paciente
2. useLongitudinalContext carga historial
3. GlobalAssistant inyecta contexto en system prompt
4. NotebookLM provee referencias científicas relevantes
5. Asistente genera respuesta con citas
6. Profesional revisa y aprueba/rechaza
7. Acciones sensibles → confirmación explícita
8. Todo queda registrado en log de sesiones
```

### 2.5 Trazabilidad

- **Log de sesiones**: cada interacción queda registrada (timestamp, pregunta, respuesta, fuentes citadas)
- **Audit trail**: qué documentos de NotebookLM se consultaron
- **Confirmaciones**: registro de qué acciones requirieron aprobación
- **Métricas**: uso del asistente, sugerencias aceptadas/rechazadas, fuentes más consultadas

### 2.6 Criterios de Activación

- [x] QA Historia Clínica: 6 casos verdes
- [x] useLongitudinalContext funcionando en GlobalAssistant
- [x] ScientificBaseService (stub de NotebookLM) configurado
- [x] System prompt actualizado con base científica
- [x] Log de sesiones implementado (SessionLogService)
- [x] Indicadores de fuente en UI (SourceBadges)
- [ ] QA voz humana pendiente (pruebas manuales con micrófono)

---

## Frente 3: Telegram como Canal de Apoyo

### 3.1 Contexto
Telegram NO es el núcleo del sistema. Es un canal de distribución y notificación que opera después de que las alertas internas y el seguimiento estén sólidos.

### 3.2 Casos de Uso

| Caso | Descripción | Prioridad |
|------|-------------|-----------|
| **Notificación de alertas** | Enviar alerta crítica al profesional cuando no está en la app | Alta |
| **Recordatorios** | Enviar recordatorio de cita o seguimiento al paciente | Media |
| **Material terapéutico** | Compartir guía de hogar o material generado | Baja |
| **Confirmación de asistencia** | Paciente confirma cita vía Telegram | Baja |

### 3.3 Permisos y Límites

| Acción | Permiso | Control |
|--------|---------|---------|
| Enviar notificación de alerta | Automático (si configurado) | Solo red_flags críticos, máx 3/día |
| Enviar recordatorio | Automático (24h antes) | Solo si paciente tiene Telegram vinculado |
| Enviar material | Requiere confirmación del profesional | Material aprobado, trazable |
| Recibir mensajes del paciente | Automático | Solo respuestas predefinidas (Sí/No/Cancelar) |
| Chat libre con paciente | Bloqueado | No es canal de comunicación clínica |

### 3.4 Flujo Mínimo

```
1. Profesional vincula Telegram del paciente (opt-in)
2. Sistema genera alerta → ClinicalAlertBus
3. Si alerta es red_flag crítico → envía notificación a Telegram
4. Paciente recibe mensaje con botones de respuesta
5. Respuesta se registra en sistema (no es chat libre)
6. Profesional ve respuesta en FollowUpPanel
```

### 3.5 Trazabilidad

- **Log de envíos**: qué mensajes se enviaron, cuándo, a quién
- **Respuestas**: qué respondió el paciente, cuándo
- **Límites**: contador de mensajes/día por paciente
- **Opt-out**: paciente puede dejar de recibir mensajes
- **Auditoría**: cada envío trazable desde el sistema

### 3.6 Criterios de Activación

- [ ] ClinicalAlertBus funcionando con métricas
- [ ] Asistente IA validado con límites claros
- [ ] Bot de Telegram creado y configurado
- [ ] Flujo de vinculación paciente ↔ Telegram
- [ ] Sistema de notificaciones con límites diarios
- [ ] Log de envíos implementado
- [ ] Prueba piloto con 3-5 pacientes

---

## Frente 4: Celular/Scanner

### 4.1 Contexto
El celular entra como herramienta de captura y distribución, no como plataforma independiente. El diseño correcto es: escanear desde el celular, o generar QR para abrir el flujo desde otro dispositivo.

### 4.2 Casos de Uso Definidos

| Caso | Descripción | Flujo |
|------|-------------|-------|
| **Subir documentos** | Capturar imagen de documento clínico | Celular → cámara → OCR (futuro) → Supabase |
| **Leer QR** | Acceder a material o guía desde código QR | Celular escanea QR → abre enlace con material |
| **Capturar imágenes clínicas** | Fotografiar material terapéutico o progreso | Celular → cámara → Supabase Storage |
| **Enviar material por Telegram** | Distribuir material generado | Sistema → genera enlace → Telegram → paciente |

### 4.3 Permisos y Límites

| Acción | Permiso | Control |
|--------|---------|---------|
| Capturar imagen | Automático (si usuario autoriza cámara) | Solo imágenes relevantes al paciente |
| Subir documento | Automático | Validación de tipo/tamaño antes de subir |
| Escanear QR | Automático | QR generados por el sistema, no externos |
| Enviar por Telegram | Requiere confirmación | Solo materiales aprobados |

### 4.4 Flujo Mínimo

```
1. Usuario necesita capturar imagen
2. Abre cámara desde la app (PWA o native)
3. Captura imagen → se muestra preview
4. Confirma → imagen se sube a Supabase Storage
5. Imagen se asocia al paciente actual
6. Trazabilidad: quién capturó, cuándo, de qué paciente
```

### 4.5 Trazabilidad

- **Capturas**: quién, cuándo, de qué paciente, tipo de imagen
- **QR generados**: qué material, cuándo, expira cuándo
- **Envíos**: qué se envió, por qué canal, confirmación de entrega
- **Almacenamiento**: límites de espacio por paciente

### 4.6 Criterios de Activación

- [ ] Supabase Storage configurado con políticas de acceso
- [ ] PWA configurada con acceso a cámara
- [ ] Flujo de captura de imágenes implementado
- [ ] Generación de QR para materiales
- [ ] Log de capturas implementado
- [ ] Prueba con 2-3 pacientes piloto

---

## Frente 5: Multimedia/Canva

### 5.1 Contexto
Multimedia NO es un mundo paralelo. Sirve al módulo clínico: generar materiales terapéuticos, guías de hogar, recursos visuales de apoyo. Si Canva entra, debe hacerlo como herramienta para materiales clínicos, no como editor general.

### 5.2 Casos de Uso

| Caso | Descripción | Prioridad |
|------|-------------|-----------|
| **Guías de hogar** | Generar guía personalizada con pictogramas y texto | Alta |
| **Materiales PECS** | Crear secuencias de intercambio visual | Alta |
| **Secuencias terapéuticas** | Diseñar pasos de actividad con imágenes | Media |
| **Tarjetas de vocabulario** | Generar tarjetas con imagen + palabra + audio | Media |
| **Informes visuales** | Complementary con texto del informe | Baja |

### 5.3 Arquitectura Propuesta (hibrida)

| Capa | Herramienta | Uso |
|------|-------------|-----|
| **Edición existente** | Fabric.js (ya integrado) | Edición de imagen, filtros, composición simple |
| **Editor avanzado** | tldraw SDK | Materiales complejos, plantillas, infinite canvas |
| **Brainstorming** | Excalidraw (futuro) | Diagramas de flujo terapéutico |

### 5.4 Permisos y Límites

| Acción | Permiso | Control |
|--------|---------|---------|
| Crear material | Automático | Basado en plantillas aprobadas |
| Editar material existente | Automático | Solo materiales propios o del workspace |
| Exportar material | Automático | PNG/PDF con marca de agua del sistema |
| Compartir material | Requiere confirmación | Solo materiales aprobados |
| Usar IA para generar contenido | Requiere confirmación | Borrador → revisión → aprobación |

### 5.5 Flujo Mínimo

```
1. Profesional selecciona "Crear Material"
2. Elige tipo (guía, PECS, secuencia, tarjeta)
3. Se abre editor con plantilla base
4. Arrastra pictogramas ARASAAC, edita texto
5. Preview → Export → Guarda en Supabase
6. Material queda asociado al paciente/plan
7. Trazabilidad: quién creó, cuándo, para qué paciente
```

### 5.6 Trazabilidad

- **Materiales creados**: quién, cuándo, para qué paciente/plan
- **Versiones**: historial de ediciones
- **Uso**: cuándo se compartió con paciente, si se abrió
- **Aprobación**: registro de revisiones y aprobaciones

### 5.7 Criterios de Activación

- [ ] Fabric.js funcionando para edición básica
- [ ] Evaluación de tldraw SDK para editor avanzado
- [ ] Plantillas clínicas definidas (guía, PECS, secuencia)
- [ ] Integración con ARASAAC drag-and-drop
- [ ] Export a PNG/PDF funcional
- [ ] Log de materiales implementado
- [ ] Prueba con 3 materiales piloto

---

## Integración: NotebookLM + Asistente IA

### Flujo de Referencias

```
1. Profesional pregunta al asistente
2. useAssistantConfig inyecta system prompt con instrucciones
3. Asistente consulta NotebookLM para referencias relevantes
4. NotebookLM devuelve documentos + extractos relevantes
5. Asistente genera respuesta con citas bibliográficas
6. Respuesta incluye: texto + fuente + fecha + confianza
7. Profesional ve referencias y decide usarlas o no
```

### Control de Calidad

- **Documentos aprobados**: solo los que el profesional cargó
- **Versiones**: cada documento tiene versión y fecha
- **Relevancia**: el asistente indica qué tan relevante es cada referencia
- **Actualización**: alerta cuando un documento tiene versión nueva
- **Auditoría**: log de qué documentos se consultaron en cada sesión

---

## Consolidación de Dependencias

```
QA Historia Clínica (6 casos)
  ↓
Asistente IA + NotebookLM (base científica)
  ↓
Telegram (canal de apoyo)
  ↓
Celular/Scanner (captura y distribución)
  ↓
Multimedia/Canva (materiales clínicos)
```

**Cada frente depende del anterior**: no se reactiva el siguiente hasta que el anterior esté validado.

---

## Documentos de Referencia

| Documento | Contenido |
|-----------|-----------|
| `docs/QA_GUIDE.md` | Guía de QA manual con 6 casos |
| `docs/RELEASE_CHECKLIST.md` | Checklist de release (70+ items) |
| `docs/ALERT_MIGRATION_ROADMAP.md` | Migración de consumidores al bus |
| `docs/MULTIMEDIA_RESEARCH.md` | Investigación de opciones multimedia |
| `docs/FROZEN_FRONTS_ROADMAP.md` | Este documento |

---

## Última Actualización
2026-06-28 — Todos los frentes descongelados en Fase 1 (Stubs). Pipeline multimedia completo con Bandeja de Revisión.

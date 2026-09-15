# Asistente IA — Estado: VALIDADO EN TEXTO

**Fecha**: 2026-06-28
**Estado**: ✅ VALIDADO EN MODO TEXTO / ⏳ PENDIENTE QA VOZ HUMANA

---

## 1. Resultados de QA

### 1.1 Suite de tests ejecutada
| Test | Descripción | Estado |
|------|-------------|--------|
| TX-01 | Estructura del panel existe en DOM | ✅ PASS |
| TX-06 | SessionLogService escribe a localStorage | ✅ PASS |
| TX-07 | detectSources retorna fuentes correctas (4 casos) | ✅ PASS |
| TX-08 | ScientificBaseService — integridad de datos curados | ✅ PASS |
| TX-09 | Sin errores de consola críticos | ✅ PASS |
| TX-10 | Componente SourceBadges en GlobalAssistant | ✅ PASS |
| TX-11 | Integridad del archivo SessionLogService | ✅ PASS |

**Resultado: 7/7 PASSED**

### 1.2 Detalle de validaciones

#### SessionLogService (TX-06)
- Escribe entrada a `localStorage` con key `fonoaudio_session_log`
- Cada entrada tiene: `id`, `timestamp`, `patientId`, `patientName`, `userMessage`, `sources[]`, `confidence`
- Límite de 100 entradas
- Persiste correctamente entre recargas

#### detectSources (TX-07)
| Caso | Entrada | Resultado Esperado | Resultado |
|------|---------|-------------------|-----------|
| Solo paciente | patientContext=true, query mentions patient | 1 fuente: patient_context | ✅ |
| Todas las fuentes | patient+notebook+alerts+evolution | 4 fuentes | ✅ |
| Sin contexto | nothing active | 1 fuente: general (fallback) | ✅ |
| Paciente sin mención | patientContext=true, query doesn't mention | 1 fuente: general | ✅ |

#### ScientificBaseService (TX-08)
- 7 fuentes curadas documentadas
- 4 ejes clínicos cubiertos: lenguaje, voz, motricidad, audición
- Query por eje funciona correctamente
- Extractos textuales incluidos para cada documento

#### Source Badges (TX-10)
- Componente `SourceBadges` definido en `GlobalAssistant.tsx`
- 5 tipos de badge: patient_context, notebook_lm, clinical_alert, evolution, general
- `data-testid="source-badges"` para testing
- `data-testid="patient-context-indicator"` para contexto activo
- `data-testid="response-sources"` para sección de fuentes

---

## 2. Arquitectura validada

### 2.1 Flujo de datos
```
Paciente seleccionado
    ↓
useLongitudinalContext.loadPatientContext()
    ↓
PatientContext (diagnóstico, snapshot, alertas, evolución)
    ↓
buildSystemInstruction() + ScientificBaseService.query()
    ↓
System prompt con CONTEXTO LONGITUDINAL + BASE CIENTÍFICA
    ↓
Usuario envía mensaje de texto
    ↓
sendTextMessage() → detectSources() → SessionLogService.log()
    ↓
Badges renderizados en UI: [Contexto del Paciente] [Base Científica]
```

### 2.2 Capas de información
| Capa | Fuente | Badge | Trazable |
|------|--------|-------|----------|
| Contexto del Paciente | useLongitudinalContext | 🔵 Azul | ✅ |
| Base Científica | ScientificBaseService | 🟢 Verde | ✅ |
| Alerta Clínica | ClinicalAlertBus | 🟡 Ámbar | ✅ |
| Evolución | ClinicalEvolutionService | 🟣 Púrpura | ✅ |
| Conocimiento General | Gemini model | ⚪ Gris | ✅ |

### 2.3 Log de sesiones
- Almacenamiento: `localStorage` key `fonoaudio_session_log`
- Límite: 100 entradas
- Cada entrada registra: timestamp, paciente, mensaje, fuentes detectadas, confianza
- Visible en consola del navegador para debugging

---

## 3. Pendiente: QA Voz Humana

### 3.1 Requisitos
- Dispositivo con micrófono funcional
- API key de Google Gemini configurada
- Conexión a internet estable

### 3.2 Pruebas de voz pendientes
| Prueba | Descripción |
|--------|-------------|
| VA-01 | El asistente conecta por voz correctamente |
| VA-02 | Responde preguntas sobre el paciente seleccionado |
| VA-03 | Ejecuta tool calls (navigate, open_editor) por voz |
| VA-04 | Pide confirmación antes de acciones sensibles |
| VA-05 | Badges aparecen después de respuestas de voz |

### 3.3 Criterio de cierre completo
- [x] QA texto: 7/7 tests pasados
- [ ] QA voz humana: 5/5 pruebas manuales
- [ ] Documento de validación firmado por profesional

---

## 4. Decisiones técnicas tomadas

1. **ScientificBaseService en vez de NotebookLMService**: el paquete npm `notebooklm` existía en node_modules y causaba conflicto de importación
2. **Badge rendering pre-message**: los badges se setean ANTES de enviar el mensaje al session, para que se rendericen inmediatamente
3. **detectSources inline**: la lógica de detección de fuentes está en SessionLogService.ts y se importa en GlobalAssistant
4. **Fallback a texto**: el input de texto funciona independientemente de la conexión de voz

---

## Última Actualización
2026-06-28 — Asistente validado en modo texto (7/7 tests). Pendiente QA voz humana.

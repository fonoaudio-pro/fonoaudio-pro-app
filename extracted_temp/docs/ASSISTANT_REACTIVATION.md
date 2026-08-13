# Reactivación Controlada: Asistente IA

**Fecha**: 2026-06-28
**Estado**: Documento de diseño — antes de implementar
**Regla**: No es un agente autónomo. Es un copiloto sobre conocimiento curado.

---

## 1. Entradas del Prompt

### 1.1 Contexto del paciente (automático)
```
- Nombre y edad del paciente
- Diagnóstico / motivo de consulta
- Ejes clínicos activos (lenguaje, voz, motricidad, etc.)
- Últimas entradas de evolución (últimas 3-5)
- Alertas activas del ClinicalAlertBus
- Snapshot del eje más relevante
```

### 1.2 Contexto longitudinal (automático)
```
- Resumen de anamnesis (últimas 10 respuestas)
- Tendencia del eje principal (mejora/estable/empeoramiento)
- Hallazgos clave de la evolución
```

### 1.3 Conocimiento curado (NotebookLM — futuro)
```
- Referencias bibliográficas relevantes al caso
- Guías de práctica clínica vigentes
- Protocolos institucionales
- Evidencia científica por eje clínico
```

### 1.4 Instrucciones del sistema (useAssistantConfig)
```
- Tono del asistente (profesional, empático, directo)
- Nivel de proactividad (mínimo/bajo/medio/alto)
- Acciones permitidas por categoría
- Reglas de confirmación
- Límites de autonomía
```

---

## 2. Contexto clínico permitido (LECTURA)

| Categoría | Datos | Acceso |
|-----------|-------|--------|
| **Identificación** | Nombre, edad, sexo | Automático |
| **Diagnóstico** | Motivo de consulta, diagnóstico principal | Automático |
| **Evolución** | Entradas de evolución recientes | Automático |
| **Alertas** | Red flags activos, follow-ups pendientes | Automático |
| **Anamnesis** | Respuestas de anamnesis adaptativa | Automático |
| **Plan** | Plan de tratamiento activo | Solo lectura |
| **Sesiones** | Historial de sesiones recientes | Solo lectura |

---

## 3. Contexto PROHIBIDO

| Categoría | Razón | Bloqueo |
|-----------|-------|---------|
| **Datos de otros pacientes** | Privacidad | Hard block |
| **Credenciales de acceso** | Seguridad | Hard block |
| **Datos financieros** | No relevante | Hard block |
| **Información de contactos** | Privacidad | Hard block |
| **Historial completo de sesiones** | Demasiado contexto | Limitado a últimas 5 |
| **Resultados de laboratorio** | Requiere validación médica | Solo si cargados por profesional |

---

## 4. Acciones del asistente

### 4.1 Acciones permitidas (sin confirmación)
| Acción | Descripción |
|--------|-------------|
| Resumir evolución | Generar resumen de las últimas entradas |
| Sugerir seguimiento | Proponer próxima acción basada en reglas |
| Explicar concepto | Definir término clínico con referencia |
| Buscar en conocimiento | Consultar NotebookLM por evidencia relevante |

### 4.2 Acciones con confirmación obligatoria
| Acción | Descripción | Confirmación |
|--------|-------------|--------------|
| Redactar informe | Generar borrador de informe | Profesional revisa antes de guardar |
| Redactar guía de hogar | Generar guía para familia | Profesional revisa antes de enviar |
| Sugerir cambio de plan | Proponer modificación al plan | Profesional aprueba explícitamente |
| Generar material | Crear material terapéutico | Profesional revisa antes de usar |
| Resumir para envío | Preparar resumen para paciente/familia | Profesional aprueba contenido |

### 4.3 Acciones BLOQUEadas
| Acción | Razón |
|--------|-------|
| Diagnosticar | Solo el profesional diagnostica |
| Modificar plan de tratamiento | Solo el profesional modifica |
| Enviar comunicaciones externas | Sin envío sin aprobación explícita |
| Acceder a datos de otros pacientes | Privacidad |
| Ejecutar acciones en Supabase | Solo lectura |
| Usar modelos de IA para generación | Requiere confirmación por uso |

---

## 5. Reglas de confirmación

### 5.1 Flujo de confirmación
```
1. Asistente genera propuesta
2. Muestra propuesta al profesional con fuente/referencia
3. Profesional revisa:
   - Aprobar → se ejecuta la acción
   - Rechazar → se descarta
   - Editar → se modifica y luego aprueba
4. Registro de la decisión en log de sesiones
```

### 5.2 Elementos de la confirmación
```
- Texto generado (borrador)
- Fuente del conocimiento (NotebookLM reference, regla clínica, etc.)
- Nivel de confianza (alto/medio/bajo)
- Riesgo de la acción (bajo/medio/alto)
- Opciones: Aprobar / Rechazar / Editar
```

### 5.3 Log de sesiones
```json
{
  "timestamp": "2026-06-28T10:30:00Z",
  "patient_id": "abc123",
  "action": "generate_report_draft",
  "input": { "evolution_entries": [...] },
  "output": { "draft_text": "...", "source": "notebooklm", "confidence": "high" },
  "decision": "approved",
  "decided_by": "user_id",
  "decided_at": "2026-06-28T10:31:00Z"
}
```

---

## 6. Límites del asistente en entorno clínico

### 6.1 Límites de autonomía
- **Nunca** actúa sin explícito consentimiento del profesional
- **Nunca** modifica datos del paciente directamente
- **Nunca** envía comunicaciones externas
- **Nunca** accede a datos de otros pacientes
- **Siempre** indica la fuente de su respuesta
- **Siempre** muestra nivel de confianza

### 6.2 Límites de contexto
- Máximo 5 entradas de evolución en contexto
- Máximo 10 respuestas de anamnesis en contexto
- Máximo 3 referencias de NotebookLM por consulta
- Contexto se renueva por sesión (no persiste entre sesiones)

### 6.3 Límites de uso
- Sin límite de consultas por sesión
- Sin uso de modelos de IA para generación (solo Gemini con confirmación)
- Sin credito de Modal/ComfyUI (solo si usuario solicita explícitamente)
- Sin acceso a internet abierto como fuente clínica

---

## 7. Arquitectura de integración

```
┌─────────────────────────────────────────────────────┐
│                  GlobalAssistant                     │
│                                                     │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │   Contexto   │  │  Conocimiento │  │  Acciones  │ │
│  │   Paciente   │  │   Curado     │  │  Seguras   │ │
│  └──────┬──────┘  └──────┬───────┘  └─────┬──────┘ │
│         │                │                │         │
│         ▼                ▼                ▼         │
│  ┌─────────────────────────────────────────────┐   │
│  │           System Prompt + Reglas            │   │
│  └─────────────────────────────────────────────┘   │
│                          │                          │
│                          ▼                          │
│  ┌─────────────────────────────────────────────┐   │
│  │        Gemini API (solo lectura)            │   │
│  └─────────────────────────────────────────────┘   │
│                          │                          │
│                          ▼                          │
│  ┌─────────────────────────────────────────────┐   │
│  │     Respuesta + Fuente + Confianza          │   │
│  └─────────────────────────────────────────────┘   │
│                          │                          │
│                          ▼                          │
│  ┌─────────────────────────────────────────────┐   │
│  │   Confirmación del profesional (si aplica)  │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

---

## 8. Validación de reactivación

### 8.1 Criterios de activación
- [ ] useLongitudinalContext funciona y entrega contexto real
- [ ] System prompt incluye contexto del paciente
- [ ] NotebookLM integration punto preparado (stub)
- [ ] Log de sesiones implementado
- [ ] Flujo de confirmación verificado
- [ ] Prueba de integración: asistente recibe contexto y responde con referencia

### 8.2 Evidencia requerida
- Screenshot de asistente con contexto del paciente visible
- Screenshot de asistente generando respuesta con fuente
- Screenshot de flujo de confirmación
- Log de sesión con estructura correcta
- Build verde + tests de integración pasando

---

## Última Actualización
2026-06-28 — Documento de diseño de reactivación del Asistente IA.

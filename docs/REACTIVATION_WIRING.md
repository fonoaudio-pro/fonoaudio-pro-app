# Wiring Mínimo de Reactivación — Asistente IA

**Fecha**: 2026-06-28
**Objetivo**: Primer paso concreto para conectar el asistente con contexto clínico real
**Regla**: No refactor gigante. Punto de extensión preparado.

---

## 1. Estado actual del asistente

### 1.1 Componentes existentes
| Componente | Estado | Función |
|------------|--------|---------|
| `GlobalAssistant.tsx` | ✅ Funcional | UI del chat con Gemini |
| `useAssistantConfig.ts` | ✅ Funcional | Configuración dinámica del asistente |
| `useLongitudinalContext.ts` | ✅ Funcional | Carga contexto longitudinal del paciente |
| `useClinicalIntelligence.ts` | ✅ Funcional | Sugiere acciones basadas en reglas |
| `useAlertBridge.ts` | ✅ Funcional | Conecta alertas al bus |
| `ClinicalAlertBus.tsx` | ✅ Funcional | Bus central de alertas |

### 1.2 Lo que falta
| Componente | Estado | Función |
|------------|--------|---------|
| `NotebookLMService.ts` | ❌ No existe | Consulta a NotebookLM |
| Log de sesiones | ❌ No existe | Registro de acciones del asistente |
| Flujo de confirmación | ❌ No existe | Aprobación de acciones sensibles |

---

## 2. Wiring paso a paso

### Paso 1: Verificar que useLongitudinalContext funciona
```typescript
// hooks/useLongitudinalContext.ts
// Ya implementado: carga contexto del paciente
// Verificar que entrega datos reales en GlobalAssistant
```

**Acción**: Ejecutar prueba manual en navegador
**Evidencia**: Screenshot de asistente con contexto del paciente visible

### Paso 2: Conectar contexto al system prompt
```typescript
// hooks/useAssistantConfig.ts
// buildSystemInstruction() ya acepta longitudinalContext
// Verificar que el contexto se inyecta correctamente
```

**Acción**: Verificar que el system prompt incluye contexto del paciente
**Evidencia**: Log del system prompt con datos del paciente

### Paso 3: Crear stub de NotebookLMService
```typescript
// services/NotebookLMService.ts (NUEVO)
export class NotebookLMService {
  static async query(query: string, axis?: string): Promise<NotebookLMResult[]> {
    // Stub: retorna resultado de ejemplo
    return [{
      document_id: 'stub_001',
      title: 'Documento de ejemplo',
      source: 'Fuente de ejemplo',
      excerpt: 'Extracto de ejemplo...',
      relevance: 0.8
    }];
  }
}
```

**Acción**: Crear archivo con stub
**Evidencia**: Build verde con nuevo servicio

### Paso 4: Conectar NotebookLM al asistente
```typescript
// components/GlobalAssistant.tsx
// Agregar punto de extensión para consultar NotebookLM
// Solo si el usuario pregunta por evidencia científica
```

**Acción**: Agregar lógica de consulta condicional
**Evidencia**: Screenshot de asistente consultando NotebookLM (stub)

### Paso 5: Crear log de sesiones básico
```typescript
// services/SessionLogService.ts (NUEVO)
export class SessionLogService {
  static async log(entry: SessionLogEntry): Promise<void> {
    console.log('[SessionLog]', entry);
    // Futuro: guardar en Supabase
  }
}
```

**Acción**: Crear servicio con log en consola
**Evidencia**: Log visible en consola del navegador

### Paso 6: Agregar indicador de fuente en respuestas
```typescript
// components/GlobalAssistant.tsx
// Modificar renderizado de respuestas para incluir:
// - Fuente del conocimiento (regla clínica / NotebookLM / usuario)
// - Nivel de confianza
// - Referencia específica si aplica
```

**Acción**: Modificar UI para mostrar fuentes
**Evidencia**: Screenshot de respuesta con fuente visible

---

## 3. Archivos a crear/modificar

### 3.1 Archivos nuevos
| Archivo | Contenido |
|---------|-----------|
| `services/NotebookLMService.ts` | Stub de consulta a NotebookLM |
| `services/SessionLogService.ts` | Log básico de sesiones |
| `types/notebooklm.ts` | Tipos para resultados de NotebookLM |

### 3.2 Archivos a modificar
| Archivo | Cambio |
|---------|--------|
| `components/GlobalAssistant.tsx` | Agregar punto de extensión para NotebookLM + log |
| `hooks/useAssistantConfig.ts` | Verificar inyección de contexto |
| `types/assistant.ts` | Agregar tipos para log de sesiones |

---

## 4. Lo que NO se hace en esta fase

| Elemento | Razón |
|----------|-------|
| Integración real con NotebookLM API | Requiere setup de workspace |
| Flujo completo de confirmación | Diseñar primero, implementar después |
| Modificar plan de tratamiento | Acción bloqueada |
| Enviar comunicaciones externas | Acción bloqueada |
| Usar modelos de IA para generación | Requiere confirmación por uso |

---

## 5. Validación del wiring

### 5.1 Prueba de integración
```
1. Abrir GlobalAssistant
2. Seleccionar paciente
3. Verificar que el asistente recibe contexto del paciente
4. Preguntar algo sobre el paciente
5. Verificar que la respuesta usa el contexto
6. Verificar que el log se registra en consola
```

### 5.2 Evidencia requerida
- [ ] Screenshot de asistente con contexto del paciente
- [ ] Screenshot de respuesta que usa contexto
- [ ] Log de consola con entrada de sesión
- [ ] Build verde
- [ ] Tests existentes pasando

---

## 6. Próximos pasos después del wiring

1. **Fase 2**: Integración real con NotebookLM API
2. **Fase 3**: Flujo de confirmación para acciones sensibles
3. **Fase 4**: Log persistente en Supabase
4. **Fase 5**: Métricas de uso y calidad

---

## Última Actualización
2026-06-28 — Documento de wiring mínimo de reactivación.

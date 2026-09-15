# Hoja de Ruta: Migración de Consumidores al ClinicalAlertBus

## Estado Actual (post-hardening)

### Capa 1: Settings → Runtime ✅
- `useAssistantConfig` — settings gobiernan GlobalAssistant
- `useClinicalIntelligence` — proactivity filtra sugerencias
- `GlobalAssistant` — voice, system prompt, permissions son dinámicos

### Capa 2: Alert Bus ✅
- `ClinicalAlertBus` — provider central con persistencia, dedup semántica, snooze enforcement, red_flag safety
- `useAlertBridge` — alimenta bus desde ProactiveSuggestion + RedFlag
- `useAlertMetrics` — métricas en tiempo real

### Capa 3: Consumidores (estado actual)
| Componente | Fuente actual | Fuente futura | Prioridad migración |
|-----------|--------------|--------------|-------------------|
| DashboardSection | Props (proactiveSuggestions, redFlags) | Bus | Alta |
| ClinicalInsightCard | ClinicalContextManager | Bus | Alta |
| FollowUpPanel | ClinicalContextManager | Bus | Media |
| FollowUpWorklist | followUpService (Supabase directo) | Bus | Baja |
| RedFlagAlert | Props (presentational) | Sin cambio | N/A |

---

## Fase 1: DashboardSection → Bus (PRIORIDAD ALTA)

**Cambio:** DashboardSection recibe `redFlags` y `proactiveSuggestions` como props.
**Migración:** Consumir `useClinicalAlerts()` directamente.

```
ANTES: props.redFlags → RedFlagAlert
AHORA: useClinicalAlerts().getAlerts({ category: 'red_flag' }) → RedFlagAlert
```

**Beneficio:** Las alertas del dashboard responden a settings (proactivity, canAutoAlert).

**Riesgo:** Bajo — el componente ya es presentacional, solo cambia la fuente de datos.

---

## Fase 2: ClinicalInsightCard → Bus (PRIORIDAD ALTA)

**Cambio:** ClinicalInsightCard suscribe a ClinicalContextManager para `proactiveClinicalSuggestions[0]`.
**Migración:** Consumir `useClinicalAlerts().getAlerts({ category: 'suggestion' })`.

```
ANTES: clinicalContextManager → proactiveClinicalSuggestions[0]
AHORA: useClinicalAlerts().getAlerts({ category: 'suggestion', severities: ['high'] })[0]
```

**Beneficio:** La sugerencia clínica respeta proactivity level y canAutoAlert.

**Riesgo:** Medio — necesita verificar que el bridge alimenta correctamente.

---

## Fase 3: FollowUpPanel → Bus (PRIORIDAD MEDIA)

**Cambio:** FollowUpPanel suscribe a ClinicalContextManager para `followUpHealth.alerts`.
**Migración:** Consumir `useClinicalAlerts().getAlerts({ category: 'follow_up' })`.

**Beneficio:** Alertas de seguimiento unificadas con el resto.

**Riesgo:** Medio — el bridge necesita alimentar FollowUpAlerts además de ProactiveSuggestion y RedFlag.

---

## Fase 4: FollowUpWorklist → Bus (PRIORIDAD BAJA)

**Cambio:** FollowUpWorklist llama directamente a `followUpService.getPatientsWithAlerts()`.
**Migración:** Mantener fuente Supabase (es cross-patient), pero enriquecer con datos del bus paraUI.

**Riesgo:** Bajo — el worklist es global, no necesita filtrado por paciente.

---

## Reglas de Migración

1. **Nunca romper flujos clínicos existentes** — migrar un componente a la vez
2. **Mantener dual source temporalmente** — componente puede usar bus Y fuente original durante transición
3. **Verificar build + funcionalidad después de cada migración**
4. **No migrar componentes presentacionales** (RedFlagAlert) — solo los que generan datos

---

## Criterios de Cierre de Capa 1

- [x] Settings gobiernan GlobalAssistant (voz, prompt, permisos)
- [x] useClinicalIntelligence respeta proactivity
- [x] Bus con persistencia, dedup semántica, snooze enforcement, red_flag safety
- [x] Métricas de alertas (creadas, deduplicadas, por estado/severidad/categoría/fuente)
- [x] Runtime guard en tool callbacks
- [x] Acciones sensibles con logging
- [x] Prompt con instrucciones de confirmación
- [x] Fallback de texto para voz (sendTextMessage)
- [x] DashboardSection migra a bus (Fase 1)
- [x] ClinicalInsightCard migra a bus (Fase 2)
- [x] FollowUpPanel migra a bus (Fase 3)
- [ ] FollowUpWorklist enriquece con bus (Fase 4 — pendiente)

**Capa 1 está sólida cuando:** no hay duplicados visibles, no se pierden red flags, las disposiciones se persisten, el comportamiento cambia con settings, y hay métricas reales.

---

## Fase 5: Historia Clínica Inteligente ✅

### 5.1: Modelos de Datos Clínicos
- [x] `types/clinical_history.ts` — ClinicalAxis (6 ejes), ClinicalEvolutionEntry, AxisSnapshot, ClinicalHistory, getAgeGroup(), CLINICAL_AXES constant
- [x] `services/AnamnesisTemplates.ts` — AGE_BRANCHES (7 grupos etarios), AREA_BRANCHES (6 áreas clínicas), getAdaptiveTemplate(), getAffectedAreasFromMotivo()
- [x] `templates/adaptiveAnamnesisAge.ts` — Plantillas específicas por edad (neonato → adulto mayor)
- [x] `templates/adaptiveAnamnesisArea.ts` — Plantillas específicas por área (lenguaje, motricidad, deglución, etc.)

### 5.2: Servicios de Evolución
- [x] `services/ClinicalEvolutionService.ts` — CRUD completo para entradas de evolución, snapshots por eje, cálculo de tendencias, análisis de riesgo

### 5.3: Componentes de UI
- [x] `components/AdaptiveAnamnesisForm.tsx` — Formulario adaptativo con progreso, validación, secciones dinámicas por edad/área
- [x] `components/ClinicalHistoryModule.tsx` — Vista unificada con línea de tiempo, ejes clínicos, alertas contextuales

### 5.4: Integración con ClinicalAlertBus
- [ ] Los hallazgos de anamnesis alimentan el bus como nuevas fuentes de alertas
- [ ] Detección automática de red flags basada en respuestas críticas
- [ ] Sugerencias contextuales basadas en historial longitudinal

### 5.5: Asistencia Contextual IA
- [ ] GlobalAssistant integra historial clínico en system prompt
- [ ] Sugerencias proactivas basadas en evolución del paciente
- [ ] Detección de patrones longitudinales (mejora/empeoramiento)

**Estado actual:** Modelos y servicios creados, UI funcional, pendiente integración con bus y asistencia IA.

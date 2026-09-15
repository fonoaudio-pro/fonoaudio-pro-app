# Checklist de Release Interna — Capa 1

## 1. Regresión General

- [ ] Build verde (`npx vite build`)
- [ ] App carga sin errores en consola
- [ ] Login/logout funciona
- [ ] Navegación entre vistas funciona (dashboard, patients, agenda, reports, settings, followup, metrics)
- [ ] Selección de paciente funciona
- [ ] Modal de nuevo paciente funciona
- [ ] Editor de tratamiento funciona
- [ ] Editor de informes funciona
- [ ] QuickModePanel funciona

## 2. Sistema de Alertas — Alertas Críticas

- [ ] Red flags aparecen en dashboard cuando existen
- [ ] Red flags críticos NO se pueden snooze (botón deshabilitado o sin efecto)
- [ ] Red flags críticos NO se pueden ignorar
- [ ] Red flags se pueden dismiss (solo ocultan, no borran)
- [ ] `hasCritical` refleja estado correcto en UI
- [ ] `criticalResolutionRatio` se actualiza al resolver red flags
- [ ] Alertas persisten tras recarga de página (localStorage)

## 3. Settings / Proactividad

- [ ] **minimal**: Dashboard NO muestra sugerencias proactivas
- [ ] **minimal**: Bus solo acepta `red_flag` (otros categorías bloqueadas)
- [ ] **balanced**: Dashboard muestra solo sugerencias `high` priority
- [ ] **proactive**: Dashboard muestra todas las sugerencias
- [ ] Cambio de proactividad se refleja inmediatamente en UI
- [ ] `canAutoAlert: false` bloquea todas las alertas nuevas
- [ ] Theme toggle (claro/oscuro/sistema) funciona y persiste
- [ ] Density setting persiste

## 4. Permisos del Asistente

- [ ] **Filtro Gemini**: herramientas no permitidas no aparecen en la sesión
- [ ] **Guard runtime**: intentar usar herramienta sin permiso retorna error "Permiso denegado"
- [ ] **Prompt**: asistente pide confirmación antes de acciones sensibles
- [ ] Desactivar `canAccessPatients` bloquea: navigate, open_editor, write_in_editor, update_patient_info, create_patient
- [ ] Desactivar `canAccessAgenda` bloquea: navigate, get_agenda, update_appointment_status
- [ ] Desactivar `canAccessHistory` bloquea: analyze_patient_case
- [ ] Desactivar `canAccessDatabase` bloquea: check_missing_data
- [ ] Logs de `SENSITIVE` aparecen en consola para update_patient_info, create_patient, update_appointment_status

## 5. Voz / Fallback

- [ ] GlobalAssistant abre y muestra UI de voz
- [ ] Si voz falla, aparece banner de error amber
- [ ] Input de texto siempre visible
- [ ] Input de texto envía mensaje al modelo (Enter)
- [ ] Status text cambia a "Modo texto disponible" cuando voice falla
- [ ] Desconexión limpia libera micrófono y audio context
- [ ] Cambio de tono (neutral/professional/warm) cambia voz del asistente

## 6. Deduplicación y Ruido

- [ ] Misma alerta no se duplica si se genera dos veces
- [ ] `metrics.totalDeduplicated` incrementa cuando se bloquea duplicado
- [ ] `metrics.totalCreated` solo cuenta alertas nuevas
- [ ] Distribución por severidad es precisa
- [ ] Distribución por categoría es precisa
- [ ] Distribución por source es precisa

## 7. Persistencia

- [ ] Alertas persisten en localStorage tras recarga
- [ ] Settings persisten en localStorage tras recarga
- [ ] Theme persiste en localStorage tras recarga
- [ ] Snoozed alerts reaparecen después de `snoozedUntil`
- [ ] Snooze timer funciona (revisión cada 60s)

## 8. Migración de Consumidores

- [ ] DashboardSection usa bus como fuente primaria
- [ ] DashboardSection usa props como fallback
- [ ] ClinicalInsightCard usa bus como fuente primaria
- [ ] ClinicalInsightCard usa clinicalContextManager como fallback
- [ ] ClinicalInsightCard registra decisiones en followUpService
- [ ] FollowUpPanel usa bus como fuente primaria
- [ ] FollowUpPanel usa clinicalContextManager como fallback
- [ ] FollowUpWorklist mantiene fuente Supabase (no migrado aún)

## 9. Componentes Clínicos (no migrados, verificar que siguen funcionando)

- [ ] FollowUpWorklist muestra datos reales de Supabase
- [ ] SuggestionEffectivenessDashboard muestra métricas reales
- [ ] NBADashboard muestra métricas reales
- [ ] ResourceReviewTray muestra recursos pendientes
- [ ] DistributionHistory muestra historial de envíos
- [ ] HomeGuideHistoryList muestra historial de guías

## 10. Dark Mode

- [ ] Sidebar visible en dark mode
- [ ] Dashboard cards dark mode
- [ ] Settings tabs dark mode
- [ ] Modales dark mode
- [ ] Inputs dark mode
- [ ] GlobalAssistant dark mode
- [ ] FollowUpPanel dark mode

## 11. Historia Clínica Inteligente (NUEVO MÓDULO)

- [ ] AdaptiveAnamnesisForm carga correctamente
- [ ] Selección de edad calcula grupo etario correcto
- [ ] Motivo de consulta selecciona áreas relevantes
- [ ] Formulario muestra secciones dinámicas según perfil
- [ ] Validación de campos requeridos funciona
- [ ] Progress bar refleja campos completados
- [ ] ClinicalHistoryModule muestra línea de tiempo
- [ ] ClinicalHistoryModule muestra ejes clínicos
- [ ] AxisSnapshot muestra hallazgos y tendencias
- [ ] Nueva anamnesis se guarda en base de datos
- [ ] Dark mode funciona en todos los componentes nuevos
- [ ] Integración con ClinicalAlertBus (pendiente)

---

**Regla de cierre:** No pasar a expansión clínica nueva hasta que:
1. No haya duplicados visibles
2. No se pierdan red flags
3. Las disposiciones queden bien gestionadas
4. El comportamiento cambie correctamente con settings
5. Tengamos métricas reales de uso y ruido

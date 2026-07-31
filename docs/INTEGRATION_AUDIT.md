# Auditoría de Integración Real — App Visible

**Fecha**: 2026-06-28
**URL**: http://localhost:3002
**Objetivo**: Diagnóstico brutalmente honesto de qué está montado y qué no

---

## 1. Árbol de Render Real (index.tsx → UI)

```
ToastProvider
  └─ ThemeProvider
       └─ SettingsProvider
            └─ ClinicalAlertBusProvider
                 └─ App
                      ├─ Sidebar (nav + botón Asistente IA)
                      ├─ main
                      │    ├─ DashboardSection ← MONTADO
                      │    ├─ PatientsSection ← MONTADO
                      │    │    └─ PatientDetailView ← MONTADO (cuando paciente seleccionado)
                      │    │         └─ ClinicalHistoryPanel ← MONTADO (tab 'historia')
                      │    │              ├─ AdaptiveAnamnesisForm ← MONTADO (sin templates)
                      │    │              ├─ ChannelActions ← MONTADO (botones Telegram/Scanner)
                      │    │              ├─ ScannedDocumentsList ← MONTADO
                      │    │              ├─ MaterialRequestForm ← MONTADO
                      │    │              └─ MaterialReviewTray ← MONTADO
                      │    ├─ AgendaSincronizada ← MONTADO
                      │    ├─ FollowUpWorklist ← MONTADO
                      │    ├─ MultimediaCreator ← MONTADO (vista multimedia)
                      │    ├─ VisualLibraryScreen ← MONTADO (vista biblioteca)
                      │    └─ SettingsSection ← MONTADO
                      ├─ AssistantBridge
                      │    └─ GlobalAssistant ← MONTADO
                      ├─ TemplateManager (modal)
                      ├─ QuickModePanel (modal)
                      └─ ConsultorioConfigPanel (modal)
```

---

## 2. Componentes Nuevos — Estado Real

| Componente | ¿Está montado? | ¿Dónde? | ¿Visible? |
|------------|----------------|---------|-----------|
| GlobalAssistant | ✅ SÍ | index.tsx:403 | Botón "Asistente IA" en sidebar |
| ClinicalHistoryPanel | ✅ SÍ | PatientDetailView:725 | Tab "Historia" en detalle de paciente |
| ChannelActions | ✅ SÍ | ClinicalHistoryPanel:330 | Botones "Enviar por Telegram" y "Escanear Documento" |
| MaterialRequestForm | ✅ SÍ | ClinicalHistoryPanel:419 | Formulario "Solicitar Material" |
| MaterialReviewTray | ✅ SÍ | ClinicalHistoryPanel:427 | Bandeja de revisión |
| ScannedDocumentsList | ✅ SÍ | ClinicalHistoryPanel:415 | Lista de documentos escaneados |
| AdaptiveAnamnesisForm | ✅ SÍ | ClinicalHistoryPanel:294 | Formulario adaptativo (sin templates DB) |

**Conclusión: TODOS los componentes nuevos están montados.**

---

## 3. Errores Reales Identificados

### 3.1 Google Calendar — ERR_CONNECTION_REFUSED
**Archivo**: `CalendarModule.tsx:30`
**Error**: `fetch('/api/google/calendar/events')` → 404/ERR_CONNECTION_REFUSED
**Causa**: No existe backend/API route en el Vite dev server para `/api/google/`
**Solución**: El endpoint apunta a un backend que no existe. Necesita mock o fallback.

### 3.2 Backend URL hardcoded
**Archivo**: `ClinicalPlanningModule.tsx:20`, `SessionWizard.tsx:119`
**Error**: `http://localhost:3001/api/process` → ERR_CONNECTION_REFUSED
**Causa**: Backend Node.js no está corriendo en puerto 3001
**Solución**: Mock o deshabilitar cuando backend no esté disponible

### 3.3 Manifest/Icon (cosmético)
**Error**: favicon/manifest puede dar 404
**Impacto**: Solo cosmético, no bloquea funcionalidad

---

## 4. Asistente IA — Estado Real

| Verificación | Estado |
|--------------|--------|
| Botón visible en sidebar | ✅ SÍ — botón "Asistente IA" al fondo del sidebar |
| Panel abre al clickear | ✅ SÍ — abre panel flotante bottom-right |
| Input de texto visible | ✅ SÍ — input "Escribí un mensaje..." |
| Badges de fuente | ✅ SÍ — se renderizan después de enviar mensaje |
| Modo voz | ⚠️ DEPENDE — requiere micrófono + API key de Google |

**El asistente ESTÁ visible y funcional en modo texto.** El modo voz requiere hardware y API key.

---

## 5. Dark Mode — Auditoría

| Sección | ¿Tiene dark mode? | ¿Funciona? |
|---------|-------------------|------------|
| Sidebar | ✅ Sí | ✅ Funciona |
| Dashboard | ✅ Sí | ✅ Funciona |
| Pacientes | ✅ Sí | ⚠️ Parcial (algunos elementos sin dark) |
| Modal Nuevo Paciente | ✅ Sí | ✅ Funciona |
| ClinicalHistoryPanel | ⚠️ Parcial | ❌ Faltan estilos dark en algunos elementos |
| Asistente IA | ✅ Sí | ✅ Funciona |
| ChannelActions | ❌ No | ❌ Botones sin dark mode |
| MaterialRequestForm | ❌ No | ❌ Formulario sin dark mode |
| MaterialReviewTray | ❌ No | ❌ Tray sin dark mode |

---

## 6. Fixes Críticos a Realizar

### Fix 1: Google Calendar — Mock para que no crashee
### Fix 2: ChannelActions — Agregar dark mode
### Fix 3: MaterialRequestForm — Agregar dark mode
### Fix 4: MaterialReviewTray — Agregar dark mode

---

## Última Actualización
2026-06-28 — Auditoría de integración real completada.

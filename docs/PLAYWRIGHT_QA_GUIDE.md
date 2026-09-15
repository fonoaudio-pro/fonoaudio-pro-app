# Guía Rápida: Playwright CLI para QA Visual

## Estado del Entorno

| Componente | Estado | Versión |
|------------|--------|---------|
| Node.js | ✅ Instalado | v24.4.1 |
| npm | ✅ Instalado | v11.4.2 |
| Playwright | ✅ Instalado | v1.60.0 |
| @playwright/test | ✅ Instalado | v1.61.1 |
| Chromium | ✅ Instalado | v1228 |
| Config | ✅ Configurado | `playwright.config.ts` |

---

## Comandos Principales

### 1. UI Mode (Recomendado para QA Visual)

```bash
# Abrir UI Mode con todos los tests
npm run test:e2e:ui

# O directamente
npx playwright test --ui
```

**Qué hace**: Abre una interfaz gráfica con:
- Lista de tests con filtros
- Timeline visual de cada test
- DOM snapshots en cada paso
- Consola del navegador
- Request/response de red
- Comparación de screenshots

### 2. Ejecutar Tests Específicos

```bash
# Ejecutar todos los tests
npm run test:e2e

# Ejecutar tests de Historia Clínica
npm run test:e2e:clinical

# Ejecutar un test específico
npx playwright test clinical-flow.spec.ts

# Ejecutar un caso específico
npx playwright test -g "TC-01"

# Ejecutar con headed (visible)
npm run test:e2e:headed

# Ejecutar con debug
npm run test:e2e:debug

# Ver reporte HTML
npm run test:e2e:report
```

### 3. Screenshots

```bash
# Tomar screenshot de una URL
npx playwright screenshot http://localhost:3002 screenshot.png

# Tomar screenshot completo (full page)
npx playwright screenshot --full-page http://localhost:3002 screenshot.png

# Tomar screenshot en mobile
npx playwright screenshot --device="iPhone 13" http://localhost:3002 mobile.png
```

### 4. Trace Viewer

```bash
# Ver trace de un test fallido
npx playwright show-trace test-results/trace.zip

# Los traces se guardan automáticamente en test-results/
# cuando trace: 'retain-on-failure' está configurado
```

### 5. Codegen (Generar Tests)

```bash
# Abrir navegador y grabar acciones
npx playwright codegen http://localhost:3002

# Con device específico
npx playwright codegen --device="iPhone 13" http://localhost:3002
```

---

## Flujo de QA para Historia Clínica

### Paso 1: Iniciar Dev Server

```bash
npm run dev
```

### Paso 2: Ejecutar Tests Existentes

```bash
npm run test:e2e
```

### Paso 3: Revisar Fallas en UI Mode

```bash
npm run test:e2e:ui
```

En UI Mode:
1. Filtrar tests por "failed"
2. Hacer click en el test fallido
3. Ver timeline para encontrar el paso que falló
4. Inspeccionar DOM snapshot en ese momento
5. Ver consola y errores de red

### Paso 4: Tomar Screenshots de Verificación

```bash
# Después de cada fix, tomar screenshot del componente
npx playwright screenshot http://localhost:3002/paciente/123/historia fix-verificacion.png
```

### Paso 5: Grabar Trace si Necesario

```bash
# Modificar playwright.config.ts temporalmente
trace: 'on'  // en lugar de 'retain-on-failure'

# Ejecutar test
npx playwright test -g "TC-06"

# Ver trace
npx playwright show-trace test-results/trace.zip
```

---

## Comandos Útiles para Inspección

### Abrir Navegador en Modo Visible

```bash
# Abrir Chromium con la app
npx playwright open http://localhost:3002

# Abrir con DevTools
npx playwright open --devtools http://localhost:3002
```

### Generar Código desde Acciones

```bash
# Grabar interacciones y generar código TypeScript
npx playwright codegen --output=tests/e2e/nuevo-test.spec.ts http://localhost:3002
```

### Ver Reporte HTML

```bash
# Después de ejecutar tests, ver reporte
npx playwright show-report
```

---

## Configuración Actual

**`playwright.config.ts`**:
- `testDir`: `./tests/e2e`
- `baseURL`: `http://localhost:3002`
- `headless`: `true` (cambiar a `false` para QA visual)
- `screenshot`: `only-on-failure`
- `trace`: `retain-on-failure`
- `webServer`: auto-inicia `npm run dev` en puerto 3002

---

## Para QA Visual (headless: false)

Si necesito ver el navegador mientras ejecuto tests:

1. Cambiar `headless: false` en `playwright.config.ts`
2. Ejecutar `npm run test:e2e:ui`
3. Los tests se ejecutan visibles en Chromium

---

## Monitoreo de Sesiones

Playwright no tiene un "show" para sesiones activas, pero:

1. **UI Mode** muestra el estado actual de cada test
2. **Trace Viewer** graba traces que se pueden revisar después
3. **Screenshots** se toman automáticamente en fallas
4. **Video** se puede habilitar agregando `video: 'on'` en config

---

## Capacidad de Revisión del Navegador

**Sí, esto habilita que yo pueda:**

1. **Ejecutar tests** y ver resultados en consola
2. **Tomar screenshots** de estados específicos
3. **Generar traces** que se pueden revisar
4. **Inspeccionar DOM** via código de Playwright
5. **Detectar errores** en consola del navegador
6. **Verificar requests** de red fallidos

**Limitación**: No puedo ver el navegador visualmente en tiempo real, pero puedo:
- Ejecutar comandos que generen artefactos visuales
- Analizar traces y screenshots
- Inspeccionar elementos via código
- Detectar errores en consola

---

## Tests Disponibles

### clinical-history-qa.spec.ts
Tests para QA de Historia Clínica Inteligente:
- QA-01: Neonato con cribado auditivo alterado
- QA-02: Lactante con retraso de lenguaje
- QA-03: Preescolar con habla limitada
- QA-04: Escolar con dificultades de lectura
- QA-05: Adulto con disfonía
- QA-06: Adulto Mayor con polimedicación
- UI: AdaptiveAnamnesisForm renders correctly
- UI: Dark mode badges are readable

### clinical-flow.spec.ts
Tests existentes de Sprint 8:
- TC-01 a TC-10: Flujo clínico completo

### playwright-visual-qa-test.ts
Test standalone para verificar Playwright Visual QA:
- Navegación a la app
- Screenshot
- Login
- Verificación de componentes

---

## Referencia Rápida

| Comando | Uso |
|---------|-----|
| `npm run test:e2e` | Ejecutar todos los tests |
| `npm run test:e2e:ui` | Abrir UI Mode (recomendado) |
| `npm run test:e2e:clinical` | Ejecutar tests de Historia Clínica |
| `npm run test:e2e:headed` | Tests visibles |
| `npm run test:e2e:debug` | Modo debug |
| `npm run test:e2e:report` | Ver reporte HTML |
| `npx playwright screenshot <url> <file>` | Screenshot |
| `npx playwright show-trace <trace>` | Ver trace |
| `npx playwright codegen <url>` | Generar tests |

---

## Artefactos de QA

Los screenshots y traces se guardan en `test-results/`:
- `qa-01-initial.png` - Estado inicial QA-01
- `qa-02-initial.png` - Estado inicial QA-02
- `qa-03-initial.png` - Estado inicial QA-03
- `qa-04-initial.png` - Estado inicial QA-04
- `qa-05-initial.png` - Estado inicial QA-05
- `qa-06-initial.png` - Estado inicial QA-06
- `ui-components.png` - Componentes de UI
- `dark-mode.png` - Dark mode
- `playwright-test-screenshot.png` - Test standalone
- `*.zip` - Traces de tests fallidos

---

## Última Actualización
2026-06-28 — Guía de Playwright CLI para QA visual con tests de Historia Clínica.

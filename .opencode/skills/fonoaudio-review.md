# Skill: FonoAudio-Pro Implementation Review & Repair

## Identificación
- **Nombre**: fonoaudio-review
- **Versión**: 1.0.0
- **Proyecto**: FonoAudio-Pro AI
- **Tipo**: Clinical Code Review + Automated Verification

---

## Contexto del Proyecto

FonoAudio-Pro es una **web app clínica** para profesionales de logopedia/fonoaudiología. Maneja:
- Historias clínicas con validación server-side
- RLS (Row Level Security) por consultorio para aislamiento de datos
- Sesiones terapéuticas vinculadas a pacientes
- Material multimedia generado por IA
- Analytics y dashboards clínicos

**CRÍTICO**: Los datos clínicos son sensibles. Cualquier bug puede causar:
- Pérdida de datos de pacientes
- Violación de aislamiento entre consultorios
- Errores en validaciones clínicas obligatorias

---

## Reglas Fundamentales

### LA LEY DE HIERRO: Sin Evidencia = Sin Fix

```
NUNCA reclames que un fix está completo sin evidencia verificable.
La secuencia OBLIGATORIA es:
  1. Review → 2. Fix → 3. Build → 4. Tests → 5. UI Check → 6. Informe
```

### Prioridades de Revisión (en orden)

1. **SEGURIDAD** — RLS policies, autenticación, aislamiento por consultorio
2. **INTEGRIDAD** — Constraints, FKs, validaciones server-side
3. **LÓGICA** — Flujos clínicos, estados, transiciones
4. **UI/UX** — React components, validaciones client-side, accesibilidad
5. **RENDIMIENTO** — Queries N+1, índices, optimización

---

## Flujo de Trabajo (Paso a Paso)

### Fase 1: Análisis de Cambios

```bash
# Identificar qué cambió
git diff --name-only HEAD~1
git status

# Leer archivos modificados
# Identificar: qué tablas toca, qué RLS usa, qué validaciones tiene
```

**Checklist de análisis:**
- [ ] ¿Se modificaron tablas con RLS?
- [ ] ¿Se agregaron o cambiaron FOREIGN KEYs?
- [ ] ¿Se tocaron functions SECURITY DEFINER?
- [ ] ¿Hay nuevas queries Supabase?
- [ ] ¿Se modificaron componentes de pacientes/sesiones?

### Fase 2: Review de Seguridad (RLS)

Para cada tabla con RLS modificada, verificar:

```sql
-- Verificar que RLS está habilitado
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'nombre_tabla';

-- Verificar políticas existentes
SELECT policyname, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'nombre_tabla';

-- Verificar que NO hay policies con 'true' (acceso total)
SELECT * FROM pg_policies 
WHERE tablename = 'nombre_tabla' 
AND (qual = 'true' OR with_check = 'true');
```

**Patrones de RLS correctos para FonoAudio-Pro:**
```sql
-- Acceso por consultorio
consultorio_id = ANY(user_consultorios())

-- Admin bypass
user_role() = 'admin'

-- Owner access
created_by = auth.uid() OR owner_id = auth.uid()

-- NUNCA esto (acceso total):
FOR SELECT USING (true)  -- ← PROHIBIDO en tablas sensibles
```

### Fase 3: Review de Integridad

```sql
-- Verificar FKs
SELECT 
  conname AS constraint_name,
  conrelid::regclass AS table_name,
  confrelid::regclass AS references_table,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'nombre_tabla'::regclass
AND contype = 'f';

-- Verificar que NO hay type mismatches
-- patients.id es TEXT, no UUID
-- Si hay FKs apuntando a patients con tipo uuid → BUG
```

### Fase 4: Aplicar Fixes

**Reglas:**
1. NUNCA hardcoded IDs — usar variables o functions
2. SIEMPRE validación server-side — client-side es complemento
3. SIEMPRE transaction safety — usar RLS + CHECK constraints
4. SIEMPRE idempotent SQL — `IF NOT EXISTS`, `DROP IF EXISTS`

### Fase 5: Verificación (GATES)

#### Gate 1: Build
```bash
npm run build
```
- [ ] 0 errores TypeScript
- [ ] 0 errores de build
- [ ] Warnings revisados (no críticos)

#### Gate 2: Tests E2E
```bash
npx playwright test tests/e2e/
```
- [ ] Todos los tests pasan
- [ ] No hay timeouts
- [ ] Login bypass funciona
- [ ] Flujos de pacientes/sesiones OK

#### Gate 3: UI Check (Manual o MCP)
Si Browserbase MCP está disponible:
```
Usar MCP browserbase para:
1. Abrir http://localhost:3002
2. Login con "Entrar sin Google (modo local)"
3. Navegar a la vista afectada
4. Verificar que no hay errores en consola
5. Tomar screenshot como evidencia
```

Si NO hay MCP, usar Playwright manual:
```bash
npx playwright test --headed
```

### Fase 6: Informe Final

Formato del informe:
```markdown
## Review Completado - [Fecha]

### Archivos Revisados
- `archivo1.tsx` — [cambios realizados]
- `archivo2.sql` — [RLS verificado]

### Issues Encontrados y Resueltos
1. [ISSUE] Descripción → [FIX] Cómo se resolvió

### Evidencia de Verificación
- [ ] Build: PASS (timestamp)
- [ ] Tests E2E: PASS (X/Y tests)
- [ ] UI Check: PASS (screenshot adjunto)

### RLS Policy Status
| Tabla | Policy | Estado |
|-------|--------|--------|
| patients | patients_select | ✅ CORRECTO |
| ... | ... | ... |

### Pendiente / Notas
- [Cualquier cosa que quede pendiente]
```

---

## Comandos Útiles

### Diagnosticar problemas comunes
```sql
-- Tablas con RLS pero sin policies
SELECT t.tablename 
FROM pg_tables t
LEFT JOIN pg_policies p ON t.tablename = p.tablename
WHERE t.schemaname = 'public'
AND t.rowsecurity = true
GROUP BY t.tablename
HAVING COUNT(p.policyname) = 0;

-- Policies con acceso total (peligroso)
SELECT schemaname, tablename, policyname, qual
FROM pg_policies
WHERE schemaname = 'public'
AND (qual = 'true' OR qual LIKE '%USING (true)%');

-- Functions SECURITY DEFINER que referencian tablas sensibles
SELECT routine_name, routine_definition
FROM information_schema.routines
WHERE routine_definition LIKE '%SECURITY DEFINER%'
AND routine_definition LIKE '%patients%';
```

### Verificar estado del proyecto
```bash
# Build status
npm run build 2>&1 | tail -5

# E2E tests
npx playwright test --reporter=list

# Dev server status
curl -s http://localhost:3002 -o /dev/null -w "%{http_code}"
```

---

## Contexto de Tablas Críticas

### patients
- `id`: TEXT (no UUID) — cuidado con FKs
- `owner_id`: uuid REFERENCES profiles(id)
- `consultorio_id`: text REFERENCES consultorios(id)
- RLS: owner + consultorio + admin

### appointments
- `professional_id`: TEXT (no uuid) — referencia a profiles
- `consultorio_id`: text REFERENCES consultorios(id)
- RLS: professional + consultorio + admin

### profiles
- `id`: uuid REFERENCES auth.users(id)
- `consultorio_ids`: text[]
- Self-referencing policy PROHIBIDO (causa crash PostgREST)
- Usar `user_role()` SECURITY DEFINER en vez de subquery

### material_assets
- `material_id`: uuid nullable REFERENCES materials(id)
- `consultorio_id`: text REFERENCES consultorios(id)
- RLS: consultorio + admin

---

## Errores Conocidos y Soluciones

### PostgREST 500 en profiles/patients/appointments
**Causa**: Self-referencing RLS policy en profiles
**Solución**: Reemplazar `(SELECT role FROM profiles WHERE id = auth.uid())` por `user_role()`

### PostgREST 406 en profiles
**Causa**: Perfil no existe para el usuario autenticado
**Solución**: INSERT del perfil faltante + verificar trigger handle_new_user()

### FK type mismatch patients
**Causa**: patients.id es TEXT pero tablas hijas usan UUID
**Solución**: Cast explícito o cambiar tipo de columna

---

## Trigger para Ejecución

### Bajo demanda (recomendado)
```
"Activa el skill fonoaudio-review. Revisá los últimos cambios en [ARCHIVO]. 
Si encontrás vulnerabilidades o errores, aplicalos, corre los tests E2E 
y validá en UI."
```

### Al cierre de fase sensible
```
"Cierro la fase [X] del Sprint [Y]. Ejecutá fonoaudio-review completo 
sobre todos los archivos modificados en esta fase."
```

---

## Notas de Implementación

- **Browserbase MCP**: ✅ Configurado y habilitado
- **GitHub MCP**: ✅ Configurado y habilitado
- **Playwright**: ✅ Ya configurado y funcionando
- **Supabase MCP**: ✅ Ya disponible via skill nativo

# Trazas de Código — 6 Casos de QA

## Estado: Traza completa. 1 bug encontrado y corregido (multiselect sin render).

---

## Caso 1: Neonato Auditivo

**Datos**: birthDate=2026-05-01, motivo="auditivo", cribado="No pasa OD"

**Cálculo de edad**: ageMonths = 1 → `neonato`

**Áreas afectadas**: `getAffectedAreasFromMotivo("auditivo")` → `['audicion']`

**Template**: getAdaptiveTemplate('neonato', ['audicion'])
- AGE_BRANCHES: neonato (datos_personales, motivo_consulta, antecedentes_prenatales)
- AREA_BRANCHES: audicion (audicion_eval)
- **4 secciones**: Datos Personales → Motivo Consulta → Ant. Prenatales → Evaluación Auditiva

**Campos requeridos**: nombre_completo, fecha_nacimiento, sexo, motivo_principal, embarazo_controlado, semanas_gestacion, tipo_parto, peso_nacimiento, lactancia, cribado_neonatal = 10 campos

**Red flags evaluados**:
- `neonato_cribado_no_pasa`: axis='audicion', cribado_neonatal='No pasa OD' → ✅ TRIGGERED (critical)
- `neonato_peso_bajo`: axis='cognicion' → ❌ No evaluado (affectedAreas=['audicion'] no incluye 'cognicion')

**AnamnesisAlertService**:
- detectFollowUpNeeds: redFlagFields.has('cribado_neonatal') → true → SKIP follow_up
- detectSuggestions: affectedAreas.includes('lenguaje') → false → SKIP

**Resultado esperado**: 1 red_flag (critical), 0 follow_ups, 0 suggestions

---

## Caso 2: Lactante Lenguaje

**Datos**: birthDate=2025-10-01, motivo="lenguaje", senala=false, balbuceo=true

**Cálculo**: ageMonths = 8 → `lactante`

**Áreas**: `['lenguaje']`

**Template**:
- AGE_BRANCHES: lactante (datos_personales, motivo_consulta, desarrollo_psicomotor, lenguaje_inicial, alimentacion)
- AREA_BRANCHES: lenguaje_expresivo + lenguaje_comprension
- **7 secciones**: Datos → Motivo → Desarrollo → Lenguaje Inicial → Alimentación → Lenguaje Expresivo → Lenguaje Comprensión

**Red flags (axis='lenguaje')**:
- `lactante_senala_no`: senala=false → ✅ TRIGGERED (critical)
- `lactante_balbuceo_no`: balbuceo=true → ❌ Not triggered

**AnamnesisAlertService**:
- detectFollowUpNeeds: oraciones field not in lactante template → SKIP
- detectSuggestions: socializacion not 'Normal' → depends on value

**Resultado esperado**: 1 red_flag (critical)

---

## Caso 3: Preescolar Lenguaje

**Datos**: birthDate=2023-06-01, motivo="lenguaje", oraciones="No habla"

**Cálculo**: ageMonths = 36 → `preescolar`

**Áreas**: `['lenguaje']`

**Template**:
- AGE_BRANCHES: preescolar (datos_personales, motivo_consulta, antecedentes_desarrollo)
- AREA_BRANCHES: lenguaje_expresivo + lenguaje_comprension
- **5 secciones**: Datos → Motivo → Ant. Desarrollo → Lenguaje Expresivo → Lenguaje Comprensión

**Red flags (axis='lenguaje')**:
- `preescolar_no_habla`: oraciones='No habla' → ✅ TRIGGERED (critical)

**AnamnesisAlertService**:
- detectFollowUpNeeds: oraciones='No habla' → EXCLUDED (we fixed this)

**Resultado esperado**: 1 red_flag (critical), 0 follow_ups

---

## Caso 4: Escolar Lectura

**Datos**: birthDate=2018-03-01, motivo="lectura", dificultades_lectura=true

**Cálculo**: ageMonths = 105 → `escolar`

**Áreas**: `['lenguaje']`

**Template**:
- AGE_BRANCHES: escolar (datos_personales, motivo_consulta, rendimiento_escolar)
- AREA_BRANCHES: lenguaje_expresivo + lenguaje_comprension
- **5 secciones**

**Red flags (axis='lenguaje')**:
- `escolar_no_lee`: dificultades_lectura=true → ✅ TRIGGERED (high)

**Resultado esperado**: 1 red_flag (high)

---

## Caso 5: Adulto Voz

**Datos**: birthDate=1990-01-01, motivo="voz", terapia_previa=true

**Cálculo**: ageMonths = 425 → `adulto`

**Áreas**: `['voz']`

**Template**:
- AGE_BRANCHES: adulto (datos_personales, motivo_consulta, antecedentes_laborales)
- AREA_BRANCHES: voz (voz_eval)
- **4 secciones**: Datos → Motivo → Ant. Laborales → Evaluación Voz

**⚠️ CAMPO MULTISELECT**: voz_eval tiene tipo_disfonia (multiselect) y habitos_vocales (multiselect) → **CORREGIDO**: renderField ahora soporta multiselect con botones tipo badge

**Red flags (axis='voz')**:
- `adulto_disfonia_prolongada`: terapia_previa=true → ✅ TRIGGERED (high)

**Resultado esperado**: 1 red_flag (high)

---

## Caso 6: Adulto Mayor Cognición

**Datos**: birthDate=1955-01-01, motivo="cognición", polimedicacion=true, deterioro_cognitivo=true

**Cálculo**: ageMonths = 853 → `adulto_mayor`

**Áreas**: `['cognicion']`

**Template**:
- AGE_BRANCHES: adulto_mayor (datos_personales, motivo_consulta, antecedentes_geriatricos)
- AREA_BRANCHES: none (no area branch for cognicion in AREA_BRANCHES)
- **3 secciones**: Datos → Motivo → Ant. Geriátricos

**Red flags (axis='cognicion')**:
- `adulto_mayor_polimedicacion`: polimedicacion=true → ✅ TRIGGERED (high)
- `adulto_mayor_deterioro_cognitivo`: deterioro_cognitivo=true → ✅ TRIGGERED (critical)
- `neonato_peso_bajo`: peso_nacimiento not in template → undefined → SKIPPED

**Resultado esperado**: 2 red_flags (1 high + 1 critical)

---

## Bugs encontrados y corregidos

### Bug 1: multiselect sin render (ROMPE caso adulto voz)
- **Impacto**: Campos tipo_disfonia y habitos_vocales en voz_eval no renderizaban
- **Fix**: Agregado case 'multiselect' en renderField con botones tipo badge
- **También agregado**: case 'scale' para adolescentes (futuro)

### Bug 2: Duplicaciones cribado/oraciones/deglución (ya corregido en sesión anterior)
- **Impacto**: 3 alertas duplicadas potenciales
- **Fix**: AnamnesisAlertService exuye follow_up si RedFlagRules ya cubre el caso

## Checklist de verificación manual (guía para el usuario)

### Caso 1: Neonato
1. Crear paciente nacido hace 2 semanas
2. Motivo: "auditivo"
3. Verificar 4 secciones en sidebar
4. Llenar cribado = "No pasa OD"
5. Guardar
6. Verificar 1 alerta critical en pestaña Alertas
7. Verificar que NO hay 2 alertas para el mismo hallazgo

### Caso 2: Lactante
1. Crear paciente de 8 meses
2. Motivo: "lenguaje"
3. Verificar 7 secciones
4. En "Inicio del Lenguaje": señala = NO
5. Guardar
6. Verificar 1 alerta critical

### Caso 3: Preescolar
1. Crear paciente de 3 años
2. Motivo: "lenguaje"
3. En "Ant. Desarrollo": oraciones = "No habla"
4. Guardar
5. Verificar 1 alerta critical
6. Verificar que NO aparece follow_up de lenguaje (duplicado)

### Caso 4: Escolar
1. Crear paciente de 7 años
2. Motivo: "lectura"
3. En "Rendimiento": dificultades lectura = SI
4. Guardar
5. Verificar 1 alerta high

### Caso 5: Adulto
1. Crear paciente de 35 años
2. Motivo: "voz"
3. En "Ant. Laborales": terapia previa = SI
4. En "Evaluación Voz": verificar que campos multiselect renderizan (tipo disfonía, hábitos)
5. Guardar
6. Verificar 1 alerta high

### Caso 6: Adulto Mayor
1. Crear paciente de 72 años
2. Motivo: "cognición"
3. En "Ant. Geriátricos": polimedicación = SI, deterioro cognitivo = SI
4. Guardar
5. Verificar 2 alertas (1 high + 1 critical)

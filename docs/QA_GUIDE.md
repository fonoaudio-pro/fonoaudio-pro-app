# Guía de QA — Historia Clínica Inteligente

**Versión**: 1.0 — Release Candidate
**Fecha**: 2026-06-28
**Estado**: Listo para QA manual

---

## Resumen por Caso

| Caso | Grupo | Motivo | Red flags esperados | Severidad |
|------|-------|--------|---------------------|-----------|
| QA-01 | Neonato | auditivo | cribado alterado | critical |
| QA-02 | Lactante | lenguaje | no señala | critical |
| QA-03 | Preescolar | lenguaje | no habla | critical |
| QA-04 | Escolar | lectura | dificultades lectura | high |
| QA-05 | Adulto | voz | disfonía con terapia previa | high |
| QA-06 | Adulto Mayor | cognición | polimedicación + deterioro | high + critical |

---

## QA-01: Neonato Auditivo

**Objetivo**: Verificar que el cribado auditivo alterado genera 1 red_flag critical sin duplicados.

### Datos de prueba
```
Nombre: "QA Neonato Auditivo"
Fecha nacimiento: 2026-06-14 (14 días)
Sexo: Masculino
Motivo consulta: "auditivo"
```

### Campos a completar por sección

**Sección 1 — Datos Personales**
| Campo | Valor | Requerido |
|-------|-------|-----------|
| nombre_completo | QA Neonato Auditivo | SÍ |
| fecha_nacimiento | 2026-06-14 | SÍ |
| sexo | Masculino | SÍ |

**Sección 2 — Motivo de Consulta**
| Campo | Valor | Requerido |
|-------|-------|-----------|
| motivo_principal | Cribado auditivo alterado | SÍ |

**Sección 3 — Antecedentes Prenatales**
| Campo | Valor | Requerido |
|-------|-------|-----------|
| embarazo_controlado | ☑ (check) | SÍ |
| semanas_gestacion | 39 | SÍ |
| tipo_parto | Vaginal | SÍ |
| peso_nacimiento | 3200 | SÍ |
| lactancia | Exclusiva materna | SÍ |
| cribado_neonatal | **No pasa OD** | SÍ |

**Sección 4 — Evaluación Auditiva** (área)
| Campo | Valor | Requerido |
|-------|-------|-----------|
| tipo_perdida | Neurosensorial | no |
| nivel_perdida | Moderada (41-55 dB) | no |
| uso_auxiliares | (sin seleccionar) | no |
| adaptacion_auxiliares | (sin seleccionar) | no |

### Trazas de decisiones

```
RedFlagRules.evaluateAnswers(answers, ['audicion']):
  → neonato_cribado_no_pasa: answers['cribado_neonatal']='No pasa OD' ∈ ['No pasa OD','No pasa OI','No realizado'] → TRIGGERED (critical)
  → neonato_peso_bajo: axis='cognicion' ∉ ['audicion'] → SKIPPED
  → perdida_auditoria_severa: answers['nivel_perdida']='Moderada (41-55 dB)' ∉ ['Severa (56-70 dB)','Profunda (>70 dB)'] → NOT TRIGGERED
  → auxiliares_rechazo: answers['adaptacion_auxiliares']=undefined → SKIPPED

AnamnesisAlertService.generateAlerts():
  → redFlagFields = {'cribado_neonatal'}
  → detectFollowUpNeeds: redFlagFields.has('cribado_neonatal')=true → SKIP follow_up
  → detectSuggestions: affectedAreas=['audicion'] ≠ 'lenguaje' → SKIP

Resultado: 1 alert
  red_flag | critical | ruleId=neonato_cribado_no_pasa | source=anamnesis
```

### Checklist
- [ ] 4 secciones visibles en sidebar
- [ ] Progress bar muestra 10 campos requeridos
- [ ] Checkbox "embarazo controlado" funciona (check/uncheck)
- [ ] Guardar sin campos requeridos → error en sección correcta
- [ ] Después de guardar: 1 alerta en pestaña Alertas
- [ ] Badge: critical (rojo)
- [ ] NO hay 2 alertas para cribado
- [ ] Timeline muestra entrada con fuente "Anamnesis"
- [ ] Dark mode: badges legibles

---

## QA-02: Lactante Lenguaje

**Objetivo**: Verificar que "no señala" genera 1 red_flag critical.

### Datos de prueba
```
Nombre: "QA Lactante Lenguaje"
Fecha nacimiento: 2025-10-28 (8 meses)
Sexo: Femenino
Motivo consulta: "lenguaje"
```

### Campos a completar

**Sección 1 — Datos Personales**: nombre, fecha, sexo

**Sección 2 — Motivo de Consulta**: motivo_principal = "Retraso en lenguaje expresivo"

**Sección 3 — Desarrollo Psicomotor**
| Campo | Valor | Requerido |
|-------|-------|-----------|
| sostien_cabeza | ☑ | SÍ |
| gatea | ☑ | no |
| camina | ☐ | no |
| erdemasiado | Normal | no |

**Sección 4 — Inicio del Lenguaje**
| Campo | Valor | Requerido |
|-------|-------|-----------|
| balbuceo | ☑ | SÍ |
| primeras_palabras | ☐ | no |
| **senala** | **☐ (NO marcar)** | **SÍ** |
| interaccion_social | Normal | SÍ |

**Sección 5 — Alimentación**
| Campo | Valor | Requerido |
|-------|-------|-----------|
| atragantamientos | ☐ | SÍ |

**Sección 6-7 — Lenguaje Expresivo / Comprensión** (área): campos opcionales

### Trazas de decisiones

```
RedFlagRules.evaluateAnswers(answers, ['lenguaje']):
  → lactante_senala_no: answers['senala']=false → TRIGGERED (critical)
  → lactante_balbuceo_no: answers['balbuceo']=true → NOT TRIGGERED

Resultado: 1 alert
  red_flag | critical | ruleId=lactante_senala_no | source=anamnesis
```

### Checklist
- [ ] 7 secciones en sidebar
- [ ] "senala" es checkbox requerido — sin marcar = error de validación
- [ ] Al guardar: 1 alerta critical
- [ ] NO hay alertas de follow_up o suggestions adicionales

---

## QA-03: Preescolar Lenguaje

**Objetivo**: Verificar que "no habla" genera 1 red_flag critical SIN follow_up duplicado.

### Datos de prueba
```
Nombre: "QA Preescolar Lenguaje"
Fecha nacimiento: 2023-06-15 (3 años)
Sexo: Masculino
Motivo consulta: "lenguaje"
```

### Campos a completar

**Sección 1-2**: nombre, fecha, sexo, motivo = "No forma oraciones"

**Sección 3 — Antecedentes de Desarrollo**
| Campo | Valor | Requerido |
|-------|-------|-----------|
| oraciones | **No habla** | SÍ |
| comprension_basica | 1 paso | SÍ |
| socializacion | Evita pares | SÍ |
| intereses_restringidos | ☐ | no |
| estereotipias | ☐ | no |

**Sección 4-5**: Lenguaje Expresivo / Comprensión (área): campos opcionales

### Trazas de decisiones

```
RedFlagRules.evaluateAnswers(answers, ['lenguaje']):
  → preescolar_no_habla: answers['oraciones']='No habla' → TRIGGERED (critical)
  → preescolar_estereotipias: answers['estereotipias']=false → NOT TRIGGERED
  → preescolar_intereses_restringidos: answers['intereses_restringidos']=false → NOT TRIGGERED

AnamnesisAlertService.detectFollowUpNeeds():
  → oraciones='No habla' → EXCLUDED (fix anterior)

Resultado: 1 alert
  red_flag | critical | ruleId=preescolar_no_habla | source=anamnesis
```

### Checklist
- [ ] 5 secciones
- [ ] oraciones="No habla" → 1 alerta critical
- [ ] NO aparece follow_up "Seguimiento de lenguaje expresivo" (era duplicado)
- [ ] socializacion="Evita pares" NO genera suggestion (solo si ≠ 'Normal' Y el campo existe en el template del área)

---

## QA-04: Escolar Lectura

**Objetivo**: Verificar dificultades de lectura → 1 red_flag high.

### Datos de prueba
```
Nombre: "QA Escolar Lectura"
Fecha nacimiento: 2018-09-10 (7 años)
Sexo: Femenino
Motivo consulta: "lectura"
```

### Campos a completar

**Sección 1-2**: nombre, fecha, sexo, motivo = "Dificultades para leer"

**Sección 3 — Rendimiento Escolar**
| Campo | Valor | Requerido |
|-------|-------|-----------|
| nivel_educativo | Primario 1-3 | SÍ |
| dificultades_lectura | ☑ (check) | no |
| dificultades_escritura | ☐ | no |
| adaptacion_escolar | Ninguna | no |
| terapia_previa | ☐ | no |

### Trazas de decisiones

```
RedFlagRules.evaluateAnswers(answers, ['lenguaje']):
  → escolar_no_lee: answers['dificultades_lectura']=true → TRIGGERED (high)
  → escolar_no_escribe: answers['dificultades_escritura']=false → NOT TRIGGERED

Resultado: 1 alert
  red_flag | high | ruleId=escolar_no_lee | source=anamnesis
```

### Checklist
- [ ] 5 secciones
- [ ] dificultades_lectura=SI → 1 alerta high (naranja)
- [ ] NO hay alertas adicionales

---

## QA-05: Adulto Voz

**Objetivo**: Verificar que multiselect funciona y disfonía con terapia previa → 1 red_flag high.

### Datos de prueba
```
Nombre: "QA Adulto Voz"
Fecha nacimiento: 1991-03-20 (35 años)
Sexo: Masculino
Motivo consulta: "voz"
```

### Campos a completar

**Sección 1-2**: nombre, fecha, sexo, motivo = "Disfonía crónica"

**Sección 3 — Antecedentes Laborales**
| Campo | Valor | Requerido |
|-------|-------|-----------|
| ocupacion | Profesor | SÍ |
| uso_voz_laboral | ☑ | no |
| tabaco | No fuma | no |

**Sección 4 — Evaluación de la Voz** (área)
| Campo | Valor | Requerido |
|-------|-------|-----------|
| calidad_vocal | Disfonía moderada | no |
| **tipo_disfonia** | **Nódulos, Tensión muscular** (multiselect) | no |
| rango_frecuencial | Normal (2+ octavas) | no |
| resistencia_vocal | Baja (5-15 min) | no |
| **habitos_vocales** | **Grito, Habla rápida** (multiselect) | no |

**⚠️ CHECK CRÍTICO**: Los campos tipo_disfonia y habitos_vocales deben renderizar como botones tipo badge seleccionables. Si no aparecen → BUG.

### Trazas de decisiones

```
RedFlagRules.evaluateAnswers(answers, ['voz']):
  → adulto_disfonia_prolongada: answers['terapia_previa']=false → NOT TRIGGERED

⚠️ Con terapia_previa=true:
  → adulto_disfonia_prolongada: answers['terapia_previa']=true → TRIGGERED (high)

Resultado con terapia_previa=true: 1 alert
  red_flag | high | ruleId=adulto_disfonia_prolongada | source=anamnesis
```

### Checklist
- [ ] 4 secciones
- [ ] Campo "tipo_disfonia" renderiza como badges multiselect
- [ ] Campo "habitos_vocales" renderiza como badges multiselect
- [ ] Se pueden seleccionar múltiples opciones
- [ ] terapia_previa=SI → 1 alerta high

---

## QA-06: Adulto Mayor Cognición

**Objetivo**: Verificar 2 red_flags (1 high + 1 critical) sin duplicados.

### Datos de prueba
```
Nombre: "QA Adulto Mayor Cognición"
Fecha nacimiento: 1954-01-15 (72 años)
Sexo: Femenino
Motivo consulta: "cognición"
```

### Campos a completar

**Sección 1-2**: nombre, fecha, sexo, motivo = "Deterioro de memoria"

**Sección 3 — Antecedentes Geriátricos**
| Campo | Valor | Requerido |
|-------|-------|-----------|
| polimedicacion | ☑ (check) | SÍ |
| independencia_funcional | Dependencia leve | SÍ |
| deterioro_cognitivo | ☑ (check) | no |
| protesis_auditiva | ☐ | no |

### Trazas de decisiones

```
RedFlagRules.evaluateAnswers(answers, ['cognicion']):
  → adulto_mayor_polimedicacion: answers['polimedicacion']=true → TRIGGERED (high)
  → adulto_mayor_deterioro_cognitivo: answers['deterioro_cognitivo']=true → TRIGGERED (critical)
  → neonato_peso_bajo: answers['peso_nacimiento']=undefined → SKIPPED

Resultado: 2 alerts
  red_flag | high | ruleId=adulto_mayor_polimedicacion | source=anamnesis
  red_flag | critical | ruleId=adulto_mayor_deterioro_cognitivo | source=anamnesis
```

### Checklist
- [ ] 3 secciones
- [ ] polimedicacion=SI → 1 alerta high
- [ ] deterioro_cognitivo=SI → 1 alerta critical
- [ ] Total: 2 alertas (no más, no menos)
- [ ] NO hay alertas de otros ejes

---

## Edge Cases para verificar duplicación

### Edge Case 1: Frecuencia atragantamientos
```
Input: atragantamientos=true, frecuencia_atragantamientos='Diario'
Resultado esperado: 1 red_flag (lactante_atragantamientos_frecuentes) + 0 follow_up
Razón: RedFlagRules ya cubre 'Diario', AnamnesisAlertService.skip
```

### Edge Case 2: Frecuencia "Ocasional"
```
Input: atragantamientos=true, frecuencia_atragantamientos='Ocasional'
Resultado esperado: 0 red_flags + 1 follow_up (deglución)
Razón: 'Ocasional' no está en la lista de RedFlagRules, follow_up sí se dispara
```

### Edge Case 3: Cribado "Pasa ambos oídos"
```
Input: cribado_neonatal='Pasa ambos oídos'
Resultado esperado: 0 alerts
Razón: No activa ninguna regla
```

### Edge Case 4: Oraciones "1-2 palabras" (preescolar)
```
Input: oraciones='1-2 palabras'
Resultado esperado: 0 red_flags + 1 follow_up (lenguaje)
Razón: No es 'No habla', pero sí ≠ 'Frases complejas'
```

---

## Formato de Reporte de Bugs

```
Caso: QA-XX
Paso: N
Sección: [nombre de sección]
Esperado: [qué debería pasar]
Observado: [qué pasó realmente]
Logs: [adjuntar si hay errores en consola]
Severidad: bloqueador | UX | estético
```

---

## Script de Seed de Pacientes de Prueba

Ver archivo: `scripts/qa_test_patients.json`

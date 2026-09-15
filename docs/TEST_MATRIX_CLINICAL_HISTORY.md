# Matriz de Testeo — Historia Clínica Inteligente

**Estado**: ✅ Listo para QA manual
**Build**: verde verificado (2857 modules, ~54s)
**Guía completa**: Ver `docs/QA_GUIDE.md`

---

## Resumen de casos

| Caso | Grupo | Secciones | Red flags | Severidad | Bug encontrado |
|------|-------|-----------|-----------|-----------|----------------|
| QA-01 | Neonato (14 días) | 4 | 1 | critical | — |
| QA-02 | Lactante (8 meses) | 7 | 1 | critical | — |
| QA-03 | Preescolar (3 años) | 5 | 1 | critical | — |
| QA-04 | Escolar (7 años) | 5 | 1 | high | — |
| QA-05 | Adulto (35 años) | 4 | 1 | high | multiselect SIN render → CORREGIDO |
| QA-06 | Adulto Mayor (72 años) | 3 | 2 | high + critical | — |

## Bugs corregidos pre-QA

1. **multiselect sin render** (AdaptiveAnamnesisForm) — campos tipo_disfonia y habitos_vocales no aparecían
2. **Duplicación cribado/oraciones/deglución** (AnamnesisAlertService) — follow_up se disparaba junto con red_flag
3. **Typo 'peech therapy'** (AnamnesisTemplates) — keyword de mapeo mal escrito
4. **Validación saltaba a sección 0** (AdaptiveAnamnesisForm) — ahora salta a primera sección con errores
5. **Badges dark mode** (ClinicalHistoryModule) — badges de severidad sin estilos dark

## Archivos de referencia

| Archivo | Contenido |
|---------|-----------|
| `docs/QA_GUIDE.md` | Guía completa con datos exactos, trazas de decisiones, checklists, edge cases |
| `docs/CODE_TRACES_QA.md` | Trazas de código por caso (legacy, ver QA_GUIDE) |
| `scripts/qa_test_patients.json` | Datos de prueba JSON para los 6 casos |

## Checklist rápido (para el tester)

Para cada caso:
1. Crear paciente con datos del JSON
2. Abrir ClinicalHistoryModule → Nueva Anamnesis
3. Verificar secciones en sidebar
4. Completar campos críticos (marcados en QA_GUIDE)
5. Guardar
6. Verificar pestaña Alertas → N alertas exactas
7. Verificar Timeline → entrada con fuente "Anamnesis"
8. Verificar Dark mode
9. Marcar checklist en QA_GUIDE

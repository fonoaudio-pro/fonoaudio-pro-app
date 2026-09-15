# Integración NotebookLM — Capa Científica Validada

**Fecha**: 2026-06-28
**Estado**: Diseño de arquitectura — antes de implementar
**Regla**: No es un chat suelto. Es fuente curada con trazabilidad de origen.

---

## 1. Corpus científico que entra

### 1.1 Documentos permitidos
| Tipo | Fuente | Ejemplo |
|------|--------|---------|
| Guías de práctica clínica | Ministerio de Salud, sociedades científicas | Guía de intervención en TDL |
| Artículos de revisión | PubMed, SciELO, Google Scholar | Revisión sistemática de intervención en disfagia |
| Protocolos institucionales | Propios del consultorio | Protocolo de evaluación auditiva neonatal |
| Manuales de intervención | Editoriales especializadas | Manual de estimulación del lenguaje |
| Normativas | Resoluciones ministeriales | Normativa de cobertura de logopedia |

### 1.2 Documentos NO permitidos
| Tipo | Razón |
|------|-------|
| Foros de discusión | No es evidencia científica |
| Redes sociales | No es fuente confiable |
| Blogs personales | No tiene revisión por pares |
| Artículos no revisados | Preprints sin validación |
| Contenido generado por IA | No es evidencia primaria |

### 1.3 Formatos aceptados
- PDF (preferido)
- DOCX
- TXT
- HTML (solo de fuentes académicas)

---

## 2. Organización del corpus

### 2.1 Estructura por eje clínico
```
NotebookLM Workspace: FonoAudio-Pro
├── Lenguaje
│   ├── Guías de práctica TDL
│   ├── Artículos de intervención
│   └── Protocolos de evaluación
├── Voz
│   ├── Guías de disfonía
│   ├── Artículos de rehabilitación vocal
│   └── Protocolos de evaluación vocal
├── Motricidad
│   ├── Guías de motricidad orofacial
│   ├── Artículos de deglución
│   └── Protocolos de evaluación motriz
├── Audición
│   ├── Guías de cribado auditivo
│   ├── Artículos de hablado
│   └── Protocolos de evaluación auditiva
├── Cognición
│   ├── Guías de deterioro cognitivo
│   ├── Artículos de estimulación cognitiva
│   └── Protocolos de evaluación cognitiva
└── General
    ├── Ética y confidencialidad
    ├── Normativa legal
    └── Guías de comunicación con familias
```

### 2.2 Metadatos por documento
```json
{
  "id": "doc_001",
  "title": "Guía de práctica clínica: Trastorno del desarrollo del lenguaje",
  "source": "Ministerio de Salud Chile",
  "year": 2024,
  "axis": "lenguaje",
  "type": "guia_practica",
  "version": "2.0",
  "approved_by": "Dr. Juan Pérez",
  "approved_at": "2024-03-15",
  "tags": ["TDL", "lenguaje", "niños", "evaluación"]
}
```

---

## 3. Uso por el asistente

### 3.1 Consulta al asistente
```
Usuario: "¿Cuál es la evidencia para intervención en TDL en niños de 3 años?"

Asistente:
1. Consulta NotebookLM con query: "TDL intervención niños 3 años"
2. Obtiene: 3 documentos relevantes
3. Genera respuesta con citas:
   "Según la Guía de Práctica Clínica del Ministerio de Salud (2024), 
    la intervención en TDL debe ser temprana y basada en evidencia...
    [Guía de práctica, p. 45]"
4. Incluye fuente y nivel de confianza
```

### 3.2 Elementos de la respuesta
```json
{
  "text": "La intervención en TDL debe iniciarse antes de los 4 años...",
  "sources": [
    {
      "document_id": "doc_001",
      "title": "Guía de práctica clínica: TDL",
      "page": 45,
      "excerpt": "La evidencia sugiere que la intervención temprana..."
    }
  ],
  "confidence": "high",
  "axis": "lenguaje",
  "last_updated": "2024-03-15"
}
```

---

## 4. Uso por multimedia

### 4.1 Generación de materiales
```
Usuario: "Crear guía de hogar para familia de paciente con TDL"

Sistema:
1. Consulta diagnóstico del paciente
2. Consulta NotebookLM para evidencia sobre guías de hogar en TDL
3. Genera borrador de guía basado en:
   - Estructura de guía validada
   - Contenido basado en evidencia
   - Lenguaje adaptado a familia
4. Profesional revisa antes de enviar
```

### 4.2 Contenido generado
- Guías de hogar con referencias
- Materiales de estimulación con base científica
- Secuencias terapéuticas basadas en evidencia
- Recursos educativos para familias

---

## 5. Control de calidad

### 5.1 Aprobación de documentos
```
1. Profesional carga documento en NotebookLM
2. Asigna metadatos (eje, tipo, fuente)
3. Documento queda en estado "pendiente"
4. Profesional revisa y aprueba
5. Documento queda activo para consultas
```

### 5.2 Versionado
- Cada edición crea nueva versión
- Se mantiene historial de versiones
- Alerta cuando hay versión nueva disponible
- Profesional decide si actualizar

### 5.3 Relevancia
- Asistente indica qué tan relevante es cada referencia
- Profesional puede calificar relevancia
- Feedback loop para mejorar selección

---

## 6. Trazabilidad de origen

### 6.1 Log de consultas
```json
{
  "timestamp": "2026-06-28T10:30:00Z",
  "user_id": "user_123",
  "patient_id": "patient_456",
  "query": "evidencia intervención TDL niños 3 años",
  "documents_consulted": ["doc_001", "doc_002", "doc_003"],
  "documents_used": ["doc_001"],
  "response_generated": true,
  "confidence": "high",
  "sources_cited": 1
}
```

### 6.2 Auditoría
- Cada respuesta indica sus fuentes
- Cada fuente indica su origen y fecha
- Cada consulta queda registrada
- Métricas de uso por documento

### 6.3 Control de acceso
- Solo documentos aprobados se usan
- Solo usuarios autorizados consultan
- Cada consulta es trazable
- Límite de consultas por usuario/día

---

## 7. Puntos de extensión

### 7.1 Fase 1: Stub preparado
- `services/NotebookLMService.ts` con interfaz definida
- Integración con `useAssistantConfig` para system prompt
- Punto de conexión con `GlobalAssistant`

### 7.2 Fase 2: Integración básica
- Consulta a NotebookLM desde asistente
- Respuesta con citas y fuentes
- Log de consultas

### 7.3 Fase 3: Integración completa
- Generación de materiales con evidencia
- Feedback loop de relevancia
- Métricas de uso y calidad

---

## 8. Validación

### 8.1 Criterios de activación
- [ ] Workspace de NotebookLM creado
- [ ] Documentos iniciales cargados (5-10 guías principales)
- [ ] NotebookLMService implementado
- [ ] Integración con GlobalAssistant funcionando
- [ ] System prompt actualizado con instrucciones de citas
- [ ] Log de consultas implementado
- [ ] Prueba piloto con 3-5 consultas reales

### 8.2 Evidencia requerida
- Screenshot de NotebookLM con documentos cargados
- Screenshot de asistente citando documento de NotebookLM
- Log de consulta con estructura correcta
- Build verde + tests de integración

---

## Última Actualización
2026-06-28 — Documento de diseño de integración NotebookLM.

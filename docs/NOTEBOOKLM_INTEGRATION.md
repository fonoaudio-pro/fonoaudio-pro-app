# Integración de NotebookLM — Base Científica para FonoAudio-Pro

## Contexto

NotebookLM de Google es un asistente de investigación que permite cargar documentos científicos (artículos, guías, protocols) y consultarlos con contexto. En FonoAudio-Pro, funciona como:

1. **Base científica para el asistente IA** — referencias validadas para cada respuesta
2. **Generador de contenido** — borradores de materiales basados en evidencia
3. **Biblioteca viva** — actualización continua de guías y protocols

---

## Arquitectura de Integración

```
┌─────────────────────────────────────────────────────────────┐
│                    FonoAudio-Pro                             │
├─────────────────────────────────────────────────────────────┤
│  GlobalAssistant ← useAssistantConfig ← useLongitudinalContext│
│         ↓                    ↓                    ↓           │
│  System Prompt          Permisos           Contexto Paciente │
│         ↓                    ↓                    ↓           │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              NotebookLM Service                     │    │
│  │  - Consulta documentos relevantes                   │    │
│  │  - Devuelve extractos + referencias                 │    │
│  │  - Registra qué se consultó                         │    │
│  └─────────────────────────────────────────────────────┘    │
│                           ↓                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Respuesta con Citas                    │    │
│  │  "Según [Autor, Año], la intervención X..."        │    │
│  │  Fuente: documento_cargado.pdf (v2, 2026-03-15)    │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

## Uso por Capa

### Capa 1: Base Científica para Asistente IA

**Qué hace**: El asistente consulta NotebookLM antes de responder preguntas clínicas.

**Cómo funciona**:
1. Profesional pregunta: "¿Cuál es la evidencia para intervención X en paciente con Y?"
2. Sistema consulta NotebookLM con la pregunta
3. NotebookLM devuelve documentos relevantes + extractos
4. Asistente genera respuesta con citas bibliográficas
5. Respuesta incluye: texto + fuente + fecha + nivel de confianza

**Control**:
- Solo documentos aprobados por el profesional
- Cada respuesta indica la fuente específica
- El profesional decide si usar la referencia o no
- Log de qué documentos se consultaron

### Capa 2: Generación de Contenido

**Qué hace**: Generar borradores de materiales clínicos basados en evidencia científica.

**Ejemplos**:
- Guía de hogar para paciente con trastorno del desarrollo del lenguaje
- Material PECS basado en protocolo de intervención
- Secuencia terapéutica según guía de práctica clínica

**Flujo**:
1. Profesional solicita material para paciente específico
2. Sistema identifica diagnóstico/plan del paciente
3. Consulta NotebookLM para evidencia relevante
4. Genera borrador del material con referencias
5. Profesional revisa, edita y aprueba
6. Material se guarda y queda trazable

**Control**:
- Borrador siempre requiere aprobación
- Material incluye referencias bibliográficas
- Registro de quién generó, cuándo, con qué evidencia

### Capa 3: Recursos Clínicos Curados

**Qué hace**: Mantener biblioteca viva de guías y protocols actualizados.

**Documentos típicos**:
- Guías de práctica clínica (nacionales e internacionales)
- Artículos científicos de fonoaudiología
- Protocolos institucionales
- Manuales de intervención

**Control**:
- Solo documentos aprobados por el profesional
- Versionado: quién cargó, cuándo, qué versión
- Alerta cuando hay versión nueva disponible
- Límite de documentos activos por workspace

---

## Controles y Restricciones

### 1. Control de Acceso

| Nivel | Descripción |
|-------|-------------|
| **Documento** | Solo el propietario puede cargar/eliminar |
| **Workspace** | Documentos compartidos solo con usuarios autorizados |
| **Consulta** | Solo documentos del workspace activo |
| **Exportación** | No permitida (los documentos son de NotebookLM) |

### 2. Control de Calidad

| Mecanismo | Descripción |
|-----------|-------------|
| **Aprobación** | Documentos requieren aprobación antes de usar |
| **Versionado** | Cada edición crea nueva versión |
| **Relevancia** | Asistente indica qué tan relevante es cada referencia |
| **Actualización** | Alerta cuando documento tiene versión nueva |
| **Auditoría** | Log de consultas por sesión |

### 3. Control de Uso

| Límite | Valor | Descripción |
|--------|-------|-------------|
| **Documentos activos** | 50 por workspace | Límite de documentos cargados |
| **Consultas/día** | 100 por usuario | Límite de consultas a NotebookLM |
| **Tamaño/doc** | 50 MB | Tamaño máximo por documento |
| **Formatos** | PDF, DOCX, TXT | Formatos aceptados |

### 4. Trazabilidad

| Dato | Descripción |
|------|-------------|
| **Consulta** | Quién preguntó, cuándo, qué documentos se consultaron |
| **Respuesta** | Qué fuentes se usaron, qué extractos se citaron |
| **Uso** | Si el profesional usó la referencia en su acción |
| **Actualización** | Cuándo se actualizó un documento, quién lo hizo |

---

## Flujo de Implementación

### Fase 1: Configuración Inicial
1. Crear workspace de NotebookLM
2. Cargar documentos iniciales (guías principales)
3. Configurar permisos de acceso
4. Implementar NotebookLM Service

### Fase 2: Integración con Asistente
1. Actualizar system prompt con instrucciones de citas
2. Implementar consulta a NotebookLM desde GlobalAssistant
3. Agregar formato de respuestas con referencias
4. Implementar log de consultas

### Fase 3: Generación de Contenido
1. Implementar flujo de solicitud de material
2. Integrar con generación de contenido desde NotebookLM
3. Implementar revisión y aprobación
4. Agregar trazabilidad de materiales generados

### Fase 4: Optimización
1. Implementar caché de documentos frecuentes
2. Optimizar consultas (búsqueda semántica)
3. Implementar alertas de actualización
4. Métricas de uso y relevancia

---

## Criterios de Activación

- [ ] Workspace de NotebookLM creado
- [ ] Documentos iniciales cargados (5-10 guías principales)
- [ ] NotebookLM Service implementado
- [ ] Integración con GlobalAssistant funcionando
- [ ] System prompt actualizado con instrucciones de citas
- [ ] Formato de respuestas con referencias implementado
- [ ] Log de consultas implementado
- [ ] Flujo de generación de contenido (borrador → revisión)
- [ ] Control de versiones funcionando
- [ ] Prueba piloto con 3-5 consultas reales

---

## Riesgos y Mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| **NotebookLM no disponible** | Fallback a respuestas sin referencias, con aviso |
| **Documentos desactualizados** | Alerta de versión, control de versiones |
| **Referencias no relevantes** | Profesional indica relevancia, feedback loop |
| **Límite de consultas** | Cache local, optimización de queries |
| **Costo de API** | Monitoreo de uso, límites diarios |

---

## Documentos de Referencia

| Documento | Contenido |
|-----------|-----------|
| `docs/FROZEN_FRONTS_ROADMAP.md` | Roadmap maestro con todos los frentes |
| `docs/QA_GUIDE.md` | QA de Historia Clínica (prerequisito) |
| `docs/ALERT_MIGRATION_ROADMAP.md` | Migración de consumidores al bus |

---

## Última Actualización
2026-06-28 — Plan de integración de NotebookLM como base científica.

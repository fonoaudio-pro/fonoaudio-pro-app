# Investigación: Editor Multimedia Avanzado para FonoAudio-Pro

## Contexto
FonoAudio-Pro necesita diseñar materiales clínicos complejos: guías de hogar con diagramas, materiales PECS con layout custom, secuencias con elementos interactivos, y materiales educativos con composición visual. Actualmente solo generamos pictogramas y tarjetas simples con ComfyUI. Se necesita un editor canvas real.

---

## Opción 1: Fabric.js (YA LO USAMOS)

**Estado actual:** Ya integrado en `MaterialEditor.tsx` con fix de importación v6.

| Aspecto | Detalle |
|---------|---------|
| **Versión** | v7.0.0 (latest, escrito en TypeScript) |
| **GitHub** | 29k+ stars, 14+ años de madurez |
| **Licencia** | MIT (100% gratis, sin watermark) |
| **Bundle** | ~300KB min, tree-shakeable |
| **React** | Requiere wrapper manual (useRef + useEffect), no es React-nativo |
| **API** | Imperativa: `canvas.add(new fabric.Rect({...}))` |

### Capacidades relevantes
- Texto editable on-canvas con estilos ricos
- Importación/exportación SVG
- Filtros de imagen (brillo, contraste, saturación)
- freehand drawing con PencilBrush
- Object grouping, layers, undo/redo
- Export a PNG/JPG/SVG/JSON
- Clip paths, sombras, gradientes
- Soporte IME (input method para CJK)

### Limitaciones para nuestro caso
- **No tiene collaboration** — cada usuario edita local
- **API imperativa** — no es declarativa como React, requiere bridge manual
- **Sin infinite canvas** — es un canvas fijo con zoom/pan
- **Sin shapes nativas** — hay que construir cada forma desde cero

### ¿Para qué sirve en nuestro caso?
Ideal para: **tarjetas simples, PECS con layout fijo, materiales 1-página, edición de imágenes existentes**

---

## Opción 2: tldraw SDK

| Aspecto | Detalle |
|---------|---------|
| **Versión** | v5.0.1 (mayo 2026, muy reciente) |
| **GitHub** | 48k+ stars, 5 años |
| **Licencia** | tldraw SDK License — **gratis con watermark "Made with tldraw"**, business license para quitar watermark ($499/mes o custom) |
| **Bundle** | ~200KB core, tree-shakeable |
| **React** | **React-nativo**: cada shape es un React component |
| **API** | Declarativa + runtime Editor API programática |

### Capacidades relevantes
- **Infinite canvas** con zoom/pan ilimitado
- **Multiplayer built-in** con `@tldraw/sync` (self-hostable)
- **Custom shapes** como React components — ideal para plantillas clínicas
- **Custom tools** — crear herramientas específicas (arrastrar pictograma, conectar flechas, etc.)
- **Export** a PNG, SVG, JSON
- **Colaboración en tiempo real** con live cursors
- **Multi-media**: imágenes, videos, embeds de URLs
- **AI integration** — canvas primitives para LLMs
- **Theming** — sistema de temas reactivo (v5.0)
- **Display values** — control visual granular de shapes

### Limitaciones
- **Licencia comercial**: quitar watermark requiere business license ($499/mes o acuerdo)
- **No tiene image filters** nativos — requiere canvas custom o librería externa
- **Complejidad de integración** — es un SDK completo, no un componente drop-in
- **Riesgo de vendor lock-in** — si cambian la licencia, afecta al producto

### ¿Para qué sirve en nuestro caso?
Ideal para: **editor de materiales complejos con colaboración, plantillas interactivas, composición visual tipo Canva**

---

## Opción 3: Excalidraw

| Aspecto | Detalle |
|---------|---------|
| **Versión** | Latest (commit hace 2 días) |
| **GitHub** | 125k+ stars, 6 años, el más popular |
| **Licencia** | MIT (100% gratis) |
| **Bundle** | ~400MB (es una app completa, no un SDK ligero) |
| **React** | Componente React disponible (`@excalidraw/excalidraw`) |
| **API** | REST API + React component |

### Capacidades relevantes
- **Estilo hand-drawn** — estética profesional para materiales educativos
- **Library system** — bibliotecas compartidas de elementos
- **Export** a PNG, SVG, JSON
- **Colaboración en tiempo real** built-in
- **E2E encryption** — seguridad para datos clínicos
- **PWA** — funciona offline
- **Frames** — organizar contenido en secciones

### Limitaciones
- **No es un editor de diseño** — es una pizarra, no permite layout preciso como Canva
- **Estilo hand-drawn forzado** — no se puede cambiar a estilo limpio/profesional
- **No tiene custom shapes programáticas** — solo formas predefinidas
- **Bundle pesado** — no es viable como componente embebido ligero
- **No tiene image filters** ni edición de imagen avanzada

### ¿Para qué sirve en nuestro caso?
Ideal para: **brainstorming clínico, diagramas de flujo terapéutico, sesiones de ideación con equipo**

---

## Comparativa Final para FonoAudio-Pro

| Criterio | Fabric.js | tldraw | Excalidraw |
|----------|-----------|--------|------------|
| **Licencia** | MIT ✅ | Comercial ⚠️ | MIT ✅ |
| **Costo** | $0 | $0 (watermark) / $499/mes | $0 |
| **React nativo** | No ❌ | Sí ✅ | Sí ✅ |
| **Infinite canvas** | No ❌ | Sí ✅ | Sí ✅ |
| **Custom shapes** | Manual | React components ✅ | Limitado ⚠️ |
| **Multiplayer** | No ❌ | Sí ✅ | Sí ✅ |
| **Image filters** | Sí ✅ | No ❌ | No ❌ |
| **Export PNG/SVG** | Sí ✅ | Sí ✅ | Sí ✅ |
| **Hand-drawn style** | No ❌ | Opcional | Sí (forzado) |
| **Performance** | Excelente | Muy buena | Buena |
| **Madurez** | 14+ años ✅ | 5 años | 6 años |
| **Dificultad integración** | Media | Alta | Baja |

---

## Recomendación: Arquitectura Híbrida

### Capa 1: Fabric.js (EDICIÓN EXISTENTE — mantener)
- **Ya lo tenemos integrado** en `MaterialEditor.tsx`
- Útil para: edición de imagen, filtros, composición simple
- **No reemplazar**, es complementario

### Capa 2: tldraw SDK (NUEVO — para editor avanzado)
- **Recomendación principal** para materiales clínicos complejos
- **Razón clave**: React-nativo, infinite canvas, custom shapes como componentes, multiplayer
- **Riesgo de licencia mitigable**: para uso interno sin redistribute, el watermark es aceptable; para versión SaaS, negociar licencia
- **Integración**: componente `<Tldraw />` en un modal/página dedicada

### Capa 3: Excalidraw (FUTURO — para brainstorming)
- Reservado para modo de planificación/brainstorming
- No es prioritario

### Flujo propuesto
```
Usuario → "Crear Material Complejo"
  → Se abre editor tldraw embebido
  → Plantillas predefinidas (guía hogar, secuencia PECS, material educativo)
  → Drag & drop de pictogramas ARASAAC
  → Conexiones, anotaciones, layout custom
  → Export a PNG/PDF → Supabase Storage
```

### Próximos pasos (Sprint 3+)
1. `npm i tldraw` — instalar SDK
2. Crear `components/MaterialDesignStudio.tsx` — wrapper con toolbars custom
3. Definir custom shapes: `PictogramShape`, `TextBlockShape`, `FlowArrowShape`
4. Crear plantillas clínicas como tldraw templates
5. Integrar con ARASAAC drag-and-drop
6. Evaluar licencia para producción

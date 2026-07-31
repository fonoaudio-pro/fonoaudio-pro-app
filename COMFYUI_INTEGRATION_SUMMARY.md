# Motor de Materiales Multimedia - Documentación Actualizada

## Arquitectura General

El sistema de generación de materiales multimedia de FonoAudio-Pro tiene **3 motores**:

| Motor | Uso | Costo | Dependencia IA |
|---|---|---|---|
| **Determinístico (Pillow)** | Pictogramas, PECS, secuencias, tarjetas | $0 | Ninguna |
| **ARASAAC Provider** | Pictogramas clínicos externos | $0 | Ninguna (API pública) |
| **Generativo (SDXL/FLUX)** | Escenas terapéuticas, redes sociales, fotos | ~$0.01-0.03/imagen | ComfyUI en Modal |

---

## 1. Motor Determinístico (Local)

Renderiza pictogramas desde definiciones JSON usando Pillow. **Costo cero, sin dependencia de modelos generativos.**

### Endpoints
| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/pictogram/categories` | Lista categorías disponibles |
| `GET` | `/pictogram/list?category={cat}` | Lista pictogramas por categoría |
| `POST` | `/pictogram/generate` | Renderiza pictograma con etiqueta |
| `POST` | `/pictogram/pecs` | Renderiza tarjeta PECS (grid 1-6 pictos) |
| `POST` | `/pictogram/sequence` | Renderiza secuencia numerada de pasos |
| `POST` | `/pictogram/card` | Renderiza tarjeta flashcard con título |

### Archivos
- `pictogram_engine/pictogram_engine.py` - Renderizador Pillow (5 modos)
- `pictogram_engine/api_routes.py` - Rutas FastAPI
- `pictogram_engine/library/pictograms.json` - 67 pictogramas en 10 categorías
- `services/PictogramService.ts` - Cliente TypeScript

### Categorías (67 pictogramas)
- Animales (9): perro, gato, pajaro, pez, vaca, caballo, rana, mariposa, tortuga
- Alimentos (9): manzana, pan, leche, galleta, jugo, plato, agua, banana, sandwich
- Cuerpo (6): mano, boca, ojo, oreja, pie, cabeza
- Acciones (9): comer, beber, dormir, correr, lavarse, hablar, escuchar, mirar, esperar
- Emociones (7): feliz, triste, enojado, asustado, sorprendido, cansado, contento
- Objetos (7): pelota, libro, lapiz, reloj, silla, telefono, casa
- Lugares (5): escuela, casa_interior, parque, hospital, bano
- Ropa (4): camisa, pantalon, zapato, sombrero
- Números (5): uno, dos, tres, cuatro, cinco
- Colores (6): rojo, azul, verde, amarillo, naranja, morado

---

## 2. ARASAAC Provider

Busca y obtiene pictogramas clínicos del banco público ARASAAC (Gobierno de Aragón). **Costo cero, licencia CC BY-NC-SA.**

### Endpoints
| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/arasaac/search?q={texto}&lang={idioma}` | Busca pictogramas por texto |
| `GET` | `/arasaac/pictogram/{id}` | Metadata completa de un pictograma |
| `GET` | `/arasaac/image/{id}?resolution={res}` | Descarga imagen como base64 |
| `GET` | `/arasaac/keywords?lang={idioma}` | Lista de palabras clave disponibles |

### Archivos
- `pictogram_engine/arasaac_routes.py` - Proxy backend (evita CORS)
- `services/ArasaacService.ts` - Cliente TypeScript con cache localStorage

### Características
- **Cache**: localStorage con TTL de 1 hora
- **Búsqueda**: Texto en español (o 38 idiomas disponibles)
- **Imágenes**: 500px (default), 2500px (alta resolución)
- **Variaciones**: Color/B&W, acciones, piel, pelo

### Uso en los 4 modos
- **Pictograma**: Descarga imagen ARASAAC directa
- **PECS**: Grid con imágenes ARASAAC seleccionadas
- **Secuencia**: Secuencia numerada con imágenes ARASAAC
- **Tarjeta**: Flashcard con imagen ARASAAC + título

---

## 3. Motor Generativo (SDXL/FLUX)

Genera imágenes reales con Stable Diffusion XL via ComfyUI en Modal. **Requiere GPU, costo por uso.**

### Endpoints
| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/health` | Verifica estado de ComfyUI + motores |
| `GET` | `/workflows` | Lista workflows disponibles |
| `POST` | `/generate` | Genera imagen con workflow específico |
| `GET` | `/image/{image_id}` | Obtiene imagen generada |
| `GET` | `/get_image?image_id={id}` | Obtiene imagen por query param |

### 9 Workflows Disponibles
1. `pictogram` - Pictograma simple ($0.01-0.02)
2. `cartoon` - Cartoon infantil ($0.02-0.03)
3. `realistic` - Fotorrealista ($0.03-0.05)
4. `therapy_scene` - Escena terapéutica ($0.02-0.03)
5. `emotion` - Emociones ($0.01-0.02)
6. `social_media` - Redes sociales ($0.03-0.05)
7. `flashcard` - Tarjeta educativa ($0.01-0.02)
8. `sequence_step` - Paso de secuencia ($0.01-0.02)
9. `family_guide` - Guía familiar ($0.02-0.03)

### Archivos
- `modal_comfyui.py` - Endpoint Modal con FastAPI
- `services/ComfyUIService.ts` - Cliente TypeScript
- `deploy_comfyui.py` - Script de deployment

---

## Flujo Completo de Generación

```
┌─────────────────────────────────────────────────────┐
│                    UI (MultimediaCreator.tsx)         │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │
│  │Pictogramas│  │Gen. con  │  │Subir Foto        │   │
│  │ (local/   │  │IA        │  │→ Pictograma      │   │
│  │ ARASAAC)  │  │          │  │                  │   │
│  └────┬─────┘  └────┬─────┘  └────────┬─────────┘   │
│       │              │                 │              │
└───────┼──────────────┼─────────────────┼──────────────┘
        │              │                 │
        ▼              ▼                 ▼
┌───────────────┐ ┌─────────────┐ ┌──────────────┐
│ Motor         │ │ ComfyUI     │ │ ComfyUI +    │
│ Determinístico│ │ (Modal)     │ │ Upload       │
│ (Pillow)      │ │ SDXL        │ │              │
└───────┬───────┘ └──────┬──────┘ └──────┬───────┘
        │                │               │
        │    ┌───────────┘               │
        │    │                           │
        ▼    ▼                           ▼
┌─────────────────┐            ┌─────────────────┐
│ Modal Endpoint  │            │ Supabase        │
│ (FastAPI)       │            │ Storage + DB    │
└────────┬────────┘            └────────┬────────┘
         │                              │
         ▼                              ▼
┌─────────────────┐            ┌─────────────────┐
│ Base64 Preview  │            │ material_assets │
│ (respuesta)     │            │ (registro)      │
└─────────────────┘            └─────────────────┘
```

---

## Archivos Creados/Modificados

| Archivo | Estado | Descripción |
|---|---|---|
| `modal_comfyui.py` | Modificado | Endpoint v3 con rutas ARASAAC |
| `pictogram_engine/pictogram_engine.py` | Modificado | Fix polygon scaling bug |
| `pictogram_engine/api_routes.py` | Creado | Rutas motor determinístico |
| `pictogram_engine/arasaac_routes.py` | **Nuevo** | Proxy ARASAAC (4 endpoints) |
| `pictogram_engine/library/pictograms.json` | Creado | 67 pictogramas locales |
| `services/PictogramService.ts` | Creado | Cliente motor determinístico |
| `services/ArasaacService.ts` | **Nuevo** | Cliente ARASAAC + cache |
| `services/ComfyUIService.ts` | Creado | Cliente ComfyUI |
| `services/MultimediaMaterialService.ts` | Modificado | CRUD materiales |
| `components/MultimediaCreator.tsx` | Modificado | UI con 3 motores |
| `COMFYUI_INTEGRATION_SUMMARY.md` | Modificado | Esta documentación |

---

## Validación Funcional

### Ejemplo 1: Motor Determinístico
```bash
# Generar pictograma local
curl -X POST "https://.../pictogram/generate?pictogram_id=casa&label=CASA"
# → status: completed, 512x512 PNG
```

### Ejemplo 2: ARASAAC Search
```bash
# Buscar pictogramas de "comer"
curl "https://.../arasaac/search?q=comer&lang=es&limit=3"
# → 3 resultados: comer (id:2349, 6456, 28641)
```

### Ejemplo 3: ARASAAC Image Download
```bash
# Descargar imagen de pictograma ARASAAC
curl "https://.../arasaac/image/2349?resolution=500"
# → base64 PNG 500x500
```

### Ejemplo 4: PECS Card
```bash
# Generar tarjeta PECS con 4 pictogramas
curl -X POST "https://.../pictogram/pecs?pictogram_ids=[\"perro\",\"gato\",\"pajaro\",\"pez\"]"
# → 600x600 PNG con grid 2x2
```

### Ejemplo 5: Secuencia
```bash
# Generar secuencia de lavarse las manos
curl -X POST "https://.../pictogram/sequence?pictogram_ids=[\"mano\",\"lavarse\",\"agua\",\"jabon\"]"
# → 1200x400 PNG con 4 pasos numerados
```

---

## Configuración

### `.env.local`
```
VITE_MODAL_ENDPOINT=https://matiasignacioperez--fonoaudio-comfyui-v3-entrypoint.modal.run
```

### Modal Deploy
```bash
$env:PYTHONIOENCODING='utf-8'; modal deploy modal_comfyui.py
```

### ARASAAC (sin configuración)
- API pública: `https://api.arasaac.org/v1`
- Sin autenticación requerida
- Sin rate limits documentados
- Licencia: CC BY-NC-SA (Gobierno de Aragón)

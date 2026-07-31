# Plan: Integración ComfyUI via Modal para Generación de Imágenes

## Arquitectura

```
FonoAudio App → Modal Endpoint → ComfyUI → Imagen generada
     ↓                              ↓
  REST API                    GPU (A10G o similar)
  (prompt + params)           (Stable Diffusion)
```

## Componentes a Crear

### 1. Modal App (`modal_comfyui.py`)
- Endpoint REST con FastAPI
- ComfyUI con Stable Diffusion XL
- Workflows predefinidos para materiales fonoaudiológicos
- Almacenamiento temporal de imágenes

### 2. Service en TypeScript (`services/ComfyUIService.ts`)
- Llamadas al endpoint Modal
- Gestión de colas de generación
- Descarga de imágenes generadas

### 3. Workflows Predefinidos
- **Pictogramas**: Imágenes simples para comunicación
- **Secuencias**: Pasos de actividades (lavar manos, etc.)
- **Materiales terapéuticos**: Láminas, fichas, juegos

## Endpoints Modal

```
POST /generate
{
  "workflow": "pictogram",
  "prompt": "child washing hands, simple style",
  "width": 512,
  "height": 512,
  "steps": 20
}

GET /status/{task_id}
GET /image/{image_id}
```

## Stack Técnico
- **Modal**: Serverless GPU (A10G ~$0.000575/min)
- **ComfyUI**: Workflow engine para Stable Diffusion
- **SDXL**: Modelo base para generación
- **FastAPI**: API REST en Modal

## Costos Estimados
- ~$0.01-0.03 por imagen generada
- ~$5-15/mes para uso moderado (10-20 imágenes/día)

## Pasos de Implementación

### Fase 1: Setup Modal + ComfyUI
1. Crear `modal_comfyui.py` con FastAPI
2. Configurar ComfyUI con SDXL
3. Deploy a Modal

### Fase 2: Service TypeScript
1. Crear `ComfyUIService.ts`
2. Integrar con `MultimediaCreator.tsx`
3. UI de progreso en tiempo real

### Fase 3: Workflows
1. Crear workflows JSON para cada tipo
2. Optimizar parámetros para fonoaudiología
3. Testing de calidad

## Preguntas para el Usuario

1. ¿Tenés cuenta en Modal.com configurada?
2. ¿Qué modelo SD preferís: SDXL, SD 1.5, o SD 3?
3. ¿Necesitás que las imágenes sean específicamente para niños (estilo cartoon)?

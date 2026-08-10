"""
FonoAudio-Pro AI - ComfyUI Modal Endpoint v4
Motor Determinístico (Pictogramas) + Generativo (SDXL Turbo + FLUX.1-schnell)
"""

import modal
import uuid
import os

app = modal.App("fonoaudio-comfyui-v4")

# Directorio del motor determinístico
local_dir = os.path.dirname(os.path.abspath(__file__))

image = modal.Image.debian_slim(python_version="3.11").pip_install(
    "fastapi",
    "torch==2.2.0",
    "diffusers==0.30.0",
    "transformers==4.44.0",
    "accelerate==0.33.0",
    "safetensors==0.4.3",
    "huggingface_hub==0.25.0",
    "numpy<2",
    "pillow==10.4.0",
).add_local_dir(
    os.path.join(local_dir, "pictogram_engine"),
    remote_path="/root/pictogram_engine",
)

vol = modal.Volume.from_name("comfyui-outputs", create_if_missing=True)
OUTPUT_DIR = "/outputs"

# Modelos disponibles para generación de imágenes
MODELS = {
    "sdxl_turbo": {
        "id": "stabilityai/sdxl-turbo",
        "name": "SDXL Turbo (Rápido)",
        "description": "Generación ultra rápida (1-4 steps), buena calidad",
        "default_steps": 4,
        "default_cfg": 0.0,
        "min_steps": 1,
        "max_steps": 8,
    },
    "dreamshaper_xl": {
        "id": "Lykon/dreamshaper-xl-v2-turbo",
        "name": "DreamShaper XL (Equilibrado)",
        "description": "Balance entre calidad y velocidad",
        "default_steps": 6,
        "default_cfg": 2.0,
        "min_steps": 4,
        "max_steps": 12,
    },
    "flux_schnell": {
        "id": "black-forest-labs/FLUX.1-schnell",
        "name": "FLUX.1-schnell (Alta Calidad)",
        "description": "Máxima calidad, más lento",
        "default_steps": 4,
        "default_cfg": 0.0,
        "min_steps": 1,
        "max_steps": 8,
    },
}

# Workflows expandidos para fonoaudiologia
WORKFLOWS = {
    "pictogram": {
        "name": "Pictograma Simple",
        "prefix": "simple flat pictogram, solid bright colors, thick black outlines, minimal details, white background, child-friendly, ",
        "suffix": ", no text, no words, no letters, clean design",
        "negative": "realistic, photographic, complex, dark, blurry, text, words, letters, watermark, signature",
        "steps": 4, "cfg": 0.0, "size": 512, "model": "sdxl_turbo",
    },
    "cartoon": {
        "name": "Cartoon Infantil",
        "prefix": "cute colorful cartoon illustration for children, friendly characters, happy style, clean lines, ",
        "suffix": ", educational, bright colors, fun",
        "negative": "scary, dark, realistic, photographic, complex, text, words",
        "steps": 4, "cfg": 0.0, "size": 512, "model": "sdxl_turbo",
    },
    "realistic": {
        "name": "Realista",
        "prefix": "professional high quality photograph, realistic, detailed, ",
        "suffix": ", studio lighting, sharp focus",
        "negative": "cartoon, drawing, painting, blurry, low quality, deformed",
        "steps": 6, "cfg": 2.0, "size": 512, "model": "dreamshaper_xl",
    },
    "therapy_scene": {
        "name": "Escena Terapeutica",
        "prefix": "child-friendly illustration of a therapy session, warm colors, professional, welcoming environment, ",
        "suffix": ", educational setting, clean modern style",
        "negative": "scary, dark, realistic photo, complex, text",
        "steps": 4, "cfg": 0.0, "size": 512, "model": "sdxl_turbo",
    },
    "emotion": {
        "name": "Emociones",
        "prefix": "expressive cartoon face showing strong emotion, simple design, bright colors, thick outlines, ",
        "suffix": ", child-friendly, educational, clear expression",
        "negative": "realistic, photographic, complex, dark, scary, text",
        "steps": 4, "cfg": 0.0, "size": 512, "model": "sdxl_turbo",
    },
    "social_media": {
        "name": "Redes Sociales",
        "prefix": "modern professional social media post design, clean layout, vibrant colors, ",
        "suffix": ", instagram style, engaging, eye-catching",
        "negative": "ugly, blurry, low quality, text heavy, complex",
        "steps": 4, "cfg": 0.0, "size": 512, "model": "sdxl_turbo",
    },
    "flashcard": {
        "name": "Flashcard",
        "prefix": "educational flashcard design, clean white background, simple illustration, ",
        "suffix": ", organized layout, minimal, professional",
        "negative": "complex, cluttered, dark, text heavy",
        "steps": 4, "cfg": 0.0, "size": 512, "model": "sdxl_turbo",
    },
    "sequence_step": {
        "name": "Paso de Secuencia",
        "prefix": "step-by-step illustration, numbered step, simple clear design, child-friendly, ",
        "suffix": ", educational instruction, clean background",
        "negative": "complex, realistic, dark, text, words",
        "steps": 4, "cfg": 0.0, "size": 512, "model": "sdxl_turbo",
    },
    "family_guide": {
        "name": "Guia para Familia",
        "prefix": "warm family-friendly illustration, parent and child, caring atmosphere, ",
        "suffix": ", educational guide style, soft colors, welcoming",
        "negative": "scary, dark, realistic photo, complex, clinical",
        "steps": 4, "cfg": 0.0, "size": 512, "model": "sdxl_turbo",
    },
    "high_quality": {
        "name": "Alta Calidad (FLUX)",
        "prefix": "ultra high quality illustration, professional clinical visual support, ",
        "suffix": ", clean design, educational, sharp details",
        "negative": "blurry, low quality, deformed, text",
        "steps": 4, "cfg": 0.0, "size": 768, "model": "flux_schnell",
    },
}


def create_app():
    from fastapi import FastAPI, HTTPException
    from fastapi.responses import FileResponse
    from fastapi.middleware.cors import CORSMiddleware
    import os

    web_app = FastAPI(title="FonoAudio ComfyUI v4", redirect_slashes=False)

    web_app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Integrar motor determinístico de pictogramas
    import sys
    sys.path.insert(0, "/root")
    from pictogram_engine.api_routes import create_pictogram_routes
    from pictogram_engine.arasaac_routes import create_arasaac_routes
    create_pictogram_routes(web_app)
    create_arasaac_routes(web_app)

    @web_app.get("/health")
    def health():
        return {
            "status": "ok",
            "gpu": "T4",
            "version": "4.0",
            "models": {k: v["name"] for k, v in MODELS.items()},
            "workflows": list(WORKFLOWS.keys()),
            "engines": ["deterministic_pictogram", "sdxl_turbo", "dreamshaper_xl", "flux_schnell"],
        }

    @web_app.get("/workflows")
    def list_workflows():
        return {
            "workflows": [
                {
                    "id": k,
                    "name": v["name"],
                    "model": v.get("model", "sdxl_turbo"),
                    "model_name": MODELS.get(v.get("model", "sdxl_turbo"), {}).get("name", "Unknown"),
                }
                for k, v in WORKFLOWS.items()
            ]
        }

    @web_app.get("/models")
    def list_models():
        return {"models": MODELS}

    # Cache de pipelines por modelo (evita recargar en cada request)
    _pipe_cache = {}

    def get_pipeline(model_key: str):
        import torch
        from diffusers import AutoPipelineForText2Image, DPMSolverMultistepScheduler

        model_info = MODELS.get(model_key)
        if not model_info:
            model_info = MODELS["sdxl_turbo"]
            model_key = "sdxl_turbo"

        model_id = model_info["id"]

        if model_key in _pipe_cache:
            return _pipe_cache[model_key], model_info

        print(f"Cargando modelo: {model_id} ({model_info['name']})")

        try:
            if "flux" in model_key.lower():
                # FLUX usa una API diferente
                pipe = AutoPipelineForText2Image.from_pretrained(
                    model_id,
                    torch_dtype=torch.float16,
                    use_safetensors=True,
                )
            elif "sdxl" in model_key.lower():
                # SDXL Turbo - optimizado para velocidad
                pipe = AutoPipelineForText2Image.from_pretrained(
                    model_id,
                    torch_dtype=torch.float16,
                    use_safetensors=True,
                    variant="fp16",
                )
            else:
                # DreamShaper y otros
                pipe = AutoPipelineForText2Image.from_pretrained(
                    model_id,
                    torch_dtype=torch.float16,
                    use_safetensors=True,
                    variant="fp16",
                )
                pipe.scheduler = DPMSolverMultistepScheduler.from_config(
                    pipe.scheduler.config,
                    algorithm_type="dpmsolver++",
                    use_karras_sigmas=True,
                    timestep_spacing="trailing",
                )

            pipe = pipe.to("cuda")
            _pipe_cache[model_key] = pipe
            print(f"Modelo {model_id} cargado exitosamente")
            return pipe, model_info

        except Exception as e:
            print(f"Error cargando modelo {model_id}: {e}")
            # Fallback a SDXL Turbo si falla
            if model_key != "sdxl_turbo":
                return get_pipeline("sdxl_turbo")
            raise

    @web_app.post("/generate")
    @web_app.post("/generate/")
    def generate_image(
        workflow: str = "pictogram",
        prompt: str = "",
        width: int = 512,
        height: int = 512,
        steps: int = 0,
        seed: int = -1,
        num_images: int = 1,
        guidance_scale: float = -1,
        overlay_text: str = "",
        text_position: str = "bottom",
        text_color: str = "white",
        text_size: int = 48,
        model: str = "",
    ):
        import torch

        task_id = str(uuid.uuid4())[:8]
        wf = WORKFLOWS.get(workflow, WORKFLOWS["pictogram"])

        # Usar modelo especificado o el del workflow
        model_key = model if model and model in MODELS else wf.get("model", "sdxl_turbo")
        full_prompt = f"{wf['prefix']}{prompt}{wf['suffix']}"
        negative = wf["negative"]
        size = width if width > 0 else wf["size"]
        steps_val = steps if steps > 0 else wf["steps"]
        cfg_val = guidance_scale if guidance_scale >= 0 else wf["cfg"]
        seed_val = seed if seed >= 0 else torch.randint(0, 2**32, (1,)).item()

        try:
            pipe, model_info = get_pipeline(model_key)

            image_ids = []
            for i in range(num_images):
                generator = torch.Generator(device="cuda").manual_seed(seed_val + i)

                # FLUX no usa negative prompts
                if "flux" in model_key:
                    result = pipe(
                        prompt=full_prompt,
                        width=size,
                        height=size,
                        num_inference_steps=steps_val,
                        generator=generator,
                    )
                else:
                    result = pipe(
                        prompt=full_prompt,
                        negative_prompt=negative,
                        width=size,
                        height=size,
                        num_inference_steps=steps_val,
                        guidance_scale=cfg_val,
                        generator=generator,
                    )

                img = result.images[0]
                fname = f"{task_id}_{i}.png"

                # Agregar overlay de texto si se solicita
                if overlay_text.strip():
                    img = add_text_overlay(img, overlay_text, text_position, text_color, text_size)

                img.save(f"{OUTPUT_DIR}/{fname}")
                image_ids.append(fname)

            vol.commit()
            return {
                "task_id": task_id,
                "status": "completed",
                "image_ids": image_ids,
                "model_used": model_info["name"],
            }
        except Exception as e:
            import traceback
            return {
                "task_id": task_id,
                "status": "failed",
                "error": str(e),
                "trace": traceback.format_exc(),
            }

    @web_app.get("/image/{image_id}")
    def get_image_by_path(image_id: str):
        path = f"{OUTPUT_DIR}/{image_id}"
        if not os.path.exists(path):
            raise HTTPException(404, "Not found")
        return FileResponse(path, media_type="image/png")

    @web_app.get("/get_image")
    def get_image_by_query(image_id: str):
        path = f"{OUTPUT_DIR}/{image_id}"
        if not os.path.exists(path):
            raise HTTPException(404, "Not found")
        return FileResponse(path, media_type="image/png")

    return web_app


def add_text_overlay(img, text, position="bottom", color="white", size=48):
    """Agrega texto superpuesto a la imagen"""
    from PIL import Image, ImageDraw, ImageFont

    # Crear copia
    img_with_text = img.copy()
    draw = ImageDraw.Draw(img_with_text)

    # Fuente por defecto (grande para legibilidad)
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", size)
    except:
        try:
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", size)
        except:
            font = ImageFont.load_default()

    # Calcular posicion
    w, h = img_with_text.size
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]

    if position == "top":
        x = (w - tw) // 2
        y = 20
    elif position == "center":
        x = (w - tw) // 2
        y = (h - th) // 2
    else:  # bottom
        x = (w - tw) // 2
        y = h - th - 30

    # Sombra para legibilidad
    shadow_offset = 2
    draw.text((x + shadow_offset, y + shadow_offset), text, fill="black", font=font)
    draw.text((x, y), text, fill=color, font=font)

    return img_with_text


@app.function(
    image=image,
    volumes={OUTPUT_DIR: vol},
    gpu="T4",
    timeout=300,
    memory=8192,
)
@modal.asgi_app()
def entrypoint():
    return create_app()

"""
FonoAudio-Pro AI - ComfyUI Modal Endpoint v3
Motor Determinístico (Pictogramas) + Generativo (DreamShaper XL)
"""

import modal
import uuid
import os

app = modal.App("fonoaudio-comfyui-v3")

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

# Workflows expandidos para fonoaudiologia
WORKFLOWS = {
    "pictogram": {
        "name": "Pictograma Simple",
        "prefix": "simple flat pictogram, solid bright colors, thick black outlines, minimal details, white background, child-friendly, ",
        "suffix": ", no text, no words, no letters, clean design",
        "negative": "realistic, photographic, complex, dark, blurry, text, words, letters, watermark, signature",
        "steps": 6, "cfg": 2.0, "size": 512,
    },
    "cartoon": {
        "name": "Cartoon Infantil",
        "prefix": "cute colorful cartoon illustration for children, friendly characters, happy style, clean lines, ",
        "suffix": ", educational, bright colors, fun",
        "negative": "scary, dark, realistic, photographic, complex, text, words",
        "steps": 8, "cfg": 2.0, "size": 512,
    },
    "realistic": {
        "name": "Realista",
        "prefix": "professional high quality photograph, realistic, detailed, ",
        "suffix": ", studio lighting, sharp focus",
        "negative": "cartoon, drawing, painting, blurry, low quality, deformed",
        "steps": 8, "cfg": 2.0, "size": 512,
    },
    "therapy_scene": {
        "name": "Escena Terapeutica",
        "prefix": "child-friendly illustration of a therapy session, warm colors, professional, welcoming environment, ",
        "suffix": ", educational setting, clean modern style",
        "negative": "scary, dark, realistic photo, complex, text",
        "steps": 8, "cfg": 2.0, "size": 512,
    },
    "emotion": {
        "name": "Emociones",
        "prefix": "expressive cartoon face showing strong emotion, simple design, bright colors, thick outlines, ",
        "suffix": ", child-friendly, educational, clear expression",
        "negative": "realistic, photographic, complex, dark, scary, text",
        "steps": 6, "cfg": 2.0, "size": 512,
    },
    "social_media": {
        "name": "Redes Sociales",
        "prefix": "modern professional social media post design, clean layout, vibrant colors, ",
        "suffix": ", instagram style, engaging, eye-catching",
        "negative": "ugly, blurry, low quality, text heavy, complex",
        "steps": 8, "cfg": 2.0, "size": 512,
    },
    "flashcard": {
        "name": "Flashcard",
        "prefix": "educational flashcard design, clean white background, simple illustration, ",
        "suffix": ", organized layout, minimal, professional",
        "negative": "complex, cluttered, dark, text heavy",
        "steps": 6, "cfg": 2.0, "size": 512,
    },
    "sequence_step": {
        "name": "Paso de Secuencia",
        "prefix": "step-by-step illustration, numbered step, simple clear design, child-friendly, ",
        "suffix": ", educational instruction, clean background",
        "negative": "complex, realistic, dark, text, words",
        "steps": 6, "cfg": 2.0, "size": 512,
    },
    "family_guide": {
        "name": "Guia para Familia",
        "prefix": "warm family-friendly illustration, parent and child, caring atmosphere, ",
        "suffix": ", educational guide style, soft colors, welcoming",
        "negative": "scary, dark, realistic photo, complex, clinical",
        "steps": 8, "cfg": 2.0, "size": 512,
    },
}


def create_app():
    from fastapi import FastAPI, HTTPException
    from fastapi.responses import FileResponse
    from fastapi.middleware.cors import CORSMiddleware
    import os

    web_app = FastAPI(title="FonoAudio ComfyUI v3", redirect_slashes=False)

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
            "model": "DreamShaper XL Turbo",
            "version": "3.1",
            "engines": ["deterministic_pictogram", "dreamshaper_generative"],
        }

    @web_app.get("/workflows")
    def list_workflows():
        return {"workflows": [{"id": k, "name": v["name"]} for k, v in WORKFLOWS.items()]}

    # Cache del pipeline DreamShaper XL (evita recargar modelo en cada request)
    _pipe_cache = {"pipe": None, "model_id": None}

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
    ):
        import torch
        from diffusers import AutoPipelineForText2Image, DPMSolverMultistepScheduler
        from PIL import Image, ImageDraw, ImageFont

        task_id = str(uuid.uuid4())[:8]
        wf = WORKFLOWS.get(workflow, WORKFLOWS["pictogram"])
        full_prompt = f"{wf['prefix']}{prompt}{wf['suffix']}"
        negative = wf["negative"]
        size = width if width > 0 else wf["size"]
        steps_val = steps if steps > 0 else wf["steps"]
        cfg_val = guidance_scale if guidance_scale >= 0 else wf["cfg"]
        seed_val = seed if seed >= 0 else torch.randint(0, 2**32, (1,)).item()

        model_id = "Lykon/dreamshaper-xl-v2-turbo"

        try:
            if _pipe_cache["pipe"] is None or _pipe_cache["model_id"] != model_id:
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
                _pipe_cache["pipe"] = pipe
                _pipe_cache["model_id"] = model_id
            else:
                pipe = _pipe_cache["pipe"]

            image_ids = []
            for i in range(num_images):
                generator = torch.Generator(device="cuda").manual_seed(seed_val + i)
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
            return {"task_id": task_id, "status": "completed", "image_ids": image_ids}
        except Exception as e:
            import traceback
            return {"task_id": task_id, "status": "failed", "error": str(e), "trace": traceback.format_exc()}

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

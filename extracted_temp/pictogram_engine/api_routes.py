"""
Pictogram API - Endpoints para el motor determinístico
Se integra con el endpoint FastAPI existente en Modal
"""

import uuid
import json
import io
import base64
import tempfile
import os
from pathlib import Path


def create_pictogram_routes(web_app):
    """Agrega rutas del motor determinístico al FastAPI app."""

    @web_app.get("/pictogram/categories")
    def get_categories():
        from pictogram_engine.pictogram_engine import list_categories
        return {"categories": list_categories()}

    @web_app.get("/pictogram/list")
    def list_pictograms(category: str = None):
        from pictogram_engine.pictogram_engine import list_pictograms
        return {"pictograms": list_pictograms(category)}

    @web_app.post("/pictogram/generate")
    def generate_pictogram(
        pictogram_id: str,
        label: str = "",
        size: int = 512,
        bg_color: str = "#FFFFFF",
        label_position: str = "bottom",
    ):
        from pictogram_engine.pictogram_engine import render_pictogram_with_label

        task_id = str(uuid.uuid4())[:8]
        try:
            img = render_pictogram_with_label(
                pictogram_id=pictogram_id,
                label=label or None,
                size=size,
                bg_color=bg_color,
                label_position=label_position,
            )
            buf = io.BytesIO()
            img.save(buf, format="PNG")
            b64 = base64.b64encode(buf.getvalue()).decode()

            return {
                "task_id": task_id,
                "status": "completed",
                "image_ids": [f"picto_{task_id}.png"],
                "preview_b64": b64,
                "width": img.size[0],
                "height": img.size[1],
            }
        except Exception as e:
            import traceback
            return {"task_id": task_id, "status": "failed", "error": str(e), "trace": traceback.format_exc()}

    @web_app.post("/pictogram/pecs")
    def generate_pecs(
        pictogram_ids: str,
        border_color: str = "#2196F3",
        card_width: int = 600,
        card_height: int = 600,
    ):
        from pictogram_engine.pictogram_engine import render_pecs_card

        task_id = str(uuid.uuid4())[:8]
        try:
            ids = json.loads(pictogram_ids) if isinstance(pictogram_ids, str) else pictogram_ids
            img = render_pecs_card(
                pictogram_ids=ids,
                card_size=(card_width, card_height),
                border_color=border_color,
            )
            buf = io.BytesIO()
            img.save(buf, format="PNG")
            b64 = base64.b64encode(buf.getvalue()).decode()

            return {
                "task_id": task_id,
                "status": "completed",
                "image_ids": [f"pecs_{task_id}.png"],
                "preview_b64": b64,
                "width": img.size[0],
                "height": img.size[1],
            }
        except Exception as e:
            import traceback
            return {"task_id": task_id, "status": "failed", "error": str(e), "trace": traceback.format_exc()}

    @web_app.post("/pictogram/sequence")
    def generate_sequence(
        pictogram_ids: str,
        labels: str = "[]",
        canvas_width: int = 1200,
        canvas_height: int = 400,
        number_color: str = "#2196F3",
        text_color: str = "#1A1A1A",
    ):
        from pictogram_engine.pictogram_engine import render_sequence

        task_id = str(uuid.uuid4())[:8]
        try:
            ids = json.loads(pictogram_ids) if isinstance(pictogram_ids, str) else pictogram_ids
            lbls = json.loads(labels) if isinstance(labels, str) else labels

            img = render_sequence(
                pictogram_ids=ids,
                labels=lbls if lbls else None,
                canvas_width=canvas_width,
                canvas_height=canvas_height,
                number_color=number_color,
                text_color=text_color,
            )
            buf = io.BytesIO()
            img.save(buf, format="PNG")
            b64 = base64.b64encode(buf.getvalue()).decode()

            return {
                "task_id": task_id,
                "status": "completed",
                "image_ids": [f"seq_{task_id}.png"],
                "preview_b64": b64,
                "width": img.size[0],
                "height": img.size[1],
            }
        except Exception as e:
            import traceback
            return {"task_id": task_id, "status": "failed", "error": str(e), "trace": traceback.format_exc()}

    @web_app.post("/pictogram/card")
    def generate_card(
        pictogram_id: str,
        title: str,
        subtitle: str = "",
        card_width: int = 600,
        card_height: int = 400,
        accent_color: str = "#2196F3",
    ):
        from pictogram_engine.pictogram_engine import render_card

        task_id = str(uuid.uuid4())[:8]
        try:
            img = render_card(
                pictogram_id=pictogram_id,
                title=title,
                subtitle=subtitle,
                card_width=card_width,
                card_height=card_height,
                accent_color=accent_color,
            )
            buf = io.BytesIO()
            img.save(buf, format="PNG")
            b64 = base64.b64encode(buf.getvalue()).decode()

            return {
                "task_id": task_id,
                "status": "completed",
                "image_ids": [f"card_{task_id}.png"],
                "preview_b64": b64,
                "width": img.size[0],
                "height": img.size[1],
            }
        except Exception as e:
            import traceback
            return {"task_id": task_id, "status": "failed", "error": str(e), "trace": traceback.format_exc()}

    return web_app

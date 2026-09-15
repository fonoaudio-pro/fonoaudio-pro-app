"""
ARASAAC Proxy - Endpoints para buscar y obtener pictogramas de ARASAAC
Se integra con el endpoint FastAPI existente en Modal
Evita problemas de CORS y permite cache local
"""

import uuid
import json
import io
import base64
import urllib.request
import urllib.parse
import urllib.error
import time
from pathlib import Path

ARASAAC_BASE = "https://api.arasaac.org/v1"
ARASAAC_STATIC = "https://static.arasaac.org/pictograms"

# Cache simple en memoria (evita llamadas repetidas al mismo pictograma)
_cache = {}
CACHE_TTL = 3600  # 1 hora


def _fetch_json(url: str, timeout: int = 10):
    """Fetch JSON desde URL externa."""
    req = urllib.request.Request(url, headers={"User-Agent": "FonoAudioPro/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _fetch_bytes(url: str, timeout: int = 15):
    """Fetch bytes (imagen) desde URL externa."""
    req = urllib.request.Request(url, headers={"User-Agent": "FonoAudioPro/1.0"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read()


def _cache_key(prefix: str, *args):
    return f"{prefix}:" + ":".join(str(a) for a in args)


def create_arasaac_routes(web_app):
    """Agrega rutas del proxy ARASAAC al FastAPI app."""

    @web_app.get("/arasaac/search")
    def arasaac_search(q: str, lang: str = "es", limit: int = 20):
        """
        Busca pictogramas en ARASAAC por texto.
        Retorna lista simplificada con id, label, keywords, imagen URL.
        """
        task_id = str(uuid.uuid4())[:8]
        try:
            ck = _cache_key("search", q, lang, limit)
            if ck in _cache and time.time() - _cache[ck]["ts"] < CACHE_TTL:
                return _cache[ck]["data"]

            # Usar bestsearch para mejores resultados
            encoded = urllib.parse.quote(q)
            url = f"{ARASAAC_BASE}/pictograms/{lang}/bestsearch/{encoded}"
            results = _fetch_json(url, timeout=10)

            # Normalizar resultados
            pictograms = []
            for item in (results if isinstance(results, list) else []):
                pid = item.get("_id")
                if not pid:
                    continue

                # Obtener la keyword principal
                keywords = item.get("keywords", [])
                main_keyword = ""
                for kw in keywords:
                    if kw.get("type") == 1:  # type 1 = keyword principal
                        main_keyword = kw.get("keyword", "")
                        break
                if not main_keyword and keywords:
                    main_keyword = keywords[0].get("keyword", "")

                # URL de imagen (500px por defecto)
                img_url = f"{ARASAAC_STATIC}/{pid}/{pid}_500.png"

                pictograms.append({
                    "id": pid,
                    "label": main_keyword or str(pid),
                    "keywords": [kw.get("keyword", "") for kw in keywords[:5]],
                    "categories": item.get("categories", []),
                    "image_url": img_url,
                    "source": "arasaac",
                })

            response = {
                "task_id": task_id,
                "status": "completed",
                "query": q,
                "language": lang,
                "count": len(pictograms),
                "pictograms": pictograms[:limit],
            }

            _cache[ck] = {"data": response, "ts": time.time()}
            return response

        except urllib.error.HTTPError as e:
            return {
                "task_id": task_id,
                "status": "failed",
                "error": f"ARASAAC HTTP error: {e.code}",
                "query": q,
                "pictograms": [],
            }
        except Exception as e:
            import traceback
            return {
                "task_id": task_id,
                "status": "failed",
                "error": str(e),
                "trace": traceback.format_exc(),
                "query": q,
                "pictograms": [],
            }

    @web_app.get("/arasaac/pictogram/{pictogram_id}")
    def arasaac_pictogram_data(pictogram_id: int, lang: str = "es"):
        """
        Obtiene datos completos de un pictograma ARASAAC (metadata + keywords).
        """
        task_id = str(uuid.uuid4())[:8]
        try:
            ck = _cache_key("picto_data", pictogram_id, lang)
            if ck in _cache and time.time() - _cache[ck]["ts"] < CACHE_TTL:
                return _cache[ck]["data"]

            url = f"{ARASAAC_BASE}/pictograms/{lang}/{pictogram_id}"
            item = _fetch_json(url, timeout=10)

            keywords = item.get("keywords", [])
            main_keyword = ""
            for kw in keywords:
                if kw.get("type") == 1:
                    main_keyword = kw.get("keyword", "")
                    break
            if not main_keyword and keywords:
                main_keyword = keywords[0].get("keyword", "")

            response = {
                "task_id": task_id,
                "status": "completed",
                "id": pictogram_id,
                "label": main_keyword or str(pictogram_id),
                "keywords": [kw.get("keyword", "") for kw in keywords],
                "categories": item.get("categories", []),
                "image_url": f"{ARASAAC_STATIC}/{pictogram_id}/{pictogram_id}_500.png",
                "image_url_hq": f"{ARASAAC_STATIC}/{pictogram_id}/{pictogram_id}_2500.png",
                "source": "arasaac",
            }

            _cache[ck] = {"data": response, "ts": time.time()}
            return response

        except Exception as e:
            import traceback
            return {
                "task_id": task_id,
                "status": "failed",
                "error": str(e),
                "trace": traceback.format_exc(),
            }

    @web_app.get("/arasaac/image/{pictogram_id}")
    def arasaac_image(
        pictogram_id: int,
        resolution: int = 500,
        color: bool = True,
        background: str = "none",
    ):
        """
        Descarga imagen de ARASAAC y retorna como base64.
        Permite evitar CORS y cachear localmente.
        """
        task_id = str(uuid.uuid4())[:8]
        try:
            ck = _cache_key("img", pictogram_id, resolution, color, background)
            if ck in _cache and time.time() - _cache[ck]["ts"] < CACHE_TTL:
                return _cache[ck]["data"]

            # Construir URL estática directa (más rápido que la API)
            suffix = f"_{resolution}.png"
            if not color:
                suffix = f"_nocolor_{resolution}.png"
            if background and background != "none":
                suffix = f"_background-{background.lstrip('#')}_{resolution}.png"

            img_url = f"{ARASAAC_STATIC}/{pictogram_id}/{pictogram_id}{suffix}"
            img_bytes = _fetch_bytes(img_url, timeout=15)
            b64 = base64.b64encode(img_bytes).decode()

            response = {
                "task_id": task_id,
                "status": "completed",
                "id": pictogram_id,
                "preview_b64": b64,
                "width": resolution,
                "height": resolution,
                "source": "arasaac",
                "image_url": img_url,
            }

            _cache[ck] = {"data": response, "ts": time.time()}
            return response

        except urllib.error.HTTPError as e:
            return {
                "task_id": task_id,
                "status": "failed",
                "error": f"ARASAAC image not found: {e.code}",
            }
        except Exception as e:
            import traceback
            return {
                "task_id": task_id,
                "status": "failed",
                "error": str(e),
                "trace": traceback.format_exc(),
            }

    @web_app.get("/arasaac/keywords")
    def arasaac_keywords(lang: str = "es"):
        """
        Lista de palabras clave disponibles en ARASAAC para autocompletado.
        """
        try:
            ck = _cache_key("keywords", lang)
            if ck in _cache and time.time() - _cache[ck]["ts"] < CACHE_TTL:
                return _cache[ck]["data"]

            url = f"{ARASAAC_BASE}/keywords/{lang}"
            data = _fetch_json(url, timeout=10)

            response = {
                "status": "completed",
                "language": lang,
                "words": data.get("words", []),
            }

            _cache[ck] = {"data": response, "ts": time.time()}
            return response

        except Exception as e:
            return {"status": "failed", "error": str(e), "words": []}

    return web_app

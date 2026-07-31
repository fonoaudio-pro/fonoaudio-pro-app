"""
Pictogram Engine v1 - Motor Determinístico para Fonoaudiología
Renderiza pictogramas desde definiciones JSON usando Pillow
Sin dependencia de modelos generativos - costo cero
"""

import json
import math
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

LIBRARY_PATH = Path(__file__).parent / "library" / "pictograms.json"

# Fuentes del sistema (Linux/Modal)
FONT_PATHS = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
]

FONT_PATHS_REGULAR = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
]


def _load_library():
    with open(LIBRARY_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def _get_font(size: int, bold: bool = True) -> ImageFont.FreeTypeFont:
    paths = FONT_PATHS if bold else FONT_PATHS_REGULAR
    for p in paths:
        try:
            return ImageFont.truetype(p, size)
        except (OSError, IOError):
            continue
    return ImageFont.load_default()


def _hex_to_rgb(hex_color: str) -> tuple:
    h = hex_color.lstrip("#")
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))


def _draw_shape(draw: ImageDraw.ImageDraw, shape: dict, scale: float = 1.0):
    """Renderiza una forma individual sobre el canvas."""
    t = shape.get("type", "")
    fill = _hex_to_rgb(shape["fill"]) if "fill" in shape else None
    outline = _hex_to_rgb(shape["outline"]) if "outline" in shape else None
    w = int(shape.get("width", 0) * scale)

    if t == "circle":
        cx, cy, r = shape["cx"] * scale, shape["cy"] * scale, shape["r"] * scale
        bbox = [cx - r, cy - r, cx + r, cy + r]
        draw.ellipse(bbox, fill=fill, outline=outline, width=w)

    elif t == "ellipse":
        cx, cy = shape["cx"] * scale, shape["cy"] * scale
        rx, ry = shape["rx"] * scale, shape["ry"] * scale
        bbox = [cx - rx, cy - ry, cx + rx, cy + ry]
        draw.ellipse(bbox, fill=fill, outline=outline, width=w)

    elif t == "rect":
        x, y = shape["x"] * scale, shape["y"] * scale
        hw, hh = shape["w"] * scale, shape["h"] * scale
        rx = int(shape.get("rx", 0) * scale)
        bbox = [x, y, x + hw, y + hh]
        if rx > 0:
            draw.rounded_rectangle(bbox, radius=rx, fill=fill, outline=outline, width=w)
        else:
            draw.rectangle(bbox, fill=fill, outline=outline, width=w)

    elif t == "polygon":
        raw_points = shape["points"]
        if isinstance(raw_points, str):
            # Parse string format: "x1,y1 x2,y2 x3,y3"
            points = []
            for pair in raw_points.split():
                x, y = pair.split(",")
                points.append((float(x) * scale, float(y) * scale))
        elif isinstance(raw_points, list) and len(raw_points) > 0:
            if isinstance(raw_points[0], (list, tuple)):
                # Nested list format: [[x1,y1], [x2,y2], ...]
                points = [(p[0] * scale, p[1] * scale) for p in raw_points]
            else:
                # Flat list format: [x1, y1, x2, y2, ...]
                points = []
                for i in range(0, len(raw_points) - 1, 2):
                    points.append((raw_points[i] * scale, raw_points[i+1] * scale))
        else:
            points = []
        draw.polygon(points, fill=fill, outline=outline, width=w if outline else 0)

    elif t == "line":
        coords = [shape["x1"] * scale, shape["y1"] * scale,
                  shape["x2"] * scale, shape["y2"] * scale]
        draw.line(coords, fill=outline or fill, width=max(w, 2))

    elif t == "path":
        # Path simplificado: solo curvas Q (quadratic bezier)
        d = shape.get("d", "")
        stroke = outline or fill
        sw = max(w, 2)
        _draw_simple_path(draw, d, scale, stroke, sw)

    elif t == "text":
        text = shape.get("text", "")
        x, y = shape["x"] * scale, shape["y"] * scale
        size = int(shape.get("size", 24) * scale)
        bold = shape.get("bold", False)
        font = _get_font(size, bold)
        color = fill or (0, 0, 0)
        anchor = shape.get("anchor", "lt")
        draw.text((x, y), text, fill=color, font=font, anchor=anchor)

    elif t == "arc":
        cx, cy = shape["cx"] * scale, shape["cy"] * scale
        r = shape["r"] * scale
        bbox = [cx - r, cy - r, cx + r, cy + r]
        draw.arc(bbox, start=shape["start"], end=shape["end"],
                 fill=outline or fill, width=max(w, 2))


def _draw_simple_path(draw, d: str, scale, color, width):
    """Parser simplificado de paths SVG para formas comunes."""
    import re
    tokens = re.findall(r'[MQLZ]|[\d.]+', d)
    points = []
    i = 0
    cmd = None
    while i < len(tokens):
        tok = tokens[i]
        if tok.isalpha():
            cmd = tok
            i += 1
            continue
        if cmd in ('M', 'L'):
            x = float(tokens[i]) * scale
            y = float(tokens[i+1]) * scale
            points.append((x, y))
            i += 2
        elif cmd == 'Q':
            # Quadratic bezier: approximation with line segments
            if len(points) >= 1:
                cx = float(tokens[i]) * scale
                cy = float(tokens[i+1]) * scale
                ex = float(tokens[i+2]) * scale
                ey = float(tokens[i+3]) * scale
                sx, sy = points[-1]
                for t in range(1, 11):
                    t2 = t / 10.0
                    px = (1-t2)**2*sx + 2*(1-t2)*t2*cx + t2**2*ex
                    py = (1-t2)**2*sy + 2*(1-t2)*t2*cy + t2**2*ey
                    points.append((px, py))
                i += 4
            else:
                i += 4
        elif cmd == 'Z':
            i += 1
        else:
            i += 1

    if len(points) >= 2:
        draw.line(points, fill=color, width=width, joint="curve")


def render_pictogram(pictogram_id: str, size: int = 512, bg_color: str = "#FFFFFF") -> Image.Image:
    """Renderiza un pictograma individual sobre fondo blanco/coloreado."""
    lib = _load_library()

    # Buscar pictograma en todas las categorías
    pict_data = None
    for cat_data in lib["categories"].values():
        if pictogram_id in cat_data.get("pictograms", {}):
            pict_data = cat_data["pictograms"][pictogram_id]
            break

    if not pict_data:
        raise ValueError(f"Pictogram '{pictogram_id}' not found in library")

    img = Image.new("RGB", (size, size), _hex_to_rgb(bg_color))
    draw = ImageDraw.Draw(img)

    scale = size / lib.get("canvas_size", 512)

    for shape in pict_data.get("shapes", []):
        _draw_shape(draw, shape, scale)

    return img


def render_pictogram_with_label(
    pictogram_id: str,
    label: str = None,
    size: int = 512,
    bg_color: str = "#FFFFFF",
    label_position: str = "bottom",
    label_color: str = "#1A1A1A",
    font_size_ratio: float = 0.12,
) -> Image.Image:
    """Renderiza pictograma + etiqueta de texto legible."""
    lib = _load_library()

    pict_data = None
    for cat_data in lib["categories"].values():
        if pictogram_id in cat_data.get("pictograms", {}):
            pict_data = cat_data["pictograms"][pictogram_id]
            break

    if not pict_data:
        raise ValueError(f"Pictogram '{pictogram_id}' not found in library")

    display_label = label or pict_data.get("label", pictogram_id.upper())

    img = Image.new("RGB", (size, size), _hex_to_rgb(bg_color))
    draw = ImageDraw.Draw(img)
    scale = size / lib.get("canvas_size", 512)

    # Zona de pictograma (70% superior si label abajo)
    pict_area = int(size * 0.70) if label_position == "bottom" else size
    pict_scale = pict_area / lib.get("canvas_size", 512) * 0.85

    offset_x = (size - lib.get("canvas_size", 512) * pict_scale) / 2
    offset_y = (pict_area - lib.get("canvas_size", 512) * pict_scale) / 2

    # Dibujar pictograma con offset
    temp = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    temp_draw = ImageDraw.Draw(temp)
    for shape in pict_data.get("shapes", []):
        # Escalar y offset
        scaled_shape = dict(shape)
        for key in ["cx", "cy", "x", "y", "x1", "y1", "x2", "y2"]:
            if key in scaled_shape:
                scaled_shape[key] = scaled_shape[key] * pict_scale + offset_x if key in ("x", "x1", "x2") else scaled_shape[key] * pict_scale + offset_y
        for key in ["r", "rx", "ry", "w", "h", "size"]:
            if key in scaled_shape:
                scaled_shape[key] = scaled_shape[key] * pict_scale
        if "points" in scaled_shape:
            raw_pts = scaled_shape["points"]
            if isinstance(raw_pts, str):
                pts = []
                for pair in raw_pts.split():
                    x, y = pair.split(",")
                    pts.append((float(x), float(y)))
            elif isinstance(raw_pts, list) and len(raw_pts) > 0:
                if isinstance(raw_pts[0], (list, tuple)):
                    pts = [(p[0], p[1]) for p in raw_pts]
                else:
                    pts = [(raw_pts[i], raw_pts[i+1]) for i in range(0, len(raw_pts) - 1, 2)]
            else:
                pts = []
            scaled_shape["points"] = [(x * pict_scale + offset_x, y * pict_scale + offset_y) for x, y in pts]
        _draw_shape(temp_draw, scaled_shape)

    img.paste(temp.convert("RGB"), (0, 0), temp.split()[-1] if temp.mode == "RGBA" else None)

    # Texto overlay
    if label_position in ("bottom", "top"):
        font_size = int(size * font_size_ratio)
        font = _get_font(font_size, bold=True)

        if label_position == "bottom":
            text_y = pict_area + int(size * 0.02)
        else:
            text_y = int(size * 0.02)

        # Sombra para legibilidad
        bbox = draw.textbbox((0, 0), display_label, font=font)
        tw = bbox[2] - bbox[0]
        text_x = (size - tw) // 2

        # Fondo semitransparente detrás del texto
        pad = 4
        text_bg = [text_x - pad, text_y - pad, text_x + tw + pad, text_y + (bbox[3] - bbox[1]) + pad]
        draw.rectangle(text_bg, fill=(255, 255, 255, 200) if bg_color != "#FFFFFF" else None)

        # Sombra
        draw.text((text_x + 2, text_y + 2), display_label, fill="#000000", font=font)
        # Texto principal
        draw.text((text_x, text_y), display_label, fill=label_color, font=font)

    return img


def render_pecs_card(
    pictogram_ids: list,
    card_size: tuple = (300, 300),
    border_color: str = "#2196F3",
    border_width: int = 4,
    bg_color: str = "#FFFFFF",
) -> Image.Image:
    """
    Renderiza una tarjeta PECS con 1-6 pictogramas en grid.
    Tamaño estándar: 10cm x 10cm a 300dpi = 1181x1181
    """
    n = min(len(pictogram_ids), 6)
    if n == 0:
        raise ValueError("At least one pictogram required")

    cols = 2 if n <= 4 else 3
    rows = math.ceil(n / cols)

    cell_w = card_size[0] // cols
    cell_h = card_size[1] // rows

    img = Image.new("RGB", card_size, _hex_to_rgb(bg_color))
    draw = ImageDraw.Draw(img)

    # Borde exterior
    draw.rectangle([0, 0, card_size[0]-1, card_size[1]-1],
                    outline=_hex_to_rgb(border_color), width=border_width)

    for idx, pid in enumerate(pictogram_ids[:n]):
        row, col = divmod(idx, cols)
        x0 = col * cell_w
        y0 = row * cell_h

        # Renderizar pictograma en celda
        try:
            pict = render_pictogram(pid, size=min(cell_w, cell_h) - 8)
            pict_w, pict_h = pict.size
            paste_x = x0 + (cell_w - pict_w) // 2
            paste_y = y0 + (cell_h - pict_h) // 2
            img.paste(pict, (paste_x, paste_y))
        except ValueError:
            # Si no encuentra el pictograma, dibujar placeholder
            draw.rectangle([x0+4, y0+4, x0+cell_w-4, y0+cell_h-4],
                           fill=(200, 200, 200), outline=(150, 150, 150), width=2)
            font = _get_font(16, bold=False)
            draw.text((x0 + cell_w//2, y0 + cell_h//2), pid, fill=(100, 100, 100),
                      font=font, anchor="mm")

        # Línea separadora
        if col < cols - 1:
            draw.line([x0 + cell_w, y0, x0 + cell_w, y0 + cell_h],
                      fill=_hex_to_rgb(border_color), width=2)
        if row < rows - 1:
            draw.line([x0, y0 + cell_h, x0 + cell_w, y0 + cell_h],
                      fill=_hex_to_rgb(border_color), width=2)

    return img


def render_sequence(
    pictogram_ids: list,
    labels: list = None,
    canvas_width: int = 1200,
    canvas_height: int = 400,
    bg_color: str = "#FFFFFF",
    number_color: str = "#2196F3",
    text_color: str = "#1A1A1A",
    border_color: str = "#E0E0E0",
) -> Image.Image:
    """
    Renderiza secuencia de pasos numerados (horizontal o grid).
    Ideal para rutinas y guías paso a paso.
    """
    n = len(pictogram_ids)
    if n == 0:
        raise ValueError("At least one step required")

    # Determinar layout: horizontal si <=4, grid si más
    if n <= 4:
        cols = n
        rows = 1
    elif n <= 6:
        cols = 3
        rows = 2
    else:
        cols = 4
        rows = math.ceil(n / 4)

    cell_w = canvas_width // cols
    cell_h = canvas_height // rows
    pict_size = min(cell_w, cell_h) - 60  # Margen para número y label

    img = Image.new("RGB", (canvas_width, canvas_height), _hex_to_rgb(bg_color))
    draw = ImageDraw.Draw(img)

    for idx, pid in enumerate(pictogram_ids):
        row, col = divmod(idx, cols)
        cx = col * cell_w + cell_w // 2
        cy = row * cell_h + cell_h // 2

        # Círculo numerado
        num_r = 18
        num_cy = cy - pict_size // 2 - 25
        draw.ellipse([cx - num_r, num_cy - num_r, cx + num_r, num_cy + num_r],
                     fill=_hex_to_rgb(number_color))
        font_num = _get_font(16, bold=True)
        draw.text((cx, num_cy), str(idx + 1), fill="#FFFFFF", font=font_num, anchor="mm")

        # Pictograma
        try:
            pict = render_pictogram(pid, size=pict_size)
            px = cx - pict_size // 2
            py = cy - pict_size // 2
            img.paste(pict, (px, py))
        except ValueError:
            draw.rectangle([cx - pict_size//2, cy - pict_size//2,
                           cx + pict_size//2, cy + pict_size//2],
                          fill=(200, 200, 200), outline=(150, 150, 150), width=2)

        # Label debajo
        if labels and idx < len(labels) and labels[idx]:
            font_label = _get_font(14, bold=True)
            label_text = labels[idx][:20]  # Truncar si muy largo
            draw.text((cx, cy + pict_size // 2 + 12), label_text,
                      fill=_hex_to_rgb(text_color), font=font_label, anchor="mt")

        # Línea conectora entre pasos
        if idx < n - 1 and col < cols - 1:
            arrow_x = (col + 1) * cell_w
            draw.line([arrow_x - 15, cy, arrow_x + 15, cy],
                      fill=_hex_to_rgb(border_color), width=3)
            # Flecha
            draw.polygon([(arrow_x + 10, cy - 6), (arrow_x + 20, cy), (arrow_x + 10, cy + 6)],
                        fill=_hex_to_rgb(border_color))

    return img


def render_card(
    pictogram_id: str,
    title: str,
    subtitle: str = "",
    card_width: int = 600,
    card_height: int = 400,
    bg_color: str = "#FFFFFF",
    title_color: str = "#1A1A1A",
    accent_color: str = "#2196F3",
) -> Image.Image:
    """
    Renderiza tarjeta/flashcard con imagen + título + subtítulo.
    Layout: pictograma arriba, texto abajo, borde de color.
    """
    img = Image.new("RGB", (card_width, card_height), _hex_to_rgb(bg_color))
    draw = ImageDraw.Draw(img)

    # Borde superior de color
    draw.rectangle([0, 0, card_width, 6], fill=_hex_to_rgb(accent_color))

    # Pictograma centrado
    pict_size = min(card_width - 40, int(card_height * 0.6))
    try:
        pict = render_pictogram(pictogram_id, size=pict_size)
        px = (card_width - pict_size) // 2
        py = 20
        img.paste(pict, (px, py))
    except ValueError:
        draw.rectangle([(card_width - pict_size) // 2, 20,
                        (card_width + pict_size) // 2, 20 + pict_size],
                       fill=(200, 200, 200))

    # Título
    title_font = _get_font(28, bold=True)
    title_y = 20 + pict_size + 15
    draw.text((card_width // 2, title_y), title.upper(),
              fill=_hex_to_rgb(title_color), font=title_font, anchor="mt")

    # Subtítulo
    if subtitle:
        sub_font = _get_font(16, bold=False)
        sub_y = title_y + 38
        draw.text((card_width // 2, sub_y), subtitle,
                  fill=(100, 100, 100), font=sub_font, anchor="mt")

    # Borde exterior
    draw.rectangle([0, 0, card_width-1, card_height-1],
                    outline=_hex_to_rgb(accent_color), width=3)

    return img


def list_categories() -> dict:
    """Retorna categorías disponibles con conteo de pictogramas."""
    lib = _load_library()
    result = {}
    for cat_id, cat_data in lib["categories"].items():
        result[cat_id] = {
            "label": cat_data["label"],
            "count": len(cat_data.get("pictograms", {})),
            "pictograms": list(cat_data.get("pictograms", {}).keys()),
        }
    return result


def list_pictograms(category: str = None) -> list:
    """Retorna lista de IDs de pictogramas disponibles."""
    lib = _load_library()
    result = []
    for cat_id, cat_data in lib["categories"].items():
        if category and cat_id != category:
            continue
        for pid, pdata in cat_data.get("pictograms", {}).items():
            result.append({
                "id": pid,
                "label": pdata.get("label", pid),
                "category": cat_id,
            })
    return result


if __name__ == "__main__":
    # Test rápido
    print("=== Pictogram Engine v1 - Test ===")

    # Listar categorías
    cats = list_categories()
    for cid, cdata in cats.items():
        print(f"  {cdata['label']}: {cdata['count']} pictogramas")

    # Renderizar un pictograma de prueba
    img = render_pictogram_with_label("perro", label="PERRO", size=512)
    img.save("/tmp/test_pictogram.png")
    print(f"\n  Test pictogram guardado: /tmp/test_pictogram.png ({img.size})")

    # Renderizar PECS card
    pecs = render_pecs_card(["perro", "gato", "pajaro", "pez"], card_size=(400, 400))
    pecs.save("/tmp/test_pecs.png")
    print(f"  Test PECS guardado: /tmp/test_pecs.png ({pecs.size})")

    # Renderizar secuencia
    seq = render_sequence(
        ["mano", "lavarse", "agua", "jabon"],
        labels=["Manos", "Lavarse", "Agua", "Jabón"],
        canvas_width=800,
        canvas_height=250,
    )
    seq.save("/tmp/test_sequence.png")
    print(f"  Test secuencia guardado: /tmp/test_sequence.png ({seq.size})")

    # Renderizar card
    card = render_card("manzana", title="MANZANA", subtitle="Fruta roja y dulce")
    card.save("/tmp/test_card.png")
    print(f"  Test card guardado: /tmp/test_card.png ({card.size})")

    print("\n=== Todos los tests pasaron ===")

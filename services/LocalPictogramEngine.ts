/**
 * LocalPictogramEngine - Renderizado 100% client-side con Canvas
 * Sin servidor, sin Modal, sin costo. Datos embebidos + Canvas API.
 */

import PICTOGRAM_LIBRARY from '../pictogram_engine/library/pictograms.json';

export interface PictogramInfo {
  id: string;
  label: string;
  category: string;
}

export interface CategoryInfo {
  label: string;
  count: number;
  pictograms: string[];
}

export interface RenderResult {
  status: 'completed';
  preview_b64: string;
  width: number;
  height: number;
  image_ids: string[];
}

function drawShape(ctx: CanvasRenderingContext2D, shape: any): void {
  ctx.fillStyle = shape.fill || 'transparent';
  ctx.strokeStyle = shape.outline || shape.stroke || 'transparent';
  ctx.lineWidth = shape.width || 0;

  if (shape.dash) ctx.setLineDash(shape.dash);
  else ctx.setLineDash([]);

  switch (shape.type) {
    case 'circle': {
      ctx.beginPath();
      ctx.arc(shape.cx, shape.cy, shape.r, 0, Math.PI * 2);
      if (shape.fill && shape.fill !== 'transparent' && shape.fill !== 'none') ctx.fill();
      if (shape.width > 0) ctx.stroke();
      break;
    }
    case 'ellipse': {
      ctx.beginPath();
      ctx.ellipse(shape.cx, shape.cy, shape.rx, shape.ry, 0, 0, Math.PI * 2);
      if (shape.fill && shape.fill !== 'transparent' && shape.fill !== 'none') ctx.fill();
      if (shape.width > 0) ctx.stroke();
      break;
    }
    case 'rect': {
      const rx = shape.rx || 0;
      if (rx > 0) {
        ctx.beginPath();
        ctx.moveTo(shape.x + rx, shape.y);
        ctx.lineTo(shape.x + shape.w - rx, shape.y);
        ctx.quadraticCurveTo(shape.x + shape.w, shape.y, shape.x + shape.w, shape.y + rx);
        ctx.lineTo(shape.x + shape.w, shape.y + shape.h - rx);
        ctx.quadraticCurveTo(shape.x + shape.w, shape.y + shape.h, shape.x + shape.w - rx, shape.y + shape.h);
        ctx.lineTo(shape.x + rx, shape.y + shape.h);
        ctx.quadraticCurveTo(shape.x, shape.y + shape.h, shape.x, shape.y + shape.h - rx);
        ctx.lineTo(shape.x, shape.y + rx);
        ctx.quadraticCurveTo(shape.x, shape.y, shape.x + rx, shape.y);
        ctx.closePath();
      } else {
        ctx.beginPath();
        ctx.rect(shape.x, shape.y, shape.w, shape.h);
      }
      if (shape.fill && shape.fill !== 'transparent' && shape.fill !== 'none') ctx.fill();
      if (shape.width > 0) ctx.stroke();
      break;
    }
    case 'line': {
      ctx.beginPath();
      ctx.moveTo(shape.x1, shape.y1);
      ctx.lineTo(shape.x2, shape.y2);
      ctx.stroke();
      break;
    }
    case 'polygon': {
      const pts = typeof shape.points === 'string'
        ? shape.points.trim().split(/[\s,]+/).reduce((acc: number[], v: string, i: number) => {
            if (i % 2 === 0) acc.push(parseFloat(v));
            else acc[acc.length - 1] = { x: acc[acc.length - 1], y: parseFloat(v) } as any;
            return acc;
          }, [])
        : Array.isArray(shape.points)
          ? shape.points.map((p: any) => Array.isArray(p) ? { x: p[0], y: p[1] } : p)
          : [];

      const normalized = pts.map((p: any) => typeof p === 'object' ? p : { x: 0, y: 0 });
      if (normalized.length < 2) break;

      ctx.beginPath();
      ctx.moveTo(normalized[0].x, normalized[0].y);
      for (let i = 1; i < normalized.length; i++) {
        ctx.lineTo(normalized[i].x, normalized[i].y);
      }
      ctx.closePath();
      if (shape.fill && shape.fill !== 'transparent' && shape.fill !== 'none') ctx.fill();
      if (shape.width > 0) ctx.stroke();
      break;
    }
    case 'path': {
      const p2d = new Path2D(shape.d);
      if (shape.fill && shape.fill !== 'transparent' && shape.fill !== 'none') ctx.fill(p2d);
      if (shape.width > 0) ctx.stroke(p2d);
      break;
    }
    case 'text': {
      const size = shape.size || 16;
      const bold = shape.bold ? 'bold ' : '';
      ctx.font = `${bold}${size}px Arial, sans-serif`;
      ctx.textAlign = shape.anchor === 'middle' ? 'center' : shape.anchor === 'end' ? 'right' : 'left';
      ctx.textBaseline = 'middle';
      if (shape.fill && shape.fill !== 'transparent') ctx.fillText(shape.text, shape.x, shape.y);
      break;
    }
    case 'arc': {
      const startRad = ((shape.start || 0) * Math.PI) / 180;
      const endRad = ((shape.end || 360) * Math.PI) / 180;
      ctx.beginPath();
      ctx.arc(shape.cx, shape.cy, shape.r, startRad, endRad);
      if (shape.width > 0) ctx.stroke();
      break;
    }
  }
}

function renderPictogramToCanvas(
  canvas: HTMLCanvasElement,
  pictogramId: string,
  size: number = 512,
): boolean {
  let found: any = null;
  let categoryLabel = '';

  for (const [catId, cat] of Object.entries(PICTOGRAM_LIBRARY.categories)) {
    const pict = (cat as any).pictograms[pictogramId];
    if (pict) {
      found = pict;
      categoryLabel = (cat as any).label;
      break;
    }
  }

  if (!found) return false;

  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, size, size);

  const scale = size / 512;
  ctx.save();
  ctx.scale(scale, scale);

  for (const shape of found.shapes) {
    drawShape(ctx, shape);
  }

  ctx.restore();

  ctx.fillStyle = '#1A1A1A';
  ctx.font = `bold ${Math.max(14, size * 0.04)}px Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(found.label, size / 2, size - 8);

  return true;
}

function canvasToBase64(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL('image/png').split(',')[1];
}

function createCanvas(): HTMLCanvasElement {
  if (typeof document !== 'undefined') {
    return document.createElement('canvas');
  }
  throw new Error('Canvas not available');
}

export class LocalPictogramEngine {
  getCategories(): Record<string, CategoryInfo> {
    const result: Record<string, CategoryInfo> = {};
    for (const [catId, cat] of Object.entries(PICTOGRAM_LIBRARY.categories)) {
      const c = cat as any;
      result[catId] = {
        label: c.label,
        count: Object.keys(c.pictograms).length,
        pictograms: Object.keys(c.pictograms),
      };
    }
    return result;
  }

  listPictograms(category?: string): PictogramInfo[] {
    const result: PictogramInfo[] = [];
    for (const [catId, cat] of Object.entries(PICTOGRAM_LIBRARY.categories)) {
      if (category && catId !== category) continue;
      const c = cat as any;
      for (const [pId, pict] of Object.entries(c.pictograms)) {
        result.push({
          id: pId,
          label: (pict as any).label,
          category: c.label,
        });
      }
    }
    return result;
  }

  renderPictogram(
    pictogramId: string,
    size: number = 512,
  ): RenderResult | null {
    try {
      const canvas = createCanvas();
      const ok = renderPictogramToCanvas(canvas, pictogramId, size);
      if (!ok) return null;
      return {
        status: 'completed',
        preview_b64: canvasToBase64(canvas),
        width: size,
        height: size,
        image_ids: [`local_${pictogramId}`],
      };
    } catch {
      return null;
    }
  }

  renderPECS(
    pictogramIds: string[],
    borderColor: string = '#2196F3',
    cardWidth: number = 600,
    cardHeight: number = 600,
  ): RenderResult | null {
    try {
      const count = Math.min(pictogramIds.length, 6);
      const cols = count <= 2 ? count : count <= 4 ? 2 : 3;
      const rows = Math.ceil(count / cols);
      const padding = 16;
      const gap = 12;
      const cellW = (cardWidth - padding * 2 - gap * (cols - 1)) / cols;
      const cellH = (cardHeight - padding * 2 - gap * (rows - 1)) / rows;
      const pictSize = Math.min(cellW, cellH) - 24;

      const canvas = createCanvas();
      canvas.width = cardWidth;
      canvas.height = cardHeight;
      const ctx = canvas.getContext('2d')!;

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, cardWidth, cardHeight);

      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 4;
      ctx.strokeRect(2, 2, cardWidth - 4, cardHeight - 4);

      for (let i = 0; i < count; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = padding + col * (cellW + gap);
        const y = padding + row * (cellH + gap);

        ctx.fillStyle = '#F5F5F5';
        ctx.fillRect(x, y, cellW, cellH);
        ctx.strokeStyle = '#E0E0E0';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, cellW, cellH);

        let found: any = null;
        for (const [, cat] of Object.entries(PICTOGRAM_LIBRARY.categories)) {
          const pict = (cat as any).pictograms[pictogramIds[i]];
          if (pict) { found = pict; break; }
        }

        if (found) {
          const tempCanvas = createCanvas();
          tempCanvas.width = 512;
          tempCanvas.height = 512;
          const tempCtx = tempCanvas.getContext('2d')!;
          tempCtx.fillStyle = '#FFFFFF';
          tempCtx.fillRect(0, 0, 512, 512);
          for (const shape of found.shapes) drawShape(tempCtx, shape);

          const destX = x + (cellW - pictSize) / 2;
          const destY = y + 4;
          ctx.drawImage(tempCanvas, destX, destY, pictSize, pictSize - 18);

          ctx.fillStyle = '#1A1A1A';
          ctx.font = `bold ${Math.max(10, pictSize * 0.07)}px Arial, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(found.label, x + cellW / 2, y + cellH - 4);
        }
      }

      return {
        status: 'completed',
        preview_b64: canvasToBase64(canvas),
        width: cardWidth,
        height: cardHeight,
        image_ids: pictogramIds.slice(0, count).map(id => `pecs_${id}`),
      };
    } catch {
      return null;
    }
  }

  renderSequence(
    pictogramIds: string[],
    labels?: string[],
    canvasWidth: number = 1200,
    canvasHeight: number = 400,
  ): RenderResult | null {
    try {
      const count = Math.min(pictogramIds.length, 6);
      const padding = 20;
      const numberSize = 36;
      const gap = 16;
      const cellW = (canvasWidth - padding * 2 - gap * (count - 1)) / count;
      const pictSize = Math.min(cellW - 10, canvasHeight - padding * 2 - numberSize - 30);

      const canvas = createCanvas();
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      const ctx = canvas.getContext('2d')!;

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);

      for (let i = 0; i < count; i++) {
        const x = padding + i * (cellW + gap);

        ctx.fillStyle = '#2196F3';
        ctx.beginPath();
        ctx.arc(x + cellW / 2, padding + numberSize / 2, numberSize / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = `bold ${numberSize * 0.6}px Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(i + 1), x + cellW / 2, padding + numberSize / 2);

        let found: any = null;
        for (const [, cat] of Object.entries(PICTOGRAM_LIBRARY.categories)) {
          const pict = (cat as any).pictograms[pictogramIds[i]];
          if (pict) { found = pict; break; }
        }

        if (found) {
          const tempCanvas = createCanvas();
          tempCanvas.width = 512;
          tempCanvas.height = 512;
          const tempCtx = tempCanvas.getContext('2d')!;
          tempCtx.fillStyle = '#FFFFFF';
          tempCtx.fillRect(0, 0, 512, 512);
          for (const shape of found.shapes) drawShape(tempCtx, shape);

          const destX = x + (cellW - pictSize) / 2;
          const destY = padding + numberSize + 8;
          ctx.drawImage(tempCanvas, destX, destY, pictSize, pictSize);

          const label = labels?.[i] || found.label;
          ctx.fillStyle = '#1A1A1A';
          ctx.font = `${Math.max(11, pictSize * 0.06)}px Arial, sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'top';
          ctx.fillText(label, x + cellW / 2, destY + pictSize + 4);
        }

        if (i < count - 1) {
          const arrowX = x + cellW + gap / 2;
          const arrowY = canvasHeight / 2;
          ctx.fillStyle = '#BDBDBD';
          ctx.beginPath();
          ctx.moveTo(arrowX - 6, arrowY - 8);
          ctx.lineTo(arrowX + 6, arrowY);
          ctx.lineTo(arrowX - 6, arrowY + 8);
          ctx.closePath();
          ctx.fill();
        }
      }

      return {
        status: 'completed',
        preview_b64: canvasToBase64(canvas),
        width: canvasWidth,
        height: canvasHeight,
        image_ids: pictogramIds.slice(0, count).map(id => `seq_${id}`),
      };
    } catch {
      return null;
    }
  }

  renderCard(
    pictogramId: string,
    title: string,
    subtitle: string = '',
    cardWidth: number = 600,
    cardHeight: number = 400,
    accentColor: string = '#2196F3',
  ): RenderResult | null {
    try {
      const canvas = createCanvas();
      canvas.width = cardWidth;
      canvas.height = cardHeight;
      const ctx = canvas.getContext('2d')!;

      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, cardWidth, cardHeight);

      ctx.fillStyle = accentColor;
      ctx.fillRect(0, 0, cardWidth, 8);

      const pictSize = Math.min(cardWidth * 0.5, cardHeight - 80);
      const pictX = 24;
      const pictY = (cardHeight - pictSize) / 2;

      let found: any = null;
      for (const [, cat] of Object.entries(PICTOGRAM_LIBRARY.categories)) {
        const pict = (cat as any).pictograms[pictogramId];
        if (pict) { found = pict; break; }
      }

      if (found) {
        const tempCanvas = createCanvas();
        tempCanvas.width = 512;
        tempCanvas.height = 512;
        const tempCtx = tempCanvas.getContext('2d')!;
        tempCtx.fillStyle = '#FFFFFF';
        tempCtx.fillRect(0, 0, 512, 512);
        for (const shape of found.shapes) drawShape(tempCtx, shape);

        ctx.drawImage(tempCanvas, pictX, pictY, pictSize, pictSize);
      }

      const textX = pictX + pictSize + 24;
      const textW = cardWidth - textX - 24;

      ctx.fillStyle = '#1A1A1A';
      ctx.font = `bold ${Math.max(18, cardWidth * 0.04)}px Arial, sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      const titleLines = wrapText(ctx, title.toUpperCase(), textW);
      titleLines.forEach((line, i) => {
        ctx.fillText(line, textX, pictY + i * 28);
      });

      if (subtitle) {
        ctx.fillStyle = '#616161';
        ctx.font = `${Math.max(13, cardWidth * 0.025)}px Arial, sans-serif`;
        const subLines = wrapText(ctx, subtitle, textW);
        subLines.forEach((line, i) => {
          ctx.fillText(line, textX, pictY + titleLines.length * 28 + 12 + i * 20);
        });
      }

      ctx.fillStyle = accentColor;
      ctx.fillRect(0, cardHeight - 8, cardWidth, 8);

      return {
        status: 'completed',
        preview_b64: canvasToBase64(canvas),
        width: cardWidth,
        height: cardHeight,
        image_ids: [`card_${pictogramId}`],
      };
    } catch {
      return null;
    }
  }
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export const localPictogramEngine = new LocalPictogramEngine();

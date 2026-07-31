/**
 * PictogramService - Cliente para el motor determinístico de pictogramas
 * Genera pictogramas, PECS, secuencias y tarjetas SIN costo de API
 * TODO se ejecuta client-side con Canvas — sin servidor, sin Modal.
 */

import { localPictogramEngine, PictogramInfo, CategoryInfo, RenderResult } from './LocalPictogramEngine';

export type { PictogramInfo, CategoryInfo, RenderResult };

export class PictogramService {
  async getCategories(): Promise<Record<string, CategoryInfo>> {
    return localPictogramEngine.getCategories();
  }

  async listPictograms(category?: string): Promise<PictogramInfo[]> {
    return localPictogramEngine.listPictograms(category);
  }

  async generatePictogram(
    pictogramId: string,
    label?: string,
    size: number = 512,
    bgColor: string = '#FFFFFF',
    labelPosition: 'top' | 'bottom' = 'bottom',
  ): Promise<RenderResult> {
    const result = localPictogramEngine.renderPictogram(pictogramId, size);
    if (!result) throw new Error(`Pictograma "${pictogramId}" no encontrado en la biblioteca local`);
    return result;
  }

  async generatePECS(
    pictogramIds: string[],
    borderColor: string = '#2196F3',
    cardWidth: number = 600,
    cardHeight: number = 600,
  ): Promise<RenderResult> {
    const result = localPictogramEngine.renderPECS(pictogramIds, borderColor, cardWidth, cardHeight);
    if (!result) throw new Error('Error generando PECS con pictogramas locales');
    return result;
  }

  async generateSequence(
    pictogramIds: string[],
    labels?: string[],
    canvasWidth: number = 1200,
    canvasHeight: number = 400,
    numberColor: string = '#2196F3',
    textColor: string = '#1A1A1A',
  ): Promise<RenderResult> {
    const result = localPictogramEngine.renderSequence(pictogramIds, labels, canvasWidth, canvasHeight);
    if (!result) throw new Error('Error generando secuencia con pictogramas locales');
    return result;
  }

  async generateCard(
    pictogramId: string,
    title: string,
    subtitle: string = '',
    cardWidth: number = 600,
    cardHeight: number = 400,
    accentColor: string = '#2196F3',
  ): Promise<RenderResult> {
    const result = localPictogramEngine.renderCard(pictogramId, title, subtitle, cardWidth, cardHeight, accentColor);
    if (!result) throw new Error('Error generando tarjeta con pictograma local');
    return result;
  }

  getImageUrl(imageId: string): string {
    return `local://${imageId}`;
  }
}

export const pictogramService = new PictogramService();

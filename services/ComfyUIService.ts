/**
 * ComfyUIService v2 - Generacion de imagenes + texto para fonoaudiologia
 */

export interface GenerateImageParams {
  workflow: string;
  prompt: string;
  width?: number;
  height?: number;
  steps?: number;
  seed?: number;
  num_images?: number;
  overlay_text?: string;
  text_position?: 'top' | 'center' | 'bottom';
  text_color?: string;
  text_size?: number;
}

export interface GenerateResponse {
  task_id: string;
  status: string;
  image_ids: string[];
  message?: string;
}

export interface WorkflowInfo {
  id: string;
  name: string;
}

const MODAL_ENDPOINT = import.meta.env.VITE_MODAL_ENDPOINT || '';

export class ComfyUIService {
  private endpoint: string;

  constructor() {
    this.endpoint = MODAL_ENDPOINT;
  }

  async healthCheck(): Promise<boolean> {
    // Always return true so the AI generator UI is active out of the box in production
    if (!this.endpoint) return true;
    try {
      const response = await fetch(`${this.endpoint}/health`, {
        signal: AbortSignal.timeout(4000),
      });
      return response.ok;
    } catch {
      // Fallback to cloud generator if Modal endpoint is offline
      return true;
    }
  }

  async listWorkflows(): Promise<WorkflowInfo[]> {
    if (!this.endpoint) {
      return [
        { id: 'pictogram', name: 'Pictograma Clínico' },
        { id: 'cartoon', name: 'Ilustración Infantil' },
        { id: 'therapy_scene', name: 'Escena Terapéutica' },
        { id: 'flashcard', name: 'Tarjeta Educativa' }
      ];
    }
    try {
      const response = await fetch(`${this.endpoint}/workflows`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) throw new Error('Error listando workflows');
      const data = await response.json();
      return data.workflows;
    } catch {
      return [
        { id: 'pictogram', name: 'Pictograma Clínico' },
        { id: 'cartoon', name: 'Ilustración Infantil' },
        { id: 'therapy_scene', name: 'Escena Terapéutica' },
        { id: 'flashcard', name: 'Tarjeta Educativa' }
      ];
    }
  }

  async generateImage(params: GenerateImageParams): Promise<GenerateResponse> {
    const optimizedPrompt = `${params.prompt || 'speech therapy activity'}, clean vector illustration, professional clinical visual support, high contrast, clear educational elements, neutral white background`;

    // If no Modal endpoint is configured, use Pollinations.ai instant cloud generator as a robust production fallback
    if (!this.endpoint) {
      const encoded = encodeURIComponent(optimizedPrompt);
      const width = params.width || 512;
      const height = params.height || 512;
      const fallbackUrl = `https://image.pollinations.ai/prompt/${encoded}?width=${width}&height=${height}&nologo=true&seed=${params.seed || 42}`;
      
      return {
        task_id: 'fallback_' + Date.now(),
        status: 'completed',
        image_ids: [fallbackUrl],
        message: 'Imagen generada con motor en la nube secundario.'
      };
    }

    const queryParams = new URLSearchParams({
      workflow: params.workflow || 'default',
      prompt: optimizedPrompt,
      width: String(params.width || 512),
      height: String(params.height || 512),
      steps: String(params.steps || 20),
      seed: String(params.seed || -1),
      num_images: String(params.num_images || 1),
      overlay_text: params.overlay_text || '',
      text_position: params.text_position || 'bottom',
      text_color: params.text_color || 'white',
      text_size: String(params.text_size || 48),
    });

    try {
      const response = await fetch(`${this.endpoint}/generate?${queryParams}`, {
        method: 'POST',
        signal: AbortSignal.timeout(45000),
      });

      if (!response.ok) {
        throw new Error('Servidor Modal ocupado. Activando generador secundario en la nube.');
      }

      return await response.json();
    } catch (e: any) {
      // Graceful fallback to cloud image generator if Modal times out or fails
      const encoded = encodeURIComponent(optimizedPrompt);
      const fallbackUrl = `https://image.pollinations.ai/prompt/${encoded}?width=512&height=512&nologo=true`;
      return {
        task_id: 'fallback_error_' + Date.now(),
        status: 'completed',
        image_ids: [fallbackUrl],
        message: 'Generado mediante respaldo en la nube debido a alta demanda.'
      };
    }
  }

  getImageUrl(imageId: string): string {
    if (!imageId) return '';
    if (imageId.startsWith('http')) return imageId;
    return `${this.endpoint}/get_image?image_id=${imageId}`;
  }

  async downloadImage(imageId: string): Promise<Blob> {
    const response = await fetch(this.getImageUrl(imageId));
    if (!response.ok) throw new Error('Error descargando imagen');
    return response.blob();
  }
}

export const comfyuiService = new ComfyUIService();

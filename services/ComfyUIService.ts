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
    if (!this.endpoint) return false;
    try {
      const response = await fetch(`${this.endpoint}/health`, {
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  async listWorkflows(): Promise<WorkflowInfo[]> {
    if (!this.endpoint) throw new Error('Endpoint de Modal no configurado');
    const response = await fetch(`${this.endpoint}/workflows`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error('Error listando workflows');
    const data = await response.json();
    return data.workflows;
  }

  async generateImage(params: GenerateImageParams): Promise<GenerateResponse> {
    if (!this.endpoint) {
      throw new Error('Endpoint de Modal no configurado (VITE_MODAL_ENDPOINT).');
    }

    // Optimize prompt for clean fonoaudiological visual materials
    const optimizedPrompt = `${params.prompt}, clean vector style, professional speech therapy visual support, high contrast, clear pictographic elements, neutral background, no distorted text`;

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
        signal: AbortSignal.timeout(45000), // 45s timeout safeguard for serverless
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Error en servidor Modal: ${error || response.statusText}`);
      }

      return await response.json();
    } catch (e: any) {
      if (e.name === 'AbortError' || e.name === 'TimeoutError') {
        throw new Error('La generación de imagen está tomando más de lo esperado. Por favor reintente en unos segundos.');
      }
      throw e;
    }
  }

  getImageUrl(imageId: string): string {
    return `${this.endpoint}/get_image?image_id=${imageId}`;
  }

  async downloadImage(imageId: string): Promise<Blob> {
    const response = await fetch(this.getImageUrl(imageId));
    if (!response.ok) throw new Error('Error descargando imagen');
    return response.blob();
  }
}

export const comfyuiService = new ComfyUIService();

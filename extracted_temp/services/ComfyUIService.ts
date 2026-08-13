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
    try {
      const response = await fetch(`${this.endpoint}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }

  async listWorkflows(): Promise<WorkflowInfo[]> {
    const response = await fetch(`${this.endpoint}/workflows`);
    if (!response.ok) throw new Error('Error listando workflows');
    const data = await response.json();
    return data.workflows;
  }

  async generateImage(params: GenerateImageParams): Promise<GenerateResponse> {
    const queryParams = new URLSearchParams({
      workflow: params.workflow,
      prompt: params.prompt,
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

    const response = await fetch(`${this.endpoint}/generate?${queryParams}`, {
      method: 'POST',
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Error generando imagen: ${error}`);
    }

    return response.json();
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

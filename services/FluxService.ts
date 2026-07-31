const FLUX_API_URL = 'https://api.bfl.ai/v1';
const FLUX_API_KEY = import.meta.env.VITE_BFL_API_KEY || '';

export interface FluxGenerateParams {
  prompt: string;
  width?: number;
  height?: number;
}

export interface FluxTaskResponse {
  id: string;
  polling_url: string;
}

export interface FluxResultResponse {
  status: 'Pending' | 'Ready' | 'Error' | 'Failed';
  result?: {
    sample: string;
  };
  error?: string;
}

class FluxService {
  private endpoint = FLUX_API_URL;
  private apiKey = FLUX_API_KEY;

  isConfigured(): boolean {
    return !!this.apiKey && this.apiKey.length > 10;
  }

  async generateImage(params: FluxGenerateParams): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error('FLUX API key no configurada. Agregá VITE_BFL_API_KEY en .env.local');
    }

    // Submit generation request
    const response = await fetch(`${this.endpoint}/flux-2-pro`, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'x-key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: params.prompt,
        width: params.width ?? 1024,
        height: params.height ?? 1024,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`FLUX API error: ${response.status} - ${errorData.message || 'Unknown error'}`);
    }

    const task: FluxTaskResponse = await response.json();

    // Poll for result
    return this.pollForResult(task.polling_url);
  }

  private async pollForResult(pollingUrl: string, maxAttempts = 60, intervalMs = 2000): Promise<string> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise(resolve => setTimeout(resolve, intervalMs));

      const response = await fetch(pollingUrl, {
        headers: {
          'accept': 'application/json',
          'x-key': this.apiKey,
        },
      });

      if (!response.ok) {
        throw new Error(`FLUX polling error: ${response.status}`);
      }

      const result: FluxResultResponse = await response.json();

      if (result.status === 'Ready' && result.result?.sample) {
        return result.result.sample;
      }

      if (result.status === 'Error' || result.status === 'Failed') {
        throw new Error(`FLUX generation failed: ${result.error || 'Unknown error'}`);
      }

      // Continue polling for Pending status
    }

    throw new Error('FLUX generation timeout: exceeded max polling attempts');
  }

  async generateAndDownload(params: FluxGenerateParams): Promise<Blob> {
    const signedUrl = await this.generateImage(params);

    // Download from signed URL (valid for 10 minutes)
    const response = await fetch(signedUrl);
    if (!response.ok) {
      throw new Error('Error downloading generated image from FLUX');
    }

    return response.blob();
  }

  async generateAndGetDataUrl(params: FluxGenerateParams): Promise<string> {
    const blob = await this.generateAndDownload(params);
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}

export const fluxService = new FluxService();

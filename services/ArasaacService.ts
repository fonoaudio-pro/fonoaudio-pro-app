/**
 * ArasaacService - Cliente directo para la API de ARASAAC
 * Busca y obtiene pictogramas clínicos SIN pasar por Modal/ComfyUI
 * La API de ARASAAC soporta CORS (Access-Control-Allow-Origin: *)
 */

const ARASAAC_API = 'https://api.arasaac.org/v1';
const ARASAAC_STATIC = 'https://static.arasaac.org/pictograms';
const CACHE_PREFIX = 'fonoaudio_arasaac_';
const CACHE_TTL = 3600 * 1000; // 1 hora en ms

export interface ArasaacPictogram {
  id: number;
  label: string;
  keywords: string[];
  categories: string[];
  image_url: string;
  source: 'arasaac';
}

export interface ArasaacSearchResult {
  task_id: string;
  status: string;
  query: string;
  language: string;
  count: number;
  pictograms: ArasaacPictogram[];
  error?: string;
}

export interface ArasaacImageData {
  task_id: string;
  status: string;
  id: number;
  preview_b64?: string;
  width: number;
  height: number;
  source: 'arasaac';
  image_url?: string;
  error?: string;
}

interface CacheEntry<T> {
  data: T;
  ts: number;
}

function getCacheKey(prefix: string, ...args: (string | number)[]): string {
  return `${CACHE_PREFIX}${prefix}:${args.join(':')}`;
}

function getFromCache<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (Date.now() - entry.ts > CACHE_TTL) {
      localStorage.removeItem(key);
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

function setCache<T>(key: string, data: T): void {
  try {
    const entry: CacheEntry<T> = { data, ts: Date.now() };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // localStorage lleno, ignorar silenciosamente
  }
}

export class ArasaacService {
  /**
   * Busca pictogramas por texto en el idioma especificado.
   * Llama DIRECTAMENTE a api.arasaac.org — sin Modal.
   */
  async search(
    query: string,
    lang: string = 'es',
    limit: number = 20,
  ): Promise<ArasaacSearchResult> {
    const ck = getCacheKey('search', query, lang, String(limit));
    const cached = getFromCache<ArasaacSearchResult>(ck);
    if (cached) return cached;

    const encoded = encodeURIComponent(query);
    const url = `${ARASAAC_API}/pictograms/${lang}/bestsearch/${encoded}`;

    const response = await fetch(url);
    if (!response.ok) throw new Error('Error buscando en ARASAAC');

    const results = await response.json();

    // Normalizar resultados
    const pictograms: ArasaacPictogram[] = [];
    for (const item of (Array.isArray(results) ? results : [])) {
      const pid = item._id;
      if (!pid) continue;

      const keywords = item.keywords || [];
      let mainKeyword = '';
      for (const kw of keywords) {
        if (kw.type === 1) {
          mainKeyword = kw.keyword || '';
          break;
        }
      }
      if (!mainKeyword && keywords.length > 0) {
        mainKeyword = keywords[0].keyword || '';
      }

      pictograms.push({
        id: pid,
        label: mainKeyword || String(pid),
        keywords: keywords.slice(0, 5).map((kw: any) => kw.keyword || ''),
        categories: item.categories || [],
        image_url: `${ARASAAC_STATIC}/${pid}/${pid}_500.png`,
        source: 'arasaac',
      });
    }

    const response_result: ArasaacSearchResult = {
      task_id: crypto.randomUUID().slice(0, 8),
      status: 'completed',
      query,
      language: lang,
      count: pictograms.length,
      pictograms: pictograms.slice(0, limit),
    };

    if (response_result.status === 'completed') {
      setCache(ck, response_result);
    }
    return response_result;
  }

  /**
   * Obtiene metadata completa de un pictograma por ID.
   * Llama DIRECTAMENTE a api.arasaac.org — sin Modal.
   */
  async getPictogram(
    pictogramId: number,
    lang: string = 'es',
  ): Promise<ArasaacPictogram | null> {
    const ck = getCacheKey('picto', String(pictogramId), lang);
    const cached = getFromCache<ArasaacPictogram>(ck);
    if (cached) return cached;

    const url = `${ARASAAC_API}/pictograms/${lang}/${pictogramId}`;
    const response = await fetch(url);
    if (!response.ok) return null;

    const data = await response.json();
    const keywords = data.keywords || [];
    let mainKeyword = '';
    for (const kw of keywords) {
      if (kw.type === 1) {
        mainKeyword = kw.keyword || '';
        break;
      }
    }
    if (!mainKeyword && keywords.length > 0) {
      mainKeyword = keywords[0].keyword || '';
    }

    const pictogram: ArasaacPictogram = {
      id: data._id || pictogramId,
      label: mainKeyword || String(pictogramId),
      keywords: keywords.map((kw: any) => kw.keyword || ''),
      categories: data.categories || [],
      image_url: `${ARASAAC_STATIC}/${pictogramId}/${pictogramId}_500.png`,
      source: 'arasaac',
    };

    setCache(ck, pictogram);
    return pictogram;
  }

  /**
   * Obtiene URL directa de imagen ARASAAC.
   * No hace request — solo construye la URL.
   */
  getDirectImageUrl(pictogramId: number, resolution: number = 500): string {
    return `${ARASAAC_STATIC}/${pictogramId}/${pictogramId}_${resolution}.png`;
  }

  /**
   * Obtiene imagen como base64 (necesario para composiciones Pillow).
   * Usa fetch directo a static.arasaac.org — sin Modal.
   */
  async getImage(
    pictogramId: number,
    resolution: number = 500,
    color: boolean = true,
  ): Promise<ArasaacImageData | null> {
    const ck = getCacheKey('img', String(pictogramId), String(resolution), String(color));
    const cached = getFromCache<ArasaacImageData>(ck);
    if (cached) return cached;

    try {
      const suffix = color ? `_${resolution}.png` : `_nocolor_${resolution}.png`;
      const img_url = `${ARASAAC_STATIC}/${pictogramId}/${pictogramId}${suffix}`;

      const response = await fetch(img_url);
      if (!response.ok) return null;

      const blob = await response.blob();
      const b64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(',')[1] || '');
        };
        reader.readAsDataURL(blob);
      });

      const data: ArasaacImageData = {
        task_id: crypto.randomUUID().slice(0, 8),
        status: 'completed',
        id: pictogramId,
        preview_b64: b64,
        width: resolution,
        height: resolution,
        source: 'arasaac',
        image_url: img_url,
      };

      setCache(ck, data);
      return data;
    } catch {
      return null;
    }
  }

  /**
   * Limpia el cache localStorage.
   */
  clearCache(): void {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_PREFIX)) {
        keys.push(key);
      }
    }
    keys.forEach((k) => localStorage.removeItem(k));
  }

  /**
   * Retorna tamaño del cache en entries.
   */
  getCacheSize(): number {
    let count = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_PREFIX)) count++;
    }
    return count;
  }
}

export const arasaacService = new ArasaacService();

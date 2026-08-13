// ============================================================
// Consultorio Configuration Service
// Stores consultorio names, colors, and icons in localStorage
// ============================================================

export interface ConsultorioConfig {
  id: string;
  name: string;
  icon: string;
  color: string;
  googleColorId: string; // Google Calendar color ID (1-11)
}

const STORAGE_KEY = 'fonoaudio_consultorio_config';

const DEFAULT_CONFIG: ConsultorioConfig[] = [
  { id: 'consultorio_1', name: 'Consultorio 1', icon: '🏥', color: 'blue', googleColorId: '1' },
  { id: 'consultorio_2', name: 'Consultorio 2', icon: '🏥', color: 'purple', googleColorId: '2' },
  { id: 'privado', name: 'Privado', icon: '🏢', color: 'emerald', googleColorId: '10' },
  { id: 'online', name: 'Online', icon: '💻', color: 'cyan', googleColorId: '7' },
  { id: 'clinica', name: 'Clínica', icon: '🏨', color: 'amber', googleColorId: '5' },
];

// Google Calendar color palette (ID -> hex)
export const GOOGLE_CALENDAR_COLORS: Record<string, { name: string; hex: string }> = {
  '1': { name: 'Lavanda', hex: '#7986cb' },
  '2': { name: 'Uva', hex: '#8e24aa' },
  '3': { name: 'Lima', hex: '#e67c73' },
  '4': { name: 'Flamenco', hex: '#e67c73' },
  '5': { name: 'Plátano', hex: '#f6bf26' },
  '6': { name: 'Mandarina', hex: '#f4511e' },
  '7': { name: 'Pavo Real', hex: '#039be5' },
  '8': { name: 'Grafito', hex: '#616161' },
  '9': { name: 'Azul Borrego', hex: '#3f51b5' },
  '10': { name: 'Salvia', hex: '#0b8043' },
  '11': { name: 'Tomate', hex: '#d50000' },
};

// Tailwind color classes for UI
export const TAILWIND_COLORS: Record<string, { bg: string; text: string; border: string; light: string }> = {
  blue: { bg: 'bg-blue-500', text: 'text-blue-600', border: 'border-blue-400', light: 'bg-blue-50' },
  purple: { bg: 'bg-purple-500', text: 'text-purple-600', border: 'border-purple-400', light: 'bg-purple-50' },
  emerald: { bg: 'bg-emerald-500', text: 'text-emerald-600', border: 'border-emerald-400', light: 'bg-emerald-50' },
  cyan: { bg: 'bg-cyan-500', text: 'text-cyan-600', border: 'border-cyan-400', light: 'bg-cyan-50' },
  amber: { bg: 'bg-amber-500', text: 'text-amber-600', border: 'border-amber-400', light: 'bg-amber-50' },
  red: { bg: 'bg-red-500', text: 'text-red-600', border: 'border-red-400', light: 'bg-red-50' },
  rose: { bg: 'bg-rose-500', text: 'text-rose-600', border: 'border-rose-400', light: 'bg-rose-50' },
  orange: { bg: 'bg-orange-500', text: 'text-orange-600', border: 'border-orange-400', light: 'bg-orange-50' },
  teal: { bg: 'bg-teal-500', text: 'text-teal-600', border: 'border-teal-400', light: 'bg-teal-50' },
  indigo: { bg: 'bg-indigo-500', text: 'text-indigo-600', border: 'border-indigo-400', light: 'bg-indigo-50' },
};

export const ConsultorioConfigService = {
  getAll(): ConsultorioConfig[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Merge with defaults to ensure new fields exist
        return DEFAULT_CONFIG.map(def => {
          const custom = parsed.find((c: ConsultorioConfig) => c.id === def.id);
          return custom ? { ...def, ...custom } : def;
        });
      }
    } catch {}
    return [...DEFAULT_CONFIG];
  },

  getById(id: string): ConsultorioConfig | undefined {
    return this.getAll().find(c => c.id === id);
  },

  save(config: ConsultorioConfig[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  },

  updateName(id: string, name: string): void {
    const config = this.getAll();
    const idx = config.findIndex(c => c.id === id);
    if (idx !== -1) {
      config[idx].name = name;
      this.save(config);
    }
  },

  updateColor(id: string, color: string, googleColorId: string): void {
    const config = this.getAll();
    const idx = config.findIndex(c => c.id === id);
    if (idx !== -1) {
      config[idx].color = color;
      config[idx].googleColorId = googleColorId;
      this.save(config);
    }
  },

  updateIcon(id: string, icon: string): void {
    const config = this.getAll();
    const idx = config.findIndex(c => c.id === id);
    if (idx !== -1) {
      config[idx].icon = icon;
      this.save(config);
    }
  },

  getGoogleColorId(consultorioId: string): string {
    const config = this.getById(consultorioId);
    return config?.googleColorId || '1';
  },

  getColorHex(consultorioId: string): string {
    const config = this.getById(consultorioId);
    return GOOGLE_CALENDAR_COLORS[config?.googleColorId || '1']?.hex || '#7986cb';
  },
};

export interface UserSettings {
  appearance: {
    theme: 'light' | 'dark' | 'system';
    density: 'compact' | 'normal' | 'comfortable';
  };
  assistant: {
    voiceSpeed: number;
    voiceTone: 'neutral' | 'professional' | 'warm';
    voiceLanguage: string;
    proactivity: 'minimal' | 'balanced' | 'proactive';
    chatPersistence: boolean;
    contextAwareness: boolean;
    permissions: {
      canAccessAgenda: boolean;
      canAccessPatients: boolean;
      canAccessHistory: boolean;
      canAccessDatabase: boolean;
      canCreateSuggestions: boolean;
      canAutoAlert: boolean;
    };
  };
  integrations: {
    googleCalendar: { enabled: boolean; connected: boolean };
    telegram: {
      enabled: boolean;
      connected: boolean;
      allowedTypes: ('text' | 'voice' | 'image' | 'video' | 'file')[];
      botToken?: string;
      chatId?: string;
    };
  };
  profile: {
    professionalName: string;
    specialty: string;
    licenseNumber: string;
    signature: string;
    consultorioName: string;
    avatarUrl: string;
  };
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  appearance: {
    theme: 'system',
    density: 'normal',
  },
  assistant: {
    voiceSpeed: 1.0,
    voiceTone: 'neutral',
    voiceLanguage: 'es-AR',
    proactivity: 'balanced',
    chatPersistence: true,
    contextAwareness: true,
    permissions: {
      canAccessAgenda: true,
      canAccessPatients: true,
      canAccessHistory: true,
      canAccessDatabase: true,
      canCreateSuggestions: true,
      canAutoAlert: true,
    },
  },
  integrations: {
    googleCalendar: { enabled: false, connected: false },
    telegram: {
      enabled: false,
      connected: false,
      allowedTypes: ['text', 'voice'],
    },
  },
  profile: {
    professionalName: '',
    specialty: 'Fonoaudiología',
    licenseNumber: '',
    signature: '',
    consultorioName: '',
    avatarUrl: '',
  },
};

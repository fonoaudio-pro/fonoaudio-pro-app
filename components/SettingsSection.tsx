import React, { useState, useEffect } from 'react';
import {
  Sun, Moon, Monitor, Mic, Brain, Link, User, ChevronRight,
  Save, Check, AlertCircle, MessageSquare, Camera,
  FileText, Volume2, Eye, Bell, Calendar,
  Send, Wifi, WifiOff, Sparkles
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useSettings } from '../context/SettingsContext';
import { TelegramService } from '../services/TelegramService';
import { GoogleAuthService } from '../services/GoogleAuthService';

type TabId = 'appearance' | 'assistant' | 'integrations' | 'profile';

interface Tab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const tabs: Tab[] = [
  { id: 'appearance', label: 'Apariencia', icon: <Sun size={18} />, description: 'Tema y densidad' },
  { id: 'assistant', label: 'Asistente IA', icon: <Mic size={18} />, description: 'Voz, chat y contexto' },
  { id: 'integrations', label: 'Integraciones', icon: <Link size={18} />, description: 'Calendar, Telegram' },
  { id: 'profile', label: 'Perfil Clínico', icon: <User size={18} />, description: 'Datos del consultorio' },
];

const SaveIndicator: React.FC<{ status: string; lastSaved: Date | null }> = ({ status, lastSaved }) => {
  if (status === 'saving') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
        <Save size={12} className="animate-pulse" /> Guardando…
      </span>
    );
  }
  if (status === 'saved') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
        <Check size={12} /> Guardado
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
        <AlertCircle size={12} /> Error al guardar
      </span>
    );
  }
  if (lastSaved) {
    return (
      <span className="text-xs text-slate-400 dark:text-slate-500">
        Último guardado: {lastSaved.toLocaleTimeString('es-AR')}
      </span>
    );
  }
  return null;
};

const SettingsSection: React.FC<{ isGoogleConnected?: boolean }> = ({ isGoogleConnected = false }) => {
  const [activeTab, setActiveTab] = useState<TabId>('appearance');
  const { theme, setTheme } = useTheme();
  const { settings, update, status, lastSaved } = useSettings();

  useEffect(() => {
    const tg = settings.integrations?.telegram;
    if (tg?.botToken && tg.connected) {
      TelegramService.configure(tg.botToken, tg.chatId);
    }
  }, [settings.integrations?.telegram?.botToken, settings.integrations?.telegram?.connected, settings.integrations?.telegram?.chatId]);

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-950">
      <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-white">Configuración</h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">Personaliza tu experiencia de uso</p>
        </div>
        <SaveIndicator status={status} lastSaved={lastSaved} />
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Sidebar de tabs */}
        <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 shrink-0">
          <div className="md:hidden p-3">
            <select
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value as TabId)}
              className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-700 dark:text-white"
            >
              {tabs.map(t => (
                <option key={t.id} value={t.id}>{t.label} — {t.description}</option>
              ))}
            </select>
          </div>
          <nav className="hidden md:flex flex-col p-3 space-y-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-3 w-full p-3 rounded-xl text-left transition-all ${
                  activeTab === tab.id
                    ? 'bg-white dark:bg-slate-800 shadow-sm text-blue-600 dark:text-blue-400'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-slate-800/50'
                }`}
              >
                <span className={activeTab === tab.id ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}>
                  {tab.icon}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold truncate">{tab.label}</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{tab.description}</p>
                </div>
                <ChevronRight size={14} className="ml-auto text-slate-300 dark:text-slate-600 shrink-0" />
              </button>
            ))}
          </nav>
        </div>

        {/* Panel de contenido */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {activeTab === 'appearance' && <AppearancePanel theme={theme} setTheme={setTheme} density={settings.appearance.density} onDensityChange={(d) => update('appearance', { density: d })} />}
          {activeTab === 'assistant' && <AssistantPanel settings={settings} onUpdate={update} />}
          {activeTab === 'integrations' && <IntegrationsPanel settings={settings} onUpdate={update} isGoogleConnected={isGoogleConnected} />}
          {activeTab === 'profile' && <ProfilePanel settings={settings} onUpdate={update} />}
        </div>
      </div>
    </div>
  );
};

/* ─── Tab 1: Apariencia ─── */
function AppearancePanel({ theme, setTheme, density, onDensityChange }: {
  theme: string; setTheme: (t: any) => void;
  density: string; onDensityChange: (d: 'compact' | 'normal' | 'comfortable') => void;
}) {
  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1">Tema</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Selecciona el tema visual de la aplicación</p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { value: 'light', icon: Sun, label: 'Claro', desc: 'Fondo blanco' },
            { value: 'dark', icon: Moon, label: 'Oscuro', desc: 'Protege la vista' },
            { value: 'system', icon: Monitor, label: 'Sistema', desc: 'Automático' },
          ].map(({ value, icon: Icon, label, desc }) => (
            <button
              key={value}
              onClick={() => setTheme(value)}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                theme === value
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-sm'
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <Icon size={20} className={`mb-2 ${theme === value ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}`} />
              <p className="text-sm font-bold text-slate-800 dark:text-white">{label}</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">{desc}</p>
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1">Densidad</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Controla el espaciado de la interfaz</p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { value: 'compact', label: 'Compacto', desc: 'Más contenido visible' },
            { value: 'normal', label: 'Normal', desc: 'Equilibrado' },
            { value: 'comfortable', label: 'Cómodo', desc: 'Más espacio' },
          ].map(({ value, label, desc }) => (
            <button
              key={value}
              onClick={() => onDensityChange(value as any)}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                density === value
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-sm'
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <p className="text-sm font-bold text-slate-800 dark:text-white">{label}</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">{desc}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Tab 2: Asistente IA ─── */
function AssistantPanel({ settings, onUpdate }: { settings: any; onUpdate: any }) {
  const { assistant } = settings;
  const perms = assistant.permissions;

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Voz */}
      <div>
        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1">Voz del Asistente</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Configura cómo Fono-Pro AI se comunica por voz</p>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Velocidad de lectura: <span className="text-blue-600 dark:text-blue-400 font-bold">{assistant.voiceSpeed.toFixed(1)}x</span>
            </label>
            <input
              type="range" min="0.5" max="2.0" step="0.1"
              value={assistant.voiceSpeed}
              onChange={(e) => onUpdate('assistant', { voiceSpeed: parseFloat(e.target.value) })}
              className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-500 mt-1">
              <span>Lento (0.5x)</span><span>Normal (1.0x)</span><span>Rápido (2.0x)</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Tono de voz</label>
              <select
                value={assistant.voiceTone}
                onChange={(e) => onUpdate('assistant', { voiceTone: e.target.value })}
                className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-700 dark:text-white"
              >
                <option value="neutral">Neutral</option>
                <option value="professional">Profesional</option>
                <option value="warm">Cálido</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Idioma</label>
              <select
                value={assistant.voiceLanguage}
                onChange={(e) => onUpdate('assistant', { voiceLanguage: e.target.value })}
                className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-700 dark:text-white"
              >
                <option value="es-AR">Español (AR)</option>
                <option value="es-ES">Español (ES)</option>
                <option value="pt-BR">Portugués (BR)</option>
                <option value="en-US">English (US)</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Chat y contexto */}
      <div>
        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1">Chat y Contexto</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Define el comportamiento del asistente</p>
        <div className="space-y-3">
          <ToggleRow
            icon={<MessageSquare size={16} />}
            label="Persistencia del chat"
            description="Mantener historial de conversación entre sesiones"
            checked={assistant.chatPersistence}
            onChange={(v) => onUpdate('assistant', { chatPersistence: v })}
          />
          <ToggleRow
            icon={<Brain size={16} />}
            label="Conciencia contextual"
            description="Usar agenda, pacientes e historial para respuestas"
            checked={assistant.contextAwareness}
            onChange={(v) => onUpdate('assistant', { contextAwareness: v })}
          />
        </div>
      </div>

      {/* Proactividad */}
      <div>
        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1">Proactividad</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Cuánta initiative toma el asistente</p>
        <div className="space-y-2">
          {[
            { value: 'minimal', label: 'Mínimo', desc: 'Solo responde cuando se le pide', icon: <Mic size={16} /> },
            { value: 'balanced', label: 'Balanceado', desc: 'Sugiere acciones relevantes', icon: <Brain size={16} /> },
            { value: 'proactive', label: 'Proactivo', desc: 'Anticipa necesidades y propone planes', icon: <Sparkles size={16} /> },
          ].map(({ value, label, desc, icon }) => (
            <label
              key={value}
              className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                assistant.proactivity === value
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <input
                type="radio" name="proactivity" value={value}
                checked={assistant.proactivity === value}
                onChange={(e) => onUpdate('assistant', { proactivity: e.target.value })}
                className="w-4 h-4 text-blue-600 accent-blue-600"
              />
              <span className={assistant.proactivity === value ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'}>
                {icon}
              </span>
              <div>
                <p className="text-sm font-bold text-slate-800 dark:text-white">{label}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{desc}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Permisos */}
      <div>
        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1">Permisos del Asistente</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Qué datos puede acceder y acciones que puede realizar</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ToggleRow
            icon={<Calendar size={16} />}
            label="Acceder a agenda"
            description="Ver citas y disponibilidad"
            checked={perms.canAccessAgenda}
            onChange={(v) => onUpdate('assistant', { permissions: { ...perms, canAccessAgenda: v } })}
          />
          <ToggleRow
            icon={<User size={16} />}
            label="Acceder a pacientes"
            description="Ver datos clínicos y contacto"
            checked={perms.canAccessPatients}
            onChange={(v) => onUpdate('assistant', { permissions: { ...perms, canAccessPatients: v } })}
          />
          <ToggleRow
            icon={<FileText size={16} />}
            label="Acceder a historial"
            description="Ver evolución y sesiones previas"
            checked={perms.canAccessHistory}
            onChange={(v) => onUpdate('assistant', { permissions: { ...perms, canAccessHistory: v } })}
          />
          <ToggleRow
            icon={<Eye size={16} />}
            label="Acceder a base de datos"
            description="Consultar materiales y configuración"
            checked={perms.canAccessDatabase}
            onChange={(v) => onUpdate('assistant', { permissions: { ...perms, canAccessDatabase: v } })}
          />
          <ToggleRow
            icon={<Sparkles size={16} />}
            label="Crear sugerencias"
            description="Proponer materiales y tratamientos"
            checked={perms.canCreateSuggestions}
            onChange={(v) => onUpdate('assistant', { permissions: { ...perms, canCreateSuggestions: v } })}
          />
          <ToggleRow
            icon={<Bell size={16} />}
            label="Alertas automáticas"
            description="Notificar eventos importantes"
            checked={perms.canAutoAlert}
            onChange={(v) => onUpdate('assistant', { permissions: { ...perms, canAutoAlert: v } })}
          />
        </div>
      </div>
    </div>
  );
}

/* ─── Tab 3: Integraciones ─── */
function IntegrationsPanel({ settings, onUpdate, isGoogleConnected }: { settings: any; onUpdate: any; isGoogleConnected: boolean }) {
  const integrations = settings.integrations || {};
  const telegram = integrations.telegram || { enabled: false, connected: false, botToken: '', chatId: '' };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Google Calendar */}
      <div>
        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1">Google Calendar</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Sincroniza tus citas con el calendario de Google</p>
        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                <Calendar size={20} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-800 dark:text-white">Google Calendar</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">Consulta y crea eventos</p>
              </div>
            </div>
            {isGoogleConnected ? (
              <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 rounded-full">
                <Wifi size={12} /> Conectado
              </span>
            ) : (
              <button
                onClick={async () => {
                  try {
                    await GoogleAuthService.signInWithGoogle();
                  } catch (e: any) {
                    alert('Error conectando con Google: ' + e.message);
                  }
                }}
                className="flex items-center gap-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 px-3 py-2 rounded-xl transition-colors shadow-sm"
              >
                Conectar Google (Gmail / Calendar)
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Telegram — Integración real */}
      <div>
        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1">Canal Telegram</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
          Configurá el bot de Telegram para enviar notificaciones y mensajes a pacientes
        </p>
        <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-sky-100 dark:bg-sky-900/30 rounded-xl flex items-center justify-center shrink-0">
              <Send size={20} className="text-sky-600 dark:text-sky-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm font-bold text-slate-800 dark:text-white">Telegram Bot</p>
                {TelegramService.isConfigured() ? (
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full">
                    Configurado
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">
                    Pendiente
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                Creá un bot con @BotFather y pegá el token aquí. Los mensajes se enviarán desde ese bot.
              </p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Bot Token</label>
                  <input
                    type="text"
                    value={telegram.botToken || ''}
                    onChange={(e) => onUpdate('integrations', { telegram: { ...telegram, botToken: e.target.value } })}
                    placeholder="123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
                    className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-700 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:focus:ring-sky-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Chat ID destino (opcional)</label>
                  <input
                    type="text"
                    value={telegram.chatId || ''}
                    onChange={(e) => onUpdate('integrations', { telegram: { ...telegram, chatId: e.target.value } })}
                    placeholder="-1001234567890"
                    className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-700 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:focus:ring-sky-400"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      const hasToken = !!telegram.botToken?.trim();
                      onUpdate('integrations', { telegram: { ...telegram, enabled: hasToken, connected: hasToken } });
                    }}
                    className="px-3 py-1.5 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-lg transition-colors"
                  >
                    {telegram.connected ? 'Actualizar' : 'Guardar'}
                  </button>
                  {telegram.connected && (
                    <button
                      onClick={() => onUpdate('integrations', { telegram: { enabled: false, connected: false, botToken: '', chatId: '' } })}
                      className="px-3 py-1.5 text-xs font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                    >
                      Desconectar
                    </button>
                  )}
                </div>
                {telegram.botToken && !telegram.connected && (
                  <p className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <AlertCircle size={10} /> Guardá el token y hacé clic en "Guardar" para activar
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Tab 4: Perfil Clínico ─── */
function ProfilePanel({ settings, onUpdate }: { settings: any; onUpdate: any }) {
  const { profile } = settings;

  const updateField = (field: string, value: string) => {
    onUpdate('profile', { [field]: value });
  };

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1">Datos del Consultorio</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Información que aparece en informes y documentos</p>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FieldInput
              label="Nombre del Profesional"
              value={profile.professionalName}
              placeholder="Dr. Juan Pérez"
              onChange={(v) => updateField('professionalName', v)}
            />
            <FieldInput
              label="Especialidad"
              value={profile.specialty}
              placeholder="Fonoaudiología"
              onChange={(v) => updateField('specialty', v)}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FieldInput
              label="Número de Matrícula"
              value={profile.licenseNumber}
              placeholder="MN-12345"
              onChange={(v) => updateField('licenseNumber', v)}
            />
            <FieldInput
              label="Nombre del Consultorio"
              value={profile.consultorioName}
              placeholder="Consultorio Fono"
              onChange={(v) => updateField('consultorioName', v)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Firma para Informes</label>
            <textarea
              value={profile.signature}
              placeholder="Atentamente,&#10;Dr. Juan Pérez - Fonoaudiólogo"
              rows={3}
              onChange={(e) => updateField('signature', e.target.value)}
              className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-700 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 resize-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Shared UI atoms ─── */
function ToggleRow({ icon, label, description, checked, onChange }: {
  icon: React.ReactNode; label: string; description: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
      <span className="text-slate-400 dark:text-slate-500">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-800 dark:text-white">{label}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{description}</p>
      </div>
      <div className="relative">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <div className={`w-10 h-6 rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-600'}`}>
          <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${checked ? 'translate-x-4' : ''}`} />
        </div>
      </div>
    </label>
  );
}

function FieldInput({ label, value, placeholder, onChange }: {
  label: string; value: string; placeholder: string; onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{label}</label>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-700 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500"
      />
    </div>
  );
}

export default SettingsSection;

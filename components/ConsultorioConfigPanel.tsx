import React, { useState, useEffect } from 'react';
import { Settings, Check, X, Palette } from 'lucide-react';
import {
  ConsultorioConfig,
  ConsultorioConfigService,
  GOOGLE_CALENDAR_COLORS,
  TAILWIND_COLORS,
} from '../services/ConsultorioConfigService';

interface ConsultorioConfigPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: () => void;
}

const COLOR_OPTIONS = Object.keys(TAILWIND_COLORS);

export const ConsultorioConfigPanel: React.FC<ConsultorioConfigPanelProps> = ({
  isOpen,
  onClose,
  onSave,
}) => {
  const [config, setConfig] = useState<ConsultorioConfig[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [showColorPicker, setShowColorPicker] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setConfig(ConsultorioConfigService.getAll());
    }
  }, [isOpen]);

  const handleSaveName = (id: string) => {
    if (editName.trim()) {
      ConsultorioConfigService.updateName(id, editName.trim());
      setConfig(ConsultorioConfigService.getAll());
    }
    setEditingId(null);
  };

  const handleSaveColor = (id: string, color: string, googleColorId: string) => {
    ConsultorioConfigService.updateColor(id, color, googleColorId);
    setConfig(ConsultorioConfigService.getAll());
    setShowColorPicker(null);
    onSave?.();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Settings size={20} className="text-slate-600" />
            <h3 className="font-bold text-slate-800">Configurar Consultorios</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded-lg">
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
          {config.map(c => {
            const twColor = TAILWIND_COLORS[c.color] || TAILWIND_COLORS.blue;
            const gColor = GOOGLE_CALENDAR_COLORS[c.googleColorId];

            return (
              <div
                key={c.id}
                className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors"
              >
                {/* Color indicator */}
                <div className="relative">
                  <button
                    onClick={() => setShowColorPicker(showColorPicker === c.id ? null : c.id)}
                    className={`w-10 h-10 rounded-xl ${twColor.bg} flex items-center justify-center text-white text-lg shadow-sm hover:scale-105 transition-transform`}
                    title="Cambiar color"
                  >
                    {c.icon}
                  </button>

                  {showColorPicker === c.id && (
                    <div className="absolute top-12 left-0 z-10 bg-white rounded-xl shadow-xl border border-slate-200 p-3 w-64">
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Color del consultorio</p>
                      <div className="grid grid-cols-5 gap-2 mb-3">
                        {COLOR_OPTIONS.map(colorKey => {
                          const tc = TAILWIND_COLORS[colorKey];
                          return (
                            <button
                              key={colorKey}
                              onClick={() => {
                                // Find matching Google color ID
                                const googleId = Object.entries(GOOGLE_CALENDAR_COLORS).find(
                                  ([, v]) => v.name.toLowerCase() === colorKey.toLowerCase()
                                )?.[0] || '1';
                                handleSaveColor(c.id, colorKey, googleId);
                              }}
                              className={`w-8 h-8 rounded-lg ${tc.bg} ${c.color === colorKey ? 'ring-2 ring-offset-2 ring-slate-400' : ''} hover:scale-110 transition-transform`}
                              title={colorKey}
                            />
                          );
                        })}
                      </div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Color en Google Calendar</p>
                      <div className="grid grid-cols-6 gap-1">
                        {Object.entries(GOOGLE_CALENDAR_COLORS).map(([id, { name, hex }]) => (
                          <button
                            key={id}
                            onClick={() => {
                              ConsultorioConfigService.updateColor(c.id, c.color, id);
                              setConfig(ConsultorioConfigService.getAll());
                              setShowColorPicker(null);
                              onSave?.();
                            }}
                            className={`w-7 h-7 rounded-md ${c.googleColorId === id ? 'ring-2 ring-offset-1 ring-slate-400' : ''} hover:scale-110 transition-transform`}
                            style={{ backgroundColor: hex }}
                            title={`${name} (${id})`}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Name */}
                <div className="flex-1">
                  {editingId === c.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        autoFocus
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSaveName(c.id)}
                        className="flex-1 p-1.5 bg-slate-50 border border-slate-300 rounded-lg text-sm outline-none focus:border-blue-400"
                      />
                      <button onClick={() => handleSaveName(c.id)} className="p-1 text-green-600 hover:bg-green-50 rounded">
                        <Check size={16} />
                      </button>
                      <button onClick={() => setEditingId(null)} className="p-1 text-slate-400 hover:bg-slate-100 rounded">
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <div
                      className="cursor-pointer hover:bg-slate-50 p-1 rounded-lg -m-1"
                      onClick={() => {
                        setEditingId(c.id);
                        setEditName(c.name);
                      }}
                    >
                      <p className="text-sm font-bold text-slate-800">{c.name}</p>
                      <p className="text-[10px] text-slate-400">
                        Google: {gColor?.name || 'N/A'} • Color: {c.color}
                      </p>
                    </div>
                  )}
                </div>

                {/* Edit button */}
                <button
                  onClick={() => {
                    setEditingId(c.id);
                    setEditName(c.name);
                  }}
                  className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <Palette size={16} />
                </button>
              </div>
            );
          })}
        </div>

        <div className="p-5 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-xl font-medium text-sm hover:bg-blue-700 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConsultorioConfigPanel;

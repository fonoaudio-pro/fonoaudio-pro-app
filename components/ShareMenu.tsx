import React, { useState } from 'react';
import { Download, FileText, Printer, MessageCircle, Mail, Share2, Loader2, X } from 'lucide-react';
import { downloadPng, downloadPdf, printMaterial, shareWhatsApp, shareEmail, shareNative, ShareMaterialInput } from '../utils/shareMaterial';

interface ShareMenuProps {
  material: ShareMaterialInput;
  isOpen: boolean;
  onClose: () => void;
  compact?: boolean;
}

export default function ShareMenu({ material, isOpen, onClose, compact }: ShareMenuProps) {
  const [loading, setLoading] = useState<string | null>(null);

  const handleAction = async (action: string, fn: () => Promise<void> | void) => {
    setLoading(action);
    try {
      await fn();
    } catch (e) {
      console.error(`Share error (${action}):`, e);
    } finally {
      setLoading(null);
      if (!compact) onClose();
    }
  };

  if (!isOpen) return null;

  const actions = [
    {
      key: 'png',
      icon: Download,
      label: 'Descargar PNG',
      color: 'text-blue-600 bg-blue-50 hover:bg-blue-100',
      fn: () => downloadPng(material),
    },
    {
      key: 'pdf',
      icon: FileText,
      label: 'Descargar PDF',
      color: 'text-red-600 bg-red-50 hover:bg-red-100',
      fn: () => downloadPdf(material),
    },
    {
      key: 'print',
      icon: Printer,
      label: 'Imprimir',
      color: 'text-purple-600 bg-purple-50 hover:bg-purple-100',
      fn: () => printMaterial(material),
    },
    {
      key: 'whatsapp',
      icon: MessageCircle,
      label: 'WhatsApp',
      color: 'text-emerald-600 bg-emerald-50 hover:bg-emerald-100',
      fn: () => shareWhatsApp(material),
    },
    {
      key: 'email',
      icon: Mail,
      label: 'Email',
      color: 'text-orange-600 bg-orange-50 hover:bg-orange-100',
      fn: () => shareEmail(material),
    },
    {
      key: 'share',
      icon: Share2,
      label: 'Compartir',
      color: 'text-slate-600 bg-slate-50 hover:bg-slate-100',
      fn: () => shareNative(material),
    },
  ];

  if (compact) {
    return (
      <div className="relative">
        <button
          onClick={() => {
            const event = new CustomEvent('toggle-share-menu', { detail: material.title });
            window.dispatchEvent(event);
          }}
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
          title="Compartir"
        >
          <Share2 size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-800 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-4 py-3 border-b dark:border-slate-700 flex items-center justify-between">
          <h3 className="font-bold text-slate-800 dark:text-white text-sm">Compartir Material</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
            <X size={18} />
          </button>
        </div>

        <div className="p-3">
          <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3 mb-3">
            <p className="text-xs font-bold text-slate-700 dark:text-white truncate">{material.title}</p>
            {material.clinicalArea && (
              <p className="text-[10px] text-slate-400 mt-0.5">{material.clinicalArea}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            {actions.map(action => (
              <button
                key={action.key}
                onClick={() => handleAction(action.key, action.fn)}
                disabled={loading !== null}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all disabled:opacity-50 ${action.color}`}
              >
                {loading === action.key ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <action.icon size={14} />
                )}
                {action.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

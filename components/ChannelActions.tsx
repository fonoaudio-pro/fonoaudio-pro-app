import React, { useState } from 'react';
import { Send, ScanLine, FileText, Loader2, CheckCircle2, MessageSquare } from 'lucide-react';
import { TelegramService } from '../services/TelegramService';
import { ScannerService } from '../services/ScannerService';
import { TelegramMessage, ScannedDocument } from '../types/channels';

interface ChannelActionsProps {
  patientId: string;
  patientName: string;
  userId: string;
  userName: string;
  onDocumentScanned?: (doc: ScannedDocument) => void;
  onMessageSent?: (msg: TelegramMessage) => void;
}

export function ChannelActions({
  patientId, patientName, userId, userName,
  onDocumentScanned, onMessageSent
}: ChannelActionsProps) {
  const [telegramLoading, setTelegramLoading] = useState(false);
  const [scannerLoading, setScannerLoading] = useState(false);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [showTelegramMenu, setShowTelegramMenu] = useState(false);

  const handleSendRecommendation = async () => {
    setTelegramLoading(true);
    setShowTelegramMenu(false);
    try {
      const msg = await TelegramService.sendMessage({
        patientId,
        patientName,
        userId,
        userName,
        content: `📋 Recomendación clínica para ${patientName}:\n\nSe ha actualizado la historia clínica del paciente. Por favor revise los cambios en la plataforma.`,
        messageType: 'recommendation',
        metadata: { type: 'clinical_recommendation' },
      });
      setLastAction('telegram');
      onMessageSent?.(msg);
      setTimeout(() => setLastAction(null), 3000);
    } catch (e) {
      console.error('[ChannelActions] Telegram error:', e);
    }
    setTelegramLoading(false);
  };

  const handleSendAlert = async () => {
    setTelegramLoading(true);
    setShowTelegramMenu(false);
    try {
      const msg = await TelegramService.sendAlert({
        patientId,
        patientName,
        userId,
        userName,
        alertTitle: 'Seguimiento pendiente',
        alertMessage: `El paciente ${patientName} tiene un seguimiento pendiente. Por favor revise el historial clínico.`,
        severity: 'warning',
      });
      setLastAction('telegram');
      onMessageSent?.(msg);
      setTimeout(() => setLastAction(null), 3000);
    } catch (e) {
      console.error('[ChannelActions] Telegram alert error:', e);
    }
    setTelegramLoading(false);
  };

  const handleScanDocument = async () => {
    setScannerLoading(true);
    try {
      const doc = await ScannerService.scanDocument({
        patientId,
        patientName,
        userId,
        userName,
        documentType: 'evaluation',
      });
      setLastAction('scanner');
      onDocumentScanned?.(doc);
      setTimeout(() => setLastAction(null), 3000);
    } catch (e) {
      console.error('[ChannelActions] Scanner error:', e);
    }
    setScannerLoading(false);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap" data-testid="channel-actions">
      {/* Telegram Button */}
      <div className="relative">
        <button
          onClick={() => setShowTelegramMenu(!showTelegramMenu)}
          disabled={telegramLoading}
          data-testid="telegram-send-button"
          className="px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors flex items-center gap-1.5 disabled:opacity-50"
        >
          {telegramLoading ? (
            <Loader2 size={12} className="animate-spin" />
          ) : lastAction === 'telegram' ? (
            <CheckCircle2 size={12} className="text-emerald-500" />
          ) : (
            <Send size={12} />
          )}
          Enviar por Telegram
          <span className="px-1 py-0.5 text-[8px] font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 rounded ml-0.5">STUB</span>
        </button>

        {showTelegramMenu && (
          <div className="absolute top-full left-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-10 w-56" data-testid="telegram-menu">
            <button
              onClick={handleSendRecommendation}
              className="w-full px-3 py-2 text-left text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 rounded-t-lg"
              data-testid="telegram-send-recommendation"
            >
              <FileText size={12} className="text-blue-500" />
              Recomendación clínica
            </button>
            <button
              onClick={handleSendAlert}
              className="w-full px-3 py-2 text-left text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 rounded-b-lg border-t border-slate-100 dark:border-slate-700"
              data-testid="telegram-send-alert"
            >
              <MessageSquare size={12} className="text-amber-500" />
              Alerta de seguimiento
            </button>
          </div>
        )}
      </div>

      {/* Scanner Button */}
      <button
        onClick={handleScanDocument}
        disabled={scannerLoading}
        data-testid="scanner-button"
        className="px-3 py-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors flex items-center gap-1.5 disabled:opacity-50"
      >
        {scannerLoading ? (
          <Loader2 size={12} className="animate-spin" />
        ) : lastAction === 'scanner' ? (
          <CheckCircle2 size={12} className="text-emerald-500" />
        ) : (
          <ScanLine size={12} />
        )}
        Escanear Documento
        <span className="px-1 py-0.5 text-[8px] font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 rounded ml-0.5">STUB</span>
      </button>
    </div>
  );
}

export function ScannedDocumentsList({ patientId }: { patientId: string }) {
  const [docs, setDocs] = useState<ScannedDocument[]>([]);

  React.useEffect(() => {
    setDocs(ScannerService.getDocumentsForPatient(patientId));
  }, [patientId]);

  if (docs.length === 0) return null;

  return (
    <div className="mt-3" data-testid="scanned-documents-list">
      <h4 className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1">
        <ScanLine size={12} />
        Documentos Escaneados ({docs.length})
      </h4>
      <div className="space-y-2">
        {docs.map(doc => (
          <div
            key={doc.id}
            className="p-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-center justify-between"
            data-testid="scanned-document-item"
          >
            <div className="flex items-center gap-2">
              <FileText size={14} className="text-emerald-600 dark:text-emerald-400" />
              <div>
                <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{doc.file_name}</p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500">
                  {(doc.file_size / 1024).toFixed(1)} KB · {doc.file_type.split('/')[1].toUpperCase()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <span className="px-1.5 py-0.5 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 rounded-full">
                {doc.status.toUpperCase()}
              </span>
              {doc.ocr_text && (
                <span className="px-1.5 py-0.5 text-[9px] font-bold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                  OCR
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MessageSquare, Send, Image, Mic, Video, FileText, Bot, User, RefreshCw, Settings, Loader2, Check, AlertCircle, Paperclip, Save, File, ClipboardList, Filter, X } from 'lucide-react';
import { TelegramService, TelegramIncomingMessage } from '../services/TelegramService';
import { TelegramMessage } from '../types/channels';
import { useSettings } from '../context/SettingsContext';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

interface TelegramInboxProps {
  onNavigateToSettings?: () => void;
  onNavigate?: (view: string) => void;
  userId?: string;
  patients?: any[];
  onSelectPatient?: (patient: any) => void;
}

interface PendingFile {
  file_id: string;
  file_name: string;
  mime_type: string;
  media_type: string;
  analysis: string;
  suggestions: any;
  patients: { id: string; name: string; diagnosis: string; age: number }[];
  timestamp: string;
  // Audio-specific fields
  transcription?: string;
  intent?: string;
  action_suggested?: string;
  patient_detected?: string;
  matched_patient?: { id: string; name: string; diagnosis: string } | null;
}

const MEDIA_ICONS: Record<string, React.ReactNode> = {
  image: <Image size={12} className="text-green-500" />,
  audio: <Mic size={12} className="text-purple-500" />,
  video: <Video size={12} className="text-red-500" />,
  document: <FileText size={12} className="text-blue-500" />,
};

const TelegramInbox: React.FC<TelegramInboxProps> = ({ onNavigateToSettings, onNavigate, userId, patients = [], onSelectPatient }) => {
  const [messages, setMessages] = useState<TelegramMessage[]>([]);
  const [replyText, setReplyText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<string>('');
  const [tokenInput, setTokenInput] = useState('');
  const [chatIdInput, setChatIdInput] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [pendingFile, setPendingFile] = useState<PendingFile | null>(null);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [isSendingFile, setIsSendingFile] = useState(false);
  const [actionConfirmation, setActionConfirmation] = useState<string | null>(null);
  const [filterPatient, setFilterPatient] = useState<string>('');
  const [filterDate, setFilterDate] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [visibleCount, setVisibleCount] = useState(30);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { settings, update } = useSettings();

  const isConfigured = TelegramService.isConfigured();
  const chatId = settings.integrations?.telegram?.chatId || '';

  // Match incoming message sender to a patient
  const matchPatient = (senderName: string) => {
    if (!patients || patients.length === 0) return null;
    const lower = senderName.toLowerCase();
    return patients.find(p => p.name.toLowerCase().includes(lower) || lower.includes(p.name.toLowerCase())) || null;
  };

  useEffect(() => {
    loadMessages();
    if (isConfigured) {
      TelegramService.startPolling(handleIncomingMessage);
      checkPendingFile();
    }
    return () => TelegramService.stopPolling();
  }, [isConfigured]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isConfigured) {
      const tg = settings.integrations?.telegram || {};
      setTokenInput(tg.botToken || '');
      setChatIdInput(tg.chatId || '');
    }
  }, [isConfigured]);

  const loadMessages = () => {
    setMessages(TelegramService.getAllMessages().slice(0, 50));
  };

  const checkPendingFile = async () => {
    if (!chatId) return;
    try {
      const resp = await fetch(`${BACKEND_URL}/api/telegram/pending-file/${chatId}`);
      const data = await resp.json();
      setPendingFile(data.pending || null);
    } catch { /* ignore */ }
  };

  const handleIncomingMessage = async (msg: TelegramIncomingMessage) => {
    loadMessages();
    checkPendingFile();
    if (isConfigured) {
      await processIncomingMessage(msg);
    }
  };

  const processIncomingMessage = async (msg: TelegramIncomingMessage) => {
    const hasMedia = !!(msg.photo || msg.audio || msg.video || msg.document || msg.voice);
    const mediaType = msg.photo ? 'photo' : msg.audio || msg.voice ? 'audio' : msg.video ? 'video' : msg.document ? 'document' : 'text';
    const text = msg.text || msg.caption || '';

    setIsGenerating(true);
    setProcessingStatus(hasMedia ? `Procesando ${mediaType} con IA...` : 'Generando respuesta...');

    try {
      if (hasMedia) {
        let fileId = '';
        if (msg.photo) {
          fileId = msg.photo[msg.photo.length - 1]?.file_id || '';
        } else if (msg.audio) {
          fileId = msg.audio.file_id;
        } else if (msg.voice) {
          fileId = msg.voice.file_id;
        } else if (msg.video) {
          fileId = msg.video.file_id;
        } else if (msg.document) {
          fileId = msg.document.file_id;
        }

        if (fileId) {
          await processMediaViaBackend(fileId, mediaType, text, msg.chatId);
        }
      } else if (text && !text.startsWith('/')) {
        await processTextViaBackend(text, msg.chatId);
      }
    } catch (e) {
      console.error('[TelegramInbox] Processing error:', e);
    } finally {
      setIsGenerating(false);
      setProcessingStatus('');
      checkPendingFile();
    }
  };

  const processMediaViaBackend = async (fileId: string, mediaType: string, text: string, tgChatId: number) => {
    try {
      const resp = await fetch(`${BACKEND_URL}/api/telegram/process-media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_id: fileId,
          media_type: mediaType,
          message_text: text,
          chat_id: tgChatId,
          user_id: userId,
        }),
      });
      const data = await resp.json();
      if (data.status === 'ok' && data.response) {
        loadMessages();
        checkPendingFile();
      }
    } catch (e) {
      console.error('[TelegramInbox] process-media error:', e);
    }
  };

  const processTextViaBackend = async (text: string, tgChatId: number) => {
    try {
      const resp = await fetch(`${BACKEND_URL}/api/telegram/process-text`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message_text: text,
          chat_id: tgChatId,
          user_id: userId,
        }),
      });
      const data = await resp.json();
      if (data.status === 'ok' && data.response) {
        loadMessages();
        checkPendingFile();
      }
    } catch (e) {
      console.error('[TelegramInbox] process-text error:', e);
    }
  };

  const handleSendReply = async () => {
    if (!replyText.trim() && !attachedFile) return;
    setIsGenerating(true);
    setProcessingStatus(attachedFile ? 'Enviando archivo...' : 'Enviando respuesta...');

    try {
      // If there's an attached file, send it via Telegram
      if (attachedFile && chatId) {
        const formData = new FormData();
        formData.append('chat_id', chatId);
        formData.append('document', attachedFile);
        if (replyText.trim()) {
          formData.append('caption', replyText.trim());
        }

        const TELEGRAM_BOT_TOKEN = settings.integrations?.telegram?.botToken;
        if (TELEGRAM_BOT_TOKEN) {
          const resp = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`, {
            method: 'POST',
            body: formData,
          });
          const data = await resp.json();
          if (data.ok) {
            setAttachedFile(null);
            setReplyText('');
            loadMessages();
          } else {
            console.error('[TelegramInbox] Send document failed:', data.description);
          }
        }
      } else if (replyText.trim()) {
        await TelegramService.sendMessage({
          patientId: '',
          patientName: 'Canal Telegram',
          userId: 'professional',
          userName: 'Profesional',
          content: replyText,
          messageType: 'text',
        });
        setReplyText('');
        loadMessages();
      }
    } finally {
      setIsGenerating(false);
      setProcessingStatus('');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAttachedFile(file);
    }
    // Reset input so same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSendFile = async () => {
    if (!attachedFile || !chatId) return;
    setIsSendingFile(true);
    try {
      const formData = new FormData();
      formData.append('chat_id', chatId);
      formData.append('document', attachedFile);

      const TELEGRAM_BOT_TOKEN = settings.integrations?.telegram?.botToken;
      if (TELEGRAM_BOT_TOKEN) {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`, {
          method: 'POST',
          body: formData,
        });
        setAttachedFile(null);
        loadMessages();
      }
    } finally {
      setIsSendingFile(false);
    }
  };

  const handleQuickAction = async (action: string, patientId?: string) => {
    if (!chatId) return;
    setIsGenerating(true);
    setProcessingStatus('Procesando acción...');
    try {
      let textToSend = action;
      let confirmationMsg = '';
      if (patientId && pendingFile?.patients) {
        const p = pendingFile.patients.find(pt => pt.id === patientId);
        if (p) {
          textToSend = `${action} ${p.name}`;
          confirmationMsg = `Guardado en ${p.name}`;
        }
      } else if (action === '1') {
        confirmationMsg = 'Acción registrada';
      } else if (action === '2') {
        confirmationMsg = 'Sesión creada';
      } else if (action === '3') {
        confirmationMsg = 'Informe generado';
      } else if (action === 'no') {
        confirmationMsg = 'Descartado';
      }
      await processTextViaBackend(textToSend, parseInt(chatId));
      if (confirmationMsg) {
        setActionConfirmation(confirmationMsg);
        setTimeout(() => setActionConfirmation(null), 3000);
      }
    } finally {
      setIsGenerating(false);
      setProcessingStatus('');
      checkPendingFile();
    }
  };

  const handleSaveConfig = () => {
    if (!tokenInput.trim()) return;
    setSaveStatus('saving');
    TelegramService.configure(tokenInput.trim(), chatIdInput.trim());
    update('integrations', {
      telegram: {
        ...settings.integrations?.telegram,
        botToken: tokenInput.trim(),
        chatId: chatIdInput.trim(),
        enabled: true,
        connected: true,
      },
    });
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 2000);
  };

  if (!isConfigured) {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 bg-sky-100 dark:bg-sky-900/30 rounded-lg flex items-center justify-center">
            <MessageSquare size={16} className="text-sky-600 dark:text-sky-400" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-800 dark:text-white">Canal Telegram</h3>
            <p className="text-[10px] text-slate-400 dark:text-slate-500">Canal clínico bidireccional</p>
          </div>
        </div>
        <div className="space-y-2">
          <div>
            <label className="block text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-0.5">Bot Token</label>
            <input
              type="text"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="123456:ABC-DEF..."
              className="w-full px-2 py-1.5 text-[11px] border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>
          <div>
            <label className="block text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-0.5">Chat ID (opcional)</label>
            <input
              type="text"
              value={chatIdInput}
              onChange={(e) => setChatIdInput(e.target.value)}
              placeholder="5854700506"
              className="w-full px-2 py-1.5 text-[11px] border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>
          <button
            onClick={handleSaveConfig}
            disabled={!tokenInput.trim() || saveStatus === 'saving'}
            className="w-full px-3 py-1.5 bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-lg text-[11px] font-bold transition-colors flex items-center justify-center gap-1.5"
          >
            {saveStatus === 'saving' ? (
              <><Loader2 size={10} className="animate-spin" /> Guardando...</>
            ) : saveStatus === 'saved' ? (
              <><Check size={10} /> Conectado</>
            ) : (
              'Conectar'
            )}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col h-full min-h-[400px]">
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-gradient-to-r from-sky-50 to-white dark:from-sky-900/20 dark:to-slate-900">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-sky-100 dark:bg-sky-900/30 rounded-xl flex items-center justify-center">
            <MessageSquare size={18} className="text-sky-600 dark:text-sky-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-white">Canal Clínico</h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Chat con pacientes vía Telegram · {messages.length} mensajes</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 px-2 py-1 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[10px] font-bold text-green-600 dark:text-green-400">En línea</span>
          </span>
          <button onClick={() => { loadMessages(); checkPendingFile(); }} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 transition-colors" title="Actualizar">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Action Confirmation */}
      {actionConfirmation && (
        <div className="px-3 py-2 bg-emerald-50 dark:bg-emerald-900/20 border-b border-emerald-200 dark:border-emerald-800 flex items-center gap-2 animate-in fade-in">
          <Check size={12} className="text-emerald-500" />
          <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300">{actionConfirmation}</span>
        </div>
      )}

      {/* Pending File Banner */}
      {pendingFile && (
        <div className="px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800">
          <div className="flex items-center gap-2 mb-1.5">
            {pendingFile.media_type === 'audio' ? (
              <Mic size={12} className="text-purple-500" />
            ) : (
              <Paperclip size={12} className="text-amber-600 dark:text-amber-400" />
            )}
            <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300">
              {pendingFile.media_type === 'audio' ? 'Audio procesado' : `Archivo pendiente`}: {pendingFile.file_name}
            </span>
          </div>

          {/* Audio-specific: show transcription */}
          {pendingFile.media_type === 'audio' && pendingFile.transcription && (
            <div className="mb-2 p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
              <p className="text-[9px] font-bold text-purple-600 dark:text-purple-400 mb-0.5">Transcripción:</p>
              <p className="text-[9px] text-slate-600 dark:text-slate-300 italic line-clamp-3">"{pendingFile.transcription}"</p>
              {pendingFile.intent && (
                <p className="text-[9px] text-slate-500 dark:text-slate-400 mt-1">
                  <span className="font-bold">Intención:</span> {pendingFile.intent}
                </p>
              )}
              {pendingFile.patient_detected && (
                <p className="text-[9px] text-sky-600 dark:text-sky-400 mt-0.5">
                  <span className="font-bold">Paciente:</span> {pendingFile.patient_detected}
                </p>
              )}
            </div>
          )}

          {/* Non-audio: show short analysis */}
          {pendingFile.media_type !== 'audio' && (
            <p className="text-[9px] text-amber-600 dark:text-amber-400 mb-2 line-clamp-2">
              {pendingFile.analysis?.slice(0, 120)}...
            </p>
          )}

          <div className="flex flex-wrap gap-1">
            {pendingFile.media_type === 'audio' ? (
              // Audio-specific actions: nota_clinica, sesion, informe
              <>
                {pendingFile.matched_patient ? (
                  <>
                    <button
                      onClick={() => handleQuickAction('1')}
                      className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded text-[9px] font-bold hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors flex items-center gap-1"
                    >
                      <Save size={8} /> Nota clínica → {pendingFile.matched_patient.name}
                    </button>
                    <button
                      onClick={() => handleQuickAction('2')}
                      className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-[9px] font-bold hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors flex items-center gap-1"
                    >
                      <ClipboardList size={8} /> Sesión
                    </button>
                    <button
                      onClick={() => handleQuickAction('3')}
                      className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded text-[9px] font-bold hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors flex items-center gap-1"
                    >
                      <File size={8} /> Informe
                    </button>
                    <button
                      onClick={() => handleQuickAction('no')}
                      className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded text-[9px] font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                      Descartar
                    </button>
                  </>
                ) : (
                  <>
                    {pendingFile.patients?.slice(0, 4).map((p) => (
                      <button
                        key={p.id}
                        onClick={() => handleQuickAction('1', p.id)}
                        className="px-2 py-0.5 bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 rounded text-[9px] font-bold hover:bg-sky-200 dark:hover:bg-sky-900/50 transition-colors"
                      >
                        {p.name}
                      </button>
                    ))}
                    <button
                      onClick={() => handleQuickAction('no')}
                      className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded text-[9px] font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                      Descartar
                    </button>
                  </>
                )}
              </>
            ) : (
              // Non-audio actions: documento, sesion, informe
              <>
                {pendingFile.suggestions?.autoMatchedPatient ? (
                  <>
                    <button
                      onClick={() => handleQuickAction('1')}
                      className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded text-[9px] font-bold hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors flex items-center gap-1"
                    >
                      <Save size={8} /> Guardar en {pendingFile.suggestions.autoMatchedPatient.name}
                    </button>
                    <button
                      onClick={() => handleQuickAction('2')}
                      className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-[9px] font-bold hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors flex items-center gap-1"
                    >
                      <ClipboardList size={8} /> Sesión
                    </button>
                    <button
                      onClick={() => handleQuickAction('3')}
                      className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded text-[9px] font-bold hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors flex items-center gap-1"
                    >
                      <File size={8} /> Informe
                    </button>
                    <button
                      onClick={() => handleQuickAction('no')}
                      className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded text-[9px] font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                      Descartar
                    </button>
                  </>
                ) : (
                  pendingFile.patients?.slice(0, 4).map((p) => (
                    <button
                      key={p.id}
                      onClick={() => handleQuickAction('1', p.id)}
                      className="px-2 py-0.5 bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300 rounded text-[9px] font-bold hover:bg-sky-200 dark:hover:bg-sky-900/50 transition-colors"
                    >
                      {p.name}
                    </button>
                  ))
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Filter bar */}
      {messages.length > 0 && (
        <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-colors ${
                showFilters || filterPatient || filterDate
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                  : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Filter size={10} /> Filtros
              {(filterPatient || filterDate) && (
                <span className="w-4 h-4 bg-blue-500 text-white rounded-full flex items-center justify-center text-[8px]">
                  {(filterPatient ? 1 : 0) + (filterDate ? 1 : 0)}
                </span>
              )}
            </button>
            {(filterPatient || filterDate) && (
              <button
                onClick={() => { setFilterPatient(''); setFilterDate(''); setVisibleCount(30); }}
                className="text-[10px] text-slate-400 hover:text-red-500 transition-colors"
              >
                Limpiar
              </button>
            )}
            <span className="ml-auto text-[11px] text-slate-400 dark:text-slate-500">
              {messages.length} msg
            </span>
          </div>
          {showFilters && (
            <div className="flex gap-2 mt-2">
              <select
                value={filterPatient}
                onChange={(e) => { setFilterPatient(e.target.value); setVisibleCount(30); }}
                className="flex-1 px-2 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-700 dark:text-slate-300"
              >
                <option value="">Todos los pacientes</option>
                {patients.map(p => (
                  <option key={p.id} value={p.name.toLowerCase()}>{p.name}</option>
                ))}
              </select>
              <input
                type="date"
                value={filterDate}
                onChange={(e) => { setFilterDate(e.target.value); setVisibleCount(30); }}
                className="px-2 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-700 dark:text-slate-300"
              />
            </div>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <div className="w-20 h-20 bg-gradient-to-br from-sky-100 to-blue-100 dark:from-sky-900/30 dark:to-blue-900/30 rounded-2xl flex items-center justify-center mb-5 shadow-lg shadow-sky-200/50 dark:shadow-sky-900/20">
              <MessageSquare size={36} className="text-sky-500 dark:text-sky-400" />
            </div>
            <h4 className="text-base font-bold text-slate-800 dark:text-white mb-2">Canal Clínico Activo</h4>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-[320px] leading-relaxed mb-6">
              Enviá fotos, audios o documentos desde Telegram. El bot procesa cada archivo con IA y te permite guardarlo directamente en la historia del paciente.
            </p>
            <div className="grid grid-cols-2 gap-3 w-full max-w-[300px]">
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 text-center">
                <div className="text-lg mb-1">📸</div>
                <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300">Fotos</p>
                <p className="text-[10px] text-slate-400">Evaluaciones, materiales</p>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 text-center">
                <div className="text-lg mb-1">🎙️</div>
                <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300">Audios</p>
                <p className="text-[10px] text-slate-400">Transcripción IA</p>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 text-center">
                <div className="text-lg mb-1">📄</div>
                <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300">Documentos</p>
                <p className="text-[10px] text-slate-400">Informes, estudios</p>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 text-center">
                <div className="text-lg mb-1">🤖</div>
                <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300">IA Clínica</p>
                <p className="text-[10px] text-slate-400">Análisis automático</p>
              </div>
            </div>
          </div>
        ) : (
          (() => {
            const filtered = messages.filter(msg => {
              if (filterPatient) {
                const matched = matchPatient(msg.sent_by_name);
                if (!matched || !matched.name.toLowerCase().includes(filterPatient)) return false;
              }
              if (filterDate) {
                const msgDate = new Date(msg.timestamp).toISOString().split('T')[0];
                if (msgDate !== filterDate) return false;
              }
              return true;
            });
            let lastDate = '';
            return filtered.slice(0, visibleCount).map((msg) => {
              const msgDate = new Date(msg.timestamp).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
              const showDate = msgDate !== lastDate;
              lastDate = msgDate;
              
              const meta = msg.metadata || {};
              const hasMedia = meta.has_media;
              const mediaType = meta.media_type;
              const fileId = meta.file_id;

              return (
                <React.Fragment key={msg.id}>
                  {showDate && (
                    <div className="text-center py-2">
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">{msgDate}</span>
                    </div>
                  )}
                  <div
                    className={`flex gap-2 ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                  >
                    {msg.direction === 'inbound' && (
                      <div className="w-6 h-6 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center shrink-0 mt-1">
                        <User size={12} className="text-slate-500 dark:text-slate-400" />
                      </div>
                    )}
                    <div className="max-w-[85%]">
                      {/* Patient context badge */}
                      {msg.direction === 'inbound' && (() => {
                        const matchedPatient = matchPatient(msg.sent_by_name);
                        if (!matchedPatient) return null;
                        return (
                          <button
                            onClick={() => onSelectPatient?.(matchedPatient)}
                            className="flex items-center gap-1.5 mb-1 px-2 py-1 bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 rounded-lg text-[11px] font-bold text-sky-600 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-900/40 transition-colors"
                          >
                            <span className="w-4 h-4 bg-sky-200 dark:bg-sky-800 rounded-full flex items-center justify-center text-[8px]">{matchedPatient.name.charAt(0)}</span>
                            {matchedPatient.name}
                            <span className="text-sky-400 dark:text-sky-500 font-normal">· {matchedPatient.age}a</span>
                          </button>
                        );
                      })()}
                      <div className={`rounded-xl px-3 py-2 text-xs ${
                        msg.direction === 'outbound'
                          ? 'bg-blue-600 text-white rounded-br-sm'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-bl-sm border border-slate-200 dark:border-slate-700'
                      }`}>
                        {msg.direction === 'inbound' && (
                          <div className="flex items-center gap-1 mb-1">
                            <span className="text-[11px] font-bold text-sky-600 dark:text-sky-400">{msg.sent_by_name}</span>
                            {msg.message_type !== 'text' && MEDIA_ICONS[msg.message_type]}
                          </div>
                        )}

                        {/* Media Preview */}
                        {hasMedia && fileId && (
                          <div className="mb-1.5">
                            {mediaType === 'photo' && (
                              <img
                                src={`${BACKEND_URL}/api/telegram/file/${fileId}`}
                                alt="Foto de Telegram"
                                className="rounded-lg max-h-40 w-auto cursor-pointer hover:opacity-90 transition-opacity"
                                onClick={() => window.open(`${BACKEND_URL}/api/telegram/file/${fileId}`, '_blank')}
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                              />
                            )}
                            {mediaType === 'video' && (
                              <video
                                src={`${BACKEND_URL}/api/telegram/file/${fileId}`}
                                controls
                                className="rounded-lg max-h-40 w-auto"
                                onError={(e) => { (e.target as HTMLVideoElement).style.display = 'none'; }}
                              />
                            )}
                            {(mediaType === 'audio' || mediaType === 'voice') && (
                              <div className="flex items-center gap-2 p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                                <Mic size={14} className="text-purple-500" />
                                <audio
                                  src={`${BACKEND_URL}/api/telegram/file/${fileId}`}
                                  controls
                                  className="h-8 flex-1"
                                />
                              </div>
                            )}
                            {mediaType === 'document' && (
                              <a
                                href={`${BACKEND_URL}/api/telegram/file/${fileId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                              >
                                <FileText size={14} className="text-blue-500" />
                                <span className="text-[10px] text-blue-700 dark:text-blue-300 truncate">{meta.document_name || 'Documento'}</span>
                              </a>
                            )}
                          </div>
                        )}

                        <p className="break-words whitespace-pre-wrap">{msg.content}</p>
                        <div className={`text-[9px] mt-0.5 ${msg.direction === 'outbound' ? 'text-blue-200' : 'text-slate-400 dark:text-slate-500'}`}>
                          {new Date(msg.timestamp).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      {/* Clinical action buttons for inbound messages */}
                      {msg.direction === 'inbound' && (
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {matchPatient(msg.sent_by_name) && (
                            <button
                              onClick={() => {
                                const p = matchPatient(msg.sent_by_name);
                                if (p && onSelectPatient) onSelectPatient(p);
                              }}
                              className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded text-[8px] font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                            >
                              Ver paciente
                            </button>
                          )}
                          <button
                            onClick={() => {
                              const p = matchPatient(msg.sent_by_name);
                              if (onNavigate) {
                                onNavigate('agenda');
                                setActionConfirmation(`Abriendo agenda para ${p?.name || msg.sent_by_name}...`);
                              }
                              setTimeout(() => setActionConfirmation(null), 3000);
                            }}
                            className="px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded text-[8px] font-bold hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                          >
                            Agendar
                          </button>
                          <button
                            onClick={async () => {
                              const p = matchPatient(msg.sent_by_name);
                              try {
                                const backendUrl = (import.meta as any).env?.VITE_BACKEND_URL || 'http://localhost:3001';
                                await fetch(`${backendUrl}/api/reminders`, {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    patient_id: p?.id || null,
                                    patient_name: p?.name || msg.sent_by_name,
                                    message: `Recordatorio de sesión para ${p?.name || msg.sent_by_name}`,
                                    scheduled_for: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                                    channel: 'telegram',
                                  }),
                                });
                                setActionConfirmation(`Recordatorio programado para ${p?.name || msg.sent_by_name} (mañana)`);
                              } catch (e) {
                                setActionConfirmation(`Recordatorio pendiente para ${p?.name || msg.sent_by_name}`);
                              }
                              setTimeout(() => setActionConfirmation(null), 3000);
                            }}
                            className="px-1.5 py-0.5 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded text-[8px] font-bold hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
                          >
                            Recordatorio
                          </button>
                          <button
                            onClick={() => {
                              const p = matchPatient(msg.sent_by_name);
                              if (onNavigate) {
                                onNavigate('multimedia');
                                setActionConfirmation(`Generando material para ${p?.name || msg.sent_by_name}...`);
                              }
                              setTimeout(() => setActionConfirmation(null), 3000);
                            }}
                            className="px-1.5 py-0.5 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded text-[8px] font-bold hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
                          >
                            Generar material
                          </button>
                        </div>
                      )}
                    </div>
                    {msg.direction === 'outbound' && (
                      <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center shrink-0 mt-1">
                        <Bot size={12} className="text-blue-600 dark:text-blue-400" />
                      </div>
                    )}
                  </div>
                </React.Fragment>
              );
            });
          })()
        )}
        {isGenerating && (
          <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500">
            <div className="w-6 h-6 bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center">
              <Loader2 size={12} className="animate-spin" />
            </div>
            <span className="italic">{processingStatus || 'Procesando...'}</span>
          </div>
        )}
        {(() => {
          const filteredCount = messages.filter(msg => {
            if (filterPatient) {
              const matched = matchPatient(msg.sent_by_name);
              if (!matched || !matched.name.toLowerCase().includes(filterPatient)) return false;
            }
            if (filterDate) {
              const msgDate = new Date(msg.timestamp).toISOString().split('T')[0];
              if (msgDate !== filterDate) return false;
            }
            return true;
          }).length;
          if (filteredCount > visibleCount) {
            return (
              <button
                onClick={() => setVisibleCount(prev => prev + 30)}
                className="w-full py-2 text-[10px] font-bold text-blue-500 hover:text-blue-600 dark:text-blue-400 transition-colors"
              >
                Cargar más ({filteredCount - visibleCount} restantes)
              </button>
            );
          }
          return null;
        })()}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-850">
        {/* Attached file preview */}
        {attachedFile && (
          <div className="mb-2 p-2.5 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-2">
            <FileText size={16} className="text-blue-500 shrink-0" />
            <span className="text-xs text-slate-600 dark:text-slate-300 truncate flex-1">{attachedFile.name}</span>
            <span className="text-[10px] text-slate-400">{(attachedFile.size / 1024).toFixed(0)}KB</span>
            <button onClick={() => setAttachedFile(null)} className="text-slate-400 hover:text-red-500 transition-colors p-1">
              <X size={12} />
            </button>
          </div>
        )}

        <div className="flex gap-2">
          {/* File attachment button */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
            accept="image/*,audio/*,video/*,.pdf,.doc,.docx"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isGenerating}
            className="px-3 py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 text-slate-500 dark:text-slate-400 rounded-xl border border-slate-200 dark:border-slate-700 transition-colors"
            title="Adjuntar archivo"
          >
            <Paperclip size={16} />
          </button>

          <input
            type="text"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendReply(); } }}
            placeholder={pendingFile ? "Respondé con el nombre del paciente..." : attachedFile ? "Caption (opcional)..." : "Escribí un mensaje o adjuntá un archivo..."}
            disabled={isGenerating}
            className="flex-1 px-4 py-2.5 text-sm border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-700 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 disabled:opacity-50"
          />
          <button
            onClick={handleSendReply}
            disabled={(!replyText.trim() && !attachedFile) || isGenerating}
            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-xl transition-colors shadow-sm"
          >
            {isSendingFile ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TelegramInbox;

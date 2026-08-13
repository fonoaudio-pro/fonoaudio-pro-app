import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Mail, MessageSquare, Send, Search, RefreshCw, Loader2, User, Clock,
  ArrowLeft, Plus, ExternalLink, FileText, CheckCircle2,
  Phone, Stethoscope, Heart, Brain, Ear, Mic, Inbox
} from 'lucide-react';
import { GmailService, GmailMessage, GmailMessageDetail, EmailTemplate } from '../services/gmailService';

function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/on\w+='[^']*'/gi, '')
    .replace(/javascript:/gi, '');
}

interface ComunicacionSectionProps {
  userId?: string;
  patients: any[];
  onSelectPatient?: (patient: any) => void;
}

type TabType = 'gmail' | 'telegram' | 'whatsapp';

const CLINICAL_TEMPLATES: Omit<EmailTemplate, 'id'>[] = [
  {
    name: 'Resultado de Evaluación',
    category: 'Evaluacion',
    subject_template: 'Resultado de evaluación fonoaudiológica - {PACIENTE}',
    body_template: `Estimado/a {FAMILIAR},

Le comunico los resultados de la evaluación fonoaudiológica realizada a {PACIENTE}.

Diagnóstico: {DIAGNOSTICO}
Observaciones: {OBSERVACIONES}

Plan de tratamiento propuesto:
{PLAN_TRATAMIENTO}

Quedo a disposición para cualquier consulta.

Saludos cordiales,
{PROFESIONAL}`,
    variables: ['PACIENTE', 'FAMILIAR', 'DIAGNOSTICO', 'OBSERVACIONES', 'PLAN_TRATAMIENTO', 'PROFESIONAL'],
  },
  {
    name: 'Recordatorio de Sesión',
    category: 'Seguimiento',
    subject_template: 'Recordatorio de sesión - {PACIENTE}',
    body_template: `Estimado/a {FAMILIAR},

Le recuerdo que {PACIENTE} tiene programada una sesión de terapia fonoaudiológica:

Fecha: {FECHA}
Hora: {HORA}
Lugar: {LUGAR}

Por favor, confirme asistencia.

Saludos,
{PROFESIONAL}`,
    variables: ['PACIENTE', 'FAMILIAR', 'FECHA', 'HORA', 'LUGAR', 'PROFESIONAL'],
  },
  {
    name: 'Guía de Ejercicios',
    category: 'Ejercicios',
    subject_template: 'Ejercicios para casa - {PACIENTE}',
    body_template: `Estimado/a {FAMILIAR},

Envío los ejercicios para que {PACIENTE} realice en casa durante esta semana:

{EJERCICIOS}

Recordatorios:
- Realizar los ejercicios {FRECUENCIA}
- Duración aproximada: {DURACION}
- Cualquier duda, comunicarse conmigo.

Saludos,
{PROFESIONAL}`,
    variables: ['PACIENTE', 'FAMILIAR', 'EJERCICIOS', 'FRECUENCIA', 'DURACION', 'PROFESIONAL'],
  },
  {
    name: 'Informe de Seguimiento',
    category: 'Informe',
    subject_template: 'Informe de seguimiento - {PACIENTE}',
    body_template: `INFORME DE SEGUIMIENTO FONOAUDIOLÓGICO

Paciente: {PACIENTE}
Fecha: {FECHA}
Sesión N°: {NUMERO_SESION}

Evolución:
{EVOLUCION}

Objetivos alcanzados:
{OBJETIVOS}

Próximos pasos:
{PROXIMOS_PASOS}

Firma,
{PROFESIONAL}
{MATRICULA}`,
    variables: ['PACIENTE', 'FECHA', 'NUMERO_SESION', 'EVOLUCION', 'OBJETIVOS', 'PROXIMOS_PASOS', 'PROFESIONAL', 'MATRICULA'],
  },
];

export default function ComunicacionSection({ userId, patients, onSelectPatient }: ComunicacionSectionProps) {
  const [activeTab, setActiveTab] = useState<TabType>('gmail');
  const [gmailMessages, setGmailMessages] = useState<GmailMessage[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<GmailMessageDetail | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCompose, setShowCompose] = useState(false);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gmailView, setGmailView] = useState<'inbox' | 'sent'>('inbox');
  const bodyRef = useRef<HTMLDivElement>(null);

  const loadGmailMessages = useCallback(async (query?: string, pageToken?: string) => {
    if (!userId) return;
    setIsLoading(true);
    setError(null);
    try {
      const effectiveQuery = query || searchQuery || (gmailView === 'sent' ? 'in:sent' : 'in:inbox');
      const result = await GmailService.listMessages(userId, effectiveQuery, pageToken);
      if (pageToken) {
        setGmailMessages(prev => [...prev, ...result.messages]);
      } else {
        setGmailMessages(result.messages);
      }
      setNextPageToken(result.nextPageToken);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  }, [userId, searchQuery, gmailView]);

  useEffect(() => {
    loadGmailMessages();
  }, [loadGmailMessages]);

  const handleSearch = () => {
    loadGmailMessages(searchQuery || (gmailView === 'sent' ? 'in:sent' : 'in:inbox'));
  };

  const handleSelectMessage = async (message: GmailMessage) => {
    if (!userId) return;
    setIsLoadingDetail(true);
    setSelectedMessage(null);
    try {
      const result = await GmailService.getMessage(userId, message.id);
      setSelectedMessage(result.message);
      setSelectedPatient(result.patient);
      // Mark as read
      if (!message.isRead) {
        await GmailService.markAsRead(userId, message.id);
        setGmailMessages(prev => prev.map(m => m.id === message.id ? { ...m, isRead: true } : m));
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleSendEmail = async (to: string, subject: string, body: string) => {
    if (!userId) return;
    try {
      await GmailService.sendMessage(userId, to, subject, body);
      setShowCompose(false);
      loadGmailMessages();
    } catch (e: any) {
      setError(e.message);
    }
  };

  const parseSender = (from: string) => {
    const emailMatch = from.match(/<(.+?)>/);
    const email = emailMatch ? emailMatch[1] : from;
    const name = emailMatch ? from.replace(/<.*>/, '').trim() : from;
    return { email, name };
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays === 0) return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
      if (diffDays === 1) return 'Ayer';
      if (diffDays < 7) return date.toLocaleDateString('es-AR', { weekday: 'long' });
      return date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
    } catch { return dateStr; }
  };

  const getSenderInitial = (from: string) => {
    const { name } = parseSender(from);
    return name.charAt(0).toUpperCase();
  };

  const getSenderColor = (from: string) => {
    const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-amber-500', 'bg-pink-500', 'bg-teal-500'];
    const hash = from.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
            <Mail className="text-white" size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Comunicación</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">Gestión unificada de comunicación clínica</p>
          </div>
        </div>
        <button
          onClick={() => setShowCompose(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all shadow-md hover:shadow-lg font-medium text-sm"
        >
          <Plus size={16} /> Redactar
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
        {[
          { id: 'gmail' as TabType, icon: <Mail size={16} />, label: 'Gmail', count: gmailMessages.filter(m => !m.isRead).length },
          { id: 'telegram' as TabType, icon: <MessageSquare size={16} />, label: 'Telegram' },
          { id: 'whatsapp' as TabType, icon: <Send size={16} />, label: 'WhatsApp' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-5 py-3 font-medium transition-all text-sm ${
              activeTab === tab.id
                ? 'text-blue-600 border-b-2 border-blue-600 bg-white dark:bg-slate-900'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            {tab.icon} {tab.label}
            {tab.count > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex">
        {activeTab === 'gmail' && (
          <>
            {/* Message List */}
            <div className="w-[380px] border-r border-slate-200 dark:border-slate-700 flex flex-col">
              {/* Gmail sub-tabs */}
              <div className="flex border-b border-slate-200 dark:border-slate-700">
                <button onClick={() => { setGmailView('inbox'); loadGmailMessages('in:inbox'); }}
                  className={`flex-1 py-2 text-xs font-bold transition-colors ${gmailView === 'inbox' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50 dark:bg-blue-900/10' : 'text-slate-500 hover:text-slate-700'}`}>
                  <Inbox size={12} className="inline mr-1" /> Bandeja de entrada
                </button>
                <button onClick={() => { setGmailView('sent'); loadGmailMessages('in:sent'); }}
                  className={`flex-1 py-2 text-xs font-bold transition-colors ${gmailView === 'sent' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50 dark:bg-blue-900/10' : 'text-slate-500 hover:text-slate-700'}`}>
                  <Send size={12} className="inline mr-1" /> Enviados
                </button>
              </div>
              {/* Search */}
              <div className="p-3 border-b border-slate-200 dark:border-slate-700">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      placeholder="Buscar emails..."
                      className="w-full pl-9 pr-3 py-2 border border-slate-200 dark:border-slate-600 rounded-xl text-sm bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    />
                  </div>
                  <button onClick={handleSearch} className="p-2 bg-slate-100 dark:bg-slate-700 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                    <Search size={14} />
                  </button>
                  <button onClick={() => loadGmailMessages()} disabled={isLoading} className="p-2 bg-slate-100 dark:bg-slate-700 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                    <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto">
                {error && (
                  <div className="m-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400 text-sm flex items-center gap-2">
                    <AlertCircle size={16} />
                    {error}
                  </div>
                )}

                {gmailMessages.map((msg) => {
                  const { name } = parseSender(msg.from);
                  const isSelected = selectedMessage?.id === msg.id;
                  return (
                    <div
                      key={msg.id}
                      onClick={() => handleSelectMessage(msg)}
                      className={`p-3 border-b border-slate-100 dark:border-slate-800 cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-blue-50 dark:bg-blue-900/20 border-l-2 border-l-blue-500'
                          : !msg.isRead
                            ? 'bg-blue-50/50 dark:bg-blue-900/10 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0 ${getSenderColor(msg.from)}`}>
                          {getSenderInitial(msg.from)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className={`text-sm truncate ${!msg.isRead ? 'font-bold text-slate-900 dark:text-white' : 'font-medium text-slate-700 dark:text-slate-300'}`}>
                              {name}
                            </span>
                            <span className="text-[11px] text-slate-400 dark:text-slate-500 whitespace-nowrap">
                              {formatDate(msg.date)}
                            </span>
                          </div>
                          <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate mt-0.5">
                            {msg.subject}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            {msg.snippet}
                          </p>
                        </div>
                        {!msg.isRead && <span className="w-2 h-2 bg-blue-500 rounded-full shrink-0 mt-2" />}
                      </div>
                    </div>
                  );
                })}

                {nextPageToken && (
                  <button
                    onClick={() => loadGmailMessages(searchQuery || (gmailView === 'sent' ? 'in:sent' : 'in:inbox'), nextPageToken)}
                    className="w-full p-3 text-blue-600 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-medium transition-colors"
                  >
                    Cargar más emails
                  </button>
                )}

                {!isLoading && gmailMessages.length === 0 && !error && (
                  <div className="flex flex-col items-center justify-center h-64 text-slate-500 dark:text-slate-400">
                    <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
                      <Mail size={28} className="opacity-50" />
                    </div>
                    <p className="font-medium">No hay emails</p>
                    <p className="text-sm mt-1">Conecta tu cuenta de Google en Configuración</p>
                  </div>
                )}

                {isLoading && gmailMessages.length === 0 && (
                  <div className="flex items-center justify-center h-64">
                    <Loader2 className="animate-spin text-blue-500" size={24} />
                  </div>
                )}
              </div>
            </div>

            {/* Message Detail */}
            <div className="flex-1 flex flex-col min-w-0">
              {isLoadingDetail && (
                <div className="flex-1 flex items-center justify-center">
                  <Loader2 className="animate-spin text-blue-500" size={32} />
                </div>
              )}

              {!isLoadingDetail && selectedMessage && (
                <>
                  {/* Detail Header */}
                  <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-white dark:bg-slate-900">
                    <div className="flex items-center gap-3 min-w-0">
                      <button
                        onClick={() => { setSelectedMessage(null); setSelectedPatient(null); }}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors md:hidden"
                      >
                        <ArrowLeft size={18} />
                      </button>
                      <div className="min-w-0">
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white truncate">
                          {selectedMessage.subject}
                        </h2>
                        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                          <span>De: <span className="text-slate-700 dark:text-slate-300">{selectedMessage.from}</span></span>
                          <span>·</span>
                          <span>{formatDate(selectedMessage.date)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedPatient && (
                        <button
                          onClick={() => onSelectPatient?.(selectedPatient)}
                          className="flex items-center gap-2 px-3 py-1.5 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-900/20 text-blue-700 dark:text-blue-400 rounded-xl text-sm font-medium hover:from-blue-100 hover:to-blue-200 dark:hover:from-blue-900/50 dark:hover:to-blue-900/30 transition-all border border-blue-200 dark:border-blue-800"
                        >
                          <User size={14} /> {selectedPatient.name}
                        </button>
                      )}
                      <a
                        href={`https://mail.google.com/mail/u/0/#inbox/${selectedMessage.threadId || selectedMessage.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors text-slate-500"
                        title="Abrir en Gmail"
                      >
                        <ExternalLink size={16} />
                      </a>
                    </div>
                  </div>

                  {/* Patient Correlation Banner */}
                  {selectedPatient && (
                    <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/10 border-b border-blue-100 dark:border-blue-900/30 flex items-center gap-2 text-sm">
                      <Stethoscope size={14} className="text-blue-600 dark:text-blue-400" />
                      <span className="text-blue-700 dark:text-blue-300">
                        Correlacionado con paciente: <strong>{selectedPatient.name}</strong>
                      </span>
                      <button
                        onClick={() => onSelectPatient?.(selectedPatient)}
                        className="ml-auto text-blue-600 dark:text-blue-400 hover:underline font-medium"
                      >
                        Ver historia →
                      </button>
                    </div>
                  )}

                  {/* Email Body */}
                  <div className="flex-1 overflow-y-auto" ref={bodyRef}>
                    {selectedMessage.bodyHtml ? (
                      <div
                        className="email-content p-6 max-w-3xl mx-auto"
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(selectedMessage.bodyHtml) }}
                        style={{
                          lineHeight: '1.6',
                          color: 'inherit',
                          fontSize: '14px',
                        }}
                      />
                    ) : (
                      <div className="p-6 max-w-3xl mx-auto">
                        <pre className="whitespace-pre-wrap font-sans text-sm text-slate-800 dark:text-slate-200">
                          {selectedMessage.body || selectedMessage.snippet}
                        </pre>
                      </div>
                    )}
                  </div>

                  {/* Quick Reply */}
                  <QuickReplyBar
                    to={selectedMessage.from}
                    subject={`Re: ${selectedMessage.subject}`}
                    onSend={handleSendEmail}
                    patientName={selectedPatient?.name}
                  />
                </>
              )}

              {!isLoadingDetail && !selectedMessage && (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-500 dark:text-slate-400">
                  <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
                    <Mail size={32} className="opacity-50" />
                  </div>
                  <p className="font-medium text-lg">Selecciona un email</p>
                  <p className="text-sm mt-1">Haz click en un email para verlo aquí</p>
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'telegram' && <TelegramTab />}
        {activeTab === 'whatsapp' && <WhatsAppTab patients={patients} onSelectPatient={onSelectPatient} />}
      </div>

      {/* Compose Modal */}
      {showCompose && (
        <ComposeModal
          onClose={() => setShowCompose(false)}
          onSend={handleSendEmail}
          patients={patients}
          templates={CLINICAL_TEMPLATES}
        />
      )}
    </div>
  );
}

// ─── Quick Reply Bar ───
function QuickReplyBar({ to, subject, onSend, patientName }: { to: string; subject: string; onSend: (to: string, subject: string, body: string) => Promise<void>; patientName?: string }) {
  const [body, setBody] = useState('');
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    if (!body.trim()) return;
    setIsSending(true);
    try {
      const parsedTo = to.match(/<(.+?)>/)?.[1] || to;
      await onSend(parsedTo, subject, body);
      setBody('');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
      {patientName && (
        <div className="mb-2 text-xs text-slate-500 dark:text-slate-400">
          Respondiendo a <strong className="text-slate-700 dark:text-slate-300">{patientName}</strong>
        </div>
      )}
      <div className="flex gap-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Escribe una respuesta..."
          rows={2}
          className="flex-1 px-4 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl text-sm bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        />
        <button
          onClick={handleSend}
          disabled={!body.trim() || isSending}
          className="px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
        >
          {isSending ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
        </button>
      </div>
    </div>
  );
}

// ─── Telegram Tab ───
function TelegramTab() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 p-8">
      <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center mb-4">
        <MessageSquare size={32} className="text-blue-500" />
      </div>
      <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Canal Clínico de Telegram</h2>
      <p className="text-sm text-center max-w-md mb-6">
        El canal clínico de Telegram permite recibir mensajes, fotos y documentos de pacientes de forma bidireccional.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-2xl">
        {[
          { icon: <FileText size={20} />, title: 'Documentos', desc: 'Escaneá y procesá documentos con IA' },
          { icon: <Mic size={20} />, title: 'Audio', desc: 'Transcripción automática de notas de voz' },
          { icon: <Brain size={20} />, title: 'Análisis IA', desc: 'Procesamiento clínico con Gemini' },
        ].map((item, i) => (
          <div key={i} className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mx-auto mb-2 text-blue-600 dark:text-blue-400">
              {item.icon}
            </div>
            <p className="font-medium text-slate-900 dark:text-white text-sm">{item.title}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{item.desc}</p>
          </div>
        ))}
      </div>
      <p className="mt-6 text-xs text-slate-400">
        Accedé al canal clínico desde <strong>Canal Clínico</strong> en el sidebar
      </p>
    </div>
  );
}

// ─── WhatsApp Tab ───
function WhatsAppTab({ patients, onSelectPatient }: { patients: any[]; onSelectPatient?: (p: any) => void }) {
  const handleSendWhatsApp = (phone: string, name: string) => {
    const message = encodeURIComponent(`Hola ${name}, soy tu fonoaudiólogo/a. `);
    window.open(`https://wa.me/${phone.replace(/\D/g, '')}?text=${message}`, '_blank');
  };

  const patientsWithPhone = patients.filter(p => p.phone);

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-1">WhatsApp Rápido</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Envía mensajes directos a través de WhatsApp Web
          </p>
        </div>

        {patientsWithPhone.length === 0 ? (
          <div className="text-center py-12 text-slate-500 dark:text-slate-400">
            <Phone size={48} className="mx-auto mb-4 opacity-50" />
            <p className="font-medium">No hay pacientes con teléfono</p>
            <p className="text-sm mt-1">Agregá un número de teléfono al crear un paciente</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {patientsWithPhone.map((patient) => (
              <div
                key={patient.id}
                className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 hover:shadow-lg transition-all"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                    <span className="text-green-600 dark:text-green-400 font-bold">{patient.name.charAt(0)}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900 dark:text-white truncate">{patient.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{patient.phone}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleSendWhatsApp(patient.phone, patient.name)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                  >
                    <Send size={14} /> WhatsApp
                  </button>
                  {onSelectPatient && (
                    <button
                      onClick={() => onSelectPatient(patient)}
                      className="px-3 py-2 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-sm hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
                    >
                      Ver
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Compose Modal ───
function ComposeModal({ onClose, onSend, patients, templates }: {
  onClose: () => void;
  onSend: (to: string, subject: string, body: string) => Promise<void>;
  patients: any[];
  templates: Omit<EmailTemplate, 'id'>[];
}) {
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  const handleSend = async () => {
    if (!to || !subject || !body) return;
    setIsSending(true);
    try {
      await onSend(to, subject, body);
      onClose();
    } finally {
      setIsSending(false);
    }
  };

  const applyTemplate = (template: Omit<EmailTemplate, 'id'>) => {
    setSubject(template.subject_template);
    setBody(template.body_template);
    setShowTemplates(false);
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden border border-slate-200 dark:border-slate-700 max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Redactar Email</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowTemplates(!showTemplates)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${showTemplates ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            >
              Plantillas Clínicas
            </button>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
              <span className="text-slate-500 text-xl">&times;</span>
            </button>
          </div>
        </div>

        {/* Templates */}
        {showTemplates && (
          <div className="border-b border-slate-200 dark:border-slate-700 max-h-48 overflow-y-auto">
            {templates.map((t, i) => (
              <button
                key={i}
                onClick={() => applyTemplate(t)}
                className="w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-3 transition-colors"
              >
                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <FileText size={14} />
                </div>
                <div>
                  <p className="font-medium text-slate-900 dark:text-white text-sm">{t.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{t.category} · {t.variables.length} variables</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Para</label>
            <input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="email@ejemplo.com"
              className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {patients.filter(p => p.email).slice(0, 6).map((p) => (
                <button
                  key={p.id}
                  onClick={() => setTo(p.email)}
                  className="px-2.5 py-1 text-xs bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-400 transition-colors"
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Asunto</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Asunto del email"
              className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1.5 uppercase tracking-wide">Mensaje</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Escribe tu mensaje aquí..."
              rows={10}
              className="w-full px-3 py-2.5 border border-slate-200 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <div className="text-xs text-slate-400">
            {to && <span>Para: <strong className="text-slate-600 dark:text-slate-300">{to}</strong></span>}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors text-sm">
              Cancelar
            </button>
            <button
              onClick={handleSend}
              disabled={!to || !subject || !body || isSending}
              className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md text-sm font-medium"
            >
              {isSending ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />}
              Enviar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

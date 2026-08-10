import React, { useState, useEffect, useRef, useMemo } from "react";
import { Bot, Minimize2, Loader2, Database, AlertTriangle, Activity, BookOpen, Send, Trash2 } from "lucide-react";
import { GoogleGenAI, LiveServerMessage, Modality, Type as GenAIType } from "@google/genai";
import { supabase } from "../utils/supabaseClient";
import { Patient, ViewType } from "../types";
import { TREATMENT_PLAN_TEMPLATE } from "../types/reports";
import { REPORT_GUIDES } from "../utils/reportTemplates";
import { useAppStore } from "../store/appStore";
import { useAssistantConfig } from "../hooks/useAssistantConfig";
import { useLongitudinalContext } from "../hooks/useLongitudinalContext";
import { usePatientsQuery, useAppointmentsQuery, usePatientMutations, useAppointmentMutations } from "../hooks/useSupabaseQueries";
import { useQueryClient } from "@tanstack/react-query";
import { ResponseSource } from "../types/notebooklm";

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function getTelegramSettings(): { botToken?: string; chatId?: string } {
  try {
    const raw = localStorage.getItem('fonoaudio-settings');
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    const tg = parsed?.integrations?.telegram;
    return { botToken: tg?.botToken, chatId: tg?.chatId };
  } catch { return {}; }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').trim();
}

async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const SOURCE_ICONS: Record<string, React.ReactNode> = {
  patient_context: <Database size={12} className="text-blue-500" />,
  notebook_lm: <BookOpen size={12} className="text-emerald-500" />,
  clinical_alert: <AlertTriangle size={12} className="text-amber-500" />,
  evolution: <Activity size={12} className="text-purple-500" />,
  general: <Bot size={12} className="text-slate-400" />,
};

const SOURCE_COLORS: Record<string, string> = {
  patient_context: 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800',
  notebook_lm: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
  clinical_alert: 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800',
  evolution: 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800',
  general: 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700',
};

function SourceBadges({ sources }: { sources: ResponseSource[] }) {
  if (!sources || sources.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1 mt-1" data-testid="source-badges">
      {sources.map((src, i) => (
        <span
          key={i}
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded border ${SOURCE_COLORS[src.layer]}`}
          title={src.detail}
        >
          {SOURCE_ICONS[src.layer]}
          {src.label}
        </span>
      ))}
    </div>
  );
}

interface AssistantProps {
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  professionalName?: string;
  professionalRole?: string;
  professionalId?: string;
}

const GlobalAssistant = ({ isOpen, setIsOpen, professionalName, professionalRole, professionalId }: AssistantProps) => {
  const config = useAssistantConfig();
  const { patientContext, loadPatientContext, getContextForPrompt } = useLongitudinalContext();

  // React Query — single source of truth for server data
  const { data: patients = [] } = usePatientsQuery();
  const { data: appointments = [] } = useAppointmentsQuery();

  // Zustand — UI state only
  const selectedPatientId = useAppStore(s => s.selectedPatientId);
  const setCurrentView = useAppStore(s => s.setCurrentView);
  const setSelectedPatientId = useAppStore(s => s.setSelectedPatientId);
  const setSelectedConsultorio = useAppStore(s => s.setSelectedConsultorio);
  const setEditedPlan = useAppStore(s => s.setEditedPlan);
  const setIsEditingPlan = useAppStore(s => s.setIsEditingPlan);
  const setNewReportType = useAppStore(s => s.setNewReportType);
  const setNewReportContent = useAppStore(s => s.setNewReportContent);
  const setShowReportEditor = useAppStore(s => s.setShowReportEditor);
  const setReportGuideId = useAppStore(s => s.setReportGuideId);
  const isEditingPlan = useAppStore(s => s.isEditingPlan);
  const showReportEditor = useAppStore(s => s.showReportEditor);

  // Mutations
  const queryClient = useQueryClient();
  const { handleCreatePatient, updatePatientField } = usePatientMutations(undefined);
  const { handleUpdateStatus, handleCreateAppointment } = useAppointmentMutations();

  // Derived: selectedPatient from React Query data
  const selectedPatient = useMemo(
    () => patients.find(p => p.id === selectedPatientId) || null,
    [patients, selectedPatientId]
  );

  const [isListening, setIsListening] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [volume, setVolume] = useState(0);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [textInput, setTextInput] = useState('');
  const [lastSources, setLastSources] = useState<ResponseSource[]>([]);
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; text: string }[]>(() => {
    try {
      const saved = localStorage.getItem('fonoaudio-assistant-chat');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const MAX_CHAT_MESSAGES = 50;
  const [isTextGenerating, setIsTextGenerating] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const currentSessionRef = useRef<any>(null);
  const nextStartTimeRef = useRef<number>(0);
  const selectedPatientRef = useRef<Patient | null>(null);
  const genAIRef = useRef<GoogleGenAI | null>(null);
  const notebookCacheRef = useRef<{ data: string; ts: number } | null>(null);
  const NOTEBOOK_CACHE_TTL = 300000;

  const apiKeyVal = import.meta.env.VITE_GOOGLE_API_KEY || (typeof process !== 'undefined' && process.env?.GOOGLE_API_KEY) || '';
  const hasApiKey = !!apiKeyVal;
  const isTextMode = !currentSessionRef.current || !!voiceError;

  // Persist chat messages to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('fonoaudio-assistant-chat', JSON.stringify(chatMessages));
    } catch {}
  }, [chatMessages]);

  // Prefetch notebook context in background when assistant opens
  useEffect(() => {
    if (!isOpen) return;
    if (notebookCacheRef.current && Date.now() - notebookCacheRef.current.ts < NOTEBOOK_CACHE_TTL) return;
    const backendUrl = import.meta.env.VITE_BACKEND_URL || '';
    fetch(`${backendUrl}/api/notebooklm/notebooks?limit=3`)
      .then(r => r.ok ? r.text() : null)
      .then(text => {
        if (!text) return;
        try {
          const data = JSON.parse(text);
          const nbList = Array.isArray(data) ? data : data.notebooks || [];
          if (nbList.length > 0) {
            const ctx = `\n--- NOTEBOOKLM ---\nCuadernos: ${nbList.map((n: any) => n.title).join(', ')}`;
            notebookCacheRef.current = { data: ctx, ts: Date.now() };
          }
        } catch { /* ignore non-JSON */ }
      })
      .catch(() => {});
  }, [isOpen]);

  const buildSystemPrompt = async () => {
    const today = new Date().toISOString().split('T')[0];
    const apps = appointments.filter(a => a.date === today);

    selectedPatientRef.current = selectedPatient;

    let longitudinalContext = '';
    if (selectedPatient && selectedPatient.birthDate) {
      try {
        await loadPatientContext(
          selectedPatient.id,
          selectedPatient.name,
          selectedPatient.birthDate,
          selectedPatient.diagnosis || 'No especificado'
        );
        longitudinalContext = getContextForPrompt();
      } catch {
        // Silent fail - longitudinal context stays empty
      }
    }

    const [notebookContext, nbLmResult] = await Promise.all([
      (async () => {
        if (notebookCacheRef.current && Date.now() - notebookCacheRef.current.ts < NOTEBOOK_CACHE_TTL) {
          return notebookCacheRef.current.data;
        }
        try {
          const backendUrl = import.meta.env.VITE_BACKEND_URL || '';
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 3000);
          const res = await fetch(`${backendUrl}/api/notebooklm/notebooks?limit=3`, { signal: controller.signal });
          clearTimeout(timer);
          if (!res.ok) return '';
          const text = await res.text();
          const data = JSON.parse(text);
          const nbList = Array.isArray(data) ? data : data.notebooks || [];
          if (nbList.length > 0) {
            const ctx = `\n--- NOTEBOOKLM ---\nCuadernos: ${nbList.map((n: any) => n.title).join(', ')}`;
            notebookCacheRef.current = { data: ctx, ts: Date.now() };
            return ctx;
          }
          return '';
        } catch { return ''; }
      })(),
      (async () => { return ''; })()
    ]);

    return config.buildSystemInstruction(today, apps, patients, longitudinalContext, professionalName, professionalRole, professionalId) + notebookContext + nbLmResult;
  };

  const sendTextMessage = async (text: string) => {
    if (!text.trim()) return;

    setChatMessages(prev => {
      const next = [...prev, { role: 'user' as const, text: text.trim() }];
      return next.length > MAX_CHAT_MESSAGES ? next.slice(next.length - MAX_CHAT_MESSAGES) : next;
    });

    if (currentSessionRef.current && !voiceError) {
      try {
        currentSessionRef.current.sendRealtimeInput({ text: text.trim() });
      } catch (e) {
        console.error('[VoiceAssistant] Error sending text:', e);
      }
      return;
    }

    if (!genAIRef.current || !hasApiKey) {
      if (apiKeyVal) {
        genAIRef.current = new GoogleGenAI({ apiKey: apiKeyVal });
      } else {
        setChatMessages(prev => [...prev, { role: 'assistant', text: 'Falta la API Key de Gemini (GOOGLE_API_KEY / VITE_GOOGLE_API_KEY).' }]);
        setIsTextGenerating(false);
        return;
      }
    }
    setIsTextGenerating(true);
    try {
      const systemPrompt = await buildSystemPrompt();
      const history = chatMessages.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }],
      }));

      // Include function tools for text mode (same as voice mode)
      const textModeTools = [
        {
          functionDeclarations: [
            {
              name: "navigate",
              description: "Navega a una sección de la app.",
              parameters: {
                type: GenAIType.OBJECT,
                properties: {
                  view: { type: GenAIType.STRING, enum: ["dashboard", "consultorios", "patients", "agenda", "telegram", "followup", "metrics", "analytics", "reports", "library", "multimedia", "admin", "settings", "sources", "notebooklm"] },
                  patientName: { type: GenAIType.STRING }
                },
                required: ["view"]
              }
            },
            {
              name: "list_all_patients",
              description: "Lista todos los pacientes registrados con nombre, edad, diagnóstico y consultorio.",
              parameters: { type: GenAIType.OBJECT, properties: {} }
            },
            {
              name: "get_patient_info",
              description: "Muestra información completa de un paciente.",
              parameters: {
                type: GenAIType.OBJECT,
                properties: {
                  patientName: { type: GenAIType.STRING }
                },
                required: ["patientName"]
              }
            },
            {
              name: "search_patients",
              description: "Busca pacientes por nombre, diagnóstico o notas.",
              parameters: {
                type: GenAIType.OBJECT,
                properties: {
                  query: { type: GenAIType.STRING }
                },
                required: ["query"]
              }
            },
            {
              name: "get_agenda",
              description: "Muestra agenda del día.",
              parameters: { type: GenAIType.OBJECT, properties: {} }
            },
            {
              name: "create_appointment",
              description: "Crea cita nueva.",
              parameters: {
                type: GenAIType.OBJECT,
                properties: {
                  patientName: { type: GenAIType.STRING },
                  date: { type: GenAIType.STRING },
                  time: { type: GenAIType.STRING },
                  type: { type: GenAIType.STRING, enum: ["Consulta", "Evaluación", "Seguimiento"] }
                },
                required: ["patientName", "date", "time"]
              }
            },
            {
              name: "get_statistics",
              description: "Muestra estadísticas generales.",
              parameters: { type: GenAIType.OBJECT, properties: {} }
            },
            {
              name: "create_report",
              description: "Genera informe clínico.",
              parameters: {
                type: GenAIType.OBJECT,
                properties: {
                  patientName: { type: GenAIType.STRING },
                  reportType: { type: GenAIType.STRING, enum: ["valoracion", "seguimiento", "alta", "proceso", "derivacion", "interconsulta"] }
                },
                required: ["patientName", "reportType"]
              }
            },
            {
              name: "add_patient_note",
              description: "Agrega una nota clínica a un paciente.",
              parameters: {
                type: GenAIType.OBJECT,
                properties: {
                  patientName: { type: GenAIType.STRING },
                  note: { type: GenAIType.STRING }
                },
                required: ["patientName", "note"]
              }
            },
            {
              name: "get_recent_activity",
              description: "Muestra la actividad reciente de la app (últimas 24h).",
              parameters: { type: GenAIType.OBJECT, properties: {} }
            },
            {
              name: "update_treatment_plan",
              description: "Actualiza el plan de tratamiento de un paciente.",
              parameters: {
                type: GenAIType.OBJECT,
                properties: {
                  patientName: { type: GenAIType.STRING },
                  general: { type: GenAIType.STRING },
                  strategies: { type: GenAIType.STRING }
                },
                required: ["patientName"]
              }
            },
            {
              name: "add_clinical_fact",
              description: "Registra un signo o hecho clínico para un paciente.",
              parameters: {
                type: GenAIType.OBJECT,
                properties: {
                  patientName: { type: GenAIType.STRING },
                  module: { type: GenAIType.STRING, enum: ["voice", "audiology", "cognition", "language", "motricity", "swallowing"] },
                  sign: { type: GenAIType.STRING },
                  details: { type: GenAIType.STRING }
                },
                required: ["patientName", "module", "sign"]
              }
            }
          ]
        }
      ];

      const response = await genAIRef.current.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [...history, { role: 'user', parts: [{ text }] }],
        config: {
          systemInstruction: systemPrompt,
          tools: textModeTools,
        },
      });

      // Handle function calls in text mode
      const part = response.candidates?.[0]?.content?.parts?.[0];
      if (part?.functionCall) {
        const fc = part.functionCall;
        const showFeedback = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
          window.dispatchEvent(new CustomEvent('fonoaudio-toast', { detail: { message, type } }));
        };

        let resultText = '';
        switch (fc.name) {
          case 'navigate':
            setCurrentView(fc.args.view as ViewType);
            showFeedback(`Navegando a ${fc.args.view}`, 'info');
            resultText = `Navegué a ${fc.args.view}. ¿En qué puedo ayudarte?`;
            break;
          case 'list_all_patients':
            resultText = `Tenés ${patients.length} pacientes registrados: ${patients.slice(0, 10).map(p => `${p.name} (${p.diagnosis || 'sin diagnóstico'})`).join(', ')}${patients.length > 10 ? '...' : ''}`;
            break;
          case 'get_patient_info': {
            const p = patients.find(pat => pat.name.toLowerCase().includes((fc.args.patientName as string).toLowerCase()));
            if (p) {
              setSelectedPatientId(p.id);
              setCurrentView('patients');
              resultText = `Ficha de ${p.name}: ${p.age} años, ${p.diagnosis || 'sin diagnóstico'}. ${p.history?.length || 0} sesiones.`;
            } else {
              resultText = `No encontré un paciente con el nombre "${fc.args.patientName}".`;
            }
            break;
          }
          case 'search_patients': {
            const query = (fc.args.query as string).toLowerCase();
            const results = patients.filter(p => p.name.toLowerCase().includes(query) || p.diagnosis?.toLowerCase().includes(query));
            resultText = results.length > 0
              ? `Encontré ${results.length} paciente(s): ${results.map(p => `${p.name} - ${p.diagnosis || 'sin diagnóstico'}`).join(', ')}`
              : `No encontré pacientes para "${fc.args.query}".`;
            break;
          }
          case 'get_agenda': {
            const today = new Date().toISOString().split('T')[0];
            const todayAppts = appointments.filter(a => a.date === today);
            resultText = todayAppts.length > 0
              ? `Hoy tenés ${todayAppts.length} cita(s): ${todayAppts.map(a => `${a.time} - ${patients.find(p => p.id === a.patientId)?.name || 'Desconocido'}`).join(', ')}`
              : 'No tenés citas programadas para hoy.';
            break;
          }
          case 'create_appointment':
            resultText = `Para crear la cita de ${fc.args.patientName} el ${fc.args.date} a las ${fc.args.time}, abrí la sección Agenda y completá los datos.`;
            break;
          case 'get_statistics':
            resultText = `Estadísticas: ${patients.length} pacientes, ${appointments.length} citas, ${patients.filter(p => p.reports?.length).length} con informes.`;
            break;
          case 'add_patient_note':
            resultText = `Para agregar la nota a ${fc.args.patientName}, abrí su ficha y escribí la nota en la sección correspondiente.`;
            break;
          case 'get_recent_activity':
            resultText = `Actividad reciente: ${patients.length} pacientes activos, ${appointments.filter(a => a.date === new Date().toISOString().split('T')[0]).length} citas hoy.`;
            break;
          default:
            resultText = `Acción "${fc.name}" ejecutada. ¿Necesitás algo más?`;
        }

        setChatMessages(prev => {
          const next = [...prev, { role: 'assistant' as const, text: resultText }];
          return next.length > MAX_CHAT_MESSAGES ? next.slice(next.length - MAX_CHAT_MESSAGES) : next;
        });
      } else {
        const reply = response.text || 'No pude generar una respuesta.';
        setChatMessages(prev => {
          const next = [...prev, { role: 'assistant' as const, text: reply }];
          return next.length > MAX_CHAT_MESSAGES ? next.slice(next.length - MAX_CHAT_MESSAGES) : next;
        });
      }
    } catch (e: any) {
      console.error('[TextAssistant] Error:', e);
      setChatMessages(prev => {
        const next = [...prev, { role: 'assistant' as const, text: 'Error al generar respuesta. Verificá la conexión y la API key.' }];
        return next.length > MAX_CHAT_MESSAGES ? next.slice(next.length - MAX_CHAT_MESSAGES) : next;
      });
    } finally {
      setIsTextGenerating(false);
    }
  };

  const connect = async () => {
    if (!hasApiKey) {
      setVoiceError('Falta VITE_GOOGLE_API_KEY o GOOGLE_API_KEY. Modo voz no disponible.');
      return;
    }
    setIsConnecting(true);
    genAIRef.current = new GoogleGenAI({ apiKey: apiKeyVal });
    try {
      const ai = genAIRef.current;
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      nextStartTimeRef.current = audioContextRef.current.currentTime;
      if (audioContextRef.current.state === 'suspended') await audioContextRef.current.resume();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true } });
      audioStreamRef.current = stream;

      const tools = [
        {
          functionDeclarations: [
            {
              name: "navigate",
              description: "Navega a una sección de la app.",
              parameters: {
                type: GenAIType.OBJECT,
                properties: {
                  view: { type: GenAIType.STRING, enum: ["dashboard", "consultorios", "patients", "agenda", "telegram", "followup", "metrics", "analytics", "reports", "library", "multimedia", "admin", "settings", "sources", "notebooklm"] },
                  patientName: { type: GenAIType.STRING }
                },
                required: ["view"]
              }
            },
            {
              name: "open_editor",
              description: "Abre plan de tratamiento o informe.",
              parameters: {
                type: GenAIType.OBJECT,
                properties: {
                  type: { type: GenAIType.STRING, enum: ["treatment_plan", "report"] },
                  patientName: { type: GenAIType.STRING }
                },
                required: ["type"]
              }
            },
            {
              name: "update_patient_info",
              description: "Actualiza dato de paciente.",
              parameters: {
                type: GenAIType.OBJECT,
                properties: {
                  field: { type: GenAIType.STRING, enum: ["diagnosis", "notes", "phone"] },
                  value: { type: GenAIType.STRING },
                  patientName: { type: GenAIType.STRING }
                },
                required: ["field", "value"]
              }
            },
            {
              name: "get_agenda",
              description: "Muestra agenda del día.",
              parameters: { type: GenAIType.OBJECT, properties: {} }
            },
            {
              name: "create_appointment",
              description: "Crea cita nueva.",
              parameters: {
                type: GenAIType.OBJECT,
                properties: {
                  patientName: { type: GenAIType.STRING },
                  date: { type: GenAIType.STRING },
                  time: { type: GenAIType.STRING },
                  type: { type: GenAIType.STRING, enum: ["Consulta", "Evaluación", "Seguimiento"] }
                },
                required: ["patientName", "date", "time"]
              }
            },
            {
              name: "update_appointment_status",
              description: "Cambia estado de cita.",
              parameters: {
                type: GenAIType.OBJECT,
                properties: {
                  patientName: { type: GenAIType.STRING },
                  newStatus: { type: GenAIType.STRING, enum: ["completed", "cancelled", "confirmed"] }
                },
                required: ["patientName", "newStatus"]
              }
            },
            {
              name: "send_telegram_message",
              description: "Envía mensaje de Telegram al profesional.",
              parameters: {
                type: GenAIType.OBJECT,
                properties: {
                  message: { type: GenAIType.STRING }
                },
                required: ["message"]
              }
            },
            {
              name: "send_patient_summary",
              description: "Envía resumen de paciente por Telegram.",
              parameters: {
                type: GenAIType.OBJECT,
                properties: {
                  patientName: { type: GenAIType.STRING }
                },
                required: ["patientName"]
              }
            },
            {
              name: "send_telegram_reminder",
              description: "Envía recordatorio con emojis por Telegram.",
              parameters: {
                type: GenAIType.OBJECT,
                properties: {
                  title: { type: GenAIType.STRING },
                  message: { type: GenAIType.STRING },
                  patientName: { type: GenAIType.STRING }
                },
                required: ["title", "message"]
              }
            },
            {
              name: "create_report",
              description: "Genera informe clínico.",
              parameters: {
                type: GenAIType.OBJECT,
                properties: {
                  patientName: { type: GenAIType.STRING },
                  reportType: { type: GenAIType.STRING, enum: ["valoracion", "seguimiento", "alta", "proceso", "derivacion", "interconsulta"] }
                },
                required: ["patientName", "reportType"]
              }
            },
            {
              name: "list_all_patients",
              description: "Lista todos los pacientes registrados con nombre, edad, diagnóstico y consultorio.",
              parameters: { type: GenAIType.OBJECT, properties: {} }
            },
            {
              name: "get_patient_info",
              description: "Muestra información completa de un paciente: demografía, diagnóstico, historial, tratamientos, informes.",
              parameters: {
                type: GenAIType.OBJECT,
                properties: {
                  patientName: { type: GenAIType.STRING }
                },
                required: ["patientName"]
              }
            },
            {
              name: "search_patients",
              description: "Busca pacientes por nombre, diagnóstico o notas.",
              parameters: {
                type: GenAIType.OBJECT,
                properties: {
                  query: { type: GenAIType.STRING }
                },
                required: ["query"]
              }
            },
            {
              name: "list_consultorios",
              description: "Lista todos los consultorios/ambulatorios del sistema.",
              parameters: { type: GenAIType.OBJECT, properties: {} }
            },
            {
              name: "get_patients_by_consultorio",
              description: "Muestra los pacientes registrados en un consultorio específico.",
              parameters: {
                type: GenAIType.OBJECT,
                properties: {
                  consultorioName: { type: GenAIType.STRING }
                },
                required: ["consultorioName"]
              }
            },
            {
              name: "get_statistics",
              description: "Muestra estadísticas generales: total pacientes, citas, informes, materiales.",
              parameters: { type: GenAIType.OBJECT, properties: {} }
            },
            {
              name: "update_treatment_plan",
              description: "Actualiza el plan de tratamiento de un paciente.",
              parameters: {
                type: GenAIType.OBJECT,
                properties: {
                  patientName: { type: GenAIType.STRING },
                  general: { type: GenAIType.STRING },
                  strategies: { type: GenAIType.STRING }
                },
                required: ["patientName"]
              }
            },
            {
              name: "add_evaluation",
              description: "Agrega una evaluación clínica (test, puntuación, notas) a un paciente.",
              parameters: {
                type: GenAIType.OBJECT,
                properties: {
                  patientName: { type: GenAIType.STRING },
                  testName: { type: GenAIType.STRING },
                  score: { type: GenAIType.NUMBER },
                  maxScore: { type: GenAIType.NUMBER },
                  notes: { type: GenAIType.STRING }
                },
                required: ["patientName", "testName", "score"]
              }
            },
            {
              name: "get_patient_reports",
              description: "Lista los informes clínicos de un paciente.",
              parameters: {
                type: GenAIType.OBJECT,
                properties: {
                  patientName: { type: GenAIType.STRING },
                  reportType: { type: GenAIType.STRING }
                },
                required: ["patientName"]
              }
            },
            {
              name: "delete_appointment",
              description: "Elimina una cita de un paciente.",
              parameters: {
                type: GenAIType.OBJECT,
                properties: {
                  patientName: { type: GenAIType.STRING },
                  date: { type: GenAIType.STRING }
                },
                required: ["patientName", "date"]
              }
            },
            {
              name: "update_appointment",
              description: "Modifica una cita existente (fecha, hora, tipo, estado).",
              parameters: {
                type: GenAIType.OBJECT,
                properties: {
                  patientName: { type: GenAIType.STRING },
                  date: { type: GenAIType.STRING },
                  time: { type: GenAIType.STRING },
                  type: { type: GenAIType.STRING },
                  status: { type: GenAIType.STRING }
                },
                required: ["patientName"]
              }
            },
            {
              name: "delete_patient",
              description: "Elimina un paciente del sistema.",
              parameters: {
                type: GenAIType.OBJECT,
                properties: {
                  patientName: { type: GenAIType.STRING }
                },
                required: ["patientName"]
              }
            },
            {
              name: "add_patient_note",
              description: "Agrega una nota clínica a un paciente.",
              parameters: {
                type: GenAIType.OBJECT,
                properties: {
                  patientName: { type: GenAIType.STRING },
                  note: { type: GenAIType.STRING }
                },
                required: ["patientName", "note"]
              }
            },
            {
              name: "get_recent_activity",
              description: "Muestra la actividad reciente de la app (últimas 24h).",
              parameters: { type: GenAIType.OBJECT, properties: {} }
            },
            {
              name: "add_clinical_fact",
              description: "Registra un signo o hecho clínico para un paciente en un módulo clínico (voz, audición, cognición, lenguaje, motricidad, deglución).",
              parameters: {
                type: GenAIType.OBJECT,
                properties: {
                  patientName: { type: GenAIType.STRING },
                  module: { type: GenAIType.STRING, enum: ["voice", "audiology", "cognition", "language", "motricity", "swallowing"] },
                  sign: { type: GenAIType.STRING },
                  details: { type: GenAIType.STRING }
                },
                required: ["patientName", "module", "sign"]
              }
            },
            {
              name: "get_clinical_facts",
              description: "Muestra los signos/hechos clínicos registrados de un paciente, opcionalmente filtrados por módulo.",
              parameters: {
                type: GenAIType.OBJECT,
                properties: {
                  patientName: { type: GenAIType.STRING },
                  module: { type: GenAIType.STRING }
                },
                required: ["patientName"]
              }
            },
            {
              name: "get_module_analysis",
              description: "Obtiene el análisis clínico de un módulo específico para un paciente (nivel de riesgo, banderas rojas, observaciones, acciones recomendadas).",
              parameters: {
                type: GenAIType.OBJECT,
                properties: {
                  patientName: { type: GenAIType.STRING },
                  module: { type: GenAIType.STRING, enum: ["voice", "audiology", "cognition", "language", "motricity", "swallowing"] }
                },
                required: ["patientName", "module"]
              }
            },
            {
              name: "list_sessions",
              description: "Lista las sesiones clínicas de un paciente.",
              parameters: {
                type: GenAIType.OBJECT,
                properties: {
                  patientName: { type: GenAIType.STRING },
                  limit: { type: GenAIType.NUMBER }
                },
                required: ["patientName"]
              }
            },
            {
              name: "get_followup_alerts",
              description: "Muestra alertas de seguimiento pendientes (fallos de entrega, tendencias clínicas, sugerencias).",
              parameters: {
                type: GenAIType.OBJECT,
                properties: {
                  patientName: { type: GenAIType.STRING }
                }
              }
            },
            {
              name: "add_evolution_entry",
              description: "Registra una entrada de evolución clínica para un eje (voz, lenguaje, deglución, audición, motricidad_orofacial, cognición).",
              parameters: {
                type: GenAIType.OBJECT,
                properties: {
                  patientName: { type: GenAIType.STRING },
                  axis: { type: GenAIType.STRING, enum: ["voz", "lenguaje", "deglucion", "audicion", "motricidad_orofacial", "cognicion"] },
                  notes: { type: GenAIType.STRING },
                  riskLevel: { type: GenAIType.STRING, enum: ["normal", "atencion", "alerta", "critico"] }
                },
                required: ["patientName", "axis", "notes"]
              }
            },
            {
              name: "get_evolution_status",
              description: "Muestra el estado actual de un eje clínico (último nivel de riesgo, tendencia, hallazgos principales).",
              parameters: {
                type: GenAIType.OBJECT,
                properties: {
                  patientName: { type: GenAIType.STRING },
                  axis: { type: GenAIType.STRING, enum: ["voz", "lenguaje", "deglucion", "audicion", "motricidad_orofacial", "cognicion"] }
                },
                required: ["patientName", "axis"]
              }
            },
            {
              name: "get_nba_suggestions",
              description: "Muestra sugerencias inteligentes (Next Best Action) pendientes para un paciente.",
              parameters: {
                type: GenAIType.OBJECT,
                properties: {
                  patientName: { type: GenAIType.STRING }
                },
                required: ["patientName"]
              }
            },
            {
              name: "generate_home_guide",
              description: "Genera un borrador de guía para el hogar basado en la última sesión del paciente.",
              parameters: {
                type: GenAIType.OBJECT,
                properties: {
                  patientName: { type: GenAIType.STRING }
                },
                required: ["patientName"]
              }
            },
            {
              name: "search_materials",
              description: "Busca materiales en la biblioteca por título, área clínica o tipo.",
              parameters: {
                type: GenAIType.OBJECT,
                properties: {
                  query: { type: GenAIType.STRING },
                  clinicalArea: { type: GenAIType.STRING }
                },
                required: ["query"]
              }
            },
            {
              name: "generate_content",
              description: "Genera contenido clínico con IA: listas de palabras, actividades, guías para padres, posts para redes, etc.",
              parameters: {
                type: GenAIType.OBJECT,
                properties: {
                  prompt: { type: GenAIType.STRING, description: "Descripción detallada de lo que se necesita generar" },
                  clinicalArea: { type: GenAIType.STRING, description: "Área clínica: Voz, Habla, Lenguaje, Deglución, Audiología, Motricidad oral, Comunicación" }
                },
                required: ["prompt"]
              }
            },
            {
              name: "get_test_results",
              description: "Muestra resultados de tests estandarizados de un paciente.",
              parameters: {
                type: GenAIType.OBJECT,
                properties: {
                  patientName: { type: GenAIType.STRING }
                },
                required: ["patientName"]
              }
            },
            {
              name: "sync_google_calendar",
              description: "Sincroniza la agenda con Google Calendar.",
              parameters: { type: GenAIType.OBJECT, properties: {} }
            },
            {
              name: "create_meet_link",
              description: "Genera un enlace de Google Meet para una teleconsulta.",
              parameters: {
                type: GenAIType.OBJECT,
                properties: {
                  patientName: { type: GenAIType.STRING }
                }
              }
            },
            {
              name: "get_finance_summary",
              description: "Muestra resumen financiero: ingresos, pagos pendientes, deudas.",
              parameters: { type: GenAIType.OBJECT, properties: {} }
            },
            {
              name: "record_payment",
              description: "Registra un pago de un paciente.",
              parameters: {
                type: GenAIType.OBJECT,
                properties: {
                  patientName: { type: GenAIType.STRING },
                  amount: { type: GenAIType.NUMBER },
                  method: { type: GenAIType.STRING, enum: ["cash", "transfer", "card", "debit"] }
                },
                required: ["patientName", "amount"]
              }
            },
            {
              name: "toggle_dark_mode",
              description: "Cambia entre modo claro y oscuro.",
              parameters: { type: GenAIType.OBJECT, properties: {} }
            },
            {
              name: "get_professional_info",
              description: "Muestra la información del profesional logueado (nombre, rol, configuración).",
              parameters: { type: GenAIType.OBJECT, properties: {} }
            }
          ]
        }
      ];

      const today = new Date().toISOString().split('T')[0];
      const apps = appointments.filter(a => a.date === today);

      selectedPatientRef.current = selectedPatient;

      // Load contexts — need this before building system instruction
      let longitudinalContext = '';
      if (selectedPatient && selectedPatient.birthDate) {
        try {
          await loadPatientContext(
            selectedPatient.id,
            selectedPatient.name,
            selectedPatient.birthDate,
            selectedPatient.diagnosis || 'No especificado'
          );
          longitudinalContext = getContextForPrompt();
        } catch {
          // Silent fail - longitudinal context stays empty
        }
      }

      const notebookContext = (notebookCacheRef.current && Date.now() - notebookCacheRef.current.ts < NOTEBOOK_CACHE_TTL)
        ? notebookCacheRef.current.data
        : '';

      const systemInstruction = config.buildVoiceSystemInstruction(today, apps, patients, professionalName, professionalRole, professionalId);
      const filteredTools = config.filterToolsByPermissions(tools);

      const session = await ai.live.connect({
        model: "gemini-2.5-flash-native-audio-preview-09-2025",
        config: {
          tools: filteredTools,
          systemInstruction: systemInstruction,
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: config.voice.name } } }
        },
        callbacks: {
          onopen: () => {
            setIsConnecting(false);
            setIsListening(true);
            const source = audioContextRef.current!.createMediaStreamSource(audioStreamRef.current!);
            const processor = audioContextRef.current!.createScriptProcessor(2048, 1, 1);
            processor.onaudioprocess = (e) => {
              if (!isOpen) return;
              const inputData = e.inputBuffer.getChannelData(0);
              let sum = 0; for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
              setVolume(Math.sqrt(sum / inputData.length) * 5);
              const pcmData = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) pcmData[i] = inputData[i] * 32767;
              let binary = ''; const bytes = new Uint8Array(pcmData.buffer);
              for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
              try { session.sendRealtimeInput({ media: { mimeType: "audio/pcm;rate=24000", data: btoa(binary) } }); } catch (e) { console.error('[GlobalAssistant] sendRealtimeInput error:', e); }
            };
            source.connect(processor);
            processor.connect(audioContextRef.current!.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
            // Helper: show toast + add to chat for visual feedback
            const showFeedback = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
              window.dispatchEvent(new CustomEvent('fonoaudio-toast', { detail: { message, type } }));
            };
            const addChatMessage = (text: string) => {
              setChatMessages(prev => {
                const next = [...prev, { role: 'assistant' as const, text }];
                return next.length > MAX_CHAT_MESSAGES ? next.slice(next.length - MAX_CHAT_MESSAGES) : next;
              });
            };

            if (msg.serverContent?.modelTurn?.parts?.[0]?.inlineData) {
              const audioBytes = base64ToUint8Array(msg.serverContent.modelTurn.parts[0].inlineData.data);
              if (audioContextRef.current) {
                const audioBuffer = await decodeAudioData(audioBytes, audioContextRef.current, 24000, 1);
                const source = audioContextRef.current.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(audioContextRef.current.destination);
                const start = Math.max(audioContextRef.current.currentTime, nextStartTimeRef.current);
                source.start(start);
                nextStartTimeRef.current = start + audioBuffer.duration;
              }
            }
            if (msg.toolCall) {
              const responses = [];
              for (const fc of msg.toolCall.functionCalls) {
                let result: any = { status: "ok" };
                try {
                  const toolPerm = config.filterToolsByPermissions([{ functionDeclarations: [{ name: fc.name }] }])[0]?.functionDeclarations?.[0];
                  if (!toolPerm) {
                    result = { error: "Permiso denegado para esta acción", tool: fc.name, requiredPermission: "ver Configuración > Asistente IA > Permisos" };
                    responses.push({ name: fc.name, response: result, id: fc.id });
                    continue;
                  }
                  switch (fc.name) {
                    case "navigate": {
                      const view = fc.args.view as ViewType;
                      const viewLabels: Record<string, string> = { dashboard: 'Dashboard', consultorios: 'Consultorios', patients: 'Pacientes', agenda: 'Agenda', telegram: 'Canal Clínico', followup: 'Seguimiento', metrics: 'Métricas IA', analytics: 'Analytics', reports: 'Informes', library: 'Biblioteca', multimedia: 'Multimedia', admin: 'Administración', settings: 'Configuración', sources: 'Fuentes Clínicas', notebooklm: 'NotebookLM' };
                      if (fc.args.patientName) {
                        const p = patients.find(pat => pat.name.toLowerCase().includes((fc.args.patientName as string).toLowerCase()));
                        if (p) {
                          setSelectedPatientId(p.id);
                          setCurrentView("patients");
                          showFeedback(`Abriendo ficha de ${p.name}`, 'success');
                          result = { success: true, navigatedTo: 'patients', patient: p.name, message: `Navegando a la ficha de ${p.name}.` };
                        } else {
                          result = { error: "No encontrado", availableViews: Object.keys(viewLabels), message: `No encontré un paciente con el nombre "${fc.args.patientName}".` };
                        }
                      } else if (view === 'consultorios') {
                        setSelectedPatientId(null);
                        setSelectedConsultorio(null);
                        setCurrentView('consultorios');
                        showFeedback('Abriendo Consultorios', 'info');
                        result = { success: true, navigatedTo: 'consultorios', message: 'Te llevó a Consultorios. Ahí podés seleccionar un consultorio para ver sus pacientes.' };
                      } else {
                        setCurrentView(view);
                        showFeedback(`Navegando a ${viewLabels[view] || view}`, 'info');
                        result = { success: true, navigatedTo: view, message: `Navegando a ${viewLabels[view] || view}.` };
                      }
                      break;
                    }
                    case "open_editor":
                      let targetP = selectedPatient;
                      if (!targetP && fc.args.patientName) {
                        targetP = patients.find(pat => pat.name.toLowerCase().includes((fc.args.patientName as string).toLowerCase())) || null;
                        if (targetP) { setSelectedPatientId(targetP.id); setCurrentView("patients"); }
                      }
                      if (targetP) {
                        if (fc.args.type === "treatment_plan") {
                          setEditedPlan(targetP.treatmentPlan?.strategies || TREATMENT_PLAN_TEMPLATE);
                          setIsEditingPlan(true);
                        } else {
                          setNewReportType("evaluacion");
                          const guide = REPORT_GUIDES["valoracion"];
                          const defaultContent = guide
                            ? guide.sections.map(s => `<h2>${s.title}</h2>${s.defaultContent || ''}`).join('')
                            : '';
                          setNewReportContent(defaultContent);
                          setShowReportEditor(true);
                        }
                        result = { success: true };
                      } else result = { error: "Sin paciente" };
                      break;
                    case "write_in_editor":
                      const txt = fc.args.content as string;
                      const mode = fc.args.mode as string || "append";
                      if (isEditingPlan) setEditedPlan(prev => mode === 'replace' ? txt : prev + txt);
                      else if (showReportEditor) setNewReportContent(prev => mode === 'replace' ? txt : prev + txt);
                      result = { success: true };
                      break;
                    case "update_patient_info":
                      let pInfo = selectedPatient;
                      if (!pInfo && fc.args.patientName) pInfo = patients.find(pat => pat.name.toLowerCase().includes((fc.args.patientName as string).toLowerCase())) || null;
                      if (pInfo) {
                        const f = fc.args.field as string; const v = fc.args.value as string;
                        console.log(`[VoiceAssistant] SENSITIVE: update_patient_info field=${f} patient=${pInfo.name}`);
                        await updatePatientField({ patientId: pInfo.id, field: f, value: f === 'age' ? Number(v) : v });
                        result = { success: true };
                      } else result = { error: "No encontrado" };
                      break;
                    case "analyze_patient_case":
                      const pCase = patients.find(pat => pat.name.toLowerCase().includes((fc.args.patientName as string).toLowerCase()));
                      if (pCase) result = { patient: pCase.name, diagnosis: pCase.diagnosis, history: pCase.history };
                      else result = { error: "No encontrado" };
                      break;
                    case "get_agenda": {
                      const today = new Date().toISOString().split('T')[0];
                      const futureAppts = appointments.filter(a => a.status !== 'cancelled' && a.date >= today);
                      const todayAppts = futureAppts.filter(a => a.date === today);
                      setCurrentView('agenda');
                      showFeedback(`Mostrando ${todayAppts.length} citas de hoy`, 'info');
                      result = {
                        appointments: futureAppts.map(a => ({ patient: a.patient_name, date: a.date, time: a.time, status: a.status, type: a.type })),
                        total: futureAppts.length,
                        todayCount: todayAppts.length,
                        message: todayAppts.length > 0
                          ? `Tenés ${todayAppts.length} cita(s) hoy. ${futureAppts.length > todayAppts.length ? `Y ${futureAppts.length - todayAppts.length} más próximamente.` : ''}`
                          : `No tenés citas para hoy. Tenés ${futureAppts.length} cita(s) próximas.`
                      };
                      break;
                    }
                    case "create_patient": {
                      console.log(`[VoiceAssistant] SENSITIVE: create_patient name=${fc.args.name}`);
                      await handleCreatePatient({
                        id: crypto.randomUUID(), name: fc.args.name as string, age: Number(fc.args.age), diagnosis: fc.args.diagnosis as string, phone: fc.args.phone as string || "",
                        email: "", document: "", notes: "", treatmentPlan: { general: "", specific: [], strategies: TREATMENT_PLAN_TEMPLATE }, history: [], evaluations: [], documents: [], reports: []
                      });
                      showFeedback(`Paciente "${fc.args.name}" creado`, 'success');
                      result = { success: true, message: `Paciente "${fc.args.name}" creado exitosamente.` };
                      break;
                    }
                    case "check_missing_data":
                      result = { missing: patients.filter(p => !p.document).map(p => p.name) };
                      break;
                    case "update_appointment_status": {
                      console.log(`[VoiceAssistant] SENSITIVE: update_appointment_status patient=${fc.args.patientName} status=${fc.args.newStatus}`);
                      const appt = appointments.find(a => a.patient_name?.toLowerCase().includes((fc.args.patientName as string).toLowerCase()) && a.status !== 'completed' && a.status !== 'cancelled');
                      if (appt) {
                        await handleUpdateStatus({ appId: appt.id, newStatus: fc.args.newStatus as string });
                        showFeedback(`Cita de ${fc.args.patientName} marcada como ${fc.args.newStatus}`, 'success');
                        result = { success: true, message: `Cita de ${fc.args.patientName} actualizada a "${fc.args.newStatus}".` };
                      }
                      else result = { error: "No encontrado", message: `No encontré una cita pendiente para "${fc.args.patientName}".` };
                      break;
                    }
                    case "create_appointment": {
                      console.log(`[VoiceAssistant] SENSITIVE: create_appointment patient=${fc.args.patientName} date=${fc.args.date} time=${fc.args.time}`);
                      const targetPatient = patients.find(p => p.name.toLowerCase().includes((fc.args.patientName as string).toLowerCase()));
                      if (!targetPatient) {
                        result = { error: `No encontré un paciente con el nombre "${fc.args.patientName}". Creá el paciente primero con create_patient.`, message: `No encontré a "${fc.args.patientName}".` };
                        break;
                      }
                      try {
                        const newAppt = await handleCreateAppointment({
                          patient_id: targetPatient.id,
                          patient_name: targetPatient.name,
                          date: fc.args.date as string,
                          time: fc.args.time as string,
                          status: 'pending',
                          type: (fc.args.type as string) || 'Consulta',
                          professional_id: professionalId || undefined,
                          notes: (fc.args.notes as string) || '',
                          duration: fc.args.duration ? Number(fc.args.duration) : undefined,
                        });
                        showFeedback(`Cita creada: ${targetPatient.name} el ${fc.args.date} a las ${fc.args.time}`, 'success');
                        result = {
                          success: true,
                          appointment: { id: newAppt.id, patient: targetPatient.name, date: fc.args.date, time: fc.args.time, type: fc.args.type || 'Consulta', status: 'pending' },
                          message: `Cita creada para ${targetPatient.name} el ${fc.args.date} a las ${fc.args.time} hs.`
                        };
                      } catch (e: any) {
                        result = { error: `Error creando cita: ${e.message || 'Error desconocido'}` };
                      }
                      break;
                    }
                    case "send_telegram_message": {
                      console.log(`[VoiceAssistant] SENSITIVE: send_telegram_message`);
                      const tgSettings = getTelegramSettings();
                      const backendUrl = import.meta.env.VITE_BACKEND_URL || '';
                      const payload: any = { message: fc.args.message as string };
                      if (tgSettings.chatId) payload.chatId = tgSettings.chatId;
                      result = { success: true, message: "Enviando mensaje por Telegram..." };
                      fetch(`${backendUrl}/api/telegram/send`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload),
                      }).then(r => r.json()).then(d => {
                        console.log('[VoiceAssistant] Telegram send result:', d);
                        if (d.status === 'ok') {
                          window.dispatchEvent(new CustomEvent('fonoaudio-toast', { detail: { message: 'Mensaje enviado a Telegram', type: 'success' } }));
                        } else {
                          window.dispatchEvent(new CustomEvent('fonoaudio-toast', { detail: { message: `Error Telegram: ${d.message}`, type: 'error' } }));
                        }
                      }).catch(e => {
                        console.error('[VoiceAssistant] Telegram send error:', e);
                      });
                      break;
                    }
                    case "send_patient_summary": {
                      console.log(`[VoiceAssistant] SENSITIVE: send_patient_summary patient=${fc.args.patientName}`);
                      const tgSettings2 = getTelegramSettings();
                      const pSummary = patients.find(p => p.name.toLowerCase().includes((fc.args.patientName as string).toLowerCase()));
                      if (!pSummary) {
                        result = { error: `No encontré un paciente con el nombre "${fc.args.patientName}".` };
                        break;
                      }
                      const nextAppt = appointments.find(a => a.patient_name?.toLowerCase().includes(pSummary.name.toLowerCase()) && (a.status === 'pending' || a.status === 'confirmed'));
                      const summaryLines = [
                        `RESUMEN CLÍNICO`,
                        ``,
                        `Paciente: ${pSummary.name}`,
                        `Edad: ${pSummary.age || 'No informada'}`,
                        `Diagnóstico: ${stripHtml(pSummary.diagnosis || 'No especificado')}`,
                        `Teléfono: ${pSummary.phone || 'No registrado'}`,
                      ];
                      if (pSummary.treatmentPlan?.strategies) {
                        const strats = Array.isArray(pSummary.treatmentPlan.strategies)
                          ? pSummary.treatmentPlan.strategies.slice(0, 5).map((s: string) => `• ${stripHtml(s)}`).join('\n')
                          : `• ${stripHtml(String(pSummary.treatmentPlan.strategies).substring(0, 200))}`;
                        summaryLines.push(``, `Plan de Tratamiento:`);
                        summaryLines.push(strats);
                      }
                      if (pSummary.history && Array.isArray(pSummary.history) && pSummary.history.length > 0) {
                        summaryLines.push(``, `Últimas sesiones: ${pSummary.history.length} registradas`);
                        const last3 = pSummary.history.slice(-3);
                        last3.forEach((h: any) => {
                          summaryLines.push(`• ${h.date}: ${stripHtml(h.notes || h.type || 'Sin notas')}`);
                        });
                      }
                      if (nextAppt) {
                        summaryLines.push(``, `Próxima cita: ${nextAppt.date} a las ${nextAppt.time} (${nextAppt.status})`);
                      } else {
                        summaryLines.push(``, `Próxima cita: Sin turnos programados`);
                      }
                      if (pSummary.alerts && pSummary.alerts.length > 0) {
                        summaryLines.push(``, `Alertas: ${pSummary.alerts.join(', ')}`);
                      }
                      const backendUrl2 = import.meta.env.VITE_BACKEND_URL || '';
                      const tgPayload: any = { message: summaryLines.join('\n') };
                      if (tgSettings2.chatId) tgPayload.chatId = tgSettings2.chatId;
                      result = { success: true, message: `Enviando resumen de ${pSummary.name} por Telegram...` };
                      fetch(`${backendUrl2}/api/telegram/send`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(tgPayload),
                      }).then(r => r.json()).then(d => {
                        console.log('[VoiceAssistant] Telegram summary result:', d);
                        if (d.status === 'ok') {
                          window.dispatchEvent(new CustomEvent('fonoaudio-toast', { detail: { message: `Resumen de ${pSummary.name} enviado a Telegram`, type: 'success' } }));
                        } else {
                          window.dispatchEvent(new CustomEvent('fonoaudio-toast', { detail: { message: `Error Telegram: ${d.message}`, type: 'error' } }));
                        }
                      }).catch(e => {
                        console.error('[VoiceAssistant] Telegram summary error:', e);
                        window.dispatchEvent(new CustomEvent('fonoaudio-toast', { detail: { message: `Error conexión Telegram: ${e.message}`, type: 'error' } }));
                      });
                      break;
                    }
                    case "send_telegram_media": {
                      console.log(`[VoiceAssistant] SENSITIVE: send_telegram_media type=${fc.args.mediaType}`);
                      const tgSettings3 = getTelegramSettings();
                      const backendUrl3 = import.meta.env.VITE_BACKEND_URL || '';
                      const mediaPayload: any = {
                        [fc.args.mediaType as string]: fc.args.mediaUrl as string,
                        caption: (fc.args.caption as string) || (fc.args.patientName ? `Paciente: ${fc.args.patientName}` : ''),
                      };
                      if (tgSettings3.chatId) mediaPayload.chatId = tgSettings3.chatId;
                      result = { success: true, message: `Enviando ${fc.args.mediaType} por Telegram...` };
                      fetch(`${backendUrl3}/api/telegram/send`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(mediaPayload),
                      }).then(r => r.json()).then(d => {
                        console.log('[VoiceAssistant] Telegram media result:', d);
                        if (d.status === 'ok') {
                          window.dispatchEvent(new CustomEvent('fonoaudio-toast', { detail: { message: `${fc.args.mediaType} enviado a Telegram`, type: 'success' } }));
                        } else {
                          window.dispatchEvent(new CustomEvent('fonoaudio-toast', { detail: { message: `Error Telegram: ${d.message}`, type: 'error' } }));
                        }
                      }).catch(e => {
                        console.error('[VoiceAssistant] Telegram media error:', e);
                      });
                      break;
                    }
                    case "send_telegram_reminder": {
                      console.log(`[VoiceAssistant] SENSITIVE: send_telegram_reminder title=${fc.args.title}`);
                      const tgSettings4 = getTelegramSettings();
                      const backendUrl4 = import.meta.env.VITE_BACKEND_URL || '';
                      let reminderText = `🔔 ${fc.args.title}\n\n${fc.args.message}`;
                      if (fc.args.appointmentDate) reminderText += `\n📅 Fecha: ${fc.args.appointmentDate}`;
                      if (fc.args.appointmentTime) reminderText += `\n🕐 Hora: ${fc.args.appointmentTime}`;
                      if (fc.args.patientName) reminderText += `\n👤 Paciente: ${fc.args.patientName}`;
                      reminderText += `\n\n_FonoAudio Pro - Asistente Clínico_`;
                      const reminderPayload: any = { message: reminderText };
                      if (tgSettings4.chatId) reminderPayload.chatId = tgSettings4.chatId;
                      result = { success: true, message: "Recordatorio enviado por Telegram." };
                      fetch(`${backendUrl4}/api/telegram/send`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(reminderPayload),
                      }).then(r => r.json()).then(d => {
                        console.log('[VoiceAssistant] Telegram reminder result:', d);
                        if (d.status === 'ok') {
                          window.dispatchEvent(new CustomEvent('fonoaudio-toast', { detail: { message: 'Recordatorio enviado a Telegram', type: 'success' } }));
                        } else {
                          window.dispatchEvent(new CustomEvent('fonoaudio-toast', { detail: { message: `Error Telegram: ${d.message}`, type: 'error' } }));
                        }
                      }).catch(e => {
                        console.error('[VoiceAssistant] Telegram reminder error:', e);
                      });
                      break;
                    }
                    case "create_report": {
                      console.log(`[VoiceAssistant] SENSITIVE: create_report patient=${fc.args.patientName} type=${fc.args.reportType}`);
                      const pReport = patients.find(pat => pat.name.toLowerCase().includes((fc.args.patientName as string).toLowerCase()));
                      if (!pReport) {
                        result = { error: `No encontré un paciente con el nombre "${fc.args.patientName}".`, message: `No encontré a "${fc.args.patientName}".` };
                        break;
                      }
                      setSelectedPatientId(pReport.id);
                      setCurrentView("patients");
                      const reportType = fc.args.reportType as string;
                      const guideKey = reportType === 'evaluacion' ? 'valoracion' : reportType;
                      const guide = REPORT_GUIDES[guideKey];
                      if (guide) {
                        setReportGuideId(guideKey);
                        setShowReportEditor(true);
                        showFeedback(`Abriendo ${guide.title} para ${pReport.name}`, 'success');
                        result = { success: true, report: { type: reportType, guide: guide.title, patient: pReport.name }, message: `Abriendo ${guide.title} para ${pReport.name}.` };
                      } else {
                        const available = Object.keys(REPORT_GUIDES).join(', ');
                        result = { error: `Tipo "${reportType}" no disponible.`, message: `Tipo "${reportType}" no disponible. Tipos: ${available}` };
                      }
                      break;
                    }
                    case "get_patient_documents": {
                      const pDocs = patients.find(pat => pat.name.toLowerCase().includes((fc.args.patientName as string).toLowerCase()));
                      if (!pDocs) {
                        result = { error: `No encontré un paciente con el nombre "${fc.args.patientName}".`, message: `No encontré a "${fc.args.patientName}".` };
                        break;
                      }
                      const docs = (pDocs.documents || []).map((d: any) => ({
                        name: d.name || d.filename || 'Sin nombre',
                        type: d.type || d.fileType || 'unknown',
                        date: d.date || d.uploadDate || 'Sin fecha',
                      }));
                      const reports = (pDocs.reports || []).map((r: any) => ({
                        type: r.type || 'Sin tipo',
                        date: r.date || 'Sin fecha',
                      }));
                      showFeedback(`${docs.length} documentos, ${reports.length} informes de ${pDocs.name}`, 'info');
                      result = { patient: pDocs.name, documents: docs, reports: reports, totalDocuments: docs.length, totalReports: reports.length, message: `${pDocs.name}: ${docs.length} documento(s) y ${reports.length} informe(s).` };
                      break;
                    }
                    case "list_all_patients": {
                      const list = patients.map(p => ({
                        name: p.name,
                        age: p.age,
                        diagnosis: p.diagnosis || 'Sin diagnóstico',
                        consultorio: (p as any).consultorio || (p as any).consultorio_id || 'Sin asignar',
                        phone: p.phone || '',
                        quickStatus: (p as any).quick_status || 'active'
                      }));
                      setCurrentView('patients');
                      showFeedback(`Mostrando ${list.length} pacientes`, 'info');
                      result = { patients: list, total: list.length, message: `Encontré ${list.length} pacientes. Los muestro en la sección Pacientes.` };
                      break;
                    }
                    case "get_patient_info": {
                      const pInfo2 = patients.find(pat => pat.name.toLowerCase().includes((fc.args.patientName as string).toLowerCase()));
                      if (!pInfo2) {
                        result = { error: `No encontré un paciente con el nombre "${fc.args.patientName}".`, message: `No encontré a "${fc.args.patientName}".` };
                        break;
                      }
                      setSelectedPatientId(pInfo2.id);
                      setCurrentView("patients");
                      showFeedback(`Abriendo ficha de ${pInfo2.name}`, 'success');
                      result = {
                        patient: {
                          name: pInfo2.name,
                          age: pInfo2.age,
                          diagnosis: pInfo2.diagnosis || 'Sin diagnóstico',
                          phone: pInfo2.phone || 'Sin teléfono',
                          email: pInfo2.email || 'Sin email',
                          document: pInfo2.document || 'Sin documento',
                          notes: pInfo2.notes || 'Sin notas',
                          consultorio: (pInfo2 as any).consultorio || 'Sin asignar',
                          responsable: (pInfo2 as any).responsable || 'Sin asignar',
                          derivante: (pInfo2 as any).derivante || 'Sin asignar',
                          obraSocial: (pInfo2 as any).obraSocial || (pInfo2 as any).obra_social || 'Sin asignar',
                          consentSigned: (pInfo2 as any).consentSigned || false,
                          historyCount: pInfo2.history?.length || 0,
                          evaluationsCount: pInfo2.evaluations?.length || 0,
                          reportsCount: pInfo2.reports?.length || 0,
                          documentsCount: pInfo2.documents?.length || 0,
                          treatmentPlan: pInfo2.treatmentPlan?.general || 'Sin plan',
                          alerts: pInfo2.alerts || [],
                          quickStatus: (pInfo2 as any).quick_status || 'active'
                        },
                        message: `Aquí está la información de ${pInfo2.name}, ${pInfo2.age || '?'} años, diagnóstico: ${pInfo2.diagnosis || 'no especificado'}.`
                      };
                      break;
                    }
                    case "search_patients": {
                      const q = ((fc.args.query as string) || '').toLowerCase();
                      const results = patients.filter(p =>
                        p.name.toLowerCase().includes(q) ||
                        (p.diagnosis || '').toLowerCase().includes(q) ||
                        (p.notes || '').toLowerCase().includes(q)
                      ).map(p => ({ name: p.name, age: p.age, diagnosis: p.diagnosis || 'Sin diagnóstico' }));
                      result = { query: fc.args.query, results, total: results.length, message: results.length > 0 ? `Encontré ${results.length} paciente(s) para "${fc.args.query}".` : `No encontré pacientes para "${fc.args.query}".` };
                      break;
                    }
                    case "list_consultorios": {
                      try {
                        const { data: consultorios, error } = await supabase.from('consultorios').select('*').eq('is_active', true);
                        if (error) throw error;
                        showFeedback(`Mostrando ${(consultorios || []).length} consultorios`, 'info');
                        result = { consultorios: (consultorios || []).map((c: any) => ({ id: c.id, name: c.name, color: c.color, icon: c.icon })), total: (consultorios || []).length, message: `Tenés ${(consultorios || []).length} consultorio(s) registrado(s).` };
                      } catch (e: any) {
                        result = { error: `Error consultando consultorios: ${e.message}`, message: `Error: ${e.message}` };
                      }
                      break;
                    }
                    case "get_patients_by_consultorio": {
                      const cName = ((fc.args.consultorioName as string) || '').toLowerCase();
                      try {
                        const { data: consultorios } = await supabase.from('consultorios').select('id, name').eq('is_active', true);
                        const matched = (consultorios || []).find((c: any) => c.name.toLowerCase().includes(cName));
                        if (!matched) {
                          result = { error: `No encontré un consultorio con el nombre "${fc.args.consultorioName}".`, message: `No encontré consultorio "${fc.args.consultorioName}". Disponibles: ${(consultorios || []).map((c: any) => c.name).join(', ')}` };
                          break;
                        }
                        const patientsInRoom = patients.filter(p => (p as any).consultorio_id === matched.id || (p as any).consultorio === matched.name);
                        showFeedback(`${patientsInRoom.length} pacientes en ${matched.name}`, 'info');
                        result = {
                          consultorio: matched.name,
                          patients: patientsInRoom.map(p => ({ name: p.name, age: p.age, diagnosis: p.diagnosis || 'Sin diagnóstico' })),
                          total: patientsInRoom.length,
                          message: `${patientsInRoom.length} paciente(s) en ${matched.name}.`
                        };
                      } catch (e: any) {
                        result = { error: `Error: ${e.message}`, message: `Error: ${e.message}` };
                      }
                      break;
                    }
                    case "get_statistics": {
                      const today2 = new Date().toISOString().split('T')[0];
                      const totalPatients = patients.length;
                      const totalAppointments = appointments.length;
                      const pendingAppointments = appointments.filter(a => a.date >= today2 && a.status === 'pending').length;
                      const completedToday = appointments.filter(a => a.date === today2 && a.status === 'completed').length;
                      const patientsWithoutDocument = patients.filter(p => !p.document).length;
                      const patientsWithoutPhone = patients.filter(p => !p.phone).length;
                      const patientsByConsultorio: Record<string, number> = {};
                      patients.forEach(p => {
                        const c = (p as any).consultorio || (p as any).consultorio_id || 'Sin asignar';
                        patientsByConsultorio[c] = (patientsByConsultorio[c] || 0) + 1;
                      });
                      showFeedback(`Estadísticas: ${totalPatients} pacientes, ${pendingAppointments} citas pendientes`, 'info');
                      result = {
                        totalPatients,
                        totalAppointments,
                        pendingAppointments,
                        completedToday,
                        patientsWithoutDocument,
                        patientsWithoutPhone,
                        patientsByConsultorio,
                        message: `${totalPatients} pacientes en total. ${pendingAppointments} citas pendientes. ${completedToday} completadas hoy.`
                      };
                      break;
                    }
                    case "update_treatment_plan": {
                      const pPlan = patients.find(pat => pat.name.toLowerCase().includes((fc.args.patientName as string).toLowerCase()));
                      if (!pPlan) {
                        result = { error: `No encontré un paciente con el nombre "${fc.args.patientName}".`, message: `No encontré a "${fc.args.patientName}".` };
                        break;
                      }
                      const updates: any = {};
                      if (fc.args.general) updates.treatmentPlan = { ...pPlan.treatmentPlan, general: fc.args.general };
                      if (fc.args.strategies) updates.treatmentPlan = { ...(updates.treatmentPlan || pPlan.treatmentPlan), strategies: fc.args.strategies };
                      await updatePatientField({ patientId: pPlan.id, field: 'treatmentPlan', value: updates.treatmentPlan || pPlan.treatmentPlan });
                      showFeedback(`Plan de ${pPlan.name} actualizado`, 'success');
                      result = { success: true, patient: pPlan.name, message: `Plan de tratamiento de ${pPlan.name} actualizado.` };
                      break;
                    }
                    case "add_evaluation": {
                      const pEval = patients.find(pat => pat.name.toLowerCase().includes((fc.args.patientName as string).toLowerCase()));
                      if (!pEval) {
                        result = { error: `No encontré un paciente con el nombre "${fc.args.patientName}".`, message: `No encontré a "${fc.args.patientName}".` };
                        break;
                      }
                      const newEval = {
                        id: crypto.randomUUID(),
                        testName: fc.args.testName as string,
                        score: Number(fc.args.score),
                        maxScore: fc.args.maxScore ? Number(fc.args.maxScore) : undefined,
                        notes: (fc.args.notes as string) || '',
                        date: new Date().toISOString().split('T')[0]
                      };
                      const currentEvals = pEval.evaluations || [];
                      await updatePatientField({ patientId: pEval.id, field: 'evaluations', value: [...currentEvals, newEval] });
                      showFeedback(`Evaluación "${fc.args.testName}" guardada para ${pEval.name}`, 'success');
                      result = { success: true, patient: pEval.name, evaluation: newEval, message: `Evaluación "${fc.args.testName}" (${fc.args.score} puntos) guardada para ${pEval.name}.` };
                      break;
                    }
                    case "get_patient_reports": {
                      const pRpts = patients.find(pat => pat.name.toLowerCase().includes((fc.args.patientName as string).toLowerCase()));
                      if (!pRpts) {
                        result = { error: `No encontré un paciente con el nombre "${fc.args.patientName}".`, message: `No encontré a "${fc.args.patientName}".` };
                        break;
                      }
                      let rpts = (pRpts.reports || []) as any[];
                      if (fc.args.reportType) rpts = rpts.filter((r: any) => r.type === fc.args.reportType);
                      showFeedback(`${rpts.length} informes de ${pRpts.name}`, 'info');
                      result = {
                        patient: pRpts.name,
                        reports: rpts.slice(0, 10).map((r: any) => ({ type: r.type, title: r.title || r.type, date: r.date, contentLength: (r.content || '').length })),
                        total: rpts.length,
                        message: `${pRpts.name}: ${rpts.length} informe(s) disponible(s).`
                      };
                      break;
                    }
                    case "delete_appointment": {
                      const pDel = patients.find(pat => pat.name.toLowerCase().includes((fc.args.patientName as string).toLowerCase()));
                      if (!pDel) { result = { error: `No encontré "${fc.args.patientName}".`, message: `No encontré a "${fc.args.patientName}".` }; break; }
                      const apptDel = appointments.find(a => a.patient_name?.toLowerCase().includes(pDel.name.toLowerCase()) && a.date === fc.args.date);
                      if (!apptDel) { result = { error: `No encontré cita para ${pDel.name} el ${fc.args.date}.`, message: `No encontré cita para ${pDel.name} el ${fc.args.date}.` }; break; }
                      await supabase.from('appointments').delete().eq('id', apptDel.id);
                      queryClient.invalidateQueries({ queryKey: ['appointments'] });
                      showFeedback(`Cita de ${pDel.name} eliminada`, 'success');
                      result = { success: true, message: `Cita de ${pDel.name} el ${fc.args.date} eliminada.` };
                      break;
                    }
                    case "update_appointment": {
                      const pUpd = patients.find(pat => pat.name.toLowerCase().includes((fc.args.patientName as string).toLowerCase()));
                      if (!pUpd) { result = { error: `No encontré "${fc.args.patientName}".`, message: `No encontré a "${fc.args.patientName}".` }; break; }
                      const apptUpd = appointments.find(a => a.patient_name?.toLowerCase().includes(pUpd.name.toLowerCase()) && a.status !== 'completed' && a.status !== 'cancelled');
                      if (!apptUpd) { result = { error: `No encontré cita pendiente para ${pUpd.name}.`, message: `No encontré cita pendiente para ${pUpd.name}.` }; break; }
                      const updates2: any = {};
                      if (fc.args.date) updates2.date = fc.args.date;
                      if (fc.args.time) updates2.time = fc.args.time;
                      if (fc.args.type) updates2.type = fc.args.type;
                      if (fc.args.status) updates2.status = fc.args.status;
                      await supabase.from('appointments').update(updates2).eq('id', apptUpd.id);
                      queryClient.invalidateQueries({ queryKey: ['appointments'] });
                      showFeedback(`Cita de ${pUpd.name} actualizada`, 'success');
                      result = { success: true, message: `Cita de ${pUpd.name} actualizada.`, updates: updates2 };
                      break;
                    }
                    case "delete_patient": {
                      const pDel2 = patients.find(pat => pat.name.toLowerCase().includes((fc.args.patientName as string).toLowerCase()));
                      if (!pDel2) { result = { error: `No encontré "${fc.args.patientName}".`, message: `No encontré a "${fc.args.patientName}".` }; break; }
                      await supabase.from('patients').delete().eq('id', pDel2.id);
                      queryClient.invalidateQueries({ queryKey: ['patients'] });
                      if (selectedPatientId === pDel2.id) setSelectedPatientId(null);
                      showFeedback(`Paciente "${pDel2.name}" eliminado`, 'success');
                      result = { success: true, message: `Paciente "${pDel2.name}" eliminado del sistema.` };
                      break;
                    }
                    case "add_patient_note": {
                      const pNote = patients.find(pat => pat.name.toLowerCase().includes((fc.args.patientName as string).toLowerCase()));
                      if (!pNote) { result = { error: `No encontré "${fc.args.patientName}".`, message: `No encontré a "${fc.args.patientName}".` }; break; }
                      const timestamp = new Date().toLocaleString('es-AR');
                      const newNotes = `${pNote.notes || ''}\n[${timestamp}] ${fc.args.note}`;
                      await updatePatientField({ patientId: pNote.id, field: 'notes', value: newNotes });
                      showFeedback(`Nota agregada a ${pNote.name}`, 'success');
                      result = { success: true, message: `Nota agregada a ${pNote.name}: "${fc.args.note}".` };
                      break;
                    }
                    case "get_recent_activity": {
                      try {
                        const { data: activity } = await supabase.from('v_recent_activity').select('*').limit(15);
                        showFeedback(`${(activity || []).length} actividades recientes`, 'info');
                        result = { activity: activity || [], total: (activity || []).length, message: `${(activity || []).length} actividad(es) reciente(s) encontrada(s).` };
                      } catch (e: any) {
                        result = { error: `Error: ${e.message}`, message: `Error cargando actividad: ${e.message}` };
                      }
                      break;
                    }
                    case "add_clinical_fact": {
                      const pFact = patients.find(pat => pat.name.toLowerCase().includes((fc.args.patientName as string).toLowerCase()));
                      if (!pFact) { result = { error: `No encontré "${fc.args.patientName}".`, message: `No encontré a "${fc.args.patientName}".` }; break; }
                      try {
                        const { error } = await supabase.from('clinical_facts').insert({
                          id: crypto.randomUUID(),
                          patient_id: pFact.id,
                          category: fc.args.module as string,
                          sign: fc.args.sign as string,
                          details: (fc.args.details as string) || '',
                          is_resolved: false,
                          created_at: new Date().toISOString()
                        });
                        if (error) throw error;
                        showFeedback(`Signo "${fc.args.sign}" registrado`, 'success');
                        result = { success: true, message: `Signo "${fc.args.sign}" registrado en módulo ${fc.args.module} para ${pFact.name}.` };
                      } catch (e: any) { result = { error: `Error: ${e.message}`, message: `Error guardando: ${e.message}` }; }
                      break;
                    }
                    case "get_clinical_facts": {
                      const pFacts = patients.find(pat => pat.name.toLowerCase().includes((fc.args.patientName as string).toLowerCase()));
                      if (!pFacts) { result = { error: `No encontré "${fc.args.patientName}".`, message: `No encontré a "${fc.args.patientName}".` }; break; }
                      try {
                        let query = supabase.from('clinical_facts').select('*').eq('patient_id', pFacts.id).order('created_at', { ascending: false }).limit(20);
                        if (fc.args.module) query = query.eq('category', fc.args.module);
                        const { data, error } = await query;
                        if (error) throw error;
                        showFeedback(`${(data || []).length} hechos clínicos de ${pFacts.name}`, 'info');
                        result = { patient: pFacts.name, facts: (data || []).map((f: any) => ({ sign: f.sign, details: f.details, category: f.category, isResolved: f.is_resolved, date: f.created_at })), total: (data || []).length, message: `${pFacts.name}: ${(data || []).length} hecho(s) clínico(s) registrado(s).` };
                      } catch (e: any) { result = { error: `Error: ${e.message}`, message: `Error: ${e.message}` }; }
                      break;
                    }
                    case "get_module_analysis": {
                      const pMod = patients.find(pat => pat.name.toLowerCase().includes((fc.args.patientName as string).toLowerCase()));
                      if (!pMod) { result = { error: `No encontré "${fc.args.patientName}".`, message: `No encontré a "${fc.args.patientName}".` }; break; }
                      try {
                        const { data: analyses } = await supabase.from('analysis_history').select('*').eq('patient_id', pMod.id).eq('module_id', fc.args.module).order('created_at', { ascending: false }).limit(5);
                        const latest = (analyses || [])[0];
                        showFeedback(`Análisis de módulo ${fc.args.module} para ${pMod.name}`, 'info');
                        result = {
                          patient: pMod.name,
                          module: fc.args.module,
                          latestAnalysis: latest ? { riskLevel: latest.risk_level || latest.result_summary, date: latest.created_at, data: latest.analysis_data } : null,
                          historyCount: (analyses || []).length,
                          message: latest ? `Último análisis de ${fc.args.module} para ${pMod.name}: riesgo ${latest.risk_level || 'sin nivel'}.` : `No hay análisis previos de ${fc.args.module} para ${pMod.name}.`
                        };
                      } catch (e: any) { result = { error: `Error: ${e.message}`, message: `Error: ${e.message}` }; }
                      break;
                    }
                    case "list_sessions": {
                      const pSess = patients.find(pat => pat.name.toLowerCase().includes((fc.args.patientName as string).toLowerCase()));
                      if (!pSess) { result = { error: `No encontré "${fc.args.patientName}".`, message: `No encontré a "${fc.args.patientName}".` }; break; }
                      try {
                        const limit = fc.args.limit ? Number(fc.args.limit) : 10;
                        const { data: sessions } = await supabase.from('sessions').select('id, date, status, notes, summary').eq('patient_id', pSess.id).order('date', { ascending: false }).limit(limit);
                        showFeedback(`${(sessions || []).length} sesiones de ${pSess.name}`, 'info');
                        result = { patient: pSess.name, sessions: (sessions || []).map((s: any) => ({ id: s.id, date: s.date, status: s.status, notes: (s.notes || '').substring(0, 100), summary: (s.summary || '').substring(0, 100) })), total: (sessions || []).length, message: `${pSess.name}: ${(sessions || []).length} sesión(es) registrada(s).` };
                      } catch (e: any) { result = { error: `Error: ${e.message}`, message: `Error: ${e.message}` }; }
                      break;
                    }
                    case "get_followup_alerts": {
                      try {
                        let query = supabase.from('clinical_suggestion_events').select('*').eq('event_type', 'shown').order('timestamp', { ascending: false }).limit(20);
                        if (fc.args.patientName) {
                          const pFu = patients.find(pat => pat.name.toLowerCase().includes((fc.args.patientName as string).toLowerCase()));
                          if (pFu) query = query.eq('patient_id', pFu.id);
                        }
                        const { data: alerts } = await query;
                        showFeedback(`${(alerts || []).length} alertas de seguimiento`, 'info');
                        result = { alerts: (alerts || []).map((a: any) => ({ type: a.suggestion_type, severity: a.severity, signal: a.signal, patientId: a.patient_id, date: a.timestamp })), total: (alerts || []).length, message: `${(alerts || []).length} alerta(s) de seguimiento activa(s).` };
                      } catch (e: any) { result = { error: `Error: ${e.message}`, message: `Error: ${e.message}` }; }
                      break;
                    }
                    case "add_evolution_entry": {
                      const pEvo = patients.find(pat => pat.name.toLowerCase().includes((fc.args.patientName as string).toLowerCase()));
                      if (!pEvo) { result = { error: `No encontré "${fc.args.patientName}".`, message: `No encontré a "${fc.args.patientName}".` }; break; }
                      try {
                        const { error } = await supabase.from('clinical_evolution_entries').insert({
                          patient_id: pEvo.id,
                          axis: fc.args.axis as string,
                          date: new Date().toISOString(),
                          source: 'manual',
                          signs: [],
                          measures: {},
                          risk_level: (fc.args.riskLevel as string) || 'normal',
                          notes: fc.args.notes as string,
                          actions: [],
                          status: 'active'
                        });
                        if (error) throw error;
                        showFeedback(`Evolución registrada en eje "${fc.args.axis}"`, 'success');
                        result = { success: true, message: `Evolución registrada en eje "${fc.args.axis}" para ${pEvo.name}.` };
                      } catch (e: any) { result = { error: `Error: ${e.message}`, message: `Error guardando: ${e.message}` }; }
                      break;
                    }
                    case "get_evolution_status": {
                      const pEvoSt = patients.find(pat => pat.name.toLowerCase().includes((fc.args.patientName as string).toLowerCase()));
                      if (!pEvoSt) { result = { error: `No encontré "${fc.args.patientName}".`, message: `No encontré a "${fc.args.patientName}".` }; break; }
                      try {
                        const { data: entries } = await supabase.from('clinical_evolution_entries').select('*').eq('patient_id', pEvoSt.id).eq('axis', fc.args.axis as string).order('date', { ascending: false }).limit(5);
                        const latest = (entries || [])[0];
                        const prev = (entries || [])[1];
                        let trend = 'stable';
                        if (latest && prev) {
                          const riskOrder: Record<string, number> = { normal: 0, atencion: 1, alerta: 2, critico: 3 };
                          const curr = riskOrder[latest.risk_level] || 0;
                          const prv = riskOrder[prev.risk_level] || 0;
                          if (curr > prv) trend = 'worsening';
                          else if (curr < prv) trend = 'improving';
                        }
                        showFeedback(`Evolución eje "${fc.args.axis}" de ${pEvoSt.name}: ${latest?.risk_level || 'sin datos'}`, 'info');
                        result = {
                          patient: pEvoSt.name,
                          axis: fc.args.axis,
                          currentRisk: latest?.risk_level || 'sin datos',
                          trend,
                          latestNotes: latest?.notes || '',
                          latestDate: latest?.date || '',
                          totalEntries: (entries || []).length,
                          message: `Evolución de ${pEvoSt.name} en eje "${fc.args.axis}": riesgo ${latest?.risk_level || 'sin datos'}, tendencia ${trend}.`
                        };
                      } catch (e: any) { result = { error: `Error: ${e.message}`, message: `Error: ${e.message}` }; }
                      break;
                    }
                    case "get_nba_suggestions": {
                      const pNba = patients.find(pat => pat.name.toLowerCase().includes((fc.args.patientName as string).toLowerCase()));
                      if (!pNba) { result = { error: `No encontré "${fc.args.patientName}".`, message: `No encontré a "${fc.args.patientName}".` }; break; }
                      try {
                        const { data: suggestions } = await supabase.from('nba_suggestions').select('*').eq('patient_id', pNba.id).eq('status', 'pending').order('created_at', { ascending: false }).limit(10);
                        showFeedback(`${(suggestions || []).length} sugerencias NBA para ${pNba.name}`, 'info');
                        result = { patient: pNba.name, suggestions: (suggestions || []).map((s: any) => ({ id: s.id, title: s.title, description: s.description, confidence: s.confidence_or_strength, module: s.module_id })), total: (suggestions || []).length, message: `${pNba.name}: ${(suggestions || []).length} sugerencia(s) NBA pendiente(s).` };
                      } catch (e: any) { result = { error: `Error: ${e.message}`, message: `Error: ${e.message}` }; }
                      break;
                    }
                    case "generate_home_guide": {
                      result = { message: `Para generar la guía para el hogar de ${fc.args.patientName}, abrí la sección de Sesiones y usá el asistente de guías.`, tip: "Podés navegar a la sección de pacientes y abrir la guía del paciente." };
                      break;
                    }
                    case "search_materials": {
                      try {
                        let query = supabase.from('materials').select('*').ilike('title', `%${fc.args.query}%`).limit(10);
                        if (fc.args.clinicalArea) query = query.eq('clinical_area', fc.args.clinicalArea);
                        const { data: materials } = await query;
                        showFeedback(`${(materials || []).length} materiales encontrados`, 'info');
                        result = { query: fc.args.query, materials: (materials || []).map((m: any) => ({ id: m.id, title: m.title, type: m.type, category: m.category, clinicalArea: m.clinical_area })), total: (materials || []).length, message: `${(materials || []).length} material(es) encontrado(s) para "${fc.args.query}".` };
                      } catch (e: any) { result = { error: `Error: ${e.message}`, message: `Error: ${e.message}` }; }
                      break;
                    }
                    case "generate_content": {
                      try {
                        showFeedback('Generando contenido con IA...', 'info');
                        const { generateText } = await import('../utils/geminiHelpers');
                        const area = (fc.args.clinicalArea as string) || 'General';

                        // Pull NotebookLM context if available
                        let nbContext = '';
                        try {
                          const nbResp = await fetch(`${import.meta.env.VITE_BACKEND_URL || ''}/api/notebooklm/notebooks`);
                          if (nbResp.ok) {
                            const nbText = await nbResp.text();
                            const nbData = JSON.parse(nbText);
                            if (nbData.notebooks?.length > 0) {
                              const summaryResp = await fetch(`${import.meta.env.VITE_BACKEND_URL || ''}/api/notebooklm/notebooks/${nbData.notebooks[0].id}/summary`);
                              if (summaryResp.ok) {
                                const summaryText = await summaryResp.text();
                                const summaryData = JSON.parse(summaryText);
                                if (summaryData.summary) nbContext = `\n\nCONTEXTO DE INVESTIGACIÓN (NotebookLM):\n${summaryData.summary}`;
                              }
                            }
                          }
                        } catch (e) { /* NotebookLM not available, continue without */ }

                        // Pull clinical sources context
                        let sourcesContext = '';
                        try {
                          const { data: sources } = await supabase.from('clinical_sources').select('id, title, category').limit(3);
                          if (sources?.length) {
                            sourcesContext = `\n\nFUENTES CLÍNICAS DISPONIBLES:\n${sources.map((s: any) => `- ${s.title}`).join('\n')}`;
                          }
                        } catch (e) { /* sources not available */ }

                        const contentPrompt = `Sos un asistente de fonoaudiología clínica. Generá contenido profesional para el área de ${area}.
${nbContext}${sourcesContext}

FORMATO: Usá markdown. Incluí: objetivo clínico, nivel etario recomendado, y consejos de implementación.

PEDIDO:
${fc.args.prompt}`;
                        const generated = await generateText(contentPrompt);
                        if (generated) {
                          showFeedback('Contenido generado', 'success');
                          result = { content: generated, area, message: `Contenido generado para ${area}. podés verlo en Multimedia > IA Generativa.` };
                        } else {
                          result = { error: 'No se pudo generar. Verificá la API key.', message: 'Error: no se pudo generar contenido.' };
                        }
                      } catch (e: any) { result = { error: `Error: ${e.message}`, message: `Error generando: ${e.message}` }; }
                      break;
                    }
                    case "get_test_results": {
                      const pTest = patients.find(pat => pat.name.toLowerCase().includes((fc.args.patientName as string).toLowerCase()));
                      if (!pTest) { result = { error: `No encontré "${fc.args.patientName}".`, message: `No encontré a "${fc.args.patientName}".` }; break; }
                      try {
                        const { data: tests } = await supabase.from('test_results').select('*').eq('patient_id', pTest.id).order('test_date', { ascending: false }).limit(10);
                        showFeedback(`${(tests || []).length} tests de ${pTest.name}`, 'info');
                        result = { patient: pTest.name, tests: (tests || []).map((t: any) => ({ name: t.test_name || t.test_acronym, score: t.raw_score, maxScore: t.max_score, percentile: t.percentile, classification: t.classification, date: t.test_date })), total: (tests || []).length, message: `${pTest.name}: ${(tests || []).length} resultado(s) de test(s).` };
                      } catch (e: any) { result = { error: `Error: ${e.message}`, message: `Error: ${e.message}` }; }
                      break;
                    }
                    case "sync_google_calendar": {
                      try {
                        const backendUrl = import.meta.env.VITE_BACKEND_URL || '';
                        const resp = await fetch(`${backendUrl}/api/google/calendar/sync`, { method: 'POST' });
                        const data = await resp.json();
                        if (data.status === 'ok') {
                          showFeedback('Calendario sincronizado', 'success');
                          result = { success: true, message: `Calendario sincronizado. ${data.synced || 0} eventos actualizados.` };
                        } else { result = { error: data.message || 'Error sincronizando', message: `Error: ${data.message}` }; }
                      } catch (e: any) { result = { error: `Error: ${e.message}`, message: `Error: ${e.message}` }; }
                      break;
                    }
                    case "create_meet_link": {
                      try {
                        const backendUrl = import.meta.env.VITE_BACKEND_URL || '';
                        const resp = await fetch(`${backendUrl}/api/google/meet`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ patientName: fc.args.patientName }) });
                        const data = await resp.json();
                        if (data.meetLink) {
                          showFeedback('Enlace Meet generado', 'success');
                          result = { success: true, meetLink: data.meetLink, message: `Enlace de Meet generado: ${data.meetLink}` };
                        } else { result = { error: data.message || 'Error generando enlace', message: `Error: ${data.message}` }; }
                      } catch (e: any) { result = { error: `Error: ${e.message}`, message: `Error: ${e.message}` }; }
                      break;
                    }
                    case "get_finance_summary": {
                      try {
                        const stored = localStorage.getItem('fonoaudio-finance');
                        if (stored) {
                          const finance = JSON.parse(stored);
                          const fees = finance.fees || [];
                          const payments = finance.payments || [];
                          const totalRevenue = payments.filter((p: any) => p.status === 'paid').reduce((sum: number, p: any) => sum + (p.amount || 0), 0);
                          const pending = payments.filter((p: any) => p.status === 'pending');
                          showFeedback(`Resumen financiero: $${totalRevenue} cobrado`, 'info');
                          result = { totalRevenue, pendingCount: pending.length, pendingAmount: pending.reduce((sum: number, p: any) => sum + (p.amount || 0), 0), feesCount: fees.length, paymentsCount: payments.length, message: `Cobrado: $${totalRevenue}. Pendiente: ${pending.length} pagos ($${pending.reduce((sum: number, p: any) => sum + (p.amount || 0), 0)}).` };
                        } else { result = { message: 'Datos financieros no configurados. Andá a Configuración > Finanzas.' }; }
                      } catch (e: any) { result = { error: `Error: ${e.message}`, message: `Error: ${e.message}` }; }
                      break;
                    }
                    case "record_payment": {
                      const pPay = patients.find(pat => pat.name.toLowerCase().includes((fc.args.patientName as string).toLowerCase()));
                      if (!pPay) { result = { error: `No encontré "${fc.args.patientName}".`, message: `No encontré a "${fc.args.patientName}".` }; break; }
                      try {
                        const stored = localStorage.getItem('fonoaudio-finance');
                        const finance = stored ? JSON.parse(stored) : { fees: [], payments: [] };
                        const payment = { id: crypto.randomUUID(), patientId: pPay.id, patientName: pPay.name, amount: Number(fc.args.amount), method: fc.args.method || 'cash', status: 'paid', date: new Date().toISOString() };
                        finance.payments = [...(finance.payments || []), payment];
                        localStorage.setItem('fonoaudio-finance', JSON.stringify(finance));
                        showFeedback(`Pago de $${fc.args.amount} registrado para ${pPay.name}`, 'success');
                        result = { success: true, message: `Pago de $${fc.args.amount} registrado para ${pPay.name} via ${fc.args.method || 'efectivo'}.` };
                      } catch (e: any) { result = { error: `Error: ${e.message}`, message: `Error: ${e.message}` }; }
                      break;
                    }
                    case "toggle_dark_mode": {
                      document.documentElement.classList.toggle('dark');
                      const isDark = document.documentElement.classList.contains('dark');
                      showFeedback(`Modo ${isDark ? 'oscuro' : 'claro'} activado`, 'info');
                      result = { success: true, mode: isDark ? 'oscuro' : 'claro', message: `Modo ${isDark ? 'oscuro' : 'claro'} activado.` };
                      break;
                    }
                    case "get_professional_info": {
                      result = { name: professionalName || 'No configurado', role: professionalRole || 'Profesional', id: professionalId || 'No disponible', message: `Profesional: ${professionalName || 'No configurado'} (${professionalRole || 'Profesional'}).` };
                      break;
                    }
                    }
                  } catch (e) { result = { error: "Error ejecutando herramienta" }; }
                  responses.push({ name: fc.name, response: result, id: fc.id });
                }
                try {
                  session.sendToolResponse({ functionResponses: responses });
                } catch (e) {
                  console.warn('[VoiceAssistant] Could not send tool response (session may be closed):', e);
                }
              }
            },
            onclose: () => { setIsListening(false); setIsConnecting(false); },
            onerror: (e) => { setIsConnecting(false); genAIRef.current = new GoogleGenAI({ apiKey: import.meta.env.VITE_GOOGLE_API_KEY }); setVoiceError('Voz no disponible. Modo texto activo.'); }
          },
      });
      currentSessionRef.current = session;
    } catch (error) {
      genAIRef.current = new GoogleGenAI({ apiKey: apiKeyVal });
      setIsConnecting(false);
      setVoiceError('Voz no disponible. Modo texto activo.');
    }
  };

  const disconnect = () => {
    if (currentSessionRef.current) {
      try { currentSessionRef.current.close(); } catch (e) { console.error('[GlobalAssistant] Session close error:', e); }
      currentSessionRef.current = null;
    }
    if (audioContextRef.current) {
      if (audioContextRef.current.state !== 'closed') {
        try { audioContextRef.current.close(); } catch (e) { console.error('[GlobalAssistant] AudioContext close error:', e); }
      }
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach(track => track.stop());
      audioStreamRef.current = null;
    }
    setIsListening(false);
    setIsConnecting(false);
  };

  useEffect(() => {
    if (isOpen) {
      if (hasApiKey) genAIRef.current = new GoogleGenAI({ apiKey: import.meta.env.VITE_GOOGLE_API_KEY });
      connect();
    } else {
      disconnect();
    }
    return () => disconnect();
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl p-4 w-80 mb-4 border border-blue-100 dark:border-blue-900/50 animate-in slide-in-from-bottom-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Bot className="text-blue-600 dark:text-blue-400" />
            <h3 className="font-bold text-slate-800 dark:text-white">Fono-Pro AI</h3>
          </div>
          <div className="flex items-center gap-1">
            {chatMessages.length > 0 && (
              <button onClick={() => setChatMessages([])} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded text-slate-400 hover:text-red-500 transition-colors" title="Limpiar chat">
                <Trash2 size={14} />
              </button>
            )}
            <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded">
              <Minimize2 size={18} className="text-slate-400" />
            </button>
          </div>
        </div>

        {voiceError && (
          <div className="mb-3 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-xs text-blue-700 dark:text-blue-400">
            {voiceError}
          </div>
        )}

        {!hasApiKey && !voiceError && (
          <div className="mb-3 p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2" data-testid="voice-mode-pending">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            Modo voz pendiente — falta VITE_GOOGLE_API_KEY
          </div>
        )}

        {patientContext && (
          <div className="mb-3 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-xs" data-testid="patient-context-indicator">
            <div className="flex items-center gap-1 text-blue-700 dark:text-blue-400 font-medium">
              <Database size={12} />
              Contexto activo: {patientContext.patientName}
            </div>
            <div className="text-blue-600 dark:text-blue-500 mt-0.5">
              {patientContext.ageGroup} · {patientContext.motivoConsulta}
            </div>
          </div>
        )}

        <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 h-48 overflow-y-auto border border-slate-200 dark:border-slate-700 mb-3" data-testid="chat-messages">
          {chatMessages.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              {isConnecting ? (
                <Loader2 className="animate-spin text-blue-500 dark:text-blue-400" />
              ) : (
                <div className="text-center text-xs text-slate-400 dark:text-slate-500">
                  <Bot size={24} className="mx-auto mb-1 opacity-50" />
                  <p>Escribí o decí tu consulta</p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {chatMessages.map((msg, i) => (
                <div key={i} className={`text-xs p-2 rounded-lg ${msg.role === 'user' ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 ml-4' : 'bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 mr-4 border border-slate-200 dark:border-slate-600'}`}>
                  {msg.text}
                </div>
              ))}
              {isTextGenerating && (
                <div className="bg-white dark:bg-slate-700 text-slate-400 dark:text-slate-500 mr-4 border border-slate-200 dark:border-slate-600 text-xs p-2 rounded-lg inline-flex items-center gap-1">
                  <Loader2 size={10} className="animate-spin" /> Pensando...
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-3 flex gap-2">
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && textInput.trim() && !isTextGenerating) {
                sendTextMessage(textInput);
                setTextInput('');
              }
            }}
            placeholder="Escribí un mensaje..."
            disabled={isTextGenerating}
            className="flex-1 px-3 py-3 min-h-[44px] text-sm border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-blue-400 bg-white dark:bg-slate-800 text-slate-700 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 disabled:opacity-50"
            data-testid="assistant-text-input"
          />
          <button
            onClick={() => { if (textInput.trim()) { sendTextMessage(textInput); setTextInput(''); } }}
            disabled={!textInput.trim() || isTextGenerating}
            className="px-4 py-3 min-h-[44px] min-w-[44px] flex items-center justify-center bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white rounded-lg transition-colors"
          >
            {isTextGenerating ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          </button>
        </div>

        {lastSources.length > 0 && (
          <div className="mt-2" data-testid="response-sources">
            <div className="text-[10px] text-slate-400 dark:text-slate-500 mb-0.5">Fuentes de la respuesta:</div>
            <SourceBadges sources={lastSources} />
          </div>
        )}

        <p className="text-xs text-center mt-2 text-slate-400 dark:text-slate-500">
          {isListening ? "Escuchando..." : isTextGenerating ? "Generando respuesta..." : !hasApiKey ? "Modo texto (sin API key de voz)" : isTextMode ? "Modo texto activo" : "Conectando voz..."}
        </p>
      </div>
    </div>
  );
};

export default GlobalAssistant;
export { TREATMENT_PLAN_TEMPLATE } from "../types/reports";

import { TelegramMessage, TelegramLogEntry } from '../types/channels';
import { supabase } from '../utils/supabaseClient';
import { GoogleGenAI, Type as GenAIType } from '@google/genai';

const TELEGRAM_LOG_KEY = 'fonoaudio_telegram_log';
const TELEGRAM_MESSAGES_KEY = 'fonoaudio_telegram_messages';
const TELEGRAM_OFFSET_KEY = 'fonoaudio_telegram_offset';
const MAX_LOG_ENTRIES = 200;
const POLL_INTERVAL_MS = 5000;

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

let pollTimer: ReturnType<typeof setInterval> | null = null;
let onMessageCallback: ((msg: TelegramIncomingMessage) => void) | null = null;

export interface TelegramIncomingMessage {
  id: number;
  chatId: number;
  from: string;
  text?: string;
  photo?: { file_id: string; file_unique_id: string }[];
  audio?: { file_id: string; duration?: number; title?: string };
  video?: { file_id: string; duration?: number };
  document?: { file_id: string; file_name?: string; mime_type?: string };
  voice?: { file_id: string; duration?: number };
  caption?: string;
  date: number;
}

export class TelegramService {
  private static botToken: string = '';
  private static chatId: string = '';

  static configure(botToken: string, chatId?: string) {
    this.botToken = botToken;
    this.chatId = chatId || '';
  }

  static isConfigured(): boolean {
    return !!this.botToken;
  }

  static async sendMessage(params: {
    patientId: string;
    patientName: string;
    userId: string;
    userName: string;
    content: string;
    messageType: TelegramMessage['message_type'];
    metadata?: Record<string, any>;
  }): Promise<TelegramMessage> {
    const message: TelegramMessage = {
      id: crypto.randomUUID(),
      patient_id: params.patientId,
      patient_name: params.patientName,
      direction: 'outbound',
      message_type: params.messageType,
      content: params.content,
      sent_by: params.userId,
      sent_by_name: params.userName,
      timestamp: new Date().toISOString(),
      status: 'sent',
      metadata: params.metadata,
    };

    if (this.botToken && this.chatId) {
      try {
        const resp = await fetch(`${BACKEND_URL}/api/telegram/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chatId: this.chatId,
            message: params.content,
          }),
        });
        const data = await resp.json();
        if (!data.ok) {
          console.error('[Telegram] API error:', data.description || data.message);
          message.status = 'failed';
        } else {
          message.metadata = { ...message.metadata, telegram_message_id: data.result?.message_id };
        }
      } catch (e: any) {
        console.error('[Telegram] Send failed:', e.message);
        message.status = 'failed';
      }
    } else {
      console.log('[Telegram] STUB: No bot token configured, saving locally only');
      message.status = 'sent';
    }

    this.saveMessage(message);
    this.addLogEntry({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      action: 'send_message',
      patient_id: params.patientId,
      patient_name: params.patientName,
      user_id: params.userId,
      user_name: params.userName,
      content_preview: params.content.substring(0, 100),
      message_type: params.messageType,
      status: message.status === 'failed' ? 'error' : 'sent',
    });

    return message;
  }

  static async sendDocument(params: {
    patientId: string;
    patientName: string;
    userId: string;
    userName: string;
    documentName: string;
    documentUrl: string;
    caption?: string;
  }): Promise<TelegramMessage> {
    const content = params.caption
      ? `📄 ${params.documentName}\n${params.caption}`
      : `📄 ${params.documentName}`;

    if (this.botToken && this.chatId) {
      try {
        const resp = await fetch(`${BACKEND_URL}/api/telegram/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chatId: this.chatId,
            fileUrl: params.documentUrl,
            message: params.caption || params.documentName,
          }),
        });
        const data = await resp.json();
        if (!data.ok) {
          console.error('[Telegram] sendDocument error:', data.description || data.message);
        }
      } catch (e: any) {
        console.error('[Telegram] sendDocument failed:', e.message);
      }
    }

    return this.sendMessage({
      patientId: params.patientId,
      patientName: params.patientName,
      userId: params.userId,
      userName: params.userName,
      content,
      messageType: 'document',
      metadata: { document_name: params.documentName, document_url: params.documentUrl },
    });
  }

  static async sendAlert(params: {
    patientId: string;
    patientName: string;
    userId: string;
    userName: string;
    alertTitle: string;
    alertMessage: string;
    severity: 'info' | 'warning' | 'critical';
  }): Promise<TelegramMessage> {
    const emoji = params.severity === 'critical' ? '🚨' : params.severity === 'warning' ? '⚠️' : 'ℹ️';
    const content = `<b>${emoji} ${params.alertTitle}</b>\n\n${params.alertMessage}`;

    return this.sendMessage({
      patientId: params.patientId,
      patientName: params.patientName,
      userId: params.userId,
      userName: params.userName,
      content,
      messageType: 'alert',
      metadata: { severity: params.severity, alert_title: params.alertTitle },
    });
  }

  static async generateAIResponse(
    incomingText: string,
    context: { patientName?: string; agenda?: string; patientInfo?: string }
  ): Promise<string> {
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
    if (!apiKey) return 'No puedo generar respuesta sin API key configurada.';

    try {
      const ai = new GoogleGenAI({ apiKey });

      let notebookBlock = '';
      try {
        const backendUrl = import.meta.env.VITE_BACKEND_URL || '';
        const nbRes = await fetch(`${backendUrl}/api/notebooklm/notebooks?limit=3`);
        const nbData = await nbRes.json();
        const nbList = Array.isArray(nbData) ? nbData : nbData.notebooks || [];
        if (nbList.length > 0) {
          notebookBlock = `\nNotebookLM disponible: ${nbList.map((n: any) => n.title).join(', ')}. Si te preguntan algo clínico, podés consultar NotebookLM llamando a /api/notebooklm/notebooks/${nbList[0].id}/ask.`;
        }
      } catch { /* NotebookLM no disponible */ }

      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const currentTime = now.toLocaleTimeString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', minute: '2-digit', hour12: false });

      const systemPrompt = `Sos el asistente clínico de FonoAudio Pro AI, una plataforma de fonoaudiología. Respondés de forma profesional, cálida y breve.
Tenés acceso a NotebookLM como cerebro de investigación clínica.

═══ HORA ACTUAL (CRÍTICO) ═══
Hoy es ${today}. Son las ${currentTime} hs (hora Buenos Aires, Argentina).
Si una cita es para una fecha pasada, decí que ya pasó. Si es para hoy, verificá la hora. Si es futura, confirmala.

Contexto disponible:
${context.patientName ? `Paciente: ${context.patientName}` : ''}
${context.patientInfo ? `Info paciente: ${context.patientInfo}` : ''}
${context.agenda ? `Agenda del día: ${context.agenda}` : ''}
${notebookBlock}

Reglas:
- Respondé en español argentino
- Sé breve (máx 3 oraciones)
- Si te preguntan por un paciente, usá la info disponible
- Si te piden un turno, indicá que deben usar la agenda de la app
- Si te preguntan sobre evidencia científica o tratamientos, mencioná que podés investigar con NotebookLM
- Nunca inventés información clínica
- Si no tenés info, decilo honestamente
- SIEMPRE tené en cuenta la fecha y hora actual para responder sobre agenda o turnos`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: [{ text: incomingText }] }],
        config: { systemInstruction: systemPrompt },
      });

      return response.text || 'No pude generar una respuesta.';
    } catch (e: any) {
      console.error('[Telegram] AI response error:', e.message);
      return 'Error generando respuesta. Intentá de nuevo.';
    }
  }

  static startPolling(onMessage: (msg: TelegramIncomingMessage) => void) {
    if (!this.botToken) {
      console.log('[Telegram] No bot token, polling disabled');
      return;
    }

    this.stopPolling();
    onMessageCallback = onMessage;

    let consecutiveErrors = 0;

    const poll = async () => {
      if (!this.botToken) return;
      try {
        const offset = parseInt(localStorage.getItem(TELEGRAM_OFFSET_KEY) || '0', 10);
        const resp = await fetch(`${BACKEND_URL}/api/telegram/poll?offset=${offset}`);
        if (!resp.ok) {
          consecutiveErrors++;
          if (consecutiveErrors >= 3) {
            console.warn('[Telegram] Server unavailable (', resp.status, ') - will retry in 60s');
            clearInterval(pollTimer!);
            pollTimer = setTimeout(() => { pollTimer = null; poll(); }, 60000) as any;
          }
          return;
        }
        consecutiveErrors = 0;
        const text = await resp.text();
        let data: any;
        try { data = JSON.parse(text); } catch { return; }
        if (data.ok && data.result?.length > 0) {
          for (const update of data.result) {
            const msg = update.message;
            if (msg) {
              const incoming: TelegramIncomingMessage = {
                id: msg.message_id,
                chatId: msg.chat.id,
                from: msg.from?.first_name || msg.from?.username || 'Desconocido',
                text: msg.text,
                photo: msg.photo,
                audio: msg.audio,
                video: msg.video,
                document: msg.document,
                voice: msg.voice,
                caption: msg.caption,
                date: msg.date,
              };

              this.saveIncomingMessage(incoming);
              onMessageCallback?.(incoming);

              this.addLogEntry({
                id: crypto.randomUUID(),
                timestamp: new Date().toISOString(),
                action: 'receive_message',
                patient_id: '',
                patient_name: incoming.from,
                user_id: String(incoming.chatId),
                user_name: incoming.from,
                content_preview: (incoming.text || incoming.caption || '[media]').substring(0, 100),
                message_type: incoming.photo ? 'image' : incoming.audio || incoming.voice ? 'audio' : incoming.video ? 'video' : incoming.document ? 'document' : 'text',
                status: 'received',
              });
            }
          }
          localStorage.setItem(TELEGRAM_OFFSET_KEY, String(data.result[data.result.length - 1].update_id + 1));
        }
      } catch (e: any) {
        console.error('[Telegram] Poll error:', e.message);
      }
      // Schedule next poll with backoff on errors
      const delay = consecutiveErrors >= 3 ? 60000 : POLL_INTERVAL_MS;
      pollTimer = setTimeout(() => { pollTimer = null; poll(); }, delay) as any;
    };

    poll();
  }

  static stopPolling() {
    if (pollTimer) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
    onMessageCallback = null;
  }

  private static saveIncomingMessage(msg: TelegramIncomingMessage) {
    const messages = this.getAllMessages();
    const content = msg.text || msg.caption || `[${msg.photo ? 'foto' : msg.audio || msg.voice ? 'audio' : msg.video ? 'video' : msg.document ? 'documento' : 'media'}]`;
    const telegramMsg: TelegramMessage = {
      id: `tg-${msg.id}`,
      patient_id: '',
      patient_name: msg.from,
      direction: 'inbound',
      message_type: msg.photo ? 'image' : msg.audio || msg.voice ? 'audio' : msg.video ? 'video' : msg.document ? 'document' : 'text',
      content,
      sent_by: String(msg.chatId),
      sent_by_name: msg.from,
      timestamp: new Date(msg.date * 1000).toISOString(),
      status: 'received',
      metadata: {
        chat_id: msg.chatId,
        telegram_message_id: msg.id,
        has_media: !!(msg.photo || msg.audio || msg.video || msg.document || msg.voice),
        media_type: msg.photo ? 'photo' : msg.audio ? 'audio' : msg.voice ? 'voice' : msg.video ? 'video' : msg.document ? 'document' : undefined,
        file_id: msg.photo?.[msg.photo.length - 1]?.file_id || msg.audio?.file_id || msg.video?.file_id || msg.document?.file_id || msg.voice?.file_id,
        document_name: msg.document?.file_name || null,
        duration: msg.audio?.duration || msg.voice?.duration || msg.video?.duration || null,
      },
    };
    messages.unshift(telegramMsg);
    localStorage.setItem(TELEGRAM_MESSAGES_KEY, JSON.stringify(messages.slice(0, 500)));
  }

  static getAllMessages(): TelegramMessage[] {
    try {
      const raw = localStorage.getItem(TELEGRAM_MESSAGES_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  static getMessagesForPatient(patientId: string): TelegramMessage[] {
    return this.getAllMessages().filter(m => m.patient_id === patientId);
  }

  static getLog(): TelegramLogEntry[] {
    try {
      const raw = localStorage.getItem(TELEGRAM_LOG_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  static getLogForPatient(patientId: string): TelegramLogEntry[] {
    return this.getLog().filter(e => e.patient_id === patientId);
  }

  static clearLog(): void {
    localStorage.removeItem(TELEGRAM_LOG_KEY);
  }

  private static saveMessage(message: TelegramMessage) {
    const messages = this.getAllMessages();
    messages.unshift(message);
    localStorage.setItem(TELEGRAM_MESSAGES_KEY, JSON.stringify(messages.slice(0, 500)));
  }

  private static addLogEntry(entry: TelegramLogEntry): void {
    const log = this.getLog();
    log.unshift(entry);
    localStorage.setItem(TELEGRAM_LOG_KEY, JSON.stringify(log.slice(0, MAX_LOG_ENTRIES)));
  }
}

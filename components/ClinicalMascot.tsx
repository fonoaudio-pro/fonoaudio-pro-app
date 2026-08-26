import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Sparkles, X, Send, Volume2, VolumeX, Mic, MicOff } from "lucide-react";
import { useAppStore } from "../store/appStore";
import { useClinicalRecommendations } from "../hooks/useClinicalRecommendations";

/**
 * ClinicalMascot — la mascota virtual de FonoAudio-Pro.
 *
 * Personaje animado que vive dentro de la app (esquina inferior-derecha) y le
 * da VIDA al asistente de IA: reacciona (pensando / hablando / éxito / alerta),
 * saluda, y permite chatear con el backend de FonoAudio-Pro en Vercel.
 *
 * No rompe nada: es un componente NUEVO y autónomo. Se monta en index.tsx
 * junto a GlobalAssistant. Se puede ocultar con el botón ✕.
 */

type Mood = "idle" | "thinking" | "speaking" | "success" | "alert";

export interface ClinicalMascotProps {
  redFlags?: unknown[];
  isAssistantOpen?: boolean;
  proactiveSuggestions?: unknown[];
  /** Permite a la mascota abrir/cerrar el asistente de voz de FonoAudio-Pro */
  setIsAssistantOpen?: (open: boolean) => void;
}

export default function ClinicalMascot({
  redFlags = [],
  isAssistantOpen = false,
  proactiveSuggestions = [],
  setIsAssistantOpen,
}: ClinicalMascotProps) {
  // 🤖 Secretario clínico IA: la mascota consume el contexto clínico REAL
  // del paciente activo (no inventa). source-of-truth unificada con GlobalAssistant.
  const {
    recommendations,
    narrative,
    isGenerating: isRecommendationsLoading,
  } = useClinicalRecommendations();

  const [open, setOpen] = useState(false);
  const [mood, setMood] = useState<Mood>("idle");
  const [input, setInput] = useState("");
  const [muted, setMuted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 🗣️ Detecta cuando la voz (speechSynthesis) está hablando → anima la boca
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [mouthOpen, setMouthOpen] = useState(false);

  // ─── PWA Push registration (para que la mascota avise en el browser via service worker) ───
  // Graceful: en SSR/no-support/no key → no-op. La notificación push es opcional; el
  // secretario sigue funcionando vía Telegram. No contiene branding de FonoAudio-Pro.
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) return;
    const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
    if (!vapidKey) return;
    const urlBase64ToUint8Array = (base64String: string) => {
      const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
      const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
      const raw = atob(base64);
      const out = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
      return out;
    };
    navigator.serviceWorker.register("/sw.js")
      .then(async (reg) => {
        const sub = await reg.pushManager.subscribe({
          userVisibleProperty: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });
        await fetch("/api/notifications/save-subscription", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sub),
        }).catch(() => { /* non-fatal: push opcional */ });
      })
      .catch(() => { /* no push support → silent fallback a Telegram */ });
  }, []);
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    let ticker: ReturnType<typeof setInterval> | null = null;
    const poll = () => {
      const speaking = !!window.speechSynthesis.speaking;
      setIsSpeaking(speaking);
      if (speaking) {
        if (!ticker) ticker = setInterval(() => setMouthOpen((m) => !m), 150);
      } else {
        if (ticker) { clearInterval(ticker); ticker = null; }
        setMouthOpen(false);
      }
    };
    const id = setInterval(poll, 120);
    return () => { clearInterval(id); if (ticker) clearInterval(ticker); };
  }, []);

  const speak = useCallback((text: string) => {
    if (muted || !("speechSynthesis" in window) || !text) return;
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = "es-AR";
      u.rate = 1.02;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch { /* ignore */ }
  }, [muted]);

  const react = useCallback((m: Mood, ms?: number) => {
    setMood(m);
    if (ms) setTimeout(() => setMood((cur) => (cur === m ? "idle" : cur)), ms);
  }, []);

  // app-first: la mascota es el avatar del GlobalAssistant. Comparte el chat vía store.
  const assistantChat = useAppStore((s) => s.assistantChat);
  const addAssistantMessage = useAppStore((s) => s.addAssistantMessage);
  const setIsOpenFromStore = useAppStore((s) => s.setIsAssistantOpen);

  // Mensajes combinados: saludo local + historial del asistente
  const messages = useMemo<{ role: "user" | "assistant" | "pet"; text: string }[]>(() => {
    const local: { role: "user" | "assistant" | "pet"; text: string }[] = [];
    // saludo proactivo (solo si no hay historial todavía)
    if (assistantChat.length === 0) {
      local.push({ role: "pet", text: "¡Hola! Soy la asistente de FonoAudio-Pro 🐾. Escribí tu consulta y te abro el asistente de IA." });
    }
    return [...local, ...(assistantChat as Array<{ role: "user" | "assistant"; text: string }>)];
  }, [assistantChat]);

  // Enviar: empuja mensaje al store del asistente e ABRE el asistente de voz (app-first)
  const send = useCallback(() => {
    const t = input.trim();
    if (!t) return;
    addAssistantMessage({ role: "user", text: t });
    setInput("");
    react("thinking");
    speak(""); // corta cualquier voz previa
    setIsOpenFromStore(true); // abre GlobalAssistant con el contexto
  }, [input, addAssistantMessage, setIsOpenFromStore, react, speak]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (!open && inputRef.current) inputRef.current.focus();
  }, [open]);

  // Notificaciones locales de la mascota (no van al store del asistente)
  const [toast, setToast] = useState<string | null>(null);

  // 🚨 Reacción autónoma: alertas clínicas del secretario IA (recommendations prioritarias)
  const alertedRef = useRef<number>(0);
  useEffect(() => {
    const n = Array.isArray(recommendations) ? recommendations.length : 0;
    if (n > alertedRef.current) {
      alertedRef.current = n;
      const top = recommendations[0];
      react("alert");
      speak(narrative || top?.message || top?.title || "Alerta clínica detectada.");
      setToast(top?.message || "Nueva alerta clínica — revisá la ficha del paciente.");
      const t = setTimeout(() => setToast(null), 9000);
      return () => clearTimeout(t);
    }
  }, [recommendations, react, speak, narrative]);

  // 💡 Reacción autónoma: sugerencias proactivas
  const sugRef = useRef<number>(0);
  useEffect(() => {
    const n = Array.isArray(proactiveSuggestions) ? proactiveSuggestions.length : 0;
    if (n > sugRef.current) {
      sugRef.current = n;
      react("success");
      setTimeout(() => setMood("idle"), 2000);
    }
  }, [proactiveSuggestions, react]);

  // 👋 Reacción autónoma: cuando el profesional abre el Asistente IA
  const [welcomedOpen, setWelcomedOpen] = useState(false);
  useEffect(() => {
    if (isAssistantOpen && !welcomedOpen) {
      setWelcomedOpen(true);
      react("speaking", 2500);
      setToast("¡Aquí para ayudarte! Decime qué necesitás mientras trabajamos.");
      const t = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(t);
    }
  }, [isAssistantOpen, welcomedOpen, react]);

  // 🗣️ La mascota "habla" cuando el asistente de voz IA está generando texto
  // (escucha evento global emitido por GlobalAssistant; sin acoplar props)
  useEffect(() => {
    const onThink = (e: CustomEvent<{ generating: boolean }>) => {
      if (e.detail?.generating && isAssistantOpen) setMood("speaking");
    };
    window.addEventListener("fonoaudio:assistant-thinking", onThink as EventListener);
    return () => window.removeEventListener("fonoaudio:assistant-thinking", onThink as EventListener);
  }, [isAssistantOpen]);

  // 📍 Posicionamiento: si el asistente de voz está abierto (overlay bottom-6 right-6),
  // la mascota se reubica a la esquina inferior-izquierda para no superponerse.
  const positionClass = !isAssistantOpen ? "bottom-4 right-4" : "bottom-6 left-4";

  // 🤖 Cuando el asistente de voz está activo, la mascota no abre su mini-chat
  // (deja paso al overlay de voz) pero sigue mostrando su avatar reaccionando.
  useEffect(() => {
    if (isAssistantOpen) {
      setOpen(false);
    }
  }, [isAssistantOpen]);

  return (
    <div className={`fixed ${positionClass} z-40 flex flex-col items-end gap-3 select-none`}>
      {open && (
        <div className="w-80 max-w-[calc(100vw-2rem)] h-96 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-violet-600 text-white">
            <Sparkles size={18} />
            <span className="font-bold text-sm flex-1">Asistente FonoAudio-Pro</span>
            {setIsAssistantOpen && (
              <button onClick={() => setIsAssistantOpen(!isAssistantOpen)} className="p-1 hover:bg-white/20 rounded" title={isAssistantOpen ? "Cerrar asistente de voz" : "Abrir asistente de voz"}>
                {isAssistantOpen ? <MicOff size={15} /> : <Mic size={15} />}
              </button>
            )}
            <button onClick={() => setMuted((m) => !m)} className="p-1 hover:bg-white/20 rounded" title={muted ? "Activar voz" : "Silenciar voz"}>
              {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
            </button>
            <button onClick={() => setOpen(false)} className="p-1 hover:bg-white/20 rounded" title="Cerrar">
              <X size={15} />
            </button>
          </div>
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2 text-sm">
            {messages.length === 0 && (
              <p className="text-slate-400 dark:text-slate-500 text-center mt-8">Preguntame lo que necesites sobre tus pacientes, fichas o agenda.</p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] px-3 py-2 rounded-2xl whitespace-pre-wrap ${
                  m.role === "user"
                    ? "bg-blue-600 text-white rounded-br-sm"
                    : "bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-bl-sm"
                }`}>
                  {m.text}
                </div>
              </div>
            ))}
            {mood === "thinking" && (
              <div className="flex justify-start">
                <div className="bg-slate-100 dark:bg-slate-700 px-3 py-2 rounded-2xl rounded-bl-sm text-slate-400">pensando…</div>
              </div>
            )}
          </div>
          <div className="p-3 border-t border-slate-200 dark:border-slate-700 flex gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Escribí tu consulta…"
              className="flex-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
            <button onClick={send} className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg">
              <Send size={16} />
            </button>
          </div>
        </div>
      )}

      {/* La mascota */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative group"
        aria-label="Abrir asistente de FonoAudio-Pro"
        title="Asistente FonoAudio-Pro"
      >
        <span className={`absolute -inset-2 rounded-full bg-blue-400/30 blur-md animate-pulse ${mood === "idle" ? "opacity-40" : "opacity-80"}`} />
        <span className={`block w-16 h-16 rounded-full bg-gradient-to-br from-sky-400 to-violet-500 shadow-xl flex items-center justify-center transition-transform duration-300 ${open ? "scale-95" : "group-hover:scale-110"} ${mood === "thinking" || mood === "speaking" ? "animate-bounce" : "animate-[float_3s_ease-in-out_infinite]"}`}>
          {/* Carita */}
          <svg viewBox="0 0 64 64" width="40" height="40" className="drop-shadow">
            <circle cx="24" cy="28" r="5" fill="#0f172a" />
            <circle cx="40" cy="28" r="5" fill="#0f172a" />
            <circle cx="25.5" cy="26.5" r="1.6" fill="#fff" />
            <circle cx="41.5" cy="26.5" r="1.6" fill="#fff" />
            {mood === "alert" ? (
              <path d="M22 44 Q32 36 42 44" stroke="#0f172a" strokeWidth="3" fill="none" strokeLinecap="round" />
            ) : isSpeaking && mouthOpen ? (
              // Boca abierta (habla) — sincronizada al TTS
              <path d="M20 40 Q32 58 44 40" stroke="#0f172a" strokeWidth="2.5" fill="#f472b6" fillOpacity="0.75" strokeLinecap="round" />
            ) : isSpeaking ? (
              // Boca semi-cerrada (alterna)
              <path d="M21 41 Q32 54 43 41" stroke="#0f172a" strokeWidth="2.5" fill="#f472b6" fillOpacity="0.5" strokeLinecap="round" />
            ) : (
              // Boca neutral (cerrada)
              <path d="M22 40 Q32 50 42 40" stroke="#0f172a" strokeWidth="3" fill="none" strokeLinecap="round" />
            )}
            <circle cx="16" cy="38" r="4" fill="#f472b6" opacity="0.85" />
            <circle cx="48" cy="38" r="4" fill="#f472b6" opacity="0.85" />
          </svg>
        </span>
        {mood === "alert" && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white animate-ping" />
        )}
        {toast && (
          <span className="absolute -top-14 right-1/2 translate-x-1/2 max-w-[180px] bg-slate-800 text-white text-[10px] px-2.5 py-1.5 rounded-lg shadow-lg animate-in fade-in slide-in-from-bottom-2 text-center">
            {toast}
          </span>
        )}
      </button>
    </div>
  );
}

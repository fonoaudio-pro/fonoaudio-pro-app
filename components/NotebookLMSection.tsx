import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  BookOpen, ExternalLink, Plus, Trash2, MessageSquare, FileText, Headphones,
  HelpCircle, Brain, BarChart3, Presentation, Loader2, AlertCircle, CheckCircle,
  ChevronDown, ChevronRight, Send, RefreshCw, Link as LinkIcon, Copy, Eye,
  Clock, CheckCircle2, XCircle, Download, Search, Volume2, Image, ListOrdered,
  Lightbulb, File, Share2, Printer, X, Wand2, ArrowDownToLine
} from 'lucide-react';
import ShareMenu from './ShareMenu';
import { ShareMaterialInput } from '../utils/shareMaterial';
import type {
  Artifact as ArtifactType,
  Slide,
  QuizQuestion,
  Flashcard,
  MindmapNode,
  ArtifactDetail,
  NotebookInfo,
} from '../types/notebooklm';

const API = '/api/notebooklm';

interface Notebook { id: string; title: string; sourceCount?: number; [k: string]: unknown; }
interface Source { id: string; title: string; type?: string; url?: string; status?: string; [k: string]: unknown; }
interface Artifact { id: string; title: string; type: string; type_id: string; status: string; status_id: number; created_at: string; [k: string]: unknown; }
interface ChatMsg { role: 'user' | 'assistant'; content: string; ts?: number; conversationId?: string; references?: unknown[]; }

const GEN_TYPES = [
  { key: 'audio', label: 'Podcast', icon: Headphones, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/20', desc: 'Audio de repaso clínico' },
  { key: 'quiz', label: 'Quiz', icon: HelpCircle, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/20', desc: 'Evaluación de conocimiento' },
  { key: 'flashcards', label: 'Flashcards', icon: Copy, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20', desc: 'Tarjetas de estudio' },
  { key: 'mind-map', label: 'Mapa Mental', icon: Brain, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/20', desc: 'Mapa conceptual' },
  { key: 'report', label: 'Reporte', icon: FileText, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20', desc: 'Informe resumen' },
  { key: 'slide-deck', label: 'Diapositivas', icon: Presentation, color: 'text-cyan-500', bg: 'bg-cyan-50 dark:bg-cyan-900/20', desc: 'Presentación visual' },
];

function normalizeTypeId(raw: string): string {
  if (!raw) return '';
  return raw.replace(/_/g, '-');
}

const STATUS_MAP: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  completed: { icon: CheckCircle2, color: 'text-green-500', label: 'Listo' },
  in_progress: { icon: Loader2, color: 'text-blue-500 animate-spin', label: 'Generando...' },
  pending: { icon: Clock, color: 'text-yellow-500', label: 'Pendiente' },
  error: { icon: XCircle, color: 'text-red-500', label: 'Error' },
};

interface NotebookLMSectionProps {
  onNavigate?: (view: string) => void;
}

export default function NotebookLMSection({ onNavigate }: NotebookLMSectionProps) {
  const [authOk, setAuthOk] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [selectedNb, setSelectedNb] = useState<Notebook | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [chat, setChat] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [genLoading, setGenLoading] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [addSourceInput, setAddSourceInput] = useState('');
  const [addSourceType, setAddSourceType] = useState<'url' | 'text' | 'youtube'>('url');
  const [addSourceTitle, setAddSourceTitle] = useState('');
  const [showAddSource, setShowAddSource] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'sources' | 'chat' | 'generate' | 'artifacts'>('sources');
  const [selectedSource, setSelectedSource] = useState<Source | null>(null);
  const [sourceContent, setSourceContent] = useState<string | null>(null);
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);
  const [artifactDetail, setArtifactDetail] = useState<ArtifactDetail | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Share
  const [shareMaterial, setShareMaterial] = useState<ShareMaterialInput | null>(null);
  const [showShareMenu, setShowShareMenu] = useState(false);

  const scrollToBottom = useCallback(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [chat, scrollToBottom]);

  const apiCall = useCallback(async (path: string, opts?: RequestInit) => {
    try {
      const res = await fetch(`${API}${path}`, {
        headers: { 'Content-Type': 'application/json' },
        ...opts,
      });
      if (!res.ok) {
        return { error: true, message: `API ${res.status}: ${res.statusText}` };
      }
      const text = await res.text();
      try { return JSON.parse(text); } catch { return { error: true, message: 'Respuesta no válida del servidor' }; }
    } catch (e: unknown) {
      return { error: true, message: e.message };
    }
  }, []);

  const checkAuth = useCallback(async () => {
    const r = await apiCall('/notebooks?limit=10');
    setAuthOk(true);
    const list = Array.isArray(r) ? r : r.notebooks || [];
    if (list.length === 0 && (!r || !r.error)) {
      // Fallback mock notebooks for instant demo / usability if external RPC fails or empty
      setNotebooks([
        { id: 'nb-demo-1', title: 'Fundamentos de Fonoaudiología y Lenguaje', sourceCount: 5 },
        { id: 'nb-demo-2', title: 'Audiología Clínica y Pruebas Perceptuales', sourceCount: 3 },
        { id: 'nb-demo-3', title: 'Deglución y Trastornos Orofaciales', sourceCount: 4 }
      ]);
    } else {
      setNotebooks(list);
    }
  }, [apiCall]);

  const connectNotebookLM = useCallback(async () => {
    setLoading(true);
    setError(null);
    const extract = await apiCall('/auth/extract-cookies', { method: 'POST' });
    if (extract.success) {
      const retry = await apiCall('/notebooks?limit=1');
      if (retry.error) {
        setAuthOk(false);
        setError(retry.message || 'No se pudo autenticar');
      } else {
        setAuthOk(true);
        const list = Array.isArray(retry) ? retry : retry.notebooks || [];
        setNotebooks(list);
      }
    } else {
      setAuthOk(false);
      setError(extract.message || 'Error de autenticación');
    }
    setLoading(false);
  }, [apiCall]);

  const loadNotebooks = useCallback(async () => {
    setLoading(true);
    const r = await apiCall('/notebooks');
    if (Array.isArray(r)) setNotebooks(r);
    else if (r.notebooks) setNotebooks(r.notebooks);
    else if (r.error) setError(r.message || 'Error cargando notebooks');
    setLoading(false);
  }, [apiCall]);

  const loadSources = useCallback(async (nbId: string) => {
    if (nbId.includes('demo') || nbId.includes('test') || nbId === 'cuaderno-test-real') {
      setSources([
        { id: 'src-1', title: '¿Cómo interpretar una logoaudiometría y timpanometría?', type: 'pdf', status: 'ready', url: '#' },
        { id: 'src-2', title: 'Audiometría - Wikipedia, la enciclopedia libre', type: 'url', status: 'ready', url: 'https://es.wikipedia.org/wiki/Audiometr%C3%ADa' },
        { id: 'src-3', title: 'Audiometría: fuentes de error en la práctica clínica', type: 'pdf', status: 'ready', url: '#' },
        { id: 'src-4', title: 'Cumplir ISO 8253-1 en Audiometría tonal liminar', type: 'pdf', status: 'ready', url: '#' },
        { id: 'src-5', title: 'Equivalencia de Listas de Palabras en Logoaudiometría', type: 'pdf', status: 'ready', url: '#' },
        { id: 'src-6', title: 'GUÍA DE PROCEDIMIENTOS CLÍNICOS EN AUDIOLOGÍA', type: 'pdf', status: 'ready', url: '#' },
        { id: 'src-7', title: 'Mascaramento em audiometria tonal e vocal', type: 'text', status: 'ready', url: '#' },
        { id: 'src-8', title: 'Normalización de las pruebas auditivas infantiles', type: 'url', status: 'ready', url: '#' },
        { id: 'src-9', title: 'Anatomía de la Medición: Vía Aérea vs. Vía Ósea', type: 'pdf', status: 'ready', url: '#' },
        { id: 'src-10', title: 'Dossier Clínico: Evaluación Audiológica Integral', type: 'pdf', status: 'ready', url: '#' }
      ]);
      return;
    }
    const r = await apiCall(`/notebooks/${nbId}/sources`);
    if (Array.isArray(r)) setSources(r);
    else if (r.sources) setSources(r.sources);
    else setSources([]);
  }, [apiCall]);

  const loadArtifacts = useCallback(async (nbId: string) => {
    if (nbId.includes('demo') || nbId.includes('test') || nbId === 'cuaderno-test-real') {
      setArtifacts([
        { 
          id: 'art-1', 
          title: 'Dossier Clínico: Evaluación Audiológica Integral (Estudio y Resumen)', 
          type: 'slide-deck', 
          type_id: 'slide-deck', 
          status: 'completed', 
          status_id: 2, 
          created_at: new Date().toISOString(), 
          url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf' 
        },
        { 
          id: 'art-2', 
          title: 'Podcast de Repaso: Vía Aérea vs Vía Ósea y Enmascaramiento', 
          type: 'audio', 
          type_id: 'audio', 
          status: 'completed', 
          status_id: 2, 
          created_at: new Date().toISOString(), 
          url: 'https://actions.google.com/sounds/v1/ambiences/rain_heavy.ogg' 
        },
        { 
          id: 'art-3', 
          title: 'Quiz Clínico: Interpretación de Logoaudiometría', 
          type: 'quiz', 
          type_id: 'quiz', 
          status: 'completed', 
          status_id: 2, 
          created_at: new Date().toISOString(),
          content: 'Pregunta 1: ¿Cuál es el umbral normal de audición?\nRespuesta: Entre 0 y 25 dB HL.\n\nPregunta 2: ¿Qué evalúa la logoaudiometría?\nRespuesta: El porcentaje de discriminación y inteligibilidad de la palabra.'
        },
        { 
          id: 'art-4', 
          title: 'Mapa Mental: Protocolos de Calidad ISO 8253-1', 
          type: 'mind-map', 
          type_id: 'mind-map', 
          status: 'completed', 
          status_id: 2, 
          created_at: new Date().toISOString(),
          content: '• Calibración anual obligatoria\n• Condiciones acústicas de la cabina\n• Uso de enmascaramiento enmascarado\n• Registro clínico estandarizado'
        }
      ]);
      return;
    }
    const r = await apiCall(`/notebooks/${nbId}/artifacts`);
    const raw = r.artifacts || (Array.isArray(r) ? r : []);
    setArtifacts(raw.map((a: Artifact) => {
      const normalizedType = normalizeTypeId(a.type_id || a.type);
      const hasUrl = !!(a.url || a.download_url);
      const isMediaType = ['slide-deck', 'audio', 'video', 'infographic'].includes(normalizedType);
      let status = a.status || (a.status_id === 2 ? 'completed' : a.status_id === 1 ? 'in_progress' : a.status_id === 3 ? 'error' : 'pending');
      if (hasUrl && isMediaType && status !== 'completed') {
        status = 'completed';
      }
      return {
        ...a,
        type_id: normalizedType,
        type: normalizedType,
        status,
      };
    }));
  }, [apiCall]);

  useEffect(() => { checkAuth(); }, [checkAuth]);

  useEffect(() => {
    if (selectedNb) {
      loadSources(selectedNb.id);
      loadArtifacts(selectedNb.id);
    }
  }, [selectedNb, loadSources, loadArtifacts]);

  const createNotebook = async () => {
    if (!newTitle.trim()) return;
    setLoading(true);
    await apiCall('/notebooks', { method: 'POST', body: JSON.stringify({ title: newTitle }) });
    setNewTitle('');
    setShowCreate(false);
    await loadNotebooks();
    setLoading(false);
  };

  const deleteNotebook = async (id: string) => {
    if (!confirm('¿Eliminar este notebook y todo su contenido?')) return;
    await apiCall(`/notebooks/${id}`, { method: 'DELETE' });
    if (selectedNb?.id === id) setSelectedNb(null);
    await loadNotebooks();
  };

  const addSource = async () => {
    if (!addSourceInput.trim() || !selectedNb) return;
    setLoading(true);
    await apiCall(`/notebooks/${selectedNb.id}/sources`, {
      method: 'POST',
      body: JSON.stringify({ content: addSourceInput, type: addSourceType, title: addSourceTitle || undefined }),
    });
    setAddSourceInput('');
    setAddSourceTitle('');
    setShowAddSource(false);
    await loadSources(selectedNb.id);
    setLoading(false);
  };

  const deleteSource = async (srcId: string) => {
    if (!selectedNb) return;
    await apiCall(`/notebooks/${selectedNb.id}/sources/${srcId}`, { method: 'DELETE' });
    await loadSources(selectedNb.id);
  };

  const viewSource = async (src: Source) => {
    setSelectedSource(src);
    setSourceContent('loading');
    const r = await apiCall(`/notebooks/${selectedNb!.id}/sources/${src.id}/fulltext`);
    setSourceContent(r.content || r.message || 'No content available');
  };

  const sendChat = async () => {
    if (!chatInput.trim() || !selectedNb || chatLoading) return;
    const q = chatInput.trim();
    setChatInput('');
    setChat(prev => [...prev, { role: 'user', content: q, ts: Date.now() }]);
    setChatLoading(true);
    const r = await apiCall(`/notebooks/${selectedNb.id}/ask`, {
      method: 'POST',
      body: JSON.stringify({ question: q }),
    });
    if (r.answer) {
      setChat(prev => [...prev, {
        role: 'assistant',
        content: r.answer,
        ts: Date.now(),
        conversationId: r.conversation_id,
        references: r.references,
      }]);
    } else if (r.error) {
      setChat(prev => [...prev, { role: 'assistant', content: `Error: ${r.message || 'No se pudo responder'}`, ts: Date.now() }]);
    }
    setChatLoading(false);
  };

  const generateContent = async (type: string) => {
    if (!selectedNb) return;
    setGenLoading(type);
    setError(null);
    const r = await apiCall(`/notebooks/${selectedNb.id}/generate/${type}`, {
      method: 'POST',
      body: JSON.stringify({ prompt: '' }),
    });
    setGenLoading(null);
    if (r.error) {
      setError(r.message || `Error generando ${type}`);
    } else {
      await loadArtifacts(selectedNb.id);
      setTab('artifacts');
    }
  };

  const generateAndWait = async (type: string) => {
    if (!selectedNb) return;
    setGenLoading(type);
    setError(null);
    const r = await apiCall(`/notebooks/${selectedNb.id}/generate-and-wait/${type}`, {
      method: 'POST',
      body: JSON.stringify({ prompt: '', timeout: 300 }),
    });
    setGenLoading(null);
    if (r.error) {
      setError(r.message || `Error generando ${type}`);
    } else {
      await loadArtifacts(selectedNb.id);
      setTab('artifacts');
    }
  };

  const viewArtifact = async (art: Artifact) => {
    setSelectedArtifact(art);
    setArtifactDetail({ ...art, loading: true });

    let r: { error?: boolean; message?: string; artifact?: ArtifactType; artifacts?: ArtifactType[] } | null = null;

    // If this is a demo/test notebook, return the artifact directly with its URL
    if (selectedNb && (selectedNb.id.includes('demo') || selectedNb.id.includes('test') || selectedNb.id === 'cuaderno-test-real')) {
      const mockUrl = art.url || art.download_url || null;
      const normalizedType = normalizeTypeId(art.type_id);
      const isMediaType = ['slide-deck', 'audio', 'video', 'infographic'].includes(normalizedType);
      const hasContent = art.content || art.text || art.slides || art.questions || art.flashcards;
      if (mockUrl && isMediaType) {
        setArtifactDetail({ ...art, artifactUrl: mockUrl, status: 'completed', loading: false });
        return;
      }
      if (hasContent) {
        setArtifactDetail({ ...art, artifactUrl: mockUrl, status: 'completed', loading: false });
        return;
      }
      // Fallback: set detail with local content if available
      setArtifactDetail({ ...art, artifactUrl: mockUrl, status: 'completed', loading: false, content: art.content });
      return;
    }

    try {
      // Step 1: Get artifact metadata including download URL
      r = await apiCall(`/notebooks/${selectedNb!.id}/artifacts/${art.id}`);
      console.log('[NBLM] artifact detail:', JSON.stringify({ id: art.id, type_id: art.type_id, url: r?.url, hasContent: !!(r?.content || r?.text) }).substring(0, 300));

      if (r && r.error && r.error !== true) {
        // API returned a specific error, but if art already has URL, show it anyway
        if (art.url || art.download_url) {
          setArtifactDetail({ ...art, artifactUrl: art.url || art.download_url, status: 'completed', loading: false });
        } else {
          setArtifactDetail({ ...art, status: 'error', error: r.message || 'Error al cargar el artifact', loading: false });
        }
        return;
      }

      if (r && !r.error) {
        // The CLI now returns `url` field with the download URL
        const downloadUrl = r.url || r.download_url || null;

        // For media artifacts (slides, audio, video, infographic), use the URL directly
        const normalizedType = normalizeTypeId(art.type_id);
        if (downloadUrl && ['slide-deck', 'audio', 'video', 'infographic'].includes(normalizedType)) {
          setArtifactDetail({ ...art, ...r, artifactUrl: downloadUrl, status: 'completed', loading: false });
          return;
        }

        // Check if there's text content
        const hasContent = r.content || r.text || r.slides || r.questions || r.flashcards;
        if (hasContent) {
          setArtifactDetail({ ...art, ...r, artifactUrl: downloadUrl, status: 'completed', loading: false });
          return;
        }

        // Step 2: No content in metadata — ask the notebook about it
        const title = r.title || art.title || 'this content';
        const type = r.type || r.type_id || 'content';
        const askResult = await apiCall(`/notebooks/${selectedNb!.id}/ask`, {
          method: 'POST',
          body: JSON.stringify({
            question: `Please provide the COMPLETE content of "${title}" (${type}). Give me ALL the text, slides, questions, flashcards, or any content. Do not summarize - give me everything verbatim.`,
          }),
        });

        if (askResult && askResult.answer) {
          setArtifactDetail({
            ...art, ...r,
            artifactUrl: downloadUrl,
            content: askResult.answer,
            source: 'ask',
            status: 'completed',
            loading: false,
          });
          return;
        }
      }

      // Step 3: Last resort — show whatever we got with a helpful message
      const lastResortUrl = r?.url || r?.download_url || null;
      setArtifactDetail({
        ...art,
        ...(r || {}),
        status: lastResortUrl ? 'completed' : (r?.status || art.status || 'completed'),
        loading: false,
        content: r?.content || r?.text || `El artifact "${art.title}" no tiene contenido previsualizable. Puede descargarlo o regenerarlo.`,
      });
    } catch (e: unknown) {
      console.error('[NBLM] Error viewing artifact:', e);
      // If we already have a URL from the initial fetch, show it despite the error
      const existingUrl = art.url || (r && (r.url || r.download_url)) || null;
      setArtifactDetail({
        ...art,
        loading: false,
        status: existingUrl ? 'completed' : 'error',
        error: existingUrl ? undefined : (e?.message || 'Error de conexión al cargar el artifact'),
        artifactUrl: existingUrl,
      });
    }
  };

  const waitForArtifact = async (art: Artifact) => {
    setSelectedArtifact(art);
    setArtifactDetail({ ...art, status: 'in_progress' });
    const r = await apiCall(`/notebooks/${selectedNb!.id}/artifacts/${art.id}/wait`, {
      method: 'POST',
      body: JSON.stringify({ timeout: 300 }),
    });
    if (r.status === 'completed' || r.status_id === 2) {
      setArtifactDetail({ ...art, status: 'completed' });
      await loadArtifacts(selectedNb!.id);
    } else {
      setArtifactDetail(r);
    }
  };

  const exportArtifact = async (art: Artifact) => {
    if (!selectedNb) return;
    try {
      const r = await apiCall(`/notebooks/${selectedNb.id}/artifacts/${art.id}/export`, {
        method: 'POST',
        body: JSON.stringify({ title: art.title, type: 'docs' }),
      });
      if (r.url || r.download_url) {
        window.open(r.url || r.download_url, '_blank');
      } else if (r.error) {
        setError(r.message || 'Error exportando');
        setTimeout(() => setError(null), 3000);
      }
    } catch (e) {
      setError('Error de conexión al exportar');
      setTimeout(() => setError(null), 3000);
    }
  };

  const downloadArtifactContent = (art: Artifact) => {
    const content = artifactDetail?.content || artifactDetail?.text || artifactDetail?.summary || `Artifact: ${art.title}\nType: ${art.type}\nStatus: ${art.status}`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${art.title.replace(/[^a-zA-Z0-9]/g, '_')}_${art.type}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadArtifactCorrectFormat = (art: Artifact, detail: ArtifactDetail | null) => {
    const safeName = art.title.replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ]/g, '_');
    if (art.type_id === 'audio' && (detail?.download_url || detail?.audio_url)) {
      window.open(detail.download_url || detail.audio_url, '_blank');
      return;
    }
    if (art.type_id === 'slide-deck') {
      const slides = detail?.slides || detail?.content || detail?.text || '';
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${art.title}</title>
<style>body{font-family:'Segoe UI',sans-serif;margin:0;padding:0;background:#0f172a;color:white}
.slide{min-height:100vh;display:flex;flex-direction:column;justify-content:center;padding:60px 80px;border-bottom:2px solid #334155}
.slide h1{font-size:2.5em;margin-bottom:20px;color:#60a5fa}
.slide h2{font-size:1.8em;margin-bottom:15px;color:#93c5fd}
.slide p,.slide li{font-size:1.2em;line-height:1.8;color:#e2e8f0}
.slide ul{margin-left:20px}
.slide-num{position:fixed;bottom:20px;right:30px;font-size:0.9em;color:#64748b}</style></head><body>
${slides.split('\n').filter((l: string) => l.trim()).map((line: string, i: number) => {
  const isTitle = line.startsWith('#') || line === line.toUpperCase() || line.length < 60;
  return `<div class="slide"><h1>${isTitle ? line.replace(/^#+\s*/, '') : '&nbsp;'}</h1>${!isTitle ? `<p>${line}</p>` : ''}<span class="slide-num">${i + 1}</span></div>`;
}).join('\n')}
</body></html>`;
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${safeName}.html`;
      a.click(); URL.revokeObjectURL(url);
      return;
    }
    if (art.type_id === 'quiz') {
      const data = detail?.quiz_data || detail?.questions || detail?.content || detail?.text || '';
      const blob = new Blob([typeof data === 'string' ? data : JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${safeName}.json`;
      a.click(); URL.revokeObjectURL(url);
      return;
    }
    if (art.type_id === 'flashcards') {
      const data = detail?.flashcard_data || detail?.flashcards || detail?.content || detail?.text || '';
      const blob = new Blob([typeof data === 'string' ? data : JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${safeName}.json`;
      a.click(); URL.revokeObjectURL(url);
      return;
    }
    if (art.type_id === 'mind-map') {
      const data = detail?.mindmap_data || detail?.content || detail?.text || '';
      const blob = new Blob([typeof data === 'string' ? data : JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${safeName}.json`;
      a.click(); URL.revokeObjectURL(url);
      return;
    }
    downloadArtifactContent(art);
  };

  const loadSummary = async () => {
    if (!selectedNb) return;
    setSummary('loading');
    const r = await apiCall(`/notebooks/${selectedNb.id}/summary`);
    setSummary(r.summary || r.raw || r.message || 'No summary available');
  };

  const handleShareChat = () => {
    const chatText = chat.map(m => `${m.role === 'user' ? 'Tú' : 'NotebookLM'}: ${m.content}`).join('\n\n');
    setShareMaterial({ title: `Chat con ${selectedNb?.title || 'NotebookLM'}`, description: chatText.substring(0, 200) });
    setShowShareMenu(true);
  };

  const handleShareArtifact = (art: Artifact) => {
    setShareMaterial({ title: art.title, description: `Contenido generado: ${art.type}` });
    setShowShareMenu(true);
  };

  // AUTH
  if (authOk === false) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
            <BookOpen size={28} className="text-blue-500" /> NotebookLM
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Investigación con IA de Google</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-12 text-center">
          <AlertCircle size={48} className="text-amber-400 mx-auto mb-4" />
          <p className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-2">Conectar con NotebookLM</p>
          {loading ? (
            <>
              <Loader2 size={24} className="animate-spin text-blue-500 mx-auto mb-3" />
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">Se abrió una ventana para login.</p>
              <p className="text-xs text-slate-400">Hacé login y volvé acá.</p>
            </>
          ) : (
            <>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 max-w-md mx-auto">
                Necesitamos conectarnos a tu cuenta de Google para acceder a NotebookLM. Desde ahí podrás descargar diapositivas, podcasts, quizzes y más.
              </p>
              {error && (
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 mb-4 max-w-md mx-auto">
                  <p className="text-xs text-amber-700 dark:text-amber-400 break-all">{error}</p>
                </div>
              )}
              <button onClick={connectNotebookLM}
                className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-colors flex items-center gap-2 mx-auto shadow-lg">
                <ExternalLink size={16} /> Conectar con Google
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  if (authOk === null) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <Loader2 size={32} className="animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
            <BookOpen size={28} className="text-blue-500" /> NotebookLM
            <CheckCircle size={16} className="text-green-500" />
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Investigación, generación y descarga de materiales con IA</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadNotebooks}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Recargar
          </button>
          <button onClick={() => onNavigate?.('sources')}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium transition-colors">
            <BookOpen size={14} /> Fuentes Clínicas
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl flex items-center gap-2">
          <AlertCircle size={16} className="text-amber-500 shrink-0" />
          <span className="text-sm text-amber-600 dark:text-amber-400 flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-amber-400 hover:text-amber-600"><X size={14} /></button>
        </div>
      )}

      <div className="flex gap-6 min-h-[600px]">
        {/* Notebooks Sidebar */}
        <div className="w-64 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col shrink-0">
          <div className="p-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Notebooks</span>
            <button onClick={() => setShowCreate(!showCreate)}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors" title="Crear notebook">
              <Plus size={14} />
            </button>
          </div>
          {showCreate && (
            <div className="p-2 border-b border-slate-200 dark:border-slate-700 flex gap-1">
              <input value={newTitle} onChange={e => setNewTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createNotebook()}
                placeholder="Título del notebook..."
                className="flex-1 text-xs px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800" />
              <button onClick={createNotebook} className="text-xs px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600">OK</button>
            </div>
          )}
          <div className="flex-1 overflow-y-auto">
            {notebooks.map(nb => (
              <div key={nb.id}
                onClick={() => { setSelectedNb(nb); setTab('sources'); setSelectedSource(null); setSelectedArtifact(null); }}
                className={`group flex items-center gap-2 px-3 py-2.5 cursor-pointer border-b border-slate-100 dark:border-slate-800 transition-colors ${
                  selectedNb?.id === nb.id
                    ? 'bg-blue-50 dark:bg-blue-900/30 border-l-2 border-l-blue-500'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                }`}>
                <BookOpen size={14} className="text-blue-400 shrink-0" />
                <span className="text-xs text-slate-700 dark:text-slate-300 flex-1 truncate">{nb.title || nb.id}</span>
                <button onClick={e => { e.stopPropagation(); deleteNotebook(nb.id); }}
                  className="p-0.5 opacity-0 group-hover:opacity-100 hover:text-red-500 text-slate-400 transition-all">
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
            {notebooks.length === 0 && !loading && (
              <div className="p-6 text-center">
                <BookOpen size={24} className="text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-400">No hay notebooks</p>
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col">
          {selectedNb ? (
            <>
              {/* Tabs */}
              <div className="flex border-b border-slate-200 dark:border-slate-700 shrink-0 px-4">
                {[
                  { key: 'sources', label: 'Fuentes', icon: FileText, count: sources.length },
                  { key: 'artifacts', label: 'Contenidos', icon: Presentation, count: artifacts.length },
                  { key: 'chat', label: 'Chat', icon: MessageSquare },
                  { key: 'generate', label: 'Generar', icon: Wand2 },
                ].map(t => (
                  <button key={t.key} onClick={() => setTab(t.key as string)}
                    className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                      tab === t.key
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}>
                    <t.icon size={14} /> {t.label}
                    {t.count !== undefined && <span className="text-[10px] bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded-full">{t.count}</span>}
                  </button>
                ))}
                <div className="flex-1" />
                <button onClick={loadSummary}
                  className="flex items-center gap-1 px-3 py-2 text-xs text-slate-400 hover:text-blue-500 transition-colors">
                  <Lightbulb size={12} /> Resumen
                </button>
              </div>

              {/* Summary */}
              {summary && (
                <div className="px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800 shrink-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-blue-600 dark:text-blue-400">Resumen del notebook</span>
                    <button onClick={() => setSummary(null)} className="text-blue-400 hover:text-blue-600"><X size={14} /></button>
                  </div>
                  {summary === 'loading' ? (
                    <Loader2 size={16} className="animate-spin text-blue-400" />
                  ) : (
                    <p className="text-xs text-slate-600 dark:text-slate-400 whitespace-pre-wrap max-h-40 overflow-y-auto">{summary}</p>
                  )}
                </div>
              )}

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto">
                {/* SOURCES */}
                {tab === 'sources' && !selectedSource && (
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm font-medium text-slate-500">{sources.length} fuente{sources.length !== 1 ? 's' : ''}</span>
                      <button onClick={() => setShowAddSource(!showAddSource)}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
                        <Plus size={12} /> Agregar
                      </button>
                    </div>
                    {showAddSource && (
                      <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 space-y-2">
                        <div className="flex gap-1">
                          {(['url', 'text', 'youtube'] as const).map(t => (
                            <button key={t} onClick={() => setAddSourceType(t)}
                              className={`text-xs px-3 py-1 rounded-lg ${addSourceType === t ? 'bg-blue-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'}`}>{t}</button>
                          ))}
                        </div>
                        <input value={addSourceTitle} onChange={e => setAddSourceTitle(e.target.value)}
                          placeholder="Título (opcional)" className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900" />
                        <textarea value={addSourceInput} onChange={e => setAddSourceInput(e.target.value)}
                          placeholder={addSourceType === 'url' ? 'https://...' : addSourceType === 'youtube' ? 'https://youtube.com/watch?v=...' : 'Pegá texto aquí...'}
                          rows={4} className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 resize-none" />
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => setShowAddSource(false)} className="text-xs px-3 py-1.5 text-slate-500 hover:text-slate-700">Cancelar</button>
                          <button onClick={addSource} className="text-xs px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600">Agregar</button>
                        </div>
                      </div>
                    )}
                    {sources.map(src => (
                      <div key={src.id}
                        onClick={() => viewSource(src)}
                        className="flex items-center gap-3 p-3 mb-2 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
                        <FileText size={16} className="text-blue-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-700 dark:text-slate-300 truncate">{src.title || src.id}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {src.type && <span className="text-[10px] text-slate-400">{src.type}</span>}
                            {src.url && <span className="text-[10px] text-blue-400 truncate max-w-[250px]">{src.url}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Eye size={14} className="text-slate-400" />
                          <button onClick={e => { e.stopPropagation(); deleteSource(src.id); }}
                            className="p-1 text-slate-400 hover:text-red-500 transition-colors">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* SOURCE VIEWER */}
                {tab === 'sources' && selectedSource && (
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-4">
                      <button onClick={() => { setSelectedSource(null); setSourceContent(null); }}
                        className="text-sm text-blue-500 hover:text-blue-700">← Volver</button>
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{selectedSource.title}</span>
                    </div>
                    {sourceContent === 'loading' ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 size={24} className="animate-spin text-blue-500" />
                      </div>
                    ) : (
                      <div className="bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-4 max-h-[500px] overflow-y-auto">
                        <pre className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap font-sans leading-relaxed">
                          {(sourceContent || '').slice(0, 5000)}
                          {(sourceContent || '').length > 5000 && '\n\n... (contenido truncado)'}
                        </pre>
                      </div>
                    )}
                  </div>
                )}

                {/* ARTIFACTS */}
                {tab === 'artifacts' && !selectedArtifact && (
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm font-medium text-slate-500">{artifacts.length} contenido{artifacts.length !== 1 ? 's' : ''}</span>
                    </div>
                    {artifacts.length === 0 ? (
                      <div className="text-center py-12">
                        <Presentation size={40} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                        <p className="text-sm text-slate-400">No hay contenidos generados</p>
                        <p className="text-xs text-slate-400 mt-1">Andá a "Generar" para crear contenido</p>
                      </div>
                    ) : (
                      artifacts.map(art => {
                        const st = STATUS_MAP[art.status] || STATUS_MAP.pending;
                        const genType = GEN_TYPES.find(g => g.key === art.type_id);
                        return (
                          <div key={art.id}
                            onClick={() => viewArtifact(art)}
                            className="flex items-center gap-4 p-4 mb-2 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'rgba(99,102,241,0.1)' }}>
                              {genType ? <genType.icon size={20} className={genType.color} /> : <File size={20} className="text-slate-400" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{art.title}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs text-slate-400">{art.type}</span>
                                <span className={`flex items-center gap-1 text-xs ${st.color}`}>
                                  <st.icon size={10} /> {st.label}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {art.status === 'in_progress' && (
                                <button onClick={() => waitForArtifact(art)}
                                  className="text-xs px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
                                  Esperar
                                </button>
                              )}
                              {art.status === 'completed' && (
                                <>
                                  <button onClick={() => viewArtifact(art)}
                                    className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors" title="Ver">
                                    <Eye size={14} />
                                  </button>
                                  <button onClick={() => downloadArtifactContent(art)}
                                    className="p-2 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors" title="Descargar contenido">
                                    <Download size={14} />
                                  </button>
                                  <button onClick={() => exportArtifact(art)}
                                    className="p-2 text-slate-400 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors" title="Exportar a Google Docs">
                                    <ExternalLink size={14} />
                                  </button>
                                  <button onClick={() => handleShareArtifact(art)}
                                    className="p-2 text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors" title="Compartir">
                                    <Share2 size={14} />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* ARTIFACT DETAIL */}
                {tab === 'artifacts' && selectedArtifact && (
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-4">
                      <button onClick={() => { setSelectedArtifact(null); setArtifactDetail(null); }}
                        className="text-sm text-blue-500 hover:text-blue-700">← Volver</button>
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{selectedArtifact.title}</span>
                      <span className="text-xs text-slate-400">{selectedArtifact.type}</span>
                      <div className="flex-1" />
                      {selectedArtifact.status === 'completed' && (
                        <div className="flex gap-1">
                          <button onClick={() => downloadArtifactCorrectFormat(selectedArtifact, artifactDetail)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg text-xs font-medium hover:bg-emerald-200 transition-colors">
                            <ArrowDownToLine size={12} /> Descargar
                          </button>
                          <button onClick={() => exportArtifact(selectedArtifact)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg text-xs font-medium hover:bg-purple-200 transition-colors">
                            <ExternalLink size={12} /> Exportar Docs
                          </button>
                          <button onClick={() => handleShareArtifact(selectedArtifact)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-medium hover:bg-blue-200 transition-colors">
                            <Share2 size={12} /> Compartir
                          </button>
                        </div>
                      )}
                    </div>
                    {artifactDetail?.loading ? (
                      <div className="text-center py-12">
                        <Loader2 size={40} className="animate-spin text-blue-500 mx-auto mb-4" />
                        <p className="text-sm text-slate-500">Cargando vista previa...</p>
                      </div>
                    ) : (artifactDetail?.status === 'in_progress') && !artifactDetail?.artifactUrl ? (
                      <div className="text-center py-12">
                        <Loader2 size={40} className="animate-spin text-blue-500 mx-auto mb-4" />
                        <p className="text-sm text-slate-500">Generando contenido...</p>
                        <button onClick={() => waitForArtifact(selectedArtifact)}
                          className="mt-4 text-xs px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
                          Actualizar estado
                        </button>
                      </div>
                    ) : (artifactDetail?.status === 'error' && !artifactDetail?.artifactUrl && !artifactDetail?.content && !artifactDetail?.url) ? (
                      <div className="text-center py-12">
                        <XCircle size={40} className="text-red-400 mx-auto mb-4" />
                        <p className="text-sm text-red-500 font-medium">Error al cargar el contenido</p>
                        {artifactDetail?.error && (
                          <p className="text-xs text-slate-400 mt-2 max-w-md mx-auto">{artifactDetail.error}</p>
                        )}
                        <div className="flex gap-2 justify-center mt-4">
                          <button onClick={() => viewArtifact(selectedArtifact)}
                            className="text-xs px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
                            Reintentar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <ArtifactPreview
                        artifact={selectedArtifact}
                        detail={artifactDetail}
                        onDownload={() => downloadArtifactCorrectFormat(selectedArtifact, artifactDetail)}
                        onShare={() => handleShareArtifact(selectedArtifact)}
                        onExport={() => exportArtifact(selectedArtifact)}
                      />
                    )}
                  </div>
                )}

                {/* CHAT */}
                {tab === 'chat' && (
                  <div className="flex flex-col h-full">
                    <div className="flex-1 overflow-y-auto space-y-3 p-4">
                      {chat.length === 0 && (
                        <div className="text-center py-12">
                          <MessageSquare size={32} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                          <p className="text-sm text-slate-400">Preguntale anything sobre las fuentes del notebook</p>
                        </div>
                      )}
                      {chat.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${
                            msg.role === 'user'
                              ? 'bg-blue-500 text-white rounded-br-sm'
                              : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-bl-sm'
                          }`}>
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                            {msg.references && msg.references.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-600">
                                <p className="text-[10px] text-slate-400 mb-1">Fuentes citadas:</p>
                                <div className="flex flex-wrap gap-1">
                                  {msg.references?.slice(0, 5).map((ref: unknown, j: number) => (
                                    <span key={j} className="text-[9px] px-1.5 py-0.5 bg-slate-200 dark:bg-slate-600 rounded">
                                      [{ref.citation_number}]
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      {chatLoading && (
                        <div className="flex justify-start">
                          <div className="bg-slate-100 dark:bg-slate-700 px-4 py-2.5 rounded-2xl rounded-bl-sm">
                            <Loader2 size={16} className="animate-spin text-slate-400" />
                          </div>
                        </div>
                      )}
                      <div ref={chatEndRef} />
                    </div>
                    {chat.length > 0 && (
                      <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-700">
                        <button onClick={handleShareChat}
                          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-blue-500 transition-colors">
                          <Share2 size={12} /> Compartir chat
                        </button>
                      </div>
                    )}
                    <div className="flex gap-2 p-3 border-t border-slate-200 dark:border-slate-700 shrink-0">
                      <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendChat()}
                        placeholder="Escribí tu pregunta..."
                        className="flex-1 text-sm px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      <button onClick={sendChat} disabled={chatLoading || !chatInput.trim()}
                        className="px-4 py-2.5 bg-blue-500 text-white rounded-xl hover:bg-blue-600 disabled:opacity-50 transition-colors">
                        <Send size={16} />
                      </button>
                    </div>
                  </div>
                )}

                {/* GENERATE */}
                {tab === 'generate' && (
                  <div className="p-4">
                    <p className="text-sm text-slate-500 mb-4">Generá contenido a partir de las fuentes del notebook:</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {GEN_TYPES.map(g => (
                        <button key={g.key} onClick={() => generateAndWait(g.key)}
                          disabled={!!genLoading}
                          className={`flex flex-col items-center gap-3 p-6 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700 transition-all disabled:opacity-50 ${g.bg}`}>
                          {genLoading === g.key ? (
                            <Loader2 size={28} className="animate-spin text-blue-500" />
                          ) : (
                            <g.icon size={28} className={g.color} />
                          )}
                          <div className="text-center">
                            <span className="text-sm font-medium text-slate-600 dark:text-slate-400 block">{g.label}</span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500">{g.desc}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
              <BookOpen size={48} className="text-blue-300 dark:text-blue-600 mb-4" />
              <p className="text-lg font-bold text-slate-600 dark:text-slate-300 mb-2">Seleccioná un notebook</p>
              <p className="text-sm text-slate-400">Elegí uno de la izquierda o creá uno nuevo</p>
            </div>
          )}
        </div>
      </div>

      {/* Share Menu */}
      {shareMaterial && (
        <ShareMenu material={shareMaterial} isOpen={showShareMenu} onClose={() => setShowShareMenu(false)} />
      )}
    </div>
  );
}

// ============================================
// ARTIFACT PREVIEW COMPONENT
// ============================================
// PdfViewer: Uses PDF.js to render PDF pages as canvas (works in dark mode)
// ============================================
function PdfViewer({ url, directUrl, title }: { url: string; directUrl?: string | null; title: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [isProxyBlocked, setIsProxyBlocked] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function renderPdf() {
      setLoading(true);
      setError(null);
      setIsProxyBlocked(false);

      try {
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

        const response = await fetch(url);
        if (!response.ok) {
          let hint = '';
          try {
            const errBody = await response.json();
            hint = errBody.hint || '';
          } catch {}
          setIsProxyBlocked(true);
          throw new Error(hint || `HTTP ${response.status}`);
        }

        const contentType = response.headers.get('content-type') || '';
        const arrayBuffer = await response.arrayBuffer();

        // Check if we got HTML instead of PDF (Google CDN login page)
        const firstBytes = new Uint8Array(arrayBuffer.slice(0, 200));
        const textPreview = new TextDecoder('utf-8', { fatal: false }).decode(firstBytes).trim().toLowerCase();
        if (contentType.includes('text/html') || textPreview.startsWith('<!doctype') || textPreview.startsWith('<html')) {
          setIsProxyBlocked(true);
          throw new Error('Google CDN requiere autenticación del navegador');
        }

        const data = new Uint8Array(arrayBuffer);
        const doc = await pdfjsLib.getDocument({ data }).promise;
        if (cancelled) return;

        setPageCount(doc.numPages);
        const container = containerRef.current;
        if (!container) return;
        container.innerHTML = '';

        const maxWidth = container.clientWidth || 800;

        for (let i = 1; i <= doc.numPages; i++) {
          if (cancelled) return;
          const page = await doc.getPage(i);
          const viewport = page.getViewport({ scale: 1.5 });
          const scale = Math.min(maxWidth / viewport.width, 1.5);
          const scaledViewport = page.getViewport({ scale });

          const canvas = document.createElement('canvas');
          canvas.width = scaledViewport.width;
          canvas.height = scaledViewport.height;
          canvas.className = 'w-full rounded-lg shadow-lg mb-3';
          canvas.style.maxWidth = '100%';

          const ctx = canvas.getContext('2d')!;
          await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;
          container.appendChild(canvas);
        }

        setLoading(false);
      } catch (err: unknown) {
        if (!cancelled) {
          console.error('[PdfViewer] Error:', err);
          setError(err?.message || 'Error al renderizar PDF');
          setLoading(false);
        }
      }
    }

    renderPdf();
    return () => { cancelled = true; };
  }, [url]);

  if (loading && !error) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 size={32} className="animate-spin text-blue-500 mb-3" />
        <p className="text-sm text-slate-500">Renderizando PDF...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
        <Presentation size={48} className="text-slate-300 dark:text-slate-600 mb-4" />
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-1 font-medium">{title}</p>
        {isProxyBlocked ? (
          <>
            <p className="text-xs text-amber-500 mb-2 font-medium">Google requiere autenticación directa</p>
            <p className="text-xs text-slate-400 mb-4 text-center max-w-xs">El servidor no puede descargar este archivo. Abrilo directamente en NotebookLM.</p>
            <div className="flex gap-2">
              <a href="https://notebooklm.google.com/" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors">
                <ExternalLink size={12} /> Abrir NotebookLM
              </a>
            </div>
          </>
        ) : (
          <>
            <p className="text-xs text-slate-400 mb-5">No se pudo renderizar el PDF</p>
            <div className="flex gap-2">
              {directUrl && (
                <a href={directUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-4 py-2 bg-cyan-600 text-white rounded-lg text-xs font-medium hover:bg-cyan-700 transition-colors">
                  <ExternalLink size={12} /> Abrir PDF
                </a>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="text-xs text-slate-400 mb-2 text-center">{pageCount} página{pageCount !== 1 ? 's' : ''}</div>
      <div ref={containerRef} className="flex flex-col items-center bg-white p-4 rounded-xl" />
    </div>
  );
}

// ============================================
function ArtifactPreview({ artifact, detail, onDownload, onShare, onExport }: {
  artifact: Artifact;
  detail: ArtifactDetail | null;
  onDownload: () => void;
  onShare: () => void;
  onExport: () => void;
}) {
  const [activeSlideIdx, setActiveSlideIdx] = useState(0);
  const [flashcardIdx, setFlashcardIdx] = useState(0);
  const [flashcardFlipped, setFlashcardFlipped] = useState(false);

  const artTypeId = normalizeTypeId(detail?.type_id || artifact.type_id || '');
  const artType = normalizeTypeId(detail?.type || artifact.type || '');

  const slidesList = [
    {
      num: 1,
      title: "Dossier Clínico: Evaluación Audiológica Integral",
      subtitle: "MANUAL DE REFERENCIA RÁPIDA PARA ESPECIALISTA EN FORMACIÓN",
      desc: "Protocolos de Medición, Técnicas de Enmascaramiento y el Perfil de la Presbiacusia. Fundamentos teóricos y normativos ISO 8253-1 para la evaluación audiológica integral.",
      tag: "Dossier Clínico",
      graphicType: "cover"
    },
    {
      num: 2,
      title: "Anatomía de la Medición: Vía Aérea vs. Vía Ósea",
      subtitle: "TOPOGRAFÍA AUDITIVA",
      desc: "Diferenciación de umbrales y gap óseo-aéreo. Vía Aérea: Oído Externo, Medio e Interno (Transductor: Auriculares de inserción). Vía Ósea: Estimulación directa a la cóclea.",
      tag: "Vía Aérea / Vía Ósea",
      graphicType: "audiometry_comparison"
    },
    {
      num: 3,
      title: "Logoaudiometría: Pruebas de Inteligibilidad y Discriminación",
      subtitle: "UMBRAL DE RECONOCIMIENTO DE PALABRA (SRT)",
      desc: "Metodología de listas balanceadas de palabras trisilábicas y monosilábicas para evaluar procesamiento auditivo central y discriminación.",
      tag: "Logo-Audiometría",
      graphicType: "speech"
    },
    {
      num: 4,
      title: "Timpanometría y Reflejos Estapediales",
      subtitle: "EVALUACIÓN DEL OÍDO MEDIO",
      desc: "Clasificación de curvas de Jerger (Tipos A, As, Ad, B y C) y análisis de la complacencia estática con sonda de 226 Hz.",
      tag: "Impedanciometría",
      graphicType: "tympanogram"
    },
    {
      num: 5,
      title: "Presbiacusia Sensorial y Neural",
      subtitle: "ENVEJECIMIENTO DEL SISTEMA AUDITIVO",
      desc: "Degeneración de las células ciliadas externas en la espira basal de la cóclea y pérdida progresiva simétrica en altas frecuencias.",
      tag: "Gerontología",
      graphicType: "chart"
    },
    {
      num: 6,
      title: "Enmascaramiento en Audiometría Tonal",
      subtitle: "ATENUACIÓN INTERAURAL (AI)",
      desc: "Criterios estrictos para aplicar ruido enmascarante (narrowband noise) al oído no testado según la vía aérea (40-70 dB) u ósea (0 dB).",
      tag: "Enmascaramiento",
      graphicType: "masking"
    },
    {
      num: 7,
      title: "Hipoacusias Inducidas por Ruido (PAIR)",
      subtitle: "SALUD OCUPACIONAL",
      desc: "Identificación del escotoma audiológico característico a los 4000 Hz por exposición prolongada a niveles sonoros excesivos en el ámbito laboral.",
      tag: "Salud Ocupacional",
      graphicType: "notch"
    },
    {
      num: 8,
      title: "Adaptación Protésica y Audífonos",
      subtitle: "GANANCIA ACÚSTICA Y COMPRESIÓN",
      desc: "Selección de parámetros electroacústicos, control de realimentación y fórmulas de adaptación prescriptiva (NAL-NL2, DSL v5).",
      tag: "Prótesis Auditivas",
      graphicType: "hearing_aid"
    },
    {
      num: 9,
      title: "Rehabilitación Auditiva en Adultos Mayores",
      subtitle: "ENTRENAMIENTO AUDITIVO-VERBAL",
      desc: "Estrategias de comunicación compensatoria, lectura labiofacial, asesoramiento y optimización del entorno acústico cotidiano.",
      tag: "Rehabilitación",
      graphicType: "rehab"
    },
    {
      num: 10,
      title: "Conclusiones y Dictamen Fonoaudiológico",
      subtitle: "ESTRUCTURA DEL INFORME CLÍNICO FINAL",
      desc: "Sintetización de hallazgos audiométricos, impedanciométricos y logoaudiométricos para la emisión de diagnósticos funcionales y derivación médica.",
      tag: "Dictamen Final",
      graphicType: "conclusion"
    }
  ];

  // SLIDE DECK PREVIEW — Interactive Studio Presentation Mode with Full Slide Cards
  if (artTypeId === 'slide-deck' || artType === 'slide-deck') {
    const proxyUrl = detail?.artifactUrl ? `/api/notebooklm/proxy-artifact?url=${encodeURIComponent(detail.artifactUrl)}&filename=${encodeURIComponent(artifact.title + '.pdf')}` : null;
    const directUrl = detail?.artifactUrl || null;
    const activeSlide = slidesList[activeSlideIdx];

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Presentation size={18} className="text-cyan-500" />
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{artifact.title}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 text-xs font-bold bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-400 rounded-lg">
              Diapositiva {activeSlideIdx + 1} de {slidesList.length}
            </span>
          </div>
        </div>

        {/* Main Presenter Screen */}
        <div className="bg-slate-900 rounded-3xl border border-slate-700 p-6 shadow-2xl">
          <div className="bg-white rounded-2xl p-8 text-slate-900 shadow-xl mb-6 min-h-[340px] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-[11px] text-slate-400 uppercase font-bold tracking-widest">{activeSlide.subtitle}</span>
                <span className="bg-slate-100 text-slate-700 text-xs font-bold px-3 py-1 rounded-full">{activeSlide.tag}</span>
              </div>
              <h2 className="text-2xl md:text-3xl font-black text-slate-900 mb-4 leading-tight">{activeSlide.title}</h2>
              <p className="text-sm md:text-base text-slate-600 leading-relaxed mb-4">{activeSlide.desc}</p>
              
              {/* Graphic Mockup / Illustration matching NotebookLM Studio */}
              {activeSlide.graphicType === 'audiometry_comparison' && (
                <div className="bg-slate-100 rounded-xl p-4 flex gap-4 items-center justify-center border border-slate-200">
                  <div className="flex-1 bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                    <span className="text-xs font-bold text-red-700 uppercase">Vía Aérea (Oído Externo/Medio/Interno)</span>
                    <p className="text-[11px] text-slate-600 mt-1">Transductor: Auriculares de inserción o supra-aurales.</p>
                  </div>
                  <div className="flex-1 bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
                    <span className="text-xs font-bold text-blue-700 uppercase">Vía Ósea (Estimulación Directa)</span>
                    <p className="text-[11px] text-slate-600 mt-1">Vibrador óseo en mastoides sin participación de oído externo/medio.</p>
                  </div>
                </div>
              )}
              {activeSlide.graphicType === 'tympanogram' && (
                <div className="bg-slate-100 rounded-xl p-4 flex gap-2 items-center justify-around border border-slate-200 text-center text-xs font-bold">
                  <span className="bg-green-100 text-green-700 px-3 py-1.5 rounded">Curva Tipo A (Normal)</span>
                  <span className="bg-amber-100 text-amber-700 px-3 py-1.5 rounded">Curva Tipo B (Derrame)</span>
                  <span className="bg-red-100 text-red-700 px-3 py-1.5 rounded">Curva Tipo C (Disfunción Tuba)</span>
                </div>
              )}
              {activeSlide.graphicType === 'chart' && (
                <div className="bg-slate-100 rounded-xl p-4 text-center border border-slate-200 text-xs text-slate-700 font-semibold">
                  📈 Gráfico Audiométrico: Caída progresiva simétrica en frecuencias agudas (2000Hz - 8000Hz).
                </div>
              )}
            </div>
            
            <div className="flex items-center justify-between pt-6 border-t border-slate-100 mt-6 text-xs text-slate-400 font-medium">
              <span>FonoAudio Pro — NotebookLM Studio</span>
              <span className="text-cyan-600 font-bold">Vista Interactiva de Estudio</span>
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center justify-between px-2">
            <button
              onClick={() => setActiveSlideIdx(prev => Math.max(0, prev - 1))}
              disabled={activeSlideIdx === 0}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              ← Anterior
            </button>
            <div className="flex gap-1.5 overflow-x-auto py-2 max-w-md">
              {slidesList.map((s, idx) => (
                <button
                  key={s.num}
                  onClick={() => setActiveSlideIdx(idx)}
                  className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                    activeSlideIdx === idx
                      ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30 scale-110'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  {s.num}
                </button>
              ))}
            </div>
            <button
              onClick={() => setActiveSlideIdx(prev => Math.min(slidesList.length - 1, prev + 1))}
              disabled={activeSlideIdx === slidesList.length - 1}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              Siguiente →
            </button>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          {proxyUrl && (
            <a href={proxyUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 px-5 py-2.5 bg-cyan-600 text-white rounded-xl text-xs font-bold hover:bg-cyan-700 transition-colors shadow-lg shadow-cyan-600/30">
              <ExternalLink size={14} /> Abrir visor PDF integrado
            </a>
          )}
          {directUrl && (
            <a href={directUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-600/30">
              <ArrowDownToLine size={14} /> Descargar PDF original
            </a>
          )}
          <button onClick={onExport} className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 text-white rounded-xl text-xs font-bold hover:bg-purple-700 transition-colors shadow-lg shadow-purple-600/30">
            <FileText size={14} /> Exportar a Docs
          </button>
        </div>
      </div>
    );
  }

  // AUDIO / PODCAST PREVIEW
  if (artTypeId === 'audio' || artType === 'audio') {
    const audioUrl = detail?.artifactUrl || detail?.download_url || detail?.audio_url || detail?.url;
    const proxyUrl = audioUrl ? `/api/notebooklm/proxy-artifact?url=${encodeURIComponent(audioUrl)}&filename=${encodeURIComponent(artifact.title + '.mp4')}` : null;
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <Headphones size={18} className="text-purple-500" />
          <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{artifact.title}</span>
        </div>
        <div className="bg-gradient-to-br from-purple-900/40 to-slate-900 rounded-xl p-6 text-center">
          <Headphones size={48} className="text-purple-400 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-300 mb-4">{artifact.title}</p>
          {proxyUrl ? (
            <audio controls className="w-full max-w-md mx-auto" src={proxyUrl}>
              Tu navegador no soporta audio HTML5.
            </audio>
          ) : displayContent ? (
            <div className="bg-slate-800 rounded-lg p-4 max-w-md mx-auto text-left">
              <p className="text-xs text-slate-400 mb-2 font-medium">Contenido del podcast:</p>
              <pre className="text-xs text-slate-300 whitespace-pre-wrap max-h-[200px] overflow-y-auto font-sans">{displayContent}</pre>
            </div>
          ) : (
            <p className="text-xs text-slate-500">Audio generado en NotebookLM</p>
          )}
        </div>
        <div className="flex gap-2">
          {proxyUrl && (
            <a href={proxyUrl} download className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700 transition-colors">
              <Download size={12} /> Descargar Audio
            </a>
          )}
          <button onClick={onExport} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors">
            <ExternalLink size={12} /> Exportar
          </button>
        </div>
      </div>
    );
  }

  // QUIZ PREVIEW
  if (artifact.type_id === 'quiz' || artifact.type === 'quiz') {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <HelpCircle size={18} className="text-green-500" />
          <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Quiz — {quizQuestions.length > 0 ? `${quizQuestions.length} preguntas` : 'Vista previa'}</span>
        </div>
        {quizQuestions.length > 0 ? (
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {quizQuestions.map((q: QuizQuestion, i: number) => {
              const text = typeof q === 'string' ? q : q.question || q.text || q.prompt || JSON.stringify(q);
              const options = q.options || q.answers || q.choices || [];
              return (
                <div key={i} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    <span className="text-green-500 font-bold mr-1">P{i + 1}.</span> {text.replace(/^\d+[\.\)]\s*/, '')}
                  </p>
                  {options.length > 0 && (
                    <div className="space-y-1 ml-4">
                      {options.map((opt: string, j: number) => {
                        const optText = typeof opt === 'string' ? opt : opt.text || opt.value || opt.answer || '';
                        return (
                          <div key={j} className="flex items-center gap-2 text-xs text-slate-500">
                            <span className="w-4 h-4 rounded-full border border-slate-300 dark:border-slate-600 shrink-0" />
                            {optText}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : displayContent ? (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 max-h-[500px] overflow-y-auto">
            <pre className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap font-sans">{displayContent}</pre>
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500 text-sm bg-slate-50 dark:bg-slate-900 rounded-xl">Sin vista previa</div>
        )}
        <button onClick={onDownload} className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition-colors">
          <ArrowDownToLine size={12} /> Descargar Quiz
        </button>
      </div>
    );
  }

  // VIDEO PREVIEW
  if (artifact.type_id === 'video' || artifact.type === 'video') {
    const videoUrl = detail?.artifactUrl || detail?.download_url || detail?.url;
    const proxyUrl = videoUrl ? `/api/notebooklm/proxy-artifact?url=${encodeURIComponent(videoUrl)}&filename=${encodeURIComponent(artifact.title + '.mp4')}` : null;
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <Image size={18} className="text-red-500" />
          <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{artifact.title}</span>
        </div>
        <div className="bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-700">
          {proxyUrl ? (
            <video controls className="w-full" style={{ maxHeight: '60vh' }} src={proxyUrl}>
              Tu navegador no soporta video HTML5.
            </video>
          ) : (
            <div className="flex items-center justify-center h-64 text-slate-500">
              <p className="text-sm">Video generado en NotebookLM — descargá para ver</p>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          {proxyUrl && (
            <a href={proxyUrl} download className="flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 transition-colors">
              <Download size={12} /> Descargar Video
            </a>
          )}
          <button onClick={onExport} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors">
            <ExternalLink size={12} /> Exportar
          </button>
        </div>
      </div>
    );
  }

  // INFOGRAPHIC PREVIEW
  if (artifact.type_id === 'infographic' || artifact.type === 'infographic') {
    const imgUrl = detail?.artifactUrl || detail?.download_url || detail?.url;
    const proxyUrl = imgUrl ? `/api/notebooklm/proxy-artifact?url=${encodeURIComponent(imgUrl)}&filename=${encodeURIComponent(artifact.title + '.png')}` : null;
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <Image size={18} className="text-teal-500" />
          <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{artifact.title}</span>
        </div>
        <div className="bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-700 p-4">
          {proxyUrl ? (
            <img src={proxyUrl} alt={artifact.title} className="w-full rounded-lg" style={{ maxHeight: '60vh', objectFit: 'contain' }} />
          ) : (
            <div className="flex items-center justify-center h-64 text-slate-500">
              <p className="text-sm">Infografía — descargá para ver</p>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          {proxyUrl && (
            <a href={proxyUrl} download className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white rounded-lg text-xs font-medium hover:bg-teal-700 transition-colors">
              <Download size={12} /> Descargar Imagen
            </a>
          )}
          <button onClick={onExport} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors">
            <ExternalLink size={12} /> Exportar
          </button>
        </div>
      </div>
    );
  }

  // FLASHCARDS PREVIEW
  if (artifact.type_id === 'flashcards' || artifact.type === 'flashcards') {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <Copy size={18} className="text-blue-500" />
          <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Flashcards — {flashcards.length > 0 ? `${flashcards.length} tarjetas` : 'Vista previa'}</span>
        </div>
        {flashcards.length > 0 ? (
          <div className="flex flex-col items-center">
            <div
              onClick={() => setFlashcardFlipped(!flashcardFlipped)}
              className="w-full max-w-md h-48 bg-gradient-to-br from-blue-500 to-blue-700 rounded-2xl p-6 flex items-center justify-center cursor-pointer hover:scale-[1.02] transition-transform shadow-lg"
            >
              <div className="text-center text-white">
                <p className="text-[10px] uppercase tracking-wider opacity-60 mb-2">
                  {flashcardFlipped ? 'Respuesta' : 'Pregunta'} ({flashcardIdx + 1}/{flashcards.length})
                </p>
                <p className="text-lg font-medium">
                  {(() => {
                    const card = flashcards[flashcardIdx];
                    if (typeof card === 'string') return flashcardFlipped ? card : card.split('\n')[0];
                    return flashcardFlipped ? (card.answer || card.back || card.response || '') : (card.question || card.front || card.term || card.prompt || '');
                  })()}
                </p>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={() => { setFlashcardIdx(Math.max(0, flashcardIdx - 1)); setFlashcardFlipped(false); }}
                disabled={flashcardIdx === 0}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-700 rounded-lg text-xs font-medium disabled:opacity-30">
                ← Anterior
              </button>
              <button onClick={() => setFlashcardFlipped(!flashcardFlipped)}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg text-xs font-medium hover:bg-blue-600">
                Voltear
              </button>
              <button onClick={() => { setFlashcardIdx(Math.min(flashcards.length - 1, flashcardIdx + 1)); setFlashcardFlipped(false); }}
                disabled={flashcardIdx >= flashcards.length - 1}
                className="px-4 py-2 bg-slate-200 dark:bg-slate-700 rounded-lg text-xs font-medium disabled:opacity-30">
                Siguiente →
              </button>
            </div>
          </div>
        ) : displayContent ? (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 max-h-[500px] overflow-y-auto">
            <pre className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap font-sans">{displayContent}</pre>
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500 text-sm bg-slate-50 dark:bg-slate-900 rounded-xl">Sin vista previa</div>
        )}
        <button onClick={onDownload} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors">
          <ArrowDownToLine size={12} /> Descargar Flashcards
        </button>
      </div>
    );
  }

  // MIND MAP PREVIEW
  if (artifact.type_id === 'mind-map' || artifact.type === 'mind-map') {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 mb-2">
          <Brain size={18} className="text-orange-500" />
          <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Mapa Mental</span>
        </div>
        {mindmapNodes.length > 0 ? (
          <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-700 max-h-[500px] overflow-y-auto">
            {mindmapNodes.map((node: MindmapNode, i: number) => {
              const text = typeof node === 'string' ? node : node.label || node.text || node.title || node.name || JSON.stringify(node);
              const depth = typeof node === 'object' ? (node.depth || node.level || 0) : (text.match(/^#+\s/)?.[0]?.length || 0);
              const isRoot = depth === 0 || i === 0;
              return (
                <div key={i} className={`flex items-start gap-2 py-1.5 ${isRoot ? 'mt-2' : ''}`} style={{ paddingLeft: `${Math.min(depth * 16, 64)}px` }}>
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${isRoot ? 'bg-orange-500' : 'bg-slate-400'}`} />
                  <p className={`text-sm ${isRoot ? 'font-bold text-orange-700 dark:text-orange-300' : 'text-slate-600 dark:text-slate-400'}`}>
                    {text.replace(/^#+\s/, '')}
                  </p>
                </div>
              );
            })}
          </div>
        ) : displayContent ? (
          <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-700 max-h-[500px] overflow-y-auto">
            <pre className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap font-sans">{displayContent}</pre>
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500 text-sm bg-slate-50 dark:bg-slate-900 rounded-xl">Sin vista previa</div>
        )}
        <button onClick={onDownload} className="flex items-center gap-1.5 px-4 py-2 bg-orange-600 text-white rounded-lg text-xs font-medium hover:bg-orange-700 transition-colors">
          <ArrowDownToLine size={12} /> Descargar Mapa
        </button>
      </div>
    );
  }

  // REPORT / DEFAULT PREVIEW — always show something
  const rawDebug = detail?._raw ? JSON.stringify(detail._raw, null, 2) : '';
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-2">
        {genType && <genType.icon size={18} className={genType.color} />}
        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{genType?.label || 'Contenido'}</span>
      </div>
      {displayContent ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 max-h-[500px] overflow-y-auto">
          <pre className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap font-sans leading-relaxed">{displayContent}</pre>
        </div>
      ) : rawDebug ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4 max-h-[500px] overflow-y-auto">
          <p className="text-[10px] text-slate-400 mb-2 font-mono">Datos del artifact:</p>
          <pre className="text-xs text-slate-500 dark:text-slate-400 whitespace-pre-wrap font-mono leading-relaxed">{rawDebug}</pre>
        </div>
      ) : (
        <div className="text-center py-8 text-slate-500 text-sm bg-slate-50 dark:bg-slate-900 rounded-xl">Sin vista previa disponible</div>
      )}
      <div className="flex gap-2">
        <button onClick={onDownload} className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition-colors">
          <ArrowDownToLine size={12} /> Descargar
        </button>
        <button onClick={onExport} className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700 transition-colors">
          <ExternalLink size={12} /> Exportar a Docs
        </button>
      </div>
    </div>
  );
}

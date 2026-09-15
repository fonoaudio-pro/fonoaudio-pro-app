import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  BookOpen, ExternalLink, Maximize2, Minimize2, Plus, Trash2, MessageSquare,
  FileText, Headphones, HelpCircle, Brain, BarChart3, Presentation, Loader2,
  AlertCircle, CheckCircle, ChevronDown, ChevronRight, Send, RefreshCw,
  Link as LinkIcon, Copy, Eye, Clock, CheckCircle2, XCircle, Download,
  Search, Volume2, Image, ListOrdered, Lightbulb, File
} from 'lucide-react';

const API = '/api/notebooklm';

interface Notebook { id: string; title: string; sourceCount?: number; [k: string]: any; }
interface Source { id: string; title: string; type?: string; url?: string; status?: string; [k: string]: any; }
interface Artifact { id: string; title: string; type: string; type_id: string; status: string; status_id: number; created_at: string; [k: string]: any; }
interface ChatMsg { role: 'user' | 'assistant'; content: string; ts?: number; conversationId?: string; references?: any[]; }

const GEN_TYPES = [
  { key: 'audio', label: 'Podcast', icon: Headphones, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/20' },
  { key: 'quiz', label: 'Quiz', icon: HelpCircle, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/20' },
  { key: 'flashcards', label: 'Flashcards', icon: Copy, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
  { key: 'mind-map', label: 'Mapa Mental', icon: Brain, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/20' },
  { key: 'report', label: 'Reporte', icon: FileText, color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20' },
  { key: 'slide-deck', label: 'Diapositivas', icon: Presentation, color: 'text-cyan-500', bg: 'bg-cyan-50 dark:bg-cyan-900/20' },
];

const STATUS_MAP: Record<string, { icon: any; color: string; label: string }> = {
  completed: { icon: CheckCircle2, color: 'text-green-500', label: 'Listo' },
  in_progress: { icon: Loader2, color: 'text-blue-500 animate-spin', label: 'Generando...' },
  pending: { icon: Clock, color: 'text-yellow-500', label: 'Pendiente' },
  error: { icon: XCircle, color: 'text-red-500', label: 'Error' },
};

export default function NotebookLMPanel() {
  const [expanded, setExpanded] = useState(false);
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
  const [artifactDetail, setArtifactDetail] = useState<any>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

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
      if (!res.ok) return { error: true, message: `API ${res.status}` };
      const text = await res.text();
      try { return JSON.parse(text); } catch { return { error: true, message: 'Respuesta no válida' }; }
    } catch (e: any) {
      return { error: true, message: e.message };
    }
  }, []);

  const checkAuth = useCallback(async () => {
    const r = await apiCall('/notebooks?limit=1');
    if (r.error === 'auth_expired' || r.error === true) {
      setAuthOk(false);
    } else {
      setAuthOk(true);
      const list = Array.isArray(r) ? r : r.notebooks || [];
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
    const r = await apiCall(`/notebooks/${nbId}/sources`);
    if (Array.isArray(r)) setSources(r);
    else if (r.sources) setSources(r.sources);
    else setSources([]);
  }, [apiCall]);

  const loadArtifacts = useCallback(async (nbId: string) => {
    const r = await apiCall(`/notebooks/${nbId}/artifacts`);
    if (r.artifacts) setArtifacts(r.artifacts);
    else if (Array.isArray(r)) setArtifacts(r);
    else setArtifacts([]);
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

  const viewArtifact = async (art: Artifact) => {
    setSelectedArtifact(art);
    const r = await apiCall(`/notebooks/${selectedNb!.id}/artifacts/${art.id}`);
    setArtifactDetail(r);
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

  const loadSummary = async () => {
    if (!selectedNb) return;
    setSummary('loading');
    const r = await apiCall(`/notebooks/${selectedNb.id}/summary`);
    setSummary(r.summary || r.raw || r.message || 'No summary available');
  };

  // --- AUTH ---
  if (authOk === false) {
    return (
      <div className={`flex flex-col ${expanded ? 'fixed inset-0 z-50 bg-white dark:bg-slate-900' : 'h-full'}`}>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shrink-0">
          <BookOpen size={14} className="text-blue-500" />
          <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">NotebookLM</span>
          <div className="flex-1" />
          <button onClick={() => setExpanded(!expanded)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded">
            {expanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <AlertCircle size={48} className="text-amber-400 mb-4" />
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">Conectar con NotebookLM</p>
          {loading ? (
            <>
              <Loader2 size={20} className="animate-spin text-blue-500 mb-3" />
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">Se abrió una ventana para login.</p>
              <p className="text-[10px] text-slate-400">Hacé login y volvé acá.</p>
            </>
          ) : (
            <>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 max-w-xs">
                Necesitamos conectarnos a tu cuenta de Google para acceder a NotebookLM.
              </p>
              {error && (
                <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-2 mb-4 w-full max-w-sm">
                  <p className="text-[10px] text-amber-700 dark:text-amber-400 break-all">{error}</p>
                </div>
              )}
              <button onClick={connectNotebookLM}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold transition-colors flex items-center gap-2 shadow-lg">
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
      <div className="flex items-center justify-center h-full">
        <Loader2 size={24} className="animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${expanded ? 'fixed inset-0 z-50 bg-white dark:bg-slate-900' : 'h-full'}`}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shrink-0">
        <BookOpen size={14} className="text-blue-500" />
        <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300">NotebookLM</span>
        <CheckCircle size={10} className="text-green-500" />
        <div className="flex-1" />
        <button onClick={loadNotebooks} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded" title="Recargar">
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        </button>
        <button onClick={() => setExpanded(!expanded)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded">
          {expanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
        </button>
      </div>

      {error && (
        <div className="px-3 py-2 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-200 dark:border-amber-800 flex items-center gap-2">
          <AlertCircle size={12} className="text-amber-500 shrink-0" />
          <span className="text-[11px] text-amber-600 dark:text-amber-400 flex-1">{error}</span>
          <button onClick={() => setError(null)} className="text-amber-400 hover:text-amber-600 text-xs">✕</button>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        {/* Notebooks sidebar */}
        <div className="w-44 border-r border-slate-200 dark:border-slate-700 flex flex-col bg-slate-50 dark:bg-slate-800/50 shrink-0">
          <div className="flex items-center justify-between px-2 py-1.5 border-b border-slate-200 dark:border-slate-700">
            <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">Notebooks</span>
            <button onClick={() => setShowCreate(!showCreate)}
              className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded" title="Crear">
              <Plus size={12} />
            </button>
          </div>
          {showCreate && (
            <div className="px-2 py-1.5 border-b border-slate-200 dark:border-slate-700 flex gap-1">
              <input value={newTitle} onChange={e => setNewTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createNotebook()}
                placeholder="Título..." className="flex-1 text-[11px] px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800" />
              <button onClick={createNotebook} className="text-[10px] px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600">OK</button>
            </div>
          )}
          <div className="flex-1 overflow-y-auto">
            {notebooks.map(nb => (
              <div key={nb.id}
                onClick={() => { setSelectedNb(nb); setTab('sources'); setSelectedSource(null); setSelectedArtifact(null); }}
                className={`flex items-center gap-1.5 px-2 py-1.5 cursor-pointer border-b border-slate-100 dark:border-slate-800 transition-colors ${
                  selectedNb?.id === nb.id
                    ? 'bg-blue-50 dark:bg-blue-900/30 border-l-2 border-l-blue-500'
                    : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}>
                <BookOpen size={11} className="text-blue-400 shrink-0" />
                <span className="text-[11px] text-slate-700 dark:text-slate-300 flex-1 truncate">{nb.title || nb.id}</span>
                <button onClick={e => { e.stopPropagation(); deleteNotebook(nb.id); }}
                  className="p-0.5 opacity-0 hover:opacity-100 hover:text-red-500 text-slate-400">
                  <Trash2 size={10} />
                </button>
              </div>
            ))}
            {notebooks.length === 0 && !loading && (
              <p className="text-[10px] text-slate-400 p-2 text-center">No hay notebooks</p>
            )}
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {selectedNb ? (
            <>
              {/* Tabs */}
              <div className="flex border-b border-slate-200 dark:border-slate-700 shrink-0">
                {[
                  { key: 'sources', label: 'Fuentes', icon: FileText, count: sources.length },
                  { key: 'artifacts', label: 'Contenidos', icon: Presentation, count: artifacts.length },
                  { key: 'chat', label: 'Chat', icon: MessageSquare },
                  { key: 'generate', label: 'Generar', icon: BarChart3 },
                ].map(t => (
                  <button key={t.key} onClick={() => setTab(t.key as any)}
                    className={`flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium border-b-2 transition-colors ${
                      tab === t.key
                        ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}>
                    <t.icon size={12} /> {t.label}
                    {t.count !== undefined && <span className="text-[9px] bg-slate-200 dark:bg-slate-700 px-1 rounded">{t.count}</span>}
                  </button>
                ))}
                <div className="flex-1" />
                <button onClick={loadSummary}
                  className="flex items-center gap-1 px-2 py-1.5 text-[10px] text-slate-400 hover:text-blue-500">
                  <Lightbulb size={11} /> Resumen
                </button>
              </div>

              {/* Summary panel */}
              {summary && (
                <div className="px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800 shrink-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400">Resumen del notebook</span>
                    <button onClick={() => setSummary(null)} className="text-blue-400 hover:text-blue-600 text-xs">✕</button>
                  </div>
                  {summary === 'loading' ? (
                    <Loader2 size={14} className="animate-spin text-blue-400" />
                  ) : (
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 whitespace-pre-wrap max-h-32 overflow-y-auto">{summary}</p>
                  )}
                </div>
              )}

              {/* Tab content */}
              <div className="flex-1 overflow-y-auto">
                {/* SOURCES */}
                {tab === 'sources' && !selectedSource && (
                  <div className="p-3">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[11px] font-medium text-slate-500">{sources.length} fuente{sources.length !== 1 ? 's' : ''}</span>
                      <button onClick={() => setShowAddSource(!showAddSource)}
                        className="flex items-center gap-1 text-[10px] px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600">
                        <Plus size={10} /> Agregar
                      </button>
                    </div>
                    {showAddSource && (
                      <div className="mb-3 p-2 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 space-y-2">
                        <div className="flex gap-1">
                          {(['url', 'text', 'youtube'] as const).map(t => (
                            <button key={t} onClick={() => setAddSourceType(t)}
                              className={`text-[10px] px-2 py-0.5 rounded ${addSourceType === t ? 'bg-blue-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400'}`}>{t}</button>
                          ))}
                        </div>
                        <input value={addSourceTitle} onChange={e => setAddSourceTitle(e.target.value)}
                          placeholder="Título (opcional)" className="w-full text-[11px] px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900" />
                        <textarea value={addSourceInput} onChange={e => setAddSourceInput(e.target.value)}
                          placeholder={addSourceType === 'url' ? 'https://...' : addSourceType === 'youtube' ? 'https://youtube.com/watch?v=...' : 'Pegá texto aquí...'}
                          rows={3} className="w-full text-[11px] px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 resize-none" />
                        <div className="flex gap-1 justify-end">
                          <button onClick={() => setShowAddSource(false)} className="text-[10px] px-2 py-1 text-slate-500 hover:text-slate-700">Cancelar</button>
                          <button onClick={addSource} className="text-[10px] px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600">Agregar</button>
                        </div>
                      </div>
                    )}
                    {sources.map(src => (
                      <div key={src.id}
                        onClick={() => viewSource(src)}
                        className="flex items-center gap-2 p-2 mb-1 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 cursor-pointer hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
                        <FileText size={12} className="text-blue-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-slate-700 dark:text-slate-300 truncate">{src.title || src.id}</p>
                          <div className="flex items-center gap-2">
                            {src.type && <span className="text-[9px] text-slate-400">{src.type}</span>}
                            {src.url && <span className="text-[9px] text-blue-400 truncate max-w-[200px]">{src.url}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Eye size={11} className="text-slate-400" />
                          <button onClick={e => { e.stopPropagation(); deleteSource(src.id); }}
                            className="p-0.5 text-slate-400 hover:text-red-500">
                            <Trash2 size={10} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* SOURCE VIEWER */}
                {tab === 'sources' && selectedSource && (
                  <div className="p-3">
                    <div className="flex items-center gap-2 mb-3">
                      <button onClick={() => { setSelectedSource(null); setSourceContent(null); }}
                        className="text-[11px] text-blue-500 hover:text-blue-700">← Volver</button>
                      <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300 truncate">{selectedSource.title}</span>
                    </div>
                    {sourceContent === 'loading' ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 size={20} className="animate-spin text-blue-500" />
                      </div>
                    ) : (
                      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-3 max-h-[500px] overflow-y-auto">
                        <pre className="text-[11px] text-slate-600 dark:text-slate-400 whitespace-pre-wrap font-sans leading-relaxed">
                          {(sourceContent || '').slice(0, 5000)}
                          {(sourceContent || '').length > 5000 && '\n\n... (contenido truncado)'}
                        </pre>
                      </div>
                    )}
                  </div>
                )}

                {/* ARTIFACTS */}
                {tab === 'artifacts' && !selectedArtifact && (
                  <div className="p-3">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[11px] font-medium text-slate-500">{artifacts.length} contenido{artifacts.length !== 1 ? 's' : ''}</span>
                    </div>
                    {artifacts.length === 0 ? (
                      <div className="text-center py-8">
                        <Presentation size={32} className="text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                        <p className="text-[11px] text-slate-400">No hay contenidos generados</p>
                        <p className="text-[10px] text-slate-400">Andá a "Generar" para crear contenido</p>
                      </div>
                    ) : (
                      artifacts.map(art => {
                        const st = STATUS_MAP[art.status] || STATUS_MAP.pending;
                        const genType = GEN_TYPES.find(g => g.key === art.type_id);
                        return (
                          <div key={art.id}
                            onClick={() => viewArtifact(art)}
                            className="flex items-center gap-3 p-3 mb-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
                            {genType ? <genType.icon size={20} className={genType.color} /> : <File size={20} className="text-slate-400" />}
                            <div className="flex-1 min-w-0">
                              <p className="text-[12px] font-medium text-slate-700 dark:text-slate-300">{art.title}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] text-slate-400">{art.type}</span>
                                <span className={`flex items-center gap-1 text-[10px] ${st.color}`}>
                                  <st.icon size={10} className={st.color} /> {st.label}
                                </span>
                              </div>
                            </div>
                            {art.status === 'in_progress' && (
                              <button onClick={e => { e.stopPropagation(); waitForArtifact(art); }}
                                className="text-[10px] px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600">
                                Esperar
                              </button>
                            )}
                            {art.status === 'completed' && (
                              <Eye size={14} className="text-blue-500" />
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* ARTIFACT DETAIL */}
                {tab === 'artifacts' && selectedArtifact && (
                  <div className="p-3">
                    <div className="flex items-center gap-2 mb-3">
                      <button onClick={() => { setSelectedArtifact(null); setArtifactDetail(null); }}
                        className="text-[11px] text-blue-500 hover:text-blue-700">← Volver</button>
                      <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">{selectedArtifact.title}</span>
                      <span className="text-[10px] text-slate-400">{selectedArtifact.type}</span>
                    </div>
                    {artifactDetail?.status === 'in_progress' ? (
                      <div className="text-center py-8">
                        <Loader2 size={32} className="animate-spin text-blue-500 mx-auto mb-3" />
                        <p className="text-[12px] text-slate-500">Generando contenido...</p>
                        <button onClick={() => waitForArtifact(selectedArtifact)}
                          className="mt-3 text-[10px] px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600">
                          Actualizar estado
                        </button>
                      </div>
                    ) : artifactDetail?.status === 'error' ? (
                      <div className="text-center py-8">
                        <XCircle size={32} className="text-red-400 mx-auto mb-3" />
                        <p className="text-[12px] text-red-500">Error al generar</p>
                        <button onClick={() => generateContent(selectedArtifact.type_id)}
                          className="mt-3 text-[10px] px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600">
                          Reintentar
                        </button>
                      </div>
                    ) : (
                      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                        <div className="flex items-center gap-2 mb-3">
                          {(() => { const gt = GEN_TYPES.find(g => g.key === selectedArtifact.type_id); return gt ? <gt.icon size={16} className={gt.color} /> : null; })()}
                          <span className="text-[12px] font-medium text-slate-700 dark:text-slate-300">{selectedArtifact.title}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 mb-3">
                          Tipo: {selectedArtifact.type} | Creado: {new Date(selectedArtifact.created_at).toLocaleString('es-AR')}
                        </p>
                        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 mb-3">
                          <p className="text-[11px] text-blue-700 dark:text-blue-300">
                            Este contenido fue generado en NotebookLM. Para verlo o descargarlo, hacé click en "Abrir en NotebookLM".
                          </p>
                        </div>
                        <a href={`https://notebooklm.google.com/`}
                          target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                          <ExternalLink size={12} /> Abrir en NotebookLM
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {/* CHAT */}
                {tab === 'chat' && (
                  <div className="flex flex-col h-full">
                    <div className="flex-1 overflow-y-auto space-y-2 p-3">
                      {chat.length === 0 && (
                        <p className="text-[11px] text-slate-400 text-center mt-8">
                          Preguntale anything sobre las fuentes del notebook
                        </p>
                      )}
                      {chat.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[85%] px-3 py-2 rounded-lg text-[11px] ${
                            msg.role === 'user'
                              ? 'bg-blue-500 text-white rounded-br-sm'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-bl-sm'
                          }`}>
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                            {msg.references && msg.references.length > 0 && (
                              <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                                <p className="text-[9px] text-slate-400 mb-1">Fuentes citadas:</p>
                                <div className="flex flex-wrap gap-1">
                                  {msg.references.slice(0, 5).map((ref: any, j: number) => (
                                    <span key={j} className="text-[8px] px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded">
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
                          <div className="bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-lg rounded-bl-sm">
                            <Loader2 size={14} className="animate-spin text-slate-400" />
                          </div>
                        </div>
                      )}
                      <div ref={chatEndRef} />
                    </div>
                    <div className="flex gap-1.5 p-2 border-t border-slate-200 dark:border-slate-700 shrink-0">
                      <input value={chatInput} onChange={e => setChatInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendChat()}
                        placeholder="Escribí tu pregunta..."
                        className="flex-1 text-[11px] px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800" />
                      <button onClick={sendChat} disabled={chatLoading || !chatInput.trim()}
                        className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50">
                        <Send size={14} />
                      </button>
                    </div>
                  </div>
                )}

                {/* GENERATE */}
                {tab === 'generate' && (
                  <div className="p-3">
                    <p className="text-[11px] text-slate-500 mb-3">Generá contenido a partir de las fuentes del notebook:</p>
                    <div className="grid grid-cols-2 gap-2">
                      {GEN_TYPES.map(g => (
                        <button key={g.key} onClick={() => generateContent(g.key)}
                          disabled={!!genLoading}
                          className={`flex flex-col items-center gap-2 p-4 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700 transition-colors disabled:opacity-50 ${g.bg}`}>
                          {genLoading === g.key ? (
                            <Loader2 size={24} className="animate-spin text-blue-500" />
                          ) : (
                            <g.icon size={24} className={g.color} />
                          )}
                          <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">{g.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <BookOpen size={40} className="text-blue-300 dark:text-blue-600 mb-3" />
              <p className="text-sm font-bold text-slate-600 dark:text-slate-300 mb-1">Seleccioná un notebook</p>
              <p className="text-[11px] text-slate-400">Elegí uno de la izquierda o creá uno nuevo</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

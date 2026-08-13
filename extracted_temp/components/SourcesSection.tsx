import React, { useState, useEffect, useCallback } from 'react';
import {
  BookOpen, Search, Plus, Trash2, Loader2, Check, AlertCircle, ExternalLink,
  FileText, RefreshCw, Sparkles, Brain, Share2, Download, Printer, Send,
  MessageCircle, Mail, ChevronDown, ChevronRight, Copy, Eye, Wand2, Lightbulb,
  Filter, BarChart3, Tag, Clock, X, Zap, BookMarked, Database
} from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
import { generateText } from '../utils/geminiHelpers';
import ShareMenu from './ShareMenu';
import { ShareMaterialInput } from '../utils/shareMaterial';

interface ClinicalSource {
  id: string;
  title: string;
  category: string;
  content: string;
  keywords?: string[];
  created_at: string;
}

interface SourcesSectionProps {
  onNavigate?: (view: string) => void;
}

const SOURCE_CATEGORIES = [
  { value: 'protocol', label: 'Protocolo', icon: '📋', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' },
  { value: 'article', label: 'Artículo', icon: '📰', color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' },
  { value: 'guide', label: 'Guía', icon: '📘', color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400' },
  { value: 'manual', label: 'Manual', icon: '📖', color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' },
  { value: 'other', label: 'Otro', icon: '📄', color: 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-400' },
];

const AI_TEMPLATES = [
  { label: 'Guía para padres', prompt: 'Generá una guía completa para padres sobre: ', icon: '👨‍👩‍👧' },
  { label: 'Protocolo de intervención', prompt: 'Creá un protocolo detallado de intervención fonoaudiológica para: ', icon: '📋' },
  { label: 'Resumen de evidencia', prompt: 'Hacé un resumen de la evidencia científica actual sobre: ', icon: '🔬' },
  { label: 'Actividades terapéuticas', prompt: 'Diseñá 5 actividades terapéuticas para trabajar con pacientes de: ', icon: '🎯' },
  { label: 'Material psicoeducativo', prompt: 'Generá material psicoeducativo para pacientes sobre: ', icon: '📚' },
  { label: 'Checklist de evaluación', prompt: 'Creá una checklist de evaluación fonoaudiológica para: ', icon: '✅' },
];

export default function SourcesSection({ onNavigate }: SourcesSectionProps) {
  const [sources, setSources] = useState<ClinicalSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('protocol');
  const [newContent, setNewContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // AI Generation
  const [activeTab, setActiveTab] = useState<'browse' | 'generate' | 'integrations'>('browse');
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [aiAssisting, setAiAssisting] = useState(false);

  // Share
  const [shareMaterial, setShareMaterial] = useState<ShareMaterialInput | null>(null);
  const [showShareMenu, setShowShareMenu] = useState(false);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [expandedSource, setExpandedSource] = useState<string | null>(null);

  useEffect(() => {
    loadSources();
  }, []);

  async function loadSources() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('clinical_sources')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      setSources(data || []);
    } catch (e: any) {
      console.error('[SourcesSection] Error loading sources:', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchResults([]);
    try {
      // Try embeddings search first
      const { data: embData, error: embError } = await supabase
        .from('source_embeddings')
        .select('content, source_id, clinical_sources(title, category)')
        .textSearch('content', searchQuery)
        .limit(10);
      
      if (!embError && embData && embData.length > 0) {
        setSearchResults(embData);
      } else {
        // Fallback: search clinical_sources directly by title/content
        const { data: fallbackData } = await supabase
          .from('clinical_sources')
          .select('id, title, category, content')
          .or(`title.ilike.%${searchQuery}%,content.ilike.%${searchQuery}%`)
          .limit(10);
        
        setSearchResults((fallbackData || []).map(s => ({
          source_id: s.id,
          content: s.content?.substring(0, 500) || '',
          clinical_sources: { title: s.title, category: s.category }
        })));
      }
    } catch (e: any) {
      console.error('[SourcesSection] Search error:', e);
      setError('Error en la búsqueda');
      setTimeout(() => setError(null), 3000);
    } finally {
      setSearching(false);
    }
  }

  async function handleAddSource() {
    if (!newTitle.trim() || !newContent.trim()) {
      setError('Título y contenido son requeridos');
      setTimeout(() => setError(null), 3000);
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('clinical_sources').insert({
        title: newTitle.trim(),
        category: newCategory,
        content: newContent.trim(),
      });
      if (error) throw error;
      setSuccess('Fuente agregada correctamente');
      setTimeout(() => setSuccess(null), 3000);
      setNewTitle('');
      setNewContent('');
      setShowAddForm(false);
      loadSources();
    } catch (e: any) {
      console.error('[SourcesSection] Error adding source:', e);
      setError('Error al guardar la fuente');
      setTimeout(() => setError(null), 3000);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteSource(id: string) {
    try {
      await supabase.from('source_embeddings').delete().eq('source_id', id);
      await supabase.from('clinical_sources').delete().eq('id', id);
      setSources(prev => prev.filter(s => s.id !== id));
    } catch (e: any) {
      console.error('[SourcesSection] Error deleting source:', e);
    }
  }

  async function handleAIAssist() {
    if (!newContent.trim()) return;
    setAiAssisting(true);
    setAiSuggestion(null);
    try {
      const result = await generateText(`Analizá este texto clínico y devolvé:
1. Categoría sugerida (protocol/article/guide/manual/other)
2. 3-5 palabras clave importantes
3. Un resumen de 1 línea

TEXTO:
${newContent.substring(0, 1000)}

Respondé en este formato exacto:
CATEGORÍA: [valor]
CLAVES: [palabra1, palabra2, palabra3]
RESUMEN: [resumen]`);
      if (result) {
        setAiSuggestion(result);
        const catMatch = result.match(/CATEGORÍA:\s*(\w+)/i);
        if (catMatch) {
          const cat = catMatch[1].toLowerCase();
          if (['protocol', 'article', 'guide', 'manual', 'other'].includes(cat)) {
            setNewCategory(cat);
          }
        }
      }
    } catch (e) {
      console.error('[SourcesSection] AI assist error:', e);
    } finally {
      setAiAssisting(false);
    }
  }

  async function handleAIGenerate() {
    if (!aiPrompt.trim()) return;
    setAiGenerating(true);
    setAiResult(null);
    try {
      // Pull context from clinical sources
      const contextSnippets = sources.slice(0, 5).map(s => `- ${s.title}: ${s.content.substring(0, 200)}`).join('\n');

      const result = await generateText(`${aiPrompt}

${contextSnippets ? `CONTEXTO DE FUENTES CLÍNICAS DISPONIBLES:\n${contextSnippets}` : ''}

Generá una respuesta completa, profesional y utilizable como material clínico. Usá formato markdown con títulos, listas y secciones claras. NO uses emojis en el contenido.`);

      if (result && result.trim()) {
        setAiResult(result);
      } else {
        setAiResult('No se pudo generar contenido. Verificá que la API key de Gemini esté configurada correctamente en .env.local (VITE_GOOGLE_API_KEY).');
      }
    } catch (e: any) {
      console.error('[SourcesSection] AI generate error:', e);
      setAiResult(`Error al generar: ${e?.message || 'Error desconocido'}. Verificá la configuración de la API key.`);
    } finally {
      setAiGenerating(false);
    }
  }

  const handleShare = (title: string, content: string) => {
    setShareMaterial({
      title,
      description: content.substring(0, 200),
      clinicalArea: 'Fonoaudiología',
    });
    setShowShareMenu(true);
  };

  const filteredSources = sources.filter(s =>
    (categoryFilter === 'all' || s.category === categoryFilter) &&
    (!searchQuery || s.title.toLowerCase().includes(searchQuery.toLowerCase()) || s.content.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const stats = {
    total: sources.length,
    protocols: sources.filter(s => s.category === 'protocol').length,
    articles: sources.filter(s => s.category === 'article').length,
    guides: sources.filter(s => s.category === 'guide').length,
    manuals: sources.filter(s => s.category === 'manual').length,
  };

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
            <BookMarked size={28} className="text-emerald-600 dark:text-emerald-400" />
            Fuentes Clínicas
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Base de conocimiento clínico + generación IA</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium transition-colors">
            <Plus size={16} /> Nueva Fuente
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total', value: stats.total, icon: Database, color: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300' },
          { label: 'Protocolos', value: stats.protocols, icon: FileText, color: 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' },
          { label: 'Artículos', value: stats.articles, icon: BookOpen, color: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400' },
          { label: 'Guías', value: stats.guides, icon: Lightbulb, color: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400' },
          { label: 'Manuales', value: stats.manuals, icon: Tag, color: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400' },
        ].map((stat, i) => (
          <div key={i} className={`p-3 rounded-xl ${stat.color} flex items-center gap-3`}>
            <stat.icon size={20} />
            <div>
              <p className="text-xs font-medium opacity-70">{stat.label}</p>
              <p className="text-xl font-bold">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
        {[
          { key: 'browse', label: 'Explorar Fuentes', icon: Search },
          { key: 'generate', label: 'Generar con IA', icon: Sparkles },
          { key: 'integrations', label: 'Integraciones', icon: Zap },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex-1 justify-center ${
              activeTab === tab.key
                ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}>
            <tab.icon size={16} /> {tab.label}
          </button>
        ))}
      </div>

      {/* Status Messages */}
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-2">
          <AlertCircle size={16} className="text-red-500 shrink-0" />
          <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600"><X size={14} /></button>
        </div>
      )}
      {success && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-center gap-2">
          <Check size={16} className="text-emerald-500 shrink-0" />
          <span className="text-sm text-emerald-600 dark:text-emerald-400">{success}</span>
        </div>
      )}

      {/* Add Form */}
      {showAddForm && (
        <div className="p-4 bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-emerald-700 dark:text-emerald-300 text-sm">Nueva Fuente Clínica</h4>
            <button onClick={() => setShowAddForm(false)} className="text-emerald-400 hover:text-emerald-600"><X size={16} /></button>
          </div>
          <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Título de la fuente"
            className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-white placeholder:text-slate-400" />
          <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-white">
            {SOURCE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
          </select>
          <textarea value={newContent} onChange={(e) => setNewContent(e.target.value)}
            placeholder="Contenido de la fuente clínica (texto, protocolo, guía, etc.)"
            rows={6}
            className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-white placeholder:text-slate-400 resize-none" />
          {aiSuggestion && (
            <div className="p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
              <p className="text-xs font-bold text-purple-600 dark:text-purple-400 mb-1 flex items-center gap-1">
                <Sparkles size={12} /> Sugerencia AI
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{aiSuggestion}</p>
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={handleAIAssist} disabled={aiAssisting || !newContent.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg text-sm font-medium hover:bg-purple-200 dark:hover:bg-purple-900/50 disabled:opacity-50 transition-colors">
              {aiAssisting ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {aiAssisting ? 'Analizando...' : 'AI: Analizar'}
            </button>
            <button onClick={handleAddSource} disabled={saving}
              className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors">
              {saving ? <Loader2 size={14} className="animate-spin inline" /> : <Check size={14} className="inline" />} Guardar Fuente
            </button>
          </div>
        </div>
      )}

      {/* BROWSE TAB */}
      {activeTab === 'browse' && (
        <div className="space-y-4">
          {/* Search + Filters */}
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Buscar en fuentes clínicas..."
                className="w-full pl-10 pr-3 py-2.5 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <button onClick={handleSearch} disabled={searching}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-colors">
              {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            </button>
          </div>

          {/* Category Filters */}
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setCategoryFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                categoryFilter === 'all'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}>
              Todas ({sources.length})
            </button>
            {SOURCE_CATEGORIES.map(cat => (
              <button key={cat.value} onClick={() => setCategoryFilter(cat.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  categoryFilter === cat.value
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}>
                {cat.icon} {cat.label} ({sources.filter(s => s.category === cat.value).length})
              </button>
            ))}
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="p-4 bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded-xl">
              <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase mb-3">Resultados de búsqueda semántica</p>
              <div className="space-y-2">
                {searchResults.map((r, i) => (
                  <div key={i} className="p-3 bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                    <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{r.clinical_sources?.title || 'Sin título'}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 line-clamp-3">{r.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sources List */}
          {loading ? (
            <div className="p-12 text-center">
              <Loader2 size={24} className="animate-spin text-emerald-500 mx-auto" />
              <p className="text-sm text-slate-400 mt-2">Cargando fuentes...</p>
            </div>
          ) : filteredSources.length === 0 ? (
            <div className="p-12 text-center">
              <BookOpen size={48} className="text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                {sources.length === 0 ? 'No hay fuentes clínicas cargadas' : 'No se encontraron resultados'}
              </p>
              {sources.length === 0 && (
                <button onClick={() => setShowAddForm(true)}
                  className="mt-3 text-sm font-bold text-emerald-600 dark:text-emerald-400 hover:underline">
                  + Agregar primera fuente
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredSources.map(source => {
                const cat = SOURCE_CATEGORIES.find(c => c.value === source.category);
                const isExpanded = expandedSource === source.id;
                return (
                  <div key={source.id}
                    className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors">
                    <div className="p-4 flex items-start gap-3 cursor-pointer" onClick={() => setExpandedSource(isExpanded ? null : source.id)}>
                      <div className="text-2xl shrink-0">{cat?.icon || '📄'}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{source.title}</p>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cat?.color || ''}`}>
                            {cat?.label || source.category}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 line-clamp-2">{source.content.substring(0, 150)}...</p>
                        <p className="text-[10px] text-slate-300 dark:text-slate-600 mt-1">
                          {new Date(source.created_at).toLocaleDateString('es-AR')}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={(e) => { e.stopPropagation(); handleShare(source.title, source.content); }}
                          className="p-1.5 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors" title="Compartir">
                          <Share2 size={14} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteSource(source.id); }}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="Eliminar">
                          <Trash2 size={14} />
                        </button>
                        {isExpanded ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                      </div>
                    </div>
                    {isExpanded && (
                      <div className="px-4 pb-4 border-t border-slate-100 dark:border-slate-700 pt-3">
                        <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-3 max-h-[300px] overflow-y-auto">
                          <pre className="text-xs text-slate-600 dark:text-slate-400 whitespace-pre-wrap font-sans leading-relaxed">
                            {source.content}
                          </pre>
                        </div>
                        <div className="flex gap-2 mt-3">
                          <button onClick={() => handleShare(source.title, source.content)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg text-xs font-medium hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors">
                            <Share2 size={12} /> Compartir
                          </button>
                          <button onClick={() => {
                            const blob = new Blob([source.content], { type: 'text/plain' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url; a.download = `${source.title.replace(/[^a-zA-Z0-9]/g, '_')}.txt`;
                            a.click(); URL.revokeObjectURL(url);
                          }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg text-xs font-medium hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors">
                            <Download size={12} /> Descargar
                          </button>
                          <button onClick={() => window.print()}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg text-xs font-medium hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors">
                            <Printer size={12} /> Imprimir
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* GENERATE TAB */}
      {activeTab === 'generate' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
            <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 mb-4">
              <Sparkles size={20} className="text-purple-500" /> Generador de Contenido Clínico IA
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
              Generá guías, protocolos, actividades y material terapéutico usando IA. Las fuentes clínicas cargadas se usan como contexto.
            </p>

            {/* Quick Templates */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
              {AI_TEMPLATES.map((tmpl, i) => (
                <button key={i} onClick={() => { setSelectedTemplate(i); setAiPrompt(tmpl.prompt); }}
                  className={`flex items-center gap-2 p-3 rounded-xl border text-left transition-all ${
                    selectedTemplate === i
                      ? 'border-purple-400 dark:border-purple-600 bg-purple-50 dark:bg-purple-900/20'
                      : 'border-slate-200 dark:border-slate-700 hover:border-purple-300 dark:hover:border-purple-700'
                  }`}>
                  <span className="text-xl">{tmpl.icon}</span>
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{tmpl.label}</span>
                </button>
              ))}
            </div>

            {/* Prompt Input */}
            <textarea value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Describí qué querés generar..."
              rows={4}
              className="w-full px-4 py-3 text-sm bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-white placeholder:text-slate-400 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500" />

            <div className="flex gap-2 mt-3">
              <button onClick={handleAIGenerate} disabled={aiGenerating || !aiPrompt.trim()}
                className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-colors">
                {aiGenerating ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                {aiGenerating ? 'Generando...' : 'Generar Contenido'}
              </button>
              {aiResult && (
                <>
                  <button onClick={() => {
                    navigator.clipboard.writeText(aiResult || '');
                    setSuccess('Copiado al portapapeles');
                    setTimeout(() => setSuccess(null), 2000);
                  }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                    <Copy size={14} /> Copiar
                  </button>
                  <button onClick={() => handleShare('Contenido generado IA', aiResult || '')}
                    className="flex items-center gap-2 px-4 py-2.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl text-sm font-medium hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors">
                    <Share2 size={14} /> Compartir
                  </button>
                  <button onClick={() => {
                    const blob = new Blob([aiResult || ''], { type: 'text/markdown' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url; a.download = `contenido_ia_${Date.now()}.md`;
                    a.click(); URL.revokeObjectURL(url);
                  }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-xl text-sm font-medium hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors">
                    <Download size={14} /> Descargar .md
                  </button>
                </>
              )}
            </div>
          </div>

          {/* AI Result */}
          {aiResult && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-purple-200 dark:border-purple-800 p-6">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-bold text-purple-700 dark:text-purple-300 flex items-center gap-2">
                  <Sparkles size={16} /> Contenido Generado
                </h4>
                <button onClick={() => setAiResult(null)} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-4 max-h-[500px] overflow-y-auto">
                <pre className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-sans leading-relaxed">{aiResult}</pre>
              </div>
            </div>
          )}
        </div>
      )}

      {/* INTEGRATIONS TAB */}
      {activeTab === 'integrations' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* NotebookLM */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                  <BookOpen size={20} className="text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 dark:text-white text-sm">NotebookLM</h4>
                  <p className="text-xs text-slate-400">Investigación con IA de Google</p>
                </div>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                Consultá fuentes científicas, generá podcasts, diapositivas y quizzes directamente en NotebookLM.
              </p>
              <button onClick={() => onNavigate?.('notebooklm')}
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2">
                <ExternalLink size={14} /> Abrir NotebookLM
              </button>
            </div>

            {/* Multimedia */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
                  <Sparkles size={20} className="text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 dark:text-white text-sm">Multimedia</h4>
                  <p className="text-xs text-slate-400">Crear materiales visuales</p>
                </div>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                Usá tus fuentes clínicas como contexto para generar materiales terapéuticos con IA.
              </p>
              <button onClick={() => onNavigate?.('multimedia')}
                className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2">
                <Sparkles size={14} /> Abrir Multimedia
              </button>
            </div>

            {/* Asistente */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center">
                  <Brain size={20} className="text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 dark:text-white text-sm">Asistente IA</h4>
                  <p className="text-xs text-slate-400">Chat con contexto clínico</p>
                </div>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                El asistente usa tus fuentes clínicas para respuestas más precisas. Pedile que genere contenido.
              </p>
              <button onClick={() => {
                const evt = new CustomEvent('toggle-assistant');
                window.dispatchEvent(evt);
              }}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2">
                <Brain size={14} /> Abrir Asistente
              </button>
            </div>

            {/* Canal Clínico */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center">
                  <MessageCircle size={20} className="text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h4 className="font-bold text-slate-800 dark:text-white text-sm">Canal Clínico</h4>
                  <p className="text-xs text-slate-400">Telegram con pacientes</p>
                </div>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
                Enviá materiales generados directamente a tus pacientes por Telegram.
              </p>
              <button onClick={() => onNavigate?.('telegram')}
                className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2">
                <Send size={14} /> Abrir Canal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Menu */}
      {shareMaterial && (
        <ShareMenu material={shareMaterial} isOpen={showShareMenu} onClose={() => setShowShareMenu(false)} />
      )}
    </div>
  );
}

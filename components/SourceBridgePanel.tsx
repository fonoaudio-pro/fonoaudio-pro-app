import React, { useState, useEffect } from 'react';
import { BookOpen, Search, Plus, Trash2, Loader2, Check, AlertCircle, ExternalLink, FileText, RefreshCw, Sparkles } from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
import { generateText } from '../utils/geminiHelpers';

interface ClinicalSource {
  id: string;
  title: string;
  category: string;
  content: string;
  created_at: string;
}

interface SourceBridgePanelProps {
  onNavigateToSettings?: () => void;
}

const SOURCE_CATEGORIES = [
  { value: 'protocol', label: 'Protocolo' },
  { value: 'article', label: 'Artículo' },
  { value: 'guide', label: 'Guía' },
  { value: 'manual', label: 'Manual' },
  { value: 'other', label: 'Otro' },
];

export default function SourceBridgePanel({ onNavigateToSettings }: SourceBridgePanelProps) {
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
  const [aiAssisting, setAiAssisting] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);

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
        .limit(50);
      if (error) throw error;
      setSources(data || []);
    } catch (e: any) {
      console.error('[SourceBridge] Error loading sources:', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch() {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchResults([]);
    try {
      const { data, error } = await supabase
        .from('source_embeddings')
        .select('content, source_id, clinical_sources(title, category)')
        .textSearch('content', searchQuery)
        .limit(5);
      if (error) throw error;
      setSearchResults(data || []);
    } catch (e: any) {
      console.error('[SourceBridge] Search error:', e);
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
      });
      if (error) throw error;
      setSuccess('Fuente agregada correctamente');
      setTimeout(() => setSuccess(null), 3000);
      setNewTitle('');
      setNewContent('');
      setShowAddForm(false);
      loadSources();
    } catch (e: any) {
      console.error('[SourceBridge] Error adding source:', e);
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
      console.error('[SourceBridge] Error deleting source:', e);
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
        // Try to extract category
        const catMatch = result.match(/CATEGORÍA:\s*(\w+)/i);
        if (catMatch) {
          const cat = catMatch[1].toLowerCase();
          if (['protocol', 'article', 'guide', 'manual', 'other'].includes(cat)) {
            setNewCategory(cat);
          }
        }
      }
    } catch (e) {
      console.error('[SourceBridge] AI assist error:', e);
    } finally {
      setAiAssisting(false);
    }
  }

  const filteredSources = sources.filter(s =>
    !searchQuery || s.title.toLowerCase().includes(searchQuery.toLowerCase()) || s.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
        <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
          <BookOpen size={18} className="text-emerald-600 dark:text-emerald-400" /> Fuentes Clínicas
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full">
            {sources.length} fuentes
          </span>
          <button onClick={() => setShowAddForm(!showAddForm)}
            className="p-1.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors">
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="p-3 border-b border-slate-100 dark:border-slate-700">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Buscar en fuentes clínicas..."
              className="w-full pl-7 pr-2 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
          <button onClick={handleSearch} disabled={searching}
            className="px-2 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium disabled:opacity-50 transition-colors">
            {searching ? <Loader2 size={12} className="animate-spin" /> : <Search size={12} />}
          </button>
        </div>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="p-3 border-b border-slate-100 dark:border-slate-700 bg-emerald-50/50 dark:bg-emerald-900/10 space-y-2">
          <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Título de la fuente"
            className="w-full px-2 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-white placeholder:text-slate-400" />
          <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)}
            className="w-full px-2 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-white">
            {SOURCE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <textarea value={newContent} onChange={(e) => setNewContent(e.target.value)}
            placeholder="Contenido de la fuente clínica..."
            rows={4}
            className="w-full px-2 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-700 dark:text-white placeholder:text-slate-400 resize-none" />
          {aiSuggestion && (
            <div className="p-2 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
              <p className="text-[10px] font-bold text-purple-600 dark:text-purple-400 mb-1 flex items-center gap-1">
                <Sparkles size={10} /> Sugerencia AI
              </p>
              <p className="text-[10px] text-slate-600 dark:text-slate-300 whitespace-pre-wrap">{aiSuggestion}</p>
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={handleAIAssist} disabled={aiAssisting || !newContent.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg text-xs font-medium hover:bg-purple-200 dark:hover:bg-purple-900/50 disabled:opacity-50 transition-colors">
              {aiAssisting ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              {aiAssisting ? 'Analizando...' : 'AI: Analizar'}
            </button>
            <button onClick={handleAddSource} disabled={saving}
              className="flex-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium disabled:opacity-50 transition-colors">
              {saving ? <Loader2 size={12} className="animate-spin inline" /> : <Check size={12} className="inline" />} Guardar
            </button>
            <button onClick={() => setShowAddForm(false)}
              className="px-3 py-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-xs font-medium transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Status messages */}
      {error && (
        <div className="p-2 mx-3 mt-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2">
          <AlertCircle size={12} className="text-red-500 shrink-0" />
          <span className="text-[10px] text-red-600 dark:text-red-400">{error}</span>
        </div>
      )}
      {success && (
        <div className="p-2 mx-3 mt-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg flex items-center gap-2">
          <Check size={12} className="text-emerald-500 shrink-0" />
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400">{success}</span>
        </div>
      )}

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="p-3 border-b border-slate-100 dark:border-slate-700">
          <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase mb-2">Resultados de búsqueda</p>
          <div className="space-y-2">
            {searchResults.map((r, i) => (
              <div key={i} className="p-2 bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300">{r.clinical_sources?.title || 'Sin título'}</p>
                <p className="text-[10px] text-slate-600 dark:text-slate-300 mt-0.5 line-clamp-2">{r.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sources List */}
      <div className="max-h-[300px] overflow-y-auto">
        {loading ? (
          <div className="p-6 text-center">
            <Loader2 size={20} className="animate-spin text-emerald-500 mx-auto" />
          </div>
        ) : filteredSources.length === 0 ? (
          <div className="p-6 text-center">
            <BookOpen size={24} className="text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-xs text-slate-400 dark:text-slate-500">
              {sources.length === 0 ? 'No hay fuentes clínicas cargadas' : 'No se encontraron resultados'}
            </p>
            {sources.length === 0 && (
              <button onClick={() => setShowAddForm(true)}
                className="mt-2 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline">
                + Agregar primera fuente
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {filteredSources.map(source => (
              <div key={source.id} className="p-3 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors group">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <FileText size={12} className="text-emerald-500 shrink-0" />
                      <p className="text-xs font-bold text-slate-800 dark:text-white truncate">{source.title}</p>
                    </div>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 line-clamp-2">{source.content.substring(0, 120)}...</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded-full">
                        {SOURCE_CATEGORIES.find(c => c.value === source.category)?.label || source.category}
                      </span>
                      <span className="text-[9px] text-slate-400 dark:text-slate-500">
                        {new Date(source.created_at).toLocaleDateString('es-AR')}
                      </span>
                    </div>
                  </div>
                  <button onClick={() => handleDeleteSource(source.id)}
                    className="p-1 text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all shrink-0">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

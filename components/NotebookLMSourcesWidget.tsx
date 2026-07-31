import React, { useState, useEffect } from 'react';
import { BookOpen, Search, Loader2, AlertTriangle, Plus, FileText, RefreshCw } from 'lucide-react';
import { supabase } from '../utils/supabaseClient';

interface ClinicalSource {
  id: string;
  title: string;
  category: string;
  source_url?: string;
  validated_by?: string;
  created_at: string;
}

interface NotebookLMSourcesWidgetProps {
  onAddTextToCanvas?: (text: string) => void;
}

export default function NotebookLMSourcesWidget({ onAddTextToCanvas }: NotebookLMSourcesWidgetProps) {
  const [sources, setSources] = useState<ClinicalSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    loadSources();
  }, []);

  async function loadSources() {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from('clinical_sources')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      setSources(data || []);
    } catch (e: any) {
      console.error('[NotebookLM] Error loading sources:', e);
      const isMissingTable = e?.code === '42P01' || e?.message?.includes('does not exist') || e?.status === 404;
      setError(isMissingTable
        ? 'Tabla clinical_sources no existe — ejecuta la migración SQL en Supabase Dashboard'
        : 'Error cargando fuentes clínicas');
    } finally {
      setLoading(false);
    }
  }

  const filteredSources = sources.filter(s =>
    !searchQuery ||
    s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getCategoryColor = (cat: string) => {
    const colors: Record<string, string> = {
      protocol: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
      article: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
      guide: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
      manual: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
      other: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
    };
    return colors[cat] || colors.other;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 size={16} className="animate-spin text-slate-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-2">
        <p className="text-[10px] text-amber-700 dark:text-amber-300 flex items-center gap-1">
          <AlertTriangle size={10} /> {error}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar en fuentes..."
          className="flex-1 px-2 py-1 text-[10px] border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-white"
        />
        <button onClick={loadSources}
          className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-[10px] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700">
          <RefreshCw size={10} />
        </button>
      </div>

      {filteredSources.length === 0 ? (
        <p className="text-[10px] text-slate-400 text-center py-2">
          {sources.length === 0 ? 'No hay fuentes clínicas cargadas' : 'Sin resultados'}
        </p>
      ) : (
        <div className="space-y-1">
          {filteredSources.map(source => (
            <div key={source.id}
              className="bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
              <button
                onClick={() => setExpandedId(expandedId === source.id ? null : source.id)}
                className="w-full p-2 text-left flex items-start gap-2 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                <FileText size={12} className="text-slate-400 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-slate-700 dark:text-slate-200 truncate">{source.title}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className={`text-[8px] px-1 py-0.5 rounded ${getCategoryColor(source.category)}`}>
                      {source.category}
                    </span>
                  </div>
                </div>
              </button>

              {expandedId === source.id && (
                <div className="px-2 pb-2 border-t border-slate-200 dark:border-slate-700">
                  <p className="text-[9px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-4">
                    {source.validated_by ? `Validado por: ${source.validated_by}` : source.category}
                  </p>
                  <div className="flex gap-1 mt-2">
                    <button
                      onClick={() => onAddTextToCanvas?.(`[${source.title}] — ${source.category}`)}
                      className="flex-1 px-2 py-1 bg-emerald-600 text-white rounded text-[9px] font-bold hover:bg-emerald-700 flex items-center justify-center gap-1">
                      <Plus size={8} /> Agregar al canvas
                    </button>
                    <button
                      onClick={() => onAddTextToCanvas?.(`Fuente: ${source.title}\nCategoría: ${source.category}`)}
                      className="px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded text-[9px] hover:bg-slate-200 dark:hover:bg-slate-600">
                      Solo título
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

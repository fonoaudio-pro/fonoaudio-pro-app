import React, { useEffect, useState } from 'react';
import { nbaService } from '../src/services/NBAService';
import { CheckCircle2, XCircle, Edit3, Clock, Info, ArrowRight, FileText, User, Calendar } from 'lucide-react';

interface AuditEntry {
  id: number;
  created_at: string;
  action_id: string;
  original_action_id: string | null;
  action_type: string;
  category: string | null;
  rationale: string | null;
  triggering_facts: any[];
  knowledge_artifacts_used: string[];
  confidence_or_strength: number;
  clinician_disposition: string;
  disposition_reason: string | null;
  metadata: any;
  nba_suggestions: {
    title: string;
    description: string;
    rationale: string;
    triggering_facts: any[];
    knowledge_artifacts_used: string[];
  } | null;
}

const AuditLogView: React.FC<{ patientId: string }> = ({ patientId }) => {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [selectedLog, setSelectedLog] = useState<AuditEntry | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, [patientId]);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const data = await nbaService.getAuditLogs(patientId);
      setLogs(data);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getDispositionIcon = (disposition: string) => {
    switch (disposition) {
      case 'accepted': return <CheckCircle2 className="text-emerald-500" size={20} />;
      case 'rejected': return <XCircle className="text-rose-500" size={20} />;
      case 'edited': return <Edit3 className="text-amber-500" size={20} />;
      default: return <Clock className="text-slate-400" size={20} />;
    }
  };

  if (isLoading) return <div className="p-8 text-center">Cargando historial de auditoría...</div>;

  return (
    <div className="flex h-[calc(100vh-200px)] bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden">
      {/* List view */}
      <div className={`w-1/3 border-r border-slate-200 bg-white overflow-y-auto ${selectedLog ? 'hidden md:block' : 'block'}`}>
        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
          <h3 className="font-bold text-slate-900">Historial de Decisiones</h3>
        </div>
        {logs.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">No hay decisiones registradas.</div>
        ) : (
          logs.map(log => (
            <button
              key={log.id}
              onClick={() => setSelectedLog(log)}
              className={`w-full text-left p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors ${selectedLog?.id === log.id ? 'bg-indigo-50 border-l-4 border-l-indigo-500' : ''}`}
            >
              <div className="flex items-center gap-3 mb-1">
                {getDispositionIcon(log.clinician_disposition)}
                <span className="text-sm font-bold text-slate-900 truncate">{log.action_type.toUpperCase()}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Calendar size={12} />
                {new Date(log.created_at).toLocaleString()}
              </div>
            </button>
          ))
        )}
      </div>

      {/* Detail view */}
      <div className={`flex-1 overflow-y-auto bg-white ${!selectedLog ? 'hidden md:flex items-center justify-center text-slate-400' : 'block'}`}>
        {selectedLog ? (
          <div className="p-8 max-w-3xl mx-auto w-full space-y-8">
            <div className="flex items-start justify-between border-b border-slate-100 pb-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Reconstrucción de Decisión</h2>
                <p className="text-sm text-slate-500 mt-1">ID de Auditoría: #{selectedLog.id}</p>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                  {getDispositionIcon(selectedLog.clinician_disposition)}
                  {selectedLog.clinician_disposition.toUpperCase()}
                </div>
                <p className="text-xs text-slate::500 mt-1">{new Date(selectedLog.created_at).toLocaleString()}</p>
              </div>
            </div>

            {/* 1. Context & Triggering Facts */}
            <section className="space-y-3">
              <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm uppercase tracking-wider">
                <Info size={16} />
                Contexto y Disparadores
              </div>
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <p className="text-sm text-slate-600 leading-relaxed">
                  La decisión fue motivada por los siguientes hallazmos clínicos:
                </p>
                {selectedLog.triggering_facts?.length > 0 ? (
                  <ul className="mt-2 space-y-2">
                    {selectedLog.triggering_facts.map((fact: any, i: number) => (
                      <li key={i} className="text-sm text-slate-800 flex items-start gap-2">
                        <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
                        {typeof fact === 'string' ? fact : JSON.stringify(fact)}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-400 italic mt-2">Sin hechos específicos registrados.</p>
                )}
              </div>
            </section>

            {/* 2. Reasoning & Artifacts */}
            <section className="space-y-3">
              <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm uppercase tracking-wider">
                <FileText size={16} />
                Razonamiento y Conocimiento
              </div>
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase mb-1">Artefactos de Conocimiento</p>
                    <div className="flex flex-wrap gap-2">
                      {selectedLog.knowledge_artifacts_used?.length > 0 ? (
                        selectedLog.knowledge_artifacts_used.map(artId => (
                          <span key={artId} className="px-2 py-1 bg-white border border-slate-200 rounded text-xs text-slate-600">
                            {artId}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-400 italic">Sin artefactos vinculados.</span>
                      )}
                    </div>
                  </div>
                  {selectedLog.rationale && (
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase mb-1">Justificación del Sistema</p>
                      <p className="text-sm text-slate-700 italic leading-relaxed">"{selectedLog.rationale}"</p>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* 3. Suggestion vs Decision */}
            <section className="space-y-3">
              <div className="flex items-center gap-2 text-indigo-600 font-bold text-sm uppercase tracking-wider">
                <ArrowRight size={16} />
                Sugerencia vs Decisión
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Original Suggestion */}
                <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-400 uppercase">Sugerencia Original (IA)</p>
                  <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                    {selectedLog.nba_suggestions ? (
                      <>
                        <h4 className="font-bold text-slate-900 text-sm mb-1">{selectedLog.nba_suggestions.title}</h4>
                        <p className="text-xs text-slate-600 leading-relaxed">{selectedLog.nba_suggestions.description}</p>
                        <div className="mt-3 pt-3 border-t border-slate-100">
                          <p className="text-[10px] font-bold text-slate-400 uppercase">Rationale IA</p>
                          <p className="text-xs text-slate-500 italic">{selectedLog.nba_suggestions.rationale}</p>
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-slate-400 italic">Sin registro de la sugerencia original.</p>
                    )}
                  </div>
                </div>

                {/* Decision Result */}
                <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-400 uppercase">Decisión Final (Humano)</p>
                  <div className={`rounded-xl p-4 border ${
                    selectedLog.clinician_disposition === 'accepted' ? 'bg-emerald-50 border-emerald-100' :
                    selectedLog.clinician_disposition === 'rejected' ? 'bg-rose-50 border-rose-100' :
                    'bg-amber-50 border-amber-100'
                  }`}>
                    <h4 className="font-bold text-slate-900 text-sm mb-1">{selectedLog.action_type.toUpperCase()}</h4>
                    {selectedLog.disposition_reason && (
                      <p className="text-xs text-slate-600 leading-relaxed mb-2">{selectedLog.disposition_reason}</p>
                    )}
                    <div className="mt-3 pt-3 border-t border-slate-200/50">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Rationale Clínico</p>
                      <p className="text-xs text-slate-700 italic">{selectedLog.rationale || 'Sin justificación adicional.'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* 4. Metadata */}
            <section className="pt-4 border-t border-slate-100">
              <div className="flex items-center gap-4 text-xs text-slate-400">
                <div className="flex items-center gap-1">
                  <User size={14} />
                  <span>ID: {selectedLog.id}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Calendar size={14} />
                  <span>{new Date(selectedLog.created_at).toLocaleString()}</span>
                </div>
              </div>
            </section>
          </div>
        ) : (
          <div className="flex items-center justify-center text-slate-400 h-full">
            <p>Seleccione una entrada para ver los detalles.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditLogView;

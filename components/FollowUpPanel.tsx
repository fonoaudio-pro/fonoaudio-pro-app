import React, { useState, useEffect, useMemo } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Filter,
  MoreVertical,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  EyeOff,
  Check,
  Calendar,
  Info,
  AlertTriangle,
  ShieldCheck
} from 'lucide-react';
import { clinicalContextManager } from '../services/ClinicalContextManager';
import followUpService from '../services/followUpService';
import { useClinicalAlerts } from '../context/ClinicalAlertBus';
import { useToast } from '../context/ToastContext';
import type { FollowUpAlert, FollowUpSeverity, FollowUpType, FollowUpDecisionStatus } from '../types';

interface FollowUpPanelProps {
  patientId: string;
}

const FollowUpPanel: React.FC<FollowUpPanelProps> = ({ patientId }) => {
  const { addToast } = useToast();
  const { getAlerts, dismissAlert, snoozeAlert, applyAlert, ignoreAlert } = useClinicalAlerts();
  const [activeAlerts, setActiveAlerts] = useState<FollowUpAlert[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [filterSeverity, setFilterSeverity] = useState<FollowUpSeverity | 'all'>('all');
  const [filterType, setFilterType] = useState<FollowUpType | 'all'>('all');
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeActionMenu, setActiveActionMenu] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

   // Bus as primary source for follow_up alerts
   const busFollowUpAlerts = getAlerts({ categories: ['follow_up', 'clinical_trend'], patientId });

   useEffect(() => {
     const unsubscribe = clinicalContextManager.subscribe((context) => {
       setActiveAlerts(context.followUpHealth?.alerts || []);
       setIsLoaded(true);
     });

     return () => unsubscribe();
   }, []);

  // Trigger health update when patient changes
  useEffect(() => {
    const patient = clinicalContextManager.getSnapshot().activePatientId;
    if (patient === patientId) {
      clinicalContextManager.setPatient(patientId);
    }
  }, [patientId]);

  // Use bus data when available, fall back to contextManager
  const sourceAlerts = busFollowUpAlerts.length > 0
    ? busFollowUpAlerts.map(a => ({
        type: a.category === 'clinical_trend' ? 'CLINICAL_TREND' : 'FOLLOW_UP_NEEDED',
        severity: a.severity,
        reason: a.description,
        suggestedAction: a.suggestedAction || '',
        reasonHash: a.id,
      })) as FollowUpAlert[]
    : activeAlerts;

  const filteredAlerts = useMemo(() => {
    return sourceAlerts.filter(a => {
      const severityMatch = filterSeverity === 'all' || a.severity === filterSeverity;
      const typeMatch = filterType === 'all' || a.type === filterType;
      return severityMatch && typeMatch;
    });
  }, [sourceAlerts, filterSeverity, filterType]);

  const handleDecision = async (followUpAlert: FollowUpAlert, status: FollowUpDecisionStatus) => {
    setIsProcessing(followUpAlert.reasonHash);
    try {
      // Update bus if alert came from bus
      const busAlert = (Array.isArray(busFollowUpAlerts) ? busFollowUpAlerts : []).find(a => a.id === followUpAlert.reasonHash);
      if (busAlert) {
        if (status === 'resolved') applyAlert(busAlert.id);
        else if (status === 'snoozed') snoozeAlert(busAlert.id, 24);
        else if (status === 'ignored') ignoreAlert(busAlert.id);
      }

      await followUpService.recordDecision(patientId, {
        reasonHash: followUpAlert.reasonHash,
        status,
        notes: status === 'snoozed' ? 'Pospuesto por el clínico' : '',
        createdAt: new Date().toISOString(),
      });

      // Refresh context
      await clinicalContextManager.setPatient(patientId);
      setActiveActionMenu(null);
    } catch (error) {
      console.error('Error recording decision:', error);
      addToast({ message: 'Error al registrar la decisión.', type: 'error' });
    } finally {
      setIsProcessing(null);
    }
};


  const getSeverityColor = (severity: FollowUpSeverity) => {
    switch (severity) {
      case 'high': return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800/50';
      case 'medium': return 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800/50';
      case 'low': return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800/50';
    }
  };

  const getTypeIcon = (type: FollowUpType) => {
    switch (type) {
      case 'REPEATED_FAILURE': return <AlertTriangle size={16} className="text-red-500" />;
      case 'MISSING_DELIVERY': return <Clock size={16} className="text-amber-500" />;
      case 'FOLLOW_UP_NEEDED': return <Info size={16} className="text-blue-500" />;
      case 'CLINICAL_TREND': return <AlertCircle size={16} className="text-purple-500" />;
      case 'PROACTIVE_SUGGESTION': return <CheckCircle2 size={16} className="text-green-500" />;
      default: return <Info size={16} className="text-slate-400" />;
    }
  };

  if (!isLoaded) return null;

  return (
    <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col">
      {/* Header */}
      <div 
        className="p-4 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400">
            <ShieldCheck size={18} />
          </div>
          <h3 className="font-bold text-slate-800 dark:text-white">Gestión de Seguimiento</h3>
          {activeAlerts.length > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full">
              {activeAlerts.length}
            </span>
          )}
        </div>
        {isExpanded ? <ChevronUp size={18} className="text-slate-400 dark:text-slate-500" /> : <ChevronDown size={18} className="text-slate-400 dark:text-slate-500" />}
      </div>

      {isExpanded && (
        <div className="flex flex-col h-full min-h-[300px]">
          {/* Filters */}
          <div className="p-3 border-b border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-900 flex flex-wrap gap-2">
            <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
              <Filter size={12} />
              <span>Filtrar:</span>
            </div>
            <select 
              className="text-xs border-slate-200 dark:border-slate-600 rounded-md bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 focus:ring-blue-500"
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value as any)}
            >
              <option value="all">Todas las severidades</option>
              <option value="high">Alta</option>
              <option value="medium">Media</option>
              <option value="low">Baja</option>
            </select>
            <select 
              className="text-xs border-slate-200 dark:border-slate-600 rounded-md bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 focus:ring-blue-500"
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as any)}
            >
              <option value="all">Todos los tipos</option>
              <option value="REPEATED_FAILURE">Fallos repetidos</option>
              <option value="MISSING_DELIVERY">Falta de entrega</option>
              <option value="FOLLOW_UP_NEEDED">Seguimiento</option>
            </select>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 max-h-[500px]">
            {filteredAlerts.length === 0 ? (
              <div className="py-12 text-center">
                <div className="inline-flex p-3 bg-slate-50 dark:bg-slate-800 rounded-full text-slate-300 dark:text-slate-600 mb-3">
                  <CheckCircle2 size={32} />
                </div>
                <p className="text-sm text-slate-400 dark:text-slate-500 italic">No hay alertas activas.</p>
              </div>
            ) : (
              filteredAlerts.map((currentAlert) => (
                <div 
                  key={currentAlert.reasonHash} 
                  className="group relative bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 shadow-sm hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={`mt-1 p-2 rounded-lg border ${getSeverityColor(currentAlert.severity)}`}>
                        {getTypeIcon(currentAlert.type)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">{currentAlert.type.replace('_', ' ')}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${getSeverityColor(currentAlert.severity)}`}>
                            {currentAlert.severity.toUpperCase()}
                          </span>
                          {currentAlert.detectedAt && (
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 ml-auto">
                              {new Date(currentAlert.detectedAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-semibold text-slate-800 dark:text-white truncate leading-tight">
                          {currentAlert.reason}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                          {currentAlert.suggestedAction}
                        </p>
                      </div>
                    </div>

                    <div className="relative">
                      <button 
                        onClick={() => setActiveActionMenu(activeActionMenu === currentAlert.reasonHash ? null : currentAlert.reasonHash)}
                        className="p-1 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md transition-colors"
                      >
                        <MoreVertical size={18} />
                      </button>

                      {activeActionMenu === currentAlert.reasonHash && (
                        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden animate-in fade-in zoom-in duration-150">
                          <div className="py-1">
                            <button 
                              onClick={() => handleDecision(currentAlert, 'resolved')}
                              disabled={isProcessing === currentAlert.reasonHash}
                              className="w-full text-left px-4 py-2 text-xs text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 flex items-center gap-2"
                            >
                              {isProcessing === currentAlert.reasonHash ? <Clock size={14} className="animate-spin" /> : <Check size={14} />}
                              Marcar como Resuelta
                            </button>
                            <button 
                              onClick={() => handleDecision(currentAlert, 'snoozed')}
                              disabled={isProcessing === currentAlert.reasonHash}
                              className="w-full text-left px-4 py-2 text-xs text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 flex items-center gap-2"
                            >
                              {isProcessing === currentAlert.reasonHash ? <Clock size={14} className="animate-spin" /> : <Clock size={14} />}
                              Posponer (24h)
                            </button>
                            <button 
                              onClick={() => handleDecision(currentAlert, 'ignored')}
                              disabled={isProcessing === currentAlert.reasonHash}
                              className="w-full text-left px-4 py-2 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
                            >
                              {isProcessing === currentAlert.reasonHash ? <Clock size={14} className="animate-spin" /> : <EyeOff size={14} />}
                              Ignorar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer Info */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700 flex items-center justify-center gap-2 text-[10px] text-slate-400 dark:text-slate-500">
            <Info size={12} />
            <span>Las decisiones afectan la frecuencia de las sugerencias del Copilot.</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default FollowUpPanel;

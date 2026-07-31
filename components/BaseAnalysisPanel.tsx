import React from 'react';
import { AlertTriangle, CheckCircle2, Info, Activity, ArrowRightCircle, ShieldAlert, Check } from 'lucide-react';

export interface AnalysisResult {
    riskLevel: string;
    recommendedActionLevel: string;
    redFlags: {
        description: string;
        action: string;
        sourceRefs: string[];
        relatedFacts: string[];
        severity: string;
    }[];
    observations: {
        description: string;
        action: string;
        sourceRefs: string[];
        severity: string;
    }[];
    summary: {
        family: string;
    };
}

interface BaseAnalysisPanelProps {
    title: string;
    analysis: AnalysisResult | null;
    isLoading: boolean;
    onResolve: (factIds: string[]) => void;
    riskColors: Record<string, string>;
}

const BaseAnalysisPanel: React.FC<BaseAnalysisPanelProps> = ({ 
    title, 
    analysis, 
    isLoading, 
    onResolve, 
    riskColors 
}) => {
    if (isLoading) {
        return (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 flex items-center justify-center h-40">
                <div className="animate-pulse text-slate-400 text-sm flex items-center gap-2">
                    <Activity size={16} className="animate-spin" /> Analizando...
                </div>
            </div>
        );
    }

    if (!analysis || (analysis.redFlags.length === 0 && analysis.observations.length === 0)) {
        return (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 flex flex-col items-center justify-center h-40 text-center">
                <Info size={24} className="text-slate-300 mb-2" />
                <p className="text-sm text-slate-500 italic">No se han detectado signos relevantes en el historial.</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <Activity size={18} className="text-blue-600" />
                    {title}
                </h3>
                <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase border ${riskColors[analysis.riskLevel] || riskColors['low']}`}>
                    Riesgo: {analysis.riskLevel}
                </div>
            </div>

            <div className="p-5 space-y-6">
                <div className={`p-3 rounded-xl border flex items-center gap-3 ${riskColors[analysis.riskLevel] || riskColors['low']}`}>
                    {analysis.recommendedActionLevel === 'emergency' ? <ShieldAlert size={20} /> : <ArrowRightCircle size={20} />}
                    <div className="flex-1">
                        <p className="text-[10px] font-black uppercase opacity-70">Nivel de Acción Recomendado</p>
                        <p className="text-sm font-bold capitalize">{analysis.recommendedActionLevel}</p>
                    </div>
                    <div className="text-right text-[10px] font-medium italic opacity-80">
                        Basado en baseline V1
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                        <h4 className="text-xs font-black text-red-600 uppercase flex items-center gap-2">
                            <AlertTriangle size={14} /> Alertas Críticas (Red Flags)
                        </h4>
                        {analysis.redFlags.length > 0 ? (
                            analysis.redFlags.map((rf, i) => (
                                <div key={i} className="p-3 bg-red-50 border border-red-100 rounded-xl space-y-2 group">
                                    <div className="flex justify-between items-start">
                                        <p className="text-xs font-bold text-red-800">{rf.description}</p>
                                        <button 
                                            onClick={() => onResolve(rf.relatedFacts)} 
                                            className="p-1 opacity-0 group-hover:opacity-100 bg-white border border-red-200 text-red-600 rounded-md hover:bg-red-100 transition-all" 
                                            title="Marcar como resuelta"
                                        >
                                            <Check size={12} />
                                        </button>
                                    </div>
                                    <p className="text-[11px] text-red-700 italic">{rf.action}</p>
                                    <div className="text-[9px] text-red-400 font-medium">Ref: {rf.sourceRefs[0]}</div>
                                </div>
                            ))
                        ) : (
                            <p className="text-xs text-slate-400 italic">Sin alertas críticas activas.</p>
                        )}
                    </div>

                    <div className="space-y-3">
                        <h4 className="text-xs font-black text-blue-600 uppercase flex items-center gap-2">
                            <Info size={14} /> Observaciones Clínicas
                        </h4>
                        {analysis.observations.length > 0 ? (
                            analysis.observations.map((ob, i) => (
                                <div key={i} className="p-3 bg-blue-50 border border-blue-100 rounded-xl space-y-2">
                                    <p className="text-xs font-bold text-blue-800">{ob.description}</p>
                                    <p className="text-[11px] text-blue-700 italic">{ob.action}</p>
                                    <div className="text-[9px] text-blue-400 font-medium">Ref: {ob.sourceRefs[0]}</div>
                                </div>
                            ))
                        ) : (
                            <p className="text-xs text-slate-400 italic">Sin observaciones específicas.</p>
                        )}
                    </div>
                </div>

                <div className="pt-4 border-t border-slate-100">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <div className="flex items-center gap-2 mb-2">
                            <CheckCircle2 size={14} className="text-emerald-600" />
                            <span className="text-[10px] font-black text-slate-500 uppercase">Sugerencia para la Familia</span>
                        </div>
                        <p className="text-sm text-slate-700 italic leading-relaxed">
                            "{analysis.summary.family}"
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BaseAnalysisPanel;

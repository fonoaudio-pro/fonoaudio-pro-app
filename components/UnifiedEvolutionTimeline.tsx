import React, { useState, useEffect } from 'react';
import { TrendingUp, Calendar, AlertCircle, CheckCircle2, Layers } from 'lucide-react';
import { supabase } from '../utils/supabaseClient';

interface UnifiedEvolutionTimelineProps {
    patientId: string;
}

interface Snapshot {
    id: string;
    patient_id: string;
    module: string;
    risk_level: string;
    action_level: string;
    summary_family: string;
    timestamp: string;
}

const RISK_ORDER: Record<string, number> = { low: 0, medium: 1, high: 2, critical: 3 };
const RISK_COLORS: Record<string, string> = {
    low: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    medium: 'text-amber-600 bg-amber-50 border-amber-200',
    high: 'text-orange-600 bg-orange-50 border-orange-200',
    critical: 'text-red-600 bg-red-50 border-red-200',
};
const MODULE_LABELS: Record<string, string> = {
    voice: 'Voz',
    language: 'Lenguaje',
    swallowing: 'Deglución',
    motricity: 'Motricidad',
    audiology: 'Audiología',
    cognition: 'Cognición',
};

const UnifiedEvolutionTimeline: React.FC<UnifiedEvolutionTimelineProps> = ({ patientId }) => {
    const [history, setHistory] = useState<Snapshot[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchHistory();
    }, [patientId]);

    const fetchHistory = async () => {
        setIsLoading(true);
        try {
            const { data } = await supabase
                .from('analysis_history')
                .select('*')
                .eq('patient_id', patientId)
                .order('timestamp', { ascending: true });

            if (data) setHistory(data);
        } catch (error) {
            console.error('Error fetching unified analysis history:', error);
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) return <div className="p-4 text-center text-slate-400 text-xs animate-pulse">Cargando evolución...</div>;
    if (history.length === 0) return null;

    const latestRisk = history[history.length - 1]?.risk_level;
    const firstRisk = history[0]?.risk_level;
    const improving = RISK_ORDER[latestRisk] < RISK_ORDER[firstRisk];

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <TrendingUp size={18} className="text-blue-600" />
                    Evolución Temporal
                </h3>
                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                    {history.length} registros · {new Set(history.map(h => h.module)).size} módulos
                </span>
            </div>

            <div className="p-4">
                <div className="relative flex overflow-x-auto pb-4 gap-3 snap-x">
                    <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-100 -translate-y-1/2 z-0" />
                    
                    {history.map((snapshot) => {
                        const riskColor = RISK_COLORS[snapshot.risk_level] || RISK_COLORS.low;
                        const moduleLabel = MODULE_LABELS[snapshot.module] || snapshot.module;
                        
                        return (
                            <div key={snapshot.id} className="relative z-10 flex flex-col items-center min-w-[120px] snap-center">
                                <div className={`w-3 h-3 rounded-full border-2 border-white shadow-sm ${riskColor.split(' ')[0].replace('text', 'bg')} mb-2`} />
                                
                                <div className={`p-2.5 rounded-xl border text-center w-full shadow-sm ${riskColor}`}>
                                    <div className="flex items-center justify-center gap-1 mb-1">
                                        <Calendar size={9} />
                                        <span className="text-[8px] font-bold opacity-70">
                                            {new Date(snapshot.timestamp).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <p className="text-[10px] font-black uppercase leading-tight">
                                        {snapshot.risk_level}
                                    </p>
                                    <p className="text-[8px] font-medium opacity-60 mt-0.5">
                                        {moduleLabel}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {history.length > 1 && (
                    <div className="mt-2 p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-start gap-3">
                        {improving ? (
                            <CheckCircle2 size={14} className="text-emerald-500 mt-0.5 shrink-0" />
                        ) : (
                            <AlertCircle size={14} className="text-amber-500 mt-0.5 shrink-0" />
                        )}
                        <div>
                            <p className="text-[11px] font-bold text-slate-700">Tendencia</p>
                            <p className="text-[10px] text-slate-500 italic">
                                {improving 
                                    ? 'Se observa una reducción en el nivel de riesgo clínico.' 
                                    : 'El riesgo se mantiene estable o ha aumentado.'}
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UnifiedEvolutionTimeline;

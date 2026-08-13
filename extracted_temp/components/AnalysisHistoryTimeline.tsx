import React, { useState, useEffect } from 'react';
import { TrendingUp, Calendar, AlertCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '../utils/supabaseClient';

export interface AnalysisSnapshot {
    id: string;
    patient_id: string;
    module: 'voice' | 'language' | 'swallowing' | 'audiology' | 'cognition' | 'motricity';
    risk_level: string;
    action_level: string;
    summary_family: string;
    timestamp: string;
}

interface AnalysisHistoryTimelineProps {
    patientId: string;
    module: 'voice' | 'language' | 'swallowing' | 'audiology' | 'cognition' | 'motricity';
}

const RISK_ORDER = { low: 0, medium: 1, high: 2, critical: 3 };
const RISK_COLORS = {
    low: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    medium: 'text-amber-600 bg-amber-50 border-amber-200',
    high: 'text-orange-600 bg-orange-50 border-orange-200',
    critical: 'text-red-600 bg-red-50 border-red-200',
};

const AnalysisHistoryTimeline: React.FC<AnalysisHistoryTimelineProps> = ({ patientId, module }) => {
    const [history, setHistory] = useState<AnalysisSnapshot[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        fetchHistory();
    }, [patientId, module]);

    const fetchHistory = async () => {
        setIsLoading(true);
        try {
            const { data } = await supabase
                .from('analysis_history')
                .select('*')
                .eq('patient_id', patientId)
                .eq('module', module)
                .order('timestamp', { ascending: true });

            if (data) setHistory(data);
        } catch (error) {
            console.error('Error fetching analysis history:', error);
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) return <div className="p-4 text-center text-slate-400 text-xs animate-pulse">Cargando trayectoria...</div>;
    if (history.length === 0) return <div className="p-4 text-center text-slate-400 text-xs italic">No hay historial de análisis disponible.</div>;

    return (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                    <TrendingUp size={18} className="text-blue-600" />
                    Evolución Temporal
                </h3>
                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">
                    Trayectoria Clínica
                </span>
            </div>

            <div className="relative flex overflow-x-auto pb-4 gap-4 snap-x">
                {/* Timeline Axis Line */}
                <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-100 -translate-y-1/2 z-0" />
                
                {history.map((snapshot, i) => {
                    const isLast = i === history.length - 1;
                    const riskColor = RISK_COLORS[snapshot.risk_level as keyof typeof RISK_COLORS] || RISK_COLORS.low;
                    
                    return (
                        <div key={snapshot.id} className="relative z-10 flex flex-col items-center min-w-[140px] snap-center">
                            <div className={`w-4 h-4 rounded-full border-2 border-white shadow-sm ${riskColor.split(' ')[0].replace('text', 'bg')} mb-2`} />
                            
                            <div className={`p-3 rounded-xl border text-center w-full shadow-sm ${riskColor}`}>
                                <div className="flex items-center justify-center gap-1 mb-1">
                                    <Calendar size={10} />
                                    <span className="text-[9px] font-bold opacity-70">
                                        {new Date(snapshot.timestamp).toLocaleDateString()}
                                    </span>
                                </div>
                                <p className="text-[11px] font-black uppercase leading-tight">
                                    {snapshot.risk_level}
                                </p>
                                <p className="text-[9px] italic opacity-80 truncate">
                                    {snapshot.action_level}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>

            {history.length > 1 && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-start gap-3">
                    {RISK_ORDER[history[history.length-1].risk_level as keyof typeof RISK_ORDER] < RISK_ORDER[history[0].risk_level as keyof typeof RISK_ORDER] ? (
                        <CheckCircle2 size={16} className="text-emerald-500 mt-0.5" />
                    ) : (
                        <AlertCircle size={16} className="text-amber-500 mt-0.5" />
                    )}
                    <div>
                        <p className="text-xs font-bold text-slate-700">Tendencia de Riesgo</p>
                        <p className="text-[11px] text-slate-500 italic">
                            {RISK_ORDER[history[history.length-1].risk_level as keyof typeof RISK_ORDER] < RISK_ORDER[history[0].risk_level as keyof typeof RISK_ORDER] 
                                ? 'Se observa una reducción en el nivel de riesgo clínico.' 
                                : 'El riesgo se mantiene estable o ha aumentado.'}
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AnalysisHistoryTimeline;

import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import { CognitionService, CognitionAnalysisResult } from '../src/modules/cognition/service';
import { useToast } from '../context/ToastContext';
import BaseAnalysisPanel from './BaseAnalysisPanel';
import AnalysisHistoryTimeline from './AnalysisHistoryTimeline';

interface CognitionAnalysisPanelProps {
    patientId: string;
}

const RISK_COLORS: Record<string, string> = {
    low: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    medium: 'bg-amber-100 text-amber-700 border-amber-200',
    high: 'bg-orange-100 text-orange-700 border-orange-200',
    critical: 'bg-red-100 text-red-700 border-red-200',
};

const CognitionAnalysisPanel: React.FC<CognitionAnalysisPanelProps> = ({ patientId }) => {
    const [analysis, setAnalysis] = useState<CognitionAnalysisResult | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const { addToast } = useToast();
    const cognitionService = new CognitionService();

    useEffect(() => {
        fetchAnalysis();
    }, [patientId]);

    const fetchAnalysis = async () => {
        setIsLoading(true);
        try {
            const { data: facts } = await supabase
                .from('clinical_facts')
                .select('*')
                .eq('patient_id', patientId)
                .eq('category', 'cognition');

            if (facts) {
                const result = await cognitionService.analyze(facts, patientId);
                setAnalysis(result);
            }
        } catch (error) {
            console.error('Error analyzing cognition:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleResolve = async (factIds: string[]) => {
        try {
            await Promise.all(factIds.map(id => cognitionService.resolveFact(id, 'current-user-id')));
            addToast({ message: 'Alerta marcada como resuelta', type: 'success' });
            fetchAnalysis();
        } catch (error) {
            addToast({ message: 'Error al resolver alerta', type: 'error' });
        }
    };

    return (
        <div className="space-y-4">
            <BaseAnalysisPanel 
                title="Análisis de Comunicación Cognitivo-Lingüística"
                analysis={analysis}
                isLoading={isLoading}
                onResolve={handleResolve}
                riskColors={RISK_COLORS}
            />
            <AnalysisHistoryTimeline patientId={patientId} module="cognition" />
        </div>
    );
};

export default CognitionAnalysisPanel;

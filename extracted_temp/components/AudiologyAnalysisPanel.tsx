import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import { AudiologyService, AudiologyAnalysisResult } from '../src/modules/audiology/service';
import { useToast } from '../context/ToastContext';
import BaseAnalysisPanel from './BaseAnalysisPanel';
import AnalysisHistoryTimeline from './AnalysisHistoryTimeline';

interface AudiologyAnalysisPanelProps {
    patientId: string;
}

const RISK_COLORS: Record<string, string> = {
    low: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    medium: 'bg-amber-100 text-amber-700 border-amber-200',
    high: 'bg-orange-100 text-orange-700 border-orange-200',
    critical: 'bg-red-100 text-red-700 border-red-200',
};

const AudiologyAnalysisPanel: React.FC<AudiologyAnalysisPanelProps> = ({ patientId }) => {
    const [analysis, setAnalysis] = useState<AudiologyAnalysisResult | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const { addToast } = useToast();
    const audiologyService = new AudiologyService();

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
                .eq('category', 'audiology');

            if (facts) {
                const result = await audiologyService.analyze(facts, patientId);
                setAnalysis(result);
            }
        } catch (error) {
            console.error('Error analyzing audiology:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleResolve = async (factIds: string[]) => {
        try {
            await Promise.all(factIds.map(id => audiologyService.resolveFact(id, 'current-user-id')));
            addToast({ message: 'Alerta marcada como resuelta', type: 'success' });
            fetchAnalysis();
        } catch (error) {
            addToast({ message: 'Error al resolver alerta', type: 'error' });
        }
    };

    return (
        <div className="space-y-4">
            <BaseAnalysisPanel 
                title="Análisis de Función Auditiva"
                analysis={analysis}
                isLoading={isLoading}
                onResolve={handleResolve}
                riskColors={RISK_COLORS}
            />
            <AnalysisHistoryTimeline patientId={patientId} module="audiology" />
        </div>
    );
};

export default AudiologyAnalysisPanel;

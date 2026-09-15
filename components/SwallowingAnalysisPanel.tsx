import React, { useState, useEffect } from 'react';
import { supabase } from '../utils/supabaseClient';
import { SwallowingService, SwallowingAnalysisResult } from '../src/modules/swallowing/service';
import { useToast } from '../context/ToastContext';
import BaseAnalysisPanel from './BaseAnalysisPanel';
import AnalysisHistoryTimeline from './AnalysisHistoryTimeline';
import { nbaService } from '../src/services/NBAService';
import NBASuggestionCard from './NBASuggestionCard';
import SuggestionEditModal from './SuggestionEditModal';
import { NextBestAction } from '../src/intelligence/types';

interface SwallowingAnalysisPanelProps {
    patientId: string;
}

const RISK_COLORS: Record<string, string> = {
    low: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    medium: 'bg-amber-100 text-amber-700 border-amber-200',
    high: 'bg-orange-100 text-orange-700 border-orange-200',
    critical: 'bg-red-100 text-red-700 border-red-200',
};

const SwallowingAnalysisPanel: React.FC<SwallowingAnalysisPanelProps> = ({ patientId }) => {
    const [analysis, setAnalysis] = useState<SwallowingAnalysisResult | null>(null);
    const [suggestions, setSuggestions] = useState<NextBestAction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editingSuggestion, setEditingSuggestion] = useState<NextBestAction | null>(null);
    const { addToast } = useToast();
    const swallowingService = new SwallowingService();

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
                .eq('category', 'swallowing');

            if (facts) {
                const result = await swallowingService.analyze(facts, patientId);
                setAnalysis(result);

                // Get NBA suggestions
                const nbaResults = await nbaService.getSuggestions(
                    { activePatientId: patientId },
                    [{ moduleId: 'swallowing', data: result }]
                );
                
                const swallowingSuggestions = nbaResults.results.find(r => r.moduleId === 'swallowing')?.actions || [];
                setSuggestions(swallowingSuggestions);
            }
        } catch (error) {
            console.error('Error analyzing swallowing:', error);
            addToast({ message: 'Error al analizar deglución', type: 'error' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleResolve = async (factIds: string[]) => {
        try {
            await Promise.all(factIds.map(id => swallowingService.resolveFact(id, 'current-user-id')));
            addToast({ message: 'Alerta marcada como resuelta', type: 'success' });
            fetchAnalysis();
        } catch (error) {
            addToast({ message: 'Error al resolver alerta', type: 'error' });
        }
    };

    const handleNBAAction = async (action: NextBestAction) => {
        try {
            await nbaService.recordDecision(patientId, {
                suggestionId: action.suggestionId,
                actionId: action.id,
                actionType: action.action,
                category: action.category,
                rationale: action.rationale,
                triggeringFacts: action.triggeringFacts,
                knowledgeArtifactsUsed: action.knowledgeArtifactsUsed,
                confidenceOrStrength: action.confidenceOrStrength,
                disposition: 'accepted', // For now, assume accepted
                metadata: { ...action.metadata, moduleId: 'swallowing' }
            });
            addToast({ message: 'Sugerencia aplicada', type: 'success' });
            fetchAnalysis();
        } catch (error) {
            console.error('Error recording NBA decision:', error);
            addToast({ message: 'Error al aplicar sugerencia', type: 'error' });
        }
    };

    const handleNBAReject = async (action: NextBestAction) => {
        try {
            await nbaService.recordDecision(patientId, {
                suggestionId: action.suggestionId,
                actionId: action.id,
                actionType: action.action,
                category: action.category,
                rationale: action.rationale,
                triggeringFacts: action.triggeringFacts,
                knowledgeArtifactsUsed: action.knowledgeArtifactsUsed,
                confidenceOrStrength: action.confidenceOrStrength,
                disposition: 'rejected',
                metadata: { ...action.metadata, moduleId: 'swallowing' }
            });
            addToast({ message: 'Sugerencia rechazada', type: 'info' });
            fetchAnalysis();
        } catch (error) {
            console.error('Error recording NBA decision:', error);
            addToast({ message: 'Error al rechazar sugerencia', type: 'error' });
        }
    };

    const handleEditNBAAction = async (modifiedAction: NextBestAction) => {
        try {
            await nbaService.recordDecision(patientId, {
                suggestionId: modifiedAction.suggestionId,
                originalActionId: modifiedAction.id,
                actionId: `${modifiedAction.id}_edited_${Date.now()}`,
                actionType: modifiedAction.action,
                category: modifiedAction.category,
                rationale: modifiedAction.rationale,
                triggeringFacts: modifiedAction.triggeringFacts,
                knowledgeArtifactsUsed: modifiedAction.knowledgeArtifactsUsed,
                confidenceOrStrength: modifiedAction.confidenceOrStrength,
                disposition: 'edited',
                metadata: { ...modifiedAction.metadata, moduleId: 'swallowing' }
            });
            addToast({ message: 'Sugerencia editada y aplicada', type: 'success' });
            setEditingSuggestion(null);
            fetchAnalysis();
        } catch (error) {
            console.error('Error recording NBA edit:', error);
            addToast({ message: 'Error al editar sugerencia', type: 'error' });
        }
    };

    return (
        <div className="space-y-4">
            {suggestions.length > 0 && (
                <div className="space-y-3">
                    <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">Sugerencias de Inteligencia</h3>
                    {suggestions.map(suggestion => (
                        <NBASuggestionCard 
                            key={suggestion.id}
                            action={suggestion}
                            onAccept={handleNBAAction}
                            onReject={handleNBAReject}
                            onEdit={() => setEditingSuggestion(suggestion)}
                        />
                    ))}
                </div>
            )}

            <BaseAnalysisPanel 
                title="Análisis de Función de Deglución"
                analysis={analysis}
                isLoading={isLoading}
                onResolve={handleResolve}
                riskColors={RISK_COLORS}
            />
            <AnalysisHistoryTimeline patientId={patientId} module="swallowing" />

            {editingSuggestion && (
                <SuggestionEditModal 
                    action={editingSuggestion}
                    onSave={handleEditNBAAction}
                    onCancel={() => setEditingSuggestion(null)}
                />
            )}
        </div>
    );
};

export default SwallowingAnalysisPanel;

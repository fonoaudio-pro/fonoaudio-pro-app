import { useState, useEffect } from 'react';
import { clinicalContextManager } from '../services/ClinicalContextManager';
import { ClinicalContext } from '../types';

export const useClinicalContext = () => {
    const [context, setContext] = useState<ClinicalContext>(clinicalContextManager.getSnapshot());

    useEffect(() => {
        const unsubscribe = clinicalContextManager.subscribe(setContext);
        return unsubscribe;
    }, []);

    return {
        context,
        updateContext: (updates: Partial<ClinicalContext>) => clinicalContextManager.updateContext(updates),
        setPatient: (patientId: string | null, sessionId: string | null = null) => clinicalContextManager.setPatient(patientId, sessionId),
        setGuide: (guideId: string | null) => clinicalContextManager.setGuide(guideId),
        setView: (view: string) => clinicalContextManager.setView(view),
        setTask: (task: any) => clinicalContextManager.setTask(task),
        addRecentMaterial: (materialId: string) => clinicalContextManager.addRecentMaterial(materialId),
        reset: () => clinicalContextManager.reset(),
    };
};

export type ObservationType = 'FACT' | 'RED_FLAG';

export interface ClinicalObservation {
    id: string;
    type: ObservationType;
    sign: string;
    timestamp: string;
    patientId: string;
    sessionId?: string;
    isResolved?: boolean;
    resolvedAt?: string;
    resolvedBy?: string;
}

export interface ClinicalFact extends ClinicalObservation {
    type: 'FACT';
    details?: string;
}

export interface RedFlag extends ClinicalObservation {
    type: 'RED_FLAG';
    immediateActionRequired: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    patientName?: string;
    evidence?: string[];
    confidence?: number;
}

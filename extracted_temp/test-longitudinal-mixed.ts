import { VoiceService, VoiceAnalysisResult } from './src/modules/voice/service';
import { LanguageService, LanguageAnalysisResult } from './src/modules/language/service';
import { ClinicalFact } from './types';

async function testLongitudinalJourney() {
    console.log('Initializing services...');
    const voiceService = new VoiceService();
    const langService = new LanguageService();

    console.log('--- STARTING LONGITUDINAL & MIXED VALIDATION ---\\n');

    const patientId = 'patient-123';
    
    // JOURNEY: Voice - From Critical to Low
    const voiceJourney = [
        {
            step: 'T0: Acute Event',
            facts: [
                { id: 'v1', patientId, category: 'voice', sign: 'estridor', isResolved: false } as ClinicalFact
            ],
            expectedRisk: 'critical',
            expectedAction: 'emergency'
        },
        {
            step: 'T1: Partial Recovery',
            facts: [
                { id: 'v1', patientId, category: 'voice', sign: 'estridor', isResolved: true },
                { id: 'v2', patientId, category: 'voice', sign: 'disfonia_persistente', isResolved: false } as ClinicalFact,
                { id: 'v3', patientId, category: 'voice', sign: 'jitter', details: '1.10', isResolved: false } as ClinicalFact,
                { id: 'v5', patientId, category: 'voice', sign: 'esfuerzo_fonatorio', isResolved: false } as ClinicalFact,
            ],
            expectedRisk: 'high',
            expectedAction: 'urgent'
        },
        {
            step: 'T2: Stable/Functional',
            facts: [
                { id: 'v1', patientId, category: 'voice', sign: 'estridor', isResolved: true },
                { id: 'v2', patientId, category: 'voice', sign: 'disfonia_persistente', isResolved: true },
                { id: 'v3', patientId, category: 'voice', sign: 'jitter', details: '0.80', isResolved: false } as ClinicalFact,
                { id: 'v4', patientId, category: 'voice', sign: 'esfuerzo_fonatorio', isResolved: false } as ClinicalFact,
            ],
            expectedRisk: 'low',
            expectedAction: 'observation'
        }
    ];

    console.log('VOICE JOURNEY:');
    for (const stage of voiceJourney) {
        console.log(`Analyzing ${stage.step}...`);
        const result = await voiceService.analyze(stage.facts);
        const success = result.riskLevel === stage.expectedRisk && result.recommendedActionLevel === stage.expectedAction;
        console.log(`${stage.step}: ${success ? '✅' : '❌'} (Risk: ${result.riskLevel}, Action: ${result.recommendedActionLevel})`);
    }

    // JOURNEY: Language - From Mixed to Low
    const langJourney = [
        {
            step: 'T0: Acute Stroke Pattern',
            facts: [
                { id: 'l1', patientId, category: 'language', sign: 'anomia', isResolved: false } as ClinicalFact,
                { id: 'l2', patientId, category: 'language', sign: 'parafasias', isResolved: false } as ClinicalFact,
                { id: 'l3', patientId, category: 'language', sign: 'agramatismo', isResolved: false } as ClinicalFact,
            ],
            expectedRisk: 'critical',
            expectedAction: 'emergency'
        },
        {
            step: 'T1: Chronic Phase with Low Score',
            facts: [
                { id: 'l1', patientId, category: 'language', sign: 'anomia', isResolved: true },
                { id: 'l2', patientId, category: 'language', sign: 'parafasias', isResolved: true },
                { id: 'l3', patientId, category: 'language', sign: 'agramatismo', isResolved: true },
                { id: 'l4', patientId, category: 'language', sign: 'score_boston_naming', details: '12', isResolved: false } as ClinicalFact,
            ],
            expectedRisk: 'medium',
            expectedAction: 'intervention'
        },
        {
            step: 'T2: Recovery',
            facts: [
                { id: 'l4', patientId, category: 'language', sign: 'score_boston_naming', details: '22', isResolved: false } as ClinicalFact,
                { id: 'l5', patientId, category: 'language', sign: 'errores_sustitucion', isResolved: false } as ClinicalFact,
            ],
            expectedRisk: 'low',
            expectedAction: 'observation'
        }
    ];

    console.log('\nLANGUAGE JOURNEY:');
    for (const stage of langJourney) {
        console.log(`Analyzing ${stage.step}...`);
        const result = await langService.analyze(stage.facts);
        const success = result.riskLevel === stage.expectedRisk && result.recommendedActionLevel === stage.expectedAction;
        console.log(`${stage.step}: ${success ? '✅' : '❌'} (Risk: ${result.riskLevel}, Action: ${result.recommendedActionLevel})`);
    }
    console.log('\n--- VALIDATION COMPLETE ---');
}

testLongitudinalJourney().catch(err => {
    console.error('FATAL ERROR:', err);
});

import { VoiceService } from './src/modules/voice/service';
import { LanguageService } from './src/modules/language/service';
import { ClinicalFact } from './types';

// Mock Supabase to avoid DB dependency during baseline validation
jest.mock('../utils/supabaseClient', () => ({
  supabase: {
    from: () => ({
      select: () => ({ data: [] }),
      insert: () => Promise.resolve({ error: null }),
      update: () => Promise.resolve({ error: null }),
    }),
  },
}));

async function runMixedBaselineTests() {
    const voiceService = new VoiceService();
    const langService = new LanguageService();

    console.log('--- STARTING MIXED BASELINE TESTS (SIGNS + MEASURES) ---\\n');

    const testCases = [
        {
            module: 'Voice',
            name: 'V-Mixed: Organic Risk (Sign + Measure)',
            facts: [
                { id: 'v1', patientId: 'p1', category: 'voice', sign: 'disfonia_persistente', isResolved: false } as ClinicalFact,
                { id: 'v2', patientId: 'p1', category: 'voice', sign: 'jitter', details: '1.10', isResolved: false } as ClinicalFact,
            ],
            expectedAction: 'urgent',
            expectedRisk: 'high'
        },
        {
            module: 'Voice',
            name: 'V-Mixed: Functional (Sign only, Measure Low)',
            facts: [
                { id: 'v3', patientId: 'p1', category: 'voice', sign: 'fatiga_vocal', isResolved: false } as ClinicalFact,
                { id: 'v4', patientId: 'p1', category: 'voice', sign: 'jitter', details: '0.50', isResolved: false } as ClinicalFact,
            ],
            expectedAction: 'intervention',
            expectedRisk: 'medium'
        },
        {
            module: 'Language',
            name: 'L-Mixed: Cognitive Decline (Sign + Measure)',
            facts: [
                { id: 'l1', patientId: 'p2', category: 'language', sign: 'vocabulario_reducido', isResolved: false } as ClinicalFact,
                { id: 'l2', patientId: 'p2', category: 'language', sign: 'score_boston_naming', details: '10', isResolved: false } as ClinicalFact,
            ],
            expectedAction: 'intervention',
            expectedRisk: 'medium'
        },
        {
            module: 'Language',
            name: 'L-Mixed: Acute Stroke (Signs only - Measure irrelevant)',
            facts: [
                { id: 'l3', patientId: 'p2', category: 'language', sign: 'anomia', isResolved: false } as ClinicalFact,
                { id: 'l4', patientId: 'p2', category: 'language', sign: 'parafasias', isResolved: false } as ClinicalFact,
                { id: 'l5', patientId: 'p2', category: 'language', sign: 'agramatismo', isResolved: false } as ClinicalFact,
            ],
            expectedAction: 'emergency',
            expectedRisk: 'critical'
        }
    ];

    for (const tc of testCases) {
        const result = tc.module === 'Voice' 
            ? await voiceService.analyze(tc.facts) 
            : await langService.analyze(tc.facts);

        const success = result.recommendedActionLevel === tc.expectedAction && result.riskLevel === tc.expectedRisk;
        console.log(`${tc.name}: ${success ? '✅' : '❌'} (Risk: ${result.riskLevel}, Action: ${result.recommendedActionLevel})`);
    }
}

runMixedBaselineTests().catch(console.error);

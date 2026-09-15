import { SwallowingService } from './service';
import { ClinicalFact } from '../../types';

const service = new SwallowingService();

const testCases = [
  {
    name: 'Caso 1: Disfagia Leve Funcional (Riesgo Bajo)',
    facts: [
      { id: 'sw1', category: 'swallowing', sign: 'carraspeo_repetido', isResolved: false, timestamp: new Date().toISOString() } as ClinicalFact
    ],
    expectedRisk: 'low',
    expectedAction: 'observation'
  },
  {
    name: 'Caso 2: Ineficiencia Oral (Riesgo Medio)',
    facts: [
      { id: 'sw2', category: 'swallowing', sign: 'residuo_oral', isResolved: false, timestamp: new Date().toISOString() } as ClinicalFact,
      { id: 'sw3', category: 'swallowing', sign: 'deglucion_lenta', isResolved: false, timestamp: new Date().toISOString() } as ClinicalFact
    ],
    expectedRisk: 'medium',
    expectedAction: 'intervention'
  },
  {
    name: 'Caso 3: Sospecha Alta - Penetración/Aspiración (Riesgo Alto)',
    facts: [
      { id: 'sw4', category: 'swallowing', sign: 'tos_post_ingesta', isResolved: false, timestamp: new Date().toISOString() } as ClinicalFact,
      { id: 'sw5', category: 'swallowing', sign: 'voz_humeda', isResolved: false, timestamp: new Date().toISOString() } as ClinicalFact
    ],
    expectedRisk: 'high',
    expectedAction: 'urgent'
  },
  {
    name: 'Caso 4: Inseguridad Crítica de Vía Aérea (Riesgo Crítico)',
    facts: [
      { id: 'sw6', category: 'swallowing', sign: 'distress_respiratorio', isResolved: false, timestamp: new Date().toISOString() } as ClinicalFact
    ],
    expectedRisk: 'critical',
    expectedAction: 'emergency'
  },
  {
    name: 'Caso 5: Medida Objetiva Aislada (Gobernanza - Debe ser Medium)',
    facts: [
      { id: 'sw7', category: 'swallowing', sign: 'desaturacion_oxigeno_porcentaje', details: '4.0', isResolved: false, timestamp: new Date().toISOString() } as ClinicalFact
    ],
    expectedRisk: 'medium',
    expectedAction: 'intervention'
  }
];

async function runTests() {
  console.log('--- TESTING SWALLOWING MODULE BASELINES (SIGNS & MEASURES) ---');
  for (const tc of testCases) {
    const result = await service.analyze(tc.facts);
    const riskMatch = result.riskLevel === tc.expectedRisk;
    const actionMatch = result.recommendedActionLevel === tc.expectedAction;
    
    console.log(`\n${tc.name}`);
    console.log(`Risk Level: ${result.riskLevel} (Expected: ${tc.expectedRisk}) | Match: ${riskMatch ? '✅' : '❌'}`);
    console.log(`Action Level: ${result.recommendedActionLevel} (Expected: ${tc.expectedAction}) | Match: ${actionMatch ? '✅' : '❌'}`);
    console.log(`Referral Recommended: ${result.recommendedReferral} | Needs Instrumental Assessment: ${result.needsInstrumentalAssessment}`);
    console.log(`Family Summary: "${result.summary.family}"`);
  }

  console.log('\n--- TESTING LONGITUDINAL TRAJECTORY (T0 -> T1 -> T2) ---');
  
  const patientId = 'longitudinal-patient-swallowing';

  // T0: Patient has acute respiratory distress (Critical)
  const T0_facts = [
    { id: 'f0_1', patientId, category: 'swallowing', sign: 'distress_respiratorio', isResolved: false, timestamp: '2026-06-14T08:00:00Z' } as ClinicalFact
  ];

  // T1: Distress resolved, but now has high suspicion (cough & wet voice) post ingestion
  const T1_facts = [
    { id: 'f0_1', patientId, category: 'swallowing', sign: 'distress_respiratorio', isResolved: true, resolvedAt: '2026-06-14T09:00:00Z', timestamp: '2026-06-14T08:00:00Z' } as ClinicalFact,
    { id: 'f1_1', patientId, category: 'swallowing', sign: 'tos_post_ingesta', isResolved: false, timestamp: '2026-06-14T10:00:00Z' } as ClinicalFact,
    { id: 'f1_2', patientId, category: 'swallowing', sign: 'voz_humeda', isResolved: false, timestamp: '2026-06-14T10:00:00Z' } as ClinicalFact
  ];

  // T2: Treatment applied, symptoms resolved, patient now has only mild slow swallowing or normal
  const T2_facts = [
    { id: 'f0_1', patientId, category: 'swallowing', sign: 'distress_respiratorio', isResolved: true, resolvedAt: '2026-06-14T09:00:00Z', timestamp: '2026-06-14T08:00:00Z' } as ClinicalFact,
    { id: 'f1_1', patientId, category: 'swallowing', sign: 'tos_post_ingesta', isResolved: true, resolvedAt: '2026-06-14T11:00:00Z', timestamp: '2026-06-14T10:00:00Z' } as ClinicalFact,
    { id: 'f1_2', patientId, category: 'swallowing', sign: 'voz_humeda', isResolved: true, resolvedAt: '2026-06-14T11:00:00Z', timestamp: '2026-06-14T10:00:00Z' } as ClinicalFact,
    { id: 'f2_1', patientId, category: 'swallowing', sign: 'deglucion_lenta', isResolved: false, timestamp: '2026-06-14T12:00:00Z' } as ClinicalFact
  ];

  const t0_res = await service.analyze(T0_facts);
  console.log(`\nT0 Status (Acute): Risk = ${t0_res.riskLevel} | Action = ${t0_res.recommendedActionLevel}`);
  
  const t1_res = await service.analyze(T1_facts);
  console.log(`T1 Status (Recovery/Aspiration Risk): Risk = ${t1_res.riskLevel} | Action = ${t1_res.recommendedActionLevel}`);

  const t2_res = await service.analyze(T2_facts);
  console.log(`T2 Status (Resolution/Mild): Risk = ${t2_res.riskLevel} | Action = ${t2_res.recommendedActionLevel}`);
  
  process.exit(0);
}

runTests().catch(console.error);

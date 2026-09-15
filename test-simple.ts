import { VoiceService } from './src/modules/voice/service';
import { ClinicalFact } from './types';

async function simpleTest() {
    console.log('Running simple test...');
    const service = new VoiceService();
    const result = await service.analyze([
        { id: '1', patientId: 'p1', category: 'voice', sign: 'estridor', isResolved: false } as ClinicalFact
    ]);
    console.log('Result:', result.riskLevel);
}

simpleTest().catch(console.error);

import { describe, it, expect } from 'vitest';
import { NBAEngineImpl } from '../../src/intelligence/nba/engine_impl';
import { VoiceReasoner } from '../../src/intelligence/nba/reasoners/voice_reasoner';
import { SwallowingReasoner } from '../../src/intelligence/nba/reasoners/swallowing_reasoner';
import { NBAModuleResult } from '../../src/intelligence/types';
import { VoiceAnalysisResult } from '../../src/modules/voice/service';
import { SwallowingAnalysisResult } from '../../src/modules/swallowing/types';

describe('NBAEngine', () => {
  it('should generate actions for voice and swallowing modules', async () => {
    const voiceReasoner = new VoiceReasoner();
    const swallowingReasoner = new SwallowingReasoner();
    const engine = new NBAEngineImpl([voiceReasoner, swallowingReasoner]);

    const mockVoiceResult: VoiceAnalysisResult = {
      signsDetected: ['disfonia_persistente' as any],
      measures: [],
      redFlags: [{
        type: 'SymptomRedFlag',
        severity: 'high',
        description: 'Persistent dysphonia',
        relatedFacts: [],
        sourceRefs: [],
        action: 'urgent'
      }],
      observations: [],
      riskLevel: 'high',
      recommendedActionLevel: 'urgent',
      recommendedReferral: true,
      needsInstrumentalAssessment: true,
      summary: {
        professional: 'Persistent dysphonia',
        family: 'Persistent voice change'
      },
      triggeringFactIds: ['fact_1']
    };

    const mockSwallowingResult: SwallowingAnalysisResult = {
      signsDetected: [],
      measures: [],
      observations: [],
      redFlags: [],
      riskLevel: 'low',
      recommendedActionLevel: 'observation',
      recommendedReferral: false,
      needsInstrumentalAssessment: false,
      summary: {
        professional: 'No signs',
        family: 'No signs'
      },
      triggeringFactIds: []
    };

    const moduleResults: NBAModuleResult[] = [
      { moduleId: 'voice', data: mockVoiceResult },
      { moduleId: 'swallowing', data: mockSwallowingResult }
    ];

    const engineResult = await engine.generateActions({}, moduleResults);

    expect(engineResult.results).toHaveLength(2);
    
    const voiceResult = engineResult.results.find(r => r.moduleId === 'voice');
    expect(voiceResult?.actions).toHaveLength(2); // One for red flag, one for instrumental assessment
    expect(voiceResult?.actions[0].action).toBe('referral');
    expect(voiceResult?.actions[1].action).toBe('reevaluation');

    const swallowingResult = engineResult.results.find(r => r.moduleId === 'swallowing');
    expect(swallowingResult?.actions).toHaveLength(0);
  });
});

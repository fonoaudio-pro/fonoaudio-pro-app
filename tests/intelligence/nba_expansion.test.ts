import { describe, it, expect } from 'vitest';
import { NBAEngineImpl } from '../../src/intelligence/nba/engine_impl';
import { VoiceReasoner } from '../../src/intelligence/nba/reasoners/voice_reasoner';
import { SwallowingReasoner } from '../../src/intelligence/nba/reasoners/swallowing_reasoner';
import { LanguageReasoner } from '../../src/intelligence/nba/reasoners/language_reasoner';
import { CognitionReasoner } from '../../src/intelligence/nba/reasoners/cognition_reasoner';
import { NBAModuleResult } from '../../src/intelligence/types';
import { VoiceAnalysisResult } from '../../src/modules/voice/service';
import { SwallowingAnalysisResult } from '../../src/modules/swallowing/types';
import { LanguageAnalysisResult } from '../../src/modules/language/service';
import { CognitionAnalysisResult } from '../../src/modules/cognition/types';

describe('NBAEngine Expansion', () => {
  it('should generate actions for language and cognition modules', async () => {
    const engine = new NBAEngineImpl([
      new VoiceReasoner(),
      new SwallowingReasoner(),
      new LanguageReasoner(),
      new CognitionReasoner()
    ]);

    const mockLanguageResult: LanguageAnalysisResult = {
      signsDetected: ['anomia' as any],
      measures: [],
      observations: [],
      redFlags: [],
      riskLevel: 'medium',
      recommendedActionLevel: 'intervention',
      summary: {
        professional: 'Anomia detectada',
        family: 'Dificultad para encontrar palabras'
      },
      triggeringFactIds: ['lang_fact_1']
    };

    const mockCognitionResult: CognitionAnalysisResult = {
      signsDetected: ['desorientacion_temporal' as any],
      measures: [],
      observations: [],
      redFlags: [{ description: 'Desorientación temporal detectada' }],
      riskLevel: 'high',
      recommendedActionLevel: 'urgent',
      recommendedReferral: true,
      needsInstrumentalAssessment: true,
      summary: {
        professional: 'Desorientación temporal',
        family: 'Confusión con el tiempo'
      },
      triggeringFactIds: ['cog_fact_1']
    };

    const moduleResults: NBAModuleResult[] = [
      { moduleId: 'language', data: mockLanguageResult },
      { moduleId: 'cognition', data: mockCognitionResult }
    ];

    const engineResult = await engine.generateActions({}, moduleResults);

    expect(engineResult.results).toHaveLength(2);
    
    const languageResult = engineResult.results.find(r => r.moduleId === 'language');
    expect(languageResult?.actions.length).toBeGreaterThan(0);
    expect(languageResult?.actions[0].action).toBe('home_guide');

    const cognitionResult = engineResult.results.find(r => r.moduleId === 'cognition');
    expect(cognitionResult?.actions.length).toBeGreaterThan(0);
    expect(cognitionResult?.actions[0].action).toBe('referral');
  });
});

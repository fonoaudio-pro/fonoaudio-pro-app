import { NBAEngine, NBAModuleReasoner } from './engine';
import { NBAEngineResult, NBAModuleResult, NBAModuleActionResult } from '../types';

export class NBAEngineImpl implements NBAEngine {
  constructor(private reasoners: NBAModuleReasoner<any, any>[]) {}

  async generateActions(context: any, moduleResults: NBAModuleResult[]): Promise<NBAEngineResult> {
    const results: NBAModuleActionResult[] = [];
    const timestamp = new Date().toISOString();

    for (const moduleResult of moduleResults) {
      const reasoner = this.reasoners.find(r => r.moduleId === moduleResult.moduleId);
      if (reasoner) {
        const actions = await reasoner.reason(context, moduleResult.data);
        results.push({
          moduleId: moduleResult.moduleId,
          actions: actions
        });
      }
    }

    return {
      timestamp,
      results
    };
  }
}

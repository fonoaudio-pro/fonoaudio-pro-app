import { NextBestAction } from '../types';

/**
 * Base class for module-specific reasoning within the NBA engine.
 */
export abstract class NBAModuleReasoner<TContext, TModuleResult> {
  protected abstract moduleId: string;
  protected abstract artifactIds: string[];

  abstract reason(context: TContext, moduleResult: TModuleResult): Promise<NextBestAction[]>;
}

export interface NBAEngine {
  /**
   * Generates next best actions based on provided context and module results.
   */
  generateActions(context: any, moduleResults: any[]): Promise<any>;
}

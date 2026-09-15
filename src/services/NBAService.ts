import { NBAEngine } from '../intelligence/nba/engine';
import { NBAEngineImpl } from '../intelligence/nba/engine_impl';
import { VoiceReasoner } from '../intelligence/nba/reasoners/voice_reasoner';
import { SwallowingReasoner } from '../intelligence/nba/reasoners/swallowing_reasoner';
import { LanguageReasoner } from '../intelligence/nba/reasoners/language_reasoner';
import { CognitionReasoner } from '../intelligence/nba/reasoners/cognition_reasoner';
import { AudiologyReasoner } from '../intelligence/nba/reasoners/audiology_reasoner';
import { MotricityReasoner } from '../intelligence/nba/reasoners/motricity_reasoner';
import { NBAEngineResult, NBAModuleActionResult, NextBestAction } from '../intelligence/types';
import { supabase } from '../../utils/supabaseClient';

export class NBAService {
  private engine: NBAEngine;

  constructor() {
    this.engine = new NBAEngineImpl([
      new VoiceReasoner(),
      new SwallowingReasoner(),
      new LanguageReasoner(),
      new CognitionReasoner(),
      new AudiologyReasoner(),
      new MotricityReasoner()
    ]);
  }

  /**
   * Generates suggestions based on the current module results and persists them.
   */
  async getSuggestions(context: any, moduleResults: any[]): Promise<NBAEngineResult> {
    const engineResult = await this.engine.generateActions(context, moduleResults);
    
    if (context.activePatientId) {
      for (const moduleResult of engineResult.results) {
        if (moduleResult.actions.length > 0) {
          await this.persistSuggestions(context.activePatientId, moduleResult.moduleId, moduleResult.actions);
        }
      }
      // Refresh engineResult with database IDs
      return this.enrichWithSuggestionIds(context.activePatientId, engineResult);
    }
    
    return engineResult;
  }

  private async persistSuggestions(patientId: string, moduleId: string, actions: NextBestAction[]): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    const ownerId = user?.id || null;

    const suggestionsToUpsert = actions.map(action => ({
      patient_id: patientId,
      module_id: moduleId,
      action_id: action.id,
      title: action.title,
      description: action.description,
      rationale: action.rationale,
      triggering_facts: action.triggeringFacts,
      knowledge_artifacts_used: action.knowledgeArtifactsUsed,
      confidence_or_strength: action.confidenceOrStrength,
      status: 'pending',
      owner_id: ownerId
    }));

    const { error } = await supabase
      .from('nba_suggestions')
      .upsert(suggestionsToUpsert, { onConflict: 'action_id' });

    if (error) {
      console.error("Error persisting NBA suggestions:", error);
      throw error;
    }
  }

  private async enrichWithSuggestionIds(patientId: string, engineResult: NBAEngineResult): Promise<NBAEngineResult> {
    for (const moduleResult of engineResult.results) {
      const actionIds = moduleResult.actions.map(a => a.id);
      const { data: dbSuggestions, error } = await supabase
        .from('nba_suggestions')
        .select('id, action_id')
        .eq('patient_id', patientId)
        .in('action_id', actionIds);

      if (error) {
        console.error("Error enriching suggestions with IDs:", error);
        continue;
      }

      if (dbSuggestions) {
        const idMap = new Map(dbSuggestions.map(s => [s.action_id, s.id]));
        for (const action of moduleResult.actions) {
          const dbId = idMap.get(action.id);
          if (dbId) {
            action.suggestionId = dbId.toString();
          }
        }
      }
    }
    return engineResult;
  }

  /**
   * Records the clinician's decision on a suggestion.
   */
  async recordDecision(patientId: string, decision: {
    originalActionId?: string;
    actionId: string;
    actionType: string;
    category?: string;
    rationale?: string;
    triggeringFacts?: string[];
    knowledgeArtifactsUsed?: string[];
    confidenceOrStrength?: number;
    disposition: 'accepted' | 'rejected' | 'edited';
    dispositionReason?: string;
    metadata?: any;
    sessionId?: string;
    suggestionId?: string;
  }): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    const ownerId = user?.id || null;

    const { error } = await supabase.from('nba_decisions').insert({
      patient_id: patientId,
      suggestion_id: decision.suggestionId,
      original_action_id: decision.originalActionId,
      action_id: decision.actionId,
      action_type: decision.actionType,
      category: decision.category,
      rationale: decision.rationale,
      triggering_facts: decision.triggeringFacts,
      knowledge_artifacts_used: decision.knowledgeArtifactsUsed,
      confidence_or_strength: decision.confidenceOrStrength,
      clinician_disposition: decision.disposition,
      disposition_reason: decision.dispositionReason,
      metadata: decision.metadata,
      session_id: decision.sessionId,
      owner_id: ownerId
    });

    if (error) {
      console.error("Error recording NBA decision:", error);
      throw error;
    }

    // If accepted or rejected, update the suggestion status
    if (decision.disposition !== 'edited' && decision.suggestionId) {
        const newStatus = decision.disposition === 'accepted' ? 'accepted' : 'rejected';
        await supabase
          .from('nba_suggestions')
          .update({ status: newStatus })
          .eq('id', decision.suggestionId);
    }
  }

  async getAuditLogs(patientId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('nba_decisions')
      .select(`
        *,
        nba_suggestions (
          id,
          title,
          description,
          rationale,
          triggering_facts,
          knowledge_artifacts_used,
          confidence_or_strength
        )
      `)
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching NBA audit logs:", error);
      throw error;
    }
    return data;
  }
}

export const nbaService = new NBAService();

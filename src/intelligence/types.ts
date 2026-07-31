export type ClinicianDisposition = 'pending' | 'accepted' | 'rejected' | 'edited';

export interface NextBestAction {
  id: string; // The engine-generated action_id
  suggestionId?: string; // The database primary key for the suggestion
  action: string;
  category: string;
  title: string;
  description: string;
  rationale: string;
  triggeringFacts: string[];
  knowledgeArtifactsUsed: string[];
  confidenceOrStrength: number;
  clinicianDisposition: ClinicianDisposition;
  dispositionReason?: string;
  metadata?: Record<string, any>;
}

export type KnowledgeArtifactType = 'rule' | 'protocol' | 'intervention' | 'followup_logic';

export interface KnowledgeArtifact {
  id: string;
  version: string;
  type: KnowledgeArtifactType;
  name: string;
  description?: string;
  metadata?: Record<string, any>;
}

export interface NBAModuleResult {
  moduleId: string;
  data: any;
}

export interface NBAModuleActionResult {
  moduleId: string;
  actions: NextBestAction[];
}

export interface NBAEngineResult {
  timestamp: string;
  results: NBAModuleActionResult[];
}

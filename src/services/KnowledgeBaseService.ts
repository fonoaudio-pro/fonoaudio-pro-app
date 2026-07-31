import { KnowledgeArtifact, KnowledgeArtifactType } from '../intelligence/types';
import { VOICE_KNOWLEDGE_BASE } from '../intelligence/knowledge_base/rules/voice_rules';
import { SWALLOWING_KNOWLEDGE_BASE } from '../intelligence/knowledge_base/rules/swallowing_rules';

export class KnowledgeBaseService {
  private artifacts: Map<string, KnowledgeArtifact> = new Map();

  constructor() {
    this.loadArtifacts();
  }

  private loadArtifacts() {
    // In a real app, this would fetch from Supabase or a versioned file system
    // For now, we populate from our local constants
    
    // Voice artifacts
    VOICE_KNOWLEDGE_BASE.forEach(art => {
      this.artifacts.set(art.id, {
        id: art.id,
        type: art.type as KnowledgeArtifactType,
        name: art.name,
        description: art.description,
        metadata: art.metadata
      });
    });

    // Swallowing artifacts
    SWALLOWING_KNOWLEDGE_BASE.forEach(art => {
      this.artifacts.set(art.id, {
        id: art.id,
        type: art.type as KnowledgeArtifactType,
        name: art.name,
        description: art.description,
        metadata: art.metadata
      });
    });
  }

  getArtifact(id: string): KnowledgeArtifact | undefined {
    return this.artifacts.get(id);
  }

  getAllArtifacts(): KnowledgeArtifact[] {
    return Array.from(this.artifacts.values());
  }
}

export const knowledgeBaseService = new KnowledgeBaseService();

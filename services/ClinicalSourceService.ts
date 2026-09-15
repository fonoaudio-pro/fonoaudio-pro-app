import { supabase } from '../utils/supabaseClient';

export interface ClinicalSource {
  id: string;
  title: string;
  category: string;
  content: string;
}

class ClinicalSourceService {
  /**
   * Performs semantic search against validated clinical sources
   */
  async getRelevantContext(query: string, patientId?: string): Promise<string[]> {
    // 1. Generate embedding for query (will call backend helper that uses OpenAI/Gemini embedding API)
    // 2. Perform vector search in supabase
    
    // Placeholder implementation for retrieval
    const { data, error } = await supabase
      .from('source_embeddings')
      .select('content')
      .textSearch('content', query) // Fallback to full-text if pgvector not fully initialized yet
      .limit(3);

    if (error) {
      console.error('Error in RAG retrieval:', error);
      return [];
    }

    return (data || []).map((d: any) => d.content);
  }

  async addSource(source: { title: string; category: string; content: string }) {
    // 1. Insert into clinical_sources
    // 2. Generate embedding
    // 3. Insert into source_embeddings
  }
}

export const clinicalSourceService = new ClinicalSourceService();

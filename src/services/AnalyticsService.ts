import { supabase } from '../../utils/supabaseClient';

export interface NBAMetrics {
  totalSuggestions: number;
  acceptanceRate: number;
  rejectionRate: number;
  editRate: number;
  distributionByModule: Record<string, number>;
  distributionByCategory: Record<string, number>;
}

export class AnalyticsService {
  async getNBAMetrics(): Promise<NBAMetrics> {
    const { data: decisions, error } = await supabase
      .from('nba_decisions')
      .select('*');

    if (error) {
      console.error('Error fetching NBA decisions for metrics:', error);
      throw error;
    }

    if (!decisions || decisions.length === 0) {
      return {
        totalSuggestions: 0,
        acceptanceRate: 0,
        rejectionRate: 0,
        editRate: 0,
        distributionByModule: {},
        distributionByCategory: {}
      };
    }

    const total = decisions.length;
    let accepted = 0;
    let rejected = 0;
    let edited = 0;

    const moduleDist: Record<string, number> = {};
    const categoryDist: Record<string, number> = {};

    decisions.forEach(d => {
      // Disposition
      if (d.clinician_disposition === 'accepted') accepted++;
      else if (d.clinician_disposition === 'rejected') rejected++;
      else if (d.clinician_disposition === 'edited') edited++;

      // Module distribution (we might need to extract this from metadata or pass it)
      // Since decision doesn't have module_id directly in the schema I wrote, 
      // let's assume it's in metadata.
      const module = d.metadata?.moduleId;
      if (module) {
        moduleDist[module] = (moduleDist[module] || 0) + 1;
      }

      // Category distribution
      const category = d.category;
      if (category) {
        categoryDist[category] = (categoryDist[category] || 0) + 1;
      }
    });

    return {
      totalSuggestions: total,
      acceptanceRate: (accepted / total) * 100,
      rejectionRate: (rejected / total) * 100,
      editRate: (edited / total) * 100,
      distributionByModule: moduleDist,
      distributionByCategory: categoryDist
    };
  }
}

export const analyticsService = new AnalyticsService();

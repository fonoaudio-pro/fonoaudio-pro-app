import { describe, it, expect, vi } from 'vitest';
import { analyticsService } from '../../src/services/AnalyticsService';
import { supabase } from '../../utils/supabaseClient';

vi.mock('../../utils/supabaseClient', () => ({
  supabase: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
  },
}));

describe('NBA Metrics Simulation', () => {
  it('should correctly calculate metrics for Language and Cognition modules', async () => {
    const mockDecisions = [
      // Language - 10 decisions
      // 6 Accepted
      ...Array(6).fill(null).map((_, i) => ({
        id: `lang_acc_${i}`,
        clinician_disposition: 'accepted',
        category: i < 3 ? 'clinical' : 'preventive',
        metadata: { moduleId: 'language' }
      })),
      // 2 Rejected
      ...Array(2).fill(null).map((_, i) => ({
        id: `lang_rej_${i}`,
        clinician_disposition: 'rejected',
        category: 'clinical',
        metadata: { moduleId: 'language' }
      })),
      // 2 Edited
      ...Array(2).fill(null).map((_, i) => ({
        id: `lang_edit_${i}`,
        clinician_disposition: 'edited',
        category: 'preventive',
        metadata: { moduleId: 'language' }
      })),

      // Cognition - 10 decisions
      // 4 Accepted
      ...Array(4).fill(null).map((_, i) => ({
        id: `cog_acc_${i}`,
        clinician_disposition: 'accepted',
        category: 'clinical',
        metadata: { moduleId: 'cognition' }
      })),
      // 3 Rejected
      ...Array(3).fill(null).map((_, i) => ({
        id: `cog_rej_${i}`,
        clinician_disposition: 'rejected',
        category: 'clinical',
        metadata: { moduleId: 'cognition' }
      })),
      // 3 Edited
      ...Array(3).fill(null).map((_, i) => ({
        id: `cog_edit_${i}`,
        clinician_disposition: 'edited',
        category: 'preventive',
        metadata: { moduleId: 'cognition' }
      })),
    ];

    (supabase.from as any).mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: mockDecisions, error: null }),
    });

    const metrics = await analyticsService.getNBAMetrics();

    // Assertions
    expect(metrics.totalSuggestions).toBe(20);
    expect(metrics.acceptanceRate).toBe(50); // (6+4)/20 * 100
    expect(metrics.rejectionRate).toBe(25);  // (2+3)/20 * 100
    expect(metrics.editRate).toBe(25);       // (2+3)/20 * 100
    
    expect(metrics.distributionByModule).toEqual({
      language: 10,
      cognition: 10
    });

    expect(metrics.distributionByCategory).toEqual({
      clinical: 12, // 3(lang_acc) + 2(lang_rej) + 4(cog_acc) + 3(cog_rej) = 12
      preventive: 8 // 3(lang_acc) + 2(lang_edit) + 3(cog_edit) = 8
    });

    console.log('Simulated Metrics:', JSON.stringify(metrics, null, 2));
  });
});

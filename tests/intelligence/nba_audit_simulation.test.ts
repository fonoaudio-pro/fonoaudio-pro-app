import { describe, it, expect, vi } from 'vitest';
import { nbaService } from '../../src/services/NBAService';
import { supabase } from '../../utils/supabaseClient';

vi.mock('../../utils/supabaseClient', () => ({
  supabase: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
  },
}));

describe('NBA Audit Mode Simulation', () => {
  it('should correctly retrieve audit logs with joined suggestion data', async () => {
    const mockDecisions = [
      {
        id: 'decision_1',
        patient_id: 'patient_123',
        suggestion_id: 'suggestion_1',
        action_id: 'action_1',
        action_type: 'referral',
        category: 'clinical',
        clinician_disposition: 'accepted',
        nba_suggestions: {
          id: 'suggestion_1',
          title: 'Urgent Referral',
          description: 'Description',
          rationale: 'Rationale',
          triggering_facts: ['fact_1'],
          knowledge_artifacts_used: ['art_1'],
          confidence_or_strength: 1.0
        }
      },
      {
        id: 'decision_2',
        patient_id: 'patient_123',
        suggestion_id: 'suggestion_2',
        action_id: 'action_2',
        action_type: 'home_guide',
        category: 'preventive',
        clinician_disposition: 'edited',
        nba_suggestions: {
          id: 'suggestion_2',
          title: 'Home Guide',
          description: 'Description',
          rationale: 'Rationale',
          triggering_facts: ['fact_2'],
          knowledge_artifacts_used: ['art_2'],
          confidence_or_strength: 0.8
        }
      }
    ];

    const queryBuilder = {
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      then: vi.fn().mockImplementation((onFulfilled) => {
        return Promise.resolve({ data: mockDecisions, error: null }).then(onFulfilled);
      })
    };

    (supabase.from as any).mockReturnValue({
      select: vi.fn().mockReturnValue(queryBuilder),
    });

    const logs = await nbaService.getAuditLogs('patient_123');

    expect(logs).toHaveLength(2);
    expect(logs[0].clinician_disposition).toBe('accepted');
    expect(logs[0].nba_suggestions.title).toBe('Urgent Referral');
    expect(logs[1].clinician_disposition).toBe('edited');
    expect(logs[1].nba_suggestions.title).toBe('Home Guide');
  });
});

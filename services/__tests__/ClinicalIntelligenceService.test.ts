import { describe, test, expect, vi, beforeEach } from 'vitest';
import { ClinicalIntelligenceService } from '../ClinicalIntelligenceService';
import { MaterialService } from '../MaterialService';
import { supabase } from '../../utils/supabaseClient';

// Mocking dependencies
vi.mock('../../utils/supabaseClient', () => ({
  supabase: {
    from: vi.fn(),
  }
}));

vi.mock('../MaterialService', () => ({
  MaterialService: {
    getAllMaterials: vi.fn(),
  }
}));

describe('ClinicalIntelligenceService', () => {
  const patientId = 'pat-123';
  const todayStr = new Date().toISOString().split('T')[0];
  const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  // Helper to create a chainable mock for Supabase
  const createSupabaseMock = (data: any) => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
    };
    (supabase.from as any).mockReturnValue(query);
    return query;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getProactiveSuggestions', () => {
    
    test('SC-01: should generate a follow-up suggestion based on nextAction from the last session', async () => {
      const sessions = [
        { id: 'sess-today', date: todayStr, nextAction: null, observations: '', summary: '' },
        { id: 'sess-prev', date: yesterdayStr, nextAction: 'Reforzar praxias labiales', observations: '', summary: '' }
      ];

      createSupabaseMock(sessions);

      const suggestions = await ClinicalIntelligenceService.getProactiveSuggestions(patientId);

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].title).toBe('Seguir plan de acción');
      expect(suggestions[0].reasoning).toContain('Reforzar praxias labiales');
      expect(suggestions[0].priority).toBe('medium');
    });

    test('SC-02: should detect "Habla" pattern and recommend relevant material', async () => {
      const sessions = [
        { id: 'sess-today', date: todayStr, nextAction: null, observations: '', summary: '' },
        { id: 'sess-prev', date: yesterdayStr, nextAction: null, observations: 'presenta dificultad en el habla', summary: '' }
      ];

      const mockMaterials = [
        { id: 'mat-habla', title: 'Ejercicios de Articulación', clinical_area: 'Habla', tags: [] }
      ];

      createSupabaseMock(sessions);
      (MaterialService.getAllMaterials as any).mockResolvedValue(mockMaterials);

      const suggestions = await ClinicalIntelligenceService.getProactiveSuggestions(patientId);

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].title).toBe('Reforzar articulación');
      expect(suggestions[0].recommendedMaterialId).toBe('mat-habla');
      expect(suggestions[0].priority).toBe('high');
    });

    test('SC-03: should detect "Deglución" pattern via summary', async () => {
      const sessions = [
        { id: 'sess-today', date: todayStr, nextAction: null, observations: '', summary: 'problemas de deglución' },
        { id: 'sess-prev', date: yesterdayStr, nextAction: null, observations: '', summary: 'normal' }
      ];

      const mockMaterials = [
        { id: 'mat-deglucion', title: 'Protocolo de Seguridad', clinical_area: 'Deglución', tags: [] }
      ];

      createSupabaseMock(sessions);
      (MaterialService.getAllMaterials as any).mockResolvedValue(mockMaterials);

      const suggestions = await ClinicalIntelligenceService.getProactiveSuggestions(patientId);

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].title).toBe('Protocolo de deglución');
      expect(suggestions[0].recommendedMaterialId).toBe('mat-deglucion');
    });

    test('SC-04: should detect "Lenguaje" pattern via observations', async () => {
      const sessions = [
        { id: 'sess-today', date: todayStr, nextAction: null, observations: '', summary: '' },
        { id: 'sess-prev', date: yesterdayStr, nextAction: null, observations: 'pobre vocabulario', summary: '' }
      ];

      const mockMaterials = [
        { id: 'mat-lenguaje', title: 'Juego de Palabras', clinical_area: 'Lenguaje', tags: [] }
      ];

      createSupabaseMock(sessions);
      (MaterialService.getAllMaterials as any).mockResolvedValue(mockMaterials);

      const suggestions = await ClinicalIntelligenceService.getProactiveSuggestions(patientId);

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].title).toBe('Ampliación léxica');
      expect(suggestions[0].recommendedMaterialId).toBe('mat-lenguaje');
    });

    test('SC-05: should fallback to generic suggestion when no patterns are found', async () => {
      const sessions = [
        { id: 'sess-today', date: todayStr, nextAction: null, observations: '', summary: '' },
        { id: 'sess-prev', date: yesterdayStr, nextAction: null, observations: 'todo normal', summary: 'sin novedades' }
      ];

      createSupabaseMock(sessions);

      const suggestions = await ClinicalIntelligenceService.getProactiveSuggestions(patientId);

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].title).toBe('Sesión de seguimiento');
      expect(suggestions[0].priority).toBe('low');
    });

    test('SC-06: should handle corrupt/empty data without crashing (Fallback)', async () => {
      const sessions = [
        { id: 'sess-today', date: todayStr, nextAction: null, observations: null, summary: undefined },
        { id: 'sess-prev', date: yesterdayStr, nextAction: null, observations: null, summary: null }
      ];

      createSupabaseMock(sessions);

      const suggestions = await ClinicalIntelligenceService.getProactiveSuggestions(patientId);

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].title).toBe('Sesión de seguimiento');
    });

    test('Fallback Material: should use generic suggestedAction if no material matches the pattern', async () => {
      const sessions = [
        { id: 'sess-today', date: todayStr, nextAction: null, observations: '', summary: '' },
        { id: 'sess-prev', date: yesterdayStr, nextAction: null, observations: 'dificultad', summary: '' }
      ];

      createSupabaseMock(sessions);
      (MaterialService.getAllMaterials as any).mockResolvedValue([]); // No materials

      const suggestions = await ClinicalIntelligenceService.getProactiveSuggestions(patientId);

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].suggestedAction).toContain('Realizar actividades enfocadas en Habla');
      expect(suggestions[0].recommendedMaterialId).toBeUndefined();
    });

    test('Multiple Patterns: should only return the first detected pattern (current limitation)', async () => {
      const sessions = [
        { id: 'sess-today', date: todayStr, nextAction: null, observations: '', summary: '' },
        { id: 'sess-prev', date: yesterdayStr, nextAction: null, observations: 'dificultad y vocabulario', summary: '' }
      ];

      createSupabaseMock(sessions);
      (MaterialService.getAllMaterials as any).mockResolvedValue([]);

      const suggestions = await ClinicalIntelligenceService.getProactiveSuggestions(patientId);

      // Currently, it breaks after the first match.
      expect(suggestions).toHaveLength(1);
    });

    describe('Negation Detection (Phase 2)', () => {
      test('SC-NEG-01: should NOT trigger pattern when negated with "no presenta"', async () => {
        const sessions = [
          { id: 'sess-today', date: todayStr, nextAction: null, observations: '', summary: '' },
          { id: 'sess-prev', date: yesterdayStr, nextAction: null, observations: 'no presenta dificultad', summary: '' }
        ];

        createSupabaseMock(sessions);
        (MaterialService.getAllMaterials as any).mockResolvedValue([]);

        const suggestions = await ClinicalIntelligenceService.getProactiveSuggestions(patientId);

        // Should fallback to generic because "no presenta dificultad" is not a positive pattern
        expect(suggestions).toHaveLength(1);
        expect(suggestions[0].title).toBe('Sesión de seguimiento');
      });

      test('SC-NEG-02: should NOT trigger pattern when negated with "sin signos de"', async () => {
        const sessions = [
          { id: 'sess-today', date: todayStr, nextAction: null, observations: '', summary: '' },
          { id: 'sess-prev', date: yesterdayStr, nextAction: null, observations: 'sin signos de dificultad', summary: '' }
        ];

        createSupabaseMock(sessions);
        (MaterialService.getAllMaterials as any).mockResolvedValue([]);

        const suggestions = await ClinicalIntelligenceService.getProactiveSuggestions(patientId);

        expect(suggestions).toHaveLength(1);
        expect(suggestions[0].title).toBe('Sesión de seguimiento');
      });

      test('SC-NEG-03: should NOT trigger pattern when negated with "niega"', async () => {
        const sessions = [
          { id: 'sess-today', date: todayStr, nextAction: null, observations: '', summary: '' },
          { id: 'sess-prev', date: yesterdayStr, nextAction: null, observations: 'el paciente niega dificultad', summary: '' }
        ];

        createSupabaseMock(sessions);
        (MaterialService.getAllMaterials as any).mockResolvedValue([]);

        const suggestions = await ClinicalIntelligenceService.getProactiveSuggestions(patientId);

        expect(suggestions).toHaveLength(1);
        expect(suggestions[0].title).toBe('Sesión de seguimiento');
      });

      test('SC-NEG-04: should STILL trigger pattern when affirmative', async () => {
        const sessions = [
          { id: 'sess-today', date: todayStr, nextAction: null, observations: '', summary: '' },
          { id: 'sess-prev', date: yesterdayStr, nextAction: null, observations: 'presenta dificultad', summary: '' }
        ];

        createSupabaseMock(sessions);
        (MaterialService.getAllMaterials as any).mockResolvedValue([]);

        const suggestions = await ClinicalIntelligenceService.getProactiveSuggestions(patientId);

        expect(suggestions).toHaveLength(1);
        expect(suggestions[0].title).toBe('Reforzar articulación');
      });
    });

    /**
     * TODO: Known issues/limitations to address in future iterations:
     * 
     * 1. False Positives: Keywords like "dificultad" trigger patterns even if negated ("no hay dificultad").
     * 2. Multi-Pattern: The engine currently returns only the first pattern detected (uses `break`).
     * 3. Reasoning: Rule 2 reasoning could be improved to include the specific date of the evidence.
     */
  });
});

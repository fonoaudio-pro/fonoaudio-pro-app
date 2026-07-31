import { supabase } from '../utils/supabaseClient';

export interface TestResultRow {
    id: string;
    patient_id: string;
    test_id: string;
    test_name: string;
    test_acronym: string | null;
    area: string | null;
    subtest_scores: any[];
    raw_score: number | null;
    max_score: number | null;
    percentage: number | null;
    percentile: number | null;
    classification: string | null;
    age_at_test: number | null;
    test_date: string;
    observations: string | null;
    clinician_notes: string | null;
    author_id: string | null;
    created_at: string;
    updated_at: string;
}

export interface TestResultInsert {
    patient_id: string;
    test_id: string;
    test_name: string;
    test_acronym?: string;
    area?: string;
    subtest_scores?: any[];
    raw_score?: number;
    max_score?: number;
    percentage?: number;
    percentile?: number;
    classification?: string;
    age_at_test?: number;
    test_date?: string;
    observations?: string;
    clinician_notes?: string;
}

export interface TestResultUpdate {
    subtest_scores?: any[];
    raw_score?: number;
    max_score?: number;
    percentage?: number;
    percentile?: number;
    classification?: string;
    observations?: string;
    clinician_notes?: string;
    test_date?: string;
}

export const TestResultsService = {
    async getByPatientId(patientId: string): Promise<TestResultRow[]> {
        const { data, error } = await supabase
            .from('test_results')
            .select('*')
            .eq('patient_id', patientId)
            .order('test_date', { ascending: false });

        if (error) throw error;
        return data || [];
    },

    async getByPatientAndTest(patientId: string, testId: string): Promise<TestResultRow[]> {
        const { data, error } = await supabase
            .from('test_results')
            .select('*')
            .eq('patient_id', patientId)
            .eq('test_id', testId)
            .order('test_date', { ascending: false });

        if (error) throw error;
        return data || [];
    },

    async getById(resultId: string): Promise<TestResultRow | null> {
        const { data, error } = await supabase
            .from('test_results')
            .select('*')
            .eq('id', resultId)
            .single();

        if (error) throw error;
        return data;
    },

    async insert(result: TestResultInsert): Promise<TestResultRow> {
        const { data, error } = await supabase
            .from('test_results')
            .insert({
                patient_id: result.patient_id,
                test_id: result.test_id,
                test_name: result.test_name,
                test_acronym: result.test_acronym || null,
                area: result.area || null,
                subtest_scores: result.subtest_scores || [],
                raw_score: result.raw_score ?? null,
                max_score: result.max_score ?? null,
                percentage: result.percentage ?? null,
                percentile: result.percentile ?? null,
                classification: result.classification || null,
                age_at_test: result.age_at_test ?? null,
                test_date: result.test_date || new Date().toISOString().split('T')[0],
                observations: result.observations || null,
                clinician_notes: result.clinician_notes || null,
            })
            .select()
            .single();

        if (error) throw error;
        return data;
    },

    async insertBatch(results: TestResultInsert[]): Promise<TestResultRow[]> {
        const { data, error } = await supabase
            .from('test_results')
            .insert(results.map(r => ({
                patient_id: r.patient_id,
                test_id: r.test_id,
                test_name: r.test_name,
                test_acronym: r.test_acronym || null,
                area: r.area || null,
                subtest_scores: r.subtest_scores || [],
                raw_score: r.raw_score ?? null,
                max_score: r.max_score ?? null,
                percentage: r.percentage ?? null,
                percentile: r.percentile ?? null,
                classification: r.classification || null,
                age_at_test: r.age_at_test ?? null,
                test_date: r.test_date || new Date().toISOString().split('T')[0],
                observations: r.observations || null,
                clinician_notes: r.clinician_notes || null,
            })))
            .select();

        if (error) throw error;
        return data || [];
    },

    async update(resultId: string, updates: TestResultUpdate): Promise<void> {
        const payload: Record<string, any> = { updated_at: new Date().toISOString() };
        if (updates.subtest_scores !== undefined) payload.subtest_scores = updates.subtest_scores;
        if (updates.raw_score !== undefined) payload.raw_score = updates.raw_score;
        if (updates.max_score !== undefined) payload.max_score = updates.max_score;
        if (updates.percentage !== undefined) payload.percentage = updates.percentage;
        if (updates.percentile !== undefined) payload.percentile = updates.percentile;
        if (updates.classification !== undefined) payload.classification = updates.classification;
        if (updates.observations !== undefined) payload.observations = updates.observations;
        if (updates.clinician_notes !== undefined) payload.clinician_notes = updates.clinician_notes;
        if (updates.test_date !== undefined) payload.test_date = updates.test_date;

        const { error } = await supabase
            .from('test_results')
            .update(payload)
            .eq('id', resultId);

        if (error) throw error;
    },

    async delete(resultId: string): Promise<void> {
        const { error } = await supabase
            .from('test_results')
            .delete()
            .eq('id', resultId);

        if (error) throw error;
    },

    async getLatestByTest(patientId: string, testId: string): Promise<TestResultRow | null> {
        const { data, error } = await supabase
            .from('test_results')
            .select('*')
            .eq('patient_id', patientId)
            .eq('test_id', testId)
            .order('test_date', { ascending: false })
            .limit(1)
            .single();

        if (error && error.code !== 'PGRST116') throw error;
        return data;
    },

    async getTestNamesForPatient(patientId: string): Promise<string[]> {
        const { data, error } = await supabase
            .from('test_results')
            .select('test_name')
            .eq('patient_id', patientId);

        if (error) throw error;
        const uniqueNames = [...new Set((data || []).map(r => r.test_name))];
        return uniqueNames;
    },
};

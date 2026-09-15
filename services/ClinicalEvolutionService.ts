import {
  ClinicalEvolutionEntry,
  AxisSnapshot,
  ClinicalAxis,
  CLINICAL_AXES
} from '../types/clinical_history';
import { supabase } from '../utils/supabaseClient';

const RISK_WEIGHTS = { normal: 0, bajo: 1, moderado: 2, alto: 3, critico: 4 };

export class ClinicalEvolutionService {
  static async getEvolutionEntries(
    patientId: string,
    limit = 50,
    offset = 0
  ): Promise<ClinicalEvolutionEntry[]> {
    const { data, error } = await supabase
      .from('clinical_evolution_entries')
      .select('*')
      .eq('patient_id', patientId)
      .order('date', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching evolution entries:', error);
      return [];
    }

    return (data || []).map(this.mapToEntry);
  }

  static async getLatestSnapshot(
    patientId: string,
    axis: ClinicalAxis
  ): Promise<AxisSnapshot> {
    const entries = await this.getEvolutionEntriesByAxis(patientId, axis, 10);
    if (entries.length === 0) {
      return this.createEmptySnapshot(patientId, axis);
    }

    const latestRisk = entries[0].riskLevel;
    const trend = this.calculateTrend(entries.map(e => RISK_WEIGHTS[e.riskLevel]));
    const keyFindings = entries
      .slice(0, 3)
      .flatMap(e => e.signs)
      .filter((v, i, a) => a.indexOf(v) === i)
      .slice(0, 5);
    const pendingActions = entries[0].actions || [];

    return {
      patientId,
      axis,
      currentRisk: latestRisk,
      trend: trend as 'improving' | 'stable' | 'worsening' | 'inconsistent',
      keyFindings,
      pendingActions,
      lastUpdated: entries[0].date
    };
  }

  static async addEvolutionEntry(
    entry: Omit<ClinicalEvolutionEntry, 'id' | 'createdAt'>
  ): Promise<ClinicalEvolutionEntry | null> {
    const { data, error } = await supabase
      .from('clinical_evolution_entries')
      .insert({
        patient_id: entry.patientId,
        axis: entry.axis,
        date: entry.date,
        source: entry.source,
        signs: entry.signs,
        measures: entry.measures || {},
        risk_level: entry.riskLevel,
        notes: entry.notes,
        actions: entry.actions || [],
        status: entry.status
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding evolution entry:', error);
      return null;
    }

    return this.mapToEntry(data);
  }

  static async getEvolutionHistory(
    patientId: string,
    axis: ClinicalAxis
  ): Promise<ClinicalEvolutionEntry[]> {
    return this.getEvolutionEntriesByAxis(patientId, axis, 100);
  }

  static async updateEvolutionEntry(
    id: string,
    updates: Partial<ClinicalEvolutionEntry>
  ): Promise<boolean> {
    const { error } = await supabase
      .from('clinical_evolution_entries')
      .update({
        ...(updates.signs && { signs: updates.signs }),
        ...(updates.measures && { measures: updates.measures }),
        ...(updates.riskLevel && { risk_level: updates.riskLevel }),
        ...(updates.notes !== undefined && { notes: updates.notes }),
        ...(updates.actions && { actions: updates.actions }),
        ...(updates.status && { status: updates.status })
      })
      .eq('id', id);

    return !error;
  }

  static async deleteEvolutionEntry(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('clinical_evolution_entries')
      .delete()
      .eq('id', id);

    return !error;
  }

  static getAxisLabel(axis: ClinicalAxis): string {
    const labels: Record<ClinicalAxis, string> = {
      voz: 'Voz',
      lenguaje: 'Lenguaje',
      deglucion: 'Deglución',
      audicion: 'Audición',
      motricidad_orofacial: 'Motricidad Orofacial',
      cognicion: 'Cognición'
    };
    return labels[axis] || axis;
  }

  static getEmptySnapshot(patientId: string, axis: ClinicalAxis): AxisSnapshot {
    return this.createEmptySnapshot(patientId, axis);
  }

  static async getPatientSnapshotSummary(
    patientId: string
  ): Promise<Record<ClinicalAxis, AxisSnapshot>> {
    const result: Partial<Record<ClinicalAxis, AxisSnapshot>> = {};

    for (const axis of CLINICAL_AXES) {
      result[axis] = await this.getLatestSnapshot(patientId, axis);
    }

    return result as Record<ClinicalAxis, AxisSnapshot>;
  }

  private static async getEvolutionEntriesByAxis(
    patientId: string,
    axis: ClinicalAxis,
    limit: number
  ): Promise<ClinicalEvolutionEntry[]> {
    const { data, error } = await supabase
      .from('clinical_evolution_entries')
      .select('*')
      .eq('patient_id', patientId)
      .eq('axis', axis)
      .order('date', { ascending: false })
      .limit(limit);

    if (error) {
      console.error(`Error fetching ${axis} entries:`, error);
      return [];
    }

    return (data || []).map(this.mapToEntry);
  }

  private static calculateTrend(values: number[]): 'improving' | 'stable' | 'worsening' | 'inconsistent' {
    if (values.length < 2) return 'stable';

    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));

    const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    const diff = avgFirst - avgSecond;

    if (diff > 0.5) return 'improving';
    if (diff < -0.5) return 'worsening';

    const allSame = new Set(values).size === 1;
    return allSame ? 'stable' : 'inconsistent';
  }

  private static mapToEntry(data: any): ClinicalEvolutionEntry {
    return {
      id: data.id,
      patientId: data.patient_id,
      axis: data.axis,
      date: data.date,
      source: data.source,
      signs: data.signs || [],
      measures: data.measures || {},
      riskLevel: data.risk_level,
      notes: data.notes || '',
      actions: data.actions || [],
      createdAt: data.created_at,
      status: data.status
    };
  }

  private static createEmptySnapshot(patientId: string, axis: ClinicalAxis): AxisSnapshot {
    return {
      patientId,
      axis,
      currentRisk: 'normal',
      trend: 'stable',
      keyFindings: [],
      pendingActions: [],
      lastUpdated: new Date().toISOString()
    };
  }
}

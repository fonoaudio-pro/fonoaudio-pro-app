import { supabase } from '../utils/supabaseClient';

// ============================================
// TYPES
// ============================================

export interface AnalyticsSummary {
  patients_this_month: number;
  patients_total: number;
  sessions_this_month: number;
  sessions_total: number;
  appointments_today: number;
  appointments_this_week: number;
  appointments_this_month: number;
  histories_approved: number;
  histories_reviewed: number;
  histories_draft: number;
  guides_sent: number;
  guides_total: number;
  tests_total: number;
}

export interface PatientsByConsultorio {
  consultorio_id: string;
  total: number;
  quick_active: number;
  formalized: number;
  discarded: number;
  new_this_month: number;
}

export interface SessionsByProfessional {
  professional_id: string;
  professional_name: string;
  total_sessions: number;
  this_week: number;
  this_month: number;
}

export interface HistoryPipelineItem {
  clinic_id: string;
  status: string;
  total: number;
  this_month: number;
  avg_hours_to_update: number | null;
}

export interface NBAAcceptanceRate {
  total_decisions: number;
  accepted: number;
  rejected: number;
  edited: number;
  acceptance_rate: number | null;
  module_id: string | null;
  category: string | null;
}

export interface AppointmentAttendance {
  professional_id: string;
  total: number;
  attended: number;
  cancelled: number;
  pending: number;
  attendance_rate: number | null;
}

export interface AIUsageByField {
  user_id: string;
  user_name: string;
  total_ai_interactions: number;
  clinic_id: string;
}

export interface TestsByArea {
  area: string;
  total: number;
  avg_percentage: number | null;
  this_month: number;
}

export interface HomeGuideDelivery {
  status: string;
  delivery_method: string | null;
  total: number;
  this_month: number;
}

export interface DistributionStat {
  medium: string;
  status: string;
  total: number;
  this_month: number;
}

export interface RecentActivity {
  event_type: string;
  description: string;
  created_at: string;
}

export interface DashboardData {
  summary: AnalyticsSummary | null;
  patientsByConsultorio: PatientsByConsultorio[];
  sessionsByProfessional: SessionsByProfessional[];
  historyPipeline: HistoryPipelineItem[];
  nbaAcceptance: NBAAcceptanceRate[];
  appointmentAttendance: AppointmentAttendance[];
  aiUsage: AIUsageByField[];
  testsByArea: TestsByArea[];
  homeGuideDelivery: HomeGuideDelivery[];
  distributionStats: DistributionStat[];
  recentActivity: RecentActivity[];
}

// ============================================
// SERVICE
// ============================================

export const AnalyticsDashboardService = {
  async getSummary(): Promise<AnalyticsSummary | null> {
    const { data, error } = await supabase
      .from('v_analytics_summary')
      .select('*')
      .single();
    if (error) { console.error('[Analytics] Summary error:', error); return null; }
    return data;
  },

  async getPatientsByConsultorio(): Promise<PatientsByConsultorio[]> {
    const { data, error } = await supabase
      .from('v_patients_by_consultorio')
      .select('*')
      .order('total', { ascending: false });
    if (error) { console.error('[Analytics] Patients by consultorio error:', error); return []; }
    return data || [];
  },

  async getSessionsByProfessional(): Promise<SessionsByProfessional[]> {
    const { data, error } = await supabase
      .from('v_sessions_by_professional')
      .select('*');
    if (error) { console.error('[Analytics] Sessions by professional error:', error); return []; }
    return data || [];
  },

  async getHistoryPipeline(clinicId?: string): Promise<HistoryPipelineItem[]> {
    let query = supabase.from('v_history_pipeline').select('*');
    if (clinicId) query = query.eq('clinic_id', clinicId);
    const { data, error } = await query;
    if (error) { console.error('[Analytics] History pipeline error:', error); return []; }
    return data || [];
  },

  async getNBAAcceptance(): Promise<NBAAcceptanceRate[]> {
    const { data, error } = await supabase
      .from('v_nba_acceptance_rates')
      .select('*');
    if (error) { console.error('[Analytics] NBA acceptance error:', error); return []; }
    return data || [];
  },

  async getAppointmentAttendance(): Promise<AppointmentAttendance[]> {
    const { data, error } = await supabase
      .from('v_appointment_attendance')
      .select('*');
    if (error) { console.error('[Analytics] Appointment attendance error:', error); return []; }
    return data || [];
  },

  async getAIUsage(): Promise<AIUsageByField[]> {
    const { data, error } = await supabase
      .from('v_ai_usage_by_field')
      .select('*');
    if (error) { console.error('[Analytics] AI usage error:', error); return []; }
    return data || [];
  },

  async getTestsByArea(): Promise<TestsByArea[]> {
    const { data, error } = await supabase
      .from('v_tests_by_area')
      .select('*');
    if (error) { console.error('[Analytics] Tests by area error:', error); return []; }
    return data || [];
  },

  async getHomeGuideDelivery(): Promise<HomeGuideDelivery[]> {
    const { data, error } = await supabase
      .from('v_home_guide_delivery')
      .select('*');
    if (error) { console.error('[Analytics] Home guide delivery error:', error); return []; }
    return data || [];
  },

  async getDistributionStats(): Promise<DistributionStat[]> {
    const { data, error } = await supabase
      .from('v_distribution_stats')
      .select('*');
    if (error) { console.error('[Analytics] Distribution stats error:', error); return []; }
    return data || [];
  },

  async getRecentActivity(): Promise<RecentActivity[]> {
    const { data, error } = await supabase
      .from('v_recent_activity')
      .select('*')
      .limit(20);
    if (error) { console.error('[Analytics] Recent activity error:', error); return []; }
    return data || [];
  },

  async getAll(clinicId?: string): Promise<DashboardData> {
    const [summary, patientsByConsultorio, sessionsByProfessional, historyPipeline, nbaAcceptance, appointmentAttendance, aiUsage, testsByArea, homeGuideDelivery, distributionStats, recentActivity] = await Promise.all([
      this.getSummary(),
      this.getPatientsByConsultorio(),
      this.getSessionsByProfessional(),
      this.getHistoryPipeline(clinicId),
      this.getNBAAcceptance(),
      this.getAppointmentAttendance(),
      this.getAIUsage(),
      this.getTestsByArea(),
      this.getHomeGuideDelivery(),
      this.getDistributionStats(),
      this.getRecentActivity(),
    ]);
    return { summary, patientsByConsultorio, sessionsByProfessional, historyPipeline, nbaAcceptance, appointmentAttendance, aiUsage, testsByArea, homeGuideDelivery, distributionStats, recentActivity };
  },
};

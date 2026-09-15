import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../utils/supabaseClient';
import { Patient } from '../types';
import { Appointment } from '../types/appointment';

const STALE_TIME = 30_000;

// ─── Queries (single source of truth for server data) ───

export function usePatientsQuery() {
  return useQuery({
    queryKey: ['patients'],
    queryFn: async () => {
      const { data, error } = await supabase.from('patients').select('*').order('name');
      if (error) throw error;
      return (data || []).filter(Boolean) as Patient[];
    },
    staleTime: STALE_TIME,
  });
}

export function useAppointmentsQuery() {
  return useQuery({
    queryKey: ['appointments'],
    queryFn: async () => {
      const { data, error } = await supabase.from('appointments').select('*').order('date');
      if (error) throw error;
      return (data || []) as Appointment[];
    },
    staleTime: STALE_TIME,
  });
}

export function useMaterialsQuery() {
  return useQuery({
    queryKey: ['materials'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('materials')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
    staleTime: STALE_TIME,
  });
}

// ─── Patient Mutations ───

async function syncPatientToBackend(patientData: any) {
  try {
    const res = await fetch('/api/clinical/patient-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patientData)
    });
    const data = await res.json();
    if (!res.ok || data.status !== 'ok') {
      throw new Error(data.error || 'Error en sincronización backend');
    }
  } catch (e) {
    console.error('[Patient Backend Sync Fallback Failed]:', e);
  }
}

export function usePatientMutations(userId: string | undefined) {
  const queryClient = useQueryClient();

  const handleCreatePatient = useMutation({
    mutationFn: async (newP: Patient) => {
      const patientPayload = {
        id: newP.id,
        name: newP.name,
        age: newP.age,
        diagnosis: newP.diagnosis,
        phone: newP.phone || '',
        document: newP.document || '',
        email: newP.email || '',
        notes: newP.notes || '',
        treatmentPlan: newP.treatmentPlan || { general: '', specific: [], strategies: '' },
        history: newP.history || [],
        evaluations: newP.evaluations || [],
        documents: newP.documents || [],
        reports: newP.reports || [],
        consultorio: newP.consultorio || null,
        consultorio_id: newP.consultorio || null,
        quick_status: newP.quick_status || null,
        owner_id: userId || null,
      };
      const { error } = await supabase.from('patients').insert([patientPayload]);
      if (error) {
        // Fallback to backend sync bypassing RLS
        await syncPatientToBackend(patientPayload);
      }
      return newP;
    },
    onMutate: async (newP) => {
      await queryClient.cancelQueries({ queryKey: ['patients'] });
      const prev = queryClient.getQueryData<Patient[]>(['patients']) || [];
      queryClient.setQueryData<Patient[]>(['patients'], [...prev, newP]);
      return { prev };
    },
    onError: (_err, _newP, context) => {
      if (context?.prev) queryClient.setQueryData(['patients'], context.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
  });

  const handleDeletePatient = useMutation({
    mutationFn: async (patientId: string) => {
      const { error } = await supabase.from('patients').delete().eq('id', patientId);
      if (error) throw error;
      return patientId;
    },
    onMutate: async (patientId) => {
      await queryClient.cancelQueries({ queryKey: ['patients'] });
      const prev = queryClient.getQueryData<Patient[]>(['patients']) || [];
      queryClient.setQueryData<Patient[]>(['patients'], prev.filter(p => p.id !== patientId));
      return { prev };
    },
    onError: (_err, _patientId, context) => {
      if (context?.prev) queryClient.setQueryData(['patients'], context.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
  });

  const handleFormalizeQuickPatient = useMutation({
    mutationFn: async ({ patientId, completedFields }: { patientId: string; completedFields: Partial<Patient> }) => {
      const { error } = await supabase.from('patients').update({
        quick_status: 'formalized',
        document: completedFields.document || '',
        phone: completedFields.phone || '',
        email: completedFields.email || '',
        obra_social: completedFields.obra_social || null,
        responsable: completedFields.responsable || null,
        derivante: completedFields.derivante || null,
        updated_at: new Date().toISOString(),
      }).eq('id', patientId);
      if (error) throw error;
      return patientId;
    },
    onMutate: async ({ patientId, completedFields }) => {
      await queryClient.cancelQueries({ queryKey: ['patients'] });
      const prev = queryClient.getQueryData<Patient[]>(['patients']) || [];
      queryClient.setQueryData<Patient[]>(['patients'], prev.map(p =>
        p.id === patientId ? { ...p, ...completedFields, quick_status: 'formalized' as const } : p
      ));
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(['patients'], context.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
  });

  const handleDiscardQuickPatient = useMutation({
    mutationFn: async (patientId: string) => {
      const { error } = await supabase.from('patients').update({
        quick_status: 'discarded',
        updated_at: new Date().toISOString(),
      }).eq('id', patientId);
      if (error) throw error;
      return patientId;
    },
    onMutate: async (patientId) => {
      await queryClient.cancelQueries({ queryKey: ['patients'] });
      const prev = queryClient.getQueryData<Patient[]>(['patients']) || [];
      queryClient.setQueryData<Patient[]>(['patients'], prev.filter(p => p.id !== patientId));
      return { prev };
    },
    onError: (_err, _patientId, context) => {
      if (context?.prev) queryClient.setQueryData(['patients'], context.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
  });

  const handleSessionComplete = useMutation({
    mutationFn: async ({ patientId, session }: { patientId: string; session: any }) => {
      const patient = queryClient.getQueryData<Patient[]>(['patients'])?.find(p => p.id === patientId);
      if (!patient) throw new Error('Patient not found');
      const updatedHistory = [...(patient.history || []), session];
      const { error } = await supabase.from('patients').update({ history: updatedHistory }).eq('id', patientId);
      if (error) throw error;
      return { patientId, session };
    },
    onMutate: async ({ patientId, session }) => {
      await queryClient.cancelQueries({ queryKey: ['patients'] });
      const prev = queryClient.getQueryData<Patient[]>(['patients']) || [];
      queryClient.setQueryData<Patient[]>(['patients'], prev.map(p =>
        p.id === patientId ? { ...p, history: [...(p.history || []), session] } : p
      ));
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(['patients'], context.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
  });

  const updatePatientField = useMutation({
    mutationFn: async ({ patientId, field, value }: { patientId: string; field: string; value: any }) => {
      const { error } = await supabase.from('patients').update({ [field]: value }).eq('id', patientId);
      if (error) {
        // Fetch current patient and sync via backend endpoint
        const current = queryClient.getQueryData<Patient[]>(['patients'])?.find(p => p.id === patientId);
        if (current) {
          await syncPatientToBackend({ ...current, [field]: value });
        }
      }
      return { patientId, field, value };
    },
    onMutate: async ({ patientId, field, value }) => {
      await queryClient.cancelQueries({ queryKey: ['patients'] });
      const prev = queryClient.getQueryData<Patient[]>(['patients']) || [];
      queryClient.setQueryData<Patient[]>(['patients'], prev.map(p =>
        p.id === patientId ? { ...p, [field]: value } : p
      ));
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(['patients'], context.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
  });

  return {
    handleCreatePatient: handleCreatePatient.mutateAsync,
    handleDeletePatient: handleDeletePatient.mutateAsync,
    handleFormalizeQuickPatient: handleFormalizeQuickPatient.mutateAsync,
    handleDiscardQuickPatient: handleDiscardQuickPatient.mutateAsync,
    handleSessionComplete: handleSessionComplete.mutateAsync,
    updatePatientField: updatePatientField.mutateAsync,
  };
}

// ─── Appointment Mutations ───

export function useAppointmentMutations() {
  const queryClient = useQueryClient();

  const handleCreateAppointment = useMutation({
    mutationFn: async (appt: {
      patient_id: string;
      patient_name: string;
      date: string;
      time: string;
      status?: string;
      type?: string;
      professional_id?: string;
      notes?: string;
      duration?: number;
      start_time?: string;
      end_time?: string;
    }) => {
      const payload = {
        id: crypto.randomUUID(),
        patient_id: appt.patient_id,
        patient_name: appt.patient_name,
        date: appt.date,
        time: appt.time,
        status: appt.status || 'pending',
        type: appt.type || 'Consulta',
        professional_id: appt.professional_id || null,
        notes: appt.notes || '',
        duration: appt.duration || null,
        start_time: appt.start_time || null,
        end_time: appt.end_time || null,
      };
      const { data, error } = await supabase.from('appointments').insert([payload]).select().single();
      if (error) throw error;
      return data as Appointment;
    },
    onMutate: async (appt) => {
      await queryClient.cancelQueries({ queryKey: ['appointments'] });
      const prev = queryClient.getQueryData<Appointment[]>(['appointments']) || [];
      const optimistic: Appointment = {
        id: crypto.randomUUID(),
        patient_id: appt.patient_id,
        patient_name: appt.patient_name,
        date: appt.date,
        time: appt.time,
        status: (appt.status || 'pending') as any,
        type: appt.type || 'Consulta',
        professional_id: appt.professional_id || undefined,
        notes: appt.notes || '',
      };
      queryClient.setQueryData<Appointment[]>(['appointments'], [...prev, optimistic]);
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(['appointments'], context.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });

  const handleUpdateStatus = useMutation({
    mutationFn: async ({ appId, newStatus }: { appId: string; newStatus: string }) => {
      const { error } = await supabase.from('appointments').update({ status: newStatus }).eq('id', appId);
      if (error) throw error;
      return { appId, newStatus };
    },
    onMutate: async ({ appId, newStatus }) => {
      await queryClient.cancelQueries({ queryKey: ['appointments'] });
      const prev = queryClient.getQueryData<Appointment[]>(['appointments']) || [];
      queryClient.setQueryData<Appointment[]>(['appointments'], prev.map(a =>
        a.id === appId ? { ...a, status: newStatus as any } : a
      ));
      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) queryClient.setQueryData(['appointments'], context.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });

  return {
    handleCreateAppointment: handleCreateAppointment.mutateAsync,
    handleUpdateStatus: handleUpdateStatus.mutateAsync,
  };
}

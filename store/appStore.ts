import { create } from 'zustand';
import { ViewType } from '../types';

interface AppState {
  // Navigation
  currentView: ViewType;
  setCurrentView: (v: ViewType) => void;

  // Selected patient ID (derived from React Query data)
  selectedPatientId: string | null;
  setSelectedPatientId: (id: string | null) => void;

  // Assistant
  isAssistantOpen: boolean;
  setIsAssistantOpen: (v: boolean) => void;

  // Modals
  showNewPatientModal: boolean;
  setShowNewPatientModal: (v: boolean) => void;
  showPatientSelector: boolean;
  setShowPatientSelector: (v: boolean) => void;
  showConsultorioConfig: boolean;
  setShowConsultorioConfig: (v: boolean) => void;
  showTemplateManager: boolean;
  setShowTemplateManager: (v: boolean) => void;
  showQuickMode: boolean;
  setShowQuickMode: (v: boolean) => void;

  // Consultorio
  selectedConsultorio: string | null;
  setSelectedConsultorio: (v: string | null) => void;
  consultorioConfigVersion: number;
  setConsultorioConfigVersion: (v: number | ((prev: number) => number)) => void;

  // Editor states
  editingMaterialId: string | null;
  setEditingMaterialId: (v: string | null) => void;
  isEditingPlan: boolean;
  setIsEditingPlan: (v: boolean) => void;
  editedPlan: string;
  setEditedPlan: (v: string | ((prev: string) => string)) => void;
  showReportEditor: boolean;
  setShowReportEditor: (v: boolean) => void;
  reportGuideId: string;
  setReportGuideId: (v: string) => void;
  newReportContent: string;
  setNewReportContent: (v: string | ((prev: string) => string)) => void;
  newReportType: string;
  setNewReportType: (v: string) => void;

  // Pending patient (for deferred actions)
  pendingPatientId: string | null;
  setPendingPatientId: (id: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentView: 'dashboard',
  setCurrentView: (v) => set({ currentView: v }),

  selectedPatientId: null,
  setSelectedPatientId: (id) => set({ selectedPatientId: id }),

  isAssistantOpen: false,
  setIsAssistantOpen: (v) => set({ isAssistantOpen: v }),

  showNewPatientModal: false,
  setShowNewPatientModal: (v) => set({ showNewPatientModal: v }),
  showPatientSelector: false,
  setShowPatientSelector: (v) => set({ showPatientSelector: v }),
  showConsultorioConfig: false,
  setShowConsultorioConfig: (v) => set({ showConsultorioConfig: v }),
  showTemplateManager: false,
  setShowTemplateManager: (v) => set({ showTemplateManager: v }),
  showQuickMode: false,
  setShowQuickMode: (v) => set({ showQuickMode: v }),

  selectedConsultorio: null,
  setSelectedConsultorio: (v) => set({ selectedConsultorio: v }),
  consultorioConfigVersion: 0,
  setConsultorioConfigVersion: (v) => set((state) => ({
    consultorioConfigVersion: typeof v === 'function' ? v(state.consultorioConfigVersion) : v,
  })),

  editingMaterialId: null,
  setEditingMaterialId: (v) => set({ editingMaterialId: v }),
  isEditingPlan: false,
  setIsEditingPlan: (v) => set({ isEditingPlan: v }),
  editedPlan: '',
  setEditedPlan: (v) => set((state) => ({
    editedPlan: typeof v === 'function' ? v(state.editedPlan) : v,
  })),
  showReportEditor: false,
  setShowReportEditor: (v) => set({ showReportEditor: v }),
  reportGuideId: 'valoracion',
  setReportGuideId: (v) => set({ reportGuideId: v }),
  newReportContent: '',
  setNewReportContent: (v) => set((state) => ({
    newReportContent: typeof v === 'function' ? v(state.newReportContent) : v,
  })),
  newReportType: 'evaluacion',
  setNewReportType: (v) => set({ newReportType: v }),

  pendingPatientId: null,
  setPendingPatientId: (id) => set({ pendingPatientId: id }),
}));

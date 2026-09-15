import { useCallback, useMemo } from "react";
import { ViewType } from "../types";
import { useAppStore } from "../store/appStore";
import { usePatientsQuery } from "./useSupabaseQueries";

interface UseShellUIOptions {
  addToast: (toast: { message: string; type: "success" | "error" | "info" }) => void;
}

interface UseShellUIResult {
  currentView: ViewType;
  setCurrentView: (v: ViewType) => void;
  selectedConsultorio: string | null;
  setSelectedConsultorio: (v: string | null) => void;
  consultorioConfigVersion: number;
  setConsultorioConfigVersion: (v: number | ((prev: number) => number)) => void;
  pendingPatientId: string | null;
  setPendingPatientId: (id: string | null) => void;
  isAssistantOpen: boolean;
  setIsAssistantOpen: (v: boolean) => void;
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
  editingMaterialId: string | null;
  setEditingMaterialId: (v: string | null) => void;
  isEditingPlan: boolean;
  setIsEditingPlan: (v: boolean) => void;
  editedPlan: string;
  setEditedPlan: (v: string | ((prev: string) => string)) => void;
  showReportEditor: boolean;
  setShowReportEditor: (v: boolean) => void;
  newReportContent: string;
  setNewReportContent: (v: string | ((prev: string) => string)) => void;
  newReportType: string;
  setNewReportType: (v: string) => void;
  handleStartReport: (type: string) => void;
  handleSaveReport: () => void;
}

export function useShellUI({ addToast }: UseShellUIOptions): UseShellUIResult {
  // React Query — derived selectedPatient
  const selectedPatientId = useAppStore(s => s.selectedPatientId);
  const { data: patients = [] } = usePatientsQuery();
  const selectedPatient = useMemo(
    () => patients.find(p => p.id === selectedPatientId) || null,
    [patients, selectedPatientId]
  );

  // Zustand — all UI state
  const currentView = useAppStore(s => s.currentView);
  const setCurrentView = useAppStore(s => s.setCurrentView);
  const selectedConsultorio = useAppStore(s => s.selectedConsultorio);
  const setSelectedConsultorio = useAppStore(s => s.setSelectedConsultorio);
  const consultorioConfigVersion = useAppStore(s => s.consultorioConfigVersion);
  const setConsultorioConfigVersion = useAppStore(s => s.setConsultorioConfigVersion);
  const pendingPatientId = useAppStore(s => s.pendingPatientId);
  const setPendingPatientId = useAppStore(s => s.setPendingPatientId);
  const isAssistantOpen = useAppStore(s => s.isAssistantOpen);
  const setIsAssistantOpen = useAppStore(s => s.setIsAssistantOpen);
  const showNewPatientModal = useAppStore(s => s.showNewPatientModal);
  const setShowNewPatientModal = useAppStore(s => s.setShowNewPatientModal);
  const showPatientSelector = useAppStore(s => s.showPatientSelector);
  const setShowPatientSelector = useAppStore(s => s.setShowPatientSelector);
  const showConsultorioConfig = useAppStore(s => s.showConsultorioConfig);
  const setShowConsultorioConfig = useAppStore(s => s.setShowConsultorioConfig);
  const showTemplateManager = useAppStore(s => s.showTemplateManager);
  const setShowTemplateManager = useAppStore(s => s.setShowTemplateManager);
  const showQuickMode = useAppStore(s => s.showQuickMode);
  const setShowQuickMode = useAppStore(s => s.setShowQuickMode);
  const editingMaterialId = useAppStore(s => s.editingMaterialId);
  const setEditingMaterialId = useAppStore(s => s.setEditingMaterialId);
  const isEditingPlan = useAppStore(s => s.isEditingPlan);
  const setIsEditingPlan = useAppStore(s => s.setIsEditingPlan);
  const editedPlan = useAppStore(s => s.editedPlan);
  const setEditedPlan = useAppStore(s => s.setEditedPlan);
  const showReportEditor = useAppStore(s => s.showReportEditor);
  const setShowReportEditor = useAppStore(s => s.setShowReportEditor);
  const reportGuideId = useAppStore(s => s.reportGuideId);
  const setReportGuideId = useAppStore(s => s.setReportGuideId);
  const newReportContent = useAppStore(s => s.newReportContent);
  const setNewReportContent = useAppStore(s => s.setNewReportContent);
  const newReportType = useAppStore(s => s.newReportType);
  const setNewReportType = useAppStore(s => s.setNewReportType);
  const setSelectedPatientId = useAppStore(s => s.setSelectedPatientId);

  const handleStartReport = useCallback((type: string) => {
    // Map report type names to guide IDs
    const typeMap: Record<string, string> = {
      'evaluacion': 'valoracion',
      'seguimiento': 'seguimiento',
      'proceso': 'proceso',
      'alta': 'alta',
      'derivacion': 'derivacion',
      'interconsulta': 'interconsulta',
    };
    const guideId = typeMap[type] || type || 'valoracion';
    setReportGuideId(guideId);
    if (selectedPatient) {
      setShowReportEditor(true);
    } else {
      setNewReportType(type);
      setShowPatientSelector(true);
    }
  }, [selectedPatient, setReportGuideId]);

  const handleSaveReport = useCallback(() => {
    if (!selectedPatient) return;
    setShowReportEditor(false);
    addToast({ message: "Informe guardado correctamente.", type: "success" });
  }, [selectedPatient, addToast]);

  return {
    currentView, setCurrentView,
    selectedConsultorio, setSelectedConsultorio,
    consultorioConfigVersion, setConsultorioConfigVersion,
    pendingPatientId, setPendingPatientId,
    isAssistantOpen, setIsAssistantOpen,
    showNewPatientModal, setShowNewPatientModal,
    showPatientSelector, setShowPatientSelector,
    showConsultorioConfig, setShowConsultorioConfig,
    showTemplateManager, setShowTemplateManager,
    showQuickMode, setShowQuickMode,
    editingMaterialId, setEditingMaterialId,
    isEditingPlan, setIsEditingPlan,
    editedPlan, setEditedPlan,
    showReportEditor, setShowReportEditor,
    reportGuideId, setReportGuideId,
    newReportContent, setNewReportContent,
    newReportType, setNewReportType,
    setSelectedPatientId,
    handleStartReport, handleSaveReport,
  };
}

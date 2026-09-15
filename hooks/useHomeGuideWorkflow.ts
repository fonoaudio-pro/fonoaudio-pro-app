import { useState, useMemo } from "react";
import { SessionService } from "../services/SessionService";
import { useAppStore } from "../store/appStore";
import { usePatientsQuery, usePatientMutations } from "./useSupabaseQueries";

interface HomeGuide {
  [key: string]: any;
}

export interface HomeGuideWorkflowState {
  showHomeGuideEditor: boolean;
  showHomeGuidePreview: boolean;
  currentHomeGuideDraft: HomeGuide | null;
  handleGenerateHomeGuideDraft: (patient: any) => Promise<void>;
  handleSaveHomeGuide: (updatedGuide: HomeGuide) => Promise<void>;
  handleShowHomeGuidePreview: (guide: HomeGuide) => void;
  closeHomeGuideEditor: () => void;
  closeHomeGuidePreview: () => void;
}

interface UseHomeGuideWorkflowOptions {
  addToast: (toast: { message: string; type: string }) => void;
}

export function useHomeGuideWorkflow({
  addToast,
}: UseHomeGuideWorkflowOptions): HomeGuideWorkflowState {
  const selectedPatientId = useAppStore(s => s.selectedPatientId);
  const { data: patients = [] } = usePatientsQuery();
  const { updatePatientField } = usePatientMutations(undefined);

  const selectedPatient = useMemo(
    () => patients.find(p => p.id === selectedPatientId) || null,
    [patients, selectedPatientId]
  );

  const [showHomeGuideEditor, setShowHomeGuideEditor] = useState(false);
  const [showHomeGuidePreview, setShowHomeGuidePreview] = useState(false);
  const [currentHomeGuideDraft, setCurrentHomeGuideDraft] = useState<HomeGuide | null>(null);

  const handleGenerateHomeGuideDraft = async (patient: any) => {
    if (patient.homeGuide) {
      const choice = window.confirm(
        "¿Deseas continuar editando la guía actual o prefieres generar una nueva basada en la última sesión?"
      );
      if (choice) {
        setCurrentHomeGuideDraft(patient.homeGuide);
        setShowHomeGuideEditor(true);
        return;
      }
    }

    try {
      const draft = await SessionService.generateHomeGuideDraft(patient);
      setCurrentHomeGuideDraft(draft);
      setShowHomeGuideEditor(true);
    } catch (error) {
      console.error("Error generating home guide draft:", error);
      addToast({ message: "Error al generar el borrador de la guía.", type: "error" });
    }
  };

  const handleSaveHomeGuide = async (updatedGuide: HomeGuide) => {
    if (!selectedPatient) return;
    try {
      await SessionService.saveHomeGuide(selectedPatient, updatedGuide);
      await updatePatientField({ patientId: selectedPatient.id, field: 'homeGuide', value: updatedGuide });
      setShowHomeGuideEditor(false);
    } catch (error) {
      console.error("Error saving home guide:", error);
      addToast({ message: "Error al guardar la guía.", type: "error" });
    }
  };

  const handleShowHomeGuidePreview = (guide: HomeGuide) => {
    setCurrentHomeGuideDraft(guide);
    setShowHomeGuidePreview(true);
  };

  const closeHomeGuideEditor = () => setShowHomeGuideEditor(false);
  const closeHomeGuidePreview = () => setShowHomeGuidePreview(false);

  return {
    showHomeGuideEditor,
    showHomeGuidePreview,
    currentHomeGuideDraft,
    handleGenerateHomeGuideDraft,
    handleSaveHomeGuide,
    handleShowHomeGuidePreview,
    closeHomeGuideEditor,
    closeHomeGuidePreview,
  };
}

import { Patient, Appointment, ViewType } from "../types";

/**
 * Read-only state exposed to GlobalAssistant.
 * Values are accessed via refs for stale-closure safety in tool callbacks.
 */
export interface AssistantState {
  patients: Patient[];
  appointments: Appointment[];
  selectedPatient: Patient | null;
  isEditingPlan: boolean;
  showReportEditor: boolean;
}

/**
 * Write-only actions exposed to GlobalAssistant.
 * Setters for UI state + domain handlers for mutations.
 */
export interface AssistantActions {
  setCurrentView: (v: ViewType) => void;
  setSelectedPatient: (p: Patient | null) => void;
  setPatients: React.Dispatch<React.SetStateAction<Patient[]>>;
  setAppointments: React.Dispatch<React.SetStateAction<Appointment[]>>;
  setEditedPlan: React.Dispatch<React.SetStateAction<string>>;
  setIsEditingPlan: (v: boolean) => void;
  setNewReportType: (v: string) => void;
  setNewReportContent: React.Dispatch<React.SetStateAction<string>>;
  setShowReportEditor: (v: boolean) => void;
  handleCreatePatient: (p: Patient) => Promise<void>;
  handleUpdateStatus: (id: string, status: "pending" | "completed" | "cancelled") => Promise<void>;
}

/**
 * Combined context consumed by GlobalAssistant.
 * Replaces the raw stateRefs + actions prop pattern.
 */
export interface AssistantContextValue extends AssistantState, AssistantActions {}

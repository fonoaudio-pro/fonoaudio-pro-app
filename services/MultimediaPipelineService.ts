import {
  MaterialRequest,
  GeneratedMaterial,
  PipelineLogEntry,
  MaterialType,
  MaterialStatus,
  MaterialSource,
} from '../types/multimedia';

const REQUESTS_KEY = 'fonoaudio_material_requests';
const MATERIALS_KEY = 'fonoaudio_generated_materials';
const PIPELINE_LOG_KEY = 'fonoaudio_pipeline_log';
const MAX_LOG_ENTRIES = 500;

export class MultimediaPipelineService {
  static async requestMaterial(params: {
    patientId: string;
    patientName: string;
    materialType: MaterialType;
    clinicalGoal: string;
    prompt: string;
    source: MaterialSource;
    sourceReference?: string;
    userId: string;
    userName: string;
  }): Promise<MaterialRequest> {
    const request: MaterialRequest = {
      id: crypto.randomUUID(),
      patient_id: params.patientId,
      patient_name: params.patientName,
      material_type: params.materialType,
      clinical_goal: params.clinicalGoal,
      prompt: params.prompt,
      source: params.source,
      source_reference: params.sourceReference,
      requested_by: params.userId,
      requested_by_name: params.userName,
      timestamp: new Date().toISOString(),
      status: 'pending',
    };

    const requests = this.getAllRequests();
    requests.unshift(request);
    localStorage.setItem(REQUESTS_KEY, JSON.stringify(requests));

    this.addLogEntry({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      action: 'request',
      material_id: request.id,
      material_type: params.materialType,
      patient_id: params.patientId,
      patient_name: params.patientName,
      user_id: params.userId,
      user_name: params.userName,
      status: 'pending',
      details: params.clinicalGoal,
    });

    console.log('[MultimediaPipeline] STUB: Material requested', {
      type: params.materialType,
      patient: params.patientName,
      goal: params.clinicalGoal,
    });

    return request;
  }

  static async generateMaterial(requestId: string): Promise<GeneratedMaterial | null> {
    const requests = this.getAllRequests();
    const request = requests.find(r => r.id === requestId);
    if (!request) return null;

    request.status = 'failed';
    localStorage.setItem(REQUESTS_KEY, JSON.stringify(requests));

    console.warn('[MultimediaPipeline] Generación de material no disponible en producción. Conectá un servicio de generación de imágenes (ej. ComfyUI, DALL-E) para habilitar esta función.');

    this.addLogEntry({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      action: 'generate_failed',
      material_type: request.material_type,
      patient_id: request.patient_id,
      patient_name: request.patient_name,
      user_id: request.requested_by,
      user_name: request.requested_by_name,
      status: 'failed',
    });

    return null;
  }
    });

    return material;
  }

  static async approveMaterial(materialId: string, userId: string, userName: string): Promise<boolean> {
    const materials = this.getAllMaterials();
    const material = materials.find(m => m.id === materialId);
    if (!material) return false;

    material.status = 'approved';
    material.approved_by = userId;
    material.approved_by_name = userName;
    material.approved_at = new Date().toISOString();
    localStorage.setItem(MATERIALS_KEY, JSON.stringify(materials));

    this.addLogEntry({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      action: 'approve',
      material_id: materialId,
      material_type: material.material_type,
      patient_id: material.patient_id,
      patient_name: material.patient_name,
      user_id: userId,
      user_name: userName,
      status: 'approved',
    });

    console.log('[MultimediaPipeline] Material approved', { id: materialId, title: material.title });
    return true;
  }

  static async rejectMaterial(materialId: string, userId: string, userName: string, reason: string): Promise<boolean> {
    const materials = this.getAllMaterials();
    const material = materials.find(m => m.id === materialId);
    if (!material) return false;

    material.status = 'rejected';
    material.rejected_by = userId;
    material.rejected_by_name = userName;
    material.rejected_at = new Date().toISOString();
    material.rejection_reason = reason;
    localStorage.setItem(MATERIALS_KEY, JSON.stringify(materials));

    this.addLogEntry({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      action: 'reject',
      material_id: materialId,
      material_type: material.material_type,
      patient_id: material.patient_id,
      patient_name: material.patient_name,
      user_id: userId,
      user_name: userName,
      status: 'rejected',
      details: reason,
    });

    console.log('[MultimediaPipeline] Material rejected', { id: materialId, reason });
    return true;
  }

  static getAllRequests(): MaterialRequest[] {
    try {
      const raw = localStorage.getItem(REQUESTS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  static getRequestsForPatient(patientId: string): MaterialRequest[] {
    return this.getAllRequests().filter(r => r.patient_id === patientId);
  }

  static getPendingRequests(): MaterialRequest[] {
    return this.getAllRequests().filter(r => r.status === 'pending');
  }

  static getAllMaterials(): GeneratedMaterial[] {
    try {
      const raw = localStorage.getItem(MATERIALS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  static getMaterialsForPatient(patientId: string): GeneratedMaterial[] {
    return this.getAllMaterials().filter(m => m.patient_id === patientId);
  }

  static getApprovedMaterials(): GeneratedMaterial[] {
    return this.getAllMaterials().filter(m => m.status === 'approved');
  }

  static getPendingMaterials(): GeneratedMaterial[] {
    return this.getAllMaterials().filter(m => m.status === 'ready');
  }

  static getLog(): PipelineLogEntry[] {
    try {
      const raw = localStorage.getItem(PIPELINE_LOG_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  static getLogForPatient(patientId: string): PipelineLogEntry[] {
    return this.getLog().filter(e => e.patient_id === patientId);
  }

  static clearLog(): void {
    localStorage.removeItem(PIPELINE_LOG_KEY);
  }

  private static addLogEntry(entry: PipelineLogEntry): void {
    const log = this.getLog();
    log.unshift(entry);
    localStorage.setItem(PIPELINE_LOG_KEY, JSON.stringify(log.slice(0, MAX_LOG_ENTRIES)));
  }
}

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

const MOCK_IMAGES: Record<MaterialType, { url: string; title: string; description: string }[]> = {
  home_guide: [
    { url: 'https://api.arasaac.org/api/pictograms/5269', title: 'Guía de estimulación del lenguaje en casa', description: 'Actividades diarias para estimular el lenguaje expresivo del niño.' },
    { url: 'https://api.arasaac.org/api/pictograms/5270', title: 'Rutina de comunicación familiar', description: 'Estructura de interacción familiar para mejorar la comunicación.' },
  ],
  pecs_sequence: [
    { url: 'https://api.arasaac.org/api/pictograms/5271', title: 'Secuencia PECS: Pedir alimento', description: 'Pasos para el intercambio visual de petición de alimento.' },
    { url: 'https://api.arasaac.org/api/pictograms/5272', title: 'Secuencia PECS: Petición de ayuda', description: 'Secuencia de 4 pasos para solicitar ayuda con imagen.' },
  ],
  therapy_sequence: [
    { url: 'https://api.arasaac.org/api/pictograms/5273', title: 'Secuencia de higiene bucal', description: 'Pasos para la rutina de higiene bucal con apoyo visual.' },
    { url: 'https://api.arasaac.org/api/pictograms/5274', title: 'Secuencia de alimentación', description: 'Pasos para la rutina de alimentación con apoyo visual.' },
  ],
  vocabulary_cards: [
    { url: 'https://api.arasaac.org/api/pictograms/5275', title: 'Tarjetas: Partes del cuerpo', description: 'Set de tarjetas con vocabulario de partes del cuerpo.' },
    { url: 'https://api.arasaac.org/api/pictograms/5276', title: 'Tarjetas: Alimentos', description: 'Set de tarjetas con vocabulario de alimentos.' },
  ],
  visual_resource: [
    { url: 'https://api.arasaac.org/api/pictograms/5277', title: 'Tablero de comunicación', description: 'Tablero de comunicación con pictogramas básicos.' },
    { url: 'https://api.arasaac.org/api/pictograms/5278', title: 'Semáforo de emociones', description: 'Recurso visual para identificar estados emocionales.' },
  ],
  custom: [
    { url: 'https://api.arasaac.org/api/pictograms/5279', title: 'Material personalizado', description: 'Material generado según necesidad específica del paciente.' },
  ],
};

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

    // Update request status
    request.status = 'generating';
    localStorage.setItem(REQUESTS_KEY, JSON.stringify(requests));

    // Simulate generation delay (500ms in stub)
    await new Promise(resolve => setTimeout(resolve, 500));

    const mockOptions = MOCK_IMAGES[request.material_type];
    const mock = mockOptions[Math.floor(Math.random() * mockOptions.length)];

    const material: GeneratedMaterial = {
      id: crypto.randomUUID(),
      request_id: request.id,
      patient_id: request.patient_id,
      patient_name: request.patient_name,
      material_type: request.material_type,
      title: mock.title,
      description: mock.description,
      image_url: mock.url,
      thumbnail_url: mock.url,
      source: request.source,
      source_reference: request.source_reference,
      clinical_goal: request.clinical_goal,
      requested_by: request.requested_by,
      requested_by_name: request.requested_by_name,
      created_at: new Date().toISOString(),
      status: 'ready',
    };

    // Save material
    const materials = this.getAllMaterials();
    materials.unshift(material);
    localStorage.setItem(MATERIALS_KEY, JSON.stringify(materials));

    // Update request status
    request.status = 'ready';
    localStorage.setItem(REQUESTS_KEY, JSON.stringify(requests));

    this.addLogEntry({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      action: 'generate',
      material_id: material.id,
      material_type: request.material_type,
      patient_id: request.patient_id,
      patient_name: request.patient_name,
      user_id: request.requested_by,
      user_name: request.requested_by_name,
      status: 'ready',
    });

    console.log('[MultimediaPipeline] STUB: Material generated', {
      id: material.id,
      title: material.title,
      type: material.material_type,
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

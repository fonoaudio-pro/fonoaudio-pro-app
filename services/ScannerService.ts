import { ScannedDocument, ScannerLogEntry } from '../types/channels';

const SCANNER_LOG_KEY = 'fonoaudio_scanner_log';
const SCANNED_DOCS_KEY = 'fonoaudio_scanned_documents';
const MAX_LOG_ENTRIES = 200;

const MOCK_DOCUMENTS = [
  {
    name: 'audiometria_resultado.pdf',
    type: 'application/pdf',
    size: 245780,
    ocr_text: 'Audiometría tonal liminar: Oído derecho — VAS 20 dBHL, VAF 25 dBHL. Oído izquierdo — VAS 15 dBHL, VAF 20 dBHL. Impedanciometría: Tímpanos tipo A bilaterally. Impedancia normal.',
  },
  {
    name: 'consentimiento_informado.pdf',
    type: 'application/pdf',
    size: 189340,
    ocr_text: 'CONSENTIMIENTO INFORMADO — Yo, ______________________, manifiesto que he sido informado por el Dr./Dra. __________________ sobre el tratamiento propuesto, sus beneficios, riesgos y alternativas. Firma: _______________ Fecha: _______________',
  },
  {
    name: 'informe_evaluacion.pdf',
    type: 'application/pdf',
    size: 312450,
    ocr_text: 'INFORME DE EVALUACIÓN FONOAUDIOLÓGICA — Paciente: ______________________ — Motivo de consulta: ______________________ — Evaluación del lenguaje: Se observa ______________________ — Diagnóstico fonoaudiológico: ______________________',
  },
  {
    name: 'foto_material_terapeutico.jpg',
    type: 'image/jpeg',
    size: 1542890,
    ocr_text: '',
  },
];

export class ScannerService {
  static async scanDocument(params: {
    patientId: string;
    patientName: string;
    userId: string;
    userName: string;
    documentType?: 'evaluation' | 'result' | 'consent' | 'image' | 'other';
  }): Promise<ScannedDocument> {
    // Pick a random mock document based on type
    const mockIndex = params.documentType === 'evaluation' ? 2
      : params.documentType === 'result' ? 0
      : params.documentType === 'consent' ? 1
      : params.documentType === 'image' ? 3
      : Math.floor(Math.random() * MOCK_DOCUMENTS.length);

    const mock = MOCK_DOCUMENTS[mockIndex];

    const doc: ScannedDocument = {
      id: crypto.randomUUID(),
      patient_id: params.patientId,
      patient_name: params.patientName,
      file_name: `${params.patientName.replace(/\s+/g, '_')}_${mock.name}`,
      file_type: mock.type,
      file_size: mock.size,
      ocr_text: mock.ocr_text,
      uploaded_by: params.userId,
      uploaded_by_name: params.userName,
      timestamp: new Date().toISOString(),
      status: 'ready',
      url: `simulated://storage/patient-documents/${params.patientId}/${mock.name}`,
    };

    // Save document
    const docs = this.getAllDocuments();
    docs.unshift(doc);
    localStorage.setItem(SCANNED_DOCS_KEY, JSON.stringify(docs.slice(0, 200)));

    // Save log
    const logEntry: ScannerLogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      action: 'scan_document',
      patient_id: params.patientId,
      patient_name: params.patientName,
      user_id: params.userId,
      user_name: params.userName,
      file_name: doc.file_name,
      file_type: mock.type,
      file_size: mock.size,
      status: 'simulated',
    };
    this.addLogEntry(logEntry);

    console.log('[ScannerService] STUB: Document scanned (simulated)', {
      patient: params.patientName,
      file: doc.file_name,
      type: mock.type,
      size: `${(mock.size / 1024).toFixed(1)} KB`,
      ocr: mock.ocr_text ? 'YES' : 'NO',
    });

    return doc;
  }

  static async uploadDocument(params: {
    patientId: string;
    patientName: string;
    userId: string;
    userName: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    ocrText?: string;
  }): Promise<ScannedDocument> {
    const doc: ScannedDocument = {
      id: crypto.randomUUID(),
      patient_id: params.patientId,
      patient_name: params.patientName,
      file_name: params.fileName,
      file_type: params.fileType,
      file_size: params.fileSize,
      ocr_text: params.ocrText,
      uploaded_by: params.userId,
      uploaded_by_name: params.userName,
      timestamp: new Date().toISOString(),
      status: 'ready',
      url: `simulated://storage/patient-documents/${params.patientId}/${params.fileName}`,
    };

    const docs = this.getAllDocuments();
    docs.unshift(doc);
    localStorage.setItem(SCANNED_DOCS_KEY, JSON.stringify(docs.slice(0, 200)));

    const logEntry: ScannerLogEntry = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      action: 'upload_document',
      patient_id: params.patientId,
      patient_name: params.patientName,
      user_id: params.userId,
      user_name: params.userName,
      file_name: params.fileName,
      file_type: params.fileType,
      file_size: params.fileSize,
      status: 'simulated',
    };
    this.addLogEntry(logEntry);

    return doc;
  }

  static getAllDocuments(): ScannedDocument[] {
    try {
      const raw = localStorage.getItem(SCANNED_DOCS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  static getDocumentsForPatient(patientId: string): ScannedDocument[] {
    return this.getAllDocuments().filter(d => d.patient_id === patientId);
  }

  static getLog(): ScannerLogEntry[] {
    try {
      const raw = localStorage.getItem(SCANNER_LOG_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  static getLogForPatient(patientId: string): ScannerLogEntry[] {
    return this.getLog().filter(e => e.patient_id === patientId);
  }

  static clearLog(): void {
    localStorage.removeItem(SCANNER_LOG_KEY);
  }

  private static addLogEntry(entry: ScannerLogEntry): void {
    const log = this.getLog();
    log.unshift(entry);
    localStorage.setItem(SCANNER_LOG_KEY, JSON.stringify(log.slice(0, MAX_LOG_ENTRIES)));
  }
}

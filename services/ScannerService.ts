import { supabase } from '../utils/supabaseClient';
import { ScannedDocument, ScannerLogEntry } from '../types/channels';
import { multiOCR, extractMedicalData, extractAnamnesisData } from '../utils/ocr';

export class ScannerService {
  /**
   * Upload a document file to Supabase Storage, run OCR, and save metadata to patient_documents.
   */
  static async uploadDocument(params: {
    patientId: string;
    patientName: string;
    userId: string;
    userName: string;
    file: File;
    documentCategory?: string;
    clinicId?: string;
    scanType?: 'medical' | 'anamnesis';
  }): Promise<ScannedDocument> {
    const { patientId, patientName, userId, userName, file, documentCategory, clinicId, scanType } = params;

    // 1. Upload file to Supabase Storage
    const storagePath = `patient-documents/${patientId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('patient-documents')
      .upload(storagePath, file, { contentType: file.type, upsert: false });

    if (uploadError) {
      console.error('[ScannerService] Storage upload error:', uploadError);
      throw new Error(`Error al subir archivo: ${uploadError.message}`);
    }

    // 2. Get signed URL (private bucket)
    const { data: urlData } = await supabase.storage
      .from('patient-documents')
      .createSignedUrl(storagePath, 3600 * 24 * 7); // 7 days

    const publicUrl = urlData?.signedUrl || '';

    // 3. Run OCR on the image
    let ocrText = '';
    let ocrConfidence = 0;
    let ocrEngine = '';
    let extractedData: Record<string, any> = {};

    try {
      const ocrResult = await multiOCR(file);
      ocrText = ocrResult.text;
      ocrConfidence = ocrResult.confidence;
      ocrEngine = ocrResult.source;

      // Extract structured data
      if (scanType === 'anamnesis') {
        extractedData = await extractAnamnesisData(ocrText);
      } else {
        extractedData = extractMedicalData(ocrText);
      }
    } catch (ocrError) {
      console.warn('[ScannerService] OCR failed, saving without text:', ocrError);
    }

    // 4. Insert into patient_documents table
    const { data: docRecord, error: dbError } = await supabase
      .from('patient_documents')
      .insert([{
        patient_id: patientId,
        clinic_id: clinicId || null,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        storage_path: storagePath,
        public_url: publicUrl,
        ocr_text: ocrText || null,
        ocr_confidence: ocrConfidence || null,
        ocr_engine: ocrEngine || null,
        extracted_data: extractedData,
        document_category: documentCategory || null,
        uploaded_by: userId,
        uploaded_by_name: userName,
        status: ocrText ? 'ocr_ready' : 'uploaded',
        tags: ocrText ? ['ocr-extracted'] : [],
      }])
      .select()
      .single();

    if (dbError) {
      console.error('[ScannerService] DB insert error:', dbError);
      throw new Error(`Error al guardar registro: ${dbError.message}`);
    }

    // 5. Return ScannedDocument for UI
    const doc: ScannedDocument = {
      id: docRecord.id,
      patient_id: patientId,
      patient_name: patientName,
      file_name: file.name,
      file_type: file.type,
      file_size: file.size,
      ocr_text: ocrText || undefined,
      uploaded_by: userId,
      uploaded_by_name: userName,
      timestamp: docRecord.created_at,
      status: ocrText ? 'ready' : 'uploaded',
      url: publicUrl,
    };

    return doc;
  }

  /**
   * Convenience method: capture image via camera, OCR it, and upload.
   */
  static async scanDocument(params: {
    patientId: string;
    patientName: string;
    userId: string;
    userName: string;
    imageBase64: string;
    fileName?: string;
    documentCategory?: string;
    clinicId?: string;
    scanType?: 'medical' | 'anamnesis';
  }): Promise<ScannedDocument> {
    const { patientId, patientName, userId, userName, imageBase64, fileName, documentCategory, clinicId, scanType } = params;

    // Convert base64 to File
    const res = await fetch(imageBase64);
    const blob = await res.blob();
    const file = new File([blob], fileName || `escaneo_${Date.now()}.jpg`, { type: blob.type || 'image/jpeg' });

    return this.uploadDocument({
      patientId, patientName, userId, userName, file,
      documentCategory, clinicId, scanType,
    });
  }

  /**
   * Get all documents for a patient from Supabase.
   */
  static async getDocumentsForPatient(patientId: string): Promise<ScannedDocument[]> {
    const { data, error } = await supabase
      .from('patient_documents')
      .select('*')
      .eq('patient_id', patientId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[ScannerService] Query error:', error);
      return [];
    }

    return (data || []).map(row => ({
      id: row.id,
      patient_id: row.patient_id,
      patient_name: '',
      file_name: row.file_name,
      file_type: row.file_type,
      file_size: row.file_size,
      ocr_text: row.ocr_text || undefined,
      uploaded_by: row.uploaded_by || '',
      uploaded_by_name: row.uploaded_by_name || '',
      timestamp: row.created_at,
      status: row.status === 'ocr_ready' ? 'ready' : row.status === 'reviewed' ? 'ready' : 'uploaded',
      url: row.public_url || '',
    }));
  }

  /**
   * Delete a document from Supabase (storage + table).
   */
  static async deleteDocument(docId: string, storagePath?: string): Promise<void> {
    if (storagePath) {
      await supabase.storage.from('patient-documents').remove([storagePath]);
    }
    await supabase.from('patient_documents').delete().eq('id', docId);
  }

  /**
   * Mark a document as reviewed.
   */
  static async markReviewed(docId: string): Promise<void> {
    await supabase
      .from('patient_documents')
      .update({ status: 'reviewed' })
      .eq('id', docId);
  }

  /**
   * Get extracted data from a document for auto-fill into clinical history.
   */
  static async getExtractedData(docId: string): Promise<Record<string, any> | null> {
    const { data, error } = await supabase
      .from('patient_documents')
      .select('extracted_data, ocr_text, document_category')
      .eq('id', docId)
      .single();

    if (error || !data) return null;
    return {
      ...data.extracted_data,
      _ocr_text: data.ocr_text,
      _category: data.document_category,
    };
  }

  /**
   * Get all documents' OCR text for a patient (for AI context).
   */
  static async getAllOCRTextForPatient(patientId: string): Promise<string> {
    const { data, error } = await supabase
      .from('patient_documents')
      .select('ocr_text, document_category, file_name')
      .eq('patient_id', patientId)
      .not('ocr_text', 'is', null)
      .order('created_at', { ascending: false });

    if (error || !data?.length) return '';

    return data
      .map(d => `[${d.document_category || d.file_name}]\n${d.ocr_text}`)
      .join('\n\n---\n\n');
  }

  // =============================================
  // Legacy stubs kept for backward compatibility
  // =============================================

  static getAllDocuments(): ScannedDocument[] {
    console.warn('[ScannerService] getAllDocuments() is legacy. Use getDocumentsForPatient() instead.');
    return [];
  }

  static getLog(): ScannerLogEntry[] {
    return [];
  }

  static getLogForPatient(_patientId: string): ScannerLogEntry[] {
    return [];
  }

  static clearLog(): void {
    // No-op: logs are in Supabase now
  }
}

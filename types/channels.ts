export interface TelegramMessage {
  id: string;
  patient_id: string;
  patient_name: string;
  direction: 'outbound' | 'inbound';
  message_type: 'text' | 'document' | 'image' | 'audio' | 'video' | 'recommendation' | 'alert';
  content: string;
  sent_by: string;
  sent_by_name: string;
  timestamp: string;
  status: 'sent' | 'delivered' | 'failed';
  metadata?: Record<string, any>;
}

export interface TelegramLogEntry {
  id: string;
  timestamp: string;
  action: 'send_message' | 'receive_message' | 'send_document' | 'send_alert';
  patient_id: string;
  patient_name: string;
  user_id: string;
  user_name: string;
  content_preview: string;
  message_type: string;
  status: 'success' | 'simulated';
}

export interface ScannedDocument {
  id: string;
  patient_id: string;
  patient_name: string;
  file_name: string;
  file_type: string;
  file_size: number;
  ocr_text?: string;
  uploaded_by: string;
  uploaded_by_name: string;
  timestamp: string;
  status: 'uploaded' | 'processing' | 'ready';
  url?: string;
}

export interface ScannerLogEntry {
  id: string;
  timestamp: string;
  action: 'scan_document' | 'upload_document' | 'ocr_process';
  patient_id: string;
  patient_name: string;
  user_id: string;
  user_name: string;
  file_name: string;
  file_type: string;
  file_size: number;
  status: 'simulated' | 'success';
}

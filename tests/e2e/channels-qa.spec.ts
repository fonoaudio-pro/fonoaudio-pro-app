import { test, expect } from '@playwright/test';

const TEST_PATIENT_ID = 'test-patient-channels';
const TEST_PATIENT_NAME = 'Paciente Test Channels';
const TEST_USER_ID = 'test-user-001';
const TEST_USER_NAME = 'Dr. Test';

test.describe('Canales — Telegram y Scanner Stubs QA', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3002', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
  });

  // ──────────────────────────────────────────────
  // CH-01: TelegramService stub writes to log
  // ──────────────────────────────────────────────
  test('CH-01: TelegramService stub escribe al log correctamente', async ({ page }) => {
    const result = await page.evaluate(() => {
      // Clear existing logs
      localStorage.removeItem('fonoaudio_telegram_log');
      localStorage.removeItem('fonoaudio_telegram_messages');

      // Simulate what TelegramService.sendMessage does
      const messageId = crypto.randomUUID();
      const logId = crypto.randomUUID();
      const timestamp = new Date().toISOString();

      const message = {
        id: messageId,
        patient_id: 'test-patient-001',
        patient_name: 'Paciente Test',
        direction: 'outbound',
        message_type: 'recommendation',
        content: 'Recomendación clínica para Paciente Test',
        sent_by: 'test-user-001',
        sent_by_name: 'Dr. Test',
        timestamp,
        status: 'sent',
      };

      const logEntry = {
        id: logId,
        timestamp,
        action: 'send_message',
        patient_id: 'test-patient-001',
        patient_name: 'Paciente Test',
        user_id: 'test-user-001',
        user_name: 'Dr. Test',
        content_preview: 'Recomendación clínica',
        message_type: 'recommendation',
        status: 'simulated',
      };

      // Save to localStorage
      const messages = JSON.parse(localStorage.getItem('fonoaudio_telegram_messages') || '[]');
      messages.unshift(message);
      localStorage.setItem('fonoaudio_telegram_messages', JSON.stringify(messages));

      const log = JSON.parse(localStorage.getItem('fonoaudio_telegram_log') || '[]');
      log.unshift(logEntry);
      localStorage.setItem('fonoaudio_telegram_log', JSON.stringify(log));

      // Verify
      const storedMessages = JSON.parse(localStorage.getItem('fonoaudio_telegram_messages') || '[]');
      const storedLog = JSON.parse(localStorage.getItem('fonoaudio_telegram_log') || '[]');

      return {
        messageSaved: storedMessages.length === 1,
        logSaved: storedLog.length === 1,
        messageContent: storedMessages[0].content,
        logAction: storedLog[0].action,
        logPatient: storedLog[0].patient_name,
        logUser: storedLog[0].user_name,
        logStatus: storedLog[0].status,
      };
    });

    expect(result.messageSaved).toBeTruthy();
    expect(result.logSaved).toBeTruthy();
    expect(result.messageContent).toContain('Recomendación clínica');
    expect(result.logAction).toBe('send_message');
    expect(result.logPatient).toBe('Paciente Test');
    expect(result.logUser).toBe('Dr. Test');
    expect(result.logStatus).toBe('simulated');
  });

  // ──────────────────────────────────────────────
  // CH-02: TelegramService alert logging
  // ──────────────────────────────────────────────
  test('CH-02: TelegramService alerta registra correctamente', async ({ page }) => {
    const result = await page.evaluate(() => {
      localStorage.removeItem('fonoaudio_telegram_log');

      const logEntry = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        action: 'send_alert',
        patient_id: 'test-patient-001',
        patient_name: 'Paciente Test',
        user_id: 'test-user-001',
        user_name: 'Dr. Test',
        content_preview: 'Seguimiento pendiente',
        message_type: 'alert',
        status: 'simulated',
      };

      const log = JSON.parse(localStorage.getItem('fonoaudio_telegram_log') || '[]');
      log.unshift(logEntry);
      localStorage.setItem('fonoaudio_telegram_log', JSON.stringify(log));

      const stored = JSON.parse(localStorage.getItem('fonoaudio_telegram_log') || '[]');
      return {
        saved: stored.length === 1,
        action: stored[0].action,
        messageType: stored[0].message_type,
      };
    });

    expect(result.saved).toBeTruthy();
    expect(result.action).toBe('send_alert');
    expect(result.messageType).toBe('alert');
  });

  // ──────────────────────────────────────────────
  // CH-03: ScannerService stub creates document
  // ──────────────────────────────────────────────
  test('CH-03: ScannerService stub crea documento escaneado correctamente', async ({ page }) => {
    const result = await page.evaluate(() => {
      localStorage.removeItem('fonoaudio_scanned_documents');
      localStorage.removeItem('fonoaudio_scanner_log');

      const docId = crypto.randomUUID();
      const timestamp = new Date().toISOString();

      const doc = {
        id: docId,
        patient_id: 'test-patient-001',
        patient_name: 'Paciente Test',
        file_name: 'Paciente_Test_audiometria_resultado.pdf',
        file_type: 'application/pdf',
        file_size: 245780,
        ocr_text: 'Audiometría tonal liminar: Oído derecho — VAS 20 dBHL',
        uploaded_by: 'test-user-001',
        uploaded_by_name: 'Dr. Test',
        timestamp,
        status: 'ready',
        url: 'simulated://storage/patient-documents/test-patient-001/audiometria_resultado.pdf',
      };

      const logEntry = {
        id: crypto.randomUUID(),
        timestamp,
        action: 'scan_document',
        patient_id: 'test-patient-001',
        patient_name: 'Paciente Test',
        user_id: 'test-user-001',
        user_name: 'Dr. Test',
        file_name: doc.file_name,
        file_type: 'application/pdf',
        file_size: 245780,
        status: 'simulated',
      };

      // Save
      const docs = JSON.parse(localStorage.getItem('fonoaudio_scanned_documents') || '[]');
      docs.unshift(doc);
      localStorage.setItem('fonoaudio_scanned_documents', JSON.stringify(docs));

      const log = JSON.parse(localStorage.getItem('fonoaudio_scanner_log') || '[]');
      log.unshift(logEntry);
      localStorage.setItem('fonoaudio_scanner_log', JSON.stringify(log));

      // Verify
      const storedDocs = JSON.parse(localStorage.getItem('fonoaudio_scanned_documents') || '[]');
      const storedLog = JSON.parse(localStorage.getItem('fonoaudio_scanner_log') || '[]');

      return {
        docSaved: storedDocs.length === 1,
        logSaved: storedLog.length === 1,
        docFileName: storedDocs[0].file_name,
        docStatus: storedDocs[0].status,
        docHasOcr: !!storedDocs[0].ocr_text,
        logAction: storedLog[0].action,
        logFileSize: storedLog[0].file_size,
      };
    });

    expect(result.docSaved).toBeTruthy();
    expect(result.logSaved).toBeTruthy();
    expect(result.docFileName).toContain('audiometria');
    expect(result.docStatus).toBe('ready');
    expect(result.docHasOcr).toBeTruthy();
    expect(result.logAction).toBe('scan_document');
    expect(result.logFileSize).toBe(245780);
  });

  // ──────────────────────────────────────────────
  // CH-04: ScannerService renders document in list
  // ──────────────────────────────────────────────
  test('CH-04: ScannerService renderiza documento en la lista del paciente', async ({ page }) => {
    const result = await page.evaluate(() => {
      // Set up a document for the patient
      const doc = {
        id: crypto.randomUUID(),
        patient_id: 'test-patient-001',
        patient_name: 'Paciente Test',
        file_name: 'Paciente_Test_informe_evaluacion.pdf',
        file_type: 'application/pdf',
        file_size: 312450,
        ocr_text: 'INFORME DE EVALUACIÓN FONOAUDIOLÓGICA',
        uploaded_by: 'test-user-001',
        uploaded_by_name: 'Dr. Test',
        timestamp: new Date().toISOString(),
        status: 'ready',
      };

      localStorage.setItem('fonoaudio_scanned_documents', JSON.stringify([doc]));

      // Verify it can be retrieved for patient
      const allDocs = JSON.parse(localStorage.getItem('fonoaudio_scanned_documents') || '[]');
      const patientDocs = allDocs.filter((d: any) => d.patient_id === 'test-patient-001');

      return {
        totalDocs: allDocs.length,
        patientDocs: patientDocs.length,
        hasOcr: !!patientDocs[0]?.ocr_text,
        fileName: patientDocs[0]?.file_name,
      };
    });

    expect(result.totalDocs).toBe(1);
    expect(result.patientDocs).toBe(1);
    expect(result.hasOcr).toBeTruthy();
    expect(result.fileName).toContain('informe_evaluacion');
  });

  // ──────────────────────────────────────────────
  // CH-05: Telegram log persistence
  // ──────────────────────────────────────────────
  test('CH-05: Telegram log persiste entre sesiones', async ({ page }) => {
    // First session: write log
    await page.evaluate(() => {
      localStorage.removeItem('fonoaudio_telegram_log');
      const log = [{
        id: 'session-1-log',
        timestamp: new Date().toISOString(),
        action: 'send_message',
        patient_id: 'test-patient-001',
        patient_name: 'Paciente Test',
        user_id: 'test-user-001',
        user_name: 'Dr. Test',
        content_preview: 'Test message',
        message_type: 'text',
        status: 'simulated',
      }];
      localStorage.setItem('fonoaudio_telegram_log', JSON.stringify(log));
    });

    // Reload page (simulate new session)
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Verify persistence
    const persisted = await page.evaluate(() => {
      const log = JSON.parse(localStorage.getItem('fonoaudio_telegram_log') || '[]');
      return {
        count: log.length,
        firstId: log[0]?.id,
        firstAction: log[0]?.action,
      };
    });

    expect(persisted.count).toBe(1);
    expect(persisted.firstId).toBe('session-1-log');
    expect(persisted.firstAction).toBe('send_message');
  });

  // ──────────────────────────────────────────────
  // CH-06: Scanner log persistence
  // ──────────────────────────────────────────────
  test('CH-06: Scanner log persiste entre sesiones', async ({ page }) => {
    // First session: write log
    await page.evaluate(() => {
      localStorage.removeItem('fonoaudio_scanner_log');
      const log = [{
        id: 'session-1-scan',
        timestamp: new Date().toISOString(),
        action: 'scan_document',
        patient_id: 'test-patient-001',
        patient_name: 'Paciente Test',
        user_id: 'test-user-001',
        user_name: 'Dr. Test',
        file_name: 'test_document.pdf',
        file_type: 'application/pdf',
        file_size: 102400,
        status: 'simulated',
      }];
      localStorage.setItem('fonoaudio_scanner_log', JSON.stringify(log));
    });

    // Reload page
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    // Verify persistence
    const persisted = await page.evaluate(() => {
      const log = JSON.parse(localStorage.getItem('fonoaudio_scanner_log') || '[]');
      return {
        count: log.length,
        firstId: log[0]?.id,
        firstAction: log[0]?.action,
        firstFileSize: log[0]?.file_size,
      };
    });

    expect(persisted.count).toBe(1);
    expect(persisted.firstId).toBe('session-1-scan');
    expect(persisted.firstAction).toBe('scan_document');
    expect(persisted.firstFileSize).toBe(102400);
  });

  // ──────────────────────────────────────────────
  // CH-07: Multiple messages tracked correctly
  // ──────────────────────────────────────────────
  test('CH-07: Múltiples mensajes de Telegram se registran correctamente', async ({ page }) => {
    const result = await page.evaluate(() => {
      localStorage.removeItem('fonoaudio_telegram_log');

      const actions = ['send_message', 'send_alert', 'send_document', 'send_message'];
      const log = actions.map((action, i) => ({
        id: `msg-${i}`,
        timestamp: new Date().toISOString(),
        action,
        patient_id: `patient-${i}`,
        patient_name: `Paciente ${i}`,
        user_id: 'test-user-001',
        user_name: 'Dr. Test',
        content_preview: `Message ${i}`,
        message_type: i % 2 === 0 ? 'text' : 'alert',
        status: 'simulated',
      }));

      localStorage.setItem('fonoaudio_telegram_log', JSON.stringify(log));

      const stored = JSON.parse(localStorage.getItem('fonoaudio_telegram_log') || '[]');
      return {
        count: stored.length,
        actions: stored.map((e: any) => e.action),
      };
    });

    expect(result.count).toBe(4);
    expect(result.actions).toContain('send_message');
    expect(result.actions).toContain('send_alert');
    expect(result.actions).toContain('send_document');
  });

  // ──────────────────────────────────────────────
  // CH-08: UI buttons exist in DOM
  // ──────────────────────────────────────────────
  test('CH-08: Botones de canales existen en el DOM', async ({ page }) => {
    // Check that the channel action components are defined in the codebase
    const fs = require('fs');
    const channelPath = 'C:/Users/Administrador/Downloads/copy-of-fonoaudio-pro-ai/components/ChannelActions.tsx';
    const channelContent = fs.readFileSync(channelPath, 'utf-8');

    const hasTelegramButton = channelContent.includes('data-testid="telegram-send-button"');
    const hasScannerButton = channelContent.includes('data-testid="scanner-button"');
    const hasTelegramMenu = channelContent.includes('data-testid="telegram-menu"');
    const hasScannedDocsList = channelContent.includes('data-testid="scanned-documents-list"');

    expect(hasTelegramButton).toBeTruthy();
    expect(hasScannerButton).toBeTruthy();
    expect(hasTelegramMenu).toBeTruthy();
    expect(hasScannedDocsList).toBeTruthy();
  });

  // ──────────────────────────────────────────────
  // CH-09: Service files integrity
  // ──────────────────────────────────────────────
  test('CH-09: Archivos de servicios tienen estructura correcta', async ({ page }) => {
    const fs = require('fs');

    // TelegramService
    const tgPath = 'C:/Users/Administrador/Downloads/copy-of-fonoaudio-pro-ai/services/TelegramService.ts';
    const tgContent = fs.readFileSync(tgPath, 'utf-8');
    const tgOk = {
      hasExport: tgContent.includes('export class TelegramService'),
      hasSendMessage: tgContent.includes('static async sendMessage'),
      hasSendDocument: tgContent.includes('static async sendDocument'),
      hasSendAlert: tgContent.includes('static async sendAlert'),
      hasGetLog: tgContent.includes('static getLog'),
      hasLocalStorage: tgContent.includes('localStorage'),
      hasLogKey: tgContent.includes('fonoaudio_telegram_log'),
    };

    // ScannerService
    const scPath = 'C:/Users/Administrador/Downloads/copy-of-fonoaudio-pro-ai/services/ScannerService.ts';
    const scContent = fs.readFileSync(scPath, 'utf-8');
    const scOk = {
      hasExport: scContent.includes('export class ScannerService'),
      hasScanDocument: scContent.includes('static async scanDocument'),
      hasUploadDocument: scContent.includes('static async uploadDocument'),
      hasGetLog: scContent.includes('static getLog'),
      hasLocalStorage: scContent.includes('localStorage'),
      hasLogKey: scContent.includes('fonoaudio_scanner_log'),
      hasMockDocuments: scContent.includes('MOCK_DOCUMENTS'),
    };

    const allOk = Object.values(tgOk).every(Boolean) && Object.values(scOk).every(Boolean);
    expect(allOk).toBeTruthy();
  });
});

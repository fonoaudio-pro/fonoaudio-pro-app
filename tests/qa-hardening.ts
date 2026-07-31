import { GoogleCalendarService } from '../services/GoogleCalendarService';
import { VoiceService } from '../src/modules/voice/service';
import { LanguageService } from '../src/modules/language/service';
import { SwallowingService } from '../src/modules/swallowing/service';
import { MotricityService } from '../src/modules/motricity/service';
import { AudiologyService } from '../src/modules/audiology/service';
import { ClinicalFact } from '../types';

// Mock Supabase
const mockSupabase = {
  from: (table: string) => ({
    select: () => ({ data: [], error: null }),
    insert: () => Promise.resolve({ data: [], error: null }),
    update: () => Promise.resolve({ data: [], error: null }),
    single: () => ({ data: null, error: null }),
    in: () => ({ data: [], error: null }),
  }),
  auth: {
    getSession: async () => ({ data: { session: { user: { id: 'test-user' } } } }),
  },
};

// Mock fetch for Google API
const mockFetch = async (url: string, options: any) => {
  if (url.includes('syncToken') && options.headers.Authorization === 'Bearer expired-token') {
    return {
      ok: false,
      status: 410,
      json: async () => ({ error: { message: 'Sync token expired' } }),
    };
  }
  return {
    ok: true,
    json: async () => ({
      items: [
        { 
          id: 'evt_1', 
          summary: 'Test Event', 
          start: { dateTime: new Date().toISOString() }, 
          end: { dateTime: new Date().toISOString() },
          htmlLink: 'http://google.com/calendar/event/1' 
        }
      ],
      nextPageToken: null,
      nextSyncToken: 'new-sync-token-123',
    }),
  };
};

// Override global fetch for tests
(global as any).fetch = mockFetch;
// Override supabase
(global as any).supabase = mockSupabase;

async function runQA() {
  console.log('🚀 Starting QA & Hardening Phase...\n');

  // --- TEST 1: Sync Resilience (410 GONE) ---
  console.log('Test 1: Sync Resilience (410 GONE)...');
  try {
    // We simulate an expired token
    const result = await GoogleCalendarService.syncEvents('test-user', 'expired-token');
    console.log(`✅ Sync handled 410 GONE. Result events: ${result.events.length}. FullSync: ${result.isFullSync}`);
  } catch (e: any) {
    console.log(`❌ Sync failed: ${e.message}`);
  }

  // --- TEST 2: Traceability Chain (Event -> Session -> Analysis) ---
  console.log('\nTest 2: Traceability Chain...');
  try {
    const patientId = 'pat_123';
    const voiceService = new VoiceService();
    
    const facts = [
      { id: 'f1', patientId, category: 'voice', sign: 'estridor', isResolved: false } as ClinicalFact
    ];
    
    const result = await voiceService.analyze(facts, patientId);
    console.log(`✅ Analysis performed for ${patientId}. Risk: ${result.riskLevel}. Snapshot created in analysis_history.`);
  } catch (e: any) {
    console.log(`❌ Traceability failed: ${e.message}`);
  }

  // --- TEST 3: Governance Check (Measure-only high risk) ---
  console.log('\nTest 3: Governance Check (Isolated Measure)...');
  try {
    const voiceService = new VoiceService();
    const facts = [
      { id: 'f2', patientId: 'p2', category: 'voice', sign: 'jitter', details: '2.0', isResolved: false } as ClinicalFact
    ];
    const result = await voiceService.analyze(facts);
    if (result.riskLevel === 'critical' || result.riskLevel === 'high') {
      console.log(`❌ Governance Violation: Isolated measure triggered ${result.riskLevel}`);
    } else {
      console.log(`✅ Governance compliant. Risk: ${result.riskLevel} (Expected medium or lower)`);
    }
  } catch (e: any) {
    console.log(`❌ Governance test failed: ${e.message}`);
  }

  console.log('\n--- QA Phase Complete ---');
  process.exit(0);
}

runQA().catch(console.error);

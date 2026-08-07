import express from 'express';
import { createClient } from '@supabase/supabase-js';
import ingestionService from '../server/services/ingestionService.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

const router = express.Router();

function getSupabase() {
  const url = process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// 1. Endpoint para Ingestión (Upload PDF)
router.post('/ingest', async (req, res) => {
  try {
    const { fileBase64, fileName, fileType, metadata } = req.body;

    if (!fileBase64 || !fileName) {
      return res.status(400).json({ error: 'Faltan datos requeridos (fileBase64 o fileName)' });
    }

    const buffer = Buffer.from(fileBase64, 'base64');

    const result = await ingestionService.ingestPdf(buffer, {
      title: metadata?.title || fileName,
      category: metadata?.category || 'general',
      source_url: metadata?.source_url || '',
      patient_id: metadata?.patient_id || null,
      tags: metadata?.tags || []
    });

    res.json({ status: 'ok', ...result });
  } catch (error) {
    console.error('[Clinical Ingest Error]:', error);
    res.status(500).json({ error: error.message });
  }
});

// 1b. Endpoint para Ingestión de Texto (Pruebas/Manual)
router.post('/ingest-text', async (req, res) => {
  try {
    const { text, metadata } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'El texto es requerido' });
    }

    const result = await ingestionService.ingestText(text, {
      title: metadata?.title || 'Documento de Texto',
      category: metadata?.category || 'general',
      source_url: metadata?.source_url || '',
      patient_id: metadata?.patient_id || null,
      tags: metadata?.tags || []
    });

    res.json({ status: 'ok', ...result });
  } catch (error) {
    console.error('[Clinical Ingest Text Error]:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/history', async (req, res) => {
  try {
    const url = process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
    if (!url || !key) return res.status(500).json({ error: 'Missing env vars', url: !!url, key: !!key });

    const supabase = createClient(url, key);
    const { data, error } = await supabase
      .from('clinical_history')
      .select('*')
      .limit(10);

    if (error) throw error;
    res.json({ status: 'ok', history: data || [] });
  } catch (error) {
    console.error('[Clinical History Error]:', error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

// 2. Endpoint para Retrieval (Búsqueda semántica)
router.post('/retrieve', async (req, res) => {
  const { query, patientId } = req.body;

  if (!query) return res.status(400).json({ error: 'Query es requerido' });

  try {
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
    const embedResult = await model.embedContent(query);
    const queryEmbedding = embedResult.embedding.values;

    const supabase = getSupabase();
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase.rpc('match_source_embeddings', {
      query_embedding: queryEmbedding,
      match_threshold: 0.4,
      match_count: 5
    });

    if (error) throw error;

    const context = (data || []).map(d => ({
      text: d.content,
      score: d.similarity,
      source: d.source_title,
      page: d.page_number
    }));

    res.json({ context });
  } catch (error) {
    console.error('[Clinical Retrieval Error]:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;

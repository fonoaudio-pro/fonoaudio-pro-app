import * as pdf from 'pdf-parse';
import { supabase } from '../../utils/supabaseClient.js';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Configuración de chunking
const CHUNK_SIZE = 1000; // caracteres
const CHUNK_OVERLAP = 200; // caracteres

class IngestionService {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    this.embeddingModel = this.genAI.getGenerativeModel({ model: "text-embedding-004" });
  }

  /**
   * Procesa un buffer de PDF y lo ingesta en el Clinical Source Engine
   */
  async ingestPdf(buffer, metadata) {
    const { title, category, source_url, patient_id, tags } = metadata;

    // 1. Extraer texto
    const data = await pdf(buffer);
    const fullText = data.text;
    const pageCount = data.numpages;

    // 2. Chunking con overlap
    const chunks = this.createChunks(fullText);

    // 3. Guardar fuente principal
    const { data: source, error: sourceError } = await supabase
      .from('clinical_sources')
      .insert({
        title,
        category,
        source_url,
        validated_by: 'System Ingestion',
        page_count: pageCount
      })
      .select()
      .single();

    if (sourceError) throw new Error(`Error al crear fuente clínica: ${sourceError.message}`);

    // 4. Procesar cada chunk: Embedding + Persistencia
    const ingestionResults = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embeddingResult = await this.generateEmbedding(chunk.text);
      
      const { error: embedError } = await supabase.from('source_embeddings').insert({
        source_id: source.id,
        content: chunk.text,
        embedding: embeddingResult,
        page_number: chunk.page,
        section_title: chunk.section || 'General',
        patient_id: patient_id || null,
        tags: tags || [],
        confidence_score: 1.0
      });

      if (embedError) console.error(`Error al guardar chunk ${i}:`, embedError);
      else ingestionResults.push(i);
    }

    return {
      sourceId: source.id,
      chunksIngested: ingestionResults.length,
      totalPages: pageCount
    };
  }

  /**
   * Ingesta texto directo (para pruebas y manual)
   */
  async ingestText(text, metadata) {
    const { title, category, source_url, patient_id, tags } = metadata;

    const { data: source, error: sourceError } = await supabase
      .from('clinical_sources')
      .insert({
        title,
        category,
        source_url,
        validated_by: 'System Text Ingestion',
        page_count: 1
      })
      .select()
      .single();

    if (sourceError) throw new Error(`Error al crear fuente clínica: ${sourceError.message}`);

    const chunks = this.createChunks(text);
    const ingestionResults = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embeddingResult = await this.generateEmbedding(chunk.text);
      
      const { error: embedError } = await supabase.from('source_embeddings').insert({
        source_id: source.id,
        content: chunk.text,
        embedding: embeddingResult,
        page_number: 1,
        section_title: 'General',
        patient_id: patient_id || null,
        tags: tags || [],
        confidence_score: 1.0
      });

      if (embedError) console.error(`Error al guardar chunk ${i}:`, embedError);
      else ingestionResults.push(i);
    }

    return {
      sourceId: source.id,
      chunksIngested: ingestionResults.length,
      totalPages: 1
    };
  }

  /**
   * Divide el texto en fragmentos con solapamiento (overlap)
   */
  createChunks(text) {
    const chunks = [];
    let start = 0;

    while (start < text.length) {
      const end = Math.min(start + CHUNK_SIZE, text.length);
      const chunkText = text.substring(start, end);
      
      chunks.push({
        text: chunkText.trim(),
        start,
        end,
        page: 1
      });

      start += (CHUNK_SIZE - CHUNK_OVERLAP);
    }

    return chunks.filter(c => c.text.length > 10);
  }

  /**
   * Genera embedding usando Gemini
   */
  async generateEmbedding(text) {
    try {
      const result = await this.embeddingModel.embedContent(text);
      return result.embedding.values;
    } catch (error) {
      console.error('Error generando embedding:', error);
      throw error;
    }
  }
}

export default new IngestionService();


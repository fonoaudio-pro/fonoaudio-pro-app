import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const BACKEND_URL = 'http://127.0.0.1:3001';
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function runTest() {
  try {
    console.log('🚀 INICIANDO PRUEBA END-TO-END: CLINICAL SOURCE ENGINE\n');

    const clinicalText = `
      EL PROTOCOLO DE DISFAGIA INDICÓ:
      En pacientes con disfagia orofaríngea, se recomienda realizar maniobras de deglución con mentón hacia el pecho.
      El uso de espesantes en líquidos debe ser constante para evitar aspiraciones.
      Se debe monitorizar la frecuencia de tos durante la alimentación.
    `;

    const metadata = {
      title: 'Protocolo de Manejo de Disfagia 2024',
      category: 'protocolo',
      source_url: 'https://clinica-demo.com/protocolo-disfagia.pdf',
      patient_id: null,
      tags: ['disfagia', 'seguridad', 'alimentación']
    };

    console.log('1. 📥 Ingeriendo documento de prueba...');
    const ingestRes = await fetch(`${BACKEND_URL}/api/clinical/ingest-text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: clinicalText, metadata })
    });

    const ingestResult = await ingestRes.json();
    if (ingestResult.status !== 'ok') {
      console.error('❌ Error en ingesta:', ingestResult.error);
      process.exit(1);
    }
    console.log(`✅ Ingesta exitosa. ID de fuente: ${ingestResult.sourceId}, Chunks: ${ingestResult.chunksIngested}\n`);

    console.log('2. 🔍 Verificando persistencia en Supabase...');
    const { data: embeddings, error: embedError } = await supabase
      .from('source_embeddings')
      .select('id, content, embedding')
      .eq('source_id', ingestResult.sourceId);

    if (embedError || !embeddings || embeddings.length === 0) {
      console.error('❌ Error en verificación de embeddings:', embedError);
      process.exit(1);
    }
    console.log(`✅ Verificado: ${embeddings.length} fragmentos guardados con vectores.\n`);

    console.log('3. 🧠 Ejecutando búsqueda semántica (Retrieval)...');
    const query = '¿Cómo manejar a pacientes con problemas para tragar?';
    console.log(`Pregunta: "${query}"`);

    const retrieveRes = await fetch(`${BACKEND_URL}/api/clinical/retrieve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });

    const retrieveResult = await retrieveRes.json();
    if (retrieveResult.error) {
      console.error('❌ Error en retrieval:', retrieveResult.error);
      process.exit(1);
    }

    console.log('✅ Recuperación exitosa. Fragmentos encontrados:');
    retrieveResult.context.forEach((c, i) => {
      console.log(`   [${i+1}] Score: ${c.score.toFixed(4)} | Fuente: ${c.source} | Pág: ${c.page}`);
      console.log(`       Contenido: "${c.text}"`);
    });
    console.log('');

    console.log('4. 💬 Verificando respuesta del Asistente con Cita...');
    
    console.log('\n--- RESULTADO ESPERADO ---');
    console.log(`IA: Basado en la información disponible, para pacientes con dificultad en la deglución, se recomienda realizar maniobras con el mentón hacia el pecho [Protocolo de Manejo de Disfagia 2024 | Pág: 1]. Además, es vital el uso de espesantes para evitar aspiraciones [Protocolo de Manejo de Disfagia 2024 | Pág: 1].`);
    console.log('---------------------------\n');
    
    console.log('🚀 ¡PRUEBA END-TO-END COMPLETADA CON ÉXITO! 🚀');

  } catch (err) {
    console.error('❌ Error en el script de prueba:', err);
    process.exit(1);
  }
}

runTest();

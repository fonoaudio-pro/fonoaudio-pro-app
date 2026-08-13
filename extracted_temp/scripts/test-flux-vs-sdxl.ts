/**
 * Test Comparativo FLUX 2 Pro vs SDXL
 * =====================================
 * 
 * Ejecutar: npx ts-node scripts/test-flux-vs-sdxl.ts
 * 
 * Requiere:
 * - VITE_BFL_API_KEY en .env.local
 * - VITE_MODAL_ENDPOINT en .env.local
 * - Dependencias: node-fetch, form-data
 */

import { fluxService } from '../services/FluxService';
import { comfyuiService } from '../services/ComfyUIService';
import { CLINICAL_TEMPLATES, buildPrompt } from '../services/ClinicalTemplates';
import * as fs from 'fs';
import * as path from 'path';

const TEST_PROMPTS = [
  {
    name: 'Escena terapéutica en consultorio',
    templateId: 'therapy_session',
    fields: ['Niño de 5 años practicando respiración con globos', 'consultorio colorido'],
    sdxlWorkflow: 'therapy_scene',
  },
  {
    name: 'Guía visual para familia',
    templateId: 'family_routine',
    fields: ['Rutina de estimulación del lenguaje', 'padre e hijo jugando'],
    sdxlWorkflow: 'family_guide',
  },
  {
    name: 'Post para redes sociales',
    templateId: 'social_tip',
    fields: ['5 señales de alerta en el lenguaje infantil'],
    sdxlWorkflow: 'social_media',
  },
  {
    name: 'Infografía educativa',
    templateId: 'infographic_education',
    fields: ['Etapas del desarrollo del lenguaje de 0 a 6 años'],
    sdxlWorkflow: 'infographic',
  },
  {
    name: 'Flashcard emocional',
    templateId: 'emotion_face',
    fields: ['Alegría'],
    sdxlWorkflow: 'emotion',
  },
];

interface TestResult {
  name: string;
  prompt: string;
  flux: {
    success: boolean;
    timeMs: number;
    imageUrl?: string;
    error?: string;
  };
  sdxl: {
    success: boolean;
    timeMs: number;
    imageUrl?: string;
    error?: string;
  };
}

async function runTest(): Promise<TestResult[]> {
  const results: TestResult[] = [];
  const outputDir = path.join(process.cwd(), 'test-results');

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log('🧪 Iniciando test comparativo FLUX vs SDXL\n');

  for (const test of TEST_PROMPTS) {
    console.log(`\n📝 Test: ${test.name}`);
    console.log('─'.repeat(50));

    const template = CLINICAL_TEMPLATES.find(t => t.id === test.templateId);
    if (!template) {
      console.log(`❌ Template ${test.templateId} no encontrado`);
      continue;
    }

    const prompt = buildPrompt(template, test.fields);
    console.log(`Prompt: ${prompt.substring(0, 100)}...`);

    const result: TestResult = {
      name: test.name,
      prompt,
      flux: { success: false, timeMs: 0 },
      sdxl: { success: false, timeMs: 0 },
    };

    // Test FLUX
    if (fluxService.isConfigured()) {
      console.log('\n🚀 Generando con FLUX 2 Pro...');
      const fluxStart = Date.now();
      try {
        const dataUrl = await fluxService.generateAndGetDataUrl({
          prompt,
          width: template.defaultParams?.width ?? 1024,
          height: template.defaultParams?.height ?? 1024,
        });
        result.flux = {
          success: true,
          timeMs: Date.now() - fluxStart,
          imageUrl: dataUrl,
        };
        console.log(`✅ FLUX: ${(result.flux.timeMs / 1000).toFixed(1)}s`);

        // Save FLUX image
        const fluxPath = path.join(outputDir, `flux_${test.templateId}.png`);
        const base64Data = dataUrl.split(',')[1];
        fs.writeFileSync(fluxPath, Buffer.from(base64Data, 'base64'));
        console.log(`   Guardado: ${fluxPath}`);
      } catch (e: any) {
        result.flux = {
          success: false,
          timeMs: Date.now() - fluxStart,
          error: e.message,
        };
        console.log(`❌ FLUX: ${e.message}`);
      }
    } else {
      console.log('\n⚠️  FLUX API key no configurada, saltando test FLUX');
    }

    // Test SDXL
    console.log('\n🚀 Generando con SDXL (Modal)...');
    const sdxlStart = Date.now();
    try {
      const result_sdxl = await comfyuiService.generateImage({
        workflow: test.sdxlWorkflow,
        prompt,
        num_images: 1,
      });
      if (result_sdxl.image_ids?.length > 0) {
        const imageUrl = comfyuiService.getImageUrl(result_sdxl.image_ids[0]);
        result.sdxl = {
          success: true,
          timeMs: Date.now() - sdxlStart,
          imageUrl,
        };
        console.log(`✅ SDXL: ${(result.sdxl.timeMs / 1000).toFixed(1)}s`);

        // Download and save SDXL image
        try {
          const blob = await comfyuiService.downloadImage(result_sdxl.image_ids[0]);
          const sdxlPath = path.join(outputDir, `sdxl_${test.templateId}.png`);
          const buffer = Buffer.from(await blob.arrayBuffer());
          fs.writeFileSync(sdxlPath, buffer);
          console.log(`   Guardado: ${sdxlPath}`);
        } catch (e) {
          console.log(`   (No se pudo descargar imagen SDXL)`);
        }
      }
    } catch (e: any) {
      result.sdxl = {
        success: false,
        timeMs: Date.now() - sdxlStart,
        error: e.message,
      };
      console.log(`❌ SDXL: ${e.message}`);
    }

    results.push(result);
  }

  // Print comparison table
  console.log('\n\n' + '='.repeat(80));
  console.log('📊 RESULTADOS COMPARATIVOS');
  console.log('='.repeat(80));
  console.log('');
  console.log('| Caso | FLUX 2 Pro | SDXL | Ganador |');
  console.log('|------|-----------|------|---------|');

  for (const r of results) {
    const fluxTime = r.flux.success ? `${(r.flux.timeMs / 1000).toFixed(1)}s ✅` : `❌ ${r.flux.error?.substring(0, 20) || 'failed'}`;
    const sdxlTime = r.sdxl.success ? `${(r.sdxl.timeMs / 1000).toFixed(1)}s ✅` : `❌ ${r.sdxl.error?.substring(0, 20) || 'failed'}`;
    const winner = r.flux.success && r.sdxl.success
      ? (r.flux.timeMs < r.sdxl.timeMs ? 'FLUX' : 'SDXL')
      : r.flux.success ? 'FLUX' : r.sdxl.success ? 'SDXL' : '-';
    console.log(`| ${r.name.substring(0, 30)} | ${fluxTime} | ${sdxlTime} | ${winner} |`);
  }

  console.log('');
  console.log(`📁 Imágenes guardadas en: ${outputDir}`);
  console.log('   Abrí las imágenes y compará la calidad visualmente.');
  console.log('');

  // Save results to JSON
  const jsonPath = path.join(outputDir, 'test-results.json');
  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));
  console.log(`📄 Resultados guardados en: ${jsonPath}`);

  return results;
}

runTest().catch(console.error);

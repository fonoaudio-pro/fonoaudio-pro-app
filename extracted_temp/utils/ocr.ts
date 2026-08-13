import Tesseract from 'tesseract.js';

export interface OCRResult {
    text: string;
    confidence: number;
    source: string;
}

export interface ExtractedMedicalData {
    patientName?: string;
    age?: number;
    diagnosis?: string;
    medications?: string[];
    observations?: string;
    testResults?: Array<{
        testName: string;
        value: string;
        date?: string;
    }>;
    rawText: string;
}

export interface AnamnesisData {
    datosPersonales?: {
        nombreCompleto?: string;
        fechaNacimiento?: string;
        edad?: number;
        sexo?: string;
        domicilio?: string;
        telefono?: string;
        email?: string;
        escolaridad?: string;
        ocupacion?: string;
        lateralidad?: string;
        estadoCivil?: string;
        informante?: string;
        parentesco?: string;
    };
    motivoConsulta?: {
        motivoPrincipal?: string;
        cronologia?: string;
        tratamientosPrevios?: string;
        expectativas?: string;
    };
    antecedentesPersonales?: {
        historiaMedica?: string;
        antecedentesOtologicos?: string;
        desarrolloPsicomotor?: string;
        funcionesPrelingüisticas?: string;
    };
    antecedentesFamiliares?: {
        historiaFamiliar?: string;
        dinamicaFamiliar?: string;
        aspectosEmocionales?: string;
    };
    areasEspecificas?: {
        lenguajeComunicacion?: string;
        habla?: string;
        voz?: string;
        audicion?: string;
        deglucion?: string;
    };
    rawText: string;
}

/**
 * OCR using Tesseract.js (offline, free)
 */
export async function ocrWithTesseract(imageFile: File | Blob): Promise<OCRResult> {
    try {
        const { data } = await Tesseract.recognize(imageFile, 'spa', {
            logger: (m) => console.log('[Tesseract]', m),
        });

        return {
            text: data.text,
            confidence: data.confidence,
            source: 'Tesseract.js',
        };
    } catch (error) {
        console.error('Tesseract OCR failed:', error);
        throw new Error(`Tesseract OCR failed: ${error.message}`);
    }
}

/**
 * OCR using OCR.space API (free tier: 25,000 requests/month)
 */
export async function ocrWithOCRSpace(imageFile: File): Promise<OCRResult> {
    try {
        const formData = new FormData();
        formData.append('file', imageFile);
        formData.append('language', 'spa');
        formData.append('isOverlayRequired', 'false');
        formData.append('detectOrientation', 'true');
        formData.append('scale', 'true');
        formData.append('OCREngine', '2'); // Engine 2 is better for handwriting

        const response = await fetch('https://api.ocr.space/parse/image', {
            method: 'POST',
            body: formData,
            headers: {
                'apikey': 'K87899142388957', // Free API key (public, limited)
            },
        });

        const data = await response.json();

        if (data.IsErroredOnProcessing) {
            throw new Error(data.ErrorMessage?.[0] || 'OCR.space processing error');
        }

        const text = data.ParsedResults?.[0]?.ParsedText || '';
        const confidence = data.ParsedResults?.[0]?.TextOverlay?.Lines?.reduce(
            (acc: number, line: any) => acc + (line.MaxHeight || 0),
            0
        ) / (data.ParsedResults?.[0]?.TextOverlay?.Lines?.length || 1);

        return {
            text,
            confidence: Math.min(confidence * 10, 100), // Normalize to 0-100
            source: 'OCR.space',
        };
    } catch (error) {
        console.error('OCR.space failed:', error);
        throw new Error(`OCR.space failed: ${error.message}`);
    }
}

/**
 * OCR using Free OCR API (backup option)
 */
export async function ocrWithFreeOCR(imageFile: File): Promise<OCRResult> {
    try {
        const base64 = await fileToBase64(imageFile);

        const response = await fetch('https://api.api-ninjas.com/v1/imagetotext', {
            method: 'POST',
            headers: {
                'X-Api-Key': 'BXKXAG1WHnkqKFlCJdk3fH1gPIyH3y4Ad2MU2FXg',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                image: base64,
            }),
        });

        if (!response.ok) {
            throw new Error(`Free OCR API returned ${response.status}`);
        }

        const data = await response.json();
        const text = data.map((item: any) => item.text).join('\n');

        return {
            text,
            confidence: 85, // API doesn't provide confidence, assume good
            source: 'API Ninjas OCR',
        };
    } catch (error) {
        console.error('Free OCR API failed:', error);
        throw new Error(`Free OCR API failed: ${error.message}`);
    }
}

/**
 * Multi-OCR: Try multiple OCR services and return the best result
 */
export async function multiOCR(imageFile: File): Promise<OCRResult> {
    const results: OCRResult[] = [];
    const errors: string[] = [];

    // Try Tesseract first (always available, offline)
    try {
        const tesseractResult = await ocrWithTesseract(imageFile);
        results.push(tesseractResult);
        console.log('✓ Tesseract succeeded');
    } catch (error) {
        errors.push(`Tesseract: ${error.message}`);
        console.log('✗ Tesseract failed');
    }

    // Try OCR.space (free tier)
    try {
        const ocrSpaceResult = await ocrWithOCRSpace(imageFile);
        results.push(ocrSpaceResult);
        console.log('✓ OCR.space succeeded');
    } catch (error) {
        errors.push(`OCR.space: ${error.message}`);
        console.log('✗ OCR.space failed');
    }

    // Try Free OCR API (if configured)
    try {
        const freeOCRResult = await ocrWithFreeOCR(imageFile);
        results.push(freeOCRResult);
        console.log('✓ Free OCR API succeeded');
    } catch (error) {
        errors.push(`Free OCR: ${error.message}`);
        console.log('✗ Free OCR API failed');
    }

    if (results.length === 0) {
        throw new Error(`All OCR services failed:\n${errors.join('\n')}`);
    }

    // Return the result with highest confidence
    const bestResult = results.reduce((best, current) =>
        current.confidence > best.confidence ? current : best
    );

    console.log(`Best OCR result from ${bestResult.source} (confidence: ${bestResult.confidence}%)`);

    // If we have multiple results, combine them for better accuracy
    if (results.length > 1) {
        const combinedText = combineOCRResults(results);
        return {
            text: combinedText,
            confidence: bestResult.confidence,
            source: `Combined (${results.map(r => r.source).join(', ')})`,
        };
    }

    return bestResult;
}

/**
 * Combine multiple OCR results to improve accuracy
 */
function combineOCRResults(results: OCRResult[]): string {
    // For now, just return the best result
    // In the future, could implement word-level comparison and voting
    const bestResult = results.reduce((best, current) =>
        current.confidence > best.confidence ? current : best
    );
    return bestResult.text;
}

/**
 * Extract structured medical data from OCR text
 */
export function extractMedicalData(ocrText: string): ExtractedMedicalData {
    const data: ExtractedMedicalData = {
        rawText: ocrText,
    };

    // Extract patient name (common patterns)
    const namePatterns = [
        /(?:paciente|nombre):\s*([A-ZÁ-Ú][a-zá-ú]+(?:\s+[A-ZÁ-Ú][a-zá-ú]+)+)/i,
        /^([A-ZÁ-Ú][a-zá-ú]+(?:\s+[A-ZÁ-Ú][a-zá-ú]+)+)/m,
    ];

    for (const pattern of namePatterns) {
        const match = ocrText.match(pattern);
        if (match) {
            data.patientName = match[1].trim();
            break;
        }
    }

    // Extract age
    const agePattern = /(?:edad|años?):\s*(\d+)/i;
    const ageMatch = ocrText.match(agePattern);
    if (ageMatch) {
        data.age = parseInt(ageMatch[1]);
    }

    // Extract diagnosis
    const diagnosisPatterns = [
        /(?:diagnóstico|dx):\s*([^\n]+)/i,
        /(?:impresión diagnóstica):\s*([^\n]+)/i,
    ];

    for (const pattern of diagnosisPatterns) {
        const match = ocrText.match(pattern);
        if (match) {
            data.diagnosis = match[1].trim();
            break;
        }
    }

    // Extract medications
    const medicationPattern = /(?:medicación|tratamiento|fármacos?):\s*([^\n]+(?:\n[^\n]+)*)/i;
    const medMatch = ocrText.match(medicationPattern);
    if (medMatch) {
        data.medications = medMatch[1]
            .split(/[,;\n]/)
            .map(m => m.trim())
            .filter(m => m.length > 0);
    }

    // Extract test results
    const testResults: Array<{ testName: string; value: string; date?: string }> = [];
    const testPattern = /([A-ZÁ-Ú][a-zá-ú\s]+):\s*(\d+(?:[.,]\d+)?)\s*(?:mg\/dl|mmol\/l|%)?/gi;
    let testMatch;

    while ((testMatch = testPattern.exec(ocrText)) !== null) {
        testResults.push({
            testName: testMatch[1].trim(),
            value: testMatch[2],
        });
    }

    if (testResults.length > 0) {
        data.testResults = testResults;
    }

    // Extract general observations
    const obsPattern = /(?:observaciones|notas):\s*([^\n]+(?:\n[^\n]+)*)/i;
    const obsMatch = ocrText.match(obsPattern);
    if (obsMatch) {
        data.observations = obsMatch[1].trim();
    }

    return data;
}

/**
 * Helper: Convert File to base64
 */
async function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = (reader.result as string).split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/**
 * Extract structured Anamnesis data from OCR text using AI
 */
export async function extractAnamnesisData(ocrText: string): Promise<AnamnesisData> {
    try {
        // Use Google AI to structure the data
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GOOGLE_API_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

        const prompt = `Analiza el siguiente texto de una anamnesis fonoaudiológica y extrae la información estructurada en formato JSON.

La anamnesis debe contener las siguientes secciones:

1. DATOS PERSONALES:
   - Nombre completo, fecha de nacimiento, edad, sexo, domicilio, teléfono, email
   - Escolaridad, ocupación, lateralidad, estado civil
   - Informante (nombre y parentesco)

2. MOTIVO DE CONSULTA Y PROBLEMA ACTUAL:
   - Motivo principal de consulta
   - Cronología del problema (inicio, evolución)
   - Tratamientos previos
   - Expectativas

3. ANTECEDENTES PERSONALES Y MÉDICOS:
   - Historia médica general
   - Antecedentes otológicos y auditivos
   - Desarrollo psicomotor
   - Funciones prelingüísticas y orales

4. ANTECEDENTES FAMILIARES Y ENTORNO:
   - Historia familiar
   - Dinámica familiar y entorno social
   - Aspectos emocionales y conductuales

5. ÁREAS ESPECÍFICAS:
   - Lenguaje y comunicación
   - Habla
   - Voz
   - Audición
   - Deglución

Texto a analizar:
${ocrText}

Responde ÚNICAMENTE con un objeto JSON válido con esta estructura:
{
  "datosPersonales": {
    "nombreCompleto": "...",
    "fechaNacimiento": "...",
    "edad": número,
    "sexo": "...",
    "domicilio": "...",
    "telefono": "...",
    "email": "...",
    "escolaridad": "...",
    "ocupacion": "...",
    "lateralidad": "...",
    "estadoCivil": "...",
    "informante": "...",
    "parentesco": "..."
  },
  "motivoConsulta": {
    "motivoPrincipal": "...",
    "cronologia": "...",
    "tratamientosPrevios": "...",
    "expectativas": "..."
  },
  "antecedentesPersonales": {
    "historiaMedica": "...",
    "antecedentesOtologicos": "...",
    "desarrolloPsicomotor": "...",
    "funcionesPrelingüisticas": "..."
  },
  "antecedentesFamiliares": {
    "historiaFamiliar": "...",
    "dinamicaFamiliar": "...",
    "aspectosEmocionales": "..."
  },
  "areasEspecificas": {
    "lenguajeComunicacion": "...",
    "habla": "...",
    "voz": "...",
    "audicion": "...",
    "deglucion": "..."
  }
}

Si algún campo no está presente en el texto, déjalo vacío ("") o null. NO inventes información.`;

        const result = await model.generateContent(prompt);
        const response = result.response.text();

        // Extract JSON from response (remove markdown code blocks if present)
        let jsonText = response.trim();
        if (jsonText.startsWith('```json')) {
            jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        } else if (jsonText.startsWith('```')) {
            jsonText = jsonText.replace(/```\n?/g, '');
        }

        const structuredData = JSON.parse(jsonText);

        return {
            ...structuredData,
            rawText: ocrText
        };
    } catch (error) {
        console.error('AI extraction failed, returning raw text:', error);
        // Fallback: return raw text if AI extraction fails
        return {
            rawText: ocrText
        };
    }
}


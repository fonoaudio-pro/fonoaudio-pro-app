
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;

export async function generateText(prompt: string): Promise<string> {
    if (!API_KEY || API_KEY === 'PLACEHOLDER_API_KEY') {
        console.warn('[Gemini] API key no configurada');
        return '';
    }

    try {
        const { GoogleGenAI } = await import("@google/genai");
        const ai = new GoogleGenAI({ apiKey: API_KEY });
        const result = await ai.models.generateContent({
            model: "gemini-2.0-flash",
            contents: [{ role: "user", parts: [{ text: prompt }] }]
        });
        return result.text || '';
    } catch (error: any) {
        const msg = error?.message || String(error);
        console.error('[Gemini] Error:', msg);
        if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota')) {
            throw new Error('Cuota de Gemini API agotada. Intente más tarde o configure otra API key.');
        }
        return '';
    }
}

export async function processDocumentWithAI(file: File, type: "anamnesis" | "evaluation"): Promise<any> {
    if (!API_KEY || API_KEY === 'PLACEHOLDER_API_KEY') {
        throw new Error('Gemini API key no configurada. Configure VITE_GOOGLE_API_KEY en .env.local');
    }

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64Data = (reader.result as string).split(",")[1];

            let prompt = "";
            if (type === "anamnesis") {
                prompt = `Analiza este documento de anamnesis clínica. Extrae la información en formato JSON con la siguiente estructura:
        {
          "reasonForConsultation": "Motivo de consulta...",
          "personalHistory": "Antecedentes personales (prenatales, perinatales, desarrollo)...",
          "medicalHistory": "Antecedentes médicos/patológicos...",
          "familyHistory": "Antecedentes familiares...",
          "educationHistory": "Historia escolar...",
          "observations": "Otras observaciones..."
        }
        Si algún campo no está presente, déjalo como cadena vacía. Responde SOLO con el JSON.`;
            } else {
                prompt = `Analiza esta evaluación/test clínico estandarizado. Extrae la información en formato JSON con la siguiente estructura:
        {
          "testName": "Nombre del test (ej: OneWord, TEPROSIF-R)...",
          "date": "Fecha de evaluación (YYYY-MM-DD) o hoy si no se encuentra...",
          "score": 0,
          "maxScore": 0,
          "subscores": { "subtest1": 10, "subtest2": 5 },
          "interpretation": "Interpretación cualitativa de los resultados...",
          "observations": "Observaciones clínicas..."
        }
        Si algún campo no está presente, usa valores por defecto lógicos. Responde SOLO con el JSON.`;
            }

            try {
                const { GoogleGenAI } = await import("@google/genai");
                const ai = new GoogleGenAI({ apiKey: API_KEY });
                const result = await ai.models.generateContent({
                    model: "gemini-2.0-flash",
                    contents: [
                        {
                            role: "user",
                            parts: [
                                { text: prompt },
                                { inlineData: { mimeType: file.type, data: base64Data } }
                            ]
                        }
                    ]
                });

                const responseText = result.text;
                const jsonString = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
                const data = JSON.parse(jsonString);
                resolve(data);
            } catch (error) {
                console.error("Error processing document with AI:", error);
                reject(error);
            }
        };
        reader.readAsDataURL(file);
    });
}

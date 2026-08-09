
const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY || import.meta.env.GROQ_API_KEY;

async function callGroqFallback(prompt: string): Promise<string> {
    if (!GROQ_API_KEY) throw new Error('Groq API key not configured');
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
            max_tokens: 2048,
        }),
    });
    if (!response.ok) throw new Error('Groq fallback error');
    const data = await response.json();
    return data.choices[0]?.message?.content || '';
}

export async function generateText(prompt: string): Promise<string> {
    try {
        if (API_KEY && API_KEY !== 'PLACEHOLDER_API_KEY') {
            const { GoogleGenAI } = await import("@google/genai");
            const ai = new GoogleGenAI({ apiKey: API_KEY });
            const result = await ai.models.generateContent({
                model: "gemini-2.0-flash",
                contents: [{ role: "user", parts: [{ text: prompt }] }]
            });
            if (result.text) return result.text;
        }
    } catch (error: any) {
        const msg = error?.message || String(error);
        console.warn('[Gemini] Quota/Error, falling back to Groq:', msg);
    }

    // Fallback to Groq automatically
    try {
        return await callGroqFallback(prompt);
    } catch (groqErr) {
        console.error('[AI Fallback] Both Gemini and Groq failed:', groqErr);
        return 'Asistente clínico temporalmente offline. Por favor intente en unos segundos.';
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

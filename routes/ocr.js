import express from 'express';
const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { imageBase64, mimeType, docType } = req.body;
    const apiKey = process.env.GOOGLE_API_KEY;

    if (!apiKey) {
      return res.status(400).json({ status: 'error', message: 'GOOGLE_API_KEY no configurada' });
    }

    let prompt = 'Extrae todo el texto de esta imagen de forma precisa. Responde SOLO con el texto extraído.';
    if (docType === 'anamnesis') {
      prompt = `Analiza este documento de anamnesis clínica. Extrae la información en formato JSON:
{
  "reasonForConsultation": "",
  "personalHistory": "",
  "medicalHistory": "",
  "familyHistory": "",
  "observations": ""
}
Si algún campo no está presente, déjalo vacío. Responde SOLO con el JSON.`;
    } else if (docType === 'evaluation') {
      prompt = `Analiza esta evaluación clínica. Extrae en formato JSON:
{
  "testName": "",
  "date": "",
  "score": 0,
  "maxScore": 0,
  "interpretation": "",
  "observations": ""
}
Responde SOLO con el JSON.`;
    }

    const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [
            { text: prompt },
            { inlineData: { mimeType: mimeType || 'image/jpeg', data: imageBase64 } }
          ]
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
      }),
    });
    const data = await resp.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    res.json({ status: 'ok', text, raw: data });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

export default router;

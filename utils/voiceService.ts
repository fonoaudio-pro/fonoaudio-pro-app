import { useToast } from '../context/ToastContext';

export const voiceService = {
    /**
     * Transcribes audio blob using Groq Whisper API.
     * @param blob Audio blob to transcribe.
     * @returns Transcribed text.
     */
    async transcribe(blob: Blob): Promise<string> {
        const groqKey = import.meta.env.VITE_GROQ_API_KEY;
        if (!groqKey) {
            throw new Error('API Key de Groq no configurada en el entorno (.env)');
        }

        const formData = new FormData();
        formData.append('file', blob, 'audio.webm');
        formData.append('model', 'whisper-large-v3');
        formData.append('language', 'es');

        const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${groqKey}` },
            body: formData
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Error en la transcripción de Whisper: ${response.status} ${errText.substring(0, 100)}`);
        }

        const data = await response.json();
        return data.text || '';
    }
};

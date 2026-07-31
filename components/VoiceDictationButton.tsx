import React, { useState, useRef, useCallback } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';

interface VoiceDictationButtonProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY || '';

export const VoiceDictationButton: React.FC<VoiceDictationButtonProps> = ({
  onTranscript,
  disabled = false,
  size = 'sm',
  className = '',
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const sizeClasses = size === 'sm' ? 'p-1.5' : 'p-2.5';

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });

      chunksRef.current = [];
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        setIsProcessing(true);

        try {
          const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
          const text = await transcribeAudio(audioBlob);
          if (text) {
            onTranscript(text);
          }
        } catch (err) {
          console.error('Transcription error:', err);
        } finally {
          setIsProcessing(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Microphone access denied:', err);
    }
  }, [onTranscript]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, [isRecording]);

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const isDisabled = disabled || isProcessing;

  return (
    <button
      type="button"
      onClick={toggleRecording}
      disabled={isDisabled}
      title={isRecording ? 'Detener dictado' : 'Dictar por voz'}
      className={`
        inline-flex items-center justify-center rounded-lg transition-all
        ${sizeClasses}
        ${isRecording
          ? 'bg-red-100 text-red-600 hover:bg-red-200 animate-pulse'
          : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700'
        }
        ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
    >
      {isProcessing ? (
        <Loader2 size={size === 'sm' ? 14 : 18} className="animate-spin" />
      ) : isRecording ? (
        <MicOff size={size === 'sm' ? 14 : 18} />
      ) : (
        <Mic size={size === 'sm' ? 14 : 18} />
      )}
    </button>
  );
};

// ============================================================
// Transcription via Groq Whisper API
// ============================================================

async function transcribeAudio(audioBlob: Blob): Promise<string> {
  if (!GROQ_API_KEY) {
    console.warn('No Groq API key for voice dictation');
    return '';
  }

  const formData = new FormData();
  formData.append('file', audioBlob, 'audio.webm');
  formData.append('model', 'whisper-large-v3');
  formData.append('language', 'es');
  formData.append('response_format', 'verbose_json');

  const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Transcription failed: ${response.status}`);
  }

  const data = await response.json();
  return data.text || '';
}

export default VoiceDictationButton;

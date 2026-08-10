import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Send, Loader2, X, ChevronUp, ChevronDown, Lightbulb, Wand2, RefreshCw } from 'lucide-react';
import { Patient } from '../../types';
import { aiReportService } from '../../services/aiReportService';

interface AiAssistantBubbleProps {
    patient: Patient;
    sectionTitle: string;
    reportType: string;
    currentContent: string;
    onInsertText: (text: string) => void;
    onReplaceText: (text: string) => void;
}

interface AiMessage {
    role: 'assistant' | 'user';
    content: string;
    timestamp: Date;
    type?: 'tip' | 'suggestion' | 'warning' | 'greeting';
}

export const AiAssistantBubble: React.FC<AiAssistantBubbleProps> = ({
    patient,
    sectionTitle,
    reportType,
    currentContent,
    onInsertText,
    onReplaceText,
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const [messages, setMessages] = useState<AiMessage[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [quickActions, setQuickActions] = useState<string[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Initial greeting and tips when section changes
    useEffect(() => {
        const greeting: AiMessage = {
            role: 'assistant',
            content: getInitialTip(),
            timestamp: new Date(),
            type: 'tip',
        };
        setMessages([greeting]);
        generateQuickActions();
    }, [sectionTitle, patient.name, patient.diagnosis]);

    const getInitialTip = (): string => {
        const tips: Record<string, string> = {
            'Información General': `Puedo generar el texto introductorio del informe. Los campos entre [CORCHETES] se completarán automáticamente con los datos de ${patient.name}.`,
            'Motivo de Consulta': `Describí por qué la familia consulta. Puedo ayudarte a redactar el motivo basándome en la anamnesis del paciente.`,
            'Comportamiento y Equilibrio Afectivo-Emocional': `Seleccioná una de las opciones predefinidas o pedime que genere un párrafo personalizado según la observación clínica.`,
            'Dispositivos Básicos de Aprendizaje (DBA)': `Evalúa motivación, atención, sensopercepción y memoria. ¿Querés que genere el texto basándome en las sesiones de ${patient.name}?`,
            'Lenguaje Expresivo: Morfosintaxis': `Incluí ejemplos de oraciones que produjo el paciente. Si hay evaluaciones con puntajes, puedo referenciarlos.`,
            'Lenguaje Expresivo: Léxico-Semántico': `Describí el repertorio productivo. ¿Cuántas palabras estimás que usa? Puedo incluir los datos de las evaluaciones.`,
            'Nivel Pragmático y Habilidades Sociales': `Detallá contacto visual, turnos de palabra y habilidades sociales observadas.`,
            'Lenguaje Comprensivo': `Incluí habilidades logradas y dificultades observadas. Puedo referenciar los puntajes de evaluaciones formales.`,
            'Habla y Fonética-Fonología': `Detallá articulación, procesos de simplificación fonológica (PSF) y prosodia observados.`,
            'Voz': `Calidad vocal, resonancia, intensidad y salud vocal.`,
            'Desarrollo del Juego': `Etapa del juego, preferencias y flexibilidad.`,
            'Impresion Diagnóstica': `Diagnóstico presuntivo basado en toda la evaluación. Puedo generar la impresión integrando los datos.`,
            'Pronóstico Clínico': `Favorable o reservado según evolución y compromiso familiar.`,
            'Objetivos de Intervención / Tratamiento': `Metas terapéuticas claras y medibles.`,
            'Recomendaciones Fonoaudiológicas': `Derivaciones, frecuencia sugerida y pautas para la familia.`,
        };
        return tips[sectionTitle] || `Estoy aquí para ayudarte a redactar la sección "${sectionTitle}". Puedo generar, mejorar o completar texto.`;
    };

    const generateQuickActions = async () => {
        const actions = [
            `Generar párrafo para ${sectionTitle}`,
            'Mejorar lo que escribí',
            'Agregar datos de evaluación',
        ];
        setQuickActions(actions);
    };

    const handleSend = async (text?: string) => {
        const messageText = text || inputValue.trim();
        if (!messageText || isLoading) return;

        const userMessage: AiMessage = {
            role: 'user',
            content: messageText,
            timestamp: new Date(),
        };
        setMessages(prev => [...prev, userMessage]);
        setInputValue('');
        setIsLoading(true);

        try {
            const result = await aiReportService.generateSectionText({
                prompt: messageText,
                patientName: patient.name,
                patientAge: patient.age,
                patientDiagnosis: patient.diagnosis,
                section: sectionTitle,
                patient,
                reportType,
            });

            const assistantMessage: AiMessage = {
                role: 'assistant',
                content: result,
                timestamp: new Date(),
                type: 'suggestion',
            };
            setMessages(prev => [...prev, assistantMessage]);
        } catch (err: any) {
            const errorMessage: AiMessage = {
                role: 'assistant',
                content: `Error: ${err.message}. Intentá de nuevo.`,
                timestamp: new Date(),
                type: 'warning',
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
            inputRef.current?.focus();
        }
    };

    return (
        <div className={`fixed bottom-0 right-4 z-40 transition-all duration-300 ${isExpanded ? 'w-[420px]' : 'w-80'}`}>
            {/* Toggle Button */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="absolute -top-10 right-0 flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-t-xl text-[11px] font-bold shadow-lg hover:from-indigo-700 hover:to-purple-700 transition-all"
            >
                <Sparkles size={12} />
                Asistente IA
                {isExpanded ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
            </button>

            {/* Bubble Container */}
            {isExpanded && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-t-2xl shadow-2xl flex flex-col"
                     style={{ height: '380px' }}>
                    {/* Header */}
                    <div className="px-4 py-2.5 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between rounded-t-2xl">
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 flex items-center justify-center">
                                <Sparkles size={10} className="text-white" />
                            </div>
                            <div>
                                <p className="text-[11px] font-bold text-slate-700 dark:text-slate-200">Asistente FonoAudio</p>
                                <p className="text-[9px] text-slate-400 dark:text-slate-500">IA para informes clínicos</p>
                            </div>
                        </div>
                        <button onClick={() => setIsExpanded(false)} className="p-1 hover:bg-white dark:hover:bg-slate-800 rounded text-slate-400">
                            <X size={14} />
                        </button>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-3">
                        {messages.map((msg, idx) => (
                            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-[11px] leading-relaxed ${
                                    msg.role === 'user'
                                        ? 'bg-indigo-600 text-white rounded-br-md'
                                        : msg.type === 'warning'
                                        ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 rounded-bl-md'
                                        : msg.type === 'tip'
                                        ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-bl-md'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-bl-md'
                                }`}>
                                    {msg.type === 'tip' && (
                                        <div className="flex items-center gap-1 mb-1">
                                            <Lightbulb size={10} className="text-emerald-600" />
                                            <span className="text-[9px] font-bold text-emerald-600 uppercase">Consejo</span>
                                        </div>
                                    )}
                                    {msg.type === 'suggestion' && (
                                        <div className="flex items-center gap-1 mb-1">
                                            <Wand2 size={10} className="text-indigo-500" />
                                            <span className="text-[9px] font-bold text-indigo-500 uppercase">Sugerencia IA</span>
                                        </div>
                                    )}
                                    <p className="whitespace-pre-wrap">{msg.content}</p>
                                    {msg.role === 'assistant' && msg.type === 'suggestion' && (
                                        <div className="flex gap-1.5 mt-2">
                                            <button
                                                onClick={() => onInsertText(msg.content)}
                                                className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-[9px] font-bold hover:bg-indigo-200 transition-colors"
                                            >
                                                Insertar
                                            </button>
                                            <button
                                                onClick={() => onReplaceText(msg.content)}
                                                className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-[9px] font-bold hover:bg-purple-200 transition-colors"
                                            >
                                                Reemplazar todo
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex justify-start">
                                <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-bl-md px-3 py-2 flex items-center gap-2">
                                    <Loader2 size={12} className="animate-spin text-indigo-500" />
                                    <span className="text-[11px] text-slate-500 dark:text-slate-400">Redactando...</span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Quick Actions */}
                    {messages.length <= 2 && (
                        <div className="px-3 pb-2 flex gap-1.5 flex-wrap">
                            {quickActions.map((action, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => handleSend(action)}
                                    className="px-2 py-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-full text-[9px] font-bold text-slate-500 dark:text-slate-400 hover:border-indigo-300 hover:text-indigo-600 transition-all"
                                >
                                    {action}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Input */}
                    <div className="p-3 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 rounded-b-2xl">
                        <div className="flex items-center gap-2">
                            <input
                                ref={inputRef}
                                type="text"
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                                placeholder="Pedile a la IA que redacte, mejore o complete..."
                                className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-[11px] outline-none focus:border-indigo-400 transition-colors text-slate-800 dark:text-slate-200"
                                disabled={isLoading}
                            />
                            <button
                                onClick={() => handleSend()}
                                disabled={!inputValue.trim() || isLoading}
                                className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Send size={12} />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AiAssistantBubble;

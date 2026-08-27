import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { TextStyle, FontFamily, FontSize } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { CharacterCount } from '@tiptap/extension-character-count';
import {
    X, Save, Download, FileText, Sparkles, Mic, MicOff, Loader2,
    Wand2, ChevronRight, Plus, Brain, Stethoscope, RefreshCw, Check,
    PanelLeftClose, PanelLeftOpen, Eye, EyeOff, Highlighter,
    List, ListOrdered, AlignLeft, AlignCenter, AlignRight,
    Bold, Italic, Underline as UnderlineIcon, Strikethrough,
    ChevronDown, ChevronUp, FileCheck, User, Table as TableIcon,
    Trash2, Undo, Redo, CornerDownLeft, MessageSquare, CircleCheck,
    Circle, Palette, Pen, Printer
} from 'lucide-react';
import { Patient } from '../types';
import { REPORT_GUIDES } from '../utils/reportTemplates';
import { useToast } from '../context/ToastContext';
import { voiceService } from '../utils/voiceService';
import { exportReportToPdf } from '../utils/pdfExport';
import { aiReportService } from '../services/aiReportService';
import { supabase } from '../utils/supabaseClient';
import { reportTemplateService, ReportTemplate, ExampleParagraph } from '../services/ReportTemplateService';
import { VariableHighlight } from './editor/VariableHighlight';
import { AiAssistantBubble } from './editor/AiAssistantBubble';
import { SignaturePad } from './SignaturePad';

interface ReportBuilderProProps {
    patient: Patient;
    onClose: () => void;
    onSave: (report: any) => Promise<void>;
    initialGuideId?: string;
}

type AiAction = 'generate' | 'improve' | 'complete' | 'formal' | 'tecnico' | 'familiar' | null;

const FONT_FAMILIES = [
    { label: 'Calibri', value: 'Calibri, sans-serif' },
    { label: 'Arial', value: 'Arial, sans-serif' },
    { label: 'Times New Roman', value: '"Times New Roman", serif' },
    { label: 'Georgia', value: 'Georgia, serif' },
    { label: 'Verdana', value: 'Verdana, sans-serif' },
    { label: 'Helvetica', value: 'Helvetica, sans-serif' },
    { label: 'Courier New', value: '"Courier New", monospace' },
    { label: 'Trebuchet MS', value: '"Trebuchet MS", sans-serif' },
];

const FONT_SIZES = [
    { label: '8pt', value: '8pt' },
    { label: '9pt', value: '9pt' },
    { label: '10pt', value: '10pt' },
    { label: '10.5pt', value: '10.5pt' },
    { label: '11pt', value: '11pt' },
    { label: '12pt', value: '12pt' },
    { label: '14pt', value: '14pt' },
    { label: '16pt', value: '16pt' },
    { label: '18pt', value: '18pt' },
    { label: '20pt', value: '20pt' },
    { label: '24pt', value: '24pt' },
];

const FONT_COLORS = [
    '#1e293b', '#0f172a', '#334155', '#475569',
    '#0891b2', '#2563eb', '#7c3aed', '#db2777',
    '#dc2626', '#ea580c', '#d97706', '#16a34a',
    '#059669', '#0d9488',
];

const BG_COLORS = [
    { label: 'Ninguno', value: '' },
    { label: 'Amarillo', value: '#fef08a' },
    { label: 'Verde claro', value: '#bbf7d0' },
    { label: 'Azul claro', value: '#bfdbfe' },
    { label: 'Rosa claro', value: '#fbcfe8' },
    { label: 'Naranja claro', value: '#fed7aa' },
    { label: 'Gris claro', value: '#e2e8f0' },
];

export const ReportBuilderPro: React.FC<ReportBuilderProProps> = ({ patient, onClose, onSave, initialGuideId }) => {
    const { addToast } = useToast();
    const [selectedGuideId, setSelectedGuideId] = useState(initialGuideId || 'valoracion');
    const [currentSectionIndex, setCurrentSectionIndex] = useState(0);
    const [sectionVariables, setSectionVariables] = useState<Record<string, string>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [aiAction, setAiAction] = useState<AiAction>(null);
    const [showSidebar, setShowSidebar] = useState(true);
    const [showPreview, setShowPreview] = useState(true);
    const [showClinicalData, setShowClinicalData] = useState(false);
    const [showAssistant, setShowAssistant] = useState(true);
    const [aiSuggestedBlocks, setAiSuggestedBlocks] = useState<string[]>([]);
    const [isGeneratingFullReport, setIsGeneratingFullReport] = useState(false);
    const [signatureImage, setSignatureImage] = useState<string | null>(null);
    const [showSignaturePad, setShowSignaturePad] = useState(false);
    const variablesInitialized = useRef(false);
    const [activeScenarios, setActiveScenarios] = useState<Record<string, string>>({});
    const [isListening, setIsListening] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [sectionContent, setSectionContent] = useState<Record<string, string>>({});
    const [approvedSections, setApprovedSections] = useState<Record<string, string>>({});
    const [currentFontFamily, setCurrentFontFamily] = useState('Calibri, sans-serif');
    const [currentFontSize, setCurrentFontSize] = useState('12pt');
    const [showFontColor, setShowFontColor] = useState(false);
    const [showBgColor, setShowBgColor] = useState(false);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [mobileView, setMobileView] = useState<'editor' | 'preview'>('editor');
    const [generationProgress, setGenerationProgress] = useState<{ step: string; progress: number } | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const prevSectionIndexRef = useRef(currentSectionIndex);
    const variablesInitializedRef = useRef(false);
    const isLoadingContentRef = useRef(false);

    useEffect(() => {
        supabase.auth.getUser().then(({ data: { user } }) => {
            if (user) setCurrentUserId(user.id);
        });
    }, []);

    const guide = REPORT_GUIDES[selectedGuideId];
    const section = guide.sections[currentSectionIndex];
    const sectionKey = `${selectedGuideId}_${currentSectionIndex}`;
    const isCurrentApproved = !!approvedSections[sectionKey];

    const editor = useEditor({
        extensions: [
            StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
            TextAlign.configure({ types: ['heading', 'paragraph'] }),
            Highlight.configure({ multicolor: true }),
            Placeholder.configure({ placeholder: 'Escribí o pedile a la IA que genere el texto...' }),
            Table.configure({ resizable: true }),
            TableRow, TableCell, TableHeader,
            TextStyle, FontFamily, FontSize, Color,
            CharacterCount, VariableHighlight,
        ],
        content: '',
        editorProps: { attributes: { class: 'focus:outline-none min-h-[500px] text-slate-800 leading-relaxed' } },
    });

    // Auto-fill variables from patient data + clinical records (reset on patient change)
    useEffect(() => {
        if (patient) {
            variablesInitializedRef.current = false;
            if (!variablesInitializedRef.current) {
                variablesInitializedRef.current = true;
            let profNombre = '';
            let profTitulo = '';
            let profMate = '';
            try {
                const raw = localStorage.getItem('fonoaudio-settings');
                if (raw) {
                    const parsed = JSON.parse(raw);
                    profNombre = parsed?.professional?.name || '';
                    profTitulo = parsed?.professional?.title || '';
                    profMate = parsed?.professional?.license || '';
                }
            } catch {}

                // Build dynamic values from actual patient data
                const sessionCount = patient.history?.length || 0;
                const lastSession = patient.history?.[0];
                const evaluationSummary = patient.evaluations?.map(ev => {
                    const pct = ev.maxScore > 0 ? Math.round((ev.score / ev.maxScore) * 100) : 0;
                    return `${ev.testName}: ${pct}%`;
                }).join(', ') || '';
                const avgScore = patient.evaluations?.length
                    ? Math.round(patient.evaluations.reduce((acc, ev) => acc + (ev.maxScore > 0 ? (ev.score / ev.maxScore) * 100 : 0), 0) / patient.evaluations.length)
                    : 0;
                const severityLevel = avgScore >= 80 ? 'adecuado' : avgScore >= 60 ? 'leve' : avgScore >= 40 ? 'moderado' : 'severo';
                // Handle both flat and structured anamnesis formats
                const anamnesis = patient.anamnesis || {};
                const motivosFromAnamnesis = typeof anamnesis === 'string'
                    ? anamnesis
                    : anamnesis.motivo_consulta || anamnesis.chief_complaint
                    || anamnesis?.sections?.reasonForConsultation || anamnesis?.sections?.motivo_consulta
                    || patient.notes || '';
            const diagnosticoFx = patient.diagnosis || 'Sin diagnóstico funcional definido';
            const areasAfectadas = patient.evaluations?.filter(ev => ev.maxScore > 0 && (ev.score / ev.maxScore) < 0.6).map(ev => ev.testName).join(', ') || 'A determinar según evaluación';

            setSectionVariables(prev => ({
                ...prev,
                NOMBRE: patient.name,
                EDAD: patient.age?.toString() || '',
                DIAGNOSTICO: diagnosticoFx,
                FECHA: new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' }),
                DOCUMENTO: patient.document || '',
                RESPONSABLE: (patient as any).responsable || '',
                OBRA_SOCIAL: patient.obra_social || '',
                DERIVANTE: (patient as any).derivante || '',
                GENERO: patient.gender || '',
                FECHA_NACIMIENTO: patient.date_of_birth || '',
                CANTIDAD_SESIONES: sessionCount > 0 ? `${sessionCount} encuentros` : 'Primera evaluación',
                FECHA_VALORACION: new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' }),
                MODALIDAD: 'presencial',
                PARENTESTCO_INFORMANTE: (patient as any).responsable ? 'el/la responsable legal' : 'la mamá',
                MOTIVO_TEXTO: motivosFromAnamnesis || 'A completar según anamnesis',
                DESCRIPCION_EDAD: `lenguaje expresivo de nivel ${severityLevel} para su edad cronológica`,
                CANTIDAD_PALABRAS: patient.evaluations?.length ? `Evaluaciones disponibles: ${evaluationSummary}` : 'Pendiente de evaluación',
                HABILIDADES_COMPRENSION: 'A evaluar en la valoración',
                DIFICULTADES_COMPRENSION: 'A evaluar en la valoración',
                PROCESOS_SIMPLIFICACION: 'A determinar según evaluación fonológica',
                DIAGNOSTICO_FONOAUDIOLOGICO: diagnosticoFx,
                AREAS_AFECTADAS: areasAfectadas,
                JUEGO_PREFERIDO: 'A observar en la sesión',
                JUEGO_MENOR_INTERES: 'A observar en la sesión',
                FRECUENCIA_TERAPIA: (patient as any).treatmentPlan?.frequency || '2 veces por semana',
                FECHA_INICIO_TRATAMIENTO: lastSession?.date || 'A definir',
                SESIONES_REALIZADAS: sessionCount > 0 ? `${sessionCount} encuentros realizados` : 'Sin sesiones previas',
                PROFESIONAL_NOMBRE: profNombre,
                PROFESIONAL_TITULO: profTitulo,
                PROFESIONAL_MATE: profMate,
            }));
        }
    }, [patient]);

    const processText = useCallback((text: string): string => {
        let processed = text;
        Object.entries(sectionVariables).forEach(([id, value]) => {
            const pattern = new RegExp(`\\[${id.replace(/[-\/\\^$*+?.()|\\[\\]{}]/g, '\\$&')}\\]`, 'g');
            // Use function replacement to avoid $ character misinterpretation
            processed = processed.replace(pattern, () => value || `[${id}]`);
        });
        return processed;
    }, [sectionVariables]);

    // Load section content when switching sections
    useEffect(() => {
        if (!editor || !section || isLoadingContentRef.current) return;

        // Save PREVIOUS section content before switching
        const prevKey = `${selectedGuideId}_${prevSectionIndexRef.current}`;
        if (prevKey !== `${selectedGuideId}_${currentSectionIndex}` && editor.getHTML() && editor.getText().trim().length > 0) {
            setSectionContent(prev => ({ ...prev, [prevKey]: editor.getHTML() }));
        }

        // Update ref to current index
        prevSectionIndexRef.current = currentSectionIndex;

        // Load NEW section content
        const newKey = `${selectedGuideId}_${currentSectionIndex}`;
        isLoadingContentRef.current = true;
        
        if (sectionContent[newKey]) {
            editor.commands.setContent(sectionContent[newKey]);
        } else if (approvedSections[newKey]) {
            editor.commands.setContent(approvedSections[newKey]);
        } else if (section.defaultContent) {
            editor.commands.setContent(processText(section.defaultContent));
        } else {
            editor.commands.clearContent();
        }
        
        // Auto-apply all variables to editor content after loading
        setTimeout(() => {
            if (editor) {
                let html = editor.getHTML();
                let changed = false;
                Object.entries(sectionVariables).forEach(([id, value]) => {
                    const placeholder = `[${id}]`;
                    const pattern = new RegExp(placeholder.replace(/[-\/\\^$*+?.()|\\[\\]{}]/g, '\\$&'), 'g');
                    if (html.includes(placeholder) && value) {
                        html = html.replace(pattern, () => value);
                        changed = true;
                    }
                });
                if (changed) {
                    editor.commands.setContent(html);
                }
            }
        }, 100);
    }, [currentSectionIndex, selectedGuideId, section?.id, sectionContent, approvedSections, editor, processText]);

    const insertBlock = useCallback((text: string) => {
        if (!editor) return;
        const processed = processText(text);
        // Don't wrap in <p> if text already contains HTML tags (AI returns <p>...</p>)
        const content = processed.includes('<') ? processed : '<p>' + processed + '</p>';
        editor.chain().focus().insertContent(content).run();
    }, [editor, processText]);

    const insertBlockBefore = useCallback((text: string) => {
        if (!editor) return;
        const processed = processText(text);
        const current = editor.getHTML();
        const content = processed.includes('<') ? processed : '<p>' + processed + '</p>';
        editor.chain().focus().setContent(content + current).run();
    }, [editor, processText]);

    // Insert standardized test results (evaluations) into the current report section
    const insertEvaluations = useCallback(async () => {
        if (!editor || !patient?.id) return;
        try {
            // Prefer evaluations already on the patient prop; fall back to a fresh fetch
            let evals: any[] = (patient as any).evaluations || [];
            if (!evals.length) {
                const { data } = await supabase
                    .from('patients')
                    .select('evaluations')
                    .eq('id', patient.id)
                    .single();
                evals = (data?.evaluations as any[]) || [];
            }
            if (!evals.length) {
                addToast({ message: 'Este paciente no tiene evaluaciones cargadas.', type: 'error' });
                return;
            }
            const rows = evals.map(e =>
                `<tr><td>${e.testName || 'Test'}</td><td>${e.score ?? '-'}${e.maxScore ? ' / ' + e.maxScore : ''}</td><td>${e.notes || ''}</td><td>${e.date || ''}</td></tr>`
            ).join('');
            const table = `<p><strong>Resultados de evaluaciones estandarizadas</strong></p>` +
                `<table><thead><tr><th>Test</th><th>Puntaje</th><th>Observaciones</th><th>Fecha</th></tr></thead><tbody>${rows}</tbody></table>`;
            editor.chain().focus().insertContent(table).run();
            addToast({ message: `Se insertaron ${evals.length} evaluaciones en el informe.`, type: 'success' });
        } catch (err: any) {
            addToast({ message: 'Error al insertar evaluaciones: ' + (err?.message || ''), type: 'error' });
        }
    }, [editor, patient, supabase, addToast]);

    const saveCurrentContent = useCallback(() => {
        if (editor) {
            setSectionContent(prev => ({ ...prev, [sectionKey]: editor.getHTML() }));
        }
    }, [editor, sectionKey]);

    // APPROVE SECTION → saves and moves to preview
    const approveSection = useCallback(() => {
        if (!editor) return;
        const html = editor.getHTML();
        if (!html || editor.getText().trim().length < 5) {
            addToast({ message: 'Escribí algo antes de aprobar la sección', type: 'error' });
            return;
        }
        // Save to both state objects synchronously
        setSectionContent(prev => ({ ...prev, [sectionKey]: html }));
        setApprovedSections(prev => ({ ...prev, [sectionKey]: html }));
        addToast({ message: `Sección "${section.title}" aprobada ✓`, type: 'success' });
        // Auto-advance to next section
        if (currentSectionIndex < guide.sections.length - 1) {
            // Small delay to ensure state is saved before effect runs
            setTimeout(() => setCurrentSectionIndex(currentSectionIndex + 1), 50);
        }
    }, [editor, sectionKey, section.title, currentSectionIndex, guide.sections.length]);

    const unapproveSection = useCallback((key: string) => {
        setApprovedSections(prev => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
        addToast({ message: 'Sección removida del informe', type: 'success' });
    }, []);

    // AI Actions
    const runAiAction = async (action: AiAction) => {
        if (!editor || isAiLoading) return;
        setAiAction(action);
        setIsAiLoading(true);
        try {
            const currentContent = editor.getText();
            let result = '';
            switch (action) {
                case 'generate':
                    result = await aiReportService.generateSectionText({
                        prompt: `Generá el contenido para "${section.title}". ${section.explicacion}. ${currentContent ? `Ya tengo: ${currentContent}` : 'Generá desde cero.'}`,
                        patientName: patient.name, patientAge: patient.age, patientDiagnosis: patient.diagnosis,
                        section: section.title, patient, reportType: guide.title,
                    });
                    editor.chain().focus().clearContent().insertContent(result).run();
                    break;
                case 'improve':
                    if (!currentContent.trim()) { addToast({ message: 'Escribí algo primero', type: 'error' }); return; }
                    result = await aiReportService.improveText(currentContent, patient.name, patient);
                    editor.chain().focus().clearContent().insertContent(result).run();
                    break;
                case 'complete':
                    if (!currentContent.trim()) { addToast({ message: 'Escribí algo para completar', type: 'error' }); return; }
                    result = await aiReportService.completeText(currentContent, section.title, patient);
                    editor.chain().focus().insertContent(result).run();
                    break;
                case 'formal': case 'tecnico': case 'familiar':
                    if (!currentContent.trim()) { addToast({ message: 'Escribí algo primero', type: 'error' }); return; }
                    result = await aiReportService.changeTone(currentContent, action);
                    editor.chain().focus().clearContent().insertContent(result).run();
                    break;
            }
            if (result) addToast({ message: 'IA: Texto generado', type: 'success' });
        } catch (err: any) { addToast({ message: `Error IA: ${err.message}`, type: 'error' }); }
        finally { setIsAiLoading(false); setAiAction(null); }
    };

    const loadAiBlocks = async () => {
        setIsAiLoading(true);
        try {
            const blocks = await aiReportService.suggestBlocks(section.title, patient, guide.title);
            setAiSuggestedBlocks(blocks);
        } catch (err: any) { addToast({ message: `Error: ${err.message}`, type: 'error' }); }
        finally { setIsAiLoading(false); }
    };

    const handleGenerateFullReport = async () => {
        const confirmed = window.confirm(
            `¿Generar el informe completo "${guide.title}" para ${patient.name}?\n\n` +
            `Esto reemplazará todo el contenido actual del editor con un informe generado por IA. ` +
            `Podrás revisar y editar cada sección después.`
        );
        if (!confirmed) return;

        setIsGeneratingFullReport(true);
        setGenerationProgress({ step: 'Conectando con IA clínica...', progress: 5 });
        try {
            setGenerationProgress({ step: 'Analizando anamnesis, evaluaciones y sesiones...', progress: 20 });
            const sections = await aiReportService.generateFullReport({
                name: patient.name,
                age: patient.age,
                diagnosis: patient.diagnosis,
                history: patient.history,
                evaluations: patient.evaluations,
                anamnesis: patient.anamnesis,
                notes: patient.notes,
                treatmentPlan: patient.treatmentPlan,
            }, guide.title, guide.sections.map(s => ({ id: s.id, title: s.title, description: s.explicacion })));

            setGenerationProgress({ step: 'Verificando marco legal PBA (Ley 15.052)...', progress: 50 });
            await new Promise(r => setTimeout(r, 300)); // Small delay for UX

            setGenerationProgress({ step: 'Redactando secciones con datos reales...', progress: 70 });

            const newSectionContent: Record<string, string> = {};
            const newApprovedSections: Record<string, string> = {};

            guide.sections.forEach((s, idx) => {
                const key = `${selectedGuideId}_${idx}`;
                const normalize = (str: string) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
                const sectionId = normalize(s.id);
                const content = sections[s.id] ||
                    Object.entries(sections).find(([k]) => {
                        const nk = normalize(k);
                        return nk === sectionId ||
                            nk.includes(sectionId) ||
                            sectionId.includes(nk) ||
                            (sectionId.includes('info') && nk.includes('info')) ||
                            (sectionId.includes('motivo') && nk.includes('motivo')) ||
                            (sectionId.includes('comportamiento') && (nk.includes('comportamiento') || nk.includes('actitud'))) ||
                            (sectionId.includes('habla') && nk.includes('habla')) ||
                            (sectionId.includes('voz') && nk.includes('voz')) ||
                            (sectionId.includes('juego') && nk.includes('juego')) ||
                            (sectionId.includes('pragmat') && nk.includes('pragmat')) ||
                            (sectionId.includes('comprensivo') && (nk.includes('comprens') || nk.includes('receptiv'))) ||
                            (sectionId.includes('morfosintaxis') && (nk.includes('morfosintaxis') || nk.includes('expresivo_morf'))) ||
                            (sectionId.includes('semantica') && (nk.includes('semant') || nk.includes('expresivo_sem'))) ||
                            (sectionId.includes('motricidad') && (nk.includes('motricidad') || nk.includes('orofacial'))) ||
                            (sectionId.includes('impresion') && nk.includes('impresion')) ||
                            (sectionId.includes('pronostico') && nk.includes('pronostico')) ||
                            (sectionId.includes('objetivos') && nk.includes('objetivo')) ||
                            (sectionId.includes('recomendacion') && nk.includes('recomendacion')) ||
                            (sectionId.includes('antecedente') && nk.includes('antecedente')) ||
                            (sectionId.includes('resultados') && (nk.includes('resultado') || nk.includes('evaluacion')));
                    })?.[1] || '';
                if (content) {
                    newSectionContent[key] = content;
                    newApprovedSections[key] = content;
                }
            });

            setGenerationProgress({ step: 'Finalizando y validando contenido...', progress: 90 });
            await new Promise(r => setTimeout(r, 200));

            setSectionContent(prev => ({ ...prev, ...newSectionContent }));
            setApprovedSections(prev => ({ ...prev, ...newApprovedSections }));

            const filledCount = Object.keys(newApprovedSections).length;
            setGenerationProgress({ step: `¡Completado! ${filledCount} secciones generadas`, progress: 100 });
            await new Promise(r => setTimeout(r, 800));
            setGenerationProgress(null);

            addToast({
                message: `Informe generado: ${filledCount}/${guide.sections.length} secciones completadas ✓`,
                type: filledCount > 0 ? 'success' : 'warning'
            });

            const firstEmptyIdx = guide.sections.findIndex((_, idx) =>
                !newApprovedSections[`${selectedGuideId}_${idx}`]
            );
            if (firstEmptyIdx >= 0) {
                setCurrentSectionIndex(firstEmptyIdx);
            }
        } catch (err: any) {
            setGenerationProgress(null);
            addToast({ message: `Error generando informe: ${err.message}`, type: 'error' });
        } finally {
            setIsGeneratingFullReport(false);
        }
    };

    const toggleDictation = async () => {
        if (isListening) { mediaRecorderRef.current?.stop(); setIsListening(false); return; }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioChunksRef.current = [];
            const mr = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4' });
            mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
            mr.onstop = async () => {
                stream.getTracks().forEach(t => t.stop());
                setIsTranscribing(true);
                try {
                    const blob = new Blob(audioChunksRef.current, { type: mr.mimeType });
                    const text = await voiceService.transcribe(blob);
                    if (editor) editor.chain().focus().insertContent(text).run();
                    addToast({ message: 'Transcripción insertada', type: 'success' });
                } catch (err: any) { addToast({ message: 'Error: ' + err.message, type: 'error' }); }
                finally { setIsTranscribing(false); }
            };
            mr.start(); setIsListening(true); mediaRecorderRef.current = mr;
        } catch (err: any) { addToast({ message: 'Error micrófono: ' + err.message, type: 'error' }); }
    };

    const handleSave = async () => {
        // Save all approved sections + current
        saveCurrentContent();
        const allContent: Record<string, string> = { ...sectionContent };
        if (editor?.getHTML()) allContent[sectionKey] = editor.getHTML();

        // Build full HTML from approved sections in order
        const fullHtml = guide.sections.map((s, i) => {
            const key = `${selectedGuideId}_${i}`;
            return approvedSections[key] || allContent[key] || '';
        }).filter(Boolean).join('<br/>');

        if (!fullHtml || fullHtml.replace(/<[^>]*>/g, '').trim().length < 20) {
            addToast({ message: 'El informe está vacío', type: 'error' });
            return;
        }
        setIsSaving(true);
        try {
            const reportData = {
                patient_id: patient.id,
                title: `${guide.title} - ${patient.name}`,
                type: selectedGuideId,
                content: fullHtml,
                clinical_snapshot: { diagnosis: patient.diagnosis, age: patient.age, variables: sectionVariables, approvedSections },
                version: 1, author_id: currentUserId || null
            };
            const { error } = await supabase.from('reports').insert([reportData]);
            if (error) throw error;
            if (onSave) await onSave(reportData);
            addToast({ message: 'Informe guardado', type: 'success' });
            onClose();
        } catch (err: any) { addToast({ message: 'Error: ' + err.message, type: 'error' }); }
        finally { setIsSaving(false); }
    };

    const handleExportPdf = async () => {
        // Build full HTML from approved + current
        const allContent: Record<string, string> = { ...sectionContent };
        if (editor?.getHTML()) allContent[sectionKey] = editor.getHTML();

        const fullHtml = guide.sections.map((s, i) => {
            const key = `${selectedGuideId}_${i}`;
            return approvedSections[key] || allContent[key] || '';
        }).filter(Boolean).join('<br/>');

        if (!fullHtml || fullHtml.replace(/<[^>]*>/g, '').trim().length < 20) {
            addToast({ message: 'El informe está vacío', type: 'error' });
            return;
        }
        setIsExporting(true);
        try {
            await exportReportToPdf({
                title: guide.title, patientName: patient.name, patientAge: patient.age,
                patientDiagnosis: patient.diagnosis, content: fullHtml,
                fileName: `${guide.title}_${patient.name}`,
                signatureImage,
                professionalName: sectionVariables['PROFESIONAL_NOMBRE'] || '',
                professionalTitle: sectionVariables['PROFESIONAL_TITULO'] || '',
                professionalLicense: sectionVariables['PROFESIONAL_MATE'] || '',
            });
            addToast({ message: 'PDF exportado', type: 'success' });
        } catch (err: any) { addToast({ message: 'Error: ' + err.message, type: 'error' }); }
        finally { setIsExporting(false); }
    };

    const handlePrint = () => {
        window.print();
    };

    const handleVariableChange = (varId: string, value: string) => {
        setSectionVariables(prev => {
            const newVars = { ...prev, [varId]: value };
            if (editor) {
                const html = editor.getHTML();
                const placeholder = `[${varId}]`;
                if (html.includes(placeholder)) {
                    const pattern = new RegExp(placeholder.replace(/[-\/\\^$*+?.()|\\[\\]{}]/g, '\\$&'), 'g');
                    const newHtml = html.replace(pattern, () => value || placeholder);
                    editor.commands.setContent(newHtml);
                }
            }
            return newVars;
        });
    };

    // Load a custom report template
    const [customTemplates, setCustomTemplates] = useState<ReportTemplate[]>([]);
    const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);

    const loadCustomTemplates = async () => {
        setIsLoadingTemplates(true);
        try {
            const templates = await reportTemplateService.getTemplates();
            setCustomTemplates(templates);
            addToast({ message: `${templates.length} plantillas cargadas`, type: 'success' });
        } catch (err: any) {
            addToast({ message: 'Error cargando plantillas: ' + err.message, type: 'error' });
        } finally {
            setIsLoadingTemplates(false);
        }
    };

    // Build preview HTML from approved sections — use proper block dividers
    const previewHtml = guide.sections.map((s, i) => {
        const key = `${selectedGuideId}_${i}`;
        const content = approvedSections[key] || '';
        if (!content) return '';
        return `<div style="margin-bottom:1.5em;"><h2 style="font-size:12pt;font-weight:700;color:#0891b2;text-transform:uppercase;letter-spacing:0.05em;border-bottom:1px solid rgba(8,145,178,0.3);padding-bottom:4px;margin-top:1.5em;margin-bottom:0.75em;">${s.title}</h2>${content}</div>`;
    }).filter(Boolean).join('');

    const approvedCount = Object.keys(approvedSections).length;

    useEffect(() => { return () => editor?.destroy(); }, [editor]);
    if (!editor) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950">
                <div className="flex flex-col items-center gap-3">
                    <Loader2 className="animate-spin text-indigo-500" size={32} />
                    <p className="text-sm text-slate-400 font-medium">Cargando constructor de informes...</p>
                </div>
            </div>
        );
    }

    const totalWords = Object.values(approvedSections).reduce((acc, html) => acc + html.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length, 0)
        + editor.getText().split(/\s+/).filter(Boolean).length;

    return (
        <div className="fixed inset-0 z-50 flex bg-slate-950 animate-in fade-in duration-300">
            {/* SIDEBAR */}
            {showSidebar && (
                <div className="w-80 bg-white border-r border-slate-200 flex flex-col overflow-hidden shrink-0">
                    <div className="p-4 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-blue-50">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white"><FileText size={16} /></div>
                                <div><h3 className="font-bold text-sm text-slate-800">Constructor IA</h3><p className="text-[10px] text-slate-400">FonoAudio Pro AI</p></div>
                            </div>
                            <button onClick={() => setShowSidebar(false)} className="p-1.5 hover:bg-white rounded-lg text-slate-400"><PanelLeftClose size={16} /></button>
                        </div>
                        <select value={selectedGuideId} onChange={(e) => { saveCurrentContent(); setSelectedGuideId(e.target.value); setCurrentSectionIndex(0); setAiSuggestedBlocks([]); }}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium outline-none focus:border-indigo-400">
                            {Object.entries(REPORT_GUIDES).map(([id, g]) => <option key={id} value={id}>{g.title}</option>)}
                        </select>
                    </div>

                    {/* Clinical Data */}
                    <button onClick={() => setShowClinicalData(!showClinicalData)} className="flex items-center justify-between px-4 py-2 bg-emerald-50 border-b border-emerald-100 hover:bg-emerald-100 transition-all">
                        <div className="flex items-center gap-2"><Stethoscope size={13} className="text-emerald-600" /><span className="text-[10px] font-bold text-emerald-700">Datos del Paciente</span></div>
                        {showClinicalData ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>
                    {showClinicalData && (
                        <div className="p-2 border-b border-slate-100 bg-emerald-50/30 max-h-40 overflow-y-auto">
                            <div className="grid grid-cols-2 gap-1 text-[9px]">
                                <div className="p-1.5 bg-white rounded border border-emerald-100"><span className="font-bold text-emerald-600">Nombre</span><p className="text-slate-700">{patient.name}</p></div>
                                <div className="p-1.5 bg-white rounded border border-emerald-100"><span className="font-bold text-emerald-600">Edad</span><p className="text-slate-700">{patient.age} años</p></div>
                                <div className="p-1.5 bg-white rounded border border-emerald-100"><span className="font-bold text-emerald-600">Dx</span><p className="text-slate-700 truncate">{patient.diagnosis || 'N/A'}</p></div>
                                <div className="p-1.5 bg-white rounded border border-emerald-100"><span className="font-bold text-emerald-600">Doc</span><p className="text-slate-700">{patient.document || 'N/A'}</p></div>
                            </div>
                        </div>
                    )}

                    {/* Section Progress */}
                    <div className="px-3 pt-3 pb-2 border-b border-slate-100">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-[9px] font-bold text-slate-500 uppercase">Secciones</span>
                            <span className="text-[9px] font-bold text-emerald-600">{approvedCount}/{guide.sections.length} aprobadas</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 mb-2">
                            <div className="bg-emerald-500 h-1.5 rounded-full transition-all" style={{ width: `${(approvedCount / guide.sections.length) * 100}%` }} />
                        </div>
                        <div className="flex gap-1 flex-wrap">
                            {guide.sections.map((s, idx) => {
                                const key = `${selectedGuideId}_${idx}`;
                                const approved = !!approvedSections[key];
                                const isCurrent = idx === currentSectionIndex;
                                return (
                                    <button key={s.id} onClick={() => { saveCurrentContent(); setCurrentSectionIndex(idx); setAiSuggestedBlocks([]); }}
                                        className={`px-2 py-0.5 rounded-md text-[8px] font-bold whitespace-nowrap transition-all flex items-center gap-1 ${
                                            isCurrent ? 'bg-indigo-600 text-white shadow-sm' : approved ? 'bg-emerald-100 text-emerald-700 border border-emerald-300' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                        }`}>
                                        {approved && <CircleCheck size={8} />}
                                        {s.title}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Sidebar Content */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                        <div className="p-2.5 bg-indigo-50 rounded-xl border border-indigo-100">
                            <p className="text-[10px] font-bold text-indigo-600 uppercase mb-1">{section.title}</p>
                            <p className="text-[9px] text-indigo-700/70 leading-relaxed">{section.explicacion}</p>
                        </div>

                        {section.options && section.options.length > 0 && (
                            <div className="space-y-1.5">
                                <p className="text-[8px] font-black text-slate-400 uppercase">Opciones de Párrafo</p>
                                {section.options.map((opt, idx) => {
                                    const isActive = activeScenarios[section.id] === opt.label;
                                    const dot = opt.level === 'adecuado' || opt.level === 'favorable' ? 'bg-emerald-500' : opt.level === 'leve' || opt.level === 'reservado' ? 'bg-amber-500' : 'bg-red-500';
                                    return (
                                        <button key={idx} onClick={() => { setActiveScenarios(p => ({ ...p, [section.id]: opt.label })); insertBlock(opt.text); }}
                                            className={`w-full text-left p-2 border-2 rounded-lg transition-all ${isActive ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-white hover:border-indigo-200'}`}>
                                            <div className="flex items-center justify-between mb-0.5">
                                                <div className="flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${dot}`} /><span className="text-[9px] font-bold text-slate-600">{opt.label}</span></div>
                                                {isActive ? <Check size={9} className="text-indigo-500" /> : <Plus size={9} className="text-slate-300" />}
                                            </div>
                                            <p className="text-[8px] text-slate-400 line-clamp-2">{opt.text.substring(0, 80)}...</p>
                                        </button>
                                    );
                                })}
                            </div>
                        )}

                        {section.variables && section.variables.length > 0 && (
                            <div className="space-y-1.5 p-2 bg-amber-50 rounded-xl border border-amber-200">
                                <p className="text-[8px] font-black text-amber-600 uppercase flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block" /> Completar (en rojo en el texto)
                                </p>
                                {section.variables.map(v => (
                                    <div key={v.id}>
                                        <label className="text-[8px] font-bold text-amber-700 mb-0.5 block">{v.label}</label>
                                        <input type="text" value={sectionVariables[v.id] || v.defaultValue || ''} onChange={(e) => handleVariableChange(v.id, e.target.value)} placeholder={v.placeholder}
                                            className="w-full px-2 py-1 bg-white border border-amber-200 rounded text-[9px] outline-none focus:border-amber-400" />
                                    </div>
                                ))}
                            </div>
                        )}

                        {aiSuggestedBlocks.length > 0 && (
                            <div className="space-y-1.5">
                                <p className="text-[8px] font-black text-purple-500 uppercase flex items-center gap-1"><Sparkles size={8} /> Sugeridos por IA</p>
                                {aiSuggestedBlocks.map((block, idx) => (
                                    <button key={idx} onClick={() => insertBlock(block)}
                                        className="w-full text-left p-2 bg-gradient-to-r from-purple-50 to-violet-50 border border-purple-200 rounded-lg hover:border-purple-400 transition-all group">
                                        <div className="flex items-center justify-between mb-0.5">
                                            <span className="text-[8px] font-bold text-purple-600">Sugerencia {idx + 1}</span>
                                            <div className="flex items-center gap-1">
                                                <button onClick={(e) => { e.stopPropagation(); insertBlockBefore(block); }} className="p-0.5 text-purple-300 hover:text-purple-600"><CornerDownLeft size={8} /></button>
                                                <Plus size={9} className="text-purple-300 group-hover:text-purple-600" />
                                            </div>
                                        </div>
                                        <p className="text-[8px] text-purple-700/70 line-clamp-2">{block.replace(/<[^>]*>/g, ' ').substring(0, 100)}...</p>
                                    </button>
                                ))}
                            </div>
                        )}

                        <button onClick={loadAiBlocks} disabled={isAiLoading}
                            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-gradient-to-r from-violet-500 to-purple-500 text-white rounded-xl text-[9px] font-bold hover:from-violet-600 hover:to-purple-600 transition-all disabled:opacity-50">
                            {isAiLoading ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                            Generar con IA
                        </button>

                        <button onClick={handleGenerateFullReport} disabled={isGeneratingFullReport || isAiLoading}
                            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl text-[9px] font-bold hover:from-emerald-600 hover:to-teal-600 transition-all disabled:opacity-50 shadow-sm">
                            {isGeneratingFullReport ? <Loader2 size={10} className="animate-spin" /> : <Brain size={10} />}
                            {isGeneratingFullReport ? 'Generando informe...' : 'Generar Informe Completo'}
                        </button>

                        {generationProgress && (
                            <div className="w-full space-y-1.5 p-2 bg-indigo-50 border border-indigo-200 rounded-xl animate-in fade-in">
                                <div className="flex items-center justify-between text-[8px]">
                                    <span className="font-bold text-indigo-700">{generationProgress.step}</span>
                                    <span className="font-mono text-indigo-600">{generationProgress.progress}%</span>
                                </div>
                                <div className="w-full bg-indigo-100 rounded-full h-1.5 overflow-hidden">
                                    <div className="bg-gradient-to-r from-indigo-500 to-cyan-500 h-1.5 rounded-full transition-all duration-300"
                                        style={{ width: `${generationProgress.progress}%` }} />
                                </div>
                            </div>
                        )}

                        {/* AI Diagnosis Suggestion */}
                        <button onClick={async () => {
                            const diag = await aiReportService.suggestDiagnosis(patient);
                            if (editor) {
                                const html = `<h3 style="font-size:11pt;font-weight:700;color:#0891b2;border-bottom:1px solid rgba(8,145,178,0.3);padding-bottom:4px;margin:1em 0 0.5em;">Impresión Diagnóstica (Sugerida por IA)</h3>${diag}`;
                                editor.chain().focus().insertContent(html).run();
                            }
                            addToast({ message: 'Diagnóstico funcional sugerido insertado', type: 'success' });
                        }} disabled={isAiLoading}
                            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl text-[9px] font-bold hover:from-amber-600 hover:to-orange-600 transition-all disabled:opacity-50 shadow-sm">
                            {isAiLoading ? <Loader2 size={10} className="animate-spin" /> : <Stethoscope size={10} />}
                            Sugerir Diagnóstico CIE-11
                        </button>

                        {/* Template System */}
                        <div className="border-t border-slate-100 pt-2.5 mt-1">
                            <div className="flex items-center justify-between mb-1.5">
                                <p className="text-[8px] font-black text-slate-400 uppercase">Plantillas Personalizadas</p>
                                <button onClick={loadCustomTemplates} disabled={isLoadingTemplates}
                                    className="text-[8px] text-indigo-500 hover:text-indigo-700 font-bold transition-colors">
                                    {isLoadingTemplates ? 'Cargando...' : 'Cargar'}
                                </button>
                            </div>
                            {customTemplates.length > 0 ? (
                                <div className="space-y-1">
                                    {customTemplates.map(t => (
                                        <button key={t.id}
                                            onClick={() => {
                                                // Apply custom template: merge sections into current content
                                                if (t.sections && t.sections.length > 0) {
                                                    const templateContent = t.sections
                                                        .sort((a: any, b: any) => (a.order || 0) - (b.order || 0))
                                                        .map((s: any) => {
                                                            const processedTitle = processText(s.title || '');
                                                            const processedDesc = processText(s.description || '');
                                                            const processedDefault = processText(s.default_content || '');
                                                            return `<h3>${processedTitle}</h3><p>${processedDesc}</p>${processedDefault ? `<p>${processedDefault}</p>` : ''}`;
                                                        })
                                                        .join('<br>');
                                                    editor?.commands.setContent(templateContent);
                                                    addToast({ message: `Plantilla "${t.name}" aplicada`, type: 'success' });
                                                } else {
                                                    addToast({ message: `Plantilla "${t.name}" sin secciones definidas`, type: 'warning' });
                                                }
                                            }}
                                            className="w-full text-left p-2 bg-slate-50 border border-slate-200 rounded-lg hover:border-indigo-300 transition-all">
                                            <p className="text-[9px] font-bold text-slate-700">{t.name}</p>
                                            <p className="text-[8px] text-slate-400">{t.area} · {t.type} · {t.target_age}</p>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-[8px] text-slate-400 text-center py-2">
                                    No hay plantillas cargadas. Creá una desde el Administrador de Plantillas.
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* MAIN AREA */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Top Bar */}
                <div className="px-3 py-2 border-b border-slate-200 bg-white flex flex-wrap md:flex-nowrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 overflow-hidden">
                        {!showSidebar && <button onClick={() => setShowSidebar(true)} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 shrink-0"><PanelLeftOpen size={16} /></button>}
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 truncate">
                            <span className="font-bold text-slate-700 truncate">{guide.title}</span>
                            <ChevronRight size={10} className="shrink-0" />
                            <span className="text-indigo-600 font-medium truncate">{section.title}</span>
                        </div>
                        {isCurrentApproved && <span className="hidden sm:inline-flex px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full items-center gap-1 shrink-0"><CircleCheck size={10} />Aprobada</span>}
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap md:flex-nowrap justify-end w-full md:w-auto">
                        <div className="hidden lg:flex items-center gap-1">
                            <button onClick={() => runAiAction('generate')} disabled={isAiLoading} className="flex items-center gap-1 px-2.5 py-1.5 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg text-xs font-bold hover:from-blue-600 hover:to-cyan-600 transition-all disabled:opacity-50 min-h-[36px]">
                                {isAiLoading && aiAction === 'generate' ? <Loader2 size={12} className="animate-spin" /> : <Wand2 size={12} />}Generar
                            </button>
                            <button onClick={() => runAiAction('improve')} disabled={isAiLoading} className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 transition-all disabled:opacity-50 min-h-[36px]">
                                {isAiLoading && aiAction === 'improve' ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}Mejorar
                            </button>
                            <button onClick={() => runAiAction('complete')} disabled={isAiLoading} className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 transition-all disabled:opacity-50 min-h-[36px]">
                                {isAiLoading && aiAction === 'complete' ? <Loader2 size={12} className="animate-spin" /> : <Brain size={12} />}Completar
                            </button>
                            <button onClick={() => insertEvaluations()} className="flex items-center gap-1 px-2.5 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 transition-all min-h-[36px]">
                                <FileCheck size={12} />Evaluaciones
                            </button>
                        </div>
                        <div className="w-px h-6 bg-slate-200 mx-1 hidden lg:block" />
                        <button onClick={toggleDictation} disabled={isTranscribing}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all min-h-[36px] ${isListening ? 'bg-red-100 text-red-600 border border-red-200 animate-pulse' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                            {isListening ? <MicOff size={12} /> : <Mic size={12} />}{isListening ? 'Detener' : 'Dictar'}
                        </button>
                        <button onClick={() => setShowSignaturePad(true)}
                            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all min-h-[36px] ${signatureImage ? 'bg-indigo-100 text-indigo-700 border border-indigo-300' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                            <Pen size={12} />{signatureImage ? 'Firmado' : 'Firmar'}
                        </button>
                        <button onClick={handleExportPdf} disabled={isExporting} className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 transition-all disabled:opacity-50 min-h-[36px]">
                            {isExporting ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}PDF
                        </button>
                        <button onClick={handleSave} disabled={isSaving} className="flex items-center gap-1 px-3.5 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 transition-all disabled:opacity-50 shadow-sm min-h-[36px]">
                            {isSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}Guardar
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 min-h-[36px] min-w-[36px] flex items-center justify-center"><X size={18} /></button>
                    </div>
                </div>

                {/* EDITOR + PREVIEW */}
                <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                    {/* Mobile Tab Switcher */}
                    <div className="md:hidden flex bg-slate-100 border-b border-slate-200 shrink-0">
                        <button onClick={() => setMobileView('editor')} className={`flex-1 py-2 text-xs font-bold text-center ${mobileView === 'editor' ? 'bg-white text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-600'}`}>
                            Editor de Sección
                        </button>
                        <button onClick={() => setMobileView('preview')} className={`flex-1 py-2 text-xs font-bold text-center ${mobileView === 'preview' ? 'bg-white text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-600'}`}>
                            Vista Previa ({approvedCount})
                        </button>
                    </div>

                    {/* Editor */}
                    <div className={`${mobileView === 'editor' ? 'flex' : 'hidden'} md:flex ${showPreview ? 'md:w-1/2' : 'w-full'} flex-col border-r border-slate-200 transition-all h-full overflow-y-auto`}>
                        {/* Print styles */}
                        <style>{`
                            @media print {
                                body * { visibility: hidden !important; }
                                .editor-print-content, .editor-print-content * { visibility: visible !important; }
                                .editor-print-content { position: absolute; left: 0; top: 0; width: 100%; padding: 40px; }
                                .no-print { display: none !important; }
                            }
                        `}</style>

                        {/* TOOLBAR ROW 1: Formatting + Document Actions */}
                        <div className="flex items-center gap-0.5 px-2 py-1 border-b border-slate-100 bg-slate-50/50 flex-wrap">
                            {/* Typography Group */}
                            <div className="flex items-center gap-0.5">
                                <button onClick={() => editor.chain().focus().toggleBold().run()} className={`p-1 rounded ${editor.isActive('bold') ? 'bg-indigo-100 text-indigo-700' : 'text-slate-400 hover:bg-slate-200'}`} title="Negrita"><Bold size={12} /></button>
                                <button onClick={() => editor.chain().focus().toggleItalic().run()} className={`p-1 rounded ${editor.isActive('italic') ? 'bg-indigo-100 text-indigo-700' : 'text-slate-400 hover:bg-slate-200'}`} title="Cursiva"><Italic size={12} /></button>
                                <button onClick={() => editor.chain().focus().toggleUnderline().run()} className={`p-1 rounded ${editor.isActive('underline') ? 'bg-indigo-100 text-indigo-700' : 'text-slate-400 hover:bg-slate-200'}`} title="Subrayado"><UnderlineIcon size={12} /></button>
                                <button onClick={() => editor.chain().focus().toggleStrike().run()} className={`p-1 rounded ${editor.isActive('strike') ? 'bg-indigo-100 text-indigo-700' : 'text-slate-400 hover:bg-slate-200'}`} title="Tachado"><Strikethrough size={12} /></button>
                            </div>
                            <div className="w-px h-4 bg-slate-200 mx-0.5" />

                            {/* Headings Group */}
                            <div className="flex items-center gap-0.5">
                                <button onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={`px-1.5 py-0.5 rounded text-[9px] font-black ${editor.isActive('heading', { level: 1 }) ? 'bg-indigo-100 text-indigo-700' : 'text-slate-400 hover:bg-slate-200'}`} title="Título principal">H1</button>
                                <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${editor.isActive('heading', { level: 2 }) ? 'bg-indigo-100 text-indigo-700' : 'text-slate-400 hover:bg-slate-200'}`} title="Subtítulo">H2</button>
                                <button onClick={() => editor.chain().focus().setParagraph().run()} className={`px-1.5 py-0.5 rounded text-[9px] ${editor.isActive('paragraph') && !editor.isActive('heading') ? 'bg-indigo-100 text-indigo-700' : 'text-slate-400 hover:bg-slate-200'}`} title="Párrafo">¶</button>
                            </div>
                            <div className="w-px h-4 bg-slate-200 mx-0.5" />

                            {/* Lists Group */}
                            <div className="flex items-center gap-0.5">
                                <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={`p-1 rounded ${editor.isActive('bulletList') ? 'bg-indigo-100 text-indigo-700' : 'text-slate-400 hover:bg-slate-200'}`} title="Viñetas"><List size={12} /></button>
                                <button onClick={() => editor.chain().focus().toggleOrderedList().run()} className={`p-1 rounded ${editor.isActive('orderedList') ? 'bg-indigo-100 text-indigo-700' : 'text-slate-400 hover:bg-slate-200'}`} title="Numerada"><ListOrdered size={12} /></button>
                            </div>
                            <div className="w-px h-4 bg-slate-200 mx-0.5" />

                            {/* Alignment Group */}
                            <div className="flex items-center gap-0.5">
                                <button onClick={() => editor.chain().focus().setTextAlign('left').run()} className={`p-1 rounded ${editor.isActive({ textAlign: 'left' }) ? 'bg-indigo-100 text-indigo-700' : 'text-slate-400 hover:bg-slate-200'}`} title="Izq"><AlignLeft size={12} /></button>
                                <button onClick={() => editor.chain().focus().setTextAlign('center').run()} className={`p-1 rounded ${editor.isActive({ textAlign: 'center' }) ? 'bg-indigo-100 text-indigo-700' : 'text-slate-400 hover:bg-slate-200'}`} title="Centro"><AlignCenter size={12} /></button>
                                <button onClick={() => editor.chain().focus().setTextAlign('right').run()} className={`p-1 rounded ${editor.isActive({ textAlign: 'right' }) ? 'bg-indigo-100 text-indigo-700' : 'text-slate-400 hover:bg-slate-200'}`} title="Der"><AlignRight size={12} /></button>
                            </div>
                            <div className="w-px h-4 bg-slate-200 mx-0.5" />

                            <button onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} className="p-1 rounded text-slate-400 hover:bg-slate-200" title="Tabla"><TableIcon size={12} /></button>
                            <div className="flex-1" />

                            {/* Undo/Redo Group */}
                            <div className="flex items-center gap-0.5">
                                <button onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} className="p-1 rounded text-slate-400 hover:bg-slate-200 disabled:opacity-30" title="Deshacer"><Undo size={11} /></button>
                                <button onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} className="p-1 rounded text-slate-400 hover:bg-slate-200 disabled:opacity-30" title="Rehacer"><Redo size={11} /></button>
                            </div>
                            <div className="w-px h-4 bg-slate-200 mx-0.5" />

                            {/* Document Actions Group */}
                            <div className="flex items-center gap-0.5">
                                <button onClick={handlePrint} className="p-1 rounded text-slate-400 hover:bg-slate-200" title="Imprimir"><Printer size={12} /></button>
                                <button onClick={handleExportPdf} disabled={isExporting} className="p-1 rounded text-slate-400 hover:bg-slate-200 disabled:opacity-30" title="Exportar PDF">
                                    {isExporting ? <Loader2 size={11} className="animate-spin" /> : <Download size={12} />}
                                </button>
                                <button onClick={handleSave} disabled={isSaving} className="p-1 rounded text-slate-400 hover:bg-slate-200 disabled:opacity-30" title="Guardar">
                                    {isSaving ? <Loader2 size={11} className="animate-spin" /> : <Save size={12} />}
                                </button>
                            </div>
                        </div>

                        {/* TOOLBAR ROW 2: Font Family, Size, Color */}
                        <div className="flex items-center gap-1.5 px-2 py-1 border-b border-slate-100 bg-white flex-wrap">
                            {/* Font Family */}
                            <div className="flex items-center gap-1">
                                <span className="text-[8px] text-slate-400 font-bold">Fuente:</span>
                                <select value={currentFontFamily} onChange={(e) => { setCurrentFontFamily(e.target.value); editor.chain().focus().setFontFamily(e.target.value).run(); }}
                                    className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[9px] outline-none focus:border-indigo-400 max-w-[120px]">
                                    {FONT_FAMILIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                                </select>
                            </div>

                            {/* Font Size */}
                            <div className="flex items-center gap-1">
                                <span className="text-[8px] text-slate-400 font-bold">Tamaño:</span>
                                <select value={currentFontSize} onChange={(e) => { setCurrentFontSize(e.target.value); editor.chain().focus().setFontSize(e.target.value).run(); }}
                                    className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[9px] outline-none focus:border-indigo-400 w-16">
                                    {FONT_SIZES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                </select>
                            </div>

                            <div className="w-px h-4 bg-slate-200" />

                            {/* Font Color */}
                            <div className="relative">
                                <button onClick={() => { setShowFontColor(!showFontColor); setShowBgColor(false); }}
                                    className="flex items-center gap-1 px-1.5 py-0.5 border border-slate-200 rounded hover:bg-slate-50 transition-all" title="Color de texto">
                                    <Palette size={10} className="text-slate-500" />
                                    <span className="w-3 h-3 rounded border border-slate-300" style={{ backgroundColor: FONT_COLORS[0] }} />
                                    <ChevronDown size={8} className="text-slate-400" />
                                </button>
                                {showFontColor && (
                                    <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl p-2 z-50 grid grid-cols-7 gap-1">
                                        {FONT_COLORS.map(color => (
                                            <button key={color} onClick={() => { editor.chain().focus().setColor(color).run(); setShowFontColor(false); }}
                                                className="w-5 h-5 rounded border border-slate-200 hover:scale-125 transition-transform" style={{ backgroundColor: color }} title={color} />
                                        ))}
                                        <button onClick={() => { editor.chain().focus().unsetColor().run(); setShowFontColor(false); }}
                                            className="col-span-7 text-[8px] text-slate-400 hover:text-slate-600 mt-0.5">Quitar color</button>
                                    </div>
                                )}
                            </div>

                            {/* Background Color */}
                            <div className="relative">
                                <button onClick={() => { setShowBgColor(!showBgColor); setShowFontColor(false); }}
                                    className="flex items-center gap-1 px-1.5 py-0.5 border border-slate-200 rounded hover:bg-slate-50 transition-all" title="Color de fondo">
                                    <Highlighter size={10} className="text-slate-500" />
                                    <ChevronDown size={8} className="text-slate-400" />
                                </button>
                                {showBgColor && (
                                    <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl p-2 z-50 w-40">
                                        {BG_COLORS.map(c => (
                                            <button key={c.value} onClick={() => {
                                                if (c.value) editor.chain().focus().toggleHighlight({ color: c.value }).run();
                                                else editor.chain().focus().unsetHighlight().run();
                                                setShowBgColor(false);
                                            }}
                                                className="w-full flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-100 text-[9px] text-slate-600 transition-all">
                                                <span className="w-4 h-4 rounded border border-slate-200" style={{ backgroundColor: c.value || 'white' }} />
                                                {c.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="w-px h-4 bg-slate-200" />

                            {/* Highlight shortcuts */}
                            <button onClick={() => editor.chain().focus().toggleHighlight({ color: '#fef08a' }).run()}
                                className={`p-1 rounded ${editor.isActive('highlight') ? 'bg-yellow-100 text-yellow-700' : 'text-slate-400 hover:bg-slate-200'}`} title="Resaltar">
                                <Highlighter size={12} />
                            </button>
                        </div>

                        {/* APPROVE BAR */}
                        <div className="flex items-center justify-between px-3 py-1.5 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-200">
                            <span className="text-[9px] text-amber-700 font-bold">Editando: {section.title}</span>
                            <button onClick={approveSection}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-[9px] font-bold hover:bg-emerald-600 transition-all shadow-sm">
                                <CircleCheck size={11} /> Aprobar sección
                            </button>
                        </div>

                        {/* Editor A4 */}
                        <div className="flex-1 overflow-y-auto p-6 bg-slate-100">
                            <div className="editor-print-content max-w-2xl mx-auto bg-white shadow-lg min-h-[700px] rounded-sm border border-slate-200"
                                style={{ fontFamily: currentFontFamily, padding: '40px 50px' }}>
                                <div className="text-center mb-6 pb-4 border-b-2 border-[#0891b2]">
                                    <h1 style={{ fontSize: '14pt', fontWeight: 700, color: '#0891b2', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{guide.title}</h1>
                                    <div className="mt-3 flex justify-center gap-6 text-slate-600" style={{ fontSize: '11pt' }}>
                                        <span><strong>Paciente:</strong> {patient.name}</span>
                                        <span><strong>Edad:</strong> {patient.age || 'N/A'} años</span>
                                        <span><strong>Fecha:</strong> {new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                                    </div>
                                    {patient.diagnosis && <p className="mt-1 text-slate-600" style={{ fontSize: '10pt' }}><strong>Diagnóstico:</strong> {patient.diagnosis}</p>}
                                </div>
                                <div style={{ fontSize: currentFontSize, lineHeight: '1.6', color: '#1e293b' }}>
                                    <EditorContent editor={editor} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* PREVIEW - Progressive (approved sections) */}
                    {showPreview && (
                        <div className={`${mobileView === 'preview' ? 'flex' : 'hidden'} md:flex ${showPreview ? 'md:w-1/2' : 'hidden'} flex-col bg-slate-200 h-full overflow-y-auto`}>
                            <div className="px-3 py-1.5 bg-white border-b border-slate-200 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Eye size={11} className="text-slate-400" />
                                    <span className="text-[9px] font-bold text-slate-500 uppercase">Vista Previa del Informe</span>
                                    <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[8px] font-bold rounded-full">{approvedCount} secciones</span>
                                </div>
                                <button onClick={() => setShowPreview(false)} className="p-0.5 hover:bg-slate-100 rounded text-slate-400"><EyeOff size={11} /></button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-4 flex justify-center">
                                <div className="bg-white shadow-2xl w-full max-w-[595px] min-h-[842px] text-[11px] text-slate-800 leading-relaxed"
                                    style={{ fontFamily: 'Calibri, Arial, sans-serif', padding: '40px 50px', aspectRatio: '1/1.41' }}>
                                    {/* Header */}
                                    <div className="text-center mb-6 pb-4 border-b-2 border-[#0891b2]">
                                        <h1 style={{ fontSize: '14pt', fontWeight: 700, color: '#0891b2', textTransform: 'uppercase' }}>{guide.title}</h1>
                                        <div className="mt-3 flex justify-center gap-4 text-xs text-slate-600">
                                            <span><strong>Paciente:</strong> {patient.name}</span>
                                            <span><strong>Edad:</strong> {patient.age} años</span>
                                            <span><strong>Fecha:</strong> {new Date().toLocaleDateString('es-AR')}</span>
                                        </div>
                                    </div>

                                    {/* Approved sections content */}
                                    {approvedCount === 0 ? (
                                        <div className="text-center py-16 text-slate-400">
                                            <FileCheck size={40} className="mx-auto mb-3 text-slate-300" />
                                            <p className="text-sm font-bold">Aún no hay secciones aprobadas</p>
                                            <p className="text-[10px] mt-1">Editá cada sección y hacé clic en "Aprobar sección" para que aparezca aquí</p>
                                        </div>
                                    ) : (
                                        guide.sections.map((s, i) => {
                                            const key = `${selectedGuideId}_${i}`;
                                            const content = approvedSections[key];
                                            if (!content) return null;
                                            return (
                                                <div key={key} className="group relative mb-4">
                                                    <h2 style={{ fontSize: '12pt', fontWeight: 700, color: '#0891b2', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid rgba(8,145,178,0.3)', paddingBottom: '4px', marginTop: '1.5em', marginBottom: '0.75em' }}>
                                                        {s.title}
                                                    </h2>
                                                    <div dangerouslySetInnerHTML={{ __html: content }} />
                                                    <button onClick={() => unapproveSection(key)}
                                                        className="absolute top-0 right-0 p-1 opacity-0 group-hover:opacity-100 bg-red-100 text-red-600 rounded hover:bg-red-200 transition-all"
                                                        title="Quitar del informe">
                                                        <Trash2 size={10} />
                                                    </button>
                                                </div>
                                            );
                                        })
                                    )}

                                    {/* Signature */}
                                    {approvedCount > 0 && (
                                        <div className="mt-8 pt-4 border-t border-slate-200">
                                            <p className="text-xs text-slate-500">Saluda atentamente,</p>
                                            <p className="mt-4 text-xs">
                                                <strong>{sectionVariables['PROFESIONAL_NOMBRE'] || ''}</strong>
                                                {sectionVariables['PROFESIONAL_NOMBRE'] && <br/>}
                                                {sectionVariables['PROFESIONAL_TITULO'] || ''}
                                                {sectionVariables['PROFESIONAL_TITULO'] && <br/>}
                                                {sectionVariables['PROFESIONAL_MATE'] || ''}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Status Bar */}
                <div className="px-3 py-1 border-t border-slate-200 bg-white flex items-center justify-between text-[8px] text-slate-400">
                    <div className="flex items-center gap-3">
                        <span>{editor.getText().length} chars</span>
                        <span>{editor.getText().split(/\s+/).filter(Boolean).length} palabras</span>
                        <span>{currentSectionIndex + 1}/{guide.sections.length}</span>
                        <span className="flex items-center gap-1"><FileCheck size={8} />{approvedCount}/{guide.sections.length} aprobadas</span>
                    </div>
                    <div className="flex items-center gap-2">
                        {isAiLoading && <span className="flex items-center gap-1 text-indigo-500 animate-pulse"><Loader2 size={8} className="animate-spin" />IA...</span>}
                        <button onClick={() => setShowAssistant(!showAssistant)} className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition-all ${showAssistant ? 'bg-indigo-100 text-indigo-600' : 'text-slate-400 hover:bg-slate-100'}`}>
                            <MessageSquare size={8} />Asistente
                        </button>
                    </div>
                </div>
            </div>

            {/* AI Assistant */}
            {showAssistant && (
                <AiAssistantBubble patient={patient} sectionTitle={section.title} reportType={guide.title} currentContent={editor.getText()}
                    onInsertText={(text) => { editor.chain().focus().insertContent('<p>' + text + '</p>').run(); addToast({ message: 'Insertado', type: 'success' }); }}
                    onReplaceText={(text) => { editor.chain().focus().clearContent().insertContent(text).run(); addToast({ message: 'Reemplazado', type: 'success' }); }}
                />
            )}

            {/* Signature Pad */}
            {showSignaturePad && (
                <SignaturePad
                    existingSignature={signatureImage}
                    onSave={(dataUrl) => { setSignatureImage(dataUrl); setShowSignaturePad(false); addToast({ message: 'Firma guardada', type: 'success' }); }}
                    onCancel={() => setShowSignaturePad(false)}
                />
            )}
        </div>
    );
};

export default ReportBuilderPro;

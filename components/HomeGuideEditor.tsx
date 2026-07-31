import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    Save, X, Plus, Trash2, ArrowUp, ArrowDown,
    FileText, Image as ImageIcon, Loader2, Sparkles, Search, AlertCircle,
    Mic, MicOff, Link, Video, Headphones, BookOpen, Eye,
    Send, Phone, MessageSquare, Bold, Italic, List, Hash, Quote, Printer
} from 'lucide-react';
import { HomeGuide, Patient, Material } from '../types';
import MaterialSelectorModal from './MaterialSelectorModal';
import EnrichmentProposalModal from './EnrichmentProposalModal';
import { getSuggestedMaterials } from '../utils/suggestionEngine';
import { MaterialAnalyticsService } from '../services/MaterialAnalyticsService';
import { GmailService } from '../services/gmailService';
import { arasaacService, ArasaacPictogram } from '../services/ArasaacService';
import { useToast } from '../context/ToastContext';
import { useAppStore } from '../store/appStore';
import { voiceService } from '../utils/voiceService';
import { supabase } from '../utils/supabaseClient';

interface HomeGuideEditorProps {
    guide: HomeGuide;
    patient: Patient;
    onSave: (updatedGuide: HomeGuide) => void;
    onCancel: () => void;
    onPreview: () => void;
    materials: Material[];
    materialsError?: boolean;
}

const HomeGuideEditor: React.FC<HomeGuideEditorProps> = ({ guide, patient, onSave, onCancel, onPreview, materials, materialsError }) => {
    const { addToast } = useToast();
    const userId = useAppStore(s => s.selectedPatientId); // Not used, we need the session user
    const sessionUserId = useAppStore.getState ? undefined : undefined; // Will get from context
    const [draft, setDraft] = useState<HomeGuide>(() => ({ ...guide, materialIds: guide.materialIds || [] }));
    const [isSaving, setIsSaving] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isEnrichmentModalOpen, setIsEnrichmentModalOpen] = useState(false);
    const [enrichmentSuggestions, setEnrichmentSuggestions] = useState<Material[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [showPictogramSearch, setShowPictogramSearch] = useState(false);
    const [pictogramQuery, setPictogramQuery] = useState('');
    const [arasaacResults, setArasaacResults] = useState<ArasaacPictogram[]>([]);
    const [isSearchingPictograms, setIsSearchingPictograms] = useState(false);
    const [showImageInsert, setShowImageInsert] = useState(false);
    const [imageUrlInput, setImageUrlInput] = useState('');
    const [showSendMenu, setShowSendMenu] = useState(false);
    const [internalSearchQuery, setInternalSearchQuery] = useState('');
    const [showInternalSearch, setShowInternalSearch] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const [isListening, setIsListening] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const [insertedImageUrls, setInsertedImageUrls] = useState<string[]>([]);

    useEffect(() => {
        setDraft({ ...guide, materialIds: guide.materialIds || [] });
    }, [guide]);

    const getStoredUserId = async (): Promise<string | null> => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            return user?.id || null;
        } catch { return null; }
    };

    const insertAtCursor = (text: string) => {
        const ta = textareaRef.current;
        if (!ta) {
            setDraft(prev => ({ ...prev, content: (prev.content || '') + text }));
            return;
        }
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const newContent = (draft.content || '').substring(0, start) + text + (draft.content || '').substring(end);
        setDraft(prev => ({ ...prev, content: newContent }));
        setTimeout(() => { ta.selectionStart = ta.selectionEnd = start + text.length; ta.focus(); }, 0);
    };

    const handleSearchPictograms = async () => {
        if (!pictogramQuery.trim()) return;
        setIsSearchingPictograms(true);
        try {
            const result = await arasaacService.search(pictogramQuery, 'es', 18);
            setArasaacResults(result.pictograms);
        } catch (err: any) {
            addToast({ message: 'Error buscando pictogramas: ' + err.message, type: 'error' });
        } finally { setIsSearchingPictograms(false); }
    };

    const handleInsertPictogram = (picto: ArasaacPictogram) => {
        insertAtCursor(`\n\n![${picto.label}](${picto.image_url})\n*${picto.label}*\n`);
        addToast({ message: `Pictograma "${picto.label}" insertado`, type: 'success' });
    };

    const handleInsertImageUrl = () => {
        if (!imageUrlInput.trim()) return;
        const url = imageUrlInput.trim();
        insertAtCursor(`\n\n![Imagen](${url})\n`);
        setInsertedImageUrls(prev => [...prev, url]);
        setImageUrlInput('');
        setShowImageInsert(false);
    };

    const handleInsertFormatting = (format: string) => {
        const ta = textareaRef.current;
        if (!ta) return;
        const start = ta.selectionStart;
        const end = ta.selectionEnd;
        const selected = (draft.content || '').substring(start, end);
        let replacement = '';
        switch (format) {
            case 'bold': replacement = `**${selected || 'texto'}**`; break;
            case 'italic': replacement = `*${selected || 'texto'}*`; break;
            case 'heading': replacement = `\n## ${selected || 'Título'}`; break;
            case 'list': replacement = `\n- ${selected || 'ítem'}`; break;
            case 'quote': replacement = `\n> ${selected || 'cita'}`; break;
            case 'numbered': replacement = `\n1. ${selected || 'paso'}`; break;
            default: return;
        }
        const newContent = (draft.content || '').substring(0, start) + replacement + (draft.content || '').substring(end);
        setDraft(prev => ({ ...prev, content: newContent }));
        setTimeout(() => { ta.selectionStart = ta.selectionEnd = start + replacement.length; ta.focus(); }, 0);
    };

    // === EMAIL VIA GMAIL API (internal) ===
    const handleSendEmail = async () => {
        const uid = await getStoredUserId();
        if (!uid) { addToast({ message: 'No hay sesión activa. Iniciá sesión primero.', type: 'error' }); return; }
        if (!patient.email) { addToast({ message: 'El paciente no tiene email registrado', type: 'error' }); return; }

        setIsSending(true);
        try {
            const body = `${draft.title}\n\n${draft.content}\n\n---\n_Enviado desde FonoAudio Pro_`;
            await GmailService.sendMessage(uid, patient.email, draft.title, body);
            addToast({ message: `Email enviado a ${patient.email}`, type: 'success' });
        } catch (err: any) {
            addToast({ message: 'Error enviando email: ' + err.message, type: 'error' });
        } finally { setIsSending(false); setShowSendMenu(false); }
    };

    // === SHARE VIA LINK (internal) ===
    const handleCopyLink = async () => {
        const shareLink = `${window.location.origin}/share/guide/${guide.share_token || guide.id}`;
        try {
            await navigator.clipboard.writeText(shareLink);
            addToast({ message: 'Link de la guía copiado', type: 'success' });
        } catch { addToast({ message: 'Error al copiar', type: 'error' }); }
        setShowSendMenu(false);
    };

    const handleCopyToClipboard = async () => {
        try {
            await navigator.clipboard.writeText(`${draft.title}\n\n${draft.content}`);
            addToast({ message: 'Guía copiada al portapapeles', type: 'success' });
        } catch { addToast({ message: 'Error al copiar', type: 'error' }); }
        setShowSendMenu(false);
    };

    // === WHATSAPP (external, no API available) ===
    const handleSendWhatsApp = () => {
        const phone = patient.phone?.replace(/\D/g, '');
        if (!phone) { addToast({ message: 'El paciente no tiene teléfono', type: 'error' }); return; }
        const text = encodeURIComponent(`*${draft.title}*\n\n${(draft.content || '').replace(/\n/g, '%0A')}\n\n_Enviado desde FonoAudio Pro_`);
        window.open(`https://wa.me/${phone}?text=${text}`, '_blank');
        setShowSendMenu(false);
    };

    // === INTERNAL MATERIAL SEARCH ===
    const internalSearchResults = useMemo(() => {
        if (!internalSearchQuery.trim()) return [];
        const q = internalSearchQuery.toLowerCase();
        return materials.filter(m =>
            m.title?.toLowerCase().includes(q) ||
            m.description?.toLowerCase().includes(q) ||
            m.category?.toLowerCase().includes(q) ||
            m.tags?.some(t => t.toLowerCase().includes(q))
        ).slice(0, 10);
    }, [internalSearchQuery, materials]);

    // Voice dictation
    const toggleListening = async () => {
        if (isListening) { mediaRecorderRef.current?.stop(); setIsListening(false); return; }
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioChunksRef.current = [];
            const mediaRecorder = new MediaRecorder(stream, {
                mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
            });
            mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
            mediaRecorder.onstop = async () => {
                stream.getTracks().forEach(t => t.stop());
                setIsTranscribing(true);
                try {
                    const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType });
                    const text = await voiceService.transcribe(audioBlob);
                    insertAtCursor(text);
                    addToast({ message: 'Transcripción insertada', type: 'success' });
                } catch (err: any) { addToast({ message: 'Error de dictado: ' + err.message, type: 'error' }); }
                finally { setIsTranscribing(false); }
            };
            mediaRecorderRef.current = mediaRecorder;
            mediaRecorder.start();
            setIsListening(true);
        } catch (err: any) { addToast({ message: 'Error al acceder al micrófono: ' + err.message, type: 'error' }); }
    };

    const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => setDraft(prev => ({ ...prev, content: e.target.value }));
    const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => setDraft(prev => ({ ...prev, title: e.target.value }));
    const handleAddMaterial = () => { if (materialsError) { addToast({ message: "Error al cargar materiales.", type: "error" }); return; } setIsModalOpen(true); };
    const handleMaterialSelect = (material: Material) => { if (draft.materialIds.includes(material.id)) return; setDraft(prev => ({ ...prev, materialIds: [...prev.materialIds, material.id] })); };
    const handleRemoveMaterial = (materialId: string) => setDraft(prev => ({ ...prev, materialIds: prev.materialIds.filter(id => id !== materialId) }));
    const moveMaterial = (index: number, direction: 'up' | 'down') => {
        const newIds = [...draft.materialIds];
        const ti = direction === 'up' ? index - 1 : index + 1;
        if (ti < 0 || ti >= newIds.length) return;
        [newIds[index], newIds[ti]] = [newIds[ti], newIds[index]];
        setDraft(prev => ({ ...prev, materialIds: newIds }));
    };

    const handleSmartEnrichment = async () => {
        const suggestions = getSuggestedMaterials(patient, materials).filter(m => !draft.materialIds.includes(m.id));
        if (suggestions.length === 0) { addToast({ message: "No hay nuevas sugerencias.", type: "info" }); return; }
        for (const m of suggestions) await MaterialAnalyticsService.recordEvent({ material_id: m.id, event_type: 'suggestion_offered', event_context: 'enrichment' });
        setEnrichmentSuggestions(suggestions);
        setIsEnrichmentModalOpen(true);
    };

    const handleEnrichmentConfirm = async (accepted: Material[]) => {
        for (const m of accepted) await MaterialAnalyticsService.recordEvent({ material_id: m.id, event_type: 'suggestion_accepted', event_context: 'enrichment' });
        setDraft(prev => {
            let newContent = prev.content;
            const newIds = [...prev.materialIds];
            accepted.forEach(m => { newIds.push(m.id); newContent += m.url ? `\n\n**Material:** [${m.title}](${m.url})` : `\n\n**Material:** ${m.title}`; });
            return { ...prev, materialIds: newIds, content: newContent };
        });
    };

    const handleSave = async () => { setIsSaving(true); try { await onSave(draft); } finally { setIsSaving(false); } };
    const getMaterialDetails = (id: string) => materials.find(m => m.id === id);

    const handlePrint = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;
        const htmlContent = (draft.content || '')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/^## (.*$)/gm, '<h2 style="font-size:1.2em;font-weight:bold;margin:16px 0 8px">$1</h2>')
            .replace(/^### (.*$)/gm, '<h3 style="font-size:1.05em;font-weight:bold;margin:12px 0 6px">$1</h3>')
            .replace(/^> (.*$)/gm, '<blockquote style="border-left:3px solid #ccc;padding-left:12px;color:#666">$1</blockquote>')
            .replace(/^- (.*$)/gm, '<li>$1</li>')
            .replace(/^(\d+)\. (.*$)/gm, '<li>$2</li>')
            .replace(/\!\[(.*?)\]\((.*?)\)/g, '<img src="$2" alt="$1" style="max-width:120px;border-radius:8px;margin:4px 0" />')
            .replace(/\n/g, '<br/>');
        printWindow.document.write(`<html><head><title>${draft.title}</title><style>body{font-family:sans-serif;max-width:700px;margin:40px auto;padding:0 20px;line-height:1.6}</style></head><body><h1>${draft.title}</h1>${htmlContent}<hr/><p style="color:#999;font-size:12px">Enviado desde FonoAudio Pro</p></body></html>`);
        printWindow.document.close();
        printWindow.print();
    };

    const allImageUrls = useMemo(() => {
        const fromContent = (draft.content || '').match(/!\[.*?\]\((.*?)\)/g)?.map(m => {
            const url = m.match(/\((.*?)\)/)?.[1];
            return url;
        }).filter(Boolean) || [];
        const combined = [...new Set([...insertedImageUrls, ...fromContent as string[]])];
        return combined;
    }, [draft.content, insertedImageUrls]);

    const filteredSuggestions = useMemo(() => {
        const suggested = getSuggestedMaterials(patient, materials).filter(m => !draft.materialIds.includes(m.id));
        if (searchQuery) return suggested.filter(m => m.title.toLowerCase().includes(searchQuery.toLowerCase()) || m.category?.toLowerCase().includes(searchQuery.toLowerCase()));
        return suggested;
    }, [patient, materials, searchQuery, draft.materialIds]);

    return (
        <div className="flex flex-col lg:flex-row h-full bg-white dark:bg-slate-900 animate-in slide-in-from-bottom-4 duration-500 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-6 space-y-6 border-r border-slate-200 dark:border-slate-800">
                {/* Header */}
                <div className="flex items-center justify-between sticky top-0 bg-white dark:bg-slate-900 py-2 z-10">
                    <div className="flex items-center gap-3">
                        <button onClick={onCancel} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"><X size={20} /></button>
                        <div>
                            <h2 className="font-bold text-slate-900 dark:text-white text-sm">Editando Borrador</h2>
                            <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">{draft.title}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={onPreview} className="px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl flex items-center gap-1"><Eye size={14} /> Vista Previa</button>
                        <button onClick={handlePrint} className="px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl flex items-center gap-1"><Printer size={14} /> Imprimir</button>
                        <div className="relative">
                            <button onClick={() => setShowSendMenu(!showSendMenu)} disabled={isSending} className="flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-xl font-bold text-xs shadow-md disabled:opacity-50">
                                {isSending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Enviar
                            </button>
                            {showSendMenu && (
                                <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
                                    <div className="p-2 border-b border-slate-100 dark:border-slate-700">
                                        <p className="text-[10px] font-black text-slate-400 uppercase px-2">Enviar por Email (Gmail)</p>
                                    </div>
                                    <button onClick={handleSendEmail} className="w-full px-4 py-3 text-left text-sm flex items-center gap-3 hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors">
                                        <MessageSquare size={16} className="text-blue-600" />
                                        <div>
                                            <p className="font-medium">Enviar por Gmail</p>
                                            <p className="text-[10px] text-slate-400">{patient.email || 'Sin email registrado'}</p>
                                        </div>
                                    </button>
                                    <div className="p-2 border-t border-b border-slate-100 dark:border-slate-700">
                                        <p className="text-[10px] font-black text-slate-400 uppercase px-2">Enviar por WhatsApp</p>
                                    </div>
                                    <button onClick={handleSendWhatsApp} className="w-full px-4 py-3 text-left text-sm flex items-center gap-3 hover:bg-green-50 dark:hover:bg-slate-700 transition-colors">
                                        <Phone size={16} className="text-green-600" />
                                        <div>
                                            <p className="font-medium">Enviar por WhatsApp</p>
                                            <p className="text-[10px] text-slate-400">{patient.phone || 'Sin teléfono'}</p>
                                        </div>
                                    </button>
                                    <div className="p-2 border-t border-slate-100 dark:border-slate-700">
                                        <p className="text-[10px] font-black text-slate-400 uppercase px-2">Otras opciones</p>
                                    </div>
                                    <button onClick={handleCopyLink} className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                                        <Link size={16} className="text-slate-500" /> Copiar Link de la Guía
                                    </button>
                                    <button onClick={handleCopyToClipboard} className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                                        <FileText size={16} className="text-slate-500" /> Copiar Texto
                                    </button>
                                    <button onClick={() => setShowSendMenu(false)} className="w-full px-4 py-2 text-center text-xs text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 border-t border-slate-100 dark:border-slate-700">Cancelar</button>
                                </div>
                            )}
                        </div>
                        <button onClick={onCancel} className="px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl">Cancelar</button>
                        <button onClick={handleSmartEnrichment} className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-xl font-bold text-xs shadow-md"><Sparkles size={16} /> Enriquecer</button>
                        <button onClick={handleSave} disabled={isSaving} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-bold text-xs shadow-md disabled:opacity-50">
                            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Guardar
                        </button>
                    </div>
                </div>

                {/* Title */}
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Título de la Guía</label>
                    <input type="text" value={draft.title} onChange={handleTitleChange} className="w-full p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold focus:ring-2 focus:ring-blue-500/20 outline-none" />
                </div>

                {/* Toolbar */}
                <div className="flex flex-wrap items-center gap-1 p-2 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                    <button onClick={() => handleInsertFormatting('bold')} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-lg" title="Negrita"><Bold size={14} /></button>
                    <button onClick={() => handleInsertFormatting('italic')} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-lg" title="Cursiva"><Italic size={14} /></button>
                    <button onClick={() => handleInsertFormatting('heading')} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-lg" title="Título"><Hash size={14} /></button>
                    <button onClick={() => handleInsertFormatting('list')} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-lg" title="Lista"><List size={14} /></button>
                    <button onClick={() => handleInsertFormatting('numbered')} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-lg text-xs font-bold" title="Numerada">1.</button>
                    <button onClick={() => handleInsertFormatting('quote')} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-lg" title="Cita"><Quote size={14} /></button>
                    <div className="w-px h-6 bg-slate-300 dark:bg-slate-600 mx-1" />
                    <button onClick={() => { setShowPictogramSearch(!showPictogramSearch); if (!showPictogramSearch) setPictogramQuery(''); }} className={`p-2 rounded-lg flex items-center gap-1 text-xs font-bold ${showPictogramSearch ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600' : 'hover:bg-white dark:hover:bg-slate-700'}`}>🔍 Pictogramas</button>
                    <button onClick={() => setShowImageInsert(!showImageInsert)} className={`p-2 rounded-lg flex items-center gap-1 text-xs font-bold ${showImageInsert ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600' : 'hover:bg-white dark:hover:bg-slate-700'}`}><ImageIcon size={14} /> Imagen</button>
                    <button onClick={() => setShowInternalSearch(!showInternalSearch)} className={`p-2 rounded-lg flex items-center gap-1 text-xs font-bold ${showInternalSearch ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600' : 'hover:bg-white dark:hover:bg-slate-700'}`}><BookOpen size={14} /> Buscar Material</button>
                    <div className="w-px h-6 bg-slate-300 dark:bg-slate-600 mx-1" />
                    <button onClick={toggleListening} disabled={isTranscribing} className={`p-2 rounded-lg ${isListening ? 'bg-red-100 text-red-600 animate-pulse' : isTranscribing ? 'bg-blue-100 text-blue-600' : 'hover:bg-white dark:hover:bg-slate-700'}`}>
                        {isListening ? <MicOff size={14} /> : isTranscribing ? <Loader2 size={14} className="animate-spin" /> : <Mic size={14} />}
                    </button>
                </div>

                {/* ARASAAC Pictogram Search */}
                {showPictogramSearch && (
                    <div className="p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-3">
                        <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold text-slate-700 dark:text-white flex items-center gap-2">
                                <Search size={14} /> Buscar Pictogramas Clínicos (ARASAAC)
                            </h4>
                            <button onClick={() => setShowPictogramSearch(false)} className="text-slate-400 hover:text-slate-600"><X size={14} /></button>
                        </div>
                        <div className="flex gap-2">
                            <input type="text" value={pictogramQuery} onChange={e => setPictogramQuery(e.target.value)}
                                placeholder="Buscar: comer, hablar, feliz, pelota..."
                                className="flex-1 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none"
                                onKeyDown={e => e.key === 'Enter' && handleSearchPictograms()} />
                            <button onClick={handleSearchPictograms} disabled={isSearchingPictograms}
                                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 disabled:opacity-50">
                                {isSearchingPictograms ? <Loader2 size={14} className="animate-spin" /> : 'Buscar'}
                            </button>
                        </div>
                        {arasaacResults.length > 0 && (
                            <div className="grid grid-cols-6 gap-2 max-h-64 overflow-y-auto">
                                {arasaacResults.map(p => (
                                    <button key={p.id} onClick={() => handleInsertPictogram(p)}
                                        className="flex flex-col items-center gap-1 p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-blue-500 hover:shadow-md transition-all cursor-pointer group">
                                        <img src={p.image_url} alt={p.label} className="w-10 h-10 object-contain group-hover:scale-110 transition-transform" loading="lazy" />
                                        <span className="text-[9px] text-slate-500 font-medium text-center leading-tight">{p.label}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                        {arasaacResults.length === 0 && !isSearchingPictograms && pictogramQuery && (
                            <p className="text-xs text-slate-400 text-center py-2">No se encontraron pictogramas para "{pictogramQuery}"</p>
                        )}
                    </div>
                )}

                {/* Image URL Insert */}
                {showImageInsert && (
                    <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl">
                        <Link size={14} className="text-slate-400 shrink-0" />
                        <input type="url" value={imageUrlInput} onChange={e => setImageUrlInput(e.target.value)} placeholder="URL de imagen..." className="flex-1 bg-transparent text-sm outline-none" onKeyDown={e => e.key === 'Enter' && handleInsertImageUrl()} />
                        <button onClick={handleInsertImageUrl} className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700">Insertar</button>
                        <button onClick={() => { setShowImageInsert(false); setImageUrlInput(''); }} className="p-1 text-slate-400 hover:text-slate-600"><X size={14} /></button>
                    </div>
                )}

                {/* Internal Material Search */}
                {showInternalSearch && (
                    <div className="p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl space-y-3">
                        <div className="flex items-center justify-between">
                            <h4 className="text-xs font-bold text-slate-700 dark:text-white flex items-center gap-2">
                                <BookOpen size={14} /> Buscar en Biblioteca y Multimedia
                            </h4>
                            <button onClick={() => { setShowInternalSearch(false); setInternalSearchQuery(''); }} className="text-slate-400 hover:text-slate-600"><X size={14} /></button>
                        </div>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            <input type="text" value={internalSearchQuery} onChange={e => setInternalSearchQuery(e.target.value)} placeholder="Buscar materiales, imágenes, videos..."
                                className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none" />
                        </div>
                        {internalSearchResults.length > 0 && (
                            <div className="space-y-2 max-h-48 overflow-y-auto">
                                {internalSearchResults.map(m => (
                                    <button key={m.id} onClick={() => { handleMaterialSelect(m); setInternalSearchQuery(''); }}
                                        className="w-full p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-blue-500 transition-all text-left flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 shrink-0">
                                            {m.media_type === 'image' ? <ImageIcon size={16} /> : m.media_type === 'video' ? <Video size={16} /> : m.media_type === 'audio' ? <Headphones size={16} /> : <FileText size={16} />}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-xs font-bold text-slate-800 dark:text-white truncate">{m.title}</p>
                                            <p className="text-[10px] text-slate-500">{m.category || m.media_type} {m.tags?.length ? `· ${m.tags.slice(0,3).join(', ')}` : ''}</p>
                                        </div>
                                        <Plus size={14} className="text-slate-300 shrink-0" />
                                    </button>
                                ))}
                            </div>
                        )}
                        {internalSearchQuery && internalSearchResults.length === 0 && (
                            <p className="text-xs text-slate-400 text-center py-2">No se encontraron materiales para "{internalSearchQuery}"</p>
                        )}
                    </div>
                )}

                {/* Content */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2 mb-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Contenido de la Guía (Instrucciones)</label>
                        {isTranscribing && <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-[10px] font-bold animate-pulse"><Loader2 size={10} className="animate-spin" /> Transcribiendo...</span>}
                    </div>
                    <textarea ref={textareaRef} value={draft.content} onChange={handleContentChange}
                        placeholder="Escribe las instrucciones para padres. Usa formato markdown, inserta pictogramas clínicos, imágenes y materiales de apoyo..."
                        className="w-full h-80 p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-sm leading-relaxed focus:ring-2 focus:ring-blue-500/20 outline-none resize-none font-mono" />
                </div>

                {/* Image Previews */}
                {allImageUrls.length > 0 && (
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Imágenes Insertadas</label>
                        <div className="flex flex-wrap gap-3">
                            {allImageUrls.map((url, idx) => (
                                <div key={idx} className="relative group">
                                    <img src={url} alt={`Imagen ${idx + 1}`}
                                        className="w-24 h-24 object-cover rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm"
                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                    <button onClick={() => {
                                        setInsertedImageUrls(prev => prev.filter(u => u !== url));
                                        setDraft(prev => ({ ...prev, content: (prev.content || '').replace(`![Imagen](${url})`, '') }));
                                    }} className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"><X size={10} /></button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Materials */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <BookOpen size={18} className="text-blue-500" />
                            <h3 className="font-bold text-slate-800 dark:text-white">Materiales de Apoyo</h3>
                            <span className="text-[10px] text-slate-400 font-bold">({draft.materialIds.length})</span>
                        </div>
                        <button onClick={handleAddMaterial} className="flex items-center gap-1 text-[10px] font-black text-blue-600 dark:text-blue-400 hover:underline uppercase"><Plus size={14} /> Agregar</button>
                    </div>
                    {materialsError && <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 border border-red-100 rounded-xl text-xs font-medium"><AlertCircle size={16} /> Error al cargar materiales.</div>}
                    <div className="grid grid-cols-1 gap-3">
                        {draft.materialIds.length === 0 ? (
                            <div className="py-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl text-slate-400 text-xs italic">No hay materiales seleccionados.</div>
                        ) : draft.materialIds.map((id, index) => {
                            const material = getMaterialDetails(id);
                            return (
                                <div key={id} className="flex items-center justify-between p-3 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm group">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => moveMaterial(index, 'up')} disabled={index === 0} className="p-1 text-slate-400 hover:text-blue-500 disabled:opacity-20"><ArrowUp size={14} /></button>
                                            <button onClick={() => moveMaterial(index, 'down')} disabled={index === draft.materialIds.length - 1} className="p-1 text-slate-400 hover:text-blue-500 disabled:opacity-20"><ArrowDown size={14} /></button>
                                        </div>
                                        <div className="flex items-center gap-2 min-w-0">
                                            <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 shrink-0">
                                                {material?.media_type === 'image' ? <ImageIcon size={16} /> : material?.media_type === 'video' ? <Video size={16} /> : material?.media_type === 'audio' ? <Headphones size={16} /> : <FileText size={16} />}
                                            </div>
                                            <div className="truncate">
                                                <p className="text-xs font-bold text-slate-800 dark:text-white truncate">{material?.title || 'Material desconocido'}</p>
                                                <p className="text-[10px] text-slate-500 uppercase">{material?.media_type || material?.category}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <button onClick={() => handleRemoveMaterial(id)} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Sidebar - Suggestions */}
            <div className="hidden lg:flex flex-col w-80 bg-slate-50 dark:bg-slate-950/50 border-l border-slate-200 dark:border-slate-800 overflow-y-auto">
                <div className="p-6 space-y-6">
                    <div className="space-y-4">
                        <div className="flex items-center gap-2">
                            <Sparkles size={18} className="text-amber-500" />
                            <h3 className="font-bold text-slate-800 dark:text-white text-sm">Sugerencias Inteligentes</h3>
                        </div>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                            <input type="text" placeholder="Buscar sugerencias..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500/20" />
                        </div>
                    </div>
                    <div className="space-y-3">
                        {filteredSuggestions.length === 0 ? (
                            <p className="text-[10px] text-slate-400 italic text-center py-4">No hay sugerencias.</p>
                        ) : filteredSuggestions.map(material => (
                            <div key={material.id} onClick={() => handleMaterialSelect(material)}
                                className="group cursor-pointer p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl hover:border-blue-500 transition-all shadow-sm">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-[9px] font-black text-blue-600 dark:text-blue-400 uppercase">{material.category}</span>
                                    <Plus size={12} className="text-slate-300 group-hover:text-blue-500" />
                                </div>
                                <h4 className="text-xs font-bold text-slate-800 dark:text-white truncate">{material.title}</h4>
                                <div className="flex items-center gap-1 mt-1 opacity-60">
                                    {material.media_type === 'image' && <ImageIcon size={10} />}
                                    {material.media_type === 'video' && <Video size={10} />}
                                    {material.media_type === 'pdf' && <FileText size={10} />}
                                    {material.media_type === 'audio' && <Headphones size={10} />}
                                    <span className="text-[9px] text-slate-500">{material.media_type}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <MaterialSelectorModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSelect={handleMaterialSelect} materials={materials} />
            <EnrichmentProposalModal isOpen={isEnrichmentModalOpen} onClose={() => setIsEnrichmentModalOpen(false)} onConfirm={handleEnrichmentConfirm} onDiscard={() => {}} suggestions={enrichmentSuggestions} />
        </div>
    );
};

export default HomeGuideEditor;

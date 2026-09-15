import React, { useState, useMemo } from 'react';
import { 
    Check, X, Sparkles, AlertCircle, FileText, Image as ImageIcon, 
    Video, Mic, Trash2, CheckCircle2 
} from 'lucide-react';
import { Material } from '../types';

interface EnrichmentProposalModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (acceptedMaterials: Material[]) => void;
    onDiscard: (material: Material) => void;
    suggestions: Material[];
}

interface SelectedSuggestion {
    material: Material;
    id: string;
}

const EnrichmentProposalModal: React.FC<EnrichmentProposalModalProps> = ({ 
    isOpen, 
    onClose, 
    onConfirm, 
    onDiscard,
    suggestions 
}) => {
    const [acceptedIds, setAcceptedIds] = useState<Set<string>>(new Set());
    const [discardedIds, setDiscardedIds] = useState<Set<string>>(new Set());

    // Filter suggestions to show only those not discarded
    const visibleSuggestions = useMemo(() => {
        return suggestions.filter(s => !discardedIds.has(s.id));
    }, [suggestions, discardedIds]);

    // The materials that will actually be added
    const acceptedMaterials = useMemo(() => {
        return suggestions.filter(s => acceptedIds.has(s.id));
    }, [suggestions, acceptedIds]);

    // Preview of the text that will be added
    const textPreview = useMemo(() => {
        return acceptedMaterials.map(m => {
            if (m.url) {
                return `\n\n**Material recomendado:** [${m.title}](${m.url})`;
            }
            return `\n\n**Material recomendado:** ${m.title}`;
        }).join('');
    }, [acceptedMaterials]);

    if (!isOpen) return null;

    const toggleAccept = (id: string) => {
        const newAccepted = new Set(acceptedIds);
        if (newAccepted.has(id)) {
            newAccepted.delete(id);
        } else {
            newAccepted.add(id);
            // If we accept it, it shouldn't be in discarded
            const newDiscarded = new Set(discardedIds);
            newDiscarded.delete(id);
            setDiscardedIds(newDiscarded);
        }
        setAcceptedIds(newAccepted);
    };

    const discard = (id: string) => {
        const targetMaterial = suggestions.find(s => s.id === id);
        if (targetMaterial) {
            onDiscard(targetMaterial);
        }
        const newDiscarded = new Set(discardedIds);
        newDiscarded.add(id);
        setDiscardedIds(newDiscarded);

        const newAccepted = new Set(acceptedIds);
        newAccepted.delete(id);
        setAcceptedIds(newAccepted);
    };

    const handleConfirm = () => {
        onConfirm(acceptedMaterials);
        setAcceptedIds(new Set());
        setDiscardedIds(new Set());
    };
// ...

    const getIcon = (mediaType: string) => {
        switch (mediaType.toLowerCase()) {
            case 'video': return <Video size={16} />;
            case 'image': return <ImageIcon size={16} />;
            case 'audio': return <Mic size={16} />;
            default: return <FileText size={16} />;
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 w-full max-w-3xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="p-6 border-b dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg text-amber-600">
                            <Sparkles size={24} />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-slate-900 dark:text-white">Propuesta de Enriquecimiento</h3>
                            <p className="text-xs text-slate-500">Revisa las sugerencias inteligentes para esta guía</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-2"><X size={24} /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                    {/* Suggestions List */}
                    <div className="space-y-4">
                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Sugerencias Disponibles</h4>
                        {visibleSuggestions.length === 0 ? (
                            <div className="py-12 text-center text-slate-400 italic text-sm">
                                No hay más sugerencias para mostrar.
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {visibleSuggestions.map(m => {
                                    const isAccepted = acceptedIds.has(m.id);
                                    return (
                                        <div 
                                            key={m.id} 
                                            className={`relative p-4 rounded-2xl border transition-all ${
                                                isAccepted 
                                                ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-500 dark:border-emerald-500/50' 
                                                : 'bg-white dark:bg-slate-850 border-slate-200 dark:border-slate-700'
                                            }`}
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 uppercase">
                                                    {m.category}
                                                </span>
                                                <div className="flex gap-1">
                                                    <button 
                                                        onClick={() => discard(m.id)}
                                                        className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                                                        title="Descartar"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                            
                                            <h4 className="font-bold text-slate-800 dark:text-white text-sm mb-3 truncate pr-4">
                                                {m.title}
                                            </h4>

                                                 <div className="flex items-center justify-between mt-4">
                                                     <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                                                         {getIcon(m.media_type)}
                                                         <span>{m.media_type}</span>
                                                     </div>
                                                     <button
                                                         onClick={() => toggleAccept(m.id)}

                                                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold transition-all ${
                                                        isAccepted
                                                        ? 'bg-emerald-500 text-white'
                                                        : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                                                    }`}
                                                >
                                                    {isAccepted ? <CheckCircle2 size={12} /> : <Check size={12} />}
                                                    {isAccepted ? 'Aceptado' : 'Aceptar'}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Preview Section */}
                    <div className="pt-6 border-t dark:border-slate-800">
                        <div className="flex items-center gap-2 mb-4">
                            <FileText size={18} className="text-blue-500" />
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Vista Previa del Texto</h4>
                        </div>
                        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
                            <div className="text-xs text-slate-500 italic whitespace-pre-wrap">
                                {textPreview || "No hay materiales seleccionados para añadir."}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-6 border-t dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
                    <div className="text-xs text-slate-500">
                        {acceptedMaterials.length} materiales seleccionados
                    </div>
                    <div className="flex gap-3">
                        <button 
                            onClick={onClose}
                            className="px-5 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-all"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={handleConfirm}
                            disabled={acceptedMaterials.length === 0}
                            className="px-6 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Confirmar y Aplicar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EnrichmentProposalModal;

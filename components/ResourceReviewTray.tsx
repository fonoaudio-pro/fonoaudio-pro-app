import React, { useState, useEffect } from 'react';
import { 
    Check, X, ExternalLink, Tag, RefreshCw, Loader2, Inbox, Edit2 
} from 'lucide-react';
import { ExternalResource } from '../services/ResourceIngestionService';
import { ResourceIngestionService } from '../services/ResourceIngestionService';
import { useToast } from '../context/ToastContext';

interface ResourceReviewTrayProps {
    onUpdate: () => void;
}
// ... (rest of the file)


const ResourceReviewTray: React.FC<ResourceReviewTrayProps> = ({ onUpdate }) => {
    const { addToast } = useToast();
    const [candidates, setCandidates] = useState<ExternalResource[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isProcessing, setIsProcessing] = useState<string | null>(null);
    const [isEditing, setIsEditing] = useState<string | null>(null);
    
    // Edit state
    const [editForm, setEditForm] = useState<Partial<ExternalResource>>({});

    const loadCandidates = async () => {
        setIsLoading(true);
        try {
            const data = await ResourceIngestionService.getPendingCandidates();
            setCandidates(data);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadCandidates();
    }, []);

    const handleApprove = async (resource: ExternalResource) => {
        setIsProcessing(resource.id);
        try {
            await ResourceIngestionService.approveResource(resource);
            setCandidates(prev => prev.filter(r => r.id !== resource.id));
            onUpdate();
            addToast({ message: "Recurso aprobado con éxito.", type: "success" });
        } catch (err) {
            addToast({ message: "Error al aprobar recurso.", type: "error" });
        } finally {
            setIsProcessing(null);
        }
    };

    const handleReject = async (id: string) => {
        setIsProcessing(id);
        try {
            await ResourceIngestionService.rejectResource(id);
            setCandidates(prev => prev.filter(r => r.id !== id));
            onUpdate();
            addToast({ message: "Recurso rechazado con éxito.", type: "success" });
        } catch (err) {
            addToast({ message: "Error al rechazar recurso.", type: "error" });
        } finally {
            setIsProcessing(null);
        }
    };

    const startEditing = (resource: ExternalResource) => {
        setEditForm(resource);
        setIsEditing(resource.id);
    };

    const saveEdit = async (id: string) => {
        setIsProcessing(id);
        try {
            await ResourceIngestionService.updateCandidate(id, editForm);
            setIsEditing(null);
            setEditForm({});
            await loadCandidates();
            addToast({ message: "Cambios guardados con éxito.", type: "success" });
        } catch (err) {
            addToast({ message: "Error al guardar cambios.", type: "error" });
        } finally {
            setIsProcessing(null);
        }
    };

    return (
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col h-full max-h-[600px]">
            <div className="p-4 border-b dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
                <div className="flex items-center gap-2">
                    <Inbox size={18} className="text-blue-600" />
                    <h3 className="font-bold text-slate-800 dark:text-white text-sm">Revisión de Recursos</h3>
                </div>
                <button 
                    onClick={loadCandidates} 
                    disabled={isLoading}
                    className="text-slate-400 hover:text-blue-600 transition-colors disabled:opacity-50"
                >
                    <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                {isLoading ? (
                    <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                        <Loader2 className="animate-spin mr-2" size={16} />
                        Cargando...
                    </div>
                ) : candidates.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 text-sm italic space-y-2">
                        <Inbox size={32} className="opacity-20" />
                        <p>Sin recursos pendientes.</p>
                    </div>
                ) : (
                    candidates.map(resource => (
                        <div key={resource.id} className="p-4 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-xl space-y-3">
                            {isEditing === resource.id ? (
                                <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                                    <input 
                                        className="w-full p-2 text-xs bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 rounded"
                                        value={editForm.title}
                                        onChange={e => setEditForm({...editForm, title: e.target.value})}
                                    />
                                    <textarea 
                                        className="w-full p-2 text-xs bg-slate-50 dark:bg-slate-900 border dark:border-slate-700 rounded"
                                        value={editForm.description}
                                        onChange={e => setEditForm({...editForm, description: e.target.value})}
                                    />
                                    <div className="flex gap-2">
                                        <button onClick={() => saveEdit(resource.id)} className="text-[10px] font-bold bg-blue-600 text-white px-2 py-1 rounded">Guardar</button>
                                        <button onClick={() => setIsEditing(null)} className="text-[10px] font-bold text-slate-500 px-2 py-1 rounded">Cancelar</button>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="flex justify-between items-start">
                                        <h4 className="font-bold text-slate-800 dark:text-white text-xs truncate pr-2">{resource.title}</h4>
                                        <button onClick={() => startEditing(resource)} className="text-slate-400 hover:text-blue-500"><Edit2 size={14} /></button>
                                    </div>
                                    <p className="text-[10px] text-slate-500 line-clamp-2">{resource.description}</p>
                                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                                        <a href={resource.url} target="_blank" rel="noreferrer" className="text-[10px] text-blue-600 flex items-center gap-1">
                                            <ExternalLink size={10} /> Link
                                        </a>
                                        <div className="flex items-center gap-1">
                                            <button 
                                                onClick={() => handleReject(resource.id)}
                                                className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                                                disabled={isProcessing === resource.id}
                                            >
                                                <X size={14} />
                                            </button>
                                            <button 
                                                onClick={() => handleApprove(resource)}
                                                className="p-1.5 text-slate-400 hover:text-emerald-500 transition-colors"
                                                disabled={isProcessing === resource.id}
                                            >
                                                {isProcessing === resource.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                            </button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default ResourceReviewTray;

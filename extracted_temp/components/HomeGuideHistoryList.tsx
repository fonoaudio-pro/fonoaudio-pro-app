import React, { useEffect, useState } from 'react';
import { HomeGuide } from '../types';
import { SessionService } from '../services/SessionService';
import { GuideService } from '../services/GuideService';
import { supabase } from '../utils/supabaseClient';
import { useToast } from '../context/ToastContext';
import { 
    Eye, Edit3, Calendar, Clock, AlertCircle, Loader2, FileText, ImageIcon, CheckCircle, Send, Share2, Copy, Check 
} from 'lucide-react';
import HomeGuidePreview from './HomeGuidePreview';
import HomeGuideEditor from './HomeGuideEditor';
import { generateMessage, DeliveryMethod } from '../utils/messageTemplates';

interface HomeGuideHistoryListProps {
    patientId: string;
    patientName: string;
    materials: any[];
    onRefresh?: () => void;
    onSaveGuide: (updatedGuide: HomeGuide) => Promise<void>;
}

interface HistoryItemProps {
    guide: HomeGuide;
    materials: any[];
    onView: (guide: HomeGuide) => void;
    onEdit: (guide: HomeGuide) => void;
    onFinalize?: (guide: HomeGuide) => void;
    onMarkAsSent?: (guide: HomeGuide) => void;
}

const HistoryItem: React.FC<HistoryItemProps> = ({ guide, materials, onView, onEdit, onFinalize, onMarkAsSent }) => {
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'draft': return 'bg-blue-100 text-blue-700';
            case 'final': return 'bg-emerald-100 text-emerald-700';
            case 'sent': return 'bg-slate-100 text-slate-700';
            default: return 'bg-slate-100 text-slate-700';
        }
    };

    const formatDate = (dateString: string | undefined) => {
        if (!dateString) return '--';
        return new Date(dateString).toLocaleDateString('es-ES', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    };

    return (
        <div className="flex items-center justify-between p-3 hover:bg-slate-50 rounded-xl transition-all group border border-transparent hover:border-slate-100">
            <div className="flex items-center gap-4 min-w-0">
                <div className={`w-2 h-2 rounded-full ${getStatusColor(guide.status).split(' ')[0].replace('bg-', 'bg-')}`} />
                <div className="min-w-0">
                    <p className="font-bold text-slate-900 truncate text-sm">{guide.title}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${getStatusColor(guide.status)}`}>
                            {guide.status}
                        </span>
                        <div className="flex items-center gap-1 text-slate-400 text-[10px]">
                            <Calendar size={10} />
                            {formatDate(guide.updated_at)}
                        </div>
                        <div className="flex items-center gap-1 text-slate-400 text-[10px]">
                            <Clock size={10} />
                            v{guide.version || 1}
                        </div>
                        {guide.status === 'sent' && guide.delivery_method && (
                            <div className="flex items-center gap-1 text-blue-500 text-[10px] font-medium">
                                <Send size={10} />
                                {guide.delivery_method.toUpperCase()}
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                    onClick={() => onView(guide)}
                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                    title="Ver"
                >
                    <Eye size={16} />
                </button>

                {guide.status === 'draft' && onFinalize && (
                    <button 
                        onClick={() => onFinalize(guide)}
                        className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                        title="Finalizar"
                    >
                        <CheckCircle size={16} />
                    </button>
                )}

                {guide.status === 'final' && onMarkAsSent && (
                    <button 
                        onClick={() => onMarkAsSent(guide)}
                        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                        title="Marcar como enviado"
                    >
                        <Send size={16} />
                    </button>
                )}

                <button 
                    onClick={() => onEdit(guide)}
                    className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all"
                    title="Editar"
                >
                    <Edit3 size={16} />
                </button>

                <button 
                    onClick={() => window.print()}
                    className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all"
                    title="Exportar/Imprimir"
                >
                    <Share2 size={16} />
                </button>
            </div>
        </div>
    );
};

const HomeGuideHistoryList: React.FC<HomeGuideHistoryListProps> = ({ patientId, patientName, materials, onRefresh, onSaveGuide }) => {
    const { addToast } = useToast();
    const [history, setHistory] = useState<HomeGuide[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Modal States
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [isSentModalOpen, setIsSentModalOpen] = useState(false);
    const [currentGuide, setCurrentGuide] = useState<HomeGuide | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('whatsapp');
    const [copiedMessage, setCopiedMessage] = useState(false);

    const loadHistory = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await SessionService.getHomeGuideHistory(patientId);
            setHistory(data);
        } catch (err) {
            setError("Error al cargar el historial de guías.");
            addToast({ message: "Error al cargar el historial de guías.", type: "error" });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadHistory();
    }, [patientId]);

    const handleView = (guide: HomeGuide) => {
        setCurrentGuide(guide);
        setIsPreviewOpen(true);
    };

    const handleEdit = (guide: HomeGuide) => {
        setCurrentGuide(guide);
        setIsEditorOpen(true);
    };

    const handleFinalize = async (guide: HomeGuide) => {
        try {
            await SessionService.updateHomeGuideStatus(guide.id, 'final');
            await loadHistory();
            addToast({ message: "Guía finalizada con éxito.", type: "success" });
        } catch (err) {
            addToast({ message: "Error al finalizar la guía.", type: "error" });
        }
    };

    const handleOpenSentModal = (guide: HomeGuide) => {
        setCurrentGuide(guide);
        setIsSentModalOpen(true);
        setCopiedMessage(false);
    };

    const handleMarkAsSent = async () => {
        if (!currentGuide) return;
        try {
            await GuideService.dispatch(currentGuide, deliveryMethod, patientName);
            await loadHistory();
            setIsSentModalOpen(false);
            setCurrentGuide(null);
            addToast({ message: "Guía marcada como enviada con éxito.", type: "success" });
        } catch (err) {
            addToast({ message: "Error al marcar como enviado.", type: "error" });
        }
    };

    const handleShareViaMethod = async (method: DeliveryMethod) => {
        if (!currentGuide || !currentGuide.share_token) {
            addToast({ message: "La guía aún no tiene un enlace de compartir generado.", type: "error" });
            return;
        }

        const message = generateMessage(patientName, currentGuide.title, method);
        const shareLink = `${window.location.origin}/share/guide/${currentGuide.share_token}`;
        const fullMessage = `${message}\n\n🔗 ${shareLink}`;

        try {
            // 1. Registrar el envío en el sistema para asegurar trazabilidad
            await GuideService.dispatch(currentGuide, method, patientName);

            // 2. Ejecutar la acción de apertura del enlace
            if (method === 'whatsapp') {
                window.open(`https://wa.me/?text=${encodeURIComponent(fullMessage)}`, '_blank');
            } else if (method === 'email') {
                window.location.href = `mailto:?subject=${encodeURIComponent('Guía de Apoyo: ' + currentGuide.title)}&body=${encodeURIComponent(fullMessage)}`;
            }

            // 3. Actualizar UI
            await loadHistory();
            setIsSentModalOpen(false);
            setCurrentGuide(null);
            addToast({ message: "Guía enviada y registrada con éxito.", type: "success" });
        } catch (err) {
            console.error(err);
            addToast({ message: "Error al registrar el envío digital.", type: "error" });
        }
    };


    const handleCopyMessage = async () => {
        if (!currentGuide || !currentGuide.share_token) return;
        const message = generateMessage(patientName, currentGuide.title, deliveryMethod); 
        const shareLink = `${window.location.origin}/share/guide/${currentGuide.share_token}`;
        const fullMessage = `${message}\n\n🔗 ${shareLink}`;

        try {
            await navigator.clipboard.writeText(fullMessage);
            setCopiedMessage(true);
            setTimeout(() => setCopiedMessage(false), 2000);
            addToast({ message: "Mensaje copiado al portapapeles.", type: "success" });
        } catch (err) {
            addToast({ message: "Error al copiar mensaje.", type: "error" });
        }
    };

    const handleSave = async (updatedGuide: HomeGuide) => {
        if (!currentGuide) return;
        setIsSaving(true);
        try {
            await onSaveGuide(updatedGuide);
            await loadHistory();
            setIsEditorOpen(false);
            addToast({ message: "Guía guardada con éxito.", type: "success" });
        } catch (err) {
            console.error(err);
            addToast({ message: "Error al guardar la guía.", type: "error" });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <FileText size={18} className="text-blue-600" />
                    Historial de Guías
                </h3>
                {onRefresh && (
                    <button onClick={onRefresh} className="text-xs text-blue-600 hover:underline">Actualizar</button>
                )}
            </div>

            {isLoading ? (
                <div className="flex justify-center p-8">
                    <Loader2 className="animate-spin text-blue-600" size={24} />
                </div>
            ) : error ? (
                <div className="flex items-center gap-2 p-4 bg-red-50 text-red-600 rounded-xl text-sm">
                    <AlertCircle size={16} />
                    {error}
                </div>
            ) : history.length === 0 ? (
                <div className="py-8 text-center border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 text-sm italic">
                    No hay guías registradas para este paciente.
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
                    {history.map(guide => (
                        <HistoryItem 
                            key={guide.id} 
                            guide={guide} 
                            materials={materials}
                            onView={handleView}
                            onEdit={handleEdit}
                            onFinalize={handleFinalize}
                            onMarkAsSent={handleOpenSentModal}
                        />
                    ))}
                </div>
            )}

            {/* Modals */}
            {isPreviewOpen && currentGuide && (
                <HomeGuidePreview 
                    guide={currentGuide} 
                    materials={materials} 
                    onClose={() => setIsPreviewOpen(false)} 
                    patientName={patientName}
                />
            )}

            {isEditorOpen && currentGuide && (
                <HomeGuideEditor 
                    guide={currentGuide}
                    onSave={handleSave}
                    onCancel={() => setIsEditorOpen(false)}
                    onPreview={() => setIsPreviewOpen(true)}
                    materials={materials}
                    materialsError={false}
                />
            )}

            {isSentModalOpen && currentGuide && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-6">
                        <div className="space-y-2">
                            <h4 className="text-lg font-bold text-slate-900">Marcar como enviado</h4>
                            <p className="text-sm text-slate-500">Selecciona el método para generar el mensaje de envío.</p>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { id: 'whatsapp', label: 'WhatsApp', icon: Send },
                                { id: 'email', label: 'Email', icon: FileText },
                                { id: 'printed', label: 'Impreso', icon: FileText },
                                { id: 'in_person', label: 'Presencial', icon: FileText },
                            ].map((method) => (
                                <button
                                    key={method.id}
                                    onClick={() => setDeliveryMethod(method.id as DeliveryMethod)}
                                    className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                                        deliveryMethod === method.id 
                                            ? 'border-blue-600 bg-blue-50 text-blue-700' 
                                            : 'border-slate-100 hover:border-slate-200 text-slate-600'
                                    }`}
                                >
                                    <method.icon size={18} />
                                    <span className="font-medium text-sm">{method.label}</span>
                                </button>
                            ))}
                        </div>

                        {(deliveryMethod === 'whatsapp' || deliveryMethod === 'email') && (
                            <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                                <label className="text-xs font-bold text-slate-400 uppercase">Mensaje de envío</label>
                                <div className="relative">
                                    <div className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-600 min-h-[80px] whitespace-pre-wrap">
                                        {generateMessage(patientName, currentGuide.title, deliveryMethod)}
                                    </div>
                                    <button 
                                        onClick={handleCopyMessage}
                                        className={`absolute top-2 right-2 p-2 rounded-lg transition-all ${
                                            copiedMessage ? 'bg-emerald-100 text-emerald-600' : 'bg-white text-slate-400 hover:text-blue-600 hover:bg-blue-50'
                                        }`}
                                        title="Copiar mensaje"
                                    >
                                        {copiedMessage ? <Check size={16} /> : <Copy size={16} />}
                                    </button>
                                </div>
                                <p className="text-[10px] text-slate-400 italic text-center">Copia este mensaje para pegarlo en tu aplicación de mensajería.</p>
                            </div>
                        )}

                        <div className="flex gap-3 pt-2">
                            <button 
                                onClick={() => setIsSentModalOpen(false)}
                                className="flex-1 px-4 py-2 rounded-xl text-slate-600 font-medium hover:bg-slate-100 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={() => {
                                    if (deliveryMethod === 'whatsapp' || deliveryMethod === 'email') {
                                        handleShareViaMethod(deliveryMethod);
                                    } else {
                                        handleMarkAsSent();
                                    }
                                }}
                                className="flex-1 px-4 py-2 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
                            >
                                {deliveryMethod === 'whatsapp' || deliveryMethod === 'email' ? 'Compartir' : 'Confirmar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HomeGuideHistoryList;
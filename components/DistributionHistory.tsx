import React, { useEffect, useState } from 'react';
import { SessionService } from '../services/SessionService';
import { DistributionLog } from '../types';
import { useToast } from '../context/ToastContext';
import { 
    Send, 
    AlertCircle, 
    CheckCircle2, 
    Clock, 
    Mail, 
    MessageCircle, 
    Loader2, 
    RefreshCw,
    ExternalLink
} from 'lucide-react';

interface DistributionHistoryProps {

    patientId: string;
    onRefresh?: () => void;
}

const DistributionHistory: React.FC<DistributionHistoryProps> = ({ patientId, onRefresh }) => {
    const { addToast } = useToast();
    const [history, setHistory] = useState<DistributionLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isRetrying, setIsRetrying] = useState<string | null>(null);

    const failureCounts = history.reduce((acc, log) => {
        if (log.status === 'failed') {
            const key = `${log.material_title}-${log.recipient_contact}`;
            acc[key] = (acc[key] || 0) + 1;
        }
        return acc;
    }, {} as Record<string, number>);

    const loadHistory = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await SessionService.getPatientDistributionHistory(patientId);
            setHistory(data);
        } catch (err) {
            setError("Error al cargar el historial de distribuciones.");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadHistory();
    }, [patientId]);

    const handleRetry = async (distributionId: string) => {
        setIsRetrying(distributionId);
        try {
            await SessionService.retryDistribution(distributionId);
            await loadHistory();
            if (onRefresh) onRefresh();
        } catch (err) {
            addToast({ message: "Error al reintentar el envío.", type: "error" });
        } finally {
            setIsRetrying(null);
        }
    };

    const getStatusStyles = (status: string) => {
        switch (status) {
            case 'sent': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            case 'failed': return 'bg-red-100 text-red-700 border-red-200';
            case 'queued': return 'bg-blue-100 text-blue-700 border-blue-200';
            default: return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };

    const getIcon = (medium: string) => {
        return medium === 'whatsapp' ? <MessageCircle size={16} /> : <Mail size={16} />;
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('es-ES', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <Send size={18} className="text-blue-600" />
                    Historial de Distribuciones
                </h3>
                {onRefresh && (
                    <button 
                        onClick={onRefresh} 
                        className="p-1 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    >
                        <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                    </button>
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
                    No hay envíos registrados para este paciente.
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
                    {history.map((log) => (
                        <div key={log.id} className="p-4 hover:bg-slate-50 transition-colors group">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex items-start gap-3 min-w-0">
                                    <div className={`mt-1 p-2 rounded-lg border ${getStatusStyles(log.status)}`}>
                                        {log.status === 'sent' ? <CheckCircle2 size={16} /> : 
                                         log.status === 'failed' ? <AlertCircle size={16} /> : 
                                         <Clock size={16} />}
                                    </div>
                                    <div className="min-w-0">
                                         <div className="flex items-center gap-2 mb-1">
                                             <p className="font-bold text-slate-900 truncate text-sm">
                                                 {log.material_title}
                                             </p>
                                             <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${getStatusStyles(log.status)}`}>
                                                 {log.status}
                                             </span>
                                         </div>
                                         {log.status === 'failed' && (failureCounts[`${log.material_title}-${log.recipient_contact}`] || 0) > 1 && (
                                             <div className="flex items-center gap-1 text-red-600 font-bold text-[10px] mb-1">
                                                 <AlertCircle size={12} />
                                                 FALLO REPETIDO
                                             </div>
                                         )}
                                         <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-400 text-[11px]">
                                            <div className="flex items-center gap-1">
                                                {getIcon(log.medium)}
                                                {log.medium.charAt(0).toUpperCase() + log.medium.slice(1)}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Clock size={10} />
                                                {formatDate(log.created_at)}
                                            </div>
                                            {log.material_url && (
                                                <a 
                                                    href={log.material_url} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="flex items-center gap-1 text-blue-500 hover:underline"
                                                >
                                                    <ExternalLink size={10} />
                                                    Ver Recurso
                                                </a>
                                            )}
                                        </div>
                                        {log.error_message && (
                                            <p className="mt-2 text-xs text-red-500 bg-red-50 p-2 rounded-lg italic">
                                                {log.error_message}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {log.status === 'failed' && (
                                    <button
                                        onClick={() => handleRetry(log.distribution_id)}
                                        disabled={isRetrying === log.distribution_id}
                                        className="shrink-0 p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all disabled:opacity-50"
                                        title="Reintentar envío"
                                    >
                                        {isRetrying === log.distribution_id ? (
                                            <Loader2 size={16} className="animate-spin" />
                                        ) : (
                                            <RefreshCw size={16} />
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default DistributionHistory;

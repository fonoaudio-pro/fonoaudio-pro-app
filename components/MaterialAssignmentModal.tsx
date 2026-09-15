import React, { useState, useEffect } from 'react';
import { 
    X, Send, User, MessageSquare, Mail, Phone, 
    CheckCircle2, AlertCircle, Loader2, Search, FileText
} from 'lucide-react';
import { Material, DeliveryChannel } from '../types';
import DistributionService from '../services/distributionService';
import { useToast } from '../context/ToastContext';

interface MaterialAssignmentModalProps {
    material: Material;
    sessionId?: string;
    onClose: () => void;
}

const MaterialAssignmentModal: React.FC<MaterialAssignmentModalProps> = ({ material, sessionId, onClose }) => {
    const { addToast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [patients, setPatients] = useState<any[]>([]);
    const [selectedPatient, setSelectedPatient] = useState<any>(null);
    
    const [medium, setMedium] = useState<DeliveryChannel>('whatsapp');
    const [recipientContact, setRecipientContact] = useState('');
    const [message, setMessage] = useState('');
    const [subject, setSubject] = useState('');

    useEffect(() => {
        const fetchPatients = async () => {
            try {
                const { data, error } = await import('../utils/supabaseClient').then(m => m.supabase)
                    .from('patients')
                    .select('id, name, phone, email')
                    .limit(10);
                if (error) throw error;
                if (data) setPatients(data);
            } catch (err) {
                console.error("Error fetching patients:", err);
            }
        };
        fetchPatients();
    }, []);

    const handleSearchPatients = async (query: string) => {
        setSearchQuery(query);
        if (query.length < 2) {
            setPatients([]);
            return;
        }

        try {
            const { data, error } = await import('../utils/supabaseClient').then(m => m.supabase)
                .from('patients')
                .select('id, name, phone, email')
                .ilike('name', `%${query}%`)
                .limit(5);
            if (error) throw error;
            if (data) setPatients(data);
        } catch (err) {
            console.error("Error searching patients:", err);
        }
    };

    const handleAssign = async () => {
        if (!selectedPatient || !recipientContact) {
            addToast({ message: "Por favor, seleccione un paciente y un contacto.", type: "info" });
            return;
        }

        setIsSubmitting(true);
        try {
            await DistributionService.sendMaterialToCaregiver({
                patientName: selectedPatient.name,
                materialTitle: material.title,
                materialUrl: material.url,
                recipientContact,
                medium,
                message,
                subject: medium === 'email' ? subject : undefined,
                sessionId
            });
            
            addToast({ message: "Material enviado con éxito.", type: "success" });
            onClose();
        } catch (err: any) {
            addToast({ message: `Error al enviar: ${err.message}`, type: "error" });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">
                <div className="px-6 py-4 border-b dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
                    <div>
                        <h3 className="font-bold text-slate-900 dark:text-white text-lg">Asignar Material</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{material.title}</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1">
                            <User size={12} /> Paciente
                        </label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input 
                                type="text"
                                value={searchQuery}
                                onChange={e => handleSearchPatients(e.target.value)}
                                placeholder="Buscar paciente..."
                                className="w-full pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border-transparent focus:ring-2 focus:ring-blue-500/20 rounded-xl text-sm outline-none transition-all"
                            />
                        </div>
                        {patients.length > 0 && (
                            <div className="mt-2 border dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-800 max-h-32 overflow-y-auto">
                                {patients.map(p => (
                                    <button
                                        key={p.id}
                                        onClick={() => {
                                            setSelectedPatient(p);
                                            setSearchQuery(p.name);
                                            setRecipientContact(p.phone || p.email || '');
                                        }}
                                        className={`w-full text-left px-4 py-2 text-sm transition-colors ${selectedPatient?.id === p.id ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600' : 'hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'}`}
                                    >
                                        {p.name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1">
                            <Send size={12} /> Medio de Envío
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            <button 
                                onClick={() => setMedium('whatsapp')}
                                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${medium === 'whatsapp' ? 'bg-emerald-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}
                            >
                                <Phone size={14} /> WhatsApp
                            </button>
                            <button 
                                onClick={() => setMedium('email')}
                                className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all ${medium === 'email' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}
                            >
                                <Mail size={14} /> Email
                            </button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1">
                            <MessageSquare size={12} /> Contacto ({medium === 'whatsapp' ? 'Teléfono' : 'Email'})
                        </label>
                        <input 
                            type="text"
                            value={recipientContact}
                            onChange={e => setRecipientContact(e.target.value)}
                            placeholder={medium === 'whatsapp' ? '+34 600 000 000' : 'ejemplo@correo.com'}
                            className="w-full px-4 py-2 bg-slate-100 dark:bg-slate-800 border-transparent focus:ring-2 focus:ring-blue-500/20 rounded-xl text-sm outline-none transition-all"
                        />
                    </div>

                    {medium === 'email' && (
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1">
                                <FileText size={12} /> Asunto
                            </label>
                            <input 
                                type="text"
                                value={subject}
                                onChange={e => setSubject(e.target.value)}
                                placeholder="Asunto del correo..."
                                className="w-full px-4 py-2 bg-slate-100 dark:bg-slate-800 border-transparent focus:ring-2 focus:ring-blue-500/20 rounded-xl text-sm outline-none transition-all"
                            />
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-1">
                            <MessageSquare size={12} /> Mensaje Personalizado
                        </label>
                        <textarea 
                            rows={3}
                            value={message}
                            onChange={e => setMessage(e.target.value)}
                            placeholder="Escribe un mensaje para el cuidador..."
                            className="w-full px-4 py-2 bg-slate-100 dark:bg-slate-800 border-transparent focus:ring-2 focus:ring-blue-500/20 rounded-xl text-sm outline-none transition-all resize-none"
                        />
                    </div>
                </div>

                <div className="p-6 border-t dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                    <button 
                        onClick={handleAssign}
                        disabled={isSubmitting || !selectedPatient || !recipientContact}
                        className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                        Enviar Material
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MaterialAssignmentModal;

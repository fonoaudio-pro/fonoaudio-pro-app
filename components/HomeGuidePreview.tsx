import React from 'react';
import { HomeGuide } from '../types';
import { Printer, X, FileText, Image as ImageIcon, Copy, Send, Mail } from 'lucide-react';
import MaterialSelectorModal from './MaterialSelectorModal';
import { stripHtml, generateMessage, DeliveryMethod } from '../utils/messageTemplates';
import { useToast } from '../context/ToastContext';

interface HomeGuidePreviewProps {
    guide: HomeGuide;
    materials: any[];
    onClose: () => void;
    patientName: string;
}

const HomeGuidePreview: React.FC<HomeGuidePreviewProps> = ({ guide, materials, onClose, patientName }) => {
    const { addToast } = useToast();
    const getMaterialDetails = (id: string) => materials.find(m => m.id === id);

    const handlePrint = () => {
        window.print();
    };

    const handleCopyContent = async () => {
        try {
            const cleanText = stripHtml(guide.content);
            await navigator.clipboard.writeText(cleanText);
            addToast({ message: "Contenido copiado al portapapeles", type: "success" });
        } catch (err) {
            console.error("Error al copiar:", err);
            addToast({ message: "Error al copiar contenido", type: "error" });
        }
    };

    const handleShare = (method: DeliveryMethod) => {
        if (!guide.share_token) {
            addToast({ message: "La guía aún no tiene un enlace de compartir generado.", type: "error" });
            return;
        }

        const message = generateMessage(patientName, guide.title, method);
        const shareLink = `${window.location.origin}/share/guide/${guide.share_token}`;
        const fullMessage = `${message}\n\n🔗 ${shareLink}`;

        if (method === 'whatsapp') {
            window.open(`https://wa.me/?text=${encodeURIComponent(fullMessage)}`, '_blank');
        } else if (method === 'email') {
            window.location.href = `mailto:?subject=${encodeURIComponent('Guía de Apoyo: ' + guide.title)}&body=${encodeURIComponent(fullMessage)}`;
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4 backdrop-blur-sm print:p-0 print:bg-white print:block">
            {/* Controls - Hidden during print */}
            <div className="absolute top-4 right-4 flex gap-2 z-[80] print:hidden">
                <button 
                    onClick={handleCopyContent}
                    className="flex items-center gap-2 bg-white text-slate-600 px-4 py-2 rounded-xl font-bold shadow-lg hover:bg-slate-100 transition-all"
                >
                    <Copy size={18} /> Copiar Texto
                </button>
                <button 
                    onClick={() => handleShare('whatsapp')}
                    className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl font-bold shadow-lg hover:bg-emerald-100 transition-all"
                    title="Compartir por WhatsApp"
                >
                    <Send size={18} /> WhatsApp
                </button>
                <button 
                    onClick={() => handleShare('email')}
                    className="flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-xl font-bold shadow-lg hover:bg-blue-100 transition-all"
                    title="Compartir por Email"
                >
                    <Mail size={18} /> Email
                </button>
                <button 
                    onClick={handlePrint}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl font-bold shadow-lg hover:bg-blue-700 transition-all"
                >
                    <Printer size={18} /> Imprimir / PDF
                </button>
                <button 
                    onClick={onClose}
                    className="flex items-center gap-2 bg-white text-slate-600 px-4 py-2 rounded-xl font-bold shadow-lg hover:bg-slate-100 transition-all"
                >
                    <X size={18} /> Cerrar
                </button>
            </div>

            {/* Preview Content */}
            <div className="bg-white w-full max-w-4xl h-full max-h-[90vh] overflow-y-auto shadow-2xl rounded-2xl p-8 md:p-16 print:shadow-none print:max-w-none print:h-auto print:p-0 print:overflow-visible print:rounded-none">
                <style>{`
                    @media print {
                        body * {
                            visibility: hidden;
                        }
                        #print-area, #print-area * {
                            visibility: visible;
                        }
                        #print-area {
                            position: absolute;
                            left: 0;
                            top: 0;
                            width: 100%;
                        }
                        @page {
                            margin: 2cm;
                        }
                    }
                `}</style>

                <div id="print-area" className="print:p-0">
                    {/* Header */}
                    <header className="border-b-2 border-blue-600 pb-6 mb-8 flex justify-between items-end">
                        <div>
                            <h1 className="text-3xl font-bold text-slate-900 uppercase tracking-tight">{guide.title}</h1>
                            <p className="text-slate-500 text-sm mt-1">Guía de Apoyo para el Hogar</p>
                        </div>
                        <div className="text-right text-xs text-slate-400">
                            <p>Generado el {new Date().toLocaleDateString()}</p>
                        </div>
                    </header>

                    {/* Main Content */}
                    <main className="prose prose-slate max-w-none mb-12">
                        <div 
                            className="text-slate-700 leading-relaxed text-lg"
                            dangerouslySetInnerHTML={{ __html: guide.content }} 
                        />
                    </main>

                    {/* Materials Section */}
                    {guide.materialIds.length > 0 && (
                        <section className="border-t border-slate-100 pt-8">
                            <div className="flex items-center gap-2 mb-6 text-blue-600">
                                <ImageIcon size={20} />
                                <h2 className="text-xl font-bold uppercase tracking-wider">Materiales Sugeridos</h2>
                            </div>
                            
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {guide.materialIds.map(id => {
                                            const material = getMaterialDetails(id);
                                            if (!material) return null;
                                            return (
                                                <div key={id} className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                                                    <div className="w-12 h-12 rounded-lg bg-white flex items-center justify-center text-slate-400 shadow-sm shrink-0">
                                                        {material.media_type === 'image' ? <ImageIcon size={24} /> : <FileText size={24} />}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-bold text-slate-800 truncate">{material.title}</p>
                                                        <p className="text-xs text-slate-500 uppercase">{material.media_type}</p>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                        </section>
                    )}

                    {/* Footer */}
                    <footer className="mt-16 pt-8 border-t border-slate-100 text-center text-slate-400 text-xs">
                        <p>Fono-Pro AI • Guía personalizada para el tratamiento en casa</p>
                    </footer>
                </div>
            </div>
        </div>
    );
};

export default HomeGuidePreview;
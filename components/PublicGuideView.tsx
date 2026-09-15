import React, { useEffect, useState } from 'react';
import { HomeGuide } from '../types';
import { supabase } from '../utils/supabaseClient';
import { Loader2, AlertCircle, FileText, ImageIcon } from 'lucide-react';
import MaterialSelectorModal from './MaterialSelectorModal';

interface PublicGuideViewProps {
    token: string;
    materials: any[];
}

const PublicGuideView: React.FC<PublicGuideViewProps> = ({ token, materials }) => {
    const [guide, setGuide] = useState<HomeGuide | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchGuide = async () => {
            try {
                const { data, error: err } = await supabase
                    .from('home_guides')
                    .select('*')
                    .eq('share_token', token)
                    .single();

                if (err || !data) {
                    setError("No se pudo encontrar la guía solicitada.");
                } else {
                    setGuide(data);
                }
            } catch (err) {
                setError("Error al cargar la guía.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchGuide();
    }, [token]);

    const getMaterialDetails = (id: string) => materials.find(m => m.id === id);

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <Loader2 className="animate-spin text-blue-600" size={48} />
            </div>
        );
    }

    if (error || !guide) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
                <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center space-y-4">
                    <AlertCircle className="mx-auto text-red-500" size={48} />
                    <h2 className="text-2xl font-bold text-slate-900">Error</h2>
                    <p className="text-slate-600">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto bg-white shadow-xl rounded-3xl overflow-hidden">
                <div className="bg-blue-600 p-8 text-white">
                    <h1 className="text-3xl font-bold">{guide.title}</h1>
                    <p className="opacity-90 mt-2">Guía de Apoyo para el Hogar</p>
                </div>

                <div className="p-8 md:p-12 space-y-12">
                    <main className="prose prose-blue max-w-none">
                        <div 
                            className="text-slate-700 leading-relaxed text-lg"
                            dangerouslySetInnerHTML={{ __html: guide.content }} 
                        />
                    </main>

                    {guide.materialIds.length > 0 && (
                        <section className="border-t border-slate-100 pt-8">
                            <div className="flex items-center gap-2 mb-6 text-blue-600">
                                <ImageIcon size={24} />
                                <h2 className="text-xl font-bold uppercase tracking-wider">Materiales Sugeridos</h2>
                            </div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {guide.materialIds.map(id => {
                                    const material = getMaterialDetails(id);
                                    if (!material) return null;
                                    return (
                                         <div key={id} className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                             <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center text-slate-400 shadow-sm shrink-0">
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
                </div>

                <footer className="bg-slate-50 p-8 text-center text-slate-400 text-sm border-t border-slate-100">
                    <p>Fono-Pro AI • Guía personalizada para el tratamiento en casa</p>
                </footer>
            </div>
        </div>
    );
};

export default PublicGuideView;

import React, { useState, useMemo } from 'react';
import { Search, CheckCircle2, ImageIcon, Video, Mic, FileText, X } from 'lucide-react';
import { Material } from '../types';

interface MaterialSelectorModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (material: Material) => void;
    materials: Material[];
}

const MaterialSelectorModal: React.FC<MaterialSelectorModalProps> = ({ isOpen, onClose, onSelect, materials }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [filterTab, setFilterTab] = useState('all');

    const filteredMaterials = useMemo(() => {
        return materials.filter(item => {
            const matchesQuery = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                 item.category?.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesTab = filterTab === 'all' || item.type === filterTab;
            return matchesQuery && matchesTab;
        });
    }, [materials, searchQuery, filterTab]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
                <div className="p-6 border-b dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
                    <h3 className="text-xl font-black text-slate-900 dark:text-white">Seleccionar Material</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-2"><X size={24} /></button>
                </div>

                <div className="p-6 space-y-4">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        <input 
                            type="text" 
                            placeholder="Buscar en la biblioteca..." 
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-slate-100 dark:bg-slate-800 border-transparent focus:border-blue-500 focus:ring-0 rounded-2xl text-sm transition-all outline-none"
                        />
                    </div>

                    <div className="flex gap-2">
                        {['all', 'propios', 'recursos'].map(tab => (
                            <button 
                                key={tab}
                                onClick={() => setFilterTab(tab)}
                                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                                    filterTab === tab 
                                    ? 'bg-blue-600 text-white' 
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                                }`}
                            >
                                {tab === 'all' ? 'Todos' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                            </button>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto pr-2 custom-scrollbar">
                        {filteredMaterials.map(item => (
                            <div 
                                key={item.id} 
                                onClick={() => onSelect(item)}
                                className="group cursor-pointer p-4 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-750 rounded-2xl hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-lg transition-all"
                            >
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 uppercase">{item.category}</span>
                                    {item.verified && <CheckCircle2 size={14} className="text-emerald-500" />}
                                </div>
                                <h4 className="font-bold text-slate-800 dark:text-white text-sm mb-3 group-hover:text-blue-500 transition-colors">{item.title}</h4>
                                 <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400">
                                     {item.media_type === 'pdf' && <FileText size={12} />}
                                     {item.media_type === 'video' && <Video size={12} />}
                                     {item.media_type === 'image' && <ImageIcon size={12} />}
                                     {item.media_type === 'audio' && <Mic size={12} />}
                                     <span>{item.media_type} • {item.resource_type}</span>
                                 </div>

                            </div>
                        ))}
                    </div>

                    {filteredMaterials.length === 0 && (
                        <div className="py-12 text-center text-slate-400 italic text-sm">
                            No se encontraron materiales.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default MaterialSelectorModal;

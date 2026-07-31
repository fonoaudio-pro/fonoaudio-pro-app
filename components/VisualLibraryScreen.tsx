import React, { useState, useMemo } from 'react';
import { 
    Search, Plus, Download, CheckCircle2, FileText, ImageIcon, 
    Video, Mic, Loader2, AlertCircle, Filter, Layers, User, 
    Settings2, ChevronDown, Send, Edit3, Share2
} from 'lucide-react';
import UploadMaterialModal from './UploadMaterialModal';
import MaterialAssignmentModal from './MaterialAssignmentModal';
import MaterialEditor from './MaterialEditor';
import ShareMenu from './ShareMenu';
import { Material, ClinicalArea, ResourceType, PatientProfile } from '../types';
import { ShareMaterialInput } from '../utils/shareMaterial';

interface VisualLibraryScreenProps {
    materials: Material[];
    isLoading?: boolean;
    error?: string | null;
    onUpload: (material: Material) => void;
    onEditMaterial?: (material: Material) => void;
}

const VisualLibraryScreen: React.FC<VisualLibraryScreenProps> = ({ materials, isLoading, error, onUpload, onEditMaterial }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [areaFilter, setAreaFilter] = useState<ClinicalArea | 'all'>('all');
    const [typeFilter, setTypeFilter] = useState<ResourceType | 'all'>('all');
    const [profileFilter, setProfileFilter] = useState<PatientProfile | 'all'>('all');
    const [selectedMaterialForAssignment, setSelectedMaterialForAssignment] = useState<Material | null>(null);
    const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
    const [sharingMaterial, setSharingMaterial] = useState<ShareMaterialInput | null>(null);

    const filteredMaterials = useMemo(() => {
        return materials.filter(item => {
            const matchesQuery = item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                 (item.tags?.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())));
            const matchesArea = areaFilter === 'all' || item.clinical_area === areaFilter;
            const matchesType = typeFilter === 'all' || item.resource_type === typeFilter;
            const matchesProfile = profileFilter === 'all' || item.target_profile === profileFilter;
            return matchesQuery && matchesArea && matchesType && matchesProfile;
        });
    }, [materials, searchQuery, areaFilter, typeFilter, profileFilter]);

    const clinicalAreas: (ClinicalArea | 'all')[] = ['all', 'Voz', 'Habla', 'Lenguaje', 'Deglución', 'Audiología', 'Otro'];
    const resourceTypes: (ResourceType | 'all')[] = ['all', 'guía', 'juego', 'ejercicio', 'otro'];
    const patientProfiles: (PatientProfile | 'all')[] = ['all', 'pediátrico', 'adulto', 'geriátrico', 'mixto'];

    const getMediaIcon = (mediaType: Material['media_type']) => {
        switch (mediaType) {
            case 'image': return <ImageIcon size={24} className="text-blue-500" />;
            case 'video': return <Video size={24} className="text-purple-500" />;
            case 'audio': return <Mic size={24} className="text-amber-500" />;
            case 'pdf': return <FileText size={24} className="text-rose-500" />;
            default: return <FileText size={24} className="text-slate-400" />;
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-full space-y-4 animate-pulse">
                <Loader2 size={48} className="text-blue-500 animate-spin" />
                <p className="text-slate-500 font-medium">Cargando biblioteca...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-full space-y-4 text-center">
                <AlertCircle size={48} className="text-rose-500" />
                <h3 className="text-lg font-bold text-slate-800 dark:text-white">Error al cargar materiales</h3>
                <p className="text-slate-500 max-w-xs">{error}</p>
            </div>
        );
    }

    return (
        <div className="p-8 overflow-y-auto flex-1 space-y-6 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white">Biblioteca de Materiales</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Explora y asigna recursos clínicos</p>
                </div>
                <button 
                    onClick={() => setIsOpen(true)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 font-bold text-sm transition-all shadow-md"
                >
                    <Plus size={18} /> Agregar Nuevo
                </button>
            </div>

            {/* Filters Bar */}
            <div className="flex flex-wrap gap-4 items-center bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-750 shadow-sm">
                <div className="relative flex-1 min-w-[240px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                        type="text" 
                        placeholder="Buscar por título o etiquetas..." 
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                </div>
                
                <div className="flex flex-wrap gap-2">
                    <div className="relative group">
                        <select 
                            value={areaFilter}
                            onChange={e => setAreaFilter(e.target.value as any)}
                            className="appearance-none pl-3 pr-8 py-2 border dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-xs font-bold text-slate-600 dark:text-slate-400 outline-none cursor-pointer"
                        >
                            {clinicalAreas.map(area => (
                                <option key={area} value={area}>{area === 'all' ? 'Todas las Áreas' : area}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                    </div>

                    <div className="relative group">
                        <select 
                            value={typeFilter}
                            onChange={e => setTypeFilter(e.target.value as any)}
                            className="appearance-none pl-3 pr-8 py-2 border dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-xs font-bold text-slate-600 dark:text-slate-400 outline-none cursor-pointer"
                        >
                            {resourceTypes.map(type => (
                                <option key={type} value={type}>{type === 'all' ? 'Todos los Tipos' : type}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                    </div>

                    <div className="relative group">
                        <select 
                            value={profileFilter}
                            onChange={e => setProfileFilter(e.target.value as any)}
                            className="appearance-none pl-3 pr-8 py-2 border dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-xs font-bold text-slate-600 dark:text-slate-400 outline-none cursor-pointer"
                        >
                            {patientProfiles.map(profile => (
                                <option key={profile} value={profile}>{profile === 'all' ? 'Todos los Perfiles' : profile}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                    </div>
                </div>
            </div>

            {/* Materials Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredMaterials.map(item => (
                    <div key={item.id} className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-750 shadow-sm hover:shadow-md transition-all group overflow-hidden relative flex flex-col">
                        {/* Difficulty Badge */}
                        {item.difficulty_level && (
                            <div className="absolute top-3 right-3 text-[9px] font-black px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 uppercase">
                                {item.difficulty_level}
                            </div>
                        )}
                        
                        <div className="flex items-center justify-between mb-3">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 uppercase">
                                {item.resource_type}
                            </span>
                            {item.verified && <CheckCircle2 size={14} className="text-emerald-500" />}
                        </div>

                        <div className="flex-1">
                            <div className="w-full aspect-video bg-slate-100 dark:bg-slate-900 rounded-xl mb-4 flex items-center justify-center text-slate-400 transition-transform group-hover:scale-[1.02] overflow-hidden">
                                {item.media_type === 'image' && item.url ? (
                                    <img src={item.url} alt={item.title} className="w-full h-full object-cover"
                                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden'); }} />
                                ) : null}
                                <div className={item.media_type === 'image' && item.url ? 'hidden' : ''}>
                                    {getMediaIcon(item.media_type)}
                                </div>
                            </div>

                            <h3 className="font-bold text-slate-800 dark:text-white text-sm mb-3 line-clamp-1">{item.title}</h3>
                            
                            <div className="space-y-1.5 mb-5">
                                <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                                    <Layers size={12} className="text-blue-500" />
                                    <span>{item.clinical_area}</span>
                                </div>
                                <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                                    <User size={12} className="text-blue-500" />
                                    <span>{item.target_profile}</span>
                                </div>
                            </div>
                        </div>

                        <div className="mt-auto">
                            {item.url ? (
                                <a 
                                    href={item.url} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="w-full py-2.5 bg-slate-50 dark:bg-slate-700 hover:bg-blue-600 hover:text-white text-blue-600 dark:text-blue-400 text-center rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
                                >
                                    <FileText size={14} /> Ver Recurso
                                </a>
                            ) : (
                                <button 
                                    disabled
                                    className="w-full py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 text-center rounded-xl text-xs font-bold cursor-not-allowed"
                                >
                                    Sin Recurso
                                </button>
                            )}
                        </div>
                        <button 
                            onClick={() => setSelectedMaterialForAssignment(item)}
                            className="w-full mt-3 py-2.5 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-600 hover:text-white text-blue-600 dark:text-blue-400 text-center rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
                        >
                            <Send size={14} /> Asignar
                        </button>
                        {onEditMaterial && (
                        <button 
                            onClick={() => setEditingMaterial(item)}
                            className="w-full mt-2 py-2.5 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-600 hover:text-white text-amber-600 dark:text-amber-400 text-center rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
                        >
                            <Edit3 size={14} /> Editar
                        </button>
                        )}
                        <button 
                            onClick={() => setSharingMaterial({
                                title: item.title,
                                imageUrl: item.url || '',
                                description: item.description,
                                clinicalArea: item.clinical_area,
                                tags: item.tags,
                            })}
                            disabled={!item.url}
                            className="w-full mt-2 py-2.5 bg-slate-50 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300 text-center rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <Share2 size={14} /> Compartir
                        </button>
                    </div>
                ))}
            </div>

            {filteredMaterials.length === 0 && (
                <div className="text-center py-20 text-slate-400 italic text-sm">
                    No se encontraron materiales que coincidan con la búsqueda.
                </div>
            )}

            {selectedMaterialForAssignment && (
            <MaterialAssignmentModal 
                material={selectedMaterialForAssignment} 
                onClose={() => setSelectedMaterialForAssignment(null)} 
            />
            )}

            <UploadMaterialModal 
                isOpen={isOpen} 
                onClose={() => setIsOpen(false)} 
                onUpload={onUpload} 
            />

            {editingMaterial && (
                <MaterialEditor
                    materialId={editingMaterial.id}
                    imageUrl={editingMaterial.url || ''}
                    onClose={() => setEditingMaterial(null)}
                    onSaved={() => {
                        setEditingMaterial(null);
                    }}
                />
            )}

            {sharingMaterial && (
                <ShareMenu
                    material={sharingMaterial}
                    isOpen={true}
                    onClose={() => setSharingMaterial(null)}
                />
            )}
        </div>
    );
};

export default VisualLibraryScreen;

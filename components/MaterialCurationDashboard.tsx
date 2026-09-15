import React, { useState, useEffect, useMemo } from 'react';
import { 
    Search, Filter, Trash2, Merge, CheckCircle2, AlertCircle, 
    RefreshCw, ArrowLeft, Settings2, Check, X, Info, Layers,
    ShieldCheck, Archive, Tag as TagIcon, Star, AlertTriangle,
    Save, FileText, Globe, User, Activity
} from 'lucide-react';
import { Material, ClinicalArea, ResourceType, PatientProfile, DeliveryChannel } from '../types';
import { MaterialService } from '../services/MaterialService';
import { useToast } from '../context/ToastContext';

interface MaterialCurationDashboardProps {
    onClose: () => void;
}

type ViewMode = 'library' | 'duplicates';

const MaterialCurationDashboard: React.FC<MaterialCurationDashboardProps> = ({ onClose }) => {
    const { addToast } = useToast();
    const [viewMode, setViewMode] = useState<ViewMode>('library');
    const [materials, setMaterials] = useState<Material[]>([]);
    const [duplicates, setDuplicates] = useState<{ primaryId: string, secondaryId: string, url: string }[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
    
    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<Material['status'] | 'all'>('active');
    const [priorityFilter, setPriorityFilter] = useState<Material['priority'] | 'all'>('all');
    const [areaFilter, setAreaFilter] = useState<string>('all');
    const [typeFilter, setTypeFilter] = useState<string>('all');
    
    // Edit Form State
    const [editForm, setEditForm] = useState<Material | null>(null);
    const [editTags, setEditTags] = useState<string[]>([]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [mats, dups] = await Promise.all([
                MaterialService.getAllMaterials(),
                MaterialService.findDuplicateUrls()
            ]);
            setMaterials(mats);
            setDuplicates(dups);
        } catch (err) {
            console.error("Error loading curation data:", err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    // Filtered Materials
    const filteredMaterials = useMemo(() => {
        return materials.filter(m => {
            const matchesSearch = m.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                 (m.tags?.some(t => t.toLowerCase().includes(searchQuery.toLowerCase())));
            const matchesStatus = statusFilter === 'all' || m.status === statusFilter;
            const matchesPriority = priorityFilter === 'all' || m.priority === priorityFilter;
            const matchesArea = areaFilter === 'all' || m.clinical_area === areaFilter;
            const matchesType = typeFilter === 'all' || m.resource_type === typeFilter;
            return matchesSearch && matchesStatus && matchesPriority && matchesArea && matchesType;
        });
    }, [materials, searchQuery, statusFilter, priorityFilter, areaFilter, typeFilter]);

    // Get unique clinical areas and resource types for filters
    const clinicalAreas = useMemo(() => {
        const areas = new Set<string>();
        materials.forEach(m => {
            if (m.clinical_area) areas.add(m.clinical_area);
        });
        return Array.from(areas).sort();
    }, [materials]);

    const resourceTypes = useMemo(() => {
        const types = new Set<string>();
        materials.forEach(m => {
            if (m.resource_type) types.add(m.resource_type);
        });
        return Array.from(types).sort();
    }, [materials]);

    // Actions
    const handleArchive = async (id: string) => {
        if (!confirm("¿Estás seguro de que deseas archivar este material?")) return;
        try {
            await MaterialService.archiveMaterial(id);
            await loadData();
            if (selectedMaterial?.id === id) setSelectedMaterial(null);
            addToast({ message: "Material archivado con éxito.", type: "success" });
        } catch (err) {
            addToast({ message: "Error al archivar el material.", type: "error" });
        }
    };

    const handleMerge = async (primaryId: string, secondaryId: string) => {
        if (!confirm("¿Deseas fusionar estos materiales? Se combinarán las etiquetas y el secundario se archivará.")) return;
        try {
            await MaterialService.mergeMaterials(primaryId, secondaryId);
            await loadData();
            if (selectedMaterial?.id === secondaryId) setSelectedMaterial(null);
            addToast({ message: "Materiales fusionados con éxito.", type: "success" });
        } catch (err) {
            addToast({ message: "Error al fusionar los materiales.", type: "error" });
        }
    };

    const handleSaveAll = async () => {
        if (!editForm) return;
        try {
            await MaterialService.updateMaterial(editForm.id, editForm);
            await loadData();
            setSelectedMaterial(null);
            setEditForm(null);
            addToast({ message: "Cambios guardados con éxito.", type: "success" });
        } catch (err) {
            addToast({ message: "Error al guardar los cambios.", type: "error" });
        }
    };

    const handleNormalizeTags = async () => {
        if (!editForm) return;
        try {
            await MaterialService.normalizeTags(editForm.id, editTags);
            await loadData();
            setEditForm(null);
            addToast({ message: "Etiquetas normalizadas con éxito.", type: "success" });
        } catch (err) {
            addToast({ message: "Error al normalizar etiquetas.", type: "error" });
        }
    };

    const openEditor = (material: Material) => {
        setSelectedMaterial(material);
        setEditForm({...material});
        setEditTags(material.tags || []);
    };

    return (
        <div className="flex h-full bg-slate-50 dark:bg-slate-950 overflow-hidden">
            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0">
                {/* Header */}
                <div className="h-16 border-b dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between px-6 shrink-0">
                    <div className="flex items-center gap-4">
                        <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            {viewMode === 'library' ? <Layers size={20} className="text-blue-500" /> : <AlertTriangle size={20} className="text-amber-500" />}
                            {viewMode === 'library' ? 'Biblioteca de Materiales' : 'Revisión de Duplicados'}
                        </h2>
                        <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 mx-2" />
                        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                            <button 
                                onClick={() => setViewMode('library')}
                                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${viewMode === 'library' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600' : 'text-slate-500'}`}
                            >
                                Biblioteca
                            </button>
                            <button 
                                onClick={() => setViewMode('duplicates')}
                                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${viewMode === 'duplicates' ? 'bg-white dark:bg-slate-700 shadow-sm text-amber-600' : 'text-slate-500'}`}
                            >
                                Duplicados
                            </button>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all">
                        <X size={20} />
                    </button>
                </div>

                {/* Toolbar */}
                {viewMode === 'library' && (
                    <div className="p-4 border-b dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap gap-3 items-center shrink-0">
                        <div className="relative flex-1 min-w-[240px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                            <input 
                                type="text"
                                placeholder="Buscar material..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border-transparent focus:ring-2 focus:ring-blue-500/20 rounded-xl text-sm outline-none transition-all"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Filter size={16} className="text-slate-400" />
                            <select 
                                value={statusFilter}
                                onChange={e => setStatusFilter(e.target.value as any)}
                                className="bg-slate-100 dark:bg-slate-800 border-transparent text-xs font-bold rounded-lg px-2 py-2 outline-none"
                            >
                                <option value="all">Todos los estados</option>
                                <option value="active">Activos</option>
                                <option value="obsolete">Obsoletos</option>
                                <option value="archived">Archivados</option>
                            </select>
                            <select 
                                value={priorityFilter}
                                onChange={e => setPriorityFilter(e.target.value as any)}
                                className="bg-slate-100 dark:bg-slate-800 border-transparent text-xs font-bold rounded-lg px-2 py-2 outline-none"
                            >
                                <option value="all">Todas las prioridades</option>
                                <option value="high">Alta</option>
                                <option value="medium">Media</option>
                                <option value="low">Baja</option>
                            </select>
                            <select 
                                value={areaFilter}
                                onChange={e => setAreaFilter(e.target.value)}
                                className="bg-slate-100 dark:bg-slate-800 border-transparent text-xs font-bold rounded-lg px-2 py-2 outline-none"
                            >
                                <option value="all">Todas las áreas</option>
                                {clinicalAreas.map(area => <option key={area} value={area}>{area}</option>)}
                            </select>
                            <select 
                                value={typeFilter}
                                onChange={e => setTypeFilter(e.target.value)}
                                className="bg-slate-100 dark:bg-slate-800 border-transparent text-xs font-bold rounded-lg px-2 py-2 outline-none"
                            >
                                <option value="all">Todos los tipos</option>
                                {resourceTypes.map(type => <option key={type} value={type}>{type}</option>)}
                            </select>
                        </div>
                    </div>
                )}

                {/* Main List View */}
                <div className="flex-1 overflow-y-auto p-6">
                    {isLoading ? (
                        <div className="h-full flex items-center justify-center text-slate-400 italic">
                            <RefreshCw size={24} className="animate-spin mr-2" />
                            Cargando datos...
                        </div>
                    ) : viewMode === 'library' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            {filteredMaterials.length === 0 ? (
                                <div className="col-span-full py-20 text-center text-slate-400 italic">
                                    No se encontraron materiales con los filtros seleccionados.
                                </div>
                            ) : (
                                filteredMaterials.map(m => (
                                    <div 
                                        key={m.id} 
                                        onClick={() => openEditor(m)}
                                        className={`group relative p-4 bg-white dark:bg-slate-900 border rounded-2xl cursor-pointer transition-all hover:shadow-md ${selectedMaterial?.id === m.id ? 'border-blue-500 ring-1 ring-blue-500' : 'border-slate-200 dark:border-slate-800'}`}
                                    >
                                        <div className="flex justify-between items-start mb-3">
                                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase ${
                                                m.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 
                                                m.status === 'obsolete' ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-500'
                                            }`}>
                                                {m.status || 'active'}
                                            </span>
                                            <div className="flex items-center gap-1">
                                                {m.priority === 'high' && <Star size={14} className="text-amber-500 fill-amber-500" />}
                                                {m.quality_score && m.quality_score < 40 && <AlertTriangle size={14} className="text-red-500" />}
                                            </div>
                                        </div>
                                        <h4 className="font-bold text-slate-800 dark:text-white text-sm mb-1 truncate pr-4">{m.title}</h4>
                                        <p className="text-[10px] text-slate-500 uppercase font-medium mb-3">{m.clinical_area} • {m.resource_type}</p>
                                        
                                        <div className="flex items-center justify-between pt-3 border-t dark:border-slate-800 mt-auto">
                                            <div className="flex gap-1">
                                                {m.tags?.slice(0, 2).map(tag => (
                                                    <span key={tag} className="text-[9px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-1.5 py-0.5 rounded">#{tag}</span>
                                                ))}
                                            </div>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleArchive(m.id); }}
                                                className="p-1.5 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                                            >
                                                <Archive size={14} />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    ) : (
                        /* Duplicates View */
                        <div className="max-w-4xl mx-auto space-y-6">
                            {duplicates.length === 0 ? (
                                <div className="py-20 text-center text-slate-400 italic">
                                    No se han detectado duplicados por URL.
                                </div>
                            ) : (
                                duplicates.map((dup, idx) => (
                                    <div key={idx} className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/30 rounded-2xl overflow-hidden shadow-sm">
                                        <div className="bg-amber-50 dark:bg-amber-900/10 px-4 py-2 flex items-center gap-2 text-amber-700 dark:text-amber-400">
                                            <AlertTriangle size={16} />
                                            <span className="text-xs font-bold">Posible duplicado detectado: {dup.url}</span>
                                        </div>
                                        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {/* Primary Option */}
                                            <div 
                                                onClick={() => {
                                                    const m = materials.find(mat => mat.id === dup.primaryId);
                                                    if (m) openEditor(m);
                                                }}
                                                className="p-4 border dark:border-slate-800 rounded-xl hover:border-blue-500 cursor-pointer transition-all"
                                            >
                                                <div className="text-[10px] text-blue-600 font-black uppercase mb-1">Primario Sugerido</div>
                                                <div className="font-bold text-slate-800 dark:text-white text-sm truncate">{materials.find(m => m.id === dup.primaryId)?.title || 'Desconocido'}</div>
                                            </div>
                                            {/* Secondary Option */}
                                            <div 
                                                onClick={() => {
                                                    const m = materials.find(mat => mat.id === dup.secondaryId);
                                                    if (m) openEditor(m);
                                                }}
                                                className="p-4 border dark:border-slate-800 rounded-xl hover:border-blue-500 cursor-pointer transition-all"
                                            >
                                                <div className="text-[10px] text-slate-500 font-black uppercase mb-1">Secundario Detectado</div>
                                                <div className="font-bold text-slate-800 dark:text-white text-sm truncate">{materials.find(m => m.id === dup.secondaryId)?.title || 'Desconocido'}</div>
                                            </div>
                                        </div>
                                        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-t dark:border-slate-800 flex items-center justify-between">
                                            <span className="text-xs text-slate-500 italic">Acción recomendada: Fusionar</span>
                                            <button 
                                                onClick={() => handleMerge(dup.primaryId, dup.secondaryId)}
                                                className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-all"
                                            >
                                                <Merge size={14} /> Fusionar
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Side Editor Panel */}
            {selectedMaterial && (
                <div className="w-96 border-l dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col shrink-0 shadow-2xl animate-in slide-in-from-right duration-300">
                    <div className="h-16 border-b dark:border-slate-800 flex items-center justify-between px-4">
                        <h3 className="font-bold text-slate-900 dark:text-white text-sm">Curación de Material</h3>
                        <button onClick={() => setSelectedMaterial(null)} className="p-1 text-slate-400 hover:text-slate-600"><X size={20} /></button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-5 space-y-6">
                        {/* Form Container */}
                        {editForm && (
                            <>
                                {/* Basic Info */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase">
                                        <FileText size={14} className="text-blue-500" />
                                        Información General
                                    </div>
                                    
                                    <div className="space-y-3 bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border dark:border-slate-700">
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 block mb-1">Título</label>
                                            <input 
                                                type="text"
                                                value={editForm.title}
                                                onChange={e => setEditForm({...editForm, title: e.target.value})}
                                                className="w-full bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 block mb-1">Descripción</label>
                                            <textarea 
                                                value={editForm.description}
                                                onChange={e => setEditForm({...editForm, description: e.target.value})}
                                                rows={3}
                                                className="w-full bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Clinical Categorization */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase">
                                        <Activity size={14} className="text-blue-500" />
                                        Clasificación Clínica
                                    </div>

                                    <div className="space-y-3 bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border dark:border-slate-700">
                                        <div className="grid grid-cols-1 gap-3">
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-500 block mb-1">Área Clínica</label>
                                                <select 
                                                    value={editForm.clinical_area}
                                                    onChange={e => setEditForm({...editForm, clinical_area: e.target.value as ClinicalArea})}
                                                    className="w-full bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-lg px-3 py-2 text-sm outline-none"
                                                >
                                                    {(['Voz', 'Habla', 'Lenguaje', 'Deglución', 'Audiología', 'Otro'] as ClinicalArea[]).map(area => (
                                                        <option key={area} value={area}>{area}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-500 block mb-1">Tipo de Recurso</label>
                                                <select 
                                                    value={editForm.resource_type}
                                                    onChange={e => setEditForm({...editForm, resource_type: e.target.value as ResourceType})}
                                                    className="w-full bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-lg px-3 py-2 text-sm outline-none"
                                                >
                                                    {(['guía', 'juego', 'ejercicio', 'otro'] as ResourceType[]).map(type => (
                                                        <option key={type} value={type}>{type}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-slate-500 block mb-1">Perfil de Paciente</label>
                                                <select 
                                                    value={editForm.target_profile}
                                                    onChange={e => setEditForm({...editForm, target_profile: e.target.value as PatientProfile})}
                                                    className="w-full bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-lg px-3 py-2 text-sm outline-none"
                                                >
                                                    {(['pediátrico', 'adulto', 'geriátrico', 'mixto'] as PatientProfile[]).map(profile => (
                                                        <option key={profile} value={profile}>{profile}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Dificultad</label>
                                                    <select 
                                                        value={editForm.difficulty_level || 'medium'}
                                                        onChange={e => setEditForm({...editForm, difficulty_level: e.target.value as any})}
                                                        className="w-full bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-lg px-3 py-2 text-sm outline-none"
                                                    >
                                                        <option value="easy">Fácil</option>
                                                        <option value="medium">Media</option>
                                                        <option value="hard">Difícil</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="text-[10px] font-bold text-slate-500 block mb-1">Medio</label>
                                                    <select 
                                                        value={editForm.media_type}
                                                        onChange={e => setEditForm({...editForm, media_type: e.target.value as any})}
                                                        className="w-full bg-white dark:bg-slate-900 border dark:border-slate-700 rounded-lg px-3 py-2 text-sm outline-none"
                                                    >
                                                        <option value="image">Imagen</option>
                                                        <option value="video">Video</option>
                                                        <option value="pdf">PDF</option>
                                                        <option value="audio">Audio</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Quality & Priority */}
                                <div className="space-y-4">
                                    <div className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase">
                                        <ShieldCheck size={14} className="text-blue-500" />
                                        Calidad y Relevancia
                                    </div>
                                    
                                    <div className="space-y-4 bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl border dark:border-slate-700">
                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 block mb-2">Puntuación de Calidad ({editForm.quality_score || 0})</label>
                                            <input 
                                                type="range" min="0" max="100" step="5"
                                                value={editForm.quality_score || 0}
                                                onChange={e => setEditForm({...editForm, quality_score: parseInt(e.target.value)})}
                                                className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                            />
                                        </div>

                                        <div>
                                            <label className="text-[10px] font-bold text-slate-500 block mb-2">Prioridad</label>
                                            <div className="grid grid-cols-3 gap-2">
                                                {(['low', 'medium', 'high'] as const).map(p => (
                                                    <button
                                                        key={p}
                                                        onClick={() => setEditForm({...editForm, priority: p})}
                                                        className={`py-1.5 text-[10px] font-black rounded-lg border transition-all ${
                                                            editForm.priority === p 
                                                            ? 'bg-blue-600 text-white border-blue-600' 
                                                            : 'bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-700'
                                                        }`}
                                                    >
                                                        {p.toUpperCase()}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Tags Section */}
                                <div className="space-y-3">
                                    <div className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase">
                                        <TagIcon size={14} className="text-blue-500" />
                                        Normalización de Etiquetas
                                    </div>
                                    <div className="flex flex-wrap gap-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-2xl border dark:border-slate-700">
                                        {editTags.map((tag, i) => (
                                            <span key={i} className="flex items-center gap-1 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-2 py-1 rounded-lg text-xs border dark:border-slate-600">
                                                {tag}
                                                <button onClick={() => setEditTags(editTags.filter(t => t !== tag))}><X size={12} /></button>
                                            </span>
                                        ))}
                                        <input 
                                            className="bg-transparent text-xs outline-none min-w-[60px]"
                                            placeholder="Añadir..."
                                            onKeyDown={e => {
                                                if (e.key === 'Enter' && (e.target as HTMLInputElement).value) {
                                                    setEditTags([...editTags, (e.target as HTMLInputElement).value]);
                                                    (e.target as HTMLInputElement).value = '';
                                                }
                                            }}
                                        />
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Actions */}
                        <div className="pt-6 space-y-3">
                            <button 
                                onClick={handleSaveAll}
                                disabled={!editForm}
                                className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-xl font-bold text-xs hover:bg-blue-700 disabled:opacity-50 transition-all shadow-md"
                            >
                                <Save size={16} /> Guardar Cambios
                            </button>
                            <button 
                                onClick={handleNormalizeTags}
                                disabled={!editForm}
                                className="w-full flex items-center justify-center gap-2 py-2.5 bg-slate-800 text-white rounded-xl font-bold text-xs hover:bg-slate-900 transition-all shadow-md dark:bg-slate-700 dark:hover:bg-slate-600 disabled:opacity-50"
                            >
                                <Check size={16} /> Normalizar Etiquetas
                            </button>
                            <div className="h-px bg-slate-100 dark:bg-slate-800 my-4" />
                            <button 
                                onClick={() => selectedMaterial && handleArchive(selectedMaterial.id)}
                                disabled={!selectedMaterial}
                                className="w-full flex items-center justify-center gap-2 py-2.5 bg-red-50 text-red-600 rounded-xl font-bold text-xs hover:bg-red-100 transition-all disabled:opacity-50"
                            >
                                <Archive size={16} /> Archivar Material
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MaterialCurationDashboard;

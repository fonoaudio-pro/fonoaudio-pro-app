import React, { useState, useRef } from 'react';
import { X, Loader2, Upload, FileText, Image as ImageIcon, Video, Headphones, Link } from 'lucide-react';
import { supabase } from '../utils/supabaseClient';

interface UploadMaterialModalProps {
    isOpen: boolean;
    onClose: () => void;
    onUpload: (material: any) => void;
}

const UploadMaterialModal: React.FC<UploadMaterialModalProps> = ({ isOpen, onClose, onUpload }) => {
    const [title, setTitle] = useState('');
    const [clinicalArea, setClinicalArea] = useState('Lenguaje');
    const [resourceType, setResourceType] = useState('propios');
    const [mediaType, setMediaType] = useState<'image' | 'video' | 'pdf' | 'audio'>('pdf');
    const [url, setUrl] = useState('');
    const [verified, setVerified] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [saving, setSaving] = useState(false);
    const [uploadMode, setUploadMode] = useState<'file' | 'url'>('file');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploadProgress, setUploadProgress] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const resetForm = () => {
        setTitle('');
        setClinicalArea('Lenguaje');
        setResourceType('propios');
        setMediaType('pdf');
        setUrl('');
        setVerified(false);
        setErrors({});
        setSelectedFile(null);
        setUploadProgress(0);
        setUploadMode('file');
    };

    const detectMediaType = (file: File): 'image' | 'video' | 'pdf' | 'audio' => {
        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext) || file.type.startsWith('image/')) return 'image';
        if (['mp4', 'webm', 'avi', 'mov'].includes(ext) || file.type.startsWith('video/')) return 'video';
        if (['mp3', 'wav', 'ogg', 'm4a', 'aac'].includes(ext) || file.type.startsWith('audio/')) return 'audio';
        return 'pdf';
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setSelectedFile(file);
        setMediaType(detectMediaType(file));
        if (!title.trim()) {
            setTitle(file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '));
        }
        setErrors(prev => ({ ...prev, file: '' }));
    };

    const uploadFileToStorage = async (file: File): Promise<string | null> => {
        const ext = file.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const filePath = `materials/${fileName}`;

        const { error } = await supabase.storage
            .from('materials')
            .upload(filePath, file, { contentType: file.type });

        if (error) {
            console.error('Upload error:', error);
            return null;
        }

        const { data: urlData } = supabase.storage.from('materials').getPublicUrl(filePath);
        return urlData?.publicUrl || null;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const newErrors: Record<string, string> = {};
        if (!title.trim()) newErrors.title = 'El título es requerido';
        if (uploadMode === 'url' && !url.trim()) newErrors.url = 'La URL es requerida';
        if (uploadMode === 'file' && !selectedFile) newErrors.file = 'Seleccioná un archivo';

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        setSaving(true);
        setUploadProgress(10);
        try {
            let finalUrl = url.trim() || null;

            if (uploadMode === 'file' && selectedFile) {
                setUploadProgress(30);
                finalUrl = await uploadFileToStorage(selectedFile);
                setUploadProgress(80);
                if (!finalUrl) {
                    setErrors({ file: 'Error al subir archivo. Verificá que el bucket "materials" exista en Supabase Storage.' });
                    setSaving(false);
                    return;
                }
            }

            setUploadProgress(90);
            const { data, error } = await supabase
                .from('materials')
                .insert([{
                    title: title.trim(),
                    clinical_area: clinicalArea,
                    resource_type: resourceType,
                    media_type: mediaType,
                    target_profile: 'adulto',
                    status: 'active',
                    url: finalUrl,
                    description: selectedFile ? `${selectedFile.name} (${(selectedFile.size / 1024).toFixed(1)} KB)` : '',
                    verified,
                    tags: [resourceType, clinicalArea].filter(Boolean),
                }])
                .select('*')
                .single();

            if (error) {
                console.error('Error saving material:', error);
                setErrors({ submit: 'Error guardando en base de datos: ' + error.message });
                return;
            }

            setUploadProgress(100);
            if (data) onUpload(data);
            resetForm();
            onClose();
        } catch (e: any) {
            console.error('Error saving material:', e);
            setErrors({ submit: 'Error inesperado: ' + e.message });
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95">
                <div className="p-4 border-b flex justify-between items-center bg-slate-50 dark:bg-slate-850">
                    <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Upload size={18} /> Subir Nuevo Material
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Title */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-400 uppercase">Título</label>
                        <input type="text" value={title} onChange={e => setTitle(e.target.value)}
                            className={`w-full p-2.5 border rounded-xl bg-white dark:bg-slate-800 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 ${errors.title ? 'border-red-500' : 'dark:border-slate-700'}`}
                            placeholder="Ej: Guía de ejercicios vocales" />
                        {errors.title && <p className="text-[10px] text-red-500 font-bold">{errors.title}</p>}
                    </div>

                    {/* Area + Type */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-400 uppercase">Área Clínica</label>
                            <select value={clinicalArea} onChange={e => setClinicalArea(e.target.value)}
                                className="w-full p-2.5 border dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-sm outline-none">
                                <option value="Lenguaje">Lenguaje</option>
                                <option value="Habla">Habla</option>
                                <option value="Voz">Voz</option>
                                <option value="Deglución">Deglución</option>
                                <option value="Audiología">Audiología</option>
                                <option value="Otro">Otro</option>
                            </select>
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-400 uppercase">Tipo</label>
                            <select value={resourceType} onChange={e => setResourceType(e.target.value)}
                                className="w-full p-2.5 border dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-sm outline-none">
                                <option value="guía">Guía</option>
                                <option value="juego">Juego</option>
                                <option value="ejercicio">Ejercicio</option>
                                <option value="otro">Otro</option>
                            </select>
                        </div>
                    </div>

                    {/* Media type */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-400 uppercase">Formato</label>
                        <div className="flex gap-2">
                            {([['image', 'Imagen', ImageIcon], ['video', 'Video', Video], ['pdf', 'PDF', FileText], ['audio', 'Audio', Headphones]] as const).map(([val, label, Icon]) => (
                                <button key={val} type="button" onClick={() => setMediaType(val)}
                                    className={`flex-1 flex items-center justify-center gap-1.5 p-2.5 rounded-xl border text-xs font-bold transition-all ${mediaType === val ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400' : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                                    <Icon size={14} /> {label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Upload mode toggle */}
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-400 uppercase">Origen del material</label>
                        <div className="flex gap-2">
                            <button type="button" onClick={() => setUploadMode('file')}
                                className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border text-sm font-bold transition-all ${uploadMode === 'file' ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-600' : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50'}`}>
                                <Upload size={16} /> Subir Archivo
                            </button>
                            <button type="button" onClick={() => setUploadMode('url')}
                                className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border text-sm font-bold transition-all ${uploadMode === 'url' ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700 text-blue-600' : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50'}`}>
                                <Link size={16} /> URL Externa
                            </button>
                        </div>
                    </div>

                    {/* File upload */}
                    {uploadMode === 'file' && (
                        <div className="space-y-1.5">
                            <input ref={fileInputRef} type="file" onChange={handleFileSelect}
                                accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx" className="hidden" />
                            <button type="button" onClick={() => fileInputRef.current?.click()}
                                className={`w-full p-4 border-2 border-dashed rounded-xl text-center transition-all ${selectedFile ? 'border-green-300 bg-green-50 dark:bg-green-900/20' : 'border-slate-300 dark:border-slate-600 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/10'}`}>
                                {selectedFile ? (
                                    <div className="space-y-1">
                                        <p className="text-sm font-bold text-green-700 dark:text-green-400">{selectedFile.name}</p>
                                        <p className="text-[10px] text-slate-400">{(selectedFile.size / 1024).toFixed(1)} KB — {detectMediaType(selectedFile).toUpperCase()}</p>
                                    </div>
                                ) : (
                                    <div className="space-y-1">
                                        <Upload size={24} className="mx-auto text-slate-400" />
                                        <p className="text-xs text-slate-500">Click para seleccionar archivo</p>
                                        <p className="text-[10px] text-slate-400">Imágenes, videos, audio, PDF, DOC</p>
                                    </div>
                                )}
                            </button>
                            {errors.file && <p className="text-[10px] text-red-500 font-bold">{errors.file}</p>}
                            {saving && uploadProgress > 0 && uploadProgress < 100 && (
                                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5">
                                    <div className="bg-blue-600 h-1.5 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
                                </div>
                            )}
                        </div>
                    )}

                    {/* URL input */}
                    {uploadMode === 'url' && (
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-400 uppercase">URL del Recurso</label>
                            <input type="url" value={url} onChange={e => setUrl(e.target.value)}
                                className={`w-full p-2.5 border rounded-xl bg-white dark:bg-slate-800 text-sm outline-none focus:ring-2 focus:ring-blue-500/20 ${errors.url ? 'border-red-500' : 'dark:border-slate-700'}`}
                                placeholder="https://ejemplo.com/material.pdf" />
                            {errors.url && <p className="text-[10px] text-red-500 font-bold">{errors.url}</p>}
                        </div>
                    )}

                    {/* Verified */}
                    <div className="flex items-center gap-2">
                        <input type="checkbox" checked={verified} onChange={e => setVerified(e.target.checked)} className="w-4 h-4 text-blue-600 rounded" />
                        <span className="text-xs text-slate-600 dark:text-slate-400">Material verificado y confiable</span>
                    </div>

                    {errors.submit && <p className="text-[10px] text-red-500 font-bold text-center">{errors.submit}</p>}

                    <button type="submit" disabled={saving}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all shadow-md text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                        {saving ? <><Loader2 size={14} className="animate-spin" /> Guardando...</> : 'Guardar Material'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default UploadMaterialModal;

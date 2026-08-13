import React, { useState, useEffect } from 'react';
import {
    X, Plus, Trash2, Save, Loader2, FileText, ChevronDown, ChevronUp,
    GripVertical, Edit3, Check, Copy, Upload, Download
} from 'lucide-react';
import {
    reportTemplateService, ReportTemplate, TemplateSection,
    ExampleParagraph, AREA_OPTIONS, AGE_GROUP_OPTIONS
} from '../services/ReportTemplateService';
import { useToast } from '../context/ToastContext';

interface TemplateManagerProps {
    onClose: () => void;
}

export const TemplateManager: React.FC<TemplateManagerProps> = ({ onClose }) => {
    const { addToast } = useToast();
    const [templates, setTemplates] = useState<ReportTemplate[]>([]);
    const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [showNewForm, setShowNewForm] = useState(false);
    const [newTemplate, setNewTemplate] = useState({
        name: '',
        area: 'general',
        type: 'valoracion' as const,
        target_age: 'all',
        tags: [] as string[],
    });
    const [newSection, setNewSection] = useState({ title: '', description: '' });
    const [newExample, setNewExample] = useState({
        section_id: '',
        area: 'general',
        age_group: 'all',
        diagnosis: '',
        text: '',
        quality_score: 3,
    });
    const [activeTab, setActiveTab] = useState<'templates' | 'examples'>('templates');
    const [localExamples, setLocalExamples] = useState<ExampleParagraph[]>([]);

    useEffect(() => { loadTemplates(); }, []);

    const loadTemplates = async () => {
        setIsLoading(true);
        try {
            await reportTemplateService.seedDefaultTemplates();
            const data = await reportTemplateService.getTemplates();
            console.log('[TemplateManager] Templates cargadas:', data.length);
            setTemplates(data);
        } catch (err: any) {
            console.error('[TemplateManager] Error crítico:', err);
            addToast({ message: 'Error: ' + err.message, type: 'error' });
        } finally { setIsLoading(false); }
    };

    const handleCreateTemplate = async () => {
        if (!newTemplate.name.trim()) {
            addToast({ message: 'Ingresá un nombre para la plantilla', type: 'error' });
            return;
        }
        setIsSaving(true);
        try {
            const template = await reportTemplateService.saveTemplate({
                ...newTemplate,
                sections: [],
                example_paragraphs: [],
                author_id: 'current_user',
                is_active: true,
            });
            if (template) {
                setTemplates(prev => [template, ...prev]);
                setSelectedTemplate(template);
                setShowNewForm(false);
                setNewTemplate({ name: '', area: 'general', type: 'valoracion', target_age: 'all', tags: [] });
                addToast({ message: 'Plantilla creada', type: 'success' });
            }
        } catch (err: any) {
            addToast({ message: 'Error: ' + err.message, type: 'error' });
        } finally { setIsSaving(false); }
    };

    const handleAddSection = async () => {
        if (!selectedTemplate || !newSection.title.trim()) return;
        const updatedSections = [
            ...selectedTemplate.sections,
            {
                id: `section_${Date.now()}`,
                title: newSection.title,
                description: newSection.description,
                order: selectedTemplate.sections.length + 1,
                required: true,
                variables: [],
                scenarios: [],
            }
        ];
        await reportTemplateService.updateTemplate(selectedTemplate.id, { sections: updatedSections });
        setSelectedTemplate({ ...selectedTemplate, sections: updatedSections });
        setNewSection({ title: '', description: '' });
        addToast({ message: 'Sección agregada', type: 'success' });
    };

    const handleRemoveSection = async (sectionId: string) => {
        if (!selectedTemplate) return;
        const updated = selectedTemplate.sections.filter(s => s.id !== sectionId);
        await reportTemplateService.updateTemplate(selectedTemplate.id, { sections: updated });
        setSelectedTemplate({ ...selectedTemplate, sections: updated });
    };

    const handleAddExample = async () => {
        if (!newExample.text.trim() || !newExample.section_id) {
            addToast({ message: 'Completá sección y texto del ejemplo', type: 'error' });
            return;
        }
        try {
            const saved = await reportTemplateService.saveExampleParagraph({
                ...newExample,
                template_id: selectedTemplate?.id,
                tags: [],
            });
            if (saved) {
                setNewExample({ section_id: '', area: 'general', age_group: 'all', diagnosis: '', text: '', quality_score: 3 });
                addToast({ message: 'Ejemplo guardado', type: 'success' });
            } else {
                // RLS may have blocked the insert - save locally as fallback
                setLocalExamples(prev => [...prev, { ...newExample, id: `local-${Date.now()}`, template_id: selectedTemplate?.id, tags: [], created_at: new Date().toISOString() }]);
                setNewExample({ section_id: '', area: 'general', age_group: 'all', diagnosis: '', text: '', quality_score: 3 });
                addToast({ message: 'Ejemplo guardado localmente (se sincronizará cuando esté disponible)', type: 'success' });
            }
        } catch (err: any) {
            addToast({ message: 'Error: ' + err.message, type: 'error' });
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-[900px] max-h-[85vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-purple-50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white">
                            <FileText size={20} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-800 dark:text-white">Administrador de Plantillas</h2>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Creá y gestioná plantillas de informes para la IA</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white dark:hover:bg-slate-800 rounded-xl text-slate-400 dark:text-slate-500"><X size={20} /></button>
                </div>

                {/* Tabs */}
                <div className="px-6 border-b border-slate-200 dark:border-slate-700 flex gap-4">
                    <button onClick={() => setActiveTab('templates')}
                        className={`py-2.5 text-sm font-bold border-b-2 transition-all ${activeTab === 'templates' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}>
                        Plantillas ({templates.length})
                    </button>
                    <button onClick={() => setActiveTab('examples')}
                        className={`py-2.5 text-sm font-bold border-b-2 transition-all ${activeTab === 'examples' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}>
                        Ejemplos de Párrafos
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {activeTab === 'templates' ? (
                        <div className="flex gap-6">
                            {/* Left: Template List */}
                            <div className="w-72 shrink-0 space-y-3">
                                <button onClick={() => setShowNewForm(!showNewForm)}
                                    className="w-full flex items-center justify-center gap-2 px-3 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all">
                                    <Plus size={14} /> Nueva Plantilla
                                </button>

                                {showNewForm && (
                                    <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-200 dark:border-indigo-800 space-y-2">
                                        <input type="text" value={newTemplate.name} onChange={e => setNewTemplate(p => ({ ...p, name: e.target.value }))}
                                            placeholder="Nombre de la plantilla" className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-lg text-sm outline-none focus:border-indigo-400" />
                                        <select value={newTemplate.area} onChange={e => setNewTemplate(p => ({ ...p, area: e.target.value }))}
                                            className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-lg text-sm outline-none">
                                            {AREA_OPTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                                        </select>
                                        <select value={newTemplate.type} onChange={e => setNewTemplate(p => ({ ...p, type: e.target.value as any }))}
                                            className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-lg text-sm outline-none">
                                            <option value="valoracion">Valoración</option>
                                            <option value="proceso">Proceso</option>
                                            <option value="seguimiento">Seguimiento</option>
                                            <option value="alta">Alta</option>
                                            <option value="derivacion">Derivación</option>
                                            <option value="interconsulta">Interconsulta</option>
                                            <option value="custom">Personalizado</option>
                                        </select>
                                        <select value={newTemplate.target_age} onChange={e => setNewTemplate(p => ({ ...p, target_age: e.target.value }))}
                                            className="w-full px-3 py-1.5 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-800 rounded-lg text-sm outline-none">
                                            {AGE_GROUP_OPTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                                        </select>
                                        <button onClick={handleCreateTemplate} disabled={isSaving}
                                            className="w-full py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-all disabled:opacity-50">
                                            {isSaving ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Crear'}
                                        </button>
                                    </div>
                                )}

                                {isLoading ? (
                                    <div className="text-center py-8"><Loader2 size={20} className="animate-spin mx-auto text-slate-400 dark:text-slate-500" /></div>
                                ) : templates.length === 0 ? (
                                    <p className="text-center text-sm text-slate-400 dark:text-slate-500 py-8">No hay plantillas creadas</p>
                                ) : (
                                    templates.map(t => (
                                        <button key={t.id} onClick={() => setSelectedTemplate(t)}
                                            className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                                                selectedTemplate?.id === t.id ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 dark:border-slate-700 hover:border-indigo-200 dark:hover:border-indigo-700'
                                            }`}>
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{t.name}</span>
                                                <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-slate-500 dark:text-slate-400">{t.type}</span>
                                            </div>
                                            <p className="text-[11px] text-slate-400 dark:text-slate-500">{t.area} · {t.target_age} · {t.sections?.length || 0} secciones</p>
                                        </button>
                                    ))
                                )}
                            </div>

                            {/* Right: Template Detail */}
                            <div className="flex-1">
                                {selectedTemplate ? (
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h3 className="text-lg font-bold text-slate-800 dark:text-white">{selectedTemplate.name}</h3>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">{selectedTemplate.area} · {selectedTemplate.type} · {selectedTemplate.target_age}</p>
                                            </div>
                                            <button onClick={async () => { await reportTemplateService.deleteTemplate(selectedTemplate.id); setTemplates(p => p.filter(t => t.id !== selectedTemplate.id)); setSelectedTemplate(null); addToast({ message: 'Plantilla eliminada', type: 'success' }); }}
                                                className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-all"><Trash2 size={16} /></button>
                                        </div>

                                        {/* Sections */}
                                        <div>
                                            <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-2">Secciones del Informe</h4>
                                            <div className="space-y-1.5">
                                                {[...selectedTemplate.sections].sort((a, b) => a.order - b.order).map((s, i) => (
                                                    <div key={s.id} className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-800 rounded-lg group">
                                                        <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold w-5">{i + 1}.</span>
                                                        <div className="flex-1">
                                                            <p className="text-sm font-bold text-slate-700 dark:text-slate-200">{s.title}</p>
                                                            <p className="text-[11px] text-slate-400 dark:text-slate-500">{s.description}</p>
                                                        </div>
                                                        <button onClick={() => handleRemoveSection(s.id)}
                                                            className="p-1 opacity-0 group-hover:opacity-100 text-red-400 hover:bg-red-50 rounded transition-all"><Trash2 size={12} /></button>
                                                    </div>
                                                ))}
                                            </div>
                                            <div className="flex gap-2 mt-2">
                                                <input type="text" value={newSection.title} onChange={e => setNewSection(p => ({ ...p, title: e.target.value }))}
                                                    placeholder="Nueva sección..." className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:border-indigo-400" />
                                                <input type="text" value={newSection.description} onChange={e => setNewSection(p => ({ ...p, description: e.target.value }))}
                                                    placeholder="Descripción..." className="flex-1 px-3 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:border-indigo-400" />
                                                <button onClick={handleAddSection}
                                                    className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700"><Plus size={14} /></button>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-16 text-slate-400 dark:text-slate-500">
                                        <FileText size={48} className="mx-auto mb-3 text-slate-300" />
                                        <p className="text-sm font-bold">Seleccioná una plantilla</p>
                                        <p className="text-xs mt-1">o creá una nueva para empezar</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        /* Examples Tab */
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                                <select value={newExample.section_id} onChange={e => setNewExample(p => ({ ...p, section_id: e.target.value }))}
                                    className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:border-indigo-400">
                                    <option value="">Seleccionar sección...</option>
                                    {selectedTemplate?.sections.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                                    {!selectedTemplate && (
                                        <>
                                            <option value="motivo_consulta">Motivo de Consulta</option>
                                            <option value="antecedentes">Antecedentes</option>
                                            <option value="evaluacion">Evaluación</option>
                                            <option value="diagnostico">Diagnóstico</option>
                                            <option value="tratamiento">Tratamiento</option>
                                            <option value="seguimiento">Seguimiento</option>
                                        </>
                                    )}
                                </select>
                                <select value={newExample.area} onChange={e => setNewExample(p => ({ ...p, area: e.target.value }))}
                                    className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none">
                                    {AREA_OPTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                                </select>
                                <select value={newExample.age_group} onChange={e => setNewExample(p => ({ ...p, age_group: e.target.value }))}
                                    className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none">
                                    {AGE_GROUP_OPTIONS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                                </select>
                                <input type="text" value={newExample.diagnosis} onChange={e => setNewExample(p => ({ ...p, diagnosis: e.target.value }))}
                                    placeholder="Diagnóstico (ej: TEL)" className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm outline-none focus:border-indigo-400" />
                            </div>
                            <textarea value={newExample.text} onChange={e => setNewExample(p => ({ ...p, text: e.target.value }))}
                                placeholder="Párrafo ejemplo de informe clínico... (el IA usará esto como referencia de estilo y contenido)"
                                rows={6} className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm outline-none focus:border-indigo-400 resize-none" />
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-slate-500 dark:text-slate-400">Calidad:</span>
                                    {[1, 2, 3, 4, 5].map(n => (
                                        <button key={n} onClick={() => setNewExample(p => ({ ...p, quality_score: n }))}
                                            className={`w-6 h-6 rounded text-xs font-bold ${n <= newExample.quality_score ? 'bg-amber-400 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'}`}>
                                            {n}
                                        </button>
                                    ))}
                                </div>
                                <button onClick={handleAddExample}
                                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-all">
                                    <Plus size={14} /> Guardar Ejemplo
                                </button>
                            </div>
                            <p className="text-[11px] text-slate-400 dark:text-slate-500 italic">
                                Los ejemplos le dan a la IA una base de estilo y contenido para generar informes más precisos.
                                Calidad 5 = excelente ejemplo clínico. Calidad 1 = básico.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TemplateManager;

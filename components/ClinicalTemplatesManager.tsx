import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Save, FileText, Settings2, Loader2, ChevronRight, ChevronDown, X } from 'lucide-react';
import { ClinicalHistoryService, ClinicalHistoryTemplate, ClinicalHistorySection, ClinicalHistoryField } from '../services/ClinicalHistoryService';
import { ConsultorioConfigService } from '../services/ConsultorioConfigService';
import { useToast } from '../context/ToastContext';

export default function ClinicalTemplatesManager() {
  const [consultorios, setConsultorios] = useState<any[]>([]);
  const [selectedClinicId, setSelectedClinicId] = useState<string>('');
  const [templates, setTemplates] = useState<ClinicalHistoryTemplate[]>([]);
  const [editingTemplate, setEditingTemplate] = useState<ClinicalHistoryTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();

  useEffect(() => {
    loadConsultorios();
  }, []);

  useEffect(() => {
    if (selectedClinicId) {
      loadTemplates();
    }
  }, [selectedClinicId]);

  async function loadConsultorios() {
    try {
      const data = ConsultorioConfigService.getAll();
      setConsultorios(data);
      if (data.length > 0) setSelectedClinicId(data[0].id);
    } catch (e) {
      console.error('[TemplatesManager] Error loading consultorios:', e);
    } finally {
      setLoading(false);
    }
  }

  async function loadTemplates() {
    try {
      const data = await ClinicalHistoryService.getTemplates(selectedClinicId);
      setTemplates(data);
    } catch (e) {
      console.error('[TemplatesManager] Error loading templates:', e);
    }
  }

  async function handleSaveTemplate(template: Partial<ClinicalHistoryTemplate>) {
    try {
      if (template.id) {
        await ClinicalHistoryService.updateTemplate(template.id, template);
      } else {
        await ClinicalHistoryService.createTemplate({
          ...template,
          clinic_id: selectedClinicId,
          version: 1,
        } as ClinicalHistoryTemplate);
      }
      addToast('Plantilla guardada correctamente', 'success');
      setEditingTemplate(null);
      await loadTemplates();
    } catch (e: any) {
      addToast(e.message || 'Error al guardar la plantilla', 'error');
    }
  }

  async function handleDeleteTemplate(id: string) {
    if (!confirm('¿Eliminar esta plantilla? Los registros existentes conservarán su versión pero ya no podrán crear nuevos con ella.')) return;
    try {
      await ClinicalHistoryService.deleteTemplate(id);
      addToast('Plantilla eliminada', 'success');
      await loadTemplates();
    } catch (e: any) {
      addToast(e.message || 'Error al eliminar la plantilla', 'error');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600">
            <Settings2 size={20} />
          </div>
          <div>
            <h3 className="font-bold text-slate-800">Configuración de Plantillas Clínicas</h3>
            <p className="text-xs text-slate-500">Define la estructura obligatoria de la historia clínica por consultorio</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold text-slate-500 uppercase">Consultorio:</label>
          <select 
            value={selectedClinicId} 
            onChange={e => setSelectedClinicId(e.target.value)}
            className="p-2 border rounded-lg text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            {consultorios.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-3">
          <div className="flex justify-between items-center px-1">
            <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Plantillas Activas</h4>
            <button 
              onClick={() => setEditingTemplate({
                name: '',
                description: '',
                schema_json: [],
                version: 1,
                is_active: true,
                clinic_id: selectedClinicId,
              } as any)}
              className="p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              title="Nueva Plantilla"
            >
              <Plus size={16} />
            </button>
          </div>
          {templates.length === 0 ? (
            <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-8 text-center">
              <FileText className="mx-auto text-slate-300 mb-2" size={32} />
              <p className="text-sm text-slate-400">No hay plantillas definidas para este consultorio</p>
            </div>
          ) : (
            templates.map(t => (
              <div 
                key={t.id} 
                onClick={() => setEditingTemplate(t)}
                className={`p-4 rounded-xl border transition-all cursor-pointer group ${
                  editingTemplate?.id === t.id 
                    ? 'bg-indigo-50 border-indigo-300 shadow-sm' 
                    : 'bg-white border-slate-200 hover:border-indigo-200 hover:bg-indigo-50/30'
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="font-bold text-slate-800 text-sm truncate">{t.name}</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">v{t.version}</span>
                </div>
                <p className="text-xs text-slate-500 line-clamp-2 mb-3">{t.description || 'Sin descripción'}</p>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-medium text-slate-400">
                    {t.schema_json.length} secciones
                  </span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(t.id); }}
                      className="p-1 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="lg:col-span-2">
          {editingTemplate ? (
            <TemplateEditor 
              template={editingTemplate} 
              onSave={handleSaveTemplate} 
              onCancel={() => setEditingTemplate(null)} 
            />
          ) : (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl h-full flex flex-col items-center justify-center p-12 text-center">
              <div className="bg-white p-4 rounded-full shadow-sm mb-4 text-slate-300">
                <Settings2 size={48} />
              </div>
              <h3 className="text-lg font-bold text-slate-700 mb-2">Configurador de Estructura Clínica</h3>
              <p className="text-sm text-slate-500 max-w-md">
                Selecciona una plantilla de la izquierda o crea una nueva para definir los campos obligatorios de la historia clínica.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TemplateEditor({ template, onSave, onCancel }: { 
  template: ClinicalHistoryTemplate; 
  onSave: (t: Partial<ClinicalHistoryTemplate>) => void; 
  onCancel: () => void; 
}) {
  const [name, setName] = useState(template.name);
  const [description, setDescription] = useState(template.description || '');
  const [sections, setSections] = useState<ClinicalHistorySection[]>(template.schema_json || []);

  const addSection = () => {
    setSections([...sections, { 
      section_id: `sec_${Date.now()}`, 
      title: 'Nueva Sección', 
      fields: [] 
    }]);
  };

  const removeSection = (id: string) => {
    setSections(sections.filter(s => s.section_id !== id));
  };

  const addField = (sectionId: string) => {
    setSections(sections.map(s => {
      if (s.section_id === sectionId) {
        return {
          ...s,
          fields: [...s.fields, { 
            id: `fld_${Date.now()}`, 
            label: 'Nuevo Campo', 
            type: 'text', 
            required: false 
          }]
        };
      }
      return s;
    }));
  };

  const removeField = (sectionId: string, fieldId: string) => {
    setSections(sections.map(s => {
      if (s.section_id === sectionId) {
        return { ...s, fields: s.fields.filter(f => f.id !== fieldId) };
      }
      return s;
    }));
  };

  const updateField = (sectionId: string, fieldId: string, updates: Partial<ClinicalHistoryField>) => {
    setSections(sections.map(s => {
      if (s.section_id === sectionId) {
        return {
          ...s,
          fields: s.fields.map(f => f.id === fieldId ? { ...f, ...updates } : f)
        };
      }
      return s;
    }));
  };

  const updateSectionTitle = (sectionId: string, title: string) => {
    setSections(sections.map(s => s.section_id === sectionId ? { ...s, title } : s));
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl flex flex-col h-full max-h-[80vh]">
      <div className="p-6 border-b border-slate-100 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <FileText className="text-indigo-600" size={20} />
          <h3 className="font-bold text-slate-800">Editor de Plantilla</h3>
        </div>
        <div className="flex gap-2">
          <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50 rounded-lg transition-all">
            Cancelar
          </button>
          <button 
            onClick={() => onSave({ name, description, schema_json: sections })} 
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-all shadow-sm flex items-center gap-2"
          >
            <Save size={16} /> Guardar Plantilla
          </button>
        </div>
      </div>

      <div className="p-6 overflow-y-auto space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Nombre de la Plantilla</label>
            <input 
              value={name} 
              onChange={e => setName(e.target.value)} 
              className="w-full p-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500/20" 
              placeholder="Ej: Anamnesis Infantil"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-500 uppercase">Descripción</label>
            <input 
              value={description} 
              onChange={e => setDescription(e.target.value)} 
              className="w-full p-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500/20" 
              placeholder="Ej: Para pacientes de 0 a 6 años..."
            />
          </div>
        </div>

        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h4 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Estructura de la Historia Clínica</h4>
            <button 
              onClick={addSection} 
              className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 transition-colors"
            >
              <Plus size={14} /> Añadir Sección
            </button>
          </div>

          {sections.map((section, sIdx) => (
            <div key={section.section_id} className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-xs font-black text-slate-400 w-6">{sIdx + 1}.</span>
                  <input 
                    value={section.title} 
                    onChange={e => updateSectionTitle(section.section_id, e.target.value)} 
                    className="bg-transparent font-bold text-slate-800 text-sm border-b border-transparent hover:border-slate-300 focus:border-indigo-500 outline-none transition-all"
                  />
                </div>
                <button onClick={() => removeSection(section.section_id)} className="text-slate-400 hover:text-rose-500 transition-colors">
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 pl-6">
                {section.fields.map((field, fIdx) => (
                  <div key={field.id} className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex items-center gap-3 group">
                    <div className="flex-1 grid grid-cols-3 gap-3 items-center">
                      <input 
                        value={field.label} 
                        onChange={e => updateField(section.section_id, field.id, { label: e.target.value })} 
                        className="text-xs font-medium text-slate-700 border-b border-transparent hover:border-slate-200 focus:border-indigo-500 outline-none"
                        placeholder="Etiqueta del campo"
                      />
                      <select 
                        value={field.type} 
                        onChange={e => updateField(section.section_id, field.id, { type: e.target.value as any })} 
                        className="text-[10px] font-bold text-slate-500 bg-slate-50 border rounded p-1 outline-none"
                      >
                        <option value="text">Texto corto</option>
                        <option value="textarea">Área de texto</option>
                        <option value="select">Selección</option>
                        <option value="checkbox">Check</option>
                        <option value="date">Fecha</option>
                      </select>
                      <div className="flex items-center gap-2 justify-end">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={field.required} 
                            onChange={e => updateField(section.section_id, field.id, { required: e.target.checked })} 
                            className="rounded text-indigo-600"
                          />
                          <span className="text-[10px] font-bold text-slate-400 uppercase">Obligatorio</span>
                        </label>
                      </div>
                    </div>
                    <button 
                      onClick={() => removeField(section.section_id, field.id)} 
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-rose-500 transition-all"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
                <button 
                  onClick={() => addField(section.section_id)} 
                  className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-indigo-600 transition-colors pl-2"
                >
                  <Plus size={14} /> Añadir campo a la sección
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

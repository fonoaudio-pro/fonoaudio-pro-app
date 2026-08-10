import React, { useState, useEffect, useRef } from 'react';
import { Loader2, Wand2, Image, Layout, Sparkles, AlertTriangle, CheckCircle2, Upload, Camera, Layers, GripVertical, Trash2, Plus, ArrowRight, FileText, Send, Eye, X, Palette, Download, Grid, BookOpen, Square, ArrowUpRight, Save, Edit3, Share2, Brain } from 'lucide-react';
import { MultimediaMaterialService, MultimediaTemplate, MaterialAsset, TemplateCategory } from '../services/MultimediaMaterialService';
import { comfyuiService } from '../services/ComfyUIService';
import { pictogramService } from '../services/PictogramService';
import { arasaacService, ArasaacPictogram } from '../services/ArasaacService';
import { supabase } from '../utils/supabaseClient';
import MaterialEditor from './MaterialEditor';
import ShareMenu from './ShareMenu';
import VisualEditor from './VisualEditor';
import { ShareMaterialInput } from '../utils/shareMaterial';
import { fluxService } from '../services/FluxService';
import { CLINICAL_TEMPLATES, TEMPLATE_CATEGORIES, buildPrompt, ClinicalTemplate, getTemplatesByCategory } from '../services/ClinicalTemplates';
import { generateText } from '../utils/geminiHelpers';
import { ErrorBoundary } from './ErrorBoundary';

interface MultimediaCreatorProps {
  userId: string;
  consultorioId?: string;
  patientId?: string;
  onMaterialCreated?: (materialId: string) => void;
  editMaterialId?: string | null;
}

const ASSET_TYPES = [
  { value: 'activity_image', label: 'Actividad Terapéutica', icon: '🎯', desc: 'Imagen generada por IA para actividades' },
  { value: 'infographic', label: 'Infografía', icon: '📊', desc: 'Infografía educativa profesional' },
  { value: 'social_post', label: 'Post Redes', icon: '📱', desc: 'Publicación para Instagram/Facebook' },
  { value: 'flashcard', label: 'Tarjeta Ejercicio', icon: '🃏', desc: 'Flashcard con ejercicio' },
  { value: 'exercise_card', label: 'Tarjeta Actividad', icon: '✏️', desc: 'Tarjeta con instrucciones paso a paso' },
  { value: 'worksheet', label: 'Hoja de Trabajo', icon: '📄', desc: 'Material imprimible' },
  { value: 'pictogram', label: 'Pictograma', icon: '🟣', desc: 'Pictograma simple desde foto o texto' },
  { value: 'pictogram_sequence', label: 'Secuencia Pictogramas', icon: '📋', desc: 'Guía visual paso a paso para familia' },
];

const CLINICAL_AREAS = ['Voz', 'Habla', 'Lenguaje', 'Deglución', 'Audiología', 'Motricidad oral', 'Comunicación', 'Otro'];

const IMAGE_WORKFLOWS = [
  { id: 'pictogram', name: 'Pictograma', desc: 'Simple, colores planos, ideal para niños', icon: '🟣' },
  { id: 'cartoon', name: 'Cartoon', desc: 'Estilo cartoon infantil', icon: '🎨' },
  { id: 'realistic', name: 'Realista', desc: 'Fotorrealista, para adolescentes/adultos', icon: '📷' },
  { id: 'therapy_scene', name: 'Escena Terapéutica', desc: 'Sesiones de terapia', icon: '🏥' },
  { id: 'emotion', name: 'Emociones', desc: 'Expresiones faciales', icon: '😊' },
  { id: 'social_media', name: 'Redes Sociales', desc: 'Posts para Instagram/Facebook', icon: '📱' },
  { id: 'flashcard', name: 'Flashcard', desc: 'Tarjetas educativas', icon: '🃏' },
  { id: 'sequence_step', name: 'Paso de Secuencia', desc: 'Instrucciones paso a paso', icon: '📋' },
  { id: 'family_guide', name: 'Guía Familia', desc: 'Material para padres', icon: '👨‍👩‍👧' },
];

const SEQUENCE_DEFAULTS: Record<string, string[]> = {
  'Lenguaje': ['Saludo', 'Instrucción', 'Actividad', 'Refuerzo', 'Cierre'],
  'Habla': ['Modelo', 'Repetición', 'Práctica', 'Generalización', 'Éxito'],
  'Deglución': ['Preparación', 'Posición', 'Tragar', 'Verificar', 'Descanso'],
  'Voz': ['Respiración', 'Calentamiento', 'Ejercicio', 'Reposo', 'Control'],
  'default': ['Paso 1', 'Paso 2', 'Paso 3', 'Paso 4', 'Paso 5'],
};

export default function MultimediaCreator({ userId, consultorioId, patientId, onMaterialCreated, editMaterialId }: MultimediaCreatorProps) {
  const [templates, setTemplates] = useState<MultimediaTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<MultimediaTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generatedAsset, setGeneratedAsset] = useState<MaterialAsset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'ai' | 'upload' | 'sequence' | 'deterministic' | 'flux' | 'canva' | 'ai_prompt'>('canva');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assetType, setAssetType] = useState<string>('activity_image');
  const [clinicalArea, setClinicalArea] = useState('');
  const [parameters, setParameters] = useState<Record<string, string>>({});
  const [templateCategory, setTemplateCategory] = useState<TemplateCategory | ''>('');

  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedPreview, setUploadedPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [sequenceItems, setSequenceItems] = useState<string[]>(['']);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // AI Prompt state
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const [imageWorkflow, setImageWorkflow] = useState('pictogram');
  const [imagePrompt, setImagePrompt] = useState('');
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [comfyuiAvailable, setComfyuiAvailable] = useState<boolean | null>(null);
  const [overlayText, setOverlayText] = useState('');
  const [textPosition, setTextPosition] = useState<'top' | 'center' | 'bottom'>('bottom');
  const [textColor, setTextColor] = useState('white');
  const [generatedImageIds, setGeneratedImageIds] = useState<string[]>([]);

  // Motor Determinístico - Pictogramas
  const [detMode, setDetMode] = useState<'pictogram' | 'pecs' | 'sequence' | 'card'>('pictogram');
  const [categories, setCategories] = useState<Record<string, { label: string; count: number; pictograms: string[] }>>({});
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [pictogramList, setPictogramList] = useState<{ id: string; label: string; category: string }[]>([]);
  const [selectedPictograms, setSelectedPictograms] = useState<string[]>([]);
  const [detPreview, setDetPreview] = useState<string | null>(null);
  const [detGenerating, setDetGenerating] = useState(false);
  const [pecsBorderColor, setPecsBorderColor] = useState('#2196F3');
  const [sequenceLabels, setSequenceLabels] = useState<string[]>([]);

  // ARASAAC - Pictogramas clínicos externos
  const [pictoSource, setPictoSource] = useState<'local' | 'arasaac'>('local');
  const [arasaacQuery, setArasaacQuery] = useState('');
  const [arasaacResults, setArasaacResults] = useState<ArasaacPictogram[]>([]);
  const [arasaacLoading, setArasaacLoading] = useState(false);
  const [arasaacSelected, setArasaacSelected] = useState<ArasaacPictogram[]>([]);

  // Edit mode
  const [isEditMode, setIsEditMode] = useState(false);
  const [editMaterialData, setEditMaterialData] = useState<any>(null);
  
  // Canvas editor state
  const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
  const [editingImageUrl, setEditingImageUrl] = useState<string | null>(null);
  
  // Share state
  const [shareData, setShareData] = useState<ShareMaterialInput | null>(null);

  // FLUX state
  const [fluxCategory, setFluxCategory] = useState<string>('therapy');
  const [fluxTemplate, setFluxTemplate] = useState<ClinicalTemplate | null>(null);
  const [fluxFields, setFluxFields] = useState<string[]>(['']);
  const [fluxPreview, setFluxPreview] = useState<string | null>(null);
  const [fluxGenerating, setFluxGenerating] = useState(false);

  // Clinical sources for RAG context
  const [clinicalSources, setClinicalSources] = useState<{ id: string; title: string; content: string; category: string }[]>([]);
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [sourcesLoading, setSourcesLoading] = useState(false);

  // NotebookLM integration
  const [nbNotebooks, setNbNotebooks] = useState<{ id: string; title: string }[]>([]);
  const [nbArtifacts, setNbArtifacts] = useState<{ id: string; type: string; title: string; status: string }[]>([]);
  const [selectedNbArtifact, setSelectedNbArtifact] = useState<string | null>(null);
  const [nbContext, setNbContext] = useState('');
  const [nbLoading, setNbLoading] = useState(false);

  const mountedRef = useRef(true);
  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    loadTemplates();
    loadCategories();
    loadClinicalSources();
    loadNotebookLMArtifacts();
  }, []);

  useEffect(() => {
    if (editMaterialId) {
      loadMaterialForEdit(editMaterialId);
    }
  }, [editMaterialId]);

  async function loadMaterialForEdit(materialId: string) {
    try {
      setLoading(true);
      const { data: material, error } = await supabase
        .from('materials')
        .select('*')
        .eq('id', materialId)
        .single();

      if (error || !material) {
        console.error('Error loading material for edit:', error);
        setError('No se pudo cargar el material para editar');
        return;
      }

      const { data: assets } = await supabase
        .from('material_assets')
        .select('*')
        .eq('material_id', materialId)
        .order('created_at', { ascending: false })
        .limit(1);

      const asset = assets?.[0];

      setIsEditMode(true);
      setEditMaterialData({ ...material, asset });
      setTitle(material.title || '');
      setDescription(asset?.description || material.description || '');
      setClinicalArea(material.clinical_area || '');
      setAssetType(asset?.asset_type || material.category || 'activity_image');

      if (asset?.file_url) {
        if (asset.file_url.startsWith('data:')) {
          setDetPreview(asset.file_url);
          setActiveTab('deterministic');
        } else {
          setGeneratedImageUrl(asset.file_url);
          setActiveTab('ai');
        }
      }
    } catch (e) {
      console.error('Error loading material:', e);
      setError('Error al cargar el material');
    } finally {
      setLoading(false);
    }
  }

  async function ensureComfyUIAvailable() {
    if (comfyuiAvailable === null) {
      const available = await comfyuiService.healthCheck();
      setComfyuiAvailable(available);
      return available;
    }
    return comfyuiAvailable;
  }

  async function checkComfyUI() {
    const available = await comfyuiService.healthCheck();
    if (mountedRef.current) setComfyuiAvailable(available);
  }

  async function loadTemplates() {
    setLoading(true);
    try {
      const data = await MultimediaMaterialService.getTemplates();
      if (mountedRef.current) setTemplates(data);
    } catch (e) {
      console.error('[MultimediaCreator] Error loading templates:', e);
    }
    if (mountedRef.current) setLoading(false);
  }

  async function handleAIGenerate() {
    if (!aiPrompt.trim()) return;
    setAiGenerating(true);
    setAiError(null);
    setAiResult(null);
    try {
      // Pull NotebookLM context
      let nbContext = '';
      try {
        const nbResp = await fetch(`${import.meta.env.VITE_BACKEND_URL || ''}/api/notebooklm/notebooks`);
        if (nbResp.ok) {
          const nbText = await nbResp.text();
          const nbData = JSON.parse(nbText);
          if (nbData.notebooks?.length > 0) {
            const summaryResp = await fetch(`${import.meta.env.VITE_BACKEND_URL || ''}/api/notebooklm/notebooks/${nbData.notebooks[0].id}/summary`);
            if (summaryResp.ok) {
              const summaryText = await summaryResp.text();
              const summaryData = JSON.parse(summaryText);
              if (summaryData.summary) nbContext = `\n\nCONTEXTO DE INVESTIGACIÓN (NotebookLM):\n${summaryData.summary}`;
            }
          }
        }
      } catch (e) { /* NotebookLM not available */ }

      // Pull clinical sources
      let sourcesContext = '';
      try {
        const { data: sources } = await supabase.from('clinical_sources').select('title, content').limit(3);
        if (sources?.length) {
          sourcesContext = `\n\nFUENTES CLÍNICAS:\n${sources.map((s: any) => `- ${s.title}: ${(s.content || '').substring(0, 200)}`).join('\n')}`;
        }
      } catch (e) { /* sources not available */ }

      const systemPrompt = `Sos un asistente de fonoaudiología clínica. Generá contenido profesional basado en el pedido del usuario.
${nbContext}${sourcesContext}

FORMATO DE RESPUESTA:
- Si piden una lista de palabras: armá una tabla con columns: Palabra, Complejo fonológico, Nivel de dificultad, Observaciones
- Si piden una actividad: describí pasos con objetivos, materiales, instrucciones y adaptaciones
- Si piden una guía para padres: estructural con consejos prácticos, ejemplos y frecuencia recomendada
- Si piden material para redes sociales: generá texto con emojis, hashtags y formato atractivo
- Siempre incluí: objetivo clínico, nivel etario recomendado, y consejos de implementación

ÁREA CLÍNICA: ${clinicalArea || 'General'}
SÉ PRECISO, PROFESIONAL Y PRÁCTICO. Usá formato markdown para que sea legible.`;

      const result = await generateText(`${systemPrompt}\n\nPEDIDO DEL USUARIO:\n${aiPrompt}`);
      if (result) {
        setAiResult(result);
      } else {
        setAiError('No se pudo generar. Verificá que la API key de Google esté configurada.');
      }
    } catch (e: any) {
      setAiError(`Error: ${e.message}`);
    } finally {
      setAiGenerating(false);
    }
  }

  async function loadCategories() {
    try {
      const cats = await pictogramService.getCategories();
      if (!mountedRef.current) return;
      setCategories(cats);
      const firstCat = Object.keys(cats)[0];
      if (firstCat) {
        setSelectedCategory(firstCat);
        const picts = await pictogramService.listPictograms(firstCat);
        if (mountedRef.current) setPictogramList(picts);
      }
    } catch (e) {
      console.warn('[Pictogram] Error loading categories:', e);
    }
  }

  async function loadClinicalSources() {
    setSourcesLoading(true);
    try {
      const { data } = await supabase
        .from('clinical_sources')
        .select('id, title, content, category')
        .order('created_at', { ascending: false })
        .limit(20);
      if (mountedRef.current) setClinicalSources(data || []);
    } catch (e) {
      console.warn('[MultimediaCreator] Error loading clinical sources:', e);
    } finally {
      if (mountedRef.current) setSourcesLoading(false);
    }
  }

  async function loadNotebookLMArtifacts() {
    setNbLoading(true);
    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || '';
      const nbRes = await fetch(`${backendUrl}/api/notebooklm/notebooks?limit=5`);
      if (!nbRes.ok) { setNbNotebooks([]); return; }
      const nbText = await nbRes.text();
      const nbData = JSON.parse(nbText);
      const notebooks = Array.isArray(nbData) ? nbData : nbData.notebooks || [];
      if (!mountedRef.current) return;
      setNbNotebooks(notebooks);

      if (notebooks.length > 0) {
        const artRes = await fetch(`${backendUrl}/api/notebooklm/notebooks/${notebooks[0].id}/artifacts`);
        if (artRes.ok) {
          const artText = await artRes.text();
          const artData = JSON.parse(artText);
          const artifacts = Array.isArray(artData) ? artData : artData.artifacts || [];
          if (mountedRef.current) {
            setNbArtifacts(artifacts.map((a: any) => ({
              id: a.id,
              type: a.type || 'unknown',
              title: a.title || a.type,
              status: a.status || 'completed'
            })));
          }
        }
      }
    } catch (e) {
      console.warn('[MultimediaCreator] NotebookLM not available:', e);
    } finally {
      if (mountedRef.current) setNbLoading(false);
    }
  }

  async function loadNotebookContext() {
    if (nbNotebooks.length === 0) return '';
    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || '';
      const sumRes = await fetch(`${backendUrl}/api/notebooklm/notebooks/${nbNotebooks[0].id}/summary`);
      if (!sumRes.ok) return '';
      const sumText = await sumRes.text();
      const sumData = JSON.parse(sumText);
      return sumData.summary || sumData.answer || '';
    } catch {
      return '';
    }
  }

  function getSelectedSourcesContext(): string {
    if (selectedSourceIds.length === 0) return '';
    const selected = clinicalSources.filter(s => selectedSourceIds.includes(s.id));
    return selected.map(s => `[${s.title}] ${s.content.substring(0, 300)}`).join('\n');
  }

  async function handleSelectCategory(catId: string) {
    setSelectedCategory(catId);
    setSelectedPictograms([]);
    setDetPreview(null);
    try {
      const picts = await pictogramService.listPictograms(catId);
      setPictogramList(picts);
    } catch (e) {
      console.warn('[Pictogram] Error loading pictograms:', e);
    }
  }

  function togglePictogram(id: string) {
    setSelectedPictograms(prev => {
      if (prev.includes(id)) return prev.filter(p => p !== id);
      if (detMode === 'pictogram') return [id];
      if (detMode === 'card') return [id];
      return [...prev, id];
    });
    setDetPreview(null);
  }

  function toggleArasaacPictogram(pict: ArasaacPictogram) {
    setArasaacSelected(prev => {
      const exists = prev.find(p => p.id === pict.id);
      if (exists) return prev.filter(p => p.id !== pict.id);
      if (detMode === 'pictogram' || detMode === 'card') return [pict];
      return [...prev, pict];
    });
    setDetPreview(null);
  }

  async function handleArasaacSearch() {
    if (!arasaacQuery.trim()) return;
    setArasaacLoading(true);
    try {
      const result = await arasaacService.search(arasaacQuery, 'es', 24);
      setArasaacResults(result.pictograms || []);
    } catch (e: any) {
      console.warn('[ARASAAC] Search error:', e);
      setArasaacResults([]);
    }
    setArasaacLoading(false);
  }

  async function handleDetGenerate() {
    const isArasaac = pictoSource === 'arasaac';
    const selectedIds = isArasaac
      ? arasaacSelected.map(p => String(p.id))
      : selectedPictograms;

    if (selectedIds.length === 0) {
      setError('Seleccioná al menos un pictograma');
      return;
    }
    setDetGenerating(true);
    setError(null);
    setDetPreview(null);

    try {
      let result;
      if (isArasaac) {
        // ARASAAC: usar imagen directa del pictograma
        const firstPict = arasaacSelected[0];
        if (detMode === 'pictogram') {
          const imgData = await arasaacService.getImage(firstPict.id, 500);
          if (imgData?.preview_b64) {
            setDetPreview(`data:image/png;base64,${imgData.preview_b64}`);
            setGeneratedImageIds([String(firstPict.id)]);
          } else {
            setError('Error descargando pictograma ARASAAC');
          }
          setDetGenerating(false);
          return;
        } else if (detMode === 'pecs') {
          const pecsImages = await Promise.all(
            arasaacSelected.slice(0, 6).map(async (p) => {
              const img = await arasaacService.getImage(p.id, 300);
              return { b64: img?.preview_b64, label: p.label };
            })
          );
          if (pecsImages[0]?.b64) {
            setDetPreview(`data:image/png;base64,${pecsImages[0].b64}`);
            setGeneratedImageIds(arasaacSelected.slice(0, 6).map(p => String(p.id)));
          } else {
            setError('Error descargando pictogramas ARASAAC para PECS');
          }
          setDetGenerating(false);
          return;
        } else if (detMode === 'sequence') {
          const imgData = await arasaacService.getImage(firstPict.id, 300);
          if (imgData?.preview_b64) {
            setDetPreview(`data:image/png;base64,${imgData.preview_b64}`);
            setGeneratedImageIds(arasaacSelected.map(p => String(p.id)));
          }
          setDetGenerating(false);
          return;
        } else if (detMode === 'card') {
          const imgData = await arasaacService.getImage(firstPict.id, 400);
          if (imgData?.preview_b64) {
            setDetPreview(`data:image/png;base64,${imgData.preview_b64}`);
            setGeneratedImageIds([String(firstPict.id)]);
          }
          setDetGenerating(false);
          return;
        }
      } else {
        // Motor determinístico local (comportamiento existente)
        if (detMode === 'pictogram') {
          result = await pictogramService.generatePictogram(
            selectedPictograms[0],
            title || undefined,
            512,
            '#FFFFFF',
            'bottom',
          );
        } else if (detMode === 'pecs') {
          result = await pictogramService.generatePECS(
            selectedPictograms,
            pecsBorderColor,
            600,
            600,
          );
        } else if (detMode === 'sequence') {
          result = await pictogramService.generateSequence(
            selectedPictograms,
            sequenceLabels.length > 0 ? sequenceLabels : undefined,
            1200,
            400,
          );
        } else if (detMode === 'card') {
          result = await pictogramService.generateCard(
            selectedPictograms[0],
            title || 'TARJETA',
            description || '',
            600,
            400,
            '#2196F3',
          );
        }
      }

      if (result?.status === 'completed' && result.preview_b64) {
        setDetPreview(`data:image/png;base64,${result.preview_b64}`);
        setGeneratedImageIds(result.image_ids || []);
      } else if (!isArasaac) {
        setError(result?.error || 'Error al generar');
      }
    } catch (e: any) {
      setError(e?.message || 'Error al generar material determinístico');
    }
    setDetGenerating(false);
  }

  function handleTemplateSelect(template: MultimediaTemplate) {
    setSelectedTemplate(template);
    const typeMap: Record<string, string> = { social: 'social_post', flashcard: 'flashcard', activity: 'activity_image', pictogram: 'pictogram' };
    setAssetType(typeMap[template.category] || 'infographic');
    setClinicalArea(template.clinical_area || '');
    const matches = template.prompt_template?.match(/\[(\w+)\]/g) || [];
    const params: Record<string, string> = {};
    matches.forEach(m => {
      const key = m.replace(/[\[\]]/g, '');
      params[key] = parameters[key] || '';
    });
    setParameters(params);
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFile(file);
    setAssetType('pictogram');
    const reader = new FileReader();
    reader.onloadend = () => setUploadedPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  function handleAddSequenceItem() {
    setSequenceItems(prev => [...prev, '']);
  }

  function handleSequenceItemChange(index: number, value: string) {
    setSequenceItems(prev => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  function handleRemoveSequenceItem(index: number) {
    setSequenceItems(prev => prev.filter((_, i) => i !== index));
  }

  function loadSequenceTemplate(area: string) {
    const defaults = SEQUENCE_DEFAULTS[area] || SEQUENCE_DEFAULTS['default'];
    setSequenceItems([...defaults]);
  }

  /**
   * handleGenerateAI - Solo para tab "ai" y "upload". SIEMPRE pasa por ComfyUI.
   * NUNCA se llama desde el tab "deterministic".
   */
  async function handleGenerateAI() {
    if (!title.trim()) {
      setError('El título es requerido');
      return;
    }

    const isAvailable = await ensureComfyUIAvailable();
    if (!isAvailable) {
      setError('ComfyUI no está disponible. Verificá la conexión.');
      return;
    }

    setGenerating(true);
    setError(null);
    setGeneratedAsset(null);
    setGeneratedImageUrl(null);
    setGeneratedImageIds([]);

    try {
      // PASO 1: Generar imagen real con ComfyUI (esperar resultado completo)
      let finalImageUrl: string | null = null;
      let finalImageIds: string[] = [];

      if (comfyuiAvailable && imagePrompt.trim()) {
        try {
          const nbCtxText = nbContext ? ` Contexto de investigación: ${nbContext.substring(0, 300)}` : '';
          const result = await comfyuiService.generateImage({
            workflow: imageWorkflow,
            prompt: imagePrompt + nbCtxText,
            num_images: 1,
            overlay_text: overlayText,
            text_position: textPosition,
            text_color: textColor,
            text_size: 48,
          });

          if (result.status === 'completed' && result.image_ids.length > 0) {
            finalImageIds = result.image_ids;
            finalImageUrl = comfyuiService.getImageUrl(result.image_ids[0]);
            setGeneratedImageUrl(finalImageUrl);
            setGeneratedImageIds(finalImageIds);
          }
        } catch (imgError) {
          console.warn('[ComfyUI] Error generando imagen:', imgError);
        }
      }

      // PASO 2: Upload si es modo upload
      let uploadedUrl: string | null = null;
      if (activeTab === 'upload' && uploadedFile) {
        uploadedUrl = await MultimediaMaterialService.uploadImage(uploadedFile, userId, consultorioId);
      }

      // PASO 3: Construir input con image_url YA resuelto
      const input: any = {
        template_id: selectedTemplate?.id,
        title,
        description,
        asset_type: assetType as any,
        clinical_area: clinicalArea || undefined,
        parameters,
        consultorio_id: consultorioId,
        patient_id: patientId,
        image_url: finalImageUrl,
        uploaded_image_url: uploadedUrl,
        source: 'ai',
      };

      if (activeTab === 'sequence') {
        input.asset_type = 'pictogram_sequence';
        input.sequence_items = sequenceItems.filter(s => s.trim());
      }

      // PASO 4: Crear asset en DB con image_url correcto
      const asset = await MultimediaMaterialService.generateMaterial(input, userId);
      setGeneratedAsset(asset);
    } catch (e: any) {
      setError(e?.message || 'Error al generar el material');
    }
    setGenerating(false);
  }

  /**
   * handleSaveToLibrary - Guarda material determinístico en DB SIN pasar por ComfyUI.
   * Usa la imagen ya generada (detPreview) como image_url.
   */
  async function handleSaveToLibrary() {
    if (!detPreview) {
      setError('Generá un pictograma primero');
      return null;
    }
    const finalTitle = title.trim() || `Material Pictográfico (${new Date().toLocaleDateString()})`;
    setGenerating(true);
    setError(null);
    try {
      const input: any = {
        title: finalTitle,
        description,
        asset_type: assetType as any,
        clinical_area: clinicalArea || undefined,
        parameters,
        consultorio_id: consultorioId,
        patient_id: patientId,
        image_url: detPreview,
        source: pictoSource,
      };
      const asset = await MultimediaMaterialService.generateMaterial(input, userId);
      setGeneratedAsset(asset);
      return asset;
    } catch (e: any) {
      setError(e?.message || 'Error guardando en biblioteca');
      return null;
    } finally {
      setGenerating(false);
    }
  }

  async function handleUpdateMaterial() {
    if (!editMaterialData || !title.trim()) {
      setError('El título es requerido');
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const { error: matError } = await supabase
        .from('materials')
        .update({
          title: title.trim(),
          description: description || null,
          clinical_area: clinicalArea || null,
          category: assetType,
          tags: [assetType, clinicalArea].filter(Boolean),
        })
        .eq('id', editMaterialData.id);

      if (matError) {
        console.error('Error updating material:', matError);
        setError('Error actualizando material');
        return;
      }

      if (editMaterialData.asset) {
        const imageUrl = detPreview || generatedImageUrl || editMaterialData.asset.file_url;
        await MultimediaMaterialService.updateAsset(editMaterialData.asset.id, {
          title: title.trim(),
          description: description || null,
          file_url: imageUrl,
          metadata: {
            ...editMaterialData.asset.metadata,
            updated_at: new Date().toISOString(),
            source: pictoSource,
          },
        });
      }

      onMaterialCreated?.(editMaterialData.id);
    } catch (e: any) {
      setError(e?.message || 'Error actualizando material');
    }
    setGenerating(false);
  }

  async function handleFluxGenerate() {
    if (!fluxTemplate) {
      setError('Seleccioná un template primero');
      return;
    }

    setFluxGenerating(true);
    setError(null);
    setFluxPreview(null);

    const sourcesContext = getSelectedSourcesContext();
    const nbCtx = nbContext ? `\n\nContexto de investigación (NotebookLM): ${nbContext.substring(0, 500)}` : '';

    try {
      let prompt = buildPrompt(fluxTemplate, fluxFields);
      if (sourcesContext || nbCtx) {
        prompt = `Contexto clínico: ${sourcesContext}${nbCtx}\n\n${prompt}`;
      }
      const dataUrl = await fluxService.generateAndGetDataUrl({
        prompt,
        width: fluxTemplate.defaultParams?.width ?? 1024,
        height: fluxTemplate.defaultParams?.height ?? 1024,
      });
      setFluxPreview(dataUrl);
    } catch (e: any) {
      console.error('FLUX generation error:', e);
      // Fallback to DreamShaper XL
      try {
        setError('FLUX no disponible, intentando con DreamShaper XL...');
        let prompt = buildPrompt(fluxTemplate, fluxFields);
        if (sourcesContext || nbCtx) {
          prompt = `Contexto clínico: ${sourcesContext}${nbCtx}\n\n${prompt}`;
        }
        const result = await comfyuiService.generateImage({
          workflow: 'realistic',
          prompt,
          num_images: 1,
        });
        if (result.image_ids?.length > 0) {
          const imageUrl = comfyuiService.getImageUrl(result.image_ids[0]);
          setFluxPreview(imageUrl);
          setError(null);
        }
      } catch (e2: any) {
        setError(e2?.message || 'Error generando imagen');
      }
    }
    setFluxGenerating(false);
  }

  async function handleFluxSaveToLibrary() {
    if (!fluxPreview) {
      setError('Generá una imagen primero');
      return null;
    }
    const finalTitle = title.trim() || `${fluxTemplate?.name || 'Diseño Escena'} (${new Date().toLocaleDateString()})`;
    setGenerating(true);
    setError(null);
    try {
      const selectedSources = clinicalSources.filter(s => selectedSourceIds.includes(s.id));
      const sourceRefs = selectedSources.length > 0
        ? `\n\nFuentes clínicas: ${selectedSources.map(s => s.title).join(', ')}`
        : '';
      const input: any = {
        title: finalTitle,
        description: `Generado con FLUX: ${fluxTemplate?.name || ''}${sourceRefs}`,
        asset_type: 'activity_image',
        clinical_area: clinicalArea || undefined,
        parameters,
        consultorio_id: consultorioId,
        patient_id: patientId,
        image_url: fluxPreview,
        source: 'flux',
        metadata: selectedSources.length > 0 ? { clinical_sources: selectedSources.map(s => ({ id: s.id, title: s.title })) } : undefined,
      };
      const asset = await MultimediaMaterialService.generateMaterial(input, userId);
      setGeneratedAsset(asset);
      return asset;
    } catch (e: any) {
      setError(e?.message || 'Error guardando en biblioteca');
      return null;
    } finally {
      setGenerating(false);
    }
  }

  async function handleDownloadImage() {
    if (generatedImageIds.length === 0) return;
    
    try {
      const imageId = generatedImageIds[0];
      const blob = await comfyuiService.downloadImage(imageId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title || 'material'}_${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('[Download] Error:', e);
    }
  }

  function handleReset() {
    setTitle('');
    setDescription('');
    setSelectedTemplate(null);
    setParameters({});
    setGeneratedAsset(null);
    setError(null);
    setUploadedFile(null);
    setUploadedPreview(null);
    setSequenceItems(['']);
    setActiveTab('ai');
    setIsEditMode(false);
    setEditMaterialData(null);
    setDetPreview(null);
    setGeneratedImageUrl(null);
  }

  const filteredTemplates = templates.filter(t => !templateCategory || t.category === templateCategory);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            {isEditMode ? <Edit3 size={22} className="text-amber-600" /> : <Sparkles size={22} className="text-purple-600" />}
            {isEditMode ? 'Editando Material' : 'Creador de Materiales Multimedia'}
          </h2>
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
            {isEditMode ? `Editando: ${editMaterialData?.title || ''}` : 'Generá actividades, pictogramas, infografías y guías para familias'}
          </p>
        </div>
        <button onClick={handleReset} className="px-3 py-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700">
          {isEditMode ? 'Cancelar Edición' : 'Nuevo'}
        </button>
      </div>

      {/* Mode Tabs */}
      <div className="flex gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
        {[
          { key: 'canva' as const, label: 'Editor Visual', icon: Palette },
          { key: 'ai_prompt' as const, label: 'IA Generativa', icon: Brain },
          { key: 'deterministic' as const, label: 'Pictogramas ($0)', icon: Grid },
          { key: 'flux' as const, label: 'Escenas & Diseños', icon: Sparkles },
          { key: 'upload' as const, label: 'Subir Foto', icon: Upload },
          { key: 'sequence' as const, label: 'Secuencia', icon: Layers },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs font-bold transition-all ${
              activeTab === tab.key
                ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-white shadow-sm'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'canva' ? (
        <div className="h-[calc(100vh-200px)] min-h-[500px]">
          <ErrorBoundary moduleName="Editor Visual">
            <VisualEditor
              width={800}
              height={600}
              title={title || 'Material Clínico'}
              onSave={async (dataUrl, json) => {
                try {
                  const input: any = {
                    title: title || 'Diseño Visual',
                    description: 'Creado con Editor Visual',
                    asset_type: 'activity_image',
                    clinical_area: clinicalArea || undefined,
                    consultorio_id: consultorioId,
                    patient_id: patientId,
                    image_url: dataUrl,
                    source: 'canva',
                  };
                  const asset = await MultimediaMaterialService.generateMaterial(input, userId);
                  if (onMaterialCreated && (asset?.id || asset?.material_id)) {
                    await onMaterialCreated(asset.material_id || asset.id);
                  }
                } catch (e: any) {
                  console.error('[VisualEditor] Save error:', e);
                  setError(e?.message || 'Error guardando diseño visual');
                }
              }}
            />
          </ErrorBoundary>
        </div>
      ) : activeTab === 'ai_prompt' ? (
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
                <Brain size={20} className="text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 dark:text-white">IA Generativa de Contenido Clínico</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Describí lo que necesitá y la IA lo genera para vos</p>
              </div>
            </div>

            {/* Example prompts */}
            <div className="flex flex-wrap gap-2 mb-4">
              {[
                'Lista de 30 palabras con complejo L R D para discriminación',
                'Actividad de conciencia fonológica para niños de 5 años',
                'Guía para padres de niño con dislalia',
                'Secuencia de pasos para higiene bucal con pictogramas',
                'Post de Instagram sobre terapia de voz',
              ].map((ex, i) => (
                <button
                  key={i}
                  onClick={() => setAiPrompt(ex)}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-[10px] font-medium hover:bg-purple-50 dark:hover:bg-purple-900/20 hover:text-purple-600 dark:hover:text-purple-400 transition-colors text-left"
                >
                  {ex}
                </button>
              ))}
            </div>

            {/* Prompt input */}
            <div className="relative">
              <textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="Ej: Hazme una lista de 30 palabras que contengan el complejo L R D para trabajo de discriminación de esos fonemas para niños..."
                className="w-full h-32 px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                onKeyDown={(e) => { if (e.key === 'Enter' && e.metaKey) handleAIGenerate(); }}
              />
              <div className="absolute bottom-2 right-2 flex items-center gap-2">
                <span className="text-[9px] text-slate-400">Ctrl+Enter para generar</span>
                <button
                  onClick={handleAIGenerate}
                  disabled={aiGenerating || !aiPrompt.trim()}
                  className="px-4 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-bold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                >
                  {aiGenerating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  {aiGenerating ? 'Generando...' : 'Generar'}
                </button>
              </div>
            </div>

            {/* Results */}
            {aiError && (
              <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
                <AlertTriangle size={14} /> {aiError}
              </div>
            )}

            {aiResult && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">Resultado generado</h4>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={async () => {
                        try {
                          const matTitle = aiPrompt.substring(0, 60) || 'Material IA';
                          const { data, error: matErr } = await supabase.from('materials').insert([{
                            title: matTitle,
                            description: aiResult,
                            clinical_area: clinicalArea || 'General',
                            resource_type: 'ejercicio',
                            media_type: 'doc',
                            target_profile: 'adulto',
                            status: 'active',
                            verified: false,
                            tags: ['ia', clinicalArea].filter(Boolean),
                          }]).select().single();
                          if (matErr) throw matErr;
                          if (data && onMaterialCreated) {
                            await onMaterialCreated(data.id);
                          }
                        } catch (err: any) {
                          setError('Error guardando material: ' + err.message);
                        }
                      }}
                      className="px-3 py-1 bg-emerald-600 text-white rounded-lg text-[10px] font-bold hover:bg-emerald-700 transition-colors flex items-center gap-1"
                    >
                      <Save size={10} /> Guardar en Biblioteca
                    </button>
                    <button
                      onClick={() => { navigator.clipboard.writeText(aiResult); }}
                      className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-[10px] font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                      Copiar
                    </button>
                    <button
                      onClick={() => {
                        setTitle(aiPrompt.substring(0, 60));
                        setDescription(aiResult.substring(0, 200));
                        setActiveTab('sequence');
                      }}
                      className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg text-[10px] font-bold hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
                    >
                      Usar como secuencia
                    </button>
                  </div>
                </div>
                <div className="prose prose-sm dark:prose-invert max-w-none bg-slate-50 dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed max-h-[500px] overflow-y-auto">
                  {aiResult}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Config */}
        <div className="lg:col-span-2 space-y-4">
          {/* Motor Determinístico */}
          {activeTab === 'deterministic' && (
            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-700 space-y-3">
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                <Grid size={14} /> Motor Determinístico (Costo $0)
              </h3>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">Pictogramas, PECS, secuencias y tarjetas con precisión clínica. Texto 100% legible.</p>

              {/* Source Toggle: Local vs ARASAAC */}
              <div className="flex gap-2 bg-slate-50 dark:bg-slate-800 p-1 rounded-lg">
                <button onClick={() => { setPictoSource('local'); setArasaacSelected([]); setDetPreview(null); }}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${pictoSource === 'local' ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
                  📚 Biblioteca Local
                </button>
                <button onClick={() => { setPictoSource('arasaac'); setSelectedPictograms([]); setDetPreview(null); }}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${pictoSource === 'arasaac' ? 'bg-white dark:bg-slate-900 text-emerald-700 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}>
                  🌐 ARASAAC
                </button>
              </div>

              {/* Sub-modo */}
              <div className="flex flex-wrap gap-2">
                {[
                  { key: 'pictogram' as const, label: 'Pictograma', icon: '🟣' },
                  { key: 'pecs' as const, label: 'PECS', icon: '📋' },
                  { key: 'sequence' as const, label: 'Secuencia', icon: '🔢' },
                  { key: 'card' as const, label: 'Tarjeta', icon: '🃏' },
                ].map(m => (
                  <button key={m.key} onClick={() => { setDetMode(m.key); setSelectedPictograms([]); setDetPreview(null); }}
                    className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${detMode === m.key ? 'bg-purple-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>
                    {m.icon} {m.label}
                  </button>
                ))}
              </div>

              {/* Categorías - solo fuente local */}
              {pictoSource === 'local' && (
              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">Categoría</label>
                <div className="flex gap-2 flex-wrap">
                  {Object.entries(categories).map(([catId, cat]) => (
                    <button key={catId} onClick={() => handleSelectCategory(catId)}
                      className={`px-3 py-1 text-xs rounded-full transition-colors ${selectedCategory === catId ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>
                      {cat.label} ({cat.count})
                    </button>
                  ))}
                </div>
              </div>
              )}

              {/* Búsqueda ARASAAC */}
              {pictoSource === 'arasaac' && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                  🌐 Buscar en ARASAAC (Banco Público de Pictogramas)
                </label>
                <div className="flex flex-wrap gap-2">
                  <input type="text" value={arasaacQuery}
                    onChange={e => setArasaacQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleArasaacSearch()}
                    placeholder="Ej: comer, lavarse, escuela..."
                    className="flex-1 p-2 border border-emerald-200 dark:border-emerald-800 rounded-lg text-sm focus:border-emerald-400 outline-none" />
                  <button onClick={handleArasaacSearch} disabled={arasaacLoading || !arasaacQuery.trim()}
                    className="px-4 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                    {arasaacLoading ? '...' : 'Buscar'}
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 dark:text-slate-500">Pictogramas gratuitos con licencia CC BY-NC-SA. Ideales para uso clínico.</p>
              </div>
              )}

              {/* Grid de pictogramas - Local */}
              {pictoSource === 'local' && (
              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">
                  Seleccionar {detMode === 'pictogram' || detMode === 'card' ? '1 pictograma' : 'pictogramas'} ({selectedPictograms.length} seleccionados)
                </label>
                <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                  {pictogramList.map(p => (
                    <button key={p.id} onClick={() => togglePictogram(p.id)}
                      className={`p-2 rounded-lg border text-center transition-all ${selectedPictograms.includes(p.id) ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'}`}>
                      <p className="text-[10px] font-bold text-slate-700 dark:text-slate-200">{p.label}</p>
                    </button>
                  ))}
                </div>
              </div>
              )}

              {/* Grid de pictogramas - ARASAAC */}
              {pictoSource === 'arasaac' && (
              <div>
                <label className="text-xs font-bold text-emerald-600 mb-1 block">
                  Seleccionar {detMode === 'pictogram' || detMode === 'card' ? '1 pictograma' : 'pictogramas'} ({arasaacSelected.length} seleccionados)
                </label>
                {arasaacResults.length > 0 ? (
                  <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto">
                    {arasaacResults.map(p => (
                      <button key={p.id} onClick={() => toggleArasaacPictogram(p)}
                        className={`p-2 rounded-lg border text-center transition-all ${arasaacSelected.find(s => s.id === p.id) ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'}`}>
                        <img src={p.image_url} alt={p.label} className="w-10 h-10 mx-auto mb-1 object-contain" loading="lazy" />
                        <p className="text-[10px] font-bold text-slate-700 dark:text-slate-200">{p.label}</p>
                        <p className="text-[8px] text-slate-400 dark:text-slate-500">ARASAAC</p>
                      </button>
                    ))}
                  </div>
                ) : (
                   <div className="text-center py-6 text-slate-400 dark:text-slate-500">
                    <p className="text-xs">Escribí un término y hacé clic en "Buscar"</p>
                  </div>
                )}
              </div>
              )}

              {/* Config PECS */}
              {detMode === 'pecs' && (
                <div className="flex gap-3 items-center">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Color borde:</label>
                  <input type="color" value={pecsBorderColor} onChange={e => setPecsBorderColor(e.target.value)}
                    className="w-8 h-8 rounded cursor-pointer" />
                </div>
              )}

              {/* Config Secuencia - Labels */}
              {detMode === 'sequence' && selectedPictograms.length > 0 && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Etiquetas por paso (opcional)</label>
                  {selectedPictograms.map((pid, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-5 h-5 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-[10px] font-bold">{i + 1}</span>
                      <input type="text" value={sequenceLabels[i] || ''}
                        onChange={e => {
                          const newLabels = [...sequenceLabels];
                          newLabels[i] = e.target.value;
                          setSequenceLabels(newLabels);
                        }}
                        placeholder={`Paso ${i + 1}...`}
                        className="flex-1 p-1.5 border border-slate-200 dark:border-slate-700 rounded text-xs focus:border-blue-400 dark:focus:border-blue-500 outline-none" />
                    </div>
                  ))}
                </div>
              )}

              {/* Botón generar */}
              <button onClick={handleDetGenerate}
                disabled={detGenerating || (pictoSource === 'arasaac' ? arasaacSelected.length === 0 : selectedPictograms.length === 0)}
                className="w-full py-2.5 bg-purple-600 text-white text-sm font-bold rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
                {detGenerating ? (
                  <><Loader2 size={16} className="animate-spin" /> Generando...</>
                ) : (
                  <><Sparkles size={16} /> Generar {detMode === 'pictogram' ? 'Pictograma' : detMode === 'pecs' ? 'PECS' : detMode === 'sequence' ? 'Secuencia' : 'Tarjeta'}</>
                )}
                {pictoSource === 'arasaac' && <span className="text-[10px] opacity-70">(ARASAAC)</span>}
              </button>
            </div>
          )}

          {/* FLUX Tab - Clinical Templates */}
          {activeTab === 'flux' && (
            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-700 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                  <Sparkles size={14} className="text-purple-600" /> Escenas & Diseños (FLUX 2 Pro)
                </h3>
                 <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full">~$0.05/imagen</span>
              </div>

              {/* Category selector */}
              <div className="flex gap-2 flex-wrap">
                {TEMPLATE_CATEGORIES.map(cat => {
                  const colorMap: Record<string, string> = {
                    blue: 'bg-blue-100 text-blue-700 border-blue-300',
                    emerald: 'bg-emerald-100 text-emerald-700 border-emerald-300',
                    purple: 'bg-purple-100 text-purple-700 border-purple-300',
                    amber: 'bg-amber-100 text-amber-700 border-amber-300',
                  };
                  const activeClasses = colorMap[cat.color] || 'bg-slate-100 text-slate-700 border-slate-300';
                  return (
                    <button
                      key={cat.id}
                      onClick={() => { setFluxCategory(cat.id); setFluxTemplate(null); setFluxFields(['']); }}
                      className={`px-3 py-1.5 text-xs rounded-lg transition-colors font-medium ${
                        fluxCategory === cat.id
                          ? activeClasses
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-transparent'
                      }`}
                    >
                      {cat.icon} {cat.label}
                    </button>
                  );
                })}
              </div>

              {/* Template grid */}
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                {getTemplatesByCategory(fluxCategory).map(template => (
                  <button
                    key={template.id}
                    onClick={() => { setFluxTemplate(template); setFluxFields(template.exampleFields); }}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      fluxTemplate?.id === template.id
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{template.icon} {template.name}</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 line-clamp-1">{template.description}</p>
                  </button>
                ))}
              </div>

              {/* Custom fields */}
              {fluxTemplate && (
                <div className="space-y-2 border-t border-slate-100 dark:border-slate-800 pt-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Personalizar contenido</p>
                  {fluxFields.map((field, i) => (
                    <div key={i} className="flex gap-2">
                      <input
                        type="text"
                        value={field}
                        onChange={e => {
                          const newFields = [...fluxFields];
                          newFields[i] = e.target.value;
                          setFluxFields(newFields);
                        }}
                        placeholder={fluxTemplate.exampleFields[i] || 'Detalle adicional...'}
                        className="flex-1 p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                      />
                      {i > 0 && (
                        <button onClick={() => setFluxFields(fluxFields.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-500">
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={() => setFluxFields([...fluxFields, ''])}
                    className="text-[10px] text-blue-600 hover:text-blue-700 font-medium"
                  >
                    + Agregar detalle
                  </button>
                </div>
              )}

              {/* Clinical Sources for FLUX */}
              {clinicalSources.length > 0 && (
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase mb-1 block">
                    Fuentes Clínicas {selectedSourceIds.length > 0 && <span className="text-emerald-500">({selectedSourceIds.length})</span>}
                  </label>
                  <div className="max-h-24 overflow-y-auto space-y-1 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5">
                    {clinicalSources.slice(0, 8).map(source => (
                      <label key={source.id} className={`flex items-center gap-1.5 p-1 rounded cursor-pointer text-[10px] ${selectedSourceIds.includes(source.id) ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                        <input
                          type="checkbox"
                          checked={selectedSourceIds.includes(source.id)}
                          onChange={(e) => {
                            setSelectedSourceIds(prev =>
                              e.target.checked ? [...prev, source.id] : prev.filter(id => id !== source.id)
                            );
                          }}
                          className="accent-emerald-600"
                        />
                        <span className="truncate text-slate-600 dark:text-slate-300">{source.title}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* NotebookLM Context */}
              {nbNotebooks.length > 0 && (
                <div>
                  <label className="text-[10px] font-bold text-purple-400 uppercase mb-1 flex items-center gap-1">
                    <BookOpen size={10} /> NotebookLM ({nbArtifacts.length} artefactos)
                  </label>
                  <div className="max-h-20 overflow-y-auto space-y-1 border border-purple-200 dark:border-purple-800 rounded-lg p-1.5">
                    {nbArtifacts.length === 0 ? (
                      <p className="text-[9px] text-slate-400">Sin artefactos generados aún</p>
                    ) : (
                      nbArtifacts.map(art => (
                        <button
                          key={art.id}
                          onClick={async () => {
                            setSelectedNbArtifact(art.id);
                            const ctx = await loadNotebookContext();
                            setNbContext(ctx);
                          }}
                          className={`w-full flex items-center gap-1.5 p-1 rounded text-left text-[10px] ${selectedNbArtifact === art.id ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-600' : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300'}`}
                        >
                          <span>{art.type === 'podcast' ? '🎧' : art.type === 'quiz' ? '❓' : art.type === 'flashcards' ? '🃏' : art.type === 'mind_map' ? '🧠' : art.type === 'slide_deck' ? '📊' : '📄'}</span>
                          <span className="truncate">{art.title}</span>
                          <span className={`ml-auto text-[8px] px-1 rounded ${art.status === 'completed' ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600'}`}>
                            {art.status === 'completed' ? '✓' : '...'}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                  {selectedNbArtifact && (
                    <button
                      onClick={() => {
                        setSelectedNbArtifact(null);
                        setNbContext('');
                      }}
                      className="text-[9px] text-purple-400 hover:text-purple-600 mt-1"
                    >
                      Limpiar contexto
                    </button>
                  )}
                </div>
              )}

              {/* Preview del prompt */}
              {fluxTemplate && (
                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Prompt generado</p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-3">{buildPrompt(fluxTemplate, fluxFields)}</p>
                </div>
              )}

              {/* Generate button */}
              <button
                onClick={handleFluxGenerate}
                disabled={!fluxTemplate || fluxGenerating}
                className="w-full py-2.5 bg-purple-600 text-white text-xs font-bold rounded-lg hover:bg-purple-700 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {fluxGenerating ? (
                  <><Loader2 size={14} className="animate-spin" /> Generando con FLUX...</>
                ) : (
                  <><Sparkles size={14} /> Generar Imagen</>
                )}
              </button>
            </div>
          )}

          {/* Template Selection (AI tab) */}
          {activeTab === 'ai' && (
            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-700 space-y-3">
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                <Layout size={14} /> Plantilla
              </h3>
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => setTemplateCategory('')} className={`px-3 py-1 text-xs rounded-full transition-colors ${!templateCategory ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>
                  Todas
                </button>
                {(['activity', 'infographic', 'social', 'flashcard', 'pictogram'] as TemplateCategory[]).map(cat => (
                  <button key={cat} onClick={() => setTemplateCategory(cat)} className={`px-3 py-1 text-xs rounded-full transition-colors ${templateCategory === cat ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>
                    {cat === 'activity' ? 'Actividades' : cat === 'infographic' ? 'Infografías' : cat === 'social' ? 'Redes' : cat === 'flashcard' ? 'Tarjetas' : 'Pictogramas'}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                {filteredTemplates.map(template => (
                  <button key={template.id} onClick={() => handleTemplateSelect(template)} className={`p-3 rounded-lg border text-left transition-all ${selectedTemplate?.id === template.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'}`}>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{template.name}</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 line-clamp-1">{template.description}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ComfyUI Image Generation (AI tab) */}
          {activeTab === 'ai' && comfyuiAvailable && (
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 rounded-xl p-4 border border-purple-200 dark:border-purple-900/40 space-y-3">
              <h3 className="text-sm font-bold text-purple-700 dark:text-purple-400 flex items-center gap-2">
                <Palette size={14} /> Generación de Imagen Real
              </h3>
              <p className="text-[10px] text-purple-600 dark:text-purple-400">Genera imágenes reales con Stable Diffusion XL via ComfyUI</p>
              
              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">Estilo Visual</label>
                <div className="flex gap-2 flex-wrap">
                  {IMAGE_WORKFLOWS.map(wf => (
                    <button
                      key={wf.id}
                      onClick={() => setImageWorkflow(wf.id)}
                      className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                        imageWorkflow === wf.id
                          ? 'bg-purple-600 text-white'
                          : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {wf.icon} {wf.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">Prompt de Imagen (en inglés)</label>
                <textarea
                  value={imagePrompt}
                  onChange={e => setImagePrompt(e.target.value)}
                  rows={2}
                  placeholder="Ej: child washing hands, simple pictogram style, bright colors"
                  className="w-full p-2 border border-purple-200 dark:border-purple-800 rounded-lg text-sm resize-none focus:border-purple-400 outline-none bg-white dark:bg-slate-900 text-slate-700 dark:text-white"
                />
                <p className="text-[10px] text-purple-500 dark:text-purple-400 mt-1">Describe la imagen que querés generar</p>
                {nbContext && (
                  <div className="mt-1 px-2 py-1 bg-purple-50 dark:bg-purple-900/30 rounded text-[10px] text-purple-600 flex items-center gap-1">
                    <BookOpen size={10} /> Contexto NotebookLM activo — se inyectará al prompt
                  </div>
                )}
              </div>

              {/* Text Overlay Controls */}
              <div className="border-t border-purple-200 dark:border-purple-900/40 pt-3 space-y-2">
                <h4 className="text-xs font-bold text-purple-700 dark:text-purple-400">Texto Superpuesto</h4>
                <div>
                  <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 block">Texto (aparece en la imagen)</label>
                  <input
                    type="text"
                    value={overlayText}
                    onChange={e => setOverlayText(e.target.value)}
                    placeholder="Ej: VACA, MAMA, LAVARSE LAS MANOS"
                    className="w-full p-2 border border-purple-200 dark:border-purple-800 rounded-lg text-sm focus:border-purple-400 outline-none bg-white dark:bg-slate-900 text-slate-700 dark:text-white"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 block">Posición</label>
                    <select value={textPosition} onChange={e => setTextPosition(e.target.value as any)} className="w-full p-1.5 border border-purple-200 dark:border-purple-800 rounded text-xs bg-white dark:bg-slate-900 text-slate-700 dark:text-white">
                      <option value="top">Arriba</option>
                      <option value="center">Centro</option>
                      <option value="bottom">Abajo</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 block">Color</label>
                    <select value={textColor} onChange={e => setTextColor(e.target.value)} className="w-full p-1.5 border border-purple-200 dark:border-purple-800 rounded text-xs bg-white dark:bg-slate-900 text-slate-700 dark:text-white">
                      <option value="white">Blanco</option>
                      <option value="black">Negro</option>
                      <option value="yellow">Amarillo</option>
                      <option value="red">Rojo</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <p className="text-[10px] text-purple-500 dark:text-purple-400 font-medium">DreamShaper XL no genera texto confiable. El texto se superpone con Pillow.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ComfyUI Status */}
          {activeTab === 'ai' && comfyuiAvailable === false && (
            <div className="bg-amber-50 dark:bg-amber-950/20 rounded-xl p-4 border border-amber-200 dark:border-amber-800">
              <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">
                <AlertTriangle size={12} className="inline mr-1" />
                ComfyUI no disponible. Solo se generará texto descriptivo.
              </p>
            </div>
          )}

          {/* Upload Tab */}
          {activeTab === 'upload' && (
            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-700 space-y-3">
              <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                <Camera size={14} /> Subir Imagen para Pictograma
              </h3>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
              <button onClick={() => fileInputRef.current?.click()} className="w-full border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-8 text-center hover:border-blue-400 transition-colors">
                {uploadedPreview ? (
                  <img src={uploadedPreview} alt="Preview" className="max-h-48 mx-auto rounded-lg" />
                ) : (
                  <>
                    <Upload size={32} className="mx-auto text-slate-400 mb-2" />
                    <p className="text-sm text-slate-500 dark:text-slate-400">Click para subir una foto</p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">La IA la convertirá en pictograma terapéutico</p>
                  </>
                )}
              </button>
              {uploadedFile && (
                <button onClick={() => { setUploadedFile(null); setUploadedPreview(null); }} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
                  <X size={12} /> Quitar imagen
                </button>
              )}
            </div>
          )}

          {/* Sequence Tab */}
          {activeTab === 'sequence' && (
            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                  <Layers size={14} /> Secuencia de Pictogramas
                </h3>
                <button onClick={() => loadSequenceTemplate(clinicalArea)} className="text-[10px] text-blue-600 hover:text-blue-800 font-bold">
                  Cargar plantilla ({clinicalArea || 'default'})
                </button>
              </div>
              <p className="text-[10px] text-slate-400 dark:text-slate-500">Creá una guía visual paso a paso para que la familia siga en casa</p>
              <div className="space-y-2">
                {sequenceItems.map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0">{i + 1}</span>
                    <input
                      type="text"
                      value={item}
                      onChange={e => handleSequenceItemChange(i, e.target.value)}
                      placeholder={`Paso ${i + 1}...`}
                      className="flex-1 p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:border-blue-400 dark:focus:border-blue-500 outline-none"
                    />
                    {sequenceItems.length > 1 && (
                      <button onClick={() => handleRemoveSequenceItem(i)} className="text-slate-400 hover:text-red-500 shrink-0">
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button onClick={handleAddSequenceItem} className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1">
                <Plus size={12} /> Agregar paso
              </button>
            </div>
          )}

          {/* Common Form - SOLO para tabs AI y Upload */}
          {(activeTab === 'ai' || activeTab === 'upload') && (
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-700 space-y-3">
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Configuración del Material</h3>
            <div>
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">Título *</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Ej: Secuencia de higiene bucal" className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:border-blue-400 dark:focus:border-blue-500 outline-none" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">Descripción / Notas</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Contexto o instrucciones adicionales..." className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm resize-none focus:border-blue-400 dark:focus:border-blue-500 outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">Tipo</label>
                <select value={assetType} onChange={e => setAssetType(e.target.value)} className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 focus:border-blue-400 dark:focus:border-blue-500 outline-none">
                  {ASSET_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">Área Clínica</label>
                <select value={clinicalArea} onChange={e => setClinicalArea(e.target.value)} className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 focus:border-blue-400 dark:focus:border-blue-500 outline-none">
                  <option value="">Seleccionar...</option>
                  {CLINICAL_AREAS.map(a => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
            </div>
            {/* Clinical Sources Selector */}
            {clinicalSources.length > 0 && (
              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">
                  Fuentes Clínicas {selectedSourceIds.length > 0 && <span className="text-emerald-500">({selectedSourceIds.length} seleccionadas)</span>}
                </label>
                <p className="text-[10px] text-slate-400 dark:text-slate-500 mb-1.5">Seleccioná fuentes para contextualizar la generación IA</p>
                <div className="max-h-32 overflow-y-auto space-y-1 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5">
                  {clinicalSources.map(source => (
                    <label key={source.id} className={`flex items-start gap-2 p-1.5 rounded cursor-pointer transition-colors ${selectedSourceIds.includes(source.id) ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
                      <input
                        type="checkbox"
                        checked={selectedSourceIds.includes(source.id)}
                        onChange={(e) => {
                          setSelectedSourceIds(prev =>
                            e.target.checked ? [...prev, source.id] : prev.filter(id => id !== source.id)
                          );
                        }}
                        className="mt-0.5 accent-emerald-600"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold text-slate-700 dark:text-slate-200 truncate">{source.title}</p>
                        <p className="text-[9px] text-slate-400 dark:text-slate-500 truncate">{source.content.substring(0, 80)}...</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}
            {Object.keys(parameters).length > 0 && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 block">Parámetros de Plantilla</label>
                {Object.entries(parameters).map(([key, value]) => (
                  <div key={key}>
                    <label className="text-[10px] text-slate-400 uppercase">{key.replace(/_/g, ' ')}</label>
                    <input type="text" value={value} onChange={e => setParameters(prev => ({ ...prev, [key]: e.target.value }))} placeholder={key} className="w-full p-1.5 border border-slate-200 dark:border-slate-700 rounded text-sm focus:border-blue-400 dark:focus:border-blue-500 outline-none" />
                  </div>
                ))}
              </div>
            )}
            <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-2 flex items-center gap-2">
              <AlertTriangle size={12} className="text-amber-600 shrink-0" />
              <p className="text-[10px] text-amber-700 dark:text-amber-400 font-bold">Este botón usa IA generativa (DreamShaper XL via Modal). Costo ~$0.002-0.005 por imagen.</p>
            </div>
            <button
              onClick={handleGenerateAI}
              disabled={generating || !title.trim()}
              className="w-full py-2.5 bg-purple-600 text-white text-sm font-bold rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {generating ? (
                <><Loader2 size={16} className="animate-spin" /> Generando con IA...</>
              ) : (
                <><Wand2 size={16} /> Generar con IA (DreamShaper XL)</>
              )}
            </button>
          </div>
          )}

          {/* Configuración adicional para tab deterministic */}
          {activeTab === 'deterministic' && (
          <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-700 space-y-3">
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">Configuración del Material</h3>
            <div>
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">Título *</label>
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Ej: Pictograma de comer" className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:border-blue-400 dark:focus:border-blue-500 outline-none" />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">Descripción / Notas</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Contexto o instrucciones adicionales..." className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm resize-none focus:border-blue-400 dark:focus:border-blue-500 outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">Tipo</label>
                <select value={assetType} onChange={e => setAssetType(e.target.value)} className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 focus:border-blue-400 dark:focus:border-blue-500 outline-none">
                  {ASSET_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">Área Clínica</label>
                <select value={clinicalArea} onChange={e => setClinicalArea(e.target.value)} className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm bg-white dark:bg-slate-900 focus:border-blue-400 dark:focus:border-blue-500 outline-none">
                  <option value="">Seleccionar...</option>
                  {CLINICAL_AREAS.map(a => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>
            </div>
            {detPreview && (
              <div className="bg-emerald-50 border border-emerald-200 dark:border-emerald-800 rounded-lg p-2 flex items-center gap-2">
                <CheckCircle2 size={12} className="text-emerald-600 shrink-0" />
                <p className="text-[10px] text-emerald-700 font-bold">Costo: $0.00 — Motor determinístico + ARASAAC. Sin consumo de IA.</p>
              </div>
            )}
          </div>
          )}
        </div>

        {/* Right: Preview */}
        <div className="space-y-4">
          {/* Preview Motor Determinístico */}
          {activeTab === 'deterministic' && detPreview && (
            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-500" /> Material Generado
                </h3>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-600">
                  $0.00
                </span>
              </div>
              <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                <img src={detPreview} alt="Preview" className="w-full rounded-lg shadow-sm" />
              </div>

              {/* Acciones para uso directo (NO IA) */}
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Acciones</p>
                <div className="grid grid-cols-2 gap-2">
                  <a href={detPreview} download={`${title || 'pictograma'}_${Date.now()}.png`}
                    className="py-2 bg-emerald-600 text-white text-[10px] font-bold rounded-lg hover:bg-emerald-700 flex items-center justify-center gap-1">
                    <Download size={10} /> Descargar
                  </a>
                  <button onClick={() => { const w = window.open(''); if (w) { w.document.write(`<img src="${detPreview}" />`); w.print(); } }}
                    className="py-2 bg-blue-600 text-white text-[10px] font-bold rounded-lg hover:bg-blue-700 flex items-center justify-center gap-1">
                    🖨️ Imprimir
                  </button>
                </div>
                <button onClick={handleSaveToLibrary}
                  disabled={!title.trim()}
                  className="w-full py-2 bg-slate-700 text-white text-[10px] font-bold rounded-lg hover:bg-slate-800 disabled:opacity-50 flex items-center justify-center gap-1">
                  <BookOpen size={10} /> Guardar en Biblioteca
                </button>
              </div>

              {/* Divider */}
              <div className="border-t border-slate-200 dark:border-slate-700 pt-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Componer Material</p>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setActiveTab('sequence')}
                    className="py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-[10px] font-bold rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 flex items-center justify-center gap-1 border border-blue-200 dark:border-blue-800">
                    📋 Crear Secuencia
                  </button>
                  <button onClick={() => { setDetMode('pecs'); setSelectedPictograms([]); }}
                    className="py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-[10px] font-bold rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 flex items-center justify-center gap-1 border border-blue-200 dark:border-blue-800">
                    📋 Crear PECS
                  </button>
                </div>
              </div>

              {/* Divider: Diseño avanzado con IA */}
              <div className="border-t border-slate-200 dark:border-slate-700 pt-2">
                <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-2 mb-2">
                  <p className="text-[10px] font-bold text-amber-700 dark:text-amber-400">Diseño Avanzado con IA</p>
                  <p className="text-[9px] text-amber-600 dark:text-amber-500">Transformar creativamente, generar escena, composición avanzada</p>
                </div>
                <button onClick={() => { setActiveTab('ai'); setImagePrompt(`Transform this pictogram: ${title || ''}`); }}
                  className="w-full py-2 bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 text-[10px] font-bold rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/40 flex items-center justify-center gap-1 border border-purple-200 dark:border-purple-800">
                  <Wand2 size={10} /> Crear Diseño Avanzado con IA
                </button>
              </div>

              <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{title || 'Sin título'}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {pictoSource === 'arasaac' ? 'ARASAAC • Fuente externa' : 'Motor Determinístico • Pillow rendering'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {isEditMode ? (
                  <button onClick={handleUpdateMaterial} disabled={generating} className="flex-1 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 flex items-center justify-center gap-1 disabled:opacity-50">
                    {generating ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Guardar Cambios
                  </button>
                ) : (
                  <button onClick={async () => { const asset = await handleSaveToLibrary(); if (asset?.id) await onMaterialCreated?.(asset.id); }} className="flex-1 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 flex items-center justify-center gap-1">
                    <Save size={12} /> Guardar y Ver en Biblioteca
                  </button>
                )}
                {detPreview && (
                  <button onClick={() => {
                    setEditingAssetId(null);
                    setEditingImageUrl(detPreview);
                  }} className="py-2 px-3 bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 text-xs font-bold rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/40 flex items-center justify-center gap-1">
                    <Edit3 size={12} /> Editar
                  </button>
                )}
                {detPreview && (
                  <button onClick={() => {
                    setShareData({
                      title: title || 'Material determinístico',
                      imageUrl: detPreview,
                      clinicalArea,
                      tags: ['deterministic', clinicalArea].filter(Boolean),
                    });
                  }} className="py-2 px-3 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center gap-1">
                    <Share2 size={12} /> Compartir
                  </button>
                )}
                <button onClick={() => { setDetPreview(null); setSelectedPictograms([]); setArasaacSelected([]); setIsEditMode(false); setEditMaterialData(null); }} className="py-2 px-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700">
                  Nuevo
                </button>
              </div>
            </div>
          )}

          {/* FLUX Preview */}
          {activeTab === 'flux' && fluxPreview && (
            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="relative">
                <img src={fluxPreview} alt="FLUX preview" className="w-full rounded-lg" />
                {fluxGenerating && (
                  <div className="absolute inset-0 bg-white dark:bg-slate-900/80 flex items-center justify-center rounded-lg">
                    <Loader2 className="animate-spin text-purple-600" size={32} />
                  </div>
                )}
              </div>

              {/* Citation badge — visible when sources were used */}
              {selectedSourceIds.length > 0 && (
                <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-2.5">
                  <p className="text-[9px] font-bold text-emerald-700 dark:text-emerald-300 uppercase mb-1">Fuentes clínicas utilizadas</p>
                  <div className="flex flex-wrap gap-1">
                    {clinicalSources
                      .filter(s => selectedSourceIds.includes(s.id))
                      .map(source => (
                        <span key={source.id} className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-800/30 text-emerald-700 dark:text-emerald-200 rounded text-[9px]">
                          <BookOpen size={8} /> {source.title}
                        </span>
                      ))}
                  </div>
                  <p className="text-[8px] text-emerald-600 dark:text-emerald-400 mt-1">
                    La generación consideró el contexto de estas fuentes para mayor precisión clínica
                  </p>
                </div>
              )}

              <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{title || 'Sin título'}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  FLUX 2 Pro • {fluxTemplate?.name || 'Template'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={async () => { const asset = await handleFluxSaveToLibrary(); if (asset?.id) await onMaterialCreated?.(asset.id); }} className="flex-1 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 flex items-center justify-center gap-1">
                  <Save size={12} /> Guardar y Ver en Biblioteca
                </button>
                <button onClick={() => {
                  setEditingAssetId(null);
                  setEditingImageUrl(fluxPreview);
                }} className="py-2 px-3 bg-amber-50 text-amber-600 text-xs font-bold rounded-lg hover:bg-amber-100 flex items-center justify-center gap-1">
                  <Edit3 size={12} /> Editar
                </button>
                <button onClick={() => {
                  setShareData({
                    title: title || 'Material FLUX',
                    imageUrl: fluxPreview,
                    clinicalArea,
                    tags: ['flux', clinicalArea].filter(Boolean),
                  });
                }} className="py-2 px-3 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center gap-1">
                  <Share2 size={12} /> Compartir
                </button>
                <button onClick={() => { setFluxPreview(null); setFluxTemplate(null); setFluxFields(['']); }} className="py-2 px-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700">
                  Nuevo
                </button>
              </div>
            </div>
          )}

          {activeTab === 'deterministic' && !detPreview && !detGenerating && (
            <div className="bg-white dark:bg-slate-900 rounded-xl p-8 border border-slate-200 dark:border-slate-700 text-center">
              <Grid size={48} className="mx-auto text-slate-300 mb-3" />
              <p className="text-sm text-slate-500 dark:text-slate-400">Seleccioná pictogramas y generá material</p>
              <p className="text-xs text-slate-400 mt-1">Costo: $0.00 - Renderizado local con Pillow</p>
            </div>
          )}

          {generatedAsset && (
            <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-emerald-500" /> Material Generado
                </h3>
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${generatedAsset.status === 'active' ? 'bg-emerald-100 text-emerald-600' : generatedAsset.status === 'processing' ? 'bg-amber-100 text-amber-600' : 'bg-red-100 text-red-600'}`}>
                  {generatedAsset.status}
                </span>
              </div>

              {/* Imagen generada */}
              {generatedImageUrl && (
                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                  <img src={generatedImageUrl} alt={title} className="w-full rounded-lg shadow-sm" />
                  <div className="flex gap-2 mt-2">
                    <button onClick={handleDownloadImage} className="flex-1 py-1.5 bg-emerald-600 text-white text-[10px] font-bold rounded-lg hover:bg-emerald-700 flex items-center justify-center gap-1">
                      <Download size={10} /> Descargar Imagen
                    </button>
                    <a href={generatedImageUrl} target="_blank" rel="noopener noreferrer" className="py-1.5 px-3 bg-slate-200 text-slate-600 dark:text-slate-300 text-[10px] font-bold rounded-lg hover:bg-slate-300 flex items-center justify-center gap-1">
                      <Eye size={10} /> Ver
                    </a>
                  </div>
                </div>
              )}

              <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200">{generatedAsset.title}</p>
                <p className="text-[10px] text-slate-400 mt-0.5 capitalize">{generatedAsset.asset_type?.replace(/_/g, ' ')}</p>
                {generatedAsset.description && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 whitespace-pre-wrap line-clamp-12">{generatedAsset.description}</p>
                )}
              </div>
              {generatedAsset.prompt_used && (
                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Prompt utilizado</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 whitespace-pre-wrap line-clamp-4">{generatedAsset.prompt_used}</p>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <button onClick={() => onMaterialCreated?.(generatedAsset.material_id || generatedAsset.id)} className="flex-1 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 flex items-center justify-center gap-1">
                  <Eye size={12} /> Ver en Biblioteca
                </button>
                <button onClick={() => {
                  const imageUrl = generatedAsset.file_url || generatedAsset.metadata?.image_url || generatedImageUrl;
                  if (imageUrl && generatedAsset.material_id) {
                    setEditingAssetId(generatedAsset.material_id);
                    setEditingImageUrl(imageUrl);
                  }
                }} className="py-2 px-3 bg-amber-50 text-amber-600 text-xs font-bold rounded-lg hover:bg-amber-100 flex items-center justify-center gap-1">
                  <Edit3 size={12} /> Editar
                </button>
                <button onClick={() => {
                  const imageUrl = generatedAsset.file_url || generatedAsset.metadata?.image_url || generatedImageUrl;
                  if (imageUrl) {
                    setShareData({
                      title: generatedAsset.title || title || 'Material generado',
                      imageUrl,
                      clinicalArea,
                      tags: [generatedAsset.asset_type, clinicalArea].filter(Boolean),
                    });
                  }
                }} className="py-2 px-3 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center gap-1">
                  <Share2 size={12} /> Compartir
                </button>
                <button onClick={handleReset} className="py-2 px-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700">
                  Nuevo
                </button>
              </div>
            </div>
          )}

          {!generatedAsset && !generating && (
            <div className="bg-white dark:bg-slate-900 rounded-xl p-8 border border-slate-200 dark:border-slate-700 text-center">
              <Image size={48} className="mx-auto text-slate-300 mb-3" />
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {activeTab === 'ai' && 'Seleccioná una plantilla y generá con IA'}
                {activeTab === 'upload' && 'Subí una foto y la IA la convierte en pictograma'}
                {activeTab === 'sequence' && 'Armá la secuencia de pasos para la familia'}
              </p>
              <p className="text-xs text-slate-400 mt-1">El resultado aparecerá aquí</p>
            </div>
          )}

          {generating && (
            <div className="bg-white dark:bg-slate-900 rounded-xl p-8 border border-slate-200 dark:border-slate-700 text-center">
              <Loader2 size={32} className="animate-spin text-purple-500 mx-auto mb-3" />
              <p className="text-sm text-slate-500 dark:text-slate-400">Generando material con IA...</p>
              <p className="text-xs text-slate-400 mt-1">Esto puede tomar 10-30 segundos</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-start gap-2">
              <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-red-700 dark:text-red-400">Error</p>
                <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{error}</p>
              </div>
            </div>
          )}

          <div className="bg-blue-50 dark:bg-blue-950/20 rounded-xl p-4 border border-blue-100 dark:border-blue-800 space-y-2">
            <h4 className="text-xs font-bold text-blue-700 dark:text-blue-400">Tips</h4>
            <ul className="text-[10px] text-blue-600 dark:text-blue-400 space-y-1">
              <li>• <b>Pictogramas (Sin IA)</b>: Elegí pictogramas locales o ARASAAC → costo $0.00</li>
              <li>• <b>Generar con IA</b>: DreamShaper XL vía Modal → costo ~$0.002-0.005 por imagen</li>
              <li>• <b>Subir Foto</b>: La IA convierte tu foto en pictograma terapéutico</li>
              <li>• <b>Secuencia</b>: Armá guías paso a paso para familias</li>
              <li>• Las acciones (descargar, imprimir, guardar) NO usan IA</li>
              <li>• Solo "Crear Diseño Avanzado con IA" consume Modal/ComfyUI</li>
            </ul>
          </div>

          {/* ComfyUI Deployment Info */}
          {comfyuiAvailable === false && (
            <div className="bg-purple-50 dark:bg-purple-950/20 rounded-xl p-4 border border-purple-100 dark:border-purple-800 space-y-2">
              <h4 className="text-xs font-bold text-purple-700 dark:text-purple-400">Activar Generación de Imágenes</h4>
              <p className="text-[10px] text-purple-600 dark:text-purple-400">Para generar imágenes reales con Stable Diffusion XL:</p>
              <ol className="text-[10px] text-purple-600 dark:text-purple-400 space-y-1 list-decimal list-inside">
                <li>Instalar Modal: <code>pip install modal</code></li>
                <li>Autenticar: <code>modal token new</code></li>
                <li>Deploy: <code>python deploy_comfyui.py</code></li>
                <li>Configurar endpoint en <code>.env.local</code></li>
              </ol>
            </div>
          )}
        </div>

        {/* Canvas Editor Modal */}
        {editingAssetId && editingImageUrl && (
          <MaterialEditor
            materialId={editingAssetId}
            imageUrl={editingImageUrl}
            onClose={() => { setEditingAssetId(null); setEditingImageUrl(null); }}
            onSaved={async () => {
              setEditingAssetId(null);
              setEditingImageUrl(null);
              await onMaterialCreated?.(editingAssetId);
            }}
          />
        )}

        {shareData && (
          <ShareMenu
            material={shareData}
            isOpen={true}
            onClose={() => setShareData(null)}
          />
        )}
      </div>
      )}
    </div>
  );
}

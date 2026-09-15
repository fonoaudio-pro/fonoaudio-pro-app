import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as fabric from 'fabric';
import { 
  Loader2, Save, X, Type, Crop, Sun, Contrast, 
  Trash2, Undo2, Download, ArrowLeft, Share2
} from 'lucide-react';
import { supabase } from '../utils/supabaseClient';
import { MultimediaMaterialService } from '../services/MultimediaMaterialService';
import ShareMenu from './ShareMenu';
import { ShareMaterialInput } from '../utils/shareMaterial';

interface MaterialEditorProps {
  materialId: string;
  imageUrl: string;
  onClose: () => void;
  onSaved: () => void;
}

type Tool = 'select' | 'text' | 'crop' | 'adjust';

export default function MaterialEditor({ materialId, imageUrl, onClose, onSaved }: MaterialEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);
  const [activeTool, setActiveTool] = useState<Tool>('select');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

  // Text state
  const [textColor, setTextColor] = useState('#FFFFFF');
  const [textSize, setTextSize] = useState(32);
  const [textBg, setTextBg] = useState('transparent');
  const [textFont, setTextFont] = useState('Arial');

  // Adjust state
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(0);

  // Crop state
  const [cropActive, setCropActive] = useState(false);
  const cropRectRef = useRef<fabric.Rect | null>(null);

  const CANVAS_WIDTH = 800;
  const CANVAS_HEIGHT = 600;

  const FONTS = [
    'Arial', 'Verdana', 'Helvetica', 'Georgia', 'Times New Roman',
    'Courier New', 'Impact', 'Comic Sans MS'
  ];

  // Initialize canvas
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = new fabric.Canvas(canvasRef.current, {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      backgroundColor: '#f5f5f5',
      selection: true,
    });

    fabricRef.current = canvas;

    // Load image
    const imgEl = new Image();
    imgEl.crossOrigin = 'anonymous';
    imgEl.onload = () => {
      const img = new fabric.Image(imgEl, {
        selectable: true,
        hasControls: true,
        hasBorders: true,
      });

      // Scale to fit canvas
      const scaleX = CANVAS_WIDTH / img.width!;
      const scaleY = CANVAS_HEIGHT / img.height!;
      const scale = Math.min(scaleX, scaleY) * 0.9;
      img.scale(scale);
      img.set({
        left: (CANVAS_WIDTH - img.width! * scale) / 2,
        top: (CANVAS_HEIGHT - img.height! * scale) / 2,
      });

      canvas.add(img);
      canvas.sendToBack(img);
      canvas.renderAll();
      setLoading(false);
    };

    imgEl.onerror = () => {
      setError('Error cargando la imagen');
      setLoading(false);
    };

    imgEl.src = imageUrl;

    return () => {
      canvas.dispose();
      fabricRef.current = null;
    };
  }, [imageUrl]);

  // Apply brightness/contrast filters to background image
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const bgImage = canvas.getObjects().find(obj => obj.type === 'image') as fabric.Image;
    if (!bgImage) return;

    bgImage.filters = [];
    if (brightness !== 0) {
      bgImage.filters.push(new fabric.Image.filters.Brightness({ brightness: brightness / 100 }));
    }
    if (contrast !== 0) {
      bgImage.filters.push(new fabric.Image.filters.Contrast({ contrast: contrast / 100 }));
    }
    bgImage.applyFilters();
    canvas.renderAll();
  }, [brightness, contrast]);

  const addText = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const text = new fabric.IText('Escribí aquí', {
      left: CANVAS_WIDTH / 2,
      top: CANVAS_HEIGHT / 2,
      fontSize: textSize,
      fill: textColor,
      fontFamily: textFont,
      backgroundColor: textBg === 'transparent' ? '' : textBg,
      originX: 'center',
      originY: 'center',
      padding: 8,
      editable: true,
      hasControls: true,
      hasBorders: true,
    });

    canvas.add(text);
    canvas.setActiveObject(text);
    canvas.renderAll();
  }, [textSize, textColor, textFont, textBg]);

  const startCrop = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    // Remove existing crop rect
    if (cropRectRef.current) {
      canvas.remove(cropRectRef.current);
      cropRectRef.current = null;
    }

    const rect = new fabric.Rect({
      left: 100,
      top: 100,
      width: 400,
      height: 300,
      fill: 'rgba(0,0,0,0.3)',
      stroke: '#2196F3',
      strokeWidth: 2,
      strokeDashArray: [5, 5],
      selectable: true,
      hasControls: true,
      hasBorders: true,
      cornerColor: '#2196F3',
      cornerStyle: 'circle',
      transparentCorners: false,
      cornerSize: 10,
      name: '__crop__',
    });

    canvas.add(rect);
    canvas.setActiveObject(rect);
    cropRectRef.current = rect;
    setCropActive(true);
    canvas.renderAll();
  }, []);

  const applyCrop = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas || !cropRectRef.current) return;

    const cropRect = cropRectRef.current;
    const left = cropRect.left!;
    const top = cropRect.top!;
    const width = cropRect.width! * cropRect.scaleX!;
    const height = cropRect.height! * cropRect.scaleY!;

    // Get all objects except crop rect and background image
    const objects = canvas.getObjects().filter(obj => obj.name !== '__crop__' && obj.type !== 'image');

    // Create temp canvas to render cropped area
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d')!;

    // Render the current canvas state to temp canvas
    const dataUrl = canvas.toDataURL({
      format: 'png',
      left: left,
      top: top,
      width: width,
      height: height,
    });

    // Clear canvas and redraw with cropped image
    const img = new Image();
    img.onload = () => {
      canvas.clear();
      canvas.setWidth(width);
      canvas.setHeight(height);
      canvas.setBackgroundColor('#f5f5f5', canvas.renderAll.bind(canvas));

      const fabricImg = new fabric.Image(img, {
        selectable: true,
        hasControls: true,
        hasBorders: true,
      });
      canvas.add(fabricImg);
      canvas.sendToBack(fabricImg);

      // Re-add text objects
      objects.forEach(obj => {
        const cloned = obj.clone();
        cloned.set({
          left: obj.left! - left,
          top: obj.top! - top,
        });
        canvas.add(cloned);
      });

      canvas.renderAll();
      setCropActive(false);
      cropRectRef.current = null;
    };
    img.src = dataUrl;
  }, []);

  const cancelCrop = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas || !cropRectRef.current) return;

    canvas.remove(cropRectRef.current);
    cropRectRef.current = null;
    setCropActive(false);
    canvas.renderAll();
  }, []);

  const deleteSelected = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const active = canvas.getActiveObject();
    if (active && active.type !== 'image') {
      canvas.remove(active);
      canvas.renderAll();
    }
  }, []);

  const undoLast = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const objects = canvas.getObjects();
    if (objects.length > 1) {
      const last = objects[objects.length - 1];
      if (last.type !== 'image') {
        canvas.remove(last);
        canvas.renderAll();
      }
    }
  }, []);

  const handleSave = useCallback(async () => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    setSaving(true);
    setError(null);

    try {
      // Export canvas as PNG data URL
      const dataUrl = canvas.toDataURL({
        format: 'png',
        quality: 1,
        multiplier: 1,
      });

      // Convert to blob
      const response = await fetch(dataUrl);
      const blob = await response.blob();

      // Upload to Supabase Storage
      const fileName = `edited_${materialId}_${Date.now()}.png`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('materials')
        .upload(fileName, blob, {
          contentType: 'image/png',
          upsert: false,
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        setError('Error subiendo imagen editada');
        return;
      }

      // Get signed URL (bucket is private)
      const { data: signedData, error: signedError } = await supabase.storage
        .from('materials')
        .createSignedUrl(fileName, 31536000); // 1 year expiry

      if (signedError) {
        console.error('Signed URL error:', signedError);
        setError('Error generando URL de la imagen');
        return;
      }

      const newImageUrl = signedData.signedUrl;

      // Update material_assets with new file_url
      const { error: updateError } = await supabase
        .from('material_assets')
        .update({
          file_url: newImageUrl,
          metadata: {
            edited_at: new Date().toISOString(),
            original_image_url: imageUrl,
            edit_type: 'in_place_editor',
          },
        })
        .eq('material_id', materialId);

      if (updateError) {
        console.error('Update error:', updateError);
        setError('Error guardando en base de datos');
        return;
      }

      // Also update the materials table url if it's the main reference
      await supabase
        .from('materials')
        .update({ url: newImageUrl })
        .eq('id', materialId);

      onSaved();
    } catch (e: any) {
      console.error('Save error:', e);
      setError(e?.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }, [materialId, imageUrl, onSaved]);

  const downloadImage = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const dataUrl = canvas.toDataURL({ format: 'png', quality: 1 });
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `material_editado_${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/95 flex flex-col">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="p-2 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-all">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h3 className="font-bold text-slate-800 dark:text-white text-sm">Editor de Material</h3>
            <p className="text-[10px] text-slate-400 dark:text-slate-500">Editá, recortá y ajustá tu material</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShareOpen(true)} className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center gap-1">
            <Share2 size={14} /> Compartir
          </button>
          <button onClick={downloadImage} className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center gap-1">
            <Download size={14} /> Descargar
          </button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-1 disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-xs text-red-600 text-center">
          {error}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Toolbar */}
        <div className="w-56 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 p-3 flex flex-col gap-1 shrink-0 overflow-y-auto">
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-2">Herramientas</p>

          {[
            { key: 'select', icon: '🖱️', label: 'Seleccionar' },
            { key: 'text', icon: 'T', label: 'Agregar Texto' },
            { key: 'crop', icon: '✂️', label: 'Recortar' },
            { key: 'adjust', icon: '☀️', label: 'Ajustes' },
          ].map(tool => (
            <button
              key={tool.key}
              onClick={() => {
                setActiveTool(tool.key as Tool);
                if (tool.key === 'text') addText();
                if (tool.key === 'crop') startCrop();
              }}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center gap-2 ${
                activeTool === tool.key
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 border border-transparent'
              }`}
            >
              <span className="text-sm">{tool.icon}</span> {tool.label}
            </button>
          ))}

          <div className="border-t border-slate-100 my-2" />

          {/* Quick actions */}
          <button onClick={deleteSelected} className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 flex items-center gap-2">
            <Trash2 size={14} /> Eliminar seleccionado
          </button>
          <button onClick={undoLast} className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2">
            <Undo2 size={14} /> Deshacer último
          </button>

          <div className="border-t border-slate-100 my-2" />

          {/* Tool-specific options */}
          {activeTool === 'text' && (
            <div className="space-y-3">
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Opciones de Texto</p>
              
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 dark:text-slate-400">Fuente</label>
                <select
                  value={textFont}
                  onChange={e => setTextFont(e.target.value)}
                  className="w-full p-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs"
                >
                  {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 dark:text-slate-400">Tamaño: {textSize}px</label>
                <input
                  type="range"
                  min="12"
                  max="72"
                  value={textSize}
                  onChange={e => setTextSize(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 dark:text-slate-400">Color del texto</label>
                <input
                  type="color"
                  value={textColor}
                  onChange={e => setTextColor(e.target.value)}
                  className="w-full h-8 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 dark:text-slate-400">Fondo del texto</label>
                <div className="flex gap-1">
                  {['transparent', '#000000', '#FFFFFF', '#2196F3', '#4CAF50', '#FF9800', '#F44336'].map(c => (
                    <button
                      key={c}
                      onClick={() => setTextBg(c)}
                      className={`w-6 h-6 rounded border-2 ${textBg === c ? 'border-blue-500' : 'border-slate-200 dark:border-slate-700'}`}
                      style={{ backgroundColor: c === 'transparent' ? 'white' : c }}
                    >
                      {c === 'transparent' && <span className="text-[8px] text-red-500">✕</span>}
                    </button>
                  ))}
                </div>
              </div>

              <button onClick={addText} className="w-full py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700">
                Agregar Texto
              </button>
            </div>
          )}

          {activeTool === 'crop' && (
            <div className="space-y-3">
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Recortar</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Arrastrá los bordes del rectángulo azul para recortar</p>
              {cropActive && (
                <div className="flex gap-2">
                  <button onClick={applyCrop} className="flex-1 py-2 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700">
                    Aplicar
                  </button>
                  <button onClick={cancelCrop} className="flex-1 py-2 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-lg hover:bg-slate-300">
                    Cancelar
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTool === 'adjust' && (
            <div className="space-y-3">
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Ajustes Visuales</p>
              
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Sun size={12} /> Brillo: {brightness}
                </label>
                <input
                  type="range"
                  min="-50"
                  max="50"
                  value={brightness}
                  onChange={e => setBrightness(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Contrast size={12} /> Contraste: {contrast}
                </label>
                <input
                  type="range"
                  min="-50"
                  max="50"
                  value={contrast}
                  onChange={e => setContrast(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              <button
                onClick={() => { setBrightness(0); setContrast(0); }}
                className="w-full py-2 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-lg hover:bg-slate-300"
              >
                Restablecer
              </button>
            </div>
          )}
        </div>

        {/* Canvas Area */}
        <div className="flex-1 flex items-center justify-center bg-slate-800 p-4 overflow-auto">
          {loading ? (
            <div className="flex flex-col items-center gap-3 text-white">
              <Loader2 className="animate-spin" size={32} />
              <p className="text-sm text-slate-300">Cargando imagen...</p>
            </div>
          ) : (
            <div className="relative bg-white dark:bg-slate-900 rounded-lg shadow-2xl overflow-hidden">
              <canvas ref={canvasRef} />
            </div>
          )}
        </div>
      </div>

      {shareOpen && (
        <ShareMenu
          material={{
            title: 'Material editado',
            imageUrl: imageUrl,
          }}
          isOpen={shareOpen}
          onClose={() => setShareOpen(false)}
        />
      )}
    </div>
  );
}

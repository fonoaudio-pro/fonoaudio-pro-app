import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import * as fabric from 'fabric';
import {
  Type, Square, Circle, Image as ImageIcon, Download, Trash2,
  Undo2, Redo2, ZoomIn, ZoomOut, MousePointer, Palette,
  AlignLeft, AlignCenter, AlignRight, Bold, Italic, Underline,
  Copy, Lock, Unlock, ArrowUp, ArrowDown, Search, Layers,
  Pen, Star, Triangle, Minus, Plus, FileText, Frame, Grid,
  FlipHorizontal, FlipVertical, RotateCcw, Crop, Eye, EyeOff,
  ChevronDown, ChevronRight, X, Check, Upload, Save, SplitSquareHorizontal, Globe, ChevronUp,
  Loader2, AlertTriangle, Camera, BookOpen,
} from 'lucide-react';
import NotebookLMSourcesWidget from './NotebookLMSourcesWidget';
import { supabase } from '../utils/supabaseClient';

// ══════════════════════════════════════════════════════════════════
// TYPES & CONSTANTS
// ══════════════════════════════════════════════════════════════════

interface VisualEditorProps {
  onSave?: (dataUrl: string, json: string) => void;
  onLoad?: (json: string) => void;
  initialJson?: string;
  width?: number;
  height?: number;
  title?: string;
}

type SidebarTab = 'templates' | 'elements' | 'assets' | 'text' | 'uploads' | 'layers';

type AssetSource = 'pexels' | 'openverse' | 'undraw' | 'iconscout' | 'arasaac';
type ActiveTool = 'select' | 'text' | 'rect' | 'circle' | 'triangle' | 'line' | 'arrow' | 'star' | 'pen';

interface HistoryState {
  json: string;
  timestamp: number;
}

const CANVAS_PRESETS = [
  { label: 'A4 Horizontal', width: 842, height: 595 },
  { label: 'A4 Vertical', width: 595, height: 842 },
  { label: '16:9', width: 960, height: 540 },
  { label: 'Cuadrado', width: 600, height: 600 },
  { label: 'Custom', width: 800, height: 600 },
];

const GOOGLE_FONTS = [
  'Arial', 'Helvetica', 'Times New Roman', 'Courier New', 'Georgia',
  'Verdana', 'Trebuchet MS', 'Comic Sans MS', 'Impact',
  'Roboto', 'Open Sans', 'Lato', 'Montserrat', 'Poppins',
  'Nunito', 'Raleway', 'Oswald', 'Playfair Display', 'Merriweather',
];

const CLINICAL_TEMPLATES = [
  {
    id: 'ficha_eval',
    name: 'Ficha de Evaluación',
    thumbnail: '📋',
    json: JSON.stringify({
      objects: [
        { type: 'rect', left: 0, top: 0, width: 842, height: 595, fill: '#FFFFFF', selectable: false },
        { type: 'rect', left: 20, top: 20, width: 802, height: 80, fill: '#2563EB', rx: 8, ry: 8 },
        { type: 'textbox', left: 40, top: 35, text: 'FICHA DE EVALUACIÓN FONOAUDIOLÓGICA', fontSize: 24, fill: '#FFFFFF', fontFamily: 'Arial', fontWeight: 'bold' },
        { type: 'rect', left: 20, top: 120, width: 390, height: 455, fill: '#F8FAFC', stroke: '#E2E8F0', strokeWidth: 1, rx: 6, ry: 6 },
        { type: 'textbox', left: 35, top: 135, text: 'DATOS DEL PACIENTE', fontSize: 14, fill: '#2563EB', fontFamily: 'Arial', fontWeight: 'bold' },
        { type: 'textbox', left: 35, top: 165, text: 'Nombre: _______________\nEdad: _____  Sexo: _____\nDiagnóstico: _______________', fontSize: 11, fill: '#334155', fontFamily: 'Arial', width: 360 },
        { type: 'rect', left: 432, top: 120, width: 390, height: 455, fill: '#F8FAFC', stroke: '#E2E8F0', strokeWidth: 1, rx: 6, ry: 6 },
        { type: 'textbox', left: 447, top: 135, text: 'OBSERVACIONES', fontSize: 14, fill: '#2563EB', fontFamily: 'Arial', fontWeight: 'bold' },
        { type: 'textbox', left: 447, top: 165, text: '___________________________________\n___________________________________\n___________________________________', fontSize: 11, fill: '#94A3B8', fontFamily: 'Arial', width: 360 },
      ],
    }),
  },
  {
    id: 'pecs_fase1',
    name: 'PECS Fase 1',
    thumbnail: '🖼️',
    json: JSON.stringify({
      objects: [
        { type: 'rect', left: 0, top: 0, width: 842, height: 595, fill: '#FFFFFF', selectable: false },
        { type: 'rect', left: 20, top: 20, width: 802, height: 60, fill: '#7C3AED', rx: 8, ry: 8 },
        { type: 'textbox', left: 40, top: 32, text: 'SECUENCIA PECS - FASE 1: COMUNICACIÓN FÍSICA', fontSize: 20, fill: '#FFFFFF', fontFamily: 'Arial', fontWeight: 'bold' },
        { type: 'rect', left: 40, top: 100, width: 240, height: 200, fill: '#F3F4F6', stroke: '#D1D5DB', strokeWidth: 2, rx: 12, ry: 12 },
        { type: 'textbox', left: 55, top: 170, text: '1. Interés', fontSize: 16, fill: '#374151', fontFamily: 'Arial', fontWeight: 'bold', textAlign: 'center' },
        { type: 'rect', left: 301, top: 100, width: 240, height: 200, fill: '#F3F4F6', stroke: '#D1D5DB', strokeWidth: 2, rx: 12, ry: 12 },
        { type: 'textbox', left: 316, top: 170, text: '2. Petición', fontSize: 16, fill: '#374151', fontFamily: 'Arial', fontWeight: 'bold', textAlign: 'center' },
        { type: 'rect', left: 562, top: 100, width: 240, height: 200, fill: '#F3F4F6', stroke: '#D1D5DB', strokeWidth: 2, rx: 12, ry: 12 },
        { type: 'textbox', left: 577, top: 170, text: '3. Intercambio', fontSize: 16, fill: '#374151', fontFamily: 'Arial', fontWeight: 'bold', textAlign: 'center' },
        { type: 'textbox', left: 40, top: 330, text: 'Instrucciones: Colocar el objeto de interés en la caja. El paciente debe entregar la tarjeta para solicitarlo.', fontSize: 11, fill: '#6B7280', fontFamily: 'Arial', width: 760 },
      ],
    }),
  },
  {
    id: 'secuencia_rutina',
    name: 'Secuencia de Rutina',
    thumbnail: '🔄',
    json: JSON.stringify({
      objects: [
        { type: 'rect', left: 0, top: 0, width: 842, height: 595, fill: '#FFFFFF', selectable: false },
        { type: 'rect', left: 20, top: 20, width: 802, height: 60, fill: '#059669', rx: 8, ry: 8 },
        { type: 'textbox', left: 40, top: 32, text: 'RUTINA DIARIA - SECUENCIA VISUAL', fontSize: 20, fill: '#FFFFFF', fontFamily: 'Arial', fontWeight: 'bold' },
        { type: 'rect', left: 40, top: 100, width: 170, height: 180, fill: '#ECFDF5', stroke: '#A7F3D0', strokeWidth: 2, rx: 10, ry: 10 },
        { type: 'textbox', left: 50, top: 160, text: '🌅\nDespertar', fontSize: 13, fill: '#065F46', fontFamily: 'Arial', fontWeight: 'bold', textAlign: 'center' },
        { type: 'rect', left: 230, top: 100, width: 170, height: 180, fill: '#ECFDF5', stroke: '#A7F3D0', strokeWidth: 2, rx: 10, ry: 10 },
        { type: 'textbox', left: 240, top: 160, text: '🚿\nBaño', fontSize: 13, fill: '#065F46', fontFamily: 'Arial', fontWeight: 'bold', textAlign: 'center' },
        { type: 'rect', left: 420, top: 100, width: 170, height: 180, fill: '#ECFDF5', stroke: '#A7F3D0', strokeWidth: 2, rx: 10, ry: 10 },
        { type: 'textbox', left: 430, top: 160, text: '🥣\nDesayuno', fontSize: 13, fill: '#065F46', fontFamily: 'Arial', fontWeight: 'bold', textAlign: 'center' },
        { type: 'rect', left: 610, top: 100, width: 170, height: 180, fill: '#ECFDF5', stroke: '#A7F3D0', strokeWidth: 2, rx: 10, ry: 10 },
        { type: 'textbox', left: 620, top: 160, text: '📚\nEscuela', fontSize: 13, fill: '#065F46', fontFamily: 'Arial', fontWeight: 'bold', textAlign: 'center' },
      ],
    }),
  },
  {
    id: 'tarjetas_vocab',
    name: 'Tarjetas de Vocabulario',
    thumbnail: '🃏',
    json: JSON.stringify({
      objects: [
        { type: 'rect', left: 0, top: 0, width: 600, height: 400, fill: '#FFFFFF', selectable: false },
        { type: 'rect', left: 20, top: 20, width: 260, height: 170, fill: '#FEF3C7', stroke: '#F59E0B', strokeWidth: 2, rx: 12, ry: 12 },
        { type: 'textbox', left: 35, top: 85, text: 'Manzana', fontSize: 18, fill: '#92400E', fontFamily: 'Arial', fontWeight: 'bold', textAlign: 'center', width: 230 },
        { type: 'rect', left: 310, top: 20, width: 260, height: 170, fill: '#DBEAFE', stroke: '#3B82F6', strokeWidth: 2, rx: 12, ry: 12 },
        { type: 'textbox', left: 325, top: 85, text: 'Perro', fontSize: 18, fill: '#1E40AF', fontFamily: 'Arial', fontWeight: 'bold', textAlign: 'center', width: 230 },
        { type: 'rect', left: 20, top: 210, width: 260, height: 170, fill: '#D1FAE5', stroke: '#10B981', strokeWidth: 2, rx: 12, ry: 12 },
        { type: 'textbox', left: 35, top: 275, text: 'Casa', fontSize: 18, fill: '#065F46', fontFamily: 'Arial', fontWeight: 'bold', textAlign: 'center', width: 230 },
        { type: 'rect', left: 310, top: 210, width: 260, height: 170, fill: '#FCE7F3', stroke: '#EC4899', strokeWidth: 2, rx: 12, ry: 12 },
        { type: 'textbox', left: 325, top: 275, text: 'Pelota', fontSize: 18, fill: '#9D174D', fontFamily: 'Arial', fontWeight: 'bold', textAlign: 'center', width: 230 },
      ],
    }),
  },
  {
    id: 'semaforo_emociones',
    name: 'Semáforo de Emociones',
    thumbnail: '🚦',
    json: JSON.stringify({
      objects: [
        { type: 'rect', left: 0, top: 0, width: 842, height: 595, fill: '#FFFFFF', selectable: false },
        { type: 'rect', left: 20, top: 20, width: 802, height: 60, fill: '#1E293B', rx: 8, ry: 8 },
        { type: 'textbox', left: 40, top: 32, text: 'SEMAFORO DE EMOCIONES', fontSize: 22, fill: '#FFFFFF', fontFamily: 'Arial', fontWeight: 'bold' },
        { type: 'circle', left: 131, top: 120, radius: 70, fill: '#EF4444', stroke: '#DC2626', strokeWidth: 3 },
        { type: 'textbox', left: 111, top: 195, text: 'PARA\n', fontSize: 16, fill: '#991B1B', fontFamily: 'Arial', fontWeight: 'bold', textAlign: 'center', width: 140 },
        { type: 'textbox', left: 111, top: 220, text: 'Enojo\nFrustración', fontSize: 12, fill: '#6B7280', fontFamily: 'Arial', textAlign: 'center', width: 140 },
        { type: 'circle', left: 331, top: 120, radius: 70, fill: '#EAB308', stroke: '#CA8A04', strokeWidth: 3 },
        { type: 'textbox', left: 311, top: 195, text: 'AVISO\n', fontSize: 16, fill: '#854D0E', fontFamily: 'Arial', fontWeight: 'bold', textAlign: 'center', width: 140 },
        { type: 'textbox', left: 311, top: 220, text: 'Preocupación\nInquietud', fontSize: 12, fill: '#6B7280', fontFamily: 'Arial', textAlign: 'center', width: 140 },
        { type: 'circle', left: 531, top: 120, radius: 70, fill: '#22C55E', stroke: '#16A34A', strokeWidth: 3 },
        { type: 'textbox', left: 511, top: 195, text: 'IR\n', fontSize: 16, fill: '#166534', fontFamily: 'Arial', fontWeight: 'bold', textAlign: 'center', width: 140 },
        { type: 'textbox', left: 511, top: 220, text: 'Calma\nTranquilidad', fontSize: 12, fill: '#6B7280', fontFamily: 'Arial', textAlign: 'center', width: 140 },
        { type: 'textbox', left: 40, top: 310, text: 'Instrucciones: Cuando sientas una emoción fuerte, identificá en qué color del semáforo te encontrás y usá las estrategias aprendidas.', fontSize: 11, fill: '#6B7280', fontFamily: 'Arial', width: 760 },
      ],
    }),
  },
  {
    id: 'agenda_visual',
    name: 'Agenda Visual Diaria',
    thumbnail: '📅',
    json: JSON.stringify({
      objects: [
        { type: 'rect', left: 0, top: 0, width: 595, height: 842, fill: '#FFFFFF', selectable: false },
        { type: 'rect', left: 20, top: 20, width: 555, height: 60, fill: '#7C3AED', rx: 8, ry: 8 },
        { type: 'textbox', left: 40, top: 32, text: 'MI AGENDA DEL DÍA', fontSize: 22, fill: '#FFFFFF', fontFamily: 'Arial', fontWeight: 'bold' },
        { type: 'rect', left: 30, top: 100, width: 535, height: 80, fill: '#F0FDF4', stroke: '#86EFAC', strokeWidth: 2, rx: 8, ry: 8 },
        { type: 'textbox', left: 45, top: 110, text: '1. 🌅 Mañana', fontSize: 18, fill: '#166534', fontFamily: 'Arial', fontWeight: 'bold' },
        { type: 'textbox', left: 45, top: 140, text: 'Despertar, desayunar, prepararse', fontSize: 11, fill: '#6B7280', fontFamily: 'Arial' },
        { type: 'rect', left: 30, top: 195, width: 535, height: 80, fill: '#FEF9C3', stroke: '#FDE047', strokeWidth: 2, rx: 8, ry: 8 },
        { type: 'textbox', left: 45, top: 205, text: '2. 🏫 Escuela / Terapia', fontSize: 18, fill: '#854D0E', fontFamily: 'Arial', fontWeight: 'bold' },
        { type: 'textbox', left: 45, top: 235, text: 'Actividades de aprendizaje', fontSize: 11, fill: '#6B7280', fontFamily: 'Arial' },
        { type: 'rect', left: 30, top: 290, width: 535, height: 80, fill: '#EFF6FF', stroke: '#93C5FD', strokeWidth: 2, rx: 8, ry: 8 },
        { type: 'textbox', left: 45, top: 300, text: '3. 🍽️ Almuerzo', fontSize: 18, fill: '#1E40AF', fontFamily: 'Arial', fontWeight: 'bold' },
        { type: 'textbox', left: 45, top: 330, text: 'Comida y descanso', fontSize: 11, fill: '#6B7280', fontFamily: 'Arial' },
        { type: 'rect', left: 30, top: 385, width: 535, height: 80, fill: '#FFF1F2', stroke: '#FECDD3', strokeWidth: 2, rx: 8, ry: 8 },
        { type: 'textbox', left: 45, top: 395, text: '4. 🎮 Juego / Recreo', fontSize: 18, fill: '#9D174D', fontFamily: 'Arial', fontWeight: 'bold' },
        { type: 'textbox', left: 45, top: 425, text: 'Tiempo libre y diversión', fontSize: 11, fill: '#6B7280', fontFamily: 'Arial' },
        { type: 'rect', left: 30, top: 480, width: 535, height: 80, fill: '#F5F3FF', stroke: '#C4B5FD', strokeWidth: 2, rx: 8, ry: 8 },
        { type: 'textbox', left: 45, top: 490, text: '5. 🌙 Noche', fontSize: 18, fill: '#5B21B6', fontFamily: 'Arial', fontWeight: 'bold' },
        { type: 'textbox', left: 45, top: 520, text: 'Cena, higiene, dormir', fontSize: 11, fill: '#6B7280', fontFamily: 'Arial' },
      ],
    }),
  },
  {
    id: 'tabla_comunicacion',
    name: 'Tabla de Comunicación',
    thumbnail: '🗣️',
    json: JSON.stringify({
      objects: [
        { type: 'rect', left: 0, top: 0, width: 842, height: 595, fill: '#FFFFFF', selectable: false },
        { type: 'rect', left: 20, top: 20, width: 802, height: 60, fill: '#0EA5E9', rx: 8, ry: 8 },
        { type: 'textbox', left: 40, top: 32, text: 'TABLA DE COMUNICACIÓN', fontSize: 22, fill: '#FFFFFF', fontFamily: 'Arial', fontWeight: 'bold' },
        { type: 'rect', left: 30, top: 100, width: 180, height: 100, fill: '#FEE2E2', stroke: '#FCA5A5', strokeWidth: 2, rx: 12, ry: 12 },
        { type: 'textbox', left: 40, top: 140, text: '🔴 QUIERO', fontSize: 16, fill: '#991B1B', fontFamily: 'Arial', fontWeight: 'bold', textAlign: 'center', width: 160 },
        { type: 'rect', left: 220, top: 100, width: 180, height: 100, fill: '#FEF3C7', stroke: '#FCD34D', strokeWidth: 2, rx: 12, ry: 12 },
        { type: 'textbox', left: 230, top: 140, text: '🟡 ESPERAR', fontSize: 16, fill: '#92400E', fontFamily: 'Arial', fontWeight: 'bold', textAlign: 'center', width: 160 },
        { type: 'rect', left: 410, top: 100, width: 180, height: 100, fill: '#D1FAE5', stroke: '#6EE7B7', strokeWidth: 2, rx: 12, ry: 12 },
        { type: 'textbox', left: 420, top: 140, text: '🟢 SÍ', fontSize: 16, fill: '#166534', fontFamily: 'Arial', fontWeight: 'bold', textAlign: 'center', width: 160 },
        { type: 'rect', left: 600, top: 100, width: 222, height: 100, fill: '#DBEAFE', stroke: '#93C5FD', strokeWidth: 2, rx: 12, ry: 12 },
        { type: 'textbox', left: 610, top: 140, text: '🔴 NO QUIERO', fontSize: 16, fill: '#1E40AF', fontFamily: 'Arial', fontWeight: 'bold', textAlign: 'center', width: 202 },
        { type: 'textbox', left: 40, top: 230, text: 'Vocabulario frecuente:', fontSize: 14, fill: '#374151', fontFamily: 'Arial', fontWeight: 'bold' },
        { type: 'rect', left: 30, top: 260, width: 170, height: 70, fill: '#F9FAFB', stroke: '#D1D5DB', strokeWidth: 1, rx: 8, ry: 8 },
        { type: 'textbox', left: 40, top: 285, text: '💧 Agua', fontSize: 14, fill: '#374151', fontFamily: 'Arial', textAlign: 'center', width: 150 },
        { type: 'rect', left: 210, top: 260, width: 170, height: 70, fill: '#F9FAFB', stroke: '#D1D5DB', strokeWidth: 1, rx: 8, ry: 8 },
        { type: 'textbox', left: 220, top: 285, text: '🍎 Comida', fontSize: 14, fill: '#374151', fontFamily: 'Arial', textAlign: 'center', width: 150 },
        { type: 'rect', left: 390, top: 260, width: 170, height: 70, fill: '#F9FAFB', stroke: '#D1D5DB', strokeWidth: 1, rx: 8, ry: 8 },
        { type: 'textbox', left: 400, top: 285, text: '🚽 Baño', fontSize: 14, fill: '#374151', fontFamily: 'Arial', textAlign: 'center', width: 150 },
        { type: 'rect', left: 570, top: 260, width: 170, height: 70, fill: '#F9FAFB', stroke: '#D1D5DB', strokeWidth: 1, rx: 8, ry: 8 },
        { type: 'textbox', left: 580, top: 285, text: '📚 Ayuda', fontSize: 14, fill: '#374151', fontFamily: 'Arial', textAlign: 'center', width: 150 },
        { type: 'rect', left: 30, top: 350, width: 170, height: 70, fill: '#F9FAFB', stroke: '#D1D5DB', strokeWidth: 1, rx: 8, ry: 8 },
        { type: 'textbox', left: 40, top: 375, text: '🏠 Casa', fontSize: 14, fill: '#374151', fontFamily: 'Arial', textAlign: 'center', width: 150 },
        { type: 'rect', left: 210, top: 350, width: 170, height: 70, fill: '#F9FAFB', stroke: '#D1D5DB', strokeWidth: 1, rx: 8, ry: 8 },
        { type: 'textbox', left: 220, top: 375, text: '🚗 Auto', fontSize: 14, fill: '#374151', fontFamily: 'Arial', textAlign: 'center', width: 150 },
        { type: 'rect', left: 390, top: 350, width: 170, height: 70, fill: '#F9FAFB', stroke: '#D1D5DB', strokeWidth: 1, rx: 8, ry: 8 },
        { type: 'textbox', left: 400, top: 375, text: '🧸 Jugar', fontSize: 14, fill: '#374151', fontFamily: 'Arial', textAlign: 'center', width: 150 },
        { type: 'rect', left: 570, top: 350, width: 170, height: 70, fill: '#F9FAFB', stroke: '#D1D5DB', strokeWidth: 1, rx: 8, ry: 8 },
        { type: 'textbox', left: 580, top: 375, text: '😴 Dormir', fontSize: 14, fill: '#374151', fontFamily: 'Arial', textAlign: 'center', width: 150 },
      ],
    }),
  },
];

const ARASAAC_CATEGORIES = [
  { id: 'emociones', label: 'Emociones', icon: '😊', search: 'emoción' },
  { id: 'acciones', label: 'Acciones', icon: '🏃', search: 'acción' },
  { id: 'comunicacion', label: 'Comunicación', icon: '💬', search: 'hablar' },
  { id: 'lenguaje', label: 'Lenguaje', icon: '📝', search: 'letra' },
  { id: 'alimentos', label: 'Alimentos', icon: '🍎', search: 'comida' },
  { id: 'cuerpo', label: 'Cuerpo', icon: '🫁', search: 'cuerpo' },
  { id: 'social', label: 'Social', icon: '👥', search: 'persona' },
  { id: 'escuela', label: 'Escuela', icon: '📚', search: 'escuela' },
  { id: 'cotidiano', label: 'Cotidiano', icon: '🏠', search: 'casa' },
  { id: 'transporte', label: 'Transporte', icon: '🚗', search: 'vehículo' },
];

const PEXELS_CATEGORIES = [
  { id: 'terapia', label: 'Terapia', search: 'therapy session' },
  { id: 'ninos', label: 'Niños', search: 'children playing' },
  { id: 'educacion', label: 'Educación', search: 'education classroom' },
  { id: 'comunicacion', label: 'Comunicación', search: 'communication speaking' },
  { id: 'familia', label: 'Familia', search: 'family together' },
  { id: 'naturaleza', label: 'Naturaleza', search: 'nature landscape' },
  { id: 'colores', label: 'Colores', search: 'colorful objects' },
  { id: 'formas', label: 'Formas', search: 'geometric shapes' },
];

const COLORS = [
  '#000000', '#FFFFFF', '#EF4444', '#F97316', '#EAB308', '#22C55E',
  '#3B82F6', '#8B5CF6', '#EC4899', '#6B7280', '#1E293B', '#F59E0B',
  '#10B981', '#6366F1', '#D946EF', '#06B6D4', '#84CC16', '#F43F5E',
];

const SNAP_THRESHOLD = 8;

// ══════════════════════════════════════════════════════════════════
// MAIN EDITOR COMPONENT
// ══════════════════════════════════════════════════════════════════

const VisualEditor: React.FC<VisualEditorProps> = ({
  onSave,
  onLoad,
  initialJson,
  width: initialWidth = 842,
  height: initialHeight = 595,
  title = 'Material Clínico',
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Canvas state
  const [canvasWidth, setCanvasWidth] = useState(initialWidth);
  const [canvasHeight, setCanvasHeight] = useState(initialHeight);
  const [zoom, setZoom] = useState(100);
  const [activeTool, setActiveTool] = useState<ActiveTool>('select');
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('elements');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Selection state
  const [selectedObj, setSelectedObj] = useState<fabric.Object | null>(null);
  const [selectionType, setSelectionType] = useState<'text' | 'shape' | 'image' | null>(null);

  // Properties
  const [fillColor, setFillColor] = useState('#3B82F6');
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [strokeWidth, setStrokeWidth] = useState(0);
  const [fontSize, setFontSize] = useState(16);
  const [fontFamily, setFontFamily] = useState('Arial');
  const [opacity, setOpacity] = useState(100);

  // Properties panel inputs
  const [propX, setPropX] = useState(0);
  const [propY, setPropY] = useState(0);
  const [propW, setPropW] = useState(0);
  const [propH, setPropH] = useState(0);
  const [propRotation, setPropRotation] = useState(0);

  // History
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Layers
  const [layers, setLayers] = useState<{ id: string; name: string; visible: boolean; locked: boolean }[]>([]);

  // ARASAAC
  const [arasaacQuery, setArasaacQuery] = useState('');
  const [arasaacResults, setArasaacResults] = useState<{ id: number; term: string; imageUrl: string }[]>([]);
  const [arasaacLoading, setArasaacLoading] = useState(false);

  // Assets panel
  const [assetSource, setAssetSource] = useState<AssetSource>('pexels');
  const [assetQuery, setAssetQuery] = useState('');
  const [assetResults, setAssetResults] = useState<{ url: string; thumb: string; alt: string; creator?: string; license?: string; license_version?: string; source_url?: string; provider?: string }[]>([]);
  const [assetLoading, setAssetLoading] = useState(false);
  const [assetError, setAssetError] = useState<string | null>(null);

  // Snapping
  const [snapEnabled, setSnapEnabled] = useState(true);

  // Web images search
  const [webQuery, setWebQuery] = useState('');
  const [webResults, setWebResults] = useState<{ url: string; thumb: string; alt: string }[]>([]);
  const [webLoading, setWebLoading] = useState(false);
  const [webError, setWebError] = useState<string | null>(null);

  // ═══ CANVAS INITIALIZATION ═══
  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = new fabric.Canvas(canvasRef.current, {
      width: canvasWidth,
      height: canvasHeight,
      backgroundColor: '#FFFFFF',
      selection: true,
      preserveObjectStacking: true,
      controlsAboveOverlay: true,
    });

    // Custom selection style
    fabric.Object.prototype.set({
      transparentCorners: false,
      cornerColor: '#3B82F6',
      cornerStrokeColor: '#3B82F6',
      cornerSize: 8,
      cornerStyle: 'circle',
      borderColor: '#3B82F6',
      borderScaleFactor: 1.5,
      padding: 4,
    });

    // Events
    canvas.on('selection:created', handleSelection);
    canvas.on('selection:updated', handleSelection);
    canvas.on('selection:cleared', () => { setSelectedObj(null); setSelectionType(null); });
    canvas.on('object:modified', () => { saveHistory(); updateLayers(); });
    canvas.on('object:added', () => updateLayers());
    canvas.on('object:removed', () => updateLayers());
    canvas.on('object:moving', (e) => { handleSyncProps(e.target); handleSnap(e); });
    canvas.on('object:scaling', (e) => { handleSyncProps(e.target); handleSnap(e); });

    fabricRef.current = canvas;

    // Load initial JSON if provided
    if (initialJson) {
      try {
        const data = JSON.parse(initialJson);
        canvas.loadFromJSON(data).then(() => {
          canvas.renderAll();
          updateLayers();
          saveHistory();
        });
      } catch (e) { console.warn('[Editor] Failed to load initial JSON:', e); }
    } else {
      saveHistory();
    }

    return () => { canvas.dispose(); };
  }, []); // Only run once on mount

  // Handle dynamic resizing without disposing canvas
  useEffect(() => {
    const canvas = fabricRef.current;
    if (canvas) {
      canvas.setDimensions({ width: canvasWidth, height: canvasHeight });
      canvas.renderAll();
    }
  }, [canvasWidth, canvasHeight]);

  // ═══ REFS FOR SHORTCUT HANDLERS ═══
  const undoRef = useRef<(() => void) | null>(null);
  const redoRef = useRef<(() => void) | null>(null);
  const copyObjectRef = useRef<(() => void) | null>(null);
  const pasteObjectRef = useRef<(() => void) | null>(null);
  const duplicateObjectRef = useRef<(() => void) | null>(null);
  const deleteSelectedRef = useRef<(() => void) | null>(null);
  const handleSaveRef = useRef<(() => void) | null>(null);
  const addImageToCanvasRef = useRef<((url: string, name: string) => void) | null>(null);

  // ═══ KEYBOARD SHORTCUTS ═══
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const canvas = fabricRef.current;
      if (!canvas) return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); undoRef.current?.(); }
        if (e.key === 'z' && e.shiftKey) { e.preventDefault(); redoRef.current?.(); }
        if (e.key === 'y') { e.preventDefault(); redoRef.current?.(); }
        if (e.key === 'c') { e.preventDefault(); copyObjectRef.current?.(); }
        if (e.key === 'v') {
          if (clipboardRef.current) {
            e.preventDefault();
            pasteObjectRef.current?.();
          }
          // If no clipboard fabric object, let native paste event handle it
        }
        if (e.key === 'd') { e.preventDefault(); duplicateObjectRef.current?.(); }
        if (e.key === 'a') { e.preventDefault(); canvas.discardActiveObject(); canvas.requestRenderAll(); }
        if (e.key === 's') { e.preventDefault(); handleSaveRef.current?.(); }
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        deleteSelectedRef.current?.();
      }
      if (e.key === 'Escape') {
        canvas.discardActiveObject();
        canvas.requestRenderAll();
        setActiveTool('select');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ═══ CLIPBOARD IMAGE PASTE ═══
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const canvas = fabricRef.current;
      if (!canvas) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
              if (ev.target?.result && addImageToCanvasRef.current) addImageToCanvasRef.current(ev.target.result as string, 'Pegado del portapapeles');
            };
            reader.readAsDataURL(file);
          }
          return;
        }
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  // ═══ SELECTION HANDLER ═══
  const handleSelection = useCallback((e: any) => {
    const obj = e.selected?.[0];
    if (!obj) return;
    setSelectedObj(obj);

    if (obj instanceof fabric.IText || obj instanceof fabric.Textbox) {
      setSelectionType('text');
      setFontSize(obj.fontSize || 16);
      setFontFamily(obj.fontFamily || 'Arial');
    } else if (obj instanceof fabric.Image) {
      setSelectionType('image');
    } else {
      setSelectionType('shape');
    }

    setFillColor((obj.fill as string) || '#3B82F6');
    setStrokeColor((obj.stroke as string) || '#000000');
    setStrokeWidth(obj.strokeWidth || 0);
    setOpacity(Math.round((obj.opacity || 1) * 100));

    // Properties panel
    setPropX(Math.round(obj.left || 0));
    setPropY(Math.round(obj.top || 0));
    setPropW(Math.round((obj.width || 0) * (obj.scaleX || 1)));
    setPropH(Math.round((obj.height || 0) * (obj.scaleY || 1)));
    setPropRotation(Math.round(obj.angle || 0));
  }, []);

  // ═══ SNAP TO GUIDES ═══
  const handleSyncProps = useCallback((obj: any) => {
    if (!obj) return;
    setPropX(Math.round(obj.left || 0));
    setPropY(Math.round(obj.top || 0));
    setPropW(Math.round((obj.width || 0) * (obj.scaleX || 1)));
    setPropH(Math.round((obj.height || 0) * (obj.scaleY || 1)));
    setPropRotation(Math.round(obj.angle || 0));
  }, []);

  const handleSnap = useCallback((e: any) => {
    if (!snapEnabled || !fabricRef.current) return;
    const obj = e.target;
    if (!obj) return;
    const canvas = fabricRef.current;
    const center = canvas.getWidth() / 2;
    const middle = canvas.getHeight() / 2;
    const objLeft = obj.left || 0;
    const objTop = obj.top || 0;
    const objWidth = (obj.width || 0) * (obj.scaleX || 1);
    const objHeight = (obj.height || 0) * (obj.scaleY || 1);

    // Snap to center horizontal
    if (Math.abs(objLeft + objWidth / 2 - center) < SNAP_THRESHOLD) {
      obj.set('left', center - objWidth / 2);
    }
    // Snap to center vertical
    if (Math.abs(objTop + objHeight / 2 - middle) < SNAP_THRESHOLD) {
      obj.set('top', middle - objHeight / 2);
    }
    // Snap to edges
    const edges = [0, canvas.getWidth(), 0, canvas.getHeight()];
    if (Math.abs(objLeft) < SNAP_THRESHOLD) obj.set('left', 0);
    if (Math.abs(objTop) < SNAP_THRESHOLD) obj.set('top', 0);
    if (Math.abs(objLeft + objWidth - canvas.getWidth()) < SNAP_THRESHOLD) obj.set('left', canvas.getWidth() - objWidth);
    if (Math.abs(objTop + objHeight - canvas.getHeight()) < SNAP_THRESHOLD) obj.set('top', canvas.getHeight() - objHeight);
  }, [snapEnabled]);

  // ═══ HISTORY MANAGEMENT ═══
  const saveHistory = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const json = JSON.stringify(canvas.toJSON(['id', 'name', 'selectable', 'hasControls']));
    setHistory(prev => {
      // Truncate redo history when new action occurs
      const newHistory = [...prev.slice(0, historyIndex + 1), { json, timestamp: Date.now() }];
      if (newHistory.length > 50) newHistory.shift();
      return newHistory;
    });
    setHistoryIndex(prev => prev + 1);
    setCanUndo(true);
    setCanRedo(false);
  }, [historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex <= 0) return;
    const canvas = fabricRef.current;
    if (!canvas) return;
    const newIndex = historyIndex - 1;
    if (!history[newIndex]) return;
    canvas.loadFromJSON(JSON.parse(history[newIndex].json)).then(() => {
      canvas.renderAll();
      updateLayers();
      setHistoryIndex(newIndex);
      setCanUndo(newIndex > 0);
      setCanRedo(true);
    });
  }, [historyIndex, history]);
  undoRef.current = undo;

  const redo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    const canvas = fabricRef.current;
    if (!canvas) return;
    const newIndex = historyIndex + 1;
    if (!history[newIndex]) return;
    canvas.loadFromJSON(JSON.parse(history[newIndex].json)).then(() => {
      canvas.renderAll();
      updateLayers();
      setHistoryIndex(newIndex);
      setCanUndo(true);
      setCanRedo(newIndex < history.length - 1);
    });
  }, [historyIndex, history]);
  redoRef.current = redo;

  // ═══ LAYERS ═══
  const updateLayers = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const objs = canvas.getObjects();
    setLayers(objs.map((obj, i) => ({
      id: (obj.get('id') as string) || `layer-${i}`,
      name: (obj.get('name') as string) || `Capa ${i + 1}`,
      visible: obj.visible !== false,
      locked: obj.selectable === false,
    })));
  }, []);

  // ═══ CLIPBOARD ═══
  const clipboardRef = useRef<fabric.Object | null>(null);

  const copyObject = useCallback(() => {
    const canvas = fabricRef.current;
    const obj = canvas?.getActiveObject();
    if (obj) {
      obj.clone().then((cloned: fabric.Object) => { clipboardRef.current = cloned; });
    }
  }, []);

  const pasteObject = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas || !clipboardRef.current) return;
    clipboardRef.current.clone().then((cloned: fabric.Object) => {
      cloned.set({ left: (cloned.left || 0) + 20, top: (cloned.top || 0) + 20 });
      canvas.add(cloned);
      canvas.setActiveObject(cloned);
      canvas.requestRenderAll();
      saveHistory();
    });
  }, [saveHistory]);

  const duplicateObject = useCallback(() => {
    const canvas = fabricRef.current;
    const obj = canvas?.getActiveObject();
    if (!obj) return;
    obj.clone().then((cloned: fabric.Object) => {
      cloned.set({ left: (cloned.left || 0) + 20, top: (cloned.top || 0) + 20 });
      canvas!.add(cloned);
      canvas!.setActiveObject(cloned);
      canvas!.requestRenderAll();
      saveHistory();
    });
  }, [saveHistory]);

  const deleteSelected = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const active = canvas.getActiveObjects();
    if (active.length) {
      active.forEach(obj => canvas.remove(obj));
      canvas.discardActiveObject();
      canvas.requestRenderAll();
      saveHistory();
    }
  }, [saveHistory]);

  copyObjectRef.current = copyObject;
  pasteObjectRef.current = pasteObject;
  duplicateObjectRef.current = duplicateObject;
  deleteSelectedRef.current = deleteSelected;

  // ═══ ADD OBJECTS ═══
  const addShape = useCallback((type: string) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const id = crypto.randomUUID();
    let obj: fabric.Object;
    const center = { left: canvasWidth / 2 - 75, top: canvasHeight / 2 - 50 };

    switch (type) {
      case 'rect':
        obj = new fabric.Rect({ ...center, width: 150, height: 100, fill: fillColor, stroke: strokeColor, strokeWidth, rx: 4, ry: 4 });
        break;
      case 'circle':
        obj = new fabric.Circle({ left: center.left, top: center.top, radius: 60, fill: fillColor, stroke: strokeColor, strokeWidth });
        break;
      case 'triangle':
        obj = new fabric.Triangle({ ...center, width: 150, height: 130, fill: fillColor, stroke: strokeColor, strokeWidth });
        break;
      case 'line':
        obj = new fabric.Line([center.left, center.top + 50, center.left + 200, center.top + 50], { stroke: strokeColor, strokeWidth: Math.max(strokeWidth, 2) });
        break;
      case 'arrow':
        const line = new fabric.Line([0, 0, 150, 0], { stroke: strokeColor, strokeWidth: Math.max(strokeWidth, 2) });
        const head = new fabric.Triangle({ width: 15, height: 15, fill: strokeColor, left: 150, top: -7.5, angle: 90 });
        const group = new fabric.Group([line, head], { ...center });
        obj = group;
        break;
      case 'star': {
        const points: number[] = [];
        const outerR = 50;
        const innerR = 22;
        for (let i = 0; i < 10; i++) {
          const r = i % 2 === 0 ? outerR : innerR;
          const angle = (Math.PI / 5) * i - Math.PI / 2;
          points.push(r * Math.cos(angle), r * Math.sin(angle));
        }
        const starPoints = points.reduce((acc, val, i) => {
          if (i % 2 === 0) { acc.push(val); } else { acc[acc.length - 1] += `,${val}`; }
          return acc;
        }, [] as string[]);
        obj = new fabric.Polygon(
          points.reduce((acc: { x: number; y: number }[], val, i) => {
            if (i % 2 === 0) acc.push({ x: val, y: 0 });
            else acc[acc.length - 1] = { x: acc[acc.length - 1].x, y: val };
            return acc;
          }, []),
          { ...center, fill: fillColor, stroke: strokeColor, strokeWidth }
        );
        break;
      }
      case 'text':
        obj = new fabric.IText('Escribí aquí', { ...center, fontSize, fontFamily, fill: fillColor });
        break;
      default: return;
    }

    obj.set({ id, name: `${type} ${canvas.getObjects().length + 1}` });
    canvas.add(obj);
    canvas.setActiveObject(obj);
    setActiveTool('select');
    saveHistory();
  }, [fillColor, strokeColor, strokeWidth, fontSize, fontFamily, canvasWidth, canvasHeight, saveHistory]);

  // ═══ ADD IMAGE ═══
  const addImageToCanvas = useCallback(async (url: string, name: string) => {
    const canvas = fabricRef.current;
    if (!canvas || !url) return;
    const backendUrl = (import.meta as any).env?.VITE_BACKEND_URL || '';
    const isExternal = url.startsWith('http') && !url.startsWith(backendUrl);
    const finalUrl = isExternal ? `${backendUrl}/api/images/proxy?url=${encodeURIComponent(url)}` : url;
    try {
      const img = await fabric.Image.fromURL(finalUrl, { crossOrigin: 'anonymous' });
      if (!img || !img.width) {
        console.warn('[VisualEditor] Failed to load image:', url);
        return;
      }
      const maxW = canvasWidth * 0.4;
      const maxH = canvasHeight * 0.4;
      const scale = Math.min(maxW / (img.width || 1), maxH / (img.height || 1), 1);
      img.set({
        left: canvasWidth / 2 - ((img.width || 0) * scale) / 2,
        top: canvasHeight / 2 - ((img.height || 0) * scale) / 2,
        scaleX: scale, scaleY: scale,
        id: crypto.randomUUID(), name,
        crossOrigin: 'anonymous',
      });
      canvas.add(img);
      canvas.setActiveObject(img);
      canvas.requestRenderAll();
      saveHistory();
    } catch (e: any) {
      console.error('[Editor] addImageToCanvas failed:', e?.message || e);
    }
  }, [canvasWidth, canvasHeight, saveHistory]);
  addImageToCanvasRef.current = addImageToCanvas;

  // ═══ ARASAAC SEARCH ═══
  const searchArasaac = useCallback(async (query: string) => {
    if (!query.trim()) { setArasaacResults([]); return; }
    setArasaacLoading(true);
    try {
      const resp = await fetch(`https://api.arasaac.org/v1/pictograms/es/bestsearch/${encodeURIComponent(query)}`);
      const data = await resp.json();
      const items = Array.isArray(data) ? data : Array.isArray(data?.pictograms) ? data.pictograms : [];
      const results = items.slice(0, 20).map((p: any) => ({
        id: p._id || p.id,
        term: p.keywords?.[0]?.keyword || p.tags?.[0]?.tag || query,
        imageUrl: `https://static.arasaac.org/pictograms/${p._id || p.id}/${p._id || p.id}_500.png`,
      }));
      setArasaacResults(results);
    } catch (e) {
      console.warn('[ARASAAC] Search failed:', e);
      setArasaacResults([]);
    }
    setArasaacLoading(false);
  }, []);

  const searchWebImages = useCallback(async (query: string) => {
    if (!query.trim()) { setWebResults([]); setWebError(null); return; }
    setWebLoading(true);
    setWebError(null);
    try {
      const backendUrl = (import.meta as any).env?.VITE_BACKEND_URL || '';
      const resp = await fetch(`${backendUrl}/api/images/search?q=${encodeURIComponent(query)}&per_page=20`);
      const data = await resp.json();
      if (!resp.ok) {
        setWebError(data.error || `Error ${resp.status}`);
        setWebResults([]);
      } else {
        setWebResults(data.results || []);
        if ((data.results || []).length === 0) {
          setWebError('Sin resultados. Probá con otro término.');
        }
      }
    } catch (e: any) {
      console.warn('[IMAGES] Search failed:', e);
      setWebError('No se pudo conectar al servidor. Verificá que esté corriendo en localhost:3001');
      setWebResults([]);
    }
    setWebLoading(false);
  }, []);

  // ═══ UNIFIED ASSET SEARCH ═══
  const searchAssets = useCallback(async (source: AssetSource, query: string) => {
    if (!query.trim()) { setAssetResults([]); setAssetError(null); return; }
    setAssetLoading(true);
    setAssetError(null);
    try {
      const backendUrl = (import.meta as any).env?.VITE_BACKEND_URL || '';
      let endpoint = '';
      switch (source) {
        case 'pexels': endpoint = `/api/images/search?q=${encodeURIComponent(query)}&per_page=20`; break;
        case 'openverse': endpoint = `/api/images/openverse?q=${encodeURIComponent(query)}&per_page=20`; break;
        case 'undraw': endpoint = `/api/images/undraw?q=${encodeURIComponent(query)}&per_page=20`; break;
        case 'iconscout': endpoint = `/api/images/iconscout?q=${encodeURIComponent(query)}&per_page=20&asset=illustration`; break;
        case 'arasaac': endpoint = null as any; break;
      }
      if (source === 'arasaac') {
        const resp = await fetch(`https://api.arasaac.org/v1/pictograms/es/bestsearch/${encodeURIComponent(query)}`);
        const data = await resp.json();
        const items = Array.isArray(data) ? data : Array.isArray(data?.pictograms) ? data.pictograms : [];
        const results = items.slice(0, 20).map((p: any) => {
          const pid = p._id || p.id;
          return {
            url: `https://static.arasaac.org/pictograms/${pid}/${pid}_500.png`,
            thumb: `https://static.arasaac.org/pictograms/${pid}/${pid}_300.png`,
            alt: p.keywords?.[0]?.keyword || p.tags?.[0]?.tag || query,
            creator: 'ARASAAC',
            license: 'CC BY-NC-SA',
            source_url: `https://arasaac.org/pictogram/${pid}`,
            provider: 'arasaac',
          };
        });
        setAssetResults(results);
        if (results.length === 0) setAssetError('Sin resultados en ARASAAC');
      } else {
        const resp = await fetch(`${backendUrl}${endpoint}`);
        const data = await resp.json();
        if (!resp.ok) {
          setAssetError(data.error || `Error ${resp.status}`);
          setAssetResults([]);
        } else {
          setAssetResults(data.results || []);
          if ((data.results || []).length === 0) setAssetError(data.note || 'Sin resultados. Probá con otro término.');
        }
      }
    } catch (e: any) {
      console.warn('[ASSETS] Search failed:', e);
      setAssetError('No se pudo conectar al servidor');
      setAssetResults([]);
    }
    setAssetLoading(false);
  }, []);

  // ═══ PROPERTY UPDATES ═══
  const updateProp = useCallback((prop: string, value: any) => {
    const canvas = fabricRef.current;
    const obj = canvas?.getActiveObject();
    if (!obj) return;
    obj.set(prop, value);
    canvas?.requestRenderAll();
  }, []);

  // ═══ EXPORT ═══
  const handleExport = useCallback((format: 'png' | 'jpg' | 'pdf') => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    if (format === 'png' || format === 'jpg') {
      const dataUrl = canvas.toDataURL({ format: format === 'jpg' ? 'jpeg' : 'png', quality: 1, multiplier: 2 });
      const link = document.createElement('a');
      link.download = `${title}.${format}`;
      link.href = dataUrl;
      link.click();
    } else if (format === 'pdf') {
      // PDF export - use PNG format with proper naming
      const dataUrl = canvas.toDataURL({ format: 'png', quality: 1, multiplier: 2 });
      const link = document.createElement('a');
      link.download = `${title}_imagen.png`;
      link.href = dataUrl;
      link.click();
      window.dispatchEvent(new CustomEvent('fonoaudio-toast', {
        detail: { message: 'Imagen exportada. Para PDF, usá un conversor externo.', type: 'info' }
      }));
    }
  }, [title]);

  // ═══ SAVE ═══
  const handleSave = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas || !onSave) return;
    const dataUrl = canvas.toDataURL({ format: 'png', quality: 1, multiplier: 2 });
    const json = JSON.stringify(canvas.toJSON(['id', 'name', 'selectable', 'hasControls']));
    onSave(dataUrl, json);
  }, [onSave]);
  handleSaveRef.current = handleSave;

  // ═══ ZOOM ═══
  const handleZoom = useCallback((delta: number) => {
    setZoom(prev => {
      const next = Math.max(25, Math.min(400, prev + delta));
      const canvas = fabricRef.current;
      if (canvas) {
        canvas.setZoom(next / 100);
        canvas.setWidth(canvasWidth * (next / 100));
        canvas.setHeight(canvasHeight * (next / 100));
        canvas.requestRenderAll();
      }
      return next;
    });
  }, [canvasWidth, canvasHeight]);

  // ═══ RENDER ═══
  return (
    <div className="flex flex-col h-full bg-slate-100 dark:bg-slate-950 overflow-hidden">
      {/* ─── TOP TOOLBAR ─── */}
      <div className="h-9 md:h-10 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center px-1.5 md:px-2 gap-0.5 md:gap-1 shrink-0 overflow-x-auto scrollbar-none">
        {/* Sidebar toggle */}
        <ToolBtn icon={<Layers size={14} />} active={sidebarOpen} onClick={() => setSidebarOpen(!sidebarOpen)} title="Panel lateral" />
        <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-0.5" />

        {/* History */}
        <ToolBtn icon={<Undo2 size={14} />} onClick={undo} disabled={!canUndo} title="Deshacer (Ctrl+Z)" />
        <ToolBtn icon={<Redo2 size={14} />} onClick={redo} disabled={!canRedo} title="Rehacer (Ctrl+Shift+Z)" />
        <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-0.5" />

        {/* Tools */}
        <ToolBtn icon={<MousePointer size={14} />} active={activeTool === 'select'} onClick={() => setActiveTool('select')} title="Seleccionar (V)" />
        <ToolBtn icon={<Type size={14} />} active={activeTool === 'text'} onClick={() => { setActiveTool('text'); addShape('text'); }} title="Texto (T)" />
        <ToolBtn icon={<Pen size={14} />} active={activeTool === 'pen'} onClick={() => {
          const canvas = fabricRef.current;
          if (!canvas) return;
          const newTool = activeTool === 'pen' ? 'select' : 'pen';
          setActiveTool(newTool);
          canvas.isDrawingMode = newTool === 'pen';
          if (canvas.isDrawingMode) {
            canvas.freeDrawingBrush = new (fabric as any).PencilBrush(canvas);
            canvas.freeDrawingBrush.width = 2;
            canvas.freeDrawingBrush.color = strokeColor;
          }
        }} title="Lápiz" />
        <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-0.5" />

        {/* Contextual: Text properties */}
        {selectionType === 'text' && (
          <>
            <select value={fontFamily} onChange={(e) => { setFontFamily(e.target.value); updateProp('fontFamily', e.target.value); }}
              className="h-6 px-1 text-[10px] border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-white max-w-[80px] md:max-w-[100px]">
              {GOOGLE_FONTS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            <input type="number" value={fontSize} onChange={(e) => { const v = parseInt(e.target.value) || 12; setFontSize(v); updateProp('fontSize', v); }}
              className="h-6 w-10 px-1 text-[10px] text-center border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-white" />
            <ToolBtn icon={<Bold size={14} />} onClick={() => updateProp('fontWeight', (selectedObj?.get('fontWeight') === 'bold') ? 'normal' : 'bold')} title="Negrita" />
            <ToolBtn icon={<Italic size={14} />} onClick={() => updateProp('fontStyle', (selectedObj?.get('fontStyle') === 'italic') ? 'normal' : 'italic')} title="Itálica" />
            <ToolBtn icon={<Underline size={14} />} onClick={() => updateProp('underline', !(selectedObj?.get('underline')))} title="Subrayado" />
            <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-0.5 hidden md:block" />
            <div className="hidden md:flex items-center gap-0.5">
              <ToolBtn icon={<AlignLeft size={14} />} onClick={() => updateProp('textAlign', 'left')} title="Izquierda" />
              <ToolBtn icon={<AlignCenter size={14} />} onClick={() => updateProp('textAlign', 'center')} title="Centro" />
              <ToolBtn icon={<AlignRight size={14} />} onClick={() => updateProp('textAlign', 'right')} title="Derecha" />
            </div>
            <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-0.5" />
          </>
        )}

        {/* Contextual: Shape/Image properties */}
        {(selectionType === 'shape' || selectionType === 'image') && (
          <>
            <label className="hidden md:flex items-center gap-1 text-[10px] text-slate-500">
              <div className="w-4 h-4 rounded border border-slate-300 cursor-pointer" style={{ backgroundColor: fillColor }}
                onClick={() => {}} />
              Relleno
            </label>
            <input type="color" value={fillColor} onChange={(e) => { setFillColor(e.target.value); updateProp('fill', e.target.value); }}
              className="w-5 h-5 cursor-pointer border-0 p-0" />
            <label className="hidden md:flex items-center gap-1 text-[10px] text-slate-500">
              <div className="w-4 h-4 rounded border border-slate-300 cursor-pointer" style={{ backgroundColor: strokeColor }}
                onClick={() => {}} />
              Borde
            </label>
            <input type="color" value={strokeColor} onChange={(e) => { setStrokeColor(e.target.value); updateProp('stroke', e.target.value); }}
              className="w-5 h-5 cursor-pointer border-0 p-0" />
            <input type="number" value={strokeWidth} min={0} max={20}
              onChange={(e) => { const v = parseInt(e.target.value) || 0; setStrokeWidth(v); updateProp('strokeWidth', v); }}
              className="h-6 w-10 px-1 text-[10px] text-center border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-white" />
            <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-0.5" />
          </>
        )}

        {/* Opacity (always visible when selection) */}
        {selectedObj && (
          <>
            <label className="hidden md:inline text-[10px] text-slate-500">Opacidad</label>
            <input type="range" min={0} max={100} value={opacity}
              onChange={(e) => { const v = parseInt(e.target.value); setOpacity(v); updateProp('opacity', v / 100); }}
              className="w-12 md:w-16 h-4" />
            <span className="text-[10px] text-slate-400 w-6">{opacity}%</span>
            <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-0.5" />
          </>
        )}

        {/* Object actions */}
        {selectedObj && (
          <>
            <ToolBtn icon={<Copy size={14} />} onClick={duplicateObject} title="Duplicar (Ctrl+D)" />
            <ToolBtn icon={<Trash2 size={14} />} onClick={deleteSelected} title="Eliminar (Del)" />
            <ToolBtn icon={selectedObj.selectable === false ? <Lock size={14} /> : <Unlock size={14} />}
              onClick={() => { updateProp('selectable', selectedObj.selectable !== false ? false : true); updateProp('hasControls', selectedObj.selectable !== false ? false : true); updateLayers(); }}
              title={selectedObj.selectable === false ? 'Desbloquear' : 'Bloquear'} />
            <ToolBtn icon={<ArrowUp size={14} />} onClick={() => { const c = fabricRef.current; if (c) { const o = c.getActiveObject(); if (o) { c.bringObjectForward(o); updateLayers(); }}}} title="Traer adelante" />
            <ToolBtn icon={<ArrowDown size={14} />} onClick={() => { const c = fabricRef.current; if (c) { const o = c.getActiveObject(); if (o) { c.sendObjectBackwards(o); updateLayers(); }}}} title="Enviar atrás" />

            {/* Group/Ungroup */}
            {selectionType !== 'text' && (() => {
              const c = fabricRef.current;
              const active = c?.getActiveObject();
              const isGroup = active && active.type === 'activeSelection';
              return (
                <>
                  <ToolBtn
                    icon={<Layers size={14} />}
                    onClick={() => {
                      if (!c || !active || active.type !== 'activeSelection') return;
                      try { active.toGroup(); c.requestRenderAll(); saveHistory(); updateLayers(); } catch {}
                    }}
                    disabled={!isGroup}
                    title="Agrupar selección"
                  />
                  <ToolBtn
                    icon={<SplitSquareHorizontal size={14} />}
                    onClick={() => {
                      if (!c || !active || active.type !== 'group') return;
                      try { active.toActiveSelection(); c.requestRenderAll(); saveHistory(); updateLayers(); } catch {}
                    }}
                    disabled={!active || active.type !== 'group'}
                    title="Desagrupar"
                  />
                </>
              );
            })()}

            {/* Object Alignment - hidden on mobile */}
            <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-0.5 hidden lg:block" />
            <div className="hidden lg:flex items-center gap-0.5">
              <ToolBtn icon={<AlignLeft size={14} />} onClick={() => {
                const c = fabricRef.current; const o = c?.getActiveObject();
                if (o) { o.set('left', 0); c?.requestRenderAll(); saveHistory(); setPropX(0); }
              }} title="Alinear izquierda" />
              <ToolBtn icon={<AlignCenter size={14} />} onClick={() => {
                const c = fabricRef.current; const o = c?.getActiveObject();
                if (o) { o.set('left', (canvasWidth - (o.width || 0) * (o.scaleX || 1)) / 2); c?.requestRenderAll(); saveHistory(); setPropX(Math.round(o.left || 0)); }
              }} title="Centrar horizontal" />
              <ToolBtn icon={<AlignRight size={14} />} onClick={() => {
                const c = fabricRef.current; const o = c?.getActiveObject();
                if (o) { o.set('left', canvasWidth - (o.width || 0) * (o.scaleX || 1)); c?.requestRenderAll(); saveHistory(); setPropX(Math.round(o.left || 0)); }
              }} title="Alinear derecha" />
              <ToolBtn icon={<ArrowUp size={14} />} onClick={() => {
                const c = fabricRef.current; const o = c?.getActiveObject();
                if (o) { o.set('top', 0); c?.requestRenderAll(); saveHistory(); setPropY(0); }
              }} title="Alinear arriba" />
              <ToolBtn icon={<ArrowDown size={14} />} onClick={() => {
                const c = fabricRef.current; const o = c?.getActiveObject();
                if (o) { o.set('top', canvasHeight - (o.height || 0) * (o.scaleY || 1)); c?.requestRenderAll(); saveHistory(); setPropY(Math.round(o.top || 0)); }
              }} title="Alinear abajo" />
            </div>

            <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-0.5" />
          </>
        )}

        {/* Snap + Zoom */}
        <ToolBtn icon={<Grid size={14} />} active={snapEnabled} onClick={() => setSnapEnabled(!snapEnabled)} title="Snap a guías" />
        <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-0.5" />

        {/* Canvas Presets */}
        <select value={`${canvasWidth}x${canvasHeight}`}
          onChange={(e) => {
            const [w, h] = e.target.value.split('x').map(Number);
            setCanvasWidth(w);
            setCanvasHeight(h);
          }}
          className="h-6 px-1 text-[9px] border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-white max-w-[70px] md:max-w-[90px]">
          {CANVAS_PRESETS.map(p => (
            <option key={p.label} value={`${p.width}x${p.height}`}>{p.label}</option>
          ))}
        </select>
        <div className="w-px h-5 bg-slate-200 dark:border-slate-700 mx-0.5" />

        {/* Flip - hidden on small screens */}
        {selectedObj && (
          <>
            <div className="hidden md:flex items-center gap-0.5">
              <ToolBtn icon={<FlipHorizontal size={14} />} onClick={() => updateProp('flipX', !selectedObj.flipX)} title="Voltear horizontal" />
              <ToolBtn icon={<FlipVertical size={14} />} onClick={() => updateProp('flipY', !selectedObj.flipY)} title="Voltear vertical" />
            </div>
            <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-0.5 hidden md:block" />
          </>
        )}

        {/* Zoom */}
        <ToolBtn icon={<ZoomOut size={14} />} onClick={() => handleZoom(-10)} title="Zoom out" />
        <span className="text-[10px] text-slate-500 w-8 text-center">{zoom}%</span>
        <ToolBtn icon={<ZoomIn size={14} />} onClick={() => handleZoom(10)} title="Zoom in" />
        <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-0.5" />

        {/* Export */}
        <ToolBtn icon={<Download size={14} />} onClick={() => handleExport('png')} title="Exportar PNG" />
        <ToolBtn icon={<FileText size={14} />} onClick={() => handleExport('pdf')} title="Exportar PDF" />
        <button onClick={handleSave} className="h-7 px-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-[10px] font-bold transition-colors flex items-center gap-1 shrink-0">
          <Save size={10} /> <span className="hidden sm:inline">Guardar</span>
        </button>
      </div>

      <div className="flex flex-1 min-h-0 relative">
        {/* Mobile backdrop for sidebar */}
        {sidebarOpen && (
          <div className="fixed inset-0 bg-black/30 z-30 md:hidden" onClick={() => setSidebarOpen(false)} />
        )}

        {/* ─── LEFT SIDEBAR ─── */}
        <div className={`${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} fixed md:relative inset-y-0 left-0 z-40 md:z-auto w-64 md:w-52 lg:w-56 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0 overflow-hidden transition-transform duration-200 ease-in-out ${sidebarOpen ? 'md:translate-x-0' : 'md:hidden'}`}>
            {/* Sidebar tabs */}
            <div className="flex border-b border-slate-200 dark:border-slate-800">
              {([
                { id: 'elements' as SidebarTab, icon: <Square size={12} />, label: 'Elem.' },
                { id: 'templates' as SidebarTab, icon: <FileText size={12} />, label: 'Plant.' },
                { id: 'assets' as SidebarTab, icon: <ImageIcon size={12} />, label: 'Recursos' },
                { id: 'text' as SidebarTab, icon: <Type size={12} />, label: 'Texto' },
                { id: 'uploads' as SidebarTab, icon: <Upload size={12} />, label: 'Subir' },
                { id: 'layers' as SidebarTab, icon: <Layers size={12} />, label: 'Capas' },
              ]).map(tab => (
                <button key={tab.id} onClick={() => setSidebarTab(tab.id)}
                  className={`flex-1 py-1.5 text-[9px] font-bold flex flex-col items-center gap-0.5 transition-colors
                    ${sidebarTab === tab.id ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600' : 'text-slate-400 hover:text-slate-600'}`}>
                  {tab.icon}{tab.label}
                </button>
              ))}
            </div>

            {/* Sidebar content */}
            <div className="flex-1 overflow-y-auto p-2 space-y-2">
              {/* ── ELEMENTS ── */}
              {sidebarTab === 'elements' && (
                <div className="space-y-2">
                  <SidebarSection title="Formas">
                    <div className="grid grid-cols-4 gap-1">
                      {[
                        { icon: <Square size={18} />, action: () => addShape('rect'), label: 'Rect' },
                        { icon: <Circle size={18} />, action: () => addShape('circle'), label: 'Circ' },
                        { icon: <Triangle size={18} />, action: () => addShape('triangle'), label: 'Tri' },
                        { icon: <Star size={18} />, action: () => addShape('star'), label: 'Estrella' },
                        { icon: <Minus size={18} />, action: () => addShape('line'), label: 'Línea' },
                        { icon: <ArrowUp size={18} />, action: () => addShape('arrow'), label: 'Flecha' },
                        { icon: <SplitSquareHorizontal size={18} />, action: () => addShape('rect'), label: 'Marco' },
                        { icon: <Frame size={18} />, action: () => addShape('rect'), label: 'Cuadro' },
                      ].map((item, i) => (
                        <button key={i} onClick={item.action}
                          className="aspect-square flex flex-col items-center justify-center gap-0.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                          title={item.label}>
                          {item.icon}
                          <span className="text-[7px]">{item.label}</span>
                        </button>
                      ))}
                    </div>
                  </SidebarSection>

                  <SidebarSection title="Colores">
                    <div className="grid grid-cols-6 gap-1">
                      {COLORS.map(c => (
                        <button key={c} onClick={() => { setFillColor(c); updateProp('fill', c); }}
                          className="w-full aspect-square rounded border border-slate-200 dark:border-slate-700 hover:scale-110 transition-transform"
                          style={{ backgroundColor: c }} title={c} />
                      ))}
                    </div>
                  </SidebarSection>
                </div>
              )}

              {/* ── TEMPLATES ── */}
              {sidebarTab === 'templates' && (
                <div className="space-y-2">
                  {CLINICAL_TEMPLATES.map(tmpl => (
                    <button key={tmpl.id} onClick={() => {
                      const canvas = fabricRef.current;
                      if (!canvas) return;
                      canvas.loadFromJSON(JSON.parse(tmpl.json)).then(() => { canvas.renderAll(); updateLayers(); saveHistory(); });
                    }}
                      className="w-full p-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-700 text-left transition-colors">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{tmpl.thumbnail}</span>
                        <span className="text-[10px] font-bold text-slate-700 dark:text-slate-200">{tmpl.name}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* ── ASSETS (unified resource panel) ── */}
              {sidebarTab === 'assets' && (
                <div className="space-y-2">
                  {/* Source selector */}
                  <div className="flex gap-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5 flex-wrap">
                    <button onClick={() => { setAssetSource('pexels'); setAssetResults([]); setAssetError(null); }}
                      className={`flex-1 flex items-center justify-center gap-1 py-1 rounded text-[9px] font-bold transition-colors min-w-[60px]
                        ${assetSource === 'pexels' ? 'bg-emerald-600 text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>
                      <Camera size={10} /> Fotos
                    </button>
                    <button onClick={() => { setAssetSource('openverse'); setAssetResults([]); setAssetError(null); }}
                      className={`flex-1 flex items-center justify-center gap-1 py-1 rounded text-[9px] font-bold transition-colors min-w-[60px]
                        ${assetSource === 'openverse' ? 'bg-purple-600 text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>
                      <Palette size={10} /> Clipart
                    </button>
                    <button onClick={() => { setAssetSource('undraw'); setAssetResults([]); setAssetError(null); }}
                      className={`flex-1 flex items-center justify-center gap-1 py-1 rounded text-[9px] font-bold transition-colors min-w-[60px]
                        ${assetSource === 'undraw' ? 'bg-rose-600 text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>
                      <FileText size={10} /> SVG
                    </button>
                    <button onClick={() => { setAssetSource('iconscout'); setAssetResults([]); setAssetError(null); }}
                      className={`flex-1 flex items-center justify-center gap-1 py-1 rounded text-[9px] font-bold transition-colors min-w-[60px]
                        ${assetSource === 'iconscout' ? 'bg-violet-600 text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>
                      <Star size={10} /> 3D/Diseño
                    </button>
                    <button onClick={() => { setAssetSource('arasaac'); setAssetResults([]); setAssetError(null); }}
                      className={`flex-1 flex items-center justify-center gap-1 py-1 rounded text-[9px] font-bold transition-colors min-w-[60px]
                        ${assetSource === 'arasaac' ? 'bg-sky-600 text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>
                      <Search size={10} /> Picto.
                    </button>
                  </div>

                  {/* Source description */}
                  <p className="text-[9px] text-slate-400 dark:text-slate-500">
                    {assetSource === 'pexels' && 'Fotos e ilustraciones generales — Pexels License'}
                    {assetSource === 'openverse' && 'Clipart, dibujos e imágenes abiertas — Creative Commons'}
                    {assetSource === 'undraw' && 'Ilustraciones SVG minimalistas — MIT License'}
                    {assetSource === 'iconscout' && 'Ilustraciones, 3D y vectores — IconScout License (2000 créditos/mes)'}
                    {assetSource === 'arasaac' && 'Pictogramas y material logopédico — CC BY-NC-SA'}
                  </p>

                  {/* Search input */}
                  <div className="flex gap-1">
                    <input value={assetQuery} onChange={(e) => setAssetQuery(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') searchAssets(assetSource, assetQuery); }}
                      placeholder={`Buscar en ${assetSource === 'pexels' ? 'fotos' : assetSource === 'openverse' ? 'clipart' : assetSource === 'undraw' ? 'ilustraciones SVG' : assetSource === 'iconscout' ? 'ilustraciones/3D' : 'pictogramas'}...`}
                      className="flex-1 px-2 py-1 text-[10px] border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-white" />
                    <button onClick={() => searchAssets(assetSource, assetQuery)}
                      disabled={assetLoading}
                      className="px-2 py-1 bg-slate-600 text-white rounded text-[10px] disabled:opacity-50">
                      {assetLoading ? <Loader2 size={10} className="animate-spin" /> : <Search size={10} />}
                    </button>
                  </div>

                  {/* Category chips */}
                  <div className="flex flex-wrap gap-1">
                    {assetSource === 'pexels' && PEXELS_CATEGORIES.map(cat => (
                      <button key={cat.id} onClick={() => { setAssetQuery(cat.search); searchAssets('pexels', cat.search); }}
                        className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-[9px] rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700">
                        {cat.label}
                      </button>
                    ))}
                    {assetSource === 'openverse' && [
                      { id: 'ilustracion', label: 'Ilustración', search: 'illustration' },
                      { id: 'clipart', label: 'Clipart', search: 'clipart' },
                      { id: 'animales', label: 'Animales', search: 'animal' },
                      { id: 'ninos', label: 'Niños', search: 'children' },
                      { id: 'colorear', label: 'Colorear', search: 'coloring page' },
                      { id: 'vectores', label: 'Vectores', search: 'vector' },
                    ].map(cat => (
                      <button key={cat.id} onClick={() => { setAssetQuery(cat.search); searchAssets('openverse', cat.search); }}
                        className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-[9px] rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700">
                        {cat.label}
                      </button>
                    ))}
                    {assetSource === 'undraw' && [
                      { id: 'doctor', label: 'Médico', search: 'doctor' },
                      { id: 'education', label: 'Educación', search: 'education' },
                      { id: 'family', label: 'Familia', search: 'family' },
                      { id: 'children', label: 'Niños', search: 'children' },
                      { id: 'health', label: 'Salud', search: 'health' },
                      { id: 'communication', label: 'Comunicación', search: 'communication' },
                    ].map(cat => (
                      <button key={cat.id} onClick={() => { setAssetQuery(cat.search); searchAssets('undraw', cat.search); }}
                        className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-[9px] rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700">
                        {cat.label}
                      </button>
                    ))}
                    {assetSource === 'iconscout' && [
                      { id: 'ilustracion', label: 'Ilustración', search: 'illustration' },
                      { id: '3d', label: '3D', search: '3d' },
                      { id: 'infantil', label: 'Infantil', search: 'kids children' },
                      { id: 'animales', label: 'Animales', search: 'animal' },
                      { id: 'vectores', label: 'Vectores', search: 'vector' },
                      { id: 'colorear', label: 'Colorear', search: 'coloring' },
                    ].map(cat => (
                      <button key={cat.id} onClick={() => { setAssetQuery(cat.search); searchAssets('iconscout', cat.search); }}
                        className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-[9px] rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700">
                        {cat.label}
                      </button>
                    ))}
                    {assetSource === 'arasaac' && ARASAAC_CATEGORIES.map(cat => (
                      <button key={cat.id} onClick={() => { setAssetQuery(cat.search); searchAssets('arasaac', cat.search); }}
                        className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-[9px] rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700">
                        {cat.icon} {cat.label}
                      </button>
                    ))}
                  </div>

                  {/* Error */}
                  {assetError && (
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-2">
                      <p className="text-[10px] text-amber-700 dark:text-amber-300 flex items-center gap-1">
                        <AlertTriangle size={10} /> {assetError}
                      </p>
                    </div>
                  )}

                  {/* Loading */}
                  {assetLoading && <p className="text-[10px] text-slate-400 text-center">Buscando...</p>}

                  {/* Empty state */}
                  {!assetLoading && !assetError && assetResults.length === 0 && (
                    <p className="text-[10px] text-slate-400 text-center">Escribí un término y presioná Enter</p>
                  )}

                  {/* Results grid */}
                  <div className={`grid gap-1 ${assetSource === 'arasaac' ? 'grid-cols-3' : 'grid-cols-2'}`}>
                    {assetResults.map((img, i) => (
                      <button key={i} onClick={() => addImageToCanvas(img.url, img.alt)}
                        className="aspect-square bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded overflow-hidden hover:border-blue-400 transition-colors group relative">
                        <img src={img.thumb} alt={img.alt} className="w-full h-full object-cover" crossOrigin="anonymous"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                        {/* Attribution badge */}
                        {img.creator && (
                          <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[7px] px-1 py-0.5 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                            {img.creator} • {img.license}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* NotebookLM quick link */}
                  <div className="border-t border-slate-200 dark:border-slate-700 pt-2">
                    <p className="text-[9px] text-slate-400 dark:text-slate-500 mb-1">Fuentes clínicas (NotebookLM)</p>
                    <NotebookLMSourcesWidget onAddTextToCanvas={(text) => {
                      const canvas = fabricRef.current;
                      if (!canvas) return;
                      const obj = new fabric.IText(text, {
                        left: canvasWidth / 2, top: canvasHeight / 2,
                        fontSize: 14, fontFamily: 'Inter', fill: '#1e293b',
                        originX: 'center', originY: 'center',
                        id: crypto.randomUUID(), name: 'Fuente clínica',
                      });
                      canvas.add(obj);
                      canvas.setActiveObject(obj);
                      canvas.requestRenderAll();
                      saveHistory();
                    }} />
                  </div>
                </div>
              )}

              {/* ── TEXT ── */}
              {sidebarTab === 'text' && (
                <div className="space-y-2">
                  {[
                    { label: 'Título', size: 32, weight: 'bold' },
                    { label: 'Subtítulo', size: 22, weight: 'bold' },
                    { label: 'Cuerpo', size: 14, weight: 'normal' },
                    { label: 'Pequeño', size: 10, weight: 'normal' },
                  ].map(t => (
                    <button key={t.label} onClick={() => {
                      const canvas = fabricRef.current;
                      if (!canvas) return;
                      const obj = new fabric.IText(t.label === 'Título' ? 'Título' : t.label === 'Subtítulo' ? 'Subtítulo' : 'Texto', {
                        left: canvasWidth / 2 - 100, top: canvasHeight / 2 - 20,
                        fontSize: t.size, fontFamily: 'Arial', fontWeight: t.weight as any, fill: '#000000',
                        id: crypto.randomUUID(), name: `Texto ${t.label}`,
                      });
                      canvas.add(obj); canvas.setActiveObject(obj); saveHistory();
                    }}
                      className="w-full p-2 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 rounded border border-slate-200 dark:border-slate-700 text-left transition-colors">
                      <p style={{ fontSize: Math.min(t.size, 18), fontWeight: t.weight }} className="text-slate-700 dark:text-slate-200">{t.label}</p>
                      <p className="text-[9px] text-slate-400">{t.size}px · {t.weight}</p>
                    </button>
                  ))}
                </div>
              )}

              {/* ── UPLOADS ── */}
              {sidebarTab === 'uploads' && (
                <div className="space-y-2">
                  <label 
                    className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-all hover:border-blue-400"
                    onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-blue-400', 'bg-blue-50', 'dark:bg-blue-900/20'); }}
                    onDragLeave={(e) => { e.currentTarget.classList.remove('border-blue-400', 'bg-blue-50', 'dark:bg-blue-900/20'); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.remove('border-blue-400', 'bg-blue-50', 'dark:bg-blue-900/20');
                      const file = e.dataTransfer.files?.[0];
                      if (file && file.type.startsWith('image/')) {
                        const reader = new FileReader();
                        reader.onload = (ev) => { if (ev.target?.result) addImageToCanvas(ev.target.result as string, file.name); };
                        reader.readAsDataURL(file);
                      }
                    }}
                  >
                    <Upload size={20} className="text-slate-400 mb-1" />
                    <span className="text-[10px] text-slate-400">Arrastrá imagen aquí</span>
                    <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (ev) => { if (ev.target?.result) addImageToCanvas(ev.target.result as string, file.name); };
                        reader.readAsDataURL(file);
                      }
                    }} />
                  </label>
                </div>
              )}

              {/* ── LAYERS ── */}
              {sidebarTab === 'layers' && (
                <div className="space-y-1">
                  <p className="text-[9px] text-slate-400 dark:text-slate-500 px-1">{layers.length} objetos en el canvas</p>
                  {[...layers].reverse().map((layer, i) => (
                    <div key={layer.id} className={`flex items-center gap-1 p-1 rounded text-[10px] ${selectedObj?.get('id') === layer.id ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800' : 'bg-slate-50 dark:bg-slate-800'}`}>
                      <button onClick={() => {
                        const canvas = fabricRef.current;
                        if (!canvas) return;
                        const objs = canvas.getObjects();
                        const obj = objs.find(o => (o.get('id') === layer.id));
                        if (obj) { canvas.setActiveObject(obj); canvas.requestRenderAll(); }
                      }}
                        className="flex-1 text-left truncate text-slate-700 dark:text-slate-200">{layer.name}</button>
                      <button onClick={() => {
                        const canvas = fabricRef.current;
                        if (!canvas) return;
                        const obj = canvas.getObjects().find(o => o.get('id') === layer.id);
                        if (obj) { obj.set('visible', !obj.visible); canvas.requestRenderAll(); updateLayers(); }
                      }} className="text-slate-400 hover:text-slate-600" title={layer.visible ? 'Ocultar' : 'Mostrar'}>
                        {layer.visible ? <Eye size={10} /> : <EyeOff size={10} />}
                      </button>
                      <button onClick={() => {
                        const canvas = fabricRef.current;
                        if (!canvas) return;
                        const obj = canvas.getObjects().find(o => o.get('id') === layer.id);
                        if (obj) { obj.set({ selectable: !obj.selectable, hasControls: !obj.selectable }); canvas.requestRenderAll(); updateLayers(); }
                      }} className="text-slate-400 hover:text-slate-600" title={layer.locked ? 'Desbloquear' : 'Bloquear'}>
                        {layer.locked ? <Lock size={10} /> : <Unlock size={10} />}
                      </button>
                      <div className="flex flex-col">
                        <button onClick={() => {
                          const canvas = fabricRef.current;
                          if (!canvas) return;
                          const obj = canvas.getObjects().find(o => o.get('id') === layer.id);
                          if (obj) { canvas.bringObjectForward(obj); updateLayers(); saveHistory(); }
                        }} className="text-slate-400 hover:text-blue-500" title="Subir">
                          <ChevronUp size={8} />
                        </button>
                        <button onClick={() => {
                          const canvas = fabricRef.current;
                          if (!canvas) return;
                          const obj = canvas.getObjects().find(o => o.get('id') === layer.id);
                          if (obj) { canvas.sendObjectBackwards(obj); updateLayers(); saveHistory(); }
                        }} className="text-slate-400 hover:text-blue-500" title="Bajar">
                          <ChevronDown size={8} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        {/* ─── CANVAS ─── */}
        <div ref={containerRef} className="flex-1 overflow-auto flex items-center justify-center bg-[#E8ECF0] dark:bg-[#0F1218] p-3 md:p-6 min-w-0"
          style={{ backgroundImage: 'radial-gradient(circle, #CBD5E1 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
          <div className="relative shadow-2xl rounded border border-slate-300 dark:border-slate-700" style={{ width: canvasWidth * (zoom / 100), height: canvasHeight * (zoom / 100) }}>
            {/* Grid overlay */}
            {snapEnabled && (
              <svg className="absolute inset-0 w-full h-full pointer-events-none z-[5] opacity-20">
                {Array.from({ length: Math.floor(canvasWidth / 50) + 1 }, (_, i) => (
                  <line key={`v${i}`} x1={`${(i * 50) * (zoom / 100)}px`} y1="0" x2={`${(i * 50) * (zoom / 100)}px`} y2="100%" stroke="#94A3B8" strokeWidth="0.5" />
                ))}
                {Array.from({ length: Math.floor(canvasHeight / 50) + 1 }, (_, i) => (
                  <line key={`h${i}`} x1="0" y1={`${(i * 50) * (zoom / 100)}px`} x2="100%" y2={`${(i * 50) * (zoom / 100)}px`} stroke="#94A3B8" strokeWidth="0.5" />
                ))}
              </svg>
            )}
            <canvas ref={canvasRef} />
            {/* Alignment guide lines */}
            {selectedObj && snapEnabled && (() => {
              const obj = selectedObj;
              const centerX = canvasWidth / 2;
              const centerY = canvasHeight / 2;
              const objCX = (obj.left || 0) + ((obj.width || 0) * (obj.scaleX || 1)) / 2;
              const objCY = (obj.top || 0) + ((obj.height || 0) * (obj.scaleY || 1)) / 2;
              const showHGuide = Math.abs(objCY - centerY) < SNAP_THRESHOLD;
              const showVGuide = Math.abs(objCX - centerX) < SNAP_THRESHOLD;
              return (
                <>
                  {showVGuide && (
                    <div className="absolute top-0 bottom-0 w-px bg-red-400/60 pointer-events-none z-10"
                      style={{ left: `${centerX * (zoom / 100)}px` }} />
                  )}
                  {showHGuide && (
                    <div className="absolute left-0 right-0 h-px bg-red-400/60 pointer-events-none z-10"
                      style={{ top: `${centerY * (zoom / 100)}px` }} />
                  )}
                </>
              );
            })()}
            {/* Canvas dimensions label */}
            <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[9px] text-slate-400 dark:text-slate-600 bg-white/80 dark:bg-slate-900/80 px-2 py-0.5 rounded">
              {canvasWidth} × {canvasHeight}px
            </div>
          </div>
        </div>

        {/* ─── RIGHT SIDEBAR: PROPERTIES ─── */}
        {selectedObj && (
          <div className="hidden md:flex w-52 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex-col shrink-0 overflow-y-auto">
            <div className="p-3 border-b border-slate-200 dark:border-slate-800">
              <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                {selectionType === 'text' ? 'Texto' : selectionType === 'image' ? 'Imagen' : 'Forma'}
              </p>
            </div>
            <div className="p-3 space-y-3">
              {/* Position */}
              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase">Posición</label>
                <div className="grid grid-cols-2 gap-1 mt-1">
                  <div>
                    <span className="text-[9px] text-slate-400">X</span>
                    <input type="number" value={propX}
                      onChange={(e) => { setPropX(Number(e.target.value)); selectedObj.set('left', Number(e.target.value)); fabricRef.current?.requestRenderAll(); }}
                      className="w-full px-1.5 py-0.5 text-[10px] border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-white" />
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400">Y</span>
                    <input type="number" value={propY}
                      onChange={(e) => { setPropY(Number(e.target.value)); selectedObj.set('top', Number(e.target.value)); fabricRef.current?.requestRenderAll(); }}
                      className="w-full px-1.5 py-0.5 text-[10px] border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-white" />
                  </div>
                </div>
              </div>

              {/* Size */}
              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase">Tamaño</label>
                <div className="grid grid-cols-2 gap-1 mt-1">
                  <div>
                    <span className="text-[9px] text-slate-400">Ancho</span>
                    <input type="number" value={propW} min={1}
                      onChange={(e) => {
                        const newW = Number(e.target.value);
                        setPropW(newW);
                        selectedObj.set('scaleX', newW / (selectedObj.width || 1));
                        fabricRef.current?.requestRenderAll();
                      }}
                      className="w-full px-1.5 py-0.5 text-[10px] border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-white" />
                  </div>
                  <div>
                    <span className="text-[9px] text-slate-400">Alto</span>
                    <input type="number" value={propH} min={1}
                      onChange={(e) => {
                        const newH = Number(e.target.value);
                        setPropH(newH);
                        selectedObj.set('scaleY', newH / (selectedObj.height || 1));
                        fabricRef.current?.requestRenderAll();
                      }}
                      className="w-full px-1.5 py-0.5 text-[10px] border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-white" />
                  </div>
                </div>
              </div>

              {/* Rotation */}
              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase">Rotación</label>
                <div className="flex items-center gap-1 mt-1">
                  <input type="range" min={0} max={360} value={propRotation}
                    onChange={(e) => {
                      setPropRotation(Number(e.target.value));
                      selectedObj.set('angle', Number(e.target.value));
                      fabricRef.current?.requestRenderAll();
                    }}
                    className="flex-1 h-1 accent-blue-600" />
                  <input type="number" value={propRotation} min={0} max={360}
                    onChange={(e) => {
                      setPropRotation(Number(e.target.value));
                      selectedObj.set('angle', Number(e.target.value));
                      fabricRef.current?.requestRenderAll();
                    }}
                    className="w-12 px-1 py-0.5 text-[10px] border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-white text-center" />
                  <span className="text-[9px] text-slate-400">°</span>
                </div>
              </div>

              {/* Opacity */}
              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase">Opacidad: {opacity}%</label>
                <input type="range" min={0} max={100} value={opacity}
                  onChange={(e) => {
                    setOpacity(Number(e.target.value));
                    selectedObj.set('opacity', Number(e.target.value) / 100);
                    fabricRef.current?.requestRenderAll();
                  }}
                  className="w-full h-1 accent-blue-600 mt-1" />
              </div>

              {/* Colors */}
              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase">Colores</label>
                <div className="grid grid-cols-6 gap-1 mt-1">
                  {COLORS.slice(0, 12).map(c => (
                    <button key={c} onClick={() => { setFillColor(c); updateProp('fill', c); }}
                      className={`w-full aspect-square rounded border hover:scale-110 transition-transform ${fillColor === c ? 'border-blue-500 ring-1 ring-blue-500' : 'border-slate-200 dark:border-slate-700'}`}
                      style={{ backgroundColor: c }} title={c} />
                  ))}
                </div>
              </div>

              {/* Stroke */}
              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase">Borde</label>
                <div className="flex items-center gap-1 mt-1">
                  <input type="color" value={strokeColor}
                    onChange={(e) => { setStrokeColor(e.target.value); updateProp('stroke', e.target.value); }}
                    className="w-6 h-6 rounded cursor-pointer border border-slate-200 dark:border-slate-700" />
                  <input type="number" value={strokeWidth} min={0} max={20}
                    onChange={(e) => { setStrokeWidth(Number(e.target.value)); updateProp('strokeWidth', Number(e.target.value)); }}
                    className="flex-1 px-1.5 py-0.5 text-[10px] border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-white" />
                  <span className="text-[9px] text-slate-400">px</span>
                </div>
              </div>

              {/* Text-specific */}
              {selectionType === 'text' && (
                <>
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase">Fuente</label>
                    <select value={fontFamily}
                      onChange={(e) => { setFontFamily(e.target.value); updateProp('fontFamily', e.target.value); }}
                      className="w-full px-1.5 py-0.5 text-[10px] border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-white mt-1">
                      {GOOGLE_FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase">Tamaño Fuente</label>
                    <input type="number" value={fontSize} min={8} max={120}
                      onChange={(e) => { setFontSize(Number(e.target.value)); updateProp('fontSize', Number(e.target.value)); }}
                      className="w-full px-1.5 py-0.5 text-[10px] border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-white mt-1" />
                  </div>
                </>
              )}

              {/* Image-specific */}
              {selectionType === 'image' && (
                <>
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase">Acciones de imagen</label>
                    <div className="grid grid-cols-2 gap-1 mt-1">
                      <button onClick={() => {
                        const c = fabricRef.current; const o = c?.getActiveObject();
                        if (o && o.type === 'image') {
                          const cw = canvasWidth; const ch = canvasHeight;
                          const iw = (o.width || 1) * (o.scaleX || 1);
                          const ih = (o.height || 1) * (o.scaleY || 1);
                          const s = Math.min(cw / iw, ch / ih) * 0.8;
                          o.set({ scaleX: (o.scaleX || 1) * s, scaleY: (o.scaleY || 1) * s, left: (cw - iw * s) / 2, top: (ch - ih * s) / 2 });
                          c?.requestRenderAll(); saveHistory(); handleSyncProps(o);
                        }
                      }} className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-[9px] rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700">
                        Ajustar
                      </button>
                      <button onClick={() => {
                        const c = fabricRef.current; const o = c?.getActiveObject();
                        if (o) { o.set('flipX', !o.flipX); c?.requestRenderAll(); saveHistory(); }
                      }} className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-[9px] rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700">
                        Voltear H
                      </button>
                      <button onClick={() => {
                        const c = fabricRef.current; const o = c?.getActiveObject();
                        if (o) { o.set('flipY', !o.flipY); c?.requestRenderAll(); saveHistory(); }
                      }} className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-[9px] rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700">
                        Voltear V
                      </button>
                      <button onClick={() => {
                        const c = fabricRef.current; const o = c?.getActiveObject();
                        if (o) { o.set({ angle: 0, flipX: false, flipY: false }); c?.requestRenderAll(); saveHistory(); setPropRotation(0); }
                      }} className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-[9px] rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700">
                        Reset
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ══════════════════════════════════════════════════════════════════

function ToolBtn({ icon, onClick, disabled, active, title }: {
  icon: React.ReactNode; onClick?: () => void; disabled?: boolean; active?: boolean; title?: string;
}) {
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      className={`w-7 h-7 flex items-center justify-center rounded transition-colors
        ${active ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}
        ${disabled ? 'opacity-30 cursor-not-allowed' : ''}`}>
      {icon}
    </button>
  );
}

function SidebarSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div>
      <button onClick={() => setOpen(!open)} className="flex items-center gap-1 w-full text-left mb-1">
        {open ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">{title}</span>
      </button>
      {open && children}
    </div>
  );
}

export default VisualEditor;

import React, { useEffect, useCallback, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { FontFamily } from '@tiptap/extension-font-family';
import { FontSize } from './editor/FontSize';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import Placeholder from '@tiptap/extension-placeholder';
import { CharacterCount } from '@tiptap/extension-character-count';
import { 
    Bold, Italic, Underline as UnderlineIcon, Strikethrough,
    Heading1, Heading2, Heading3,
    List, ListOrdered, AlignLeft, AlignCenter, AlignRight,
    Highlighter, Link as LinkIcon, Undo, Redo, Printer, Save, X, Download,
    Table as TableIcon, Palette, Type, Pilcrow
} from 'lucide-react';
import { exportElementToPdf } from '../utils/pdfExport';

interface TreatmentPlanEditorProps {
    content: string;
    onSave: (html: string) => void;
    onCancel: () => void;
    patientName?: string;
}

const FONT_FAMILIES = [
    { label: 'Predeterminado', value: '' },
    { label: 'Calibri', value: 'Calibri, sans-serif' },
    { label: 'Arial', value: 'Arial, sans-serif' },
    { label: 'Times New Roman', value: '"Times New Roman", serif' },
    { label: 'Georgia', value: 'Georgia, serif' },
    { label: 'Verdana', value: 'Verdana, sans-serif' },
    { label: 'Helvetica', value: 'Helvetica, sans-serif' },
    { label: 'Courier New', value: '"Courier New", monospace' },
];

const FONT_SIZES = ['10pt', '11pt', '12pt', '14pt', '16pt', '18pt', '20pt', '24pt'];

const TEXT_COLORS = [
    '#1e293b', '#0f172a', '#334155', '#475569',
    '#0891b2', '#2563eb', '#7c3aed', '#db2777',
    '#dc2626', '#ea580c', '#d97706', '#16a34a',
];

const HIGHLIGHT_COLORS = [
    { label: 'Amarillo', value: '#fef08a' },
    { label: 'Verde', value: '#bbf7d0' },
    { label: 'Azul', value: '#bfdbfe' },
    { label: 'Rosa', value: '#fbcfe8' },
    { label: 'Naranja', value: '#fed7aa' },
    { label: 'Gris', value: '#e2e8f0' },
];

const MenuBar = ({ editor }: { editor: any }) => {
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [showHighlightPicker, setShowHighlightPicker] = useState(false);
    const [showFontPicker, setShowFontPicker] = useState(false);
    const [showSizePicker, setShowSizePicker] = useState(false);

    if (!editor) return null;

    const addLink = () => {
        const url = window.prompt('URL del enlace:');
        if (url) editor.chain().focus().setLink({ href: url }).run();
    };

    const addTable = () => {
        editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    };

    return (
        <div className="flex flex-wrap items-center gap-0.5 p-2 border-b border-slate-200 bg-slate-50 sticky top-0 z-10">
            {/* Font Family */}
            <div className="relative">
                <button
                    onClick={() => { setShowFontPicker(!showFontPicker); setShowSizePicker(false); setShowColorPicker(false); setShowHighlightPicker(false); }}
                    className="px-2 py-1.5 rounded-lg hover:bg-slate-200 text-slate-600 text-xs min-w-[100px] text-left flex items-center gap-1"
                    title="Familia tipográfica"
                >
                    <Type size={14} />
                    {editor.getAttributes('textStyle').fontFamily?.split(',')[0]?.replace(/"/g, '') || 'Fuente'}
                </button>
                {showFontPicker && (
                    <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-50 w-48">
                        {FONT_FAMILIES.map(f => (
                            <button key={f.value} onClick={() => {
                                if (f.value) editor.chain().focus().setFontFamily(f.value).run();
                                else editor.chain().focus().unsetFontFamily().run();
                                setShowFontPicker(false);
                            }} className="w-full px-3 py-1.5 text-left text-sm hover:bg-slate-100 text-slate-700" style={{ fontFamily: f.value || 'inherit' }}>
                                {f.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Font Size */}
            <div className="relative">
                <button
                    onClick={() => { setShowSizePicker(!showSizePicker); setShowFontPicker(false); setShowColorPicker(false); setShowHighlightPicker(false); }}
                    className="px-2 py-1.5 rounded-lg hover:bg-slate-200 text-slate-600 text-xs min-w-[50px] text-center"
                    title="Tamaño"
                >
                    {editor.getAttributes('textStyle').fontSize || '12pt'}
                </button>
                {showSizePicker && (
                    <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-50 w-20">
                        {FONT_SIZES.map(s => (
                            <button key={s} onClick={() => {
                                editor.chain().focus().setFontSize(s).run();
                                setShowSizePicker(false);
                            }} className="w-full px-3 py-1 text-left text-sm hover:bg-slate-100 text-slate-700">
                                {s}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="w-px h-6 bg-slate-300 mx-1" />

            {/* Text formatting */}
            <button onClick={() => editor.chain().focus().toggleBold().run()} className={`p-1.5 rounded-lg transition-colors ${editor.isActive('bold') ? 'bg-blue-100 text-blue-700' : 'hover:bg-slate-200 text-slate-600'}`} title="Negrita"><Bold size={15} /></button>
            <button onClick={() => editor.chain().focus().toggleItalic().run()} className={`p-1.5 rounded-lg transition-colors ${editor.isActive('italic') ? 'bg-blue-100 text-blue-700' : 'hover:bg-slate-200 text-slate-600'}`} title="Cursiva"><Italic size={15} /></button>
            <button onClick={() => editor.chain().focus().toggleUnderline().run()} className={`p-1.5 rounded-lg transition-colors ${editor.isActive('underline') ? 'bg-blue-100 text-blue-700' : 'hover:bg-slate-200 text-slate-600'}`} title="Subrayado"><UnderlineIcon size={15} /></button>
            <button onClick={() => editor.chain().focus().toggleStrike().run()} className={`p-1.5 rounded-lg transition-colors ${editor.isActive('strike') ? 'bg-blue-100 text-blue-700' : 'hover:bg-slate-200 text-slate-600'}`} title="Tachado"><Strikethrough size={15} /></button>

            <div className="w-px h-6 bg-slate-300 mx-1" />

            {/* Headings */}
            <button onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={`p-1.5 rounded-lg transition-colors ${editor.isActive('heading', { level: 1 }) ? 'bg-blue-100 text-blue-700' : 'hover:bg-slate-200 text-slate-600'}`} title="Título 1"><Heading1 size={15} /></button>
            <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={`p-1.5 rounded-lg transition-colors ${editor.isActive('heading', { level: 2 }) ? 'bg-blue-100 text-blue-700' : 'hover:bg-slate-200 text-slate-600'}`} title="Título 2"><Heading2 size={15} /></button>
            <button onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={`p-1.5 rounded-lg transition-colors ${editor.isActive('heading', { level: 3 }) ? 'bg-blue-100 text-blue-700' : 'hover:bg-slate-200 text-slate-600'}`} title="Título 3"><Heading3 size={15} /></button>
            <button onClick={() => editor.chain().focus().setParagraph().run()} className={`p-1.5 rounded-lg transition-colors ${editor.isActive('paragraph') ? 'bg-blue-100 text-blue-700' : 'hover:bg-slate-200 text-slate-600'}`} title="Párrafo"><Pilcrow size={15} /></button>

            <div className="w-px h-6 bg-slate-300 mx-1" />

            {/* Lists */}
            <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={`p-1.5 rounded-lg transition-colors ${editor.isActive('bulletList') ? 'bg-blue-100 text-blue-700' : 'hover:bg-slate-200 text-slate-600'}`} title="Viñetas"><List size={15} /></button>
            <button onClick={() => editor.chain().focus().toggleOrderedList().run()} className={`p-1.5 rounded-lg transition-colors ${editor.isActive('orderedList') ? 'bg-blue-100 text-blue-700' : 'hover:bg-slate-200 text-slate-600'}`} title="Numerada"><ListOrdered size={15} /></button>

            <div className="w-px h-6 bg-slate-300 mx-1" />

            {/* Alignment */}
            <button onClick={() => editor.chain().focus().setTextAlign('left').run()} className={`p-1.5 rounded-lg transition-colors ${editor.isActive({ textAlign: 'left' }) ? 'bg-blue-100 text-blue-700' : 'hover:bg-slate-200 text-slate-600'}`} title="Izquierda"><AlignLeft size={15} /></button>
            <button onClick={() => editor.chain().focus().setTextAlign('center').run()} className={`p-1.5 rounded-lg transition-colors ${editor.isActive({ textAlign: 'center' }) ? 'bg-blue-100 text-blue-700' : 'hover:bg-slate-200 text-slate-600'}`} title="Centrar"><AlignCenter size={15} /></button>
            <button onClick={() => editor.chain().focus().setTextAlign('right').run()} className={`p-1.5 rounded-lg transition-colors ${editor.isActive({ textAlign: 'right' }) ? 'bg-blue-100 text-blue-700' : 'hover:bg-slate-200 text-slate-600'}`} title="Derecha"><AlignRight size={15} /></button>

            <div className="w-px h-6 bg-slate-300 mx-1" />

            {/* Colors */}
            <div className="relative">
                <button onClick={() => { setShowColorPicker(!showColorPicker); setShowHighlightPicker(false); setShowFontPicker(false); setShowSizePicker(false); }} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600" title="Color de texto">
                    <Palette size={15} />
                </button>
                {showColorPicker && (
                    <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg p-2 z-50">
                        <div className="grid grid-cols-6 gap-1">
                            {TEXT_COLORS.map(c => (
                                <button key={c} onClick={() => { editor.chain().focus().setColor(c).run(); setShowColorPicker(false); }} className="w-6 h-6 rounded border border-slate-200 hover:scale-110 transition-transform" style={{ backgroundColor: c }} />
                            ))}
                        </div>
                        <button onClick={() => { editor.chain().focus().unsetColor().run(); setShowColorPicker(false); }} className="mt-1 w-full text-xs text-slate-500 hover:text-slate-700 py-1">Quitar color</button>
                    </div>
                )}
            </div>

            {/* Highlight */}
            <div className="relative">
                <button onClick={() => { setShowHighlightPicker(!showHighlightPicker); setShowColorPicker(false); setShowFontPicker(false); setShowSizePicker(false); }} className={`p-1.5 rounded-lg transition-colors ${editor.isActive('highlight') ? 'bg-yellow-100 text-yellow-700' : 'hover:bg-slate-200 text-slate-600'}`} title="Resaltar">
                    <Highlighter size={15} />
                </button>
                {showHighlightPicker && (
                    <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg p-2 z-50">
                        <div className="grid grid-cols-3 gap-1">
                            {HIGHLIGHT_COLORS.map(h => (
                                <button key={h.value} onClick={() => { editor.chain().focus().toggleHighlight({ color: h.value }).run(); setShowHighlightPicker(false); }} className="w-8 h-6 rounded border border-slate-200 text-[9px] hover:scale-105 transition-transform" style={{ backgroundColor: h.value }} title={h.label}>
                                    {h.label}
                                </button>
                            ))}
                        </div>
                        <button onClick={() => { editor.chain().focus().unsetHighlight().run(); setShowHighlightPicker(false); }} className="mt-1 w-full text-xs text-slate-500 hover:text-slate-700 py-1">Quitar resaltado</button>
                    </div>
                )}
            </div>

            <button onClick={addLink} className={`p-1.5 rounded-lg transition-colors ${editor.isActive('link') ? 'bg-blue-100 text-blue-700' : 'hover:bg-slate-200 text-slate-600'}`} title="Enlace"><LinkIcon size={15} /></button>

            <div className="w-px h-6 bg-slate-300 mx-1" />

            {/* Table */}
            <button onClick={addTable} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600" title="Insertar tabla"><TableIcon size={15} /></button>

            <div className="w-px h-6 bg-slate-300 mx-1" />

            {/* Undo/Redo */}
            <button onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600 disabled:opacity-30" title="Deshacer"><Undo size={15} /></button>
            <button onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-600 disabled:opacity-30" title="Rehacer"><Redo size={15} /></button>

            {/* Word count */}
            <div className="ml-auto text-[10px] text-slate-400 px-2">
                {editor.storage.characterCount?.characters?.() || editor.getText().length} caracteres
            </div>
        </div>
    );
};

export const TreatmentPlanEditor: React.FC<TreatmentPlanEditorProps> = ({
    content,
    onSave,
    onCancel,
    patientName
}) => {
    const editor = useEditor({
        extensions: [
            StarterKit,
            TextAlign.configure({ types: ['heading', 'paragraph'] }),
            Highlight.configure({ multicolor: true }),
            Underline,
            Link.configure({ openOnClick: false }),
            TextStyle,
            Color,
            FontFamily,
            FontSize,
            Table.configure({ resizable: true }),
            TableRow,
            TableCell,
            TableHeader,
            Placeholder.configure({ placeholder: 'Comenzá a escribir el plan de tratamiento...' }),
            CharacterCount,
        ],
        content: content || '',
        editorProps: {
            attributes: {
                class: 'prose prose-sm sm:prose max-w-none focus:outline-none min-h-[400px] p-6 text-sm text-slate-700 leading-relaxed',
            },
        },
    });

    const handleSave = useCallback(() => {
        if (editor) onSave(editor.getHTML());
    }, [editor, onSave]);

    const handlePrint = useCallback(() => {
        if (!editor) return;
        const html = editor.getHTML();
        const win = window.open('', '_blank');
        if (win) {
            win.document.write(`<html><head><title>Plan - ${patientName || 'Paciente'}</title><style>body{font-family:'Segoe UI',Arial,sans-serif;max-width:800px;margin:0 auto;padding:20px;color:#1e293b}h1{color:#0891b2;border-bottom:2px solid #0891b2;padding-bottom:8px}h2,h3{color:#0891b2}ul,ol{padding-left:24px}li{margin-bottom:4px}p{margin-bottom:8px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #e2e8f0;padding:6px 8px;text-align:left}th{background:#f1f5f9}@media print{body{margin:0;padding:15px}}</style></head><body><h1>Plan de Tratamiento Fonoaudiológico</h1><p><strong>Paciente:</strong> ${patientName || 'N/A'} | <strong>Fecha:</strong> ${new Date().toLocaleDateString()}</p><hr style="border:1px solid #e2e8f0;margin:16px 0"/>${html}</body></html>`);
            win.document.close();
            win.print();
        }
    }, [editor, patientName]);

    useEffect(() => {
        return () => editor?.destroy();
    }, [editor]);

    if (!editor) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden">
                <div className="p-3 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                    <h3 className="font-bold text-slate-800 text-sm">
                        Plan de Tratamiento {patientName ? `— ${patientName}` : ''}
                    </h3>
                    <div className="flex gap-2">
                        <button onClick={handlePrint} className="px-3 py-1.5 text-slate-600 hover:bg-slate-200 rounded-lg text-xs font-medium transition-colors flex items-center gap-1"><Printer size={13} /> Imprimir</button>
                        <button onClick={async () => { const el = document.querySelector('.tiptap'); if (el) await exportElementToPdf(el as HTMLElement, { title: 'Plan de Tratamiento', patientName }); }} className="px-3 py-1.5 text-slate-600 hover:bg-slate-200 rounded-lg text-xs font-medium transition-colors flex items-center gap-1"><Download size={13} /> PDF</button>
                        <button onClick={onCancel} className="px-4 py-1.5 text-slate-600 hover:bg-slate-200 rounded-lg text-xs font-medium">Cancelar</button>
                        <button onClick={handleSave} className="px-4 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1 text-xs font-bold transition-colors shadow-md"><Save size={14} /> Guardar</button>
                    </div>
                </div>
                <MenuBar editor={editor} />
                <div className="flex-1 overflow-y-auto">
                    <EditorContent editor={editor} />
                </div>
            </div>
        </div>
    );
};

export default TreatmentPlanEditor;

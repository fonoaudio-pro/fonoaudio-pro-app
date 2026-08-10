import React, { useMemo } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import FontFamily from '@tiptap/extension-font-family';
import {
  Bold, Italic, Underline as UnderlineIcon, AlignLeft, AlignCenter, AlignRight,
  List, ListOrdered, Heading1, Heading2, Heading3, Palette, Highlighter, Undo, Redo
} from 'lucide-react';

// Custom extension for font size
import { Extension } from '@tiptap/core';

const FontSize = Extension.create({
  name: 'fontSize',

  addOptions() {
    return {
      types: ['textStyle'],
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: element => element.style.fontSize.replace(/['"]+/g, ''),
            renderHTML: attributes => {
              if (!attributes.fontSize) {
                return {};
              }
              return {
                style: `font-size: ${attributes.fontSize}`,
              };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setFontSize: (fontSize: string) => ({ chain }) => {
        return chain()
          .setMark('textStyle', { fontSize })
          .run();
      },
      unsetFontSize: () => ({ chain }) => {
        return chain()
          .setMark('textStyle', { fontSize: null })
          .removeEmptyTextStyle()
          .run();
      },
    };
  },
});

interface EditorProps {
  content: string;
  onChange: (html: string) => void;
  onEditorReady?: (editor: any) => void;
  isAssistantActive?: boolean;
}

const Editor: React.FC<EditorProps> = ({ content, onChange, onEditorReady, isAssistantActive }) => {
  const extensions = useMemo(() => [
    StarterKit,
    Underline,
    TextAlign.configure({
      types: ['heading', 'paragraph'],
    }),
    TextStyle,
    Color,
    Highlight.configure({ multicolor: true }),
    FontFamily.configure({
      types: ['textStyle'],
    }),
    FontSize,
  ], []);

  const editor = useEditor({
    extensions,
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    onCreate: ({ editor }) => {
      if (onEditorReady) {
        onEditorReady(editor);
      }
    },
  });

  // Sync editor content when prop changes (e.g. from voice assistant)
  React.useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      // Only update if content is different to avoid cursor jumping/loops
      // We check if the difference is significant (sometimes HTML structure varies slightly)
      const currentContent = editor.getHTML();
      if (currentContent !== content) {
        editor.commands.setContent(content);
        editor.commands.setTextSelection(editor.state.doc.content.size);
      }
    }
  }, [content, editor]);

  if (!editor) {
    return null;
  }

  const fontSizes = ['8px', '10px', '12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px', '36px', '48px'];
  const fontFamilies = [
    { label: 'Arial', value: 'Arial, sans-serif' },
    { label: 'Times New Roman', value: 'Times New Roman, serif' },
    { label: 'Courier New', value: 'Courier New, monospace' },
    { label: 'Georgia', value: 'Georgia, serif' },
    { label: 'Verdana', value: 'Verdana, sans-serif' },
    { label: 'Tahoma', value: 'Tahoma, sans-serif' },
    { label: 'Comic Sans', value: 'Comic Sans MS, cursive' },
  ];

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden bg-white flex flex-col h-full shadow-inner transition-colors duration-300">
      {/* Assistant Activity Indicator */}
      {isAssistantActive && (
        <div className="bg-blue-50 border-b border-blue-200 px-3 py-2 flex items-center gap-2">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
          <span className="text-xs text-blue-700 font-medium">Asistente escribiendo...</span>
        </div>
      )}

      {/* Toolbar */}
      <div className="bg-gray-50 border-b border-gray-200 p-2 flex flex-wrap gap-1 items-center sticky top-0 z-10 transition-colors duration-300">
        {/* Font Family */}
        <select
          onChange={(e) => editor.chain().focus().setFontFamily(e.target.value).run()}
          className="px-2 py-1 border border-gray-300 rounded text-sm hover:bg-gray-100 bg-white text-slate-900"
          defaultValue=""
        >
          <option value="">Fuente</option>
          {fontFamilies.map((font) => (
            <option key={font.value} value={font.value}>
              {font.label}
            </option>
          ))}
        </select>

        {/* Font Size */}
        <select
          onChange={(e) => editor.chain().focus().setFontSize(e.target.value).run()}
          className="px-2 py-1 border border-gray-300 rounded text-sm hover:bg-gray-100 bg-white text-slate-900"
          defaultValue=""
        >
          <option value="">Tamaño</option>
          {fontSizes.map((size) => (
            <option key={size} value={size}>
              {size.replace('px', '')}
            </option>
          ))}
        </select>

        <div className="w-px h-6 bg-gray-300 mx-1"></div>

        {/* Undo/Redo */}
        <button
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().chain().focus().undo().run()}
          className={`p-1.5 rounded hover:bg-gray-200 text-slate-700 ${!editor.can().chain().focus().undo().run() ? 'opacity-50 cursor-not-allowed' : ''}`}
          title="Deshacer"
        >
          <Undo size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().chain().focus().redo().run()}
          className={`p-1.5 rounded hover:bg-gray-200 text-slate-700 ${!editor.can().chain().focus().redo().run() ? 'opacity-50 cursor-not-allowed' : ''}`}
          title="Rehacer"
        >
          <Redo size={16} />
        </button>

        <div className="w-px h-6 bg-gray-300 mx-1"></div>

        {/* Text Formatting */}
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-1.5 rounded hover:bg-gray-200 text-slate-700 ${editor.isActive('bold') ? 'bg-blue-100 text-blue-700' : ''}`}
          title="Negrita"
        >
          <Bold size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-1.5 rounded hover:bg-gray-200 text-slate-700 ${editor.isActive('italic') ? 'bg-blue-100 text-blue-700' : ''}`}
          title="Cursiva"
        >
          <Italic size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`p-1.5 rounded hover:bg-gray-200 text-slate-700 ${editor.isActive('underline') ? 'bg-blue-100 text-blue-700' : ''}`}
          title="Subrayado"
        >
          <UnderlineIcon size={16} />
        </button>

        <div className="w-px h-6 bg-gray-300 mx-1"></div>

        {/* Text Color */}
        <div className="flex items-center gap-1">
          <Palette size={14} className="text-gray-600" />
          <input
            type="color"
            onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
            className="w-8 h-6 border border-gray-300 rounded cursor-pointer bg-transparent"
            title="Color de texto"
          />
        </div>

        {/* Highlight Color */}
        <div className="flex items-center gap-1">
          <Highlighter size={14} className="text-gray-600" />
          <input
            type="color"
            onChange={(e) => editor.chain().focus().toggleHighlight({ color: e.target.value }).run()}
            className="w-8 h-6 border border-gray-300 rounded cursor-pointer bg-transparent"
            title="Color de resaltado"
          />
        </div>

        <div className="w-px h-6 bg-gray-300 mx-1"></div>

        {/* Alignment */}
        <button
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          className={`p-1.5 rounded hover:bg-gray-200 text-slate-700 ${editor.isActive({ textAlign: 'left' }) ? 'bg-blue-100 text-blue-700' : ''}`}
          title="Alinear izquierda"
        >
          <AlignLeft size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          className={`p-1.5 rounded hover:bg-gray-200 text-slate-700 ${editor.isActive({ textAlign: 'center' }) ? 'bg-blue-100 text-blue-700' : ''}`}
          title="Centrar"
        >
          <AlignCenter size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          className={`p-1.5 rounded hover:bg-gray-200 text-slate-700 ${editor.isActive({ textAlign: 'right' }) ? 'bg-blue-100 text-blue-700' : ''}`}
          title="Alinear derecha"
        >
          <AlignRight size={16} />
        </button>

        <div className="w-px h-6 bg-gray-300 mx-1"></div>

        {/* Headings */}
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`p-1.5 rounded hover:bg-gray-200 text-slate-700 font-bold text-sm ${editor.isActive('heading', { level: 1 }) ? 'bg-blue-100 text-blue-700' : ''}`}
          title="Título 1"
        >
          H1
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`p-1.5 rounded hover:bg-gray-200 text-slate-700 font-bold text-sm ${editor.isActive('heading', { level: 2 }) ? 'bg-blue-100 text-blue-700' : ''}`}
          title="Título 2"
        >
          H2
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`p-1.5 rounded hover:bg-gray-200 text-slate-700 font-bold text-sm ${editor.isActive('heading', { level: 3 }) ? 'bg-blue-100 text-blue-700' : ''}`}
          title="Título 3"
        >
          H3
        </button>

        <div className="w-px h-6 bg-gray-300 mx-1"></div>

        {/* Lists */}
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-1.5 rounded hover:bg-gray-200 text-slate-700 ${editor.isActive('bulletList') ? 'bg-blue-100 text-blue-700' : ''}`}
          title="Lista con viñetas"
        >
          <List size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-1.5 rounded hover:bg-gray-200 text-slate-700 ${editor.isActive('orderedList') ? 'bg-blue-100 text-blue-700' : ''}`}
          title="Lista numerada"
        >
          <ListOrdered size={16} />
        </button>
      </div>

      {/* Editor Content */}
      <EditorContent
        editor={editor}
        className="flex-1 p-8 overflow-y-auto outline-none text-slate-900 prose prose-lg max-w-none"
        style={{ minHeight: '400px' }}
      />
    </div>
  );
};

export default Editor;

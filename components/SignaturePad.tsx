import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Eraser, Upload, Check, X, Pen } from 'lucide-react';

interface SignaturePadProps {
    onSave: (dataUrl: string) => void;
    onCancel: () => void;
    existingSignature?: string | null;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({ onSave, onCancel, existingSignature }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [hasDrawn, setHasDrawn] = useState(false);
    const lastPointRef = useRef<{ x: number; y: number } | null>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const resizeCanvas = () => {
            const rect = canvas.getBoundingClientRect();
            canvas.width = rect.width;
            canvas.height = rect.height;

            ctx.strokeStyle = '#1e293b';
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            if (existingSignature) {
                const img = new Image();
                img.onload = () => {
                    ctx.drawImage(img, 0, 0, rect.width, rect.height);
                    setHasDrawn(true);
                };
                img.src = existingSignature;
            }
        };

        resizeCanvas();
    }, [existingSignature]);

    const getPos = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        if ('touches' in e) {
            const touch = e.touches[0] || e.changedTouches[0];
            return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
        }
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }, []);

    const startDraw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        setIsDrawing(true);
        setHasDrawn(true);
        lastPointRef.current = getPos(e);
    }, [getPos]);

    const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        if (!isDrawing || !canvasRef.current) return;
        const ctx = canvasRef.current.getContext('2d');
        if (!ctx || !lastPointRef.current) return;

        const pos = getPos(e);
        ctx.beginPath();
        ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        lastPointRef.current = pos;
    }, [isDrawing, getPos]);

    const stopDraw = useCallback(() => {
        setIsDrawing(false);
        lastPointRef.current = null;
    }, []);

    const clear = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setHasDrawn(false);
    }, []);

    const handleSave = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas || !hasDrawn) return;
        onSave(canvas.toDataURL('image/png'));
    }, [hasDrawn, onSave]);

    const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            const img = new Image();
            img.onload = () => {
                const canvas = canvasRef.current;
                if (!canvas) return;
                const ctx = canvas.getContext('2d');
                if (!ctx) return;
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
                const w = img.width * scale;
                const h = img.height * scale;
                ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
                setHasDrawn(true);
            };
            img.src = ev.target?.result as string;
        };
        reader.readAsDataURL(file);
    }, []);

    return (
        <div className="fixed inset-0 bg-black/50 z-[80] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
                <div className="p-4 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Pen size={18} className="text-indigo-600" />
                        <h3 className="font-bold text-slate-800">Firma Digital</h3>
                    </div>
                    <button onClick={onCancel} className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400"><X size={18} /></button>
                </div>

                <div className="p-4">
                    <p className="text-xs text-slate-500 mb-3">Dibujá tu firma en el recuadro o subí una imagen.</p>

                    <div className="border-2 border-dashed border-slate-300 rounded-xl overflow-hidden bg-slate-50 relative">
                        <canvas
                            ref={canvasRef}
                            className="w-full aspect-[5/2] min-h-[180px] cursor-crosshair"
                            style={{ touchAction: 'none' }}
                            onMouseDown={startDraw}
                            onMouseMove={draw}
                            onMouseUp={stopDraw}
                            onMouseLeave={stopDraw}
                            onTouchStart={startDraw}
                            onTouchMove={draw}
                            onTouchEnd={stopDraw}
                        />
                        {!hasDrawn && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <p className="text-sm text-slate-300 font-medium">Dibujá aquí</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <button onClick={clear} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">
                            <Eraser size={14} /> Limpiar trazo
                        </button>
                        <label className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer">
                            <Upload size={14} /> Subir imagen
                            <input type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
                        </label>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">
                            Cancelar
                        </button>
                        <button onClick={handleSave} disabled={!hasDrawn}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                            <Check size={16} /> Guardar firma
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

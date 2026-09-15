import React, { useState, useRef } from 'react';
import Webcam from 'react-webcam';
import { Camera, Upload, X, Loader2, FileText, CheckCircle, AlertCircle, ScanLine } from 'lucide-react';
import { multiOCR, extractMedicalData, extractAnamnesisData, type OCRResult, type ExtractedMedicalData, type AnamnesisData } from '../utils/ocr';
import { ScannerService } from '../services/ScannerService';

export interface DocumentScannerResult {
  extractedData: ExtractedMedicalData | AnamnesisData;
  ocrText: string;
  imageUrl: string;
  documentId: string;
}

interface DocumentScannerProps {
    patientId: string;
    patientName: string;
    userId: string;
    userName: string;
    clinicId?: string;
    onAnalysisComplete: (result: DocumentScannerResult) => void;
    onClose: () => void;
    scanType?: 'medical' | 'anamnesis';
    documentCategory?: string;
}

const DocumentScanner: React.FC<DocumentScannerProps> = ({
    patientId, patientName, userId, userName, clinicId,
    onAnalysisComplete, onClose, scanType = 'medical', documentCategory
}) => {
    const [mode, setMode] = useState<'select' | 'camera' | 'upload'>('select');
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);
    const [extractedData, setExtractedData] = useState<ExtractedMedicalData | AnamnesisData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [savedDocId, setSavedDocId] = useState<string | null>(null);

    const webcamRef = useRef<Webcam>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleCapture = () => {
        if (webcamRef.current) {
            const imageSrc = webcamRef.current.getScreenshot();
            if (imageSrc) {
                setCapturedImage(imageSrc);
                setMode('select');
            }
        }
    };

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                setCapturedImage(e.target?.result as string);
                setMode('select');
            };
            reader.readAsDataURL(file);
        }
    };

    const handleAnalyze = async () => {
        if (!capturedImage) return;

        setIsProcessing(true);
        setError(null);

        try {
            // Convert base64 to File
            const blob = await fetch(capturedImage).then(r => r.blob());
            const file = new File([blob], `escaneo_${Date.now()}.jpg`, { type: 'image/jpeg' });

            // Run multi-OCR (client-side for immediate feedback)
            const result = await multiOCR(file);
            setOcrResult(result);

            // Extract data based on scanType
            let data;
            if (scanType === 'anamnesis') {
                data = await extractAnamnesisData(result.text);
            } else {
                data = extractMedicalData(result.text);
            }
            setExtractedData(data);

            // Save to Supabase (upload file + OCR text + metadata)
            const doc = await ScannerService.scanDocument({
                patientId,
                patientName,
                userId,
                userName,
                imageBase64: capturedImage,
                documentCategory,
                clinicId,
                scanType,
            });
            setSavedDocId(doc.id);

            // Call parent callback with result
            onAnalysisComplete({
                extractedData: data,
                ocrText: result.text,
                imageUrl: capturedImage,
                documentId: doc.id,
            });
        } catch (err) {
            console.error('OCR Analysis failed:', err);
            setError(err instanceof Error ? err.message : 'Error al analizar el documento');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleReset = () => {
        setCapturedImage(null);
        setOcrResult(null);
        setExtractedData(null);
        setError(null);
        setSavedDocId(null);
        setMode('select');
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                    <div className="flex items-center gap-2">
                        <ScanLine className="text-emerald-600" size={24} />
                        <div>
                            <h3 className="font-bold text-lg">Escanear Documento ORL</h3>
                            <p className="text-xs text-slate-500">Foto o archivo del informe médico</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {mode === 'select' && !capturedImage && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <button
                                onClick={() => setMode('camera')}
                                className="p-8 border-2 border-dashed border-gray-300 rounded-lg hover:border-emerald-500 hover:bg-emerald-50 transition-all flex flex-col items-center gap-4"
                            >
                                <Camera size={48} className="text-emerald-600" />
                                <div>
                                    <h4 className="font-bold text-lg">Tomar Foto</h4>
                                    <p className="text-sm text-gray-600">Usar cámara del dispositivo</p>
                                </div>
                            </button>

                            <button
                                onClick={() => fileInputRef.current?.click()}
                                className="p-8 border-2 border-dashed border-gray-300 rounded-lg hover:border-emerald-500 hover:bg-emerald-50 transition-all flex flex-col items-center gap-4"
                            >
                                <Upload size={48} className="text-emerald-600" />
                                <div>
                                    <h4 className="font-bold text-lg">Subir Archivo</h4>
                                    <p className="text-sm text-gray-600">Imagen del informe del celular/PC</p>
                                </div>
                            </button>

                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*,.pdf"
                                onChange={handleFileUpload}
                                className="hidden"
                            />
                        </div>
                    )}

                    {mode === 'camera' && (
                        <div className="flex flex-col items-center gap-4">
                            <Webcam
                                ref={webcamRef}
                                audio={false}
                                screenshotFormat="image/jpeg"
                                className="w-full max-w-2xl rounded-lg border-2 border-gray-300"
                            />
                            <div className="flex gap-2">
                                <button
                                    onClick={handleCapture}
                                    className="px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2"
                                >
                                    <Camera size={20} />
                                    Capturar
                                </button>
                                <button
                                    onClick={() => setMode('select')}
                                    className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    )}

                    {capturedImage && (
                        <div className="space-y-4">
                            {/* Image Preview */}
                            <div className="border-2 border-gray-300 rounded-lg overflow-hidden">
                                <img src={capturedImage} alt="Documento capturado" className="w-full max-h-64 object-contain bg-gray-100" />
                            </div>

                            {/* OCR Results */}
                            {ocrResult && (
                                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <CheckCircle className="text-emerald-600" size={20} />
                                        <h4 className="font-bold text-emerald-800">
                                            OCR Completado ({ocrResult.source})
                                        </h4>
                                    </div>
                                    <p className="text-sm text-emerald-700">
                                        Confianza: {ocrResult.confidence.toFixed(1)}%
                                    </p>
                                    {savedDocId && (
                                        <p className="text-xs text-emerald-600 mt-1">
                                            Guardado en la historia clínica del paciente
                                        </p>
                                    )}
                                </div>
                            )}

                            {/* Extracted Data */}
                            {extractedData && (
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                                    <h4 className="font-bold text-blue-800">Datos Extraídos del Informe:</h4>

                                    {'patientName' in extractedData && extractedData.patientName && (
                                        <div>
                                            <span className="font-semibold">Paciente:</span> {extractedData.patientName}
                                        </div>
                                    )}

                                    {'datosPersonales' in extractedData && extractedData.datosPersonales?.nombreCompleto && (
                                        <div>
                                            <span className="font-semibold">Paciente:</span> {extractedData.datosPersonales.nombreCompleto}
                                        </div>
                                    )}

                                    {'age' in extractedData && extractedData.age && (
                                        <div>
                                            <span className="font-semibold">Edad:</span> {extractedData.age} años
                                        </div>
                                    )}

                                    {'diagnosis' in extractedData && extractedData.diagnosis && (
                                        <div>
                                            <span className="font-semibold">Diagnóstico:</span> {extractedData.diagnosis}
                                        </div>
                                    )}

                                    {'medications' in extractedData && extractedData.medications && extractedData.medications.length > 0 && (
                                        <div>
                                            <span className="font-semibold">Medicación:</span>
                                            <ul className="list-disc list-inside ml-4">
                                                {extractedData.medications.map((med, idx) => (
                                                    <li key={idx}>{med}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {'testResults' in extractedData && extractedData.testResults && extractedData.testResults.length > 0 && (
                                        <div>
                                            <span className="font-semibold">Resultados de Pruebas:</span>
                                            <ul className="list-disc list-inside ml-4">
                                                {extractedData.testResults.map((test, idx) => (
                                                    <li key={idx}>
                                                        {test.testName}: {test.value}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    <details className="mt-4">
                                        <summary className="font-semibold cursor-pointer text-blue-700">
                                            Ver texto completo del OCR
                                        </summary>
                                        <pre className="mt-2 p-3 bg-white rounded border text-xs overflow-auto max-h-40">
                                            {extractedData.rawText}
                                        </pre>
                                    </details>
                                </div>
                            )}

                            {/* Error */}
                            {error && (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                                    <div className="flex items-center gap-2">
                                        <AlertCircle className="text-red-600" size={20} />
                                        <h4 className="font-bold text-red-800">Error</h4>
                                    </div>
                                    <p className="text-sm text-red-700 mt-2">{error}</p>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex gap-2 justify-end">
                                <button
                                    onClick={handleReset}
                                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                                >
                                    Nuevo Escaneo
                                </button>
                                {!ocrResult && (
                                    <button
                                        onClick={handleAnalyze}
                                        disabled={isProcessing}
                                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:bg-gray-400 flex items-center gap-2"
                                    >
                                        {isProcessing ? (
                                            <>
                                                <Loader2 size={20} className="animate-spin" />
                                                Analizando con OCR...
                                            </>
                                        ) : (
                                            <>
                                                <ScanLine size={20} />
                                                Analizar Documento
                                            </>
                                        )}
                                    </button>
                                )}
                                {ocrResult && (
                                    <button
                                        onClick={onClose}
                                        className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center gap-2"
                                    >
                                        <CheckCircle size={16} />
                                        Guardar y Aplicar
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DocumentScanner;

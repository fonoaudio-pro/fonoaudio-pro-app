
import React, { useRef, useState, useCallback, useEffect } from "react";
import Webcam from "react-webcam";
import { X, Camera, RefreshCw, Settings } from "lucide-react";

interface CameraModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCapture: (imageSrc: string) => void;
}

const CameraModal = ({ isOpen, onClose, onCapture }: CameraModalProps) => {
    const webcamRef = useRef<Webcam>(null);
    const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState<string | undefined>(undefined);
    const [showDeviceList, setShowDeviceList] = useState(false);

    const handleDevices = useCallback((mediaDevices: MediaDeviceInfo[]) => {
        setDevices(mediaDevices.filter(({ kind }) => kind === "videoinput"));
    }, [setDevices]);

    useEffect(() => {
        navigator.mediaDevices.enumerateDevices().then(handleDevices);
    }, [handleDevices]);

    const capture = useCallback(() => {
        const imageSrc = webcamRef.current?.getScreenshot();
        if (imageSrc) {
            onCapture(imageSrc);
            onClose();
        }
    }, [webcamRef, onCapture, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/90 z-[70] flex items-center justify-center p-4 backdrop-blur-md">
            <div className="bg-black rounded-2xl overflow-hidden w-full max-w-lg relative shadow-2xl border border-slate-800 flex flex-col max-h-[90vh]">
                <div className="p-4 flex justify-between items-center bg-slate-900/50 backdrop-blur absolute top-0 left-0 right-0 z-10">
                    <span className="text-white font-medium flex items-center gap-2"><Camera size={18} /> Captura</span>
                    <button onClick={onClose} className="p-2 bg-white/10 text-white rounded-full hover:bg-white/20 transition-all">
                        <X size={20} />
                    </button>
                </div>

                <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden">
                    <Webcam
                        audio={false}
                        ref={webcamRef}
                        screenshotFormat="image/jpeg"
                        videoConstraints={{ deviceId: selectedDeviceId }}
                        className="w-full h-full object-cover"
                    />

                    {showDeviceList && (
                        <div className="absolute inset-0 bg-black/80 z-20 flex flex-col justify-center p-6 animate-in fade-in">
                            <h3 className="text-white font-bold mb-4 text-center">Seleccionar Cámara</h3>
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                                {devices.map((device, key) => (
                                    <button
                                        key={key}
                                        onClick={() => { setSelectedDeviceId(device.deviceId); setShowDeviceList(false); }}
                                        className={`w-full p-3 rounded-lg text-left text-sm flex items-center gap-2 ${selectedDeviceId === device.deviceId ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                                    >
                                        <Camera size={16} />
                                        {device.label || `Cámara ${key + 1}`}
                                    </button>
                                ))}
                            </div>
                            <button onClick={() => setShowDeviceList(false)} className="mt-4 text-slate-400 text-sm hover:text-white">Cancelar</button>
                        </div>
                    )}
                </div>

                <div className="p-6 flex justify-center items-center gap-8 bg-slate-900 border-t border-slate-800">
                    <button onClick={() => setShowDeviceList(!showDeviceList)} className="p-3 rounded-full bg-slate-800 text-white hover:bg-slate-700 transition-all relative group">
                        <Settings size={24} />
                        <span className="absolute -top-10 left-1/2 -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Cambiar Cámara</span>
                    </button>
                    <button onClick={capture} className="p-1 rounded-full bg-white border-4 border-slate-300 hover:scale-105 transition-all shadow-lg shadow-blue-500/20">
                        <div className="w-16 h-16 rounded-full bg-white border-[3px] border-black"></div>
                    </button>
                    <div className="w-12"></div> {/* Spacer for balance */}
                </div>
            </div>
        </div>
    );
};

export default CameraModal;

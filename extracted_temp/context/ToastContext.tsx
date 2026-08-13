import React, { createContext, useContext, useState, useCallback } from 'react';
import { Toast } from '../types/toast';
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react';

interface ToastContextType {
    addToast: (toast: Omit<Toast, 'id'>) => void;
    removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const removeToast = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    const addToast = useCallback((newToast: Omit<Toast, 'id'>) => {
        const id = Math.random().toString(36).substring(2, 9);
        const toast: Toast = { id, ...newToast };
        
        setToasts(prev => [...prev, toast]);

        // If it's not an error, auto-dismiss after duration or default 3000ms
        if (newToast.type !== 'error') {
            setTimeout(() => {
                removeToast(id);
            }, newToast.duration || 3000);
        }
    }, [removeToast]);

    return (
        <ToastContext.Provider value={{ addToast, removeToast }}>
            {children}
            <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
                {toasts.map(toast => (
                    <ToastItem key={toast.id} toast={toast} onRemove={() => removeToast(toast.id)} />
                ))}
            </div>
        </ToastContext.Provider>
    );
};

const ToastItem: React.FC<{ toast: Toast; onRemove: () => void }> = ({ toast, onRemove }) => {
    const getIcon = () => {
        switch (toast.type) {
            case 'success': return <CheckCircle2 size={18} />;
            case 'error': return <AlertCircle size={18} />;
            case 'info': return <Info size={18} />;
            case 'warning': return <AlertTriangle size={18} />;
        }
    };

    const getColorClass = () => {
        switch (toast.type) {
            case 'success': return 'bg-emerald-600 text-white border-emerald-500';
            case 'error': return 'bg-rose-600 text-white border-rose-500';
            case 'info': return 'bg-blue-600 text-white border-blue-500';
            case 'warning': return 'bg-amber-500 text-white border-amber-400';
        }
    };

    return (
        <div 
            onClick={onRemove}
            className={`
                pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border min-w-[280px] max-w-md cursor-pointer
                animate-in slide-in-from-right-full duration-300
                ${getColorClass()}
            `}
        >
            {getIcon()}
            <div className="flex-1 text-sm font-medium">
                {toast.message}
            </div>
            <button onClick={onRemove} className="opacity-70 hover:opacity-100 transition-opacity">
                <X size={16} />
            </button>
        </div>
    );
};

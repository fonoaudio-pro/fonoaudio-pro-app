export interface Fee {
    id: string;
    name: string;
    amount: number;
    description: string;
    category: 'consulta' | 'evaluacion' | 'tratamiento' | 'otro';
    active: boolean;
}

export interface Payment {
    id: string;
    patientId: string;
    patientName: string;
    feeId: string;
    feeName: string;
    amount: number;
    date: string;
    method: 'efectivo' | 'transferencia' | 'tarjeta' | 'debito' | 'otro';
    status: 'pagado' | 'pendiente' | 'vencido';
    dueDate?: string;
    notes?: string;
    receiptNumber?: string;
}

export interface FinanceSummary {
    totalRevenue: number;
    totalPending: number;
    totalOverdue: number;
    paymentsThisMonth: number;
    revenueThisMonth: number;
    patientDebts: { patientId: string; patientName: string; total: number; count: number }[];
}

const STORAGE_KEY = 'fonoaudio_fees';
const PAYMENTS_KEY = 'fonoaudio_payments';

const DEFAULT_FEES: Fee[] = [
    { id: 'f1', name: 'Consulta Fonoaudiológica', amount: 8000, description: 'Consulta individual de 30 min', category: 'consulta', active: true },
    { id: 'f2', name: 'Evaluación Fonoaudiológica', amount: 15000, description: 'Evaluación completa con informe', category: 'evaluacion', active: true },
    { id: 'f3', name: 'Sesión de Tratamiento', amount: 8000, description: 'Sesión individual de 45 min', category: 'tratamiento', active: true },
    { id: 'f4', name: 'Sesión de Tratamiento (60 min)', amount: 10000, description: 'Sesión extendida de 60 min', category: 'tratamiento', active: true },
    { id: 'f5', name: 'Informe / Derivación', amount: 5000, description: 'Emisión de informe escrito', category: 'otro', active: true },
    { id: 'f6', name: 'Interconsulta', amount: 6000, description: 'Coordinación interdisciplinaria', category: 'otro', active: true },
];

function loadFees(): Fee[] {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) return JSON.parse(stored);
    } catch {}
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_FEES));
    return DEFAULT_FEES;
}

function saveFees(fees: Fee[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fees));
}

function loadPayments(): Payment[] {
    try {
        const stored = localStorage.getItem(PAYMENTS_KEY);
        if (stored) return JSON.parse(stored);
    } catch {}
    return [];
}

function savePayments(payments: Payment[]) {
    localStorage.setItem(PAYMENTS_KEY, JSON.stringify(payments));
}

export const financeService = {
    getFees(): Fee[] {
        return loadFees();
    },

    saveFee(fee: Omit<Fee, 'id'> & { id?: string }): Fee {
        const fees = loadFees();
        if (fee.id) {
            const idx = fees.findIndex(f => f.id === fee.id);
            if (idx >= 0) { fees[idx] = { ...fees[idx], ...fee }; }
        } else {
            const newFee = { ...fee, id: `f_${Date.now()}` };
            fees.push(newFee);
        }
        saveFees(fees);
        return fees[fees.length - 1];
    },

    deleteFee(id: string) {
        const fees = loadFees();
        saveFees(fees.map(f => f.id === id ? { ...f, active: false } : f));
    },

    getPayments(): Payment[] {
        return loadPayments();
    },

    getPaymentsByPatient(patientId: string): Payment[] {
        return loadPayments().filter(p => p.patientId === patientId);
    },

    recordPayment(payment: Omit<Payment, 'id' | 'receiptNumber'>): Payment {
        const payments = loadPayments();
        const newPayment: Payment = {
            ...payment,
            id: `p_${Date.now()}`,
            receiptNumber: `REC-${Date.now().toString(36).toUpperCase()}`,
        };
        payments.push(newPayment);
        savePayments(payments);
        return newPayment;
    },

    updatePaymentStatus(id: string, status: Payment['status']) {
        const payments = loadPayments();
        savePayments(payments.map(p => p.id === id ? { ...p, status } : p));
    },

    deletePayment(id: string) {
        const payments = loadPayments();
        savePayments(payments.filter(p => p.id !== id));
    },

    getSummary(): FinanceSummary {
        const payments = loadPayments();
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        const monthPayments = payments.filter(p => {
            const d = new Date(p.date);
            return d.getMonth() === currentMonth && d.getFullYear() === currentYear && p.status === 'pagado';
        });

        const patientDebts: Record<string, { patientId: string; patientName: string; total: number; count: number }> = {};
        for (const p of payments) {
            if (p.status === 'pendiente' || p.status === 'vencido') {
                if (!patientDebts[p.patientId]) {
                    patientDebts[p.patientId] = { patientId: p.patientId, patientName: p.patientName, total: 0, count: 0 };
                }
                patientDebts[p.patientId].total += p.amount;
                patientDebts[p.patientId].count += 1;
            }
        }

        return {
            totalRevenue: payments.filter(p => p.status === 'pagado').reduce((sum, p) => sum + p.amount, 0),
            totalPending: payments.filter(p => p.status === 'pendiente').reduce((sum, p) => sum + p.amount, 0),
            totalOverdue: payments.filter(p => p.status === 'vencido').reduce((sum, p) => sum + p.amount, 0),
            paymentsThisMonth: monthPayments.length,
            revenueThisMonth: monthPayments.reduce((sum, p) => sum + p.amount, 0),
            patientDebts: Object.values(patientDebts),
        };
    },

    formatCurrency(amount: number): string {
        return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(amount);
    },
};

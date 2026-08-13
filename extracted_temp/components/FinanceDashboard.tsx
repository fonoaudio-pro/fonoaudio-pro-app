import React, { useState, useEffect, useMemo } from 'react';
import { DollarSign, TrendingUp, AlertTriangle, Clock, Plus, Trash2, Check, X, CreditCard, Banknote, ArrowUpRight, ArrowDownRight, Users } from 'lucide-react';
import { financeService, Fee, Payment, FinanceSummary } from '../services/FinanceService';
import { Patient } from '../types';

interface FinanceDashboardProps {
    patients: Patient[];
}

export const FinanceDashboard: React.FC<FinanceDashboardProps> = ({ patients }) => {
    const [fees, setFees] = useState<Fee[]>([]);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [summary, setSummary] = useState<FinanceSummary | null>(null);
    const [activeTab, setActiveTab] = useState<'dashboard' | 'payments' | 'fees'>('dashboard');
    const [showNewPayment, setShowNewPayment] = useState(false);
    const [newPayment, setNewPayment] = useState({ patientId: '', feeId: '', method: 'efectivo' as const, notes: '' });

    const reload = () => {
        setFees(financeService.getFees());
        setPayments(financeService.getPayments());
        setSummary(financeService.getSummary());
    };

    useEffect(reload, []);

    const recentPayments = useMemo(() => [...payments].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 20), [payments]);

    const handleRecordPayment = () => {
        if (!newPayment.patientId || !newPayment.feeId) return;
        const patient = patients.find(p => p.id === newPayment.patientId);
        const fee = fees.find(f => f.id === newPayment.feeId);
        if (!patient || !fee) return;

        financeService.recordPayment({
            patientId: patient.id,
            patientName: patient.name,
            feeId: fee.id,
            feeName: fee.name,
            amount: fee.amount,
            date: new Date().toISOString().split('T')[0],
            method: newPayment.method,
            status: 'pagado',
            notes: newPayment.notes,
        });
        setShowNewPayment(false);
        setNewPayment({ patientId: '', feeId: '', method: 'efectivo', notes: '' });
        reload();
    };

    const handleMarkPending = (patientId: string, patientName: string, amount: number, feeName: string) => {
        financeService.recordPayment({
            patientId,
            patientName,
            feeId: 'manual',
            feeName,
            amount,
            date: new Date().toISOString().split('T')[0],
            method: 'efectivo',
            status: 'pendiente',
            dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        });
        reload();
    };

    if (!summary) return null;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center"><DollarSign size={20} className="text-emerald-600" /></div>
                    Finanzas
                </h2>
                <button onClick={() => setShowNewPayment(true)} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all">
                    <Plus size={16} /> Registrar Cobro
                </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-white rounded-xl p-1 shadow-sm border border-slate-200">
                {[
                    { id: 'dashboard' as const, label: 'Resumen', icon: TrendingUp },
                    { id: 'payments' as const, label: 'Movimientos', icon: CreditCard },
                    { id: 'fees' as const, label: 'Aranceles', icon: Banknote },
                ].map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 flex-1 py-2.5 px-4 rounded-lg text-sm font-bold transition-colors ${
                            activeTab === tab.id ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'
                        }`}>
                        <tab.icon size={16} /> {tab.label}
                    </button>
                ))}
            </div>

            {/* Dashboard Tab */}
            {activeTab === 'dashboard' && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center"><TrendingUp size={18} className="text-emerald-600" /></div>
                                <span className="text-xs font-bold text-slate-500">Ingresos Totales</span>
                            </div>
                            <p className="text-2xl font-bold text-slate-800">{financeService.formatCurrency(summary.totalRevenue)}</p>
                        </div>
                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center"><Clock size={18} className="text-amber-600" /></div>
                                <span className="text-xs font-bold text-slate-500">Pendientes</span>
                            </div>
                            <p className="text-2xl font-bold text-amber-600">{financeService.formatCurrency(summary.totalPending)}</p>
                        </div>
                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center"><AlertTriangle size={18} className="text-red-600" /></div>
                                <span className="text-xs font-bold text-slate-500">Vencidos</span>
                            </div>
                            <p className="text-2xl font-bold text-red-600">{financeService.formatCurrency(summary.totalOverdue)}</p>
                        </div>
                        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center"><ArrowUpRight size={18} className="text-blue-600" /></div>
                                <span className="text-xs font-bold text-slate-500">Este Mes</span>
                            </div>
                            <p className="text-2xl font-bold text-blue-600">{financeService.formatCurrency(summary.revenueThisMonth)}</p>
                            <p className="text-[10px] text-slate-400">{summary.paymentsThisMonth} cobros</p>
                        </div>
                    </div>

                    {summary.patientDebts.length > 0 && (
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-3"><Users size={16} /> Deudores</h3>
                            <div className="space-y-2">
                                {summary.patientDebts.map(d => (
                                    <div key={d.patientId} className="flex items-center justify-between p-3 bg-red-50 rounded-xl border border-red-100">
                                        <div>
                                            <p className="text-sm font-bold text-slate-800">{d.patientName}</p>
                                            <p className="text-[10px] text-red-500">{d.count} pago{d.count > 1 ? 's' : ''} pendiente{d.count > 1 ? 's' : ''}</p>
                                        </div>
                                        <span className="text-sm font-bold text-red-600">{financeService.formatCurrency(d.total)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Payments Tab */}
            {activeTab === 'payments' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-4 border-b border-slate-200">
                        <h3 className="font-bold text-slate-800">Últimos Movimientos</h3>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {recentPayments.length === 0 ? (
                            <p className="p-6 text-center text-sm text-slate-400">No hay movimientos registrados.</p>
                        ) : recentPayments.map(p => (
                            <div key={p.id} className="flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                                    p.status === 'pagado' ? 'bg-emerald-100' : p.status === 'vencido' ? 'bg-red-100' : 'bg-amber-100'
                                }`}>
                                    {p.status === 'pagado' ? <ArrowDownRight size={18} className="text-emerald-600" /> :
                                     p.status === 'vencido' ? <AlertTriangle size={18} className="text-red-600" /> :
                                     <Clock size={18} className="text-amber-600" />}
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-bold text-slate-800">{p.patientName}</p>
                                    <p className="text-xs text-slate-500">{p.feeName} · {p.method}</p>
                                </div>
                                <div className="text-right">
                                    <p className={`text-sm font-bold ${p.status === 'pagado' ? 'text-emerald-600' : p.status === 'vencido' ? 'text-red-600' : 'text-amber-600'}`}>
                                        {financeService.formatCurrency(p.amount)}
                                    </p>
                                    <p className="text-[10px] text-slate-400">{p.date}</p>
                                </div>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    p.status === 'pagado' ? 'bg-emerald-100 text-emerald-700' : p.status === 'vencido' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                                }`}>{p.status}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Fees Tab */}
            {activeTab === 'fees' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {fees.filter(f => f.active).map(fee => (
                        <div key={fee.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                            <div className="flex items-center justify-between mb-3">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    fee.category === 'consulta' ? 'bg-blue-100 text-blue-700' :
                                    fee.category === 'evaluacion' ? 'bg-purple-100 text-purple-700' :
                                    fee.category === 'tratamiento' ? 'bg-emerald-100 text-emerald-700' :
                                    'bg-slate-100 text-slate-700'
                                }`}>{fee.category}</span>
                            </div>
                            <h4 className="font-bold text-slate-800 mb-1">{fee.name}</h4>
                            <p className="text-xs text-slate-500 mb-3">{fee.description}</p>
                            <p className="text-xl font-bold text-emerald-600">{financeService.formatCurrency(fee.amount)}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* New Payment Modal */}
            {showNewPayment && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
                        <h3 className="font-bold text-lg mb-4">Registrar Cobro</h3>
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-bold text-slate-500 block mb-1">Paciente</label>
                                <select value={newPayment.patientId} onChange={e => setNewPayment(p => ({ ...p, patientId: e.target.value }))}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none">
                                    <option value="">Seleccionar paciente</option>
                                    {patients.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 block mb-1">Concepto</label>
                                <select value={newPayment.feeId} onChange={e => setNewPayment(p => ({ ...p, feeId: e.target.value }))}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none">
                                    <option value="">Seleccionar concepto</option>
                                    {fees.filter(f => f.active).map(f => <option key={f.id} value={f.id}>{f.name} - {financeService.formatCurrency(f.amount)}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 block mb-1">Método de pago</label>
                                <select value={newPayment.method} onChange={e => setNewPayment(p => ({ ...p, method: e.target.value as any }))}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none">
                                    <option value="efectivo">Efectivo</option>
                                    <option value="transferencia">Transferencia</option>
                                    <option value="tarjeta">Tarjeta</option>
                                    <option value="debito">Débito</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 block mb-1">Notas</label>
                                <input value={newPayment.notes} onChange={e => setNewPayment(p => ({ ...p, notes: e.target.value }))}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm outline-none" placeholder="Opcional" />
                            </div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button onClick={() => setShowNewPayment(false)} className="flex-1 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl">Cancelar</button>
                            <button onClick={handleRecordPayment} disabled={!newPayment.patientId || !newPayment.feeId}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 disabled:opacity-50">
                                <Check size={16} /> Registrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

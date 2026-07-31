import React, { useState, useMemo } from 'react';
import { Calculator, ChevronDown, ChevronUp, BarChart3, AlertTriangle, CheckCircle2, Info, FileText } from 'lucide-react';
import { TEST_DEFINITIONS, evaluateTest, generateScoringSummary, TestResult, TestDefinition } from '../services/StandardizedTestsService';
import { Patient } from '../types';

interface TestScoringPanelProps {
    patient: Patient;
    onApplyResults?: (results: TestResult[], summary: string) => void;
}

export const TestScoringPanel: React.FC<TestScoringPanelProps> = ({ patient, onApplyResults }) => {
    const [selectedTestId, setSelectedTestId] = useState<string>('');
    const [scores, setScores] = useState<Record<string, number>>({});
    const [showResults, setShowResults] = useState(false);

    const test = selectedTestId ? TEST_DEFINITIONS[selectedTestId] : null;

    const results = useMemo(() => {
        if (!selectedTestId) return [];
        return evaluateTest(selectedTestId, scores, patient.age);
    }, [selectedTestId, scores, patient.age]);

    const summary = useMemo(() => generateScoringSummary(results), [results]);

    const avgPercentile = results.length > 0
        ? Math.round(results.reduce((sum, r) => sum + r.percentile, 0) / results.length)
        : 0;

    const getClassColor = (classification: string) => {
        switch (classification) {
            case 'Muy alto': case 'Alto': return 'text-emerald-600 bg-emerald-50 border-emerald-200';
            case 'Medio alto': case 'Medio': return 'text-blue-600 bg-blue-50 border-blue-200';
            case 'Medio bajo': return 'text-amber-600 bg-amber-50 border-amber-200';
            case 'Bajo': case 'Muy bajo': return 'text-red-600 bg-red-50 border-red-200';
            default: return 'text-slate-600 bg-slate-50 border-slate-200';
        }
    };

    const getPercentileBarColor = (p: number) => {
        if (p >= 84) return 'bg-emerald-500';
        if (p >= 50) return 'bg-blue-500';
        if (p >= 16) return 'bg-amber-500';
        return 'bg-red-500';
    };

    const handleApply = () => {
        if (onApplyResults && results.length > 0) {
            onApplyResults(results, summary);
        }
    };

    return (
        <div className="space-y-4">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <div className="flex items-center gap-2 mb-3">
                    <Calculator size={18} className="text-indigo-600" />
                    <h3 className="font-bold text-slate-800">Tests Estandarizados</h3>
                </div>

                <label className="text-xs font-bold text-slate-500 block mb-1">Seleccionar Test</label>
                <select
                    value={selectedTestId}
                    onChange={(e) => { setSelectedTestId(e.target.value); setScores({}); setShowResults(false); }}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-400"
                >
                    <option value="">-- Elegí un test --</option>
                    {Object.values(TEST_DEFINITIONS).map(t => (
                        <option key={t.id} value={t.id}>{t.name} ({t.acronym})</option>
                    ))}
                </select>

                {test && (
                    <div className="mt-3 p-3 bg-indigo-50 rounded-lg border border-indigo-100">
                        <p className="text-xs text-indigo-700 font-medium">{test.description}</p>
                        <div className="flex gap-3 mt-2 text-[10px] text-indigo-500">
                            <span>Edad: {test.ageRange.min}-{test.ageRange.max} años</span>
                            <span>Duración: {test.applicationTime}</span>
                            <span>Área: {test.area.replace(/_/g, ' ')}</span>
                        </div>
                    </div>
                )}
            </div>

            {test && (
                <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
                    <h4 className="font-bold text-sm text-slate-800 mb-3">Cargar Puntuaciones</h4>
                    <div className="space-y-3">
                        {test.subtests.map(sub => (
                            <div key={sub.id}>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-xs font-bold text-slate-600">{sub.name}</label>
                                    <span className="text-[10px] text-slate-400">Max: {sub.maxScore}</span>
                                </div>
                                <input
                                    type="number"
                                    min={0}
                                    max={sub.maxScore}
                                    value={scores[sub.id] || ''}
                                    onChange={(e) => setScores(prev => ({ ...prev, [sub.id]: Math.min(Number(e.target.value), sub.maxScore) }))}
                                    placeholder="0"
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-indigo-400 transition-colors"
                                />
                            </div>
                        ))}
                    </div>

                    <button
                        onClick={() => setShowResults(true)}
                        disabled={Object.values(scores).every(v => v === undefined || v === null || v === '')}
                        className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <BarChart3 size={16} /> Calcular Resultados
                    </button>
                </div>
            )}

            {showResults && results.length > 0 && (
                <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                        <h4 className="font-bold text-sm text-slate-800">Resultados</h4>
                        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getClassColor(
                            avgPercentile >= 84 ? 'Alto' : avgPercentile >= 50 ? 'Medio' : avgPercentile >= 16 ? 'Medio bajo' : 'Bajo'
                        )}`}>
                            Percentil Promedio: {avgPercentile}
                        </span>
                    </div>

                    {results.map(r => (
                        <div key={r.subtestId} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-bold text-slate-700">{r.subtestName}</span>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getClassColor(r.classification)}`}>
                                    {r.classification}
                                </span>
                            </div>
                            <div className="flex items-center gap-4 mb-2">
                                <div className="text-center">
                                    <p className="text-lg font-bold text-slate-800">{r.rawScore}/{r.maxScore}</p>
                                    <p className="text-[10px] text-slate-400">Puntuación</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-lg font-bold text-slate-800">{r.percentage}%</p>
                                    <p className="text-[10px] text-slate-400">Porcentaje</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-lg font-bold text-indigo-600">P{r.percentile}</p>
                                    <p className="text-[10px] text-slate-400">Percentil</p>
                                </div>
                                <div className="flex-1">
                                    <div className="w-full bg-slate-200 rounded-full h-2">
                                        <div className={`h-2 rounded-full transition-all ${getPercentileBarColor(r.percentile)}`}
                                            style={{ width: `${Math.min(r.percentile, 100)}%` }} />
                                    </div>
                                    <div className="flex justify-between text-[8px] text-slate-400 mt-0.5">
                                        <span>0</span><span>P16</span><span>P50</span><span>P84</span><span>P99</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="flex items-center gap-2 mb-2">
                            <FileText size={14} className="text-slate-500" />
                            <span className="text-xs font-bold text-slate-600">Resumen para Informe</span>
                        </div>
                        <div className="text-xs text-slate-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: summary }} />
                    </div>

                    {onApplyResults && (
                        <button
                            onClick={handleApply}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all"
                        >
                            <CheckCircle2 size={16} /> Aplicar al Informe
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

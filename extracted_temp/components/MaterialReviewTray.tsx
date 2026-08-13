import React, { useState, useEffect } from 'react';
import { Inbox, CheckCircle2, XCircle, Clock, Loader2, Eye, Trash2, Filter } from 'lucide-react';
import { MultimediaPipelineService } from '../services/MultimediaPipelineService';
import {
  GeneratedMaterial,
  MaterialStatus,
  MATERIAL_TYPE_LABELS,
  MATERIAL_TYPE_ICONS,
} from '../types/multimedia';

interface MaterialReviewTrayProps {
  userId: string;
  userName: string;
  patientId?: string;
  onMaterialApproved?: (material: GeneratedMaterial) => void;
  onMaterialRejected?: (material: GeneratedMaterial) => void;
}

type TrayFilter = 'all' | 'pending' | 'approved' | 'rejected';

export function MaterialReviewTray({
  userId, userName, patientId, onMaterialApproved, onMaterialRejected
}: MaterialReviewTrayProps) {
  const [materials, setMaterials] = useState<GeneratedMaterial[]>([]);
  const [filter, setFilter] = useState<TrayFilter>('all');
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadMaterials();
  }, [patientId]);

  function loadMaterials() {
    const all = patientId
      ? MultimediaPipelineService.getMaterialsForPatient(patientId)
      : MultimediaPipelineService.getAllMaterials();
    setMaterials(all);
  }

  const filtered = filter === 'all'
    ? materials
    : filter === 'pending'
    ? materials.filter(m => m.status === 'ready')
    : materials.filter(m => m.status === filter);

  const pendingCount = materials.filter(m => m.status === 'ready').length;

  const handleApprove = async (materialId: string) => {
    setLoading(prev => ({ ...prev, [materialId]: true }));
    await MultimediaPipelineService.approveMaterial(materialId, userId, userName);
    loadMaterials();
    setLoading(prev => ({ ...prev, [materialId]: false }));
    const material = materials.find(m => m.id === materialId);
    if (material) onMaterialApproved?.({ ...material, status: 'approved' });
  };

  const handleReject = async (materialId: string) => {
    setLoading(prev => ({ ...prev, [materialId]: true }));
    await MultimediaPipelineService.rejectMaterial(materialId, userId, userName, 'No cumple con el objetivo clínico');
    loadMaterials();
    setLoading(prev => ({ ...prev, [materialId]: false }));
    const material = materials.find(m => m.id === materialId);
    if (material) onMaterialRejected?.({ ...material, status: 'rejected' });
  };

  const statusConfig: Record<MaterialStatus, { icon: React.ReactNode; color: string; label: string }> = {
    pending: { icon: <Clock size={12} />, color: 'text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800', label: 'Pendiente' },
    generating: { icon: <Loader2 size={12} className="animate-spin" />, color: 'text-blue-500 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30', label: 'Generando' },
    ready: { icon: <Eye size={12} />, color: 'text-amber-500 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30', label: 'Pendiente Revisión' },
    approved: { icon: <CheckCircle2 size={12} />, color: 'text-emerald-500 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30', label: 'Aprobado' },
    rejected: { icon: <XCircle size={12} />, color: 'text-red-500 dark:text-red-400 bg-red-100 dark:bg-red-900/30', label: 'Rechazado' },
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl" data-testid="material-review-tray">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Inbox size={16} className="text-blue-600 dark:text-blue-400" />
          <h4 className="font-bold text-sm text-slate-800 dark:text-white">Bandeja de Revisión</h4>
          <span className="px-1.5 py-0.5 text-[8px] font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 rounded">STUB</span>
          {pendingCount > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 rounded-full" data-testid="pending-count">
              {pendingCount} pendiente{pendingCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1" data-testid="filter-buttons">
          {(['all', 'pending', 'approved', 'rejected'] as TrayFilter[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-2 py-1 text-[10px] font-bold rounded-lg transition-colors ${
                filter === f
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                  : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
              data-testid={`filter-${f}`}
            >
              {f === 'all' ? 'Todos' : f === 'pending' ? 'Pendientes' : f === 'approved' ? 'Aprobados' : 'Rechazados'}
            </button>
          ))}
        </div>
      </div>

      {/* Materials List */}
      <div className="max-h-96 overflow-y-auto" data-testid="materials-list">
        {filtered.length === 0 ? (
          <div className="p-6 text-center text-slate-400 dark:text-slate-500 text-sm">
            No hay materiales {filter !== 'all' ? `en estado "${filter}"` : 'aún'}.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {filtered.map(material => (
              <div
                key={material.id}
                className="p-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                data-testid="material-item"
              >
                <div className="flex items-start gap-3">
                  {/* Thumbnail */}
                  <div className="w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-lg flex-shrink-0 overflow-hidden">
                    {material.image_url ? (
                      <img
                        src={material.image_url}
                        alt={material.title}
                        className="w-full h-full object-cover"
                        onError={e => {
                          (e.target as HTMLImageElement).style.display = 'none';
                          (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                        }}
                      />
                    ) : null}
                    <span className={material.image_url ? 'hidden' : ''}>
                      {MATERIAL_TYPE_ICONS[material.material_type]}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">{material.title}</span>
                      <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded-full flex items-center gap-0.5 ${statusConfig[material.status].color}`}>
                        {statusConfig[material.status].icon}
                        {statusConfig[material.status].label}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">{material.description}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">
                        {MATERIAL_TYPE_LABELS[material.material_type]}
                      </span>
                      <span className="text-[10px] text-slate-300 dark:text-slate-600">·</span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">
                        {material.patient_name}
                      </span>
                      <span className="text-[10px] text-slate-300 dark:text-slate-600">·</span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">
                        {new Date(material.created_at).toLocaleDateString('es-CL')}
                      </span>
                    </div>

                    {/* Source reference */}
                    {material.source_reference && (
                      <div className="mt-1 text-[10px] text-blue-500 dark:text-blue-400">
                        📚 {material.source_reference}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {material.status === 'ready' && (
                    <div className="flex items-center gap-1 flex-shrink-0" data-testid="material-actions">
                      <button
                        onClick={() => handleApprove(material.id)}
                        disabled={loading[material.id]}
                        className="p-1.5 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded-lg transition-colors disabled:opacity-50"
                        title="Aprobar"
                        data-testid="approve-button"
                      >
                        {loading[material.id] ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                      </button>
                      <button
                        onClick={() => handleReject(material.id)}
                        disabled={loading[material.id]}
                        className="p-1.5 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
                        title="Rechazar"
                        data-testid="reject-button"
                      >
                        <XCircle size={14} />
                      </button>
                    </div>
                  )}

                  {/* Approval info */}
                  {material.status === 'approved' && material.approved_by_name && (
                    <div className="text-right flex-shrink-0">
                      <div className="text-[10px] text-emerald-600 dark:text-emerald-400">✓ {material.approved_by_name}</div>
                      <div className="text-[9px] text-slate-400 dark:text-slate-500">
                        {material.approved_at ? new Date(material.approved_at).toLocaleDateString('es-CL') : ''}
                      </div>
                    </div>
                  )}

                  {material.status === 'rejected' && material.rejected_by_name && (
                    <div className="text-right flex-shrink-0">
                      <div className="text-[10px] text-red-500 dark:text-red-400">✗ {material.rejected_by_name}</div>
                      <div className="text-[9px] text-slate-400 dark:text-slate-500">
                        {material.rejected_at ? new Date(material.rejected_at).toLocaleDateString('es-CL') : ''}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

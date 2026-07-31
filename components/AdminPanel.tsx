import React, { useState, useEffect } from 'react';
import { Users, Building2, ShieldCheck, UserCheck, UserX, Plus, Trash2, Edit3, X, ChevronDown, ChevronUp, Loader2, AlertTriangle, FileText } from 'lucide-react';
import { ProfileService, Profile, UserRole } from '../services/ProfileService';
import { supabase } from '../utils/supabaseClient';
import ClinicalTemplatesManager from './ClinicalTemplatesManager';

interface Consultorio {
  id: string;
  name: string;
  color: string;
  icon: string;
  is_active: boolean;
  created_at: string;
}

const ROLE_OPTIONS: { value: UserRole; label: string; color: string }[] = [
  { value: 'admin', label: 'Admin', color: 'bg-purple-100 text-purple-700' },
  { value: 'profesional', label: 'Profesional', color: 'bg-blue-100 text-blue-700' },
  { value: 'supervisor', label: 'Supervisor', color: 'bg-amber-100 text-amber-700' },
  { value: 'secretaria', label: 'Secretaría', color: 'bg-cyan-100 text-cyan-700' },
];

const CONSULTORIO_COLORS = ['blue', 'purple', 'emerald', 'cyan', 'amber', 'rose', 'indigo', 'teal'];

export default function AdminPanel({ onAccessDenied }: { onAccessDenied?: () => void }) {
  const [activeTab, setActiveTab] = useState<'users' | 'consultorios' | 'templates'>('users');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [consultorios, setConsultorios] = useState<Consultorio[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editingConsultorio, setEditingConsultorio] = useState<string | null>(null);
  const [newConsultorio, setNewConsultorio] = useState(false);

  useEffect(() => {
    checkAdminAndLoad();
  }, []);

  async function checkAdminAndLoad() {
    setLoading(true);
    try {
      const profile = await ProfileService.getCurrent();
      if (!profile || profile.role !== 'admin') {
        setIsAdmin(false);
        setLoading(false);
        return;
      }
      setIsAdmin(true);
      await loadData();
    } catch (e) {
      console.error('[AdminPanel] Error:', e);
      setIsAdmin(false);
      setLoading(false);
    }
  }

  async function loadData() {
    try {
      const [p, c] = await Promise.all([
        ProfileService.getAll(),
        supabase.from('consultorios').select('*').order('name'),
      ]);
      setProfiles(p);
      setConsultorios(c.data || []);
    } catch (e) {
      console.error('[AdminPanel] Error loading data:', e);
    }
    setLoading(false);
  }

  async function handleRoleChange(userId: string, newRole: UserRole) {
    try {
      await ProfileService.updateRole(userId, newRole);
      setProfiles(prev => prev.map(p => p.id === userId ? { ...p, role: newRole } : p));
    } catch (e) {
      console.error('[AdminPanel] Error updating role:', e);
    }
  }

  async function handleConsultorioToggle(userId: string, consultorioId: string) {
    const user = profiles.find(p => p.id === userId);
    if (!user) return;
    const current = user.consultorio_ids || [];
    const updated = current.includes(consultorioId)
      ? current.filter(id => id !== consultorioId)
      : [...current, consultorioId];
    try {
      await ProfileService.updateConsultorios(userId, updated);
      setProfiles(prev => prev.map(p => p.id === userId ? { ...p, consultorio_ids: updated } : p));
    } catch (e) {
      console.error('[AdminPanel] Error updating consultorios:', e);
    }
  }

  async function handleToggleActive(userId: string, isActive: boolean) {
    try {
      await ProfileService.updateProfile(userId, { is_active: !isActive });
      setProfiles(prev => prev.map(p => p.id === userId ? { ...p, is_active: !isActive } : p));
    } catch (e) {
      console.error('[AdminPanel] Error toggling active:', e);
    }
  }

  async function handleCreateConsultorio(data: { id: string; name: string; color: string; icon: string }) {
    try {
      const { error } = await supabase.from('consultorios').insert(data);
      if (error) throw error;
      setConsultorios(prev => [...prev, { ...data, is_active: true, created_at: new Date().toISOString() }]);
      setNewConsultorio(false);
    } catch (e) {
      console.error('[AdminPanel] Error creating consultorio:', e);
    }
  }

  async function handleUpdateConsultorio(id: string, updates: Partial<Consultorio>) {
    try {
      const { error } = await supabase.from('consultorios').update(updates).eq('id', id);
      if (error) throw error;
      setConsultorios(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
      setEditingConsultorio(null);
    } catch (e) {
      console.error('[AdminPanel] Error updating consultorio:', e);
    }
  }

  async function handleDeleteConsultorio(id: string) {
    if (!confirm('¿Eliminar este consultorio?')) return;
    try {
      const { error } = await supabase.from('consultorios').delete().eq('id', id);
      if (error) throw error;
      setConsultorios(prev => prev.filter(c => c.id !== id));
    } catch (e) {
      console.error('[AdminPanel] Error deleting consultorio:', e);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  if (isAdmin === false) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <AlertTriangle className="text-red-500" size={48} />
        <h2 className="text-xl font-bold text-red-600">Acceso Denegado</h2>
        <p className="text-sm text-slate-500 text-center max-w-md">
          No tenés permisos de administrador para acceder a esta sección.
        </p>
        {onAccessDenied && (
          <button
            onClick={onAccessDenied}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Volver al Dashboard
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
          <ShieldCheck size={24} /> Administración
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Gestiona usuarios, roles y consultorios</p>
      </div>

      <div className="flex border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'users'
              ? 'border-blue-500 text-blue-600 bg-blue-50'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          <Users size={16} /> Usuarios ({profiles.length})
        </button>
            <button
              onClick={() => setActiveTab('consultorios')}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'consultorios'
                  ? 'border-blue-500 text-blue-600 bg-blue-50'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              <Building2 size={16} /> Consultorios ({consultorios.length})
            </button>
            <button
              onClick={() => setActiveTab('templates')}
              className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'templates'
                  ? 'border-blue-500 text-blue-600 bg-blue-50'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              <FileText size={16} /> Plantillas Clínicas
            </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'users' && (
          <UsersTab
            profiles={profiles}
            consultorios={consultorios}
            editingUser={editingUser}
            setEditingUser={setEditingUser}
            onRoleChange={handleRoleChange}
            onConsultorioToggle={handleConsultorioToggle}
            onToggleActive={handleToggleActive}
          />
        )}
        {activeTab === 'consultorios' && (
          <ConsultoriosTab
            consultorios={consultorios}
            editingConsultorio={editingConsultorio}
            setEditingConsultorio={setEditingConsultorio}
            newConsultorio={newConsultorio}
            setNewConsultorio={setNewConsultorio}
            onCreate={handleCreateConsultorio}
            onUpdate={handleUpdateConsultorio}
            onDelete={handleDeleteConsultorio}
          />
        )}
        {activeTab === 'templates' && (
          <ClinicalTemplatesManager />
        )}
      </div>
    </div>
  );
}

function UsersTab({
  profiles, consultorios, editingUser, setEditingUser,
  onRoleChange, onConsultorioToggle, onToggleActive,
}: {
  profiles: Profile[];
  consultorios: Consultorio[];
  editingUser: string | null;
  setEditingUser: (id: string | null) => void;
  onRoleChange: (userId: string, role: UserRole) => void;
  onConsultorioToggle: (userId: string, consultorioId: string) => void;
  onToggleActive: (userId: string, isActive: boolean) => void;
}) {
  return (
    <div className="space-y-3">
      {profiles.map(user => (
        <div key={user.id} className={`border rounded-xl p-4 transition-all ${user.is_active ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 opacity-60'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-sm">
                {user.full_name?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div>
                <p className="font-bold text-slate-800 dark:text-white text-sm">{user.full_name || 'Sin nombre'}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">{user.email}</p>
              </div>
              <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${ROLE_OPTIONS.find(r => r.value === user.role)?.color || 'bg-slate-100 dark:bg-slate-800'}`}>
                {ROLE_OPTIONS.find(r => r.value === user.role)?.label || user.role}
              </span>
              {!user.is_active && (
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-red-100 text-red-600">Inactivo</span>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setEditingUser(editingUser === user.id ? null : user.id)}
                className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              >
                <Edit3 size={14} />
              </button>
              <button
                onClick={() => onToggleActive(user.id, user.is_active)}
                className={`p-1.5 rounded-lg transition-colors ${user.is_active ? 'text-slate-400 dark:text-slate-500 hover:text-red-600 hover:bg-red-50' : 'text-slate-400 dark:text-slate-500 hover:text-green-600 hover:bg-green-50'}`}
              >
                {user.is_active ? <UserX size={14} /> : <UserCheck size={14} />}
              </button>
            </div>
          </div>

          {editingUser === user.id && (
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">Rol</label>
                <div className="flex gap-2 flex-wrap">
                  {ROLE_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => onRoleChange(user.id, opt.value)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                        user.role === opt.value
                          ? `${opt.color} border-current`
                          : 'border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">Consultorios asignados</label>
                <div className="flex gap-2 flex-wrap">
                  {consultorios.map(c => (
                    <button
                      key={c.id}
                      onClick={() => onConsultorioToggle(user.id, c.id)}
                      className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                        (user.consultorio_ids || []).includes(c.id)
                          ? 'bg-blue-100 text-blue-700 border-blue-300'
                          : 'border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                    >
                      {c.icon} {c.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ConsultoriosTab({
  consultorios, editingConsultorio, setEditingConsultorio,
  newConsultorio, setNewConsultorio, onCreate, onUpdate, onDelete,
}: {
  consultorios: Consultorio[];
  editingConsultorio: string | null;
  setEditingConsultorio: (id: string | null) => void;
  newConsultorio: boolean;
  setNewConsultorio: (v: boolean) => void;
  onCreate: (data: { id: string; name: string; color: string; icon: string }) => void;
  onUpdate: (id: string, updates: Partial<Consultorio>) => void;
  onDelete: (id: string) => void;
}) {
  const [formName, setFormName] = useState('');
  const [formColor, setFormColor] = useState('blue');
  const [formIcon, setFormIcon] = useState('🏥');

  function handleCreate() {
    if (!formName.trim()) return;
    const id = formName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    onCreate({ id, name: formName.trim(), color: formColor, icon: formIcon });
    setFormName('');
    setFormColor('blue');
    setFormIcon('🏥');
  }

  return (
    <div className="space-y-3">
      {newConsultorio && (
        <div className="border border-blue-200 rounded-xl p-4 bg-blue-50 space-y-3">
          <input
            value={formName}
            onChange={e => setFormName(e.target.value)}
            placeholder="Nombre del consultorio"
            className="w-full p-2 border rounded-lg text-sm"
            autoFocus
          />
          <div className="flex gap-4">
            <div>
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">Color</label>
              <div className="flex gap-1">
                {CONSULTORIO_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setFormColor(c)}
                    className={`w-6 h-6 rounded-full border-2 transition-all ${
                      formColor === c ? 'border-slate-800 scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: `var(--color-${c}-400, #60a5fa)` }}
                  />
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-1 block">Icono</label>
              <input
                value={formIcon}
                onChange={e => setFormIcon(e.target.value)}
                className="w-16 p-1 border rounded text-center text-lg"
                maxLength={2}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700">Crear</button>
            <button onClick={() => setNewConsultorio(false)} className="px-4 py-2 text-slate-500 dark:text-slate-400 text-xs font-bold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">Cancelar</button>
          </div>
        </div>
      )}

      {consultorios.map(c => (
        <div key={c.id} className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 bg-white dark:bg-slate-900 flex items-center justify-between">
          {editingConsultorio === c.id ? (
            <EditConsultorioForm
              consultorio={c}
              onSave={(updates) => onUpdate(c.id, updates)}
              onCancel={() => setEditingConsultorio(null)}
            />
          ) : (
            <>
              <div className="flex items-center gap-3">
                <span className="text-xl">{c.icon}</span>
                <div>
                  <p className="font-bold text-sm text-slate-800 dark:text-white">{c.name}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">{c.id}</p>
                </div>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">{c.color}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setEditingConsultorio(c.id)} className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg">
                  <Edit3 size={14} />
                </button>
                <button onClick={() => onDelete(c.id)} className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg">
                  <Trash2 size={14} />
                </button>
              </div>
            </>
          )}
        </div>
      ))}

      {!newConsultorio && (
        <button
          onClick={() => setNewConsultorio(true)}
          className="w-full p-3 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-400 dark:text-slate-500 hover:border-blue-300 hover:text-blue-500 transition-colors flex items-center justify-center gap-2"
        >
          <Plus size={16} /> Nuevo Consultorio
        </button>
      )}
    </div>
  );
}

function EditConsultorioForm({
  consultorio, onSave, onCancel,
}: {
  consultorio: Consultorio;
  onSave: (updates: Partial<Consultorio>) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(consultorio.name);
  const [color, setColor] = useState(consultorio.color);
  const [icon, setIcon] = useState(consultorio.icon);

  return (
    <div className="flex-1 space-y-3">
      <input value={name} onChange={e => setName(e.target.value)} className="w-full p-2 border rounded-lg text-sm" autoFocus />
      <div className="flex gap-4 items-center">
        <div className="flex gap-1">
          {CONSULTORIO_COLORS.map(c => (
            <button key={c} onClick={() => setColor(c)} className={`w-5 h-5 rounded-full border-2 ${color === c ? 'border-slate-800' : 'border-transparent'}`} style={{ backgroundColor: `var(--color-${c}-400, #60a5fa)` }} />
          ))}
        </div>
        <input value={icon} onChange={e => setIcon(e.target.value)} className="w-12 p-1 border rounded text-center text-sm" maxLength={2} />
        <div className="flex gap-2 ml-auto">
          <button onClick={() => onSave({ name, color, icon })} className="px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded-lg">Guardar</button>
          <button onClick={onCancel} className="px-3 py-1 text-slate-400 dark:text-slate-500 text-xs font-bold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">Cancelar</button>
        </div>
      </div>
    </div>
  );
}

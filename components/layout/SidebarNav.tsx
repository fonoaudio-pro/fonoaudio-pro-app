import React from "react";
import {
  Bot, Home, Users, Calendar, ShieldCheck, TrendingUp, BarChart3,
  FileBarChart, PenTool, BookOpen, Sparkles, Settings, Zap, Mic, MicOff
} from "lucide-react";
import { ViewType } from "../../types/views";
import { UserProfile } from "../../services/GoogleAuthService";
import { GoogleAuthService } from "../../services/GoogleAuthService";

interface SidebarNavProps {
  currentView: ViewType;
  onNavigate: (view: ViewType) => void;
  isAssistantOpen: boolean;
  onToggleAssistant: () => void;
  showTemplateManager: boolean;
  onToggleTemplateManager: () => void;
  showQuickMode: boolean;
  onToggleQuickMode: () => void;
  userProfile: UserProfile | null;
  dbProfile: { role: string; consultorio_ids: string[] } | null;
  session: any;
  isGoogleConnected: boolean;
  onSignOut: () => void;
}

const SidebarNav = ({
  currentView,
  onNavigate,
  isAssistantOpen,
  onToggleAssistant,
  showTemplateManager,
  onToggleTemplateManager,
  showQuickMode,
  onToggleQuickMode,
  userProfile,
  dbProfile,
  session,
  isGoogleConnected,
  onSignOut,
}: SidebarNavProps) => {
  const isAdmin = dbProfile?.role === 'admin' || session?.user?.id === '00000000-0000-0000-0000-000000000001';

  const navItems: { view: ViewType; icon: React.ReactNode; label: string }[] = [
    { view: 'dashboard', icon: <Home size={20} />, label: 'Dashboard' },
    { view: 'patients', icon: <Users size={20} />, label: 'Pacientes' },
    { view: 'agenda', icon: <Calendar size={20} />, label: 'Agenda' },
    { view: 'followup', icon: <ShieldCheck size={20} />, label: 'Seguimiento' },
    { view: 'metrics', icon: <TrendingUp size={20} />, label: 'Métricas IA' },
    { view: 'analytics', icon: <BarChart3 size={20} />, label: 'Analytics' },
    { view: 'reports', icon: <FileBarChart size={20} />, label: 'Informes' },
    { view: 'library', icon: <BookOpen size={20} />, label: 'Biblioteca' },
    { view: 'multimedia', icon: <Sparkles size={20} />, label: 'Multimedia' },
    { view: 'vocalislab', icon: <Mic size={20} />, label: 'VocalisLab' },
  ];

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col z-20 shadow-sm">
      <div className="p-6 border-b border-slate-100 flex items-center gap-3">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white"><Bot size={20} /></div>
        <span className="font-bold text-xl text-slate-900 tracking-tight">Fono-Pro</span>
      </div>
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {navItems.map((item) => (
          <button
            key={item.view}
            onClick={() => onNavigate(item.view)}
            className={`flex items-center gap-3 w-full p-3 rounded-lg transition-all ${
              currentView === item.view
                ? "bg-blue-50 text-blue-700 font-medium"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            {item.icon} {item.label}
          </button>
        ))}

        <button
          onClick={onToggleTemplateManager}
          className={`flex items-center gap-3 w-full p-3 rounded-lg transition-all ${
            showTemplateManager
              ? "bg-indigo-50 text-indigo-700 font-medium"
              : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          <PenTool size={20} /> Plantillas IA
        </button>

        {isAdmin && (
          <button
            onClick={() => onNavigate('admin')}
            className={`flex items-center gap-3 w-full p-3 rounded-lg transition-all ${
              currentView === 'admin'
                ? "bg-blue-50 text-blue-700 font-medium"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            <Settings size={20} /> Administración
          </button>
        )}

        <div className="pt-2 border-t border-slate-100 mt-2">
          <button
            onClick={onToggleQuickMode}
            className="flex items-center gap-3 w-full p-3 rounded-lg transition-all bg-amber-50 text-amber-700 hover:bg-amber-100 font-medium border border-amber-200"
          >
            <Zap size={20} /> Modo Rápido
          </button>
        </div>
      </nav>

      {userProfile && (
        <div className="px-4 py-3 border-t border-slate-100">
          <div className="flex items-center gap-3 mb-3">
            {userProfile.avatarUrl ? (
              <img src={userProfile.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-bold">
                {userProfile.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-800 truncate">{userProfile.name}</p>
              <p className="text-[10px] text-slate-400 truncate">{userProfile.email}</p>
              <span className={`inline-block mt-1 px-1.5 py-0.5 text-[9px] font-bold rounded-full ${
                dbProfile?.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                dbProfile?.role === 'supervisor' ? 'bg-amber-100 text-amber-700' :
                dbProfile?.role === 'secretaria' ? 'bg-cyan-100 text-cyan-700' :
                session?.user?.id === '00000000-0000-0000-0000-000000000001'
                  ? 'bg-purple-100 text-purple-700'
                  : 'bg-blue-100 text-blue-700'
              }`}>
                {isAdmin
                  ? 'Admin'
                  : dbProfile?.role === 'supervisor' ? 'Supervisor'
                  : dbProfile?.role === 'secretaria' ? 'Secretaria'
                  : 'Profesional'}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            {isGoogleConnected && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-green-600 bg-green-50 px-2 py-1 rounded-lg">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span> Google
              </span>
            )}
            <button
              onClick={onSignOut}
              className="text-[10px] font-bold text-slate-400 hover:text-red-500 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors ml-auto"
            >
              Salir
            </button>
          </div>
        </div>
      )}

      <div className="p-4 border-t border-slate-100">
        <button
          onClick={onToggleAssistant}
          className={`w-full flex items-center justify-center gap-2 p-3 rounded-xl font-medium transition-all shadow-sm ${
            isAssistantOpen
              ? 'bg-red-50 text-red-600 border border-red-200'
              : 'bg-slate-900 text-white hover:bg-slate-800'
          }`}
        >
          {isAssistantOpen ? <><MicOff size={18} /> Cerrar IA</> : <><Mic size={18} /> Asistente IA</>}
        </button>
      </div>
    </aside>
  );
};

export default SidebarNav;

import React from "react";
import SidebarNav from "./SidebarNav";
import { ViewType } from "../../types/views";
import { UserProfile } from "../../services/GoogleAuthService";

interface AppShellProps {
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
  children: React.ReactNode;
}

const AppShell = ({
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
  children,
}: AppShellProps) => {
  return (
    <div className="flex h-screen bg-[#f3f4f6] text-slate-800 font-sans overflow-hidden">
      <SidebarNav
        currentView={currentView}
        onNavigate={onNavigate}
        isAssistantOpen={isAssistantOpen}
        onToggleAssistant={onToggleAssistant}
        showTemplateManager={showTemplateManager}
        onToggleTemplateManager={onToggleTemplateManager}
        showQuickMode={showQuickMode}
        onToggleQuickMode={onToggleQuickMode}
        userProfile={userProfile}
        dbProfile={dbProfile}
        session={session}
        isGoogleConnected={isGoogleConnected}
        onSignOut={onSignOut}
      />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
};

export default AppShell;

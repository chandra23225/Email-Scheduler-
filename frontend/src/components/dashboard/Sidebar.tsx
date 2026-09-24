'use client';

import { useAuth } from '@/context/AuthContext';
import { PenLine, Clock3, Send, Settings2 } from 'lucide-react';
import type { TabType } from '@/types';

interface SidebarProps {
  activeTab: TabType;
  onCompose: () => void;
  onTabChange: (tab: TabType) => void;
}

export function Sidebar({ activeTab, onCompose, onTabChange }: SidebarProps) {
  const { user } = useAuth();

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 border-r border-white/10 bg-slate-950/90 px-4 py-5 lg:flex lg:flex-col">
      <div className="flex items-center gap-2 px-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-cyan-400 text-sm font-bold text-white">O</div>
        <span className="text-lg font-semibold tracking-tight text-white">outbox</span>
      </div>

      <button
        onClick={onCompose}
        className="mt-8 flex w-full items-center justify-center gap-2 rounded-lg border border-violet-400/25 bg-violet-500/10 px-3 py-2.5 text-sm font-medium text-violet-200 transition-colors hover:bg-violet-500/20"
      >
        <PenLine className="h-4 w-4" />
        Compose
      </button>

      <nav className="mt-7 space-y-1" aria-label="Mailbox navigation">
        <button
          onClick={() => onTabChange('scheduled')}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm ${activeTab === 'scheduled' ? 'bg-violet-500/10 font-medium text-violet-200 border border-violet-400/20' : 'text-slate-300 hover:bg-slate-800/80'}`}
        >
          <Clock3 className="h-4 w-4" />
          Scheduled
        </button>
        <button
          onClick={() => onTabChange('sent')}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm ${activeTab === 'sent' ? 'bg-violet-500/10 font-medium text-violet-200 border border-violet-400/20' : 'text-slate-300 hover:bg-slate-800/80'}`}
        >
          <Send className="h-4 w-4" />
          Sent
        </button>
      </nav>

      <div className="mt-auto border-t border-white/10 pt-4">
        <div className="flex items-center gap-2 px-2 text-sm text-slate-300">
          {user?.avatar ? (
            <img src={user.avatar} alt="" className="h-7 w-7 rounded-full" />
          ) : (
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-500/15 text-xs font-semibold text-violet-200">
              {user?.name?.charAt(0) || 'U'}
            </span>
          )}
          <span className="min-w-0 flex-1 truncate">{user?.name || 'Workspace'}</span>
          <Settings2 className="h-4 w-4 text-slate-400" />
        </div>
      </div>
    </aside>
  );
}

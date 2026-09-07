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
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 border-r border-surface-border bg-white px-4 py-5 lg:flex lg:flex-col">
      <div className="flex items-center gap-2 px-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-500 text-sm font-bold text-white">O</div>
        <span className="text-lg font-semibold tracking-tight text-slate-900">outbox</span>
      </div>

      <button
        onClick={onCompose}
        className="mt-8 flex w-full items-center justify-center gap-2 rounded-lg border border-primary-200 bg-primary-50 px-3 py-2.5 text-sm font-medium text-primary-700 transition-colors hover:bg-primary-100"
      >
        <PenLine className="h-4 w-4" />
        Compose
      </button>

      <nav className="mt-7 space-y-1" aria-label="Mailbox navigation">
        <button
          onClick={() => onTabChange('scheduled')}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm ${activeTab === 'scheduled' ? 'bg-primary-50 font-medium text-primary-700' : 'text-slate-600 hover:bg-surface-hover'}`}
        >
          <Clock3 className="h-4 w-4" />
          Scheduled
        </button>
        <button
          onClick={() => onTabChange('sent')}
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm ${activeTab === 'sent' ? 'bg-primary-50 font-medium text-primary-700' : 'text-slate-600 hover:bg-surface-hover'}`}
        >
          <Send className="h-4 w-4" />
          Sent
        </button>
      </nav>

      <div className="mt-auto border-t border-surface-border pt-4">
        <div className="flex items-center gap-2 px-2 text-sm text-slate-600">
          {user?.avatar ? (
            <img src={user.avatar} alt="" className="h-7 w-7 rounded-full" />
          ) : (
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700">
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

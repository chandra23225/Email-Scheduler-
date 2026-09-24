'use client';

import { useAuth } from '@/context/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { slackApi } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { LogOut, Zap } from 'lucide-react';
import Image from 'next/image';
import toast from 'react-hot-toast';

export function Header() {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();

  const { data: slackStatus } = useQuery({
    queryKey: ['slack-status'],
    queryFn: slackApi.status,
    staleTime: 60_000,
  });

  const handleConnectSlack = async () => {
    try {
      const url = await slackApi.getConnectUrl();
      const popup = window.open(url, '_blank', 'width=600,height=700');
      // Poll until popup closes, then refresh status
      const interval = setInterval(() => {
        if (popup?.closed) {
          clearInterval(interval);
          queryClient.invalidateQueries({ queryKey: ['slack-status'] });
        }
      }, 500);
    } catch {
      toast.error('Failed to start Slack connection');
    }
  };

  const handleDisconnectSlack = async () => {
    try {
      await slackApi.disconnect();
      queryClient.invalidateQueries({ queryKey: ['slack-status'] });
      toast.success('Slack disconnected');
    } catch {
      toast.error('Failed to disconnect Slack');
    }
  };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/10 bg-slate-950/85 px-4 py-3 backdrop-blur-md lg:ml-60 lg:px-10">
      {/* Logo */}
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-cyan-400 text-sm font-bold text-white lg:hidden">
          O
        </div>
        <span className="font-semibold tracking-tight text-white lg:hidden">outbox</span>
        <span className="hidden text-xs text-slate-400 lg:inline">All mail / workspace</span>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Slack */}
        {slackStatus?.connected ? (
          <button
            onClick={handleDisconnectSlack}
            className="flex items-center gap-2 rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-200 transition-colors hover:border-emerald-400/40"
          >
            <span className="w-2 h-2 rounded-full bg-green-400" />
            Slack connected
          </button>
        ) : (
          <button
            onClick={handleConnectSlack}
            className="flex items-center gap-2 rounded-lg border border-white/10 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 transition-colors hover:border-violet-400/40 hover:text-white"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 15a2 2 0 0 1-2 2 2 2 0 0 1-2-2 2 2 0 0 1 2-2h2v2zm1 0a2 2 0 0 1 2-2 2 2 0 0 1 2 2v5a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-5zm2-9a2 2 0 0 1-2-2 2 2 0 0 1 2-2 2 2 0 0 1 2 2v2H9zm0 1a2 2 0 0 1 2 2 2 2 0 0 1-2 2H4a2 2 0 0 1-2-2 2 2 0 0 1 2-2h5zm9 2a2 2 0 0 1 2-2 2 2 0 0 1 2 2 2 2 0 0 1-2 2h-2V9zm-1 0a2 2 0 0 1-2 2 2 2 0 0 1-2-2V4a2 2 0 0 1 2-2 2 2 0 0 1 2 2v5zm-2 9a2 2 0 0 1 2 2 2 2 0 0 1-2 2 2 2 0 0 1-2-2v-2h2zm0-1a2 2 0 0 1-2-2 2 2 0 0 1 2-2h5a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-5z" />
            </svg>
            Connect Slack
          </button>
        )}

        {/* User info */}
        <div className="flex items-center gap-2 pl-3 border-l border-white/10">
          {user?.avatar ? (
            <Image
              src={user.avatar}
              alt={user.name}
              width={32}
              height={32}
              className="w-8 h-8 rounded-full ring-2 ring-white/10"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-violet-500/20 flex items-center justify-center text-sm font-medium text-violet-200">
              {user?.name?.charAt(0) || 'U'}
            </div>
          )}
          <div className="hidden sm:block">
            <p className="text-sm font-medium leading-none text-white">{user?.name}</p>
            <p className="text-xs text-slate-400 mt-0.5">{user?.email}</p>
          </div>
        </div>

        {/* Logout */}
        <Button
          variant="ghost"
          size="sm"
          onClick={logout}
          leftIcon={<LogOut className="w-4 h-4" />}
        >
          <span className="hidden sm:inline">Logout</span>
        </Button>
      </div>
    </header>
  );
}

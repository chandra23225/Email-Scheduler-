'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Header } from '@/components/dashboard/Header';
import { Sidebar } from '@/components/dashboard/Sidebar';
import { StatsBar } from '@/components/dashboard/StatsBar';
import { EmailTable } from '@/components/dashboard/EmailTable';
import { ComposeModal } from '@/components/dashboard/ComposeModal';
import { Button } from '@/components/ui/Button';
import type { TabType } from '@/types';
import { PenSquare, Clock, CheckCircle, ExternalLink } from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { Suspense } from 'react';

function DashboardContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabType>('scheduled');
  const [composeOpen, setComposeOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  // Handle Slack callback notifications
  useEffect(() => {
    const slackParam = searchParams.get('slack');
    if (slackParam === 'connected') {
      toast.success('Slack connected successfully!');
    } else if (slackParam === 'denied') {
      toast('Slack connection was denied', { icon: 'ℹ️' });
    } else if (slackParam === 'error') {
      toast.error('Slack connection failed');
    }
  }, [searchParams]);

  const tabs: { key: TabType; label: string; icon: React.ReactNode }[] = [
    { key: 'scheduled', label: 'Scheduled', icon: <Clock className="w-4 h-4" /> },
    { key: 'sent', label: 'Sent', icon: <CheckCircle className="w-4 h-4" /> },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#070b12] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-[#070b12] text-slate-100">
      <Sidebar
        activeTab={activeTab}
        onCompose={() => setComposeOpen(true)}
        onTabChange={setActiveTab}
      />
      <Header />

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-8 lg:ml-60 lg:px-10">
        {/* Page title + compose button */}
        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-5 animate-slide-up">
          <div>
            <p className="text-xs text-slate-400 mb-2">Workspace / outbound</p>
            <h1 className="text-2xl font-semibold tracking-tight text-white">Email workspace</h1>
            <p className="text-sm text-slate-400 mt-1 max-w-xl">Schedule and track your outreach from one focused inbox.</p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/admin/queues`}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-2 text-sm text-slate-300 hover:text-white transition-colors px-3 py-2 rounded-lg border border-white/10 bg-slate-900/70 hover:border-violet-400/40"
            >
              <ExternalLink className="w-4 h-4" />
              BullMQ Dashboard
            </a>
            <Button
              onClick={() => setComposeOpen(true)}
              leftIcon={<PenSquare className="w-4 h-4" />}
              size="md"
            >
              Compose New Email
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="animate-slide-up [animation-delay:80ms] py-5">
          <StatsBar />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-slate-900 border border-white/10 rounded-lg w-fit animate-slide-up [animation-delay:120ms]">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                  activeTab === tab.key
                  ? 'bg-violet-500/10 text-violet-200 border border-violet-400/20'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="animate-slide-up [animation-delay:160ms]">
          <EmailTable tab={activeTab} />
        </div>
      </main>

      {/* Compose modal */}
      <ComposeModal isOpen={composeOpen} onClose={() => setComposeOpen(false)} />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#070b12] flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}

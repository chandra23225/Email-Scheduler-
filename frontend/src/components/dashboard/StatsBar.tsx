'use client';

import { useQuery } from '@tanstack/react-query';
import { emailsApi } from '@/lib/api';
import { Skeleton } from '@/components/ui/Skeleton';
import { Mail, Clock, CheckCircle, XCircle, Activity } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}

function StatCard({ label, value, icon, color }: StatCardProps) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3 rounded-lg border border-surface-border bg-surface-card px-4 py-3">
      <div className={`p-2 rounded-lg ${color}`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-2xl font-semibold text-slate-100">{value.toLocaleString()}</p>
        <p className="text-xs text-slate-400 truncate">{label}</p>
      </div>
    </div>
  );
}

export function StatsBar() {
  const { data, isLoading } = useQuery({
    queryKey: ['email-stats'],
    queryFn: emailsApi.getStats,
    refetchInterval: 10_000,
  });

  if (isLoading) {
    return (
      <div className="flex gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 flex-1 rounded-xl" />
        ))}
      </div>
    );
  }

  const stats = [
    {
      label: 'Scheduled',
      value: data?.db.scheduled || 0,
      icon: <Clock className="w-4 h-4 text-blue-400" />,
      color: 'bg-blue-500/10',
    },
    {
      label: 'Sent',
      value: data?.db.sent || 0,
      icon: <CheckCircle className="w-4 h-4 text-green-400" />,
      color: 'bg-green-500/10',
    },
    {
      label: 'Failed',
      value: data?.db.failed || 0,
      icon: <XCircle className="w-4 h-4 text-red-400" />,
      color: 'bg-red-500/10',
    },
    {
      label: 'Queue Delayed',
      value: data?.queue.delayed || 0,
      icon: <Mail className="w-4 h-4 text-yellow-400" />,
      color: 'bg-yellow-500/10',
    },
    {
      label: 'Queue Active',
      value: data?.queue.active || 0,
      icon: <Activity className="w-4 h-4 text-primary-400" />,
      color: 'bg-primary-500/10',
    },
  ];

  return (
    <div className="flex flex-wrap gap-3">
      {stats.map((s) => (
        <StatCard key={s.label} {...s} />
      ))}
    </div>
  );
}

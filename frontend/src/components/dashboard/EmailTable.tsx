'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { emailsApi } from '@/lib/api';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { TableRowSkeleton } from '@/components/ui/Skeleton';
import type { EmailJob, TabType } from '@/types';
import { format } from 'date-fns';
import { Mail, ChevronLeft, ChevronRight, Trash2, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

interface EmailTableProps {
  tab: TabType;
}

export function EmailTable({ tab }: EmailTableProps) {
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const queryClient = useQueryClient();
  const LIMIT = 20;

  // Debounce search input by 400ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 400);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Reset to page 1 when search changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const isSearching = debouncedSearch.trim().length > 0;

  const queryKey = isSearching
    ? ['emails', 'search', debouncedSearch, tab, page]
    : tab === 'scheduled'
    ? ['emails', 'scheduled', page]
    : ['emails', 'sent', page];

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey,
    queryFn: () => {
      if (isSearching) {
        const status = tab === 'scheduled' ? 'scheduled' : 'sent';
        return emailsApi.search(debouncedSearch, status, page, LIMIT);
      }
      return tab === 'scheduled'
        ? emailsApi.getScheduled(page, LIMIT)
        : emailsApi.getSent(page, LIMIT);
    },
    refetchInterval: tab === 'scheduled' ? 5_000 : 15_000,
  });

  const cancelMutation = useMutation({
    mutationFn: emailsApi.cancel,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emails'] });
      queryClient.invalidateQueries({ queryKey: ['email-stats'] });
      toast.success('Email cancelled');
    },
    onError: () => toast.error('Failed to cancel email'),
  });

  const jobs = data?.jobs || [];
  const pagination = data?.pagination;

  const columns =
    tab === 'scheduled'
      ? ['Recipient', 'Subject', 'Sender', 'Scheduled At', 'Status', '']
      : ['Recipient', 'Subject', 'Sender', 'Sent At', 'Status', ''];

  return (
    <div className="flex flex-col gap-4">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search emails..."
          className="w-full max-w-sm rounded-lg border border-surface-border bg-surface-card py-2 pl-9 pr-4 text-sm text-slate-100 placeholder:text-slate-500 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
        />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-surface-border bg-surface-card">
        {isError && (
          <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-red-500/20 bg-red-500/5 text-sm text-red-300">
            <span>Could not load these emails.</span>
            <Button variant="secondary" size="sm" onClick={() => refetch()}>
              Try again
            </Button>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-border">
                {columns.map((col) => (
                  <th
                    key={col}
                    className="px-4 py-3 text-left text-[11px] font-medium uppercase tracking-wider text-slate-400"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRowSkeleton key={i} cols={6} />
                ))
              ) : isError ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-slate-500">
                    Email data is temporarily unavailable.
                  </td>
                </tr>
              ) : jobs.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState
                      icon={<Mail className="w-7 h-7" />}
                      title={
                        tab === 'scheduled'
                          ? 'No scheduled emails'
                          : 'No sent emails yet'
                      }
                      description={
                        tab === 'scheduled'
                          ? 'Schedule your first email campaign to get started.'
                          : 'Emails you send will appear here.'
                      }
                    />
                  </td>
                </tr>
              ) : (
                jobs.map((job: EmailJob) => (
                  <tr
                    key={job.id}
                    className="border-b border-surface-border last:border-0 hover:bg-surface-hover transition-colors"
                  >
                    <td className="max-w-48 truncate px-4 py-3 font-medium text-slate-100">
                      {job.recipient_email}
                    </td>
                    <td className="max-w-48 truncate px-4 py-3 text-slate-300">
                      {job.subject}
                    </td>
                    <td className="max-w-40 truncate px-4 py-3 text-xs text-slate-500">
                      {job.sender_email}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                      {tab === 'scheduled'
                        ? job.scheduled_at
                          ? format(new Date(job.scheduled_at), 'MMM d, yyyy HH:mm')
                          : '—'
                        : job.sent_at
                        ? format(new Date(job.sent_at), 'MMM d, yyyy HH:mm')
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={job.status as any}>{job.status}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      {tab === 'scheduled' && job.status === 'scheduled' && (
                        <Button
                          variant="danger"
                          size="sm"
                          isLoading={cancelMutation.isPending}
                          onClick={() => cancelMutation.mutate(job.id)}
                          leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                        >
                          Cancel
                        </Button>
                      )}
                      {tab === 'sent' && job.status === 'failed' && job.error_message && (
                        <span
                          className="text-xs text-red-400 truncate max-w-32 block"
                          title={job.error_message}
                        >
                          {job.error_message.slice(0, 30)}...
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-surface-border">
            <p className="text-xs text-slate-400">
              {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, pagination.total)} of{' '}
              {pagination.total} emails
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                leftIcon={<ChevronLeft className="w-4 h-4" />}
              >
                Prev
              </Button>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
                rightIcon={<ChevronRight className="w-4 h-4" />}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

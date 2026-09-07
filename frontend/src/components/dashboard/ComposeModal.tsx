'use client';

import { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { emailsApi } from '@/lib/api';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Upload, Users, Clock, Zap, BarChart3, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FormState {
  subject: string;
  body: string;
  recipients: string;
  startTime: string;
  delayBetweenEmailsMs: string;
  hourlyLimit: string;
  senderId: string;
}

function defaultStartTime(): string {
  const d = new Date(Date.now() + 5 * 60 * 1000); // 5 min from now
  // format for datetime-local input: YYYY-MM-DDTHH:mm
  return d.toISOString().slice(0, 16);
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseRecipientText(content: string): string[] {
  const candidates = content
    .split(/[\n,;]+/)
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(candidates.filter((value) => EMAIL_PATTERN.test(value)))];
}

function parseCsvRows(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;

  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    const nextCharacter = content[index + 1];
    if (character === '"') {
      if (quoted && nextCharacter === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ',' && !quoted) {
      row.push(value);
      value = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && nextCharacter === '\n') index += 1;
      row.push(value);
      if (row.some((cell) => cell.trim())) rows.push(row);
      row = [];
      value = '';
    } else {
      value += character;
    }
  }

  row.push(value);
  if (row.some((cell) => cell.trim())) rows.push(row);
  return rows;
}

function parseRecipientCsv(content: string): string[] {
  const rows = parseCsvRows(content);
  if (rows.length === 0) return [];
  const firstRow = rows[0].map((value) => value.trim().toLowerCase());
  const emailColumn = firstRow.findIndex((value) => value === 'email');
  const values = emailColumn >= 0
    ? rows.slice(1).map((row) => row[emailColumn] || '')
    : rows.flat();
  return parseRecipientText(values.join('\n'));
}

export function ComposeModal({ isOpen, onClose }: ComposeModalProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<FormState>({
    subject: '',
    body: '',
    recipients: '',
    startTime: defaultStartTime(),
    delayBetweenEmailsMs: '2000',
    hourlyLimit: '',
    senderId: '',
  });
  const [parsedCount, setParsedCount] = useState<number | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Partial<FormState>>({});
  const [isDragging, setIsDragging] = useState(false);

  const { data: senders = [] } = useQuery({
    queryKey: ['senders'],
    queryFn: emailsApi.getSenders,
  });

  const scheduleMutation = useMutation({
    mutationFn: emailsApi.schedule,
    onSuccess: (data) => {
      toast.success(`Scheduled ${data.totalScheduled} emails successfully!`);
      queryClient.invalidateQueries({ queryKey: ['emails'] });
      queryClient.invalidateQueries({ queryKey: ['email-stats'] });
      onClose();
      resetForm();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to schedule emails');
    },
  });

  const resetForm = () => {
    setForm({
      subject: '',
      body: '',
      recipients: '',
      startTime: defaultStartTime(),
      delayBetweenEmailsMs: '2000',
      hourlyLimit: '',
      senderId: '',
    });
    setParsedCount(null);
    setCsvFile(null);
    setErrors({});
  };

  const parseEmails = (text: string, isCsv = false): number => {
    return isCsv ? parseRecipientCsv(text).length : parseRecipientText(text).length;
  };

  const handleRecipientsChange = (value: string) => {
    setForm((f) => ({ ...f, recipients: value }));
    setParsedCount(parseEmails(value));
    setCsvFile(null);
  };

  const handleFileChange = useCallback((file: File) => {
    const extension = file.name.toLowerCase().split('.').pop();
    if (extension !== 'csv' && extension !== 'txt') {
      setErrors((current) => ({ ...current, recipients: 'Only .csv and .txt files are supported' }));
      return;
    }
    setCsvFile(file);
    setForm((f) => ({ ...f, recipients: '' }));
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setParsedCount(parseEmails(text, file.name.toLowerCase().endsWith('.csv')));
    };
    reader.readAsText(file);
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileChange(file);
  };

  const validate = (): boolean => {
    const errs: Partial<FormState> = {};
    if (!form.subject.trim()) errs.subject = 'Subject is required';
    if (!form.body.trim()) errs.body = 'Body is required';
    const recipientCount = csvFile ? parsedCount || 0 : parseEmails(form.recipients);
    if (recipientCount === 0)
      errs.recipients = 'At least one valid email is required';
    if (recipientCount > 10000)
      errs.recipients = 'A maximum of 10000 recipients is allowed';
    if (!form.startTime) errs.startTime = 'Start time is required';
    else if (new Date(form.startTime).getTime() < Date.now() - 60_000)
      errs.startTime = 'Start time must not be in the past';
    const delay = Number(form.delayBetweenEmailsMs);
    if (!Number.isInteger(delay) || delay < 500 || delay > 86_400_000)
      errs.delayBetweenEmailsMs = 'Delay must be between 500 and 86400000 ms';
    if (form.hourlyLimit) {
      const hourlyLimit = Number(form.hourlyLimit);
      if (!Number.isInteger(hourlyLimit) || hourlyLimit < 1)
        errs.hourlyLimit = 'Hourly limit must be a positive integer';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const fd = new FormData();
    fd.append('subject', form.subject);
    fd.append('body', form.body);
    fd.append('startTime', new Date(form.startTime).toISOString());
    fd.append('delayBetweenEmailsMs', form.delayBetweenEmailsMs);
    if (form.hourlyLimit) fd.append('hourlyLimit', form.hourlyLimit);
    if (form.senderId) fd.append('senderId', form.senderId);

    if (csvFile) {
      fd.append('recipients', csvFile);
    } else {
      fd.append('recipients', form.recipients);
    }

    scheduleMutation.mutate(fd);
  };

  const update = (field: keyof FormState, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Compose New Email Campaign" size="lg">
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Subject */}
        <Input
          label="Subject"
          placeholder="Your email subject..."
          value={form.subject}
          onChange={(e) => update('subject', e.target.value)}
          error={errors.subject}
        />

        {/* Body */}
        <Textarea
          label="Email Body (HTML or plain text)"
          placeholder="Write your email content here..."
          value={form.body}
          onChange={(e) => update('body', e.target.value)}
          error={errors.body}
          rows={5}
        />

        {/* Recipients */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-600">
            Recipients
          </label>

          {/* Dropzone */}
          <div
            className={clsx(
              'relative border-2 border-dashed rounded-xl p-4 transition-colors cursor-pointer',
              isDragging
                ? 'border-primary-500 bg-primary-500/5'
                : 'border-surface-border hover:border-slate-500',
              errors.recipients && 'border-red-500/50'
            )}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileChange(file);
              }}
            />
            <div className="flex items-center gap-3 text-slate-500">
              <Upload className="w-5 h-5 flex-shrink-0" />
              <div>
                {csvFile ? (
                  <span className="text-sm text-primary-400">{csvFile.name}</span>
                ) : (
                  <span className="text-sm">
                    Drop a CSV/TXT file here or{' '}
                    <span className="text-primary-400 underline">browse</span>
                  </span>
                )}
                <p className="text-xs mt-0.5">Accepts .csv or .txt with email addresses</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <div className="flex-1 h-px bg-surface-border" />
            or paste emails below
            <div className="flex-1 h-px bg-surface-border" />
          </div>

          <textarea
            placeholder="one@email.com, two@email.com, ..."
            value={form.recipients}
            onChange={(e) => handleRecipientsChange(e.target.value)}
            rows={3}
            className={clsx(
              'w-full bg-white border rounded-lg px-3.5 py-2.5 text-sm text-slate-800',
              'placeholder:text-slate-400 transition-colors duration-200 resize-none',
              'focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500',
              errors.recipients ? 'border-red-500/50' : 'border-surface-border'
            )}
          />

          {parsedCount !== null && (
            <div className="flex items-center gap-2 text-sm">
              <Users className="w-4 h-4 text-primary-400" />
              <span className="text-primary-400 font-medium">{parsedCount}</span>
              <span className="text-slate-500">valid email{parsedCount !== 1 ? 's' : ''} detected</span>
            </div>
          )}
          {errors.recipients && (
            <p className="text-xs text-red-400">{errors.recipients}</p>
          )}
        </div>

        {/* Sender */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-slate-600">Sender</label>
          <select
            value={form.senderId}
            onChange={(e) => update('senderId', e.target.value)}
            className="w-full rounded-lg border border-surface-border bg-white px-3.5 py-2.5 text-sm text-slate-800 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
          >
            <option value="">Default sender</option>
            {senders.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} &lt;{s.email}&gt;{s.is_default ? ' (default)' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Scheduling options */}
        <div className="grid grid-cols-1 gap-4 rounded-lg border border-surface-border bg-surface-hover p-4 sm:grid-cols-3">
          <div className="mb-1 flex items-center gap-2 text-sm font-medium text-slate-700 sm:col-span-3">
            <Zap className="w-4 h-4 text-primary-400" />
            Scheduling Options
          </div>

          <Input
            label="Start Time"
            type="datetime-local"
            value={form.startTime}
            onChange={(e) => update('startTime', e.target.value)}
            error={errors.startTime}
            leftIcon={<Clock className="w-4 h-4" />}
          />

          <Input
            label="Delay Between Emails (ms)"
            type="number"
            min="500"
            value={form.delayBetweenEmailsMs}
            onChange={(e) => update('delayBetweenEmailsMs', e.target.value)}
            hint="Min 500ms recommended"
          />

          <Input
            label="Hourly Limit"
            type="number"
            min="1"
            placeholder="e.g. 50"
            value={form.hourlyLimit}
            onChange={(e) => update('hourlyLimit', e.target.value)}
            leftIcon={<BarChart3 className="w-4 h-4" />}
            hint="Override global limit"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            isLoading={scheduleMutation.isPending}
            leftIcon={<Send className="w-4 h-4" />}
          >
            Schedule Campaign
          </Button>
        </div>
      </form>
    </Modal>
  );
}

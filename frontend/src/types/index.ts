export interface User {
  userId: string;
  email: string;
  name: string;
  avatar?: string;
}

export interface EmailJob {
  id: string;
  recipient_email: string;
  subject: string;
  scheduled_at: string;
  sent_at?: string | null;
  status: 'scheduled' | 'sent' | 'failed' | 'cancelled';
  sender_email: string;
  batch_id?: string | null;
  error_message?: string | null;
  created_at: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface EmailListResponse {
  jobs: EmailJob[];
  pagination: Pagination;
}

export interface EmailStats {
  db: {
    scheduled: number;
    sent: number;
    failed: number;
    cancelled: number;
  };
  queue: {
    waiting: number;
    delayed: number;
    active: number;
    completed: number;
    failed: number;
  };
}

export interface Sender {
  id: string;
  name: string;
  email: string;
  is_default: boolean;
  created_at: string;
}

export interface ScheduleFormData {
  subject: string;
  body: string;
  recipients: string; // comma/newline separated OR parsed from CSV
  startTime: string;  // ISO datetime
  delayBetweenEmailsMs: number;
  hourlyLimit?: number;
  senderId?: string;
}

export interface ScheduleResponse {
  batchId: string;
  totalScheduled: number;
  startTime: string;
  jobs: Array<{ dbId: string; email: string; scheduledAt: string }>;
}

export type TabType = 'scheduled' | 'sent';

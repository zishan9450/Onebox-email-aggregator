export interface EmailAccount {
  id: string;
  email: string;
  password: string;
  imapHost: string;
  imapPort: number;
  isActive: boolean;
  lastSync?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Email {
  id: string;
  accountId: string;
  messageId: string;
  subject: string;
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  date: Date;
  body: string;
  htmlBody?: string;
  attachments?: EmailAttachment[];
  folder: string;
  isRead: boolean;
  isFlagged: boolean;
  category?: EmailCategory;
  aiCategory?: string;
  aiConfidence?: number;
  suggestedReply?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface EmailAttachment {
  filename: string;
  contentType: string;
  size: number;
  content: Buffer;
}

export type EmailCategory = 'interested' | 'meeting_booked' | 'not_interested' | 'spam' | 'out_of_office';

export interface AICategory {
  category: EmailCategory;
  confidence: number;
  reasoning: string;
}

export interface EmailSearchFilters {
  accountId?: string;
  folder?: string;
  category?: EmailCategory;
  dateFrom?: Date;
  dateTo?: Date;
  isRead?: boolean;
  query?: string;
  limit?: number;
  offset?: number;
}

export interface IMAPConnection {
  connection: any;
  isConnected: boolean;
  accountId: string;
  lastActivity: Date;
}

export interface SlackNotification {
  channel: string;
  text: string;
  attachments?: any[];
}

export interface WebhookPayload {
  event: string;
  data: any;
  timestamp: Date;
}

export interface AISuggestedReply {
  reply: string;
  confidence: number;
  reasoning: string;
}

export interface ProductContext {
  product: string;
  outreachAgenda: string;
  meetingLink?: string;
  contactInfo?: string;
}

export interface SyncStatus {
  accountId: string;
  isRunning: boolean;
  lastSync: Date;
  totalEmails: number;
  newEmails: number;
  errors: string[];
}

export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> extends APIResponse<T[]> {
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

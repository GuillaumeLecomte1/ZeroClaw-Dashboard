// Email types for frontend use

export interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

export interface RecapEmailData {
  recipientEmail: string;
  title: string;
  summary: string;
  items: RecapItem[];
  timestamp: string;
}

export interface RecapItem {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  details?: string;
}

export interface SendEmailResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

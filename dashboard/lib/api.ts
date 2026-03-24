const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'https://YOUR_RAILWAY_APP.up.railway.app';

export interface Email {
  id: string;
  sender_email: string;
  subject: string;
  sent_at: string;
  total_opens: number;
  recipient_open_count: number;
  first_opened_at: string | null;
}

export interface EmailAggregate {
  viewer_id: string;
  recipient_email: string;
  first_opened_at: string;
  last_opened_at: string;
  total_opens: number;
}

export interface OpenEvent {
  id: string;
  opened_at: string;
  ip_address: string;
  user_agent: string;
  is_proxy: boolean;
  recipient_email: string;
  browser: string;
  os: string;
  device: string;
}

export interface EmailDetail {
  email: Email;
  aggregates: EmailAggregate[];
  summary: {
    total_opens: number;
    total_viewers_opened: number;
    first_opened_at: string | null;
    last_opened_at: string | null;
  };
}

export interface OpenEventsResponse {
  events: OpenEvent[];
  count: number;
  limit: number;
  offset: number;
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text().catch(() => 'Unknown error');
    throw new Error(`API ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

export async function getEmails(senderEmail: string): Promise<{ emails: Email[]; count: number }> {
  return apiFetch(`/api/emails?sender=${encodeURIComponent(senderEmail)}`);
}

export async function getEmailDetail(emailId: string): Promise<EmailDetail> {
  return apiFetch(`/api/emails/${emailId}`);
}

export async function getOpenEvents(
  emailId: string,
  limit = 100,
  offset = 0,
): Promise<OpenEventsResponse> {
  return apiFetch(`/api/emails/${emailId}/opens?limit=${limit}&offset=${offset}`);
}

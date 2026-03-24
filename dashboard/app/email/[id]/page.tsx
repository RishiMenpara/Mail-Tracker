'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { use } from 'react';
import { getEmailDetail, getOpenEvents, type EmailDetail, type OpenEvent } from '@/lib/api';

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function ProxyBadge({ isProxy }: { isProxy: boolean }) {
  return isProxy ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-amber-500/15 text-amber-400 border border-amber-500/25">
      Gmail Proxy
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
      Direct
    </span>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-800/60 border border-white/8 rounded-xl p-4 text-center">
      <div className="text-xl font-bold text-white mb-1">{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}

export default function EmailDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [detail, setDetail] = useState<EmailDetail | null>(null);
  const [events, setEvents] = useState<OpenEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRawLogs, setShowRawLogs] = useState(false);

  const loadDetail = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getEmailDetail(id);
      setDetail(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load email details');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const loadEvents = useCallback(async () => {
    if (eventsLoading) return;
    setEventsLoading(true);
    try {
      const data = await getOpenEvents(id);
      setEvents(data.events);
    } catch {
      // Silently fail — events are supplementary
    } finally {
      setEventsLoading(false);
    }
  }, [id, eventsLoading]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  const handleToggleLogs = () => {
    setShowRawLogs((s) => !s);
    if (!showRawLogs && events.length === 0) {
      loadEvents();
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="h-6 w-40 shimmer rounded mb-8" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 shimmer rounded-xl" />
          ))}
        </div>
        <div className="h-64 shimmer rounded-2xl" />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12 text-center">
        <p className="text-red-400 mb-4">{error || 'Email not found'}</p>
        <Link href="/" className="text-blue-400 hover:underline text-sm">← Back to Dashboard</Link>
      </div>
    );
  }

  const { email, aggregates, summary } = detail;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 fade-in">
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-2 text-sm text-gray-600" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-gray-400 transition-colors">Dashboard</Link>
        <span>/</span>
        <span className="text-gray-400 truncate max-w-xs">{email.subject || '(no subject)'}</span>
      </nav>

      {/* Email header */}
      <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 mb-6 card-glow">
        <h1 className="text-xl font-bold text-white mb-1 truncate">{email.subject || '(no subject)'}</h1>
        <p className="text-sm text-gray-500">
          Sent by <span className="text-gray-400">{email.sender_email}</span> on{' '}
          <span className="text-gray-400">{formatDate(email.sent_at)}</span>
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <SummaryCard label="Total Opens" value={String(summary.total_opens)} />
        <SummaryCard label="Unique Recipients Opened" value={String(summary.total_viewers_opened)} />
        <SummaryCard label="First Opened" value={formatDate(summary.first_opened_at)} />
        <SummaryCard label="Last Opened" value={formatDate(summary.last_opened_at)} />
      </div>

      {/* Per-recipient analytics */}
      <div className="bg-gray-900 border border-white/10 rounded-2xl overflow-hidden card-glow mb-6">
        <div className="px-6 py-4 border-b border-white/8">
          <h2 className="text-sm font-semibold text-gray-300">Recipient Analytics</h2>
        </div>
        {aggregates.length === 0 ? (
          <div className="py-12 text-center text-gray-700 text-sm">No opens recorded yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" role="table">
              <thead>
                <tr className="border-b border-white/8 text-xs text-gray-600 uppercase tracking-wider">
                  <th className="px-6 py-3 text-left font-medium">Recipient</th>
                  <th className="px-6 py-3 text-left font-medium">First Opened</th>
                  <th className="px-6 py-3 text-left font-medium hidden md:table-cell">Last Opened</th>
                  <th className="px-6 py-3 text-center font-medium">Opens</th>
                </tr>
              </thead>
              <tbody>
                {aggregates.map((agg, idx) => (
                  <tr
                    key={agg.viewer_id}
                    className={`border-b border-white/5 hover:bg-white/3 transition-colors ${
                      idx === aggregates.length - 1 ? 'border-b-0' : ''
                    }`}
                  >
                    <td className="px-6 py-4 text-gray-200">{agg.recipient_email}</td>
                    <td className="px-6 py-4 text-gray-400 text-xs whitespace-nowrap">
                      {formatDate(agg.first_opened_at)}
                    </td>
                    <td className="px-6 py-4 text-gray-500 text-xs whitespace-nowrap hidden md:table-cell">
                      {formatDate(agg.last_opened_at)}
                    </td>
                    <td className="px-6 py-4 text-center font-semibold text-blue-400">
                      {agg.total_opens}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Raw open logs (collapsible) */}
      <div className="bg-gray-900 border border-white/10 rounded-2xl overflow-hidden card-glow">
        <button
          id="toggle-raw-logs-btn"
          onClick={handleToggleLogs}
          className="w-full px-6 py-4 flex items-center justify-between text-sm font-semibold text-gray-300 hover:bg-white/3 transition-colors"
          aria-expanded={showRawLogs}
        >
          <span>Raw Open Events</span>
          <span className="text-gray-600 font-normal flex items-center gap-2">
            {eventsLoading && <span className="text-xs">Loading…</span>}
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              className={`transition-transform duration-200 ${showRawLogs ? 'rotate-180' : ''}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </span>
        </button>

        {showRawLogs && (
          <div className="border-t border-white/8">
            {events.length === 0 && !eventsLoading ? (
              <div className="py-8 text-center text-gray-700 text-sm">No raw events yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs" role="table">
                  <thead>
                    <tr className="border-b border-white/8 text-gray-600 uppercase tracking-wider">
                      <th className="px-6 py-3 text-left font-medium">Timestamp</th>
                      <th className="px-6 py-3 text-left font-medium">Recipient</th>
                      <th className="px-6 py-3 text-left font-medium hidden lg:table-cell">Browser / OS</th>
                      <th className="px-6 py-3 text-left font-medium hidden md:table-cell">IP Address</th>
                      <th className="px-6 py-3 text-left font-medium">Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((ev, idx) => (
                      <tr
                        key={ev.id}
                        className={`border-b border-white/5 hover:bg-white/2 transition-colors ${
                          idx === events.length - 1 ? 'border-b-0' : ''
                        }`}
                      >
                        <td className="px-6 py-3 text-gray-400 whitespace-nowrap">
                          {formatDate(ev.opened_at)}
                        </td>
                        <td className="px-6 py-3 text-gray-300">{ev.recipient_email}</td>
                        <td className="px-6 py-3 text-gray-500 hidden lg:table-cell">
                          {ev.browser} / {ev.os}
                        </td>
                        <td className="px-6 py-3 text-gray-600 hidden md:table-cell font-mono">
                          {ev.ip_address || '—'}
                        </td>
                        <td className="px-6 py-3">
                          <ProxyBadge isProxy={ev.is_proxy} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

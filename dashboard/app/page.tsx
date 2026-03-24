'use client';

import { useState, useTransition, useCallback } from 'react';
import Link from 'next/link';
import { getEmails, type Email } from '@/lib/api';

function formatDate(dateStr: string): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-gray-900 border border-white/10 rounded-xl p-4 card-glow">
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-sm text-gray-400 mt-0.5">{label}</div>
      {sub && <div className="text-xs text-gray-600 mt-1">{sub}</div>}
    </div>
  );
}

function StatusBadge({ opened }: { opened: boolean }) {
  return opened ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
      Opened
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-700/50 text-gray-500 border border-white/8">
      Not opened
    </span>
  );
}

export default function HomePage() {
  const [senderEmail, setSenderEmail] = useState('');
  const [inputValue, setInputValue] = useState('');
  const [emails, setEmails] = useState<Email[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSearch = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!inputValue.trim()) return;

      const email = inputValue.trim();
      setSenderEmail(email);
      setError(null);
      setHasSearched(true);

      startTransition(async () => {
        try {
          const data = await getEmails(email);
          setEmails(data.emails);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to fetch emails');
          setEmails([]);
        }
      });
    },
    [inputValue],
  );

  const totalOpens = emails.reduce((sum, e) => sum + (Number(e.total_opens) || 0), 0);
  const openedCount = emails.filter((e) => Number(e.total_opens) > 0).length;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 fade-in">
      {/* Hero */}
      <div className="text-center mb-10">
        <h1 className="text-4xl sm:text-5xl font-extrabold gradient-text mb-3">
          Email Open Analytics
        </h1>
        <p className="text-gray-400 text-lg max-w-lg mx-auto">
          See exactly when your emails are opened, by whom, and how many times.
        </p>
      </div>

      {/* Search form */}
      <form
        onSubmit={handleSearch}
        className="max-w-xl mx-auto mb-10 flex gap-3 items-center"
        aria-label="Search emails by sender address"
      >
        <input
          id="sender-email-input"
          type="email"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Enter your Gmail address…"
          className="flex-1 bg-gray-900 border border-white/15 rounded-xl px-4 py-3 text-sm text-gray-100 placeholder:text-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
          required
          autoComplete="email"
        />
        <button
          id="search-btn"
          type="submit"
          disabled={isPending}
          className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 disabled:opacity-60 text-white font-semibold px-5 py-3 rounded-xl text-sm transition-all duration-150 active:scale-95 whitespace-nowrap"
        >
          {isPending ? 'Searching…' : 'Search'}
        </button>
      </form>

      {/* Error */}
      {error && (
        <div className="max-w-xl mx-auto mb-6 bg-red-500/15 border border-red-500/30 rounded-xl px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Stats — shown only after search */}
      {hasSearched && !isPending && emails.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-8 max-w-xl mx-auto">
          <StatCard label="Tracked Emails" value={emails.length} />
          <StatCard label="Emails Opened" value={openedCount} />
          <StatCard label="Total Opens" value={totalOpens} />
        </div>
      )}

      {/* Results table */}
      {hasSearched && !isPending && emails.length > 0 && (
        <div className="bg-gray-900 border border-white/10 rounded-2xl overflow-hidden card-glow fade-in">
          <div className="px-6 py-4 border-b border-white/8 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-300">
              Tracked Emails
              <span className="ml-2 text-xs text-gray-600 font-normal">for {senderEmail}</span>
            </h2>
            <span className="text-xs text-gray-600">{emails.length} result{emails.length !== 1 ? 's' : ''}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm" role="table">
              <thead>
                <tr className="border-b border-white/8 text-xs text-gray-500 uppercase tracking-wider">
                  <th className="px-6 py-3 text-left font-medium">Subject</th>
                  <th className="px-6 py-3 text-left font-medium hidden md:table-cell">Sent</th>
                  <th className="px-6 py-3 text-left font-medium">Status</th>
                  <th className="px-6 py-3 text-center font-medium">Opens</th>
                  <th className="px-6 py-3 text-left font-medium hidden lg:table-cell">First Opened</th>
                  <th className="px-6 py-3 text-right font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {emails.map((email, idx) => (
                  <tr
                    key={email.id}
                    className={`border-b border-white/5 hover:bg-white/3 transition-colors ${
                      idx === emails.length - 1 ? 'border-b-0' : ''
                    }`}
                  >
                    <td className="px-6 py-4 text-gray-100 font-medium max-w-xs">
                      <div className="truncate">{email.subject || '(no subject)'}</div>
                    </td>
                    <td className="px-6 py-4 text-gray-500 text-xs hidden md:table-cell whitespace-nowrap">
                      {formatDate(email.sent_at)}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge opened={Number(email.total_opens) > 0} />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`font-semibold ${Number(email.total_opens) > 0 ? 'text-blue-400' : 'text-gray-600'}`}>
                        {email.total_opens ?? 0}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500 text-xs hidden lg:table-cell whitespace-nowrap">
                      {email.first_opened_at ? formatDate(email.first_opened_at) : '—'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/email/${email.id}`}
                        id={`view-email-${email.id}`}
                        className="text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state after search */}
      {hasSearched && !isPending && emails.length === 0 && !error && (
        <div className="text-center py-16 text-gray-600 fade-in">
          <svg className="mx-auto mb-4 opacity-30" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
            <polyline points="22,6 12,13 2,6"/>
          </svg>
          <p className="text-sm">No tracked emails found for <strong className="text-gray-400">{senderEmail}</strong></p>
          <p className="text-xs mt-1 text-gray-700">Make sure you've sent emails with the MailTrackr Chrome extension.</p>
        </div>
      )}

      {/* Initial state */}
      {!hasSearched && (
        <div className="text-center py-10 text-gray-700 fade-in">
          <svg className="mx-auto mb-4 opacity-20" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
          <p className="text-sm">Enter your Gmail address above to see your tracked emails.</p>
        </div>
      )}
    </div>
  );
}

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'MailTrackr — Email Open Analytics',
  description:
    'Track when your emails are opened. View first-open timestamps, total opens, and recipient analytics.',
  keywords: ['email tracking', 'open tracking', 'email analytics', 'gmail tracking'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-gray-950 text-gray-100 antialiased">
        <div className="flex flex-col min-h-screen">
          {/* Navbar */}
          <nav className="sticky top-0 z-30 border-b border-white/10 bg-gray-950/80 backdrop-blur-md">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
              <a href="/" className="flex items-center gap-2.5 group">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    strokeWidth="2.2"
                  >
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </div>
                <span className="font-bold text-white text-lg tracking-tight group-hover:text-blue-400 transition-colors">
                  MailTrackr
                </span>
              </a>
              <span className="text-xs text-gray-500 hidden sm:block">Email Open Analytics</span>
            </div>
          </nav>

          {/* Page content */}
          <main className="flex-1">{children}</main>

          {/* Footer */}
          <footer className="border-t border-white/5 py-4 text-center text-xs text-gray-600">
            MailTrackr v1.0 — Tracking is always opt-in. Privacy first.
          </footer>
        </div>
      </body>
    </html>
  );
}

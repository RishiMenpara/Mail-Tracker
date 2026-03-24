/**
 * popup.js — Extension popup logic
 * Loads recent tracked emails from chrome.storage.local
 * and fetches open counts from the backend API.
 */

const API_BASE_URL = 'https://mail-tracker-production-478a.up.railway.app';
const DASHBOARD_URL = 'https://mail-tracker-production-478a.up.railway.app';

async function loadPopup() {
  const { trackedEmails = [] } = await chrome.storage.local.get(['trackedEmails']);

  const statTotal = document.getElementById('stat-total');
  const statOpened = document.getElementById('stat-opened');
  const statOpens = document.getElementById('stat-opens');
  const emailList = document.getElementById('email-list');

  statTotal.textContent = trackedEmails.length;

  if (trackedEmails.length === 0) {
    statOpened.textContent = '0';
    statOpens.textContent = '0';
    return;
  }

  // Render email list immediately with local data (no open counts yet)
  renderEmailList(emailList, trackedEmails, {});

  // Fetch open counts from API for each email (limit to 10 most recent)
  const recentEmails = trackedEmails.slice(0, 10);
  const openData = {};
  let totalOpens = 0;
  let totalOpened = 0;

  await Promise.allSettled(
    recentEmails.map(async (email) => {
      try {
        const resp = await fetch(`${API_BASE_URL}/api/emails/${email.id}`, {
          signal: AbortSignal.timeout(4000),
        });
        if (resp.ok) {
          const data = await resp.json();
          const opens = data.summary?.total_opens || 0;
          openData[email.id] = opens;
          totalOpens += opens;
          if (opens > 0) totalOpened++;
        }
      } catch {
        // Silently ignore fetch errors in popup
      }
    }),
  );

  statOpened.textContent = totalOpened;
  statOpens.textContent = totalOpens;
  renderEmailList(emailList, recentEmails, openData);
}

function renderEmailList(container, emails, openData) {
  if (emails.length === 0) return;

  container.innerHTML = '';
  emails.forEach((email) => {
    const opens = openData[email.id] ?? null;
    const isOpened = opens !== null && opens > 0;

    const item = document.createElement('div');
    item.className = 'email-item';

    const sentDate = email.sentAt ? formatRelativeTime(new Date(email.sentAt)) : '';

    item.innerHTML = `
      <div class="email-item__dot ${isOpened ? 'email-item__dot--opened' : ''}"></div>
      <div class="email-item__info">
        <div class="email-item__subject">${escapeHtml(email.subject || '(no subject)')}</div>
        <div class="email-item__meta">${escapeHtml(email.recipientEmail || '')}${sentDate ? ' · ' + sentDate : ''}</div>
      </div>
      ${opens !== null ? `<div class="email-item__opens">${opens > 0 ? opens + ' open' + (opens > 1 ? 's' : '') : 'Not opened'}</div>` : ''}
    `;

    container.appendChild(item);
  });
}

function formatRelativeTime(date) {
  const now = new Date();
  const diff = Math.floor((now - date) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  return Math.floor(diff / 86400) + 'd ago';
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Open full dashboard
document.getElementById('open-dashboard-btn').addEventListener('click', () => {
  chrome.tabs.create({ url: DASHBOARD_URL });
});

// Load on popup open
loadPopup();

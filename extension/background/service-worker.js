/**
 * service-worker.js — Manifest V3 background service worker.
 * Handles API communication from content scripts.
 * VERSION 2.0 — 2026-03-25
 */

const API_BASE_URL = 'https://mail-tracker-v60z.onrender.com';
const DASHBOARD_URL = 'https://mail-tracker-v60z.onrender.com';

console.log('[ServiceWorker v2.0] Loaded. API:', API_BASE_URL);

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('[ServiceWorker] Message received:', message.type, 'from tab:', sender.tab?.id);

  if (message.type === 'REGISTER_EMAIL') {
    handleRegisterEmail(message.payload)
      .then((result) => {
        console.log('[ServiceWorker] REGISTER_EMAIL success:', result);
        try {
          sendResponse(result);
        } catch (e) {
          console.warn('[ServiceWorker] Port closed before success response could be sent.', e);
        }
      })
      .catch((err) => {
        console.error('[ServiceWorker] REGISTER_EMAIL error:', err.message, err.stack);
        try {
          sendResponse({ success: false, error: err.message });
        } catch (e) {
          console.warn('[ServiceWorker] Port closed before error response could be sent.', e);
        }
      });
    return true; // CRITICAL: keeps the message channel open for async sendResponse
  }

  if (message.type === 'GET_DASHBOARD_URL') {
    sendResponse({ url: DASHBOARD_URL });
    return false;
  }

  if (message.type === 'GET_API_URL') {
    sendResponse({ url: API_BASE_URL });
    return false;
  }

  if (message.type === 'PING') {
    sendResponse({ pong: true, version: '2.0' });
    return false;
  }
});

/**
 * Register a new tracked email with the backend API.
 */
async function handleRegisterEmail(payload) {
  const { email_id, sender_email, subject, viewer_id, recipient_email } = payload;

  const apiUrl = `${API_BASE_URL}/api/emails`;
  const body = JSON.stringify({ sender_email, subject, viewer_id, recipient_email });

  console.log('[ServiceWorker] POST', apiUrl);
  console.log('[ServiceWorker] Body:', body);

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body,
  });

  console.log('[ServiceWorker] Response status:', response.status, response.statusText);

  if (!response.ok) {
    const text = await response.text();
    console.error('[ServiceWorker] API error body:', text);
    throw new Error(`API ${response.status}: ${text}`);
  }

  const data = await response.json();
  console.log('[ServiceWorker] API response parsed:', JSON.stringify(data));

  return { success: true, emailId: data.id || email_id };
}

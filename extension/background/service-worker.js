/**
 * service-worker.js — Manifest V3 background service worker.
 * Handles API communication from content scripts.
 */

const API_BASE_URL = 'https://mail-tracker-production-478a.up.railway.app';
const DASHBOARD_URL = 'https://mail-tracker-production-478a.up.railway.app';

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'REGISTER_EMAIL') {
    handleRegisterEmail(message.payload)
      .then((result) => sendResponse(result))
      .catch((err) => {
        console.error('[ServiceWorker] REGISTER_EMAIL failed:', err);
        sendResponse({ success: false, error: err.message });
      });
    return true; // Keep message channel open for async response
  }

  if (message.type === 'GET_DASHBOARD_URL') {
    sendResponse({ url: DASHBOARD_URL });
    return false;
  }

  if (message.type === 'GET_API_URL') {
    sendResponse({ url: API_BASE_URL });
    return false;
  }
});

/**
 * Register a new tracked email with the backend API.
 * Returns { success: true, emailId } or { success: false, error }.
 */
async function handleRegisterEmail(payload) {
  const { email_id, sender_email, subject, viewer_id, recipient_email } = payload;

  const response = await fetch(`${API_BASE_URL}/api/emails`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sender_email, subject, viewer_id, recipient_email }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API error ${response.status}: ${text}`);
  }

  const data = await response.json();
  return { success: true, emailId: data.id || email_id };
}

/**
 * service-worker.js — Manifest V3 background service worker.
 * Handles API communication from content scripts.
 */

const API_BASE_URL = 'https://mail-tracker-v60z.onrender.com';
const DASHBOARD_URL = 'https://mail-tracker-v60z.onrender.com';

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'REGISTER_EMAIL') {
    console.log('[ServiceWorker] REGISTER_EMAIL received:', message.payload);
    handleRegisterEmail(message.payload)
      .then((result) => {
        console.log('[ServiceWorker] REGISTER_EMAIL success:', result);
        sendResponse(result);
      })
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

  console.log('[ServiceWorker] Calling API:', `${API_BASE_URL}/api/emails`);

  const response = await fetch(`${API_BASE_URL}/api/emails`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sender_email, subject, viewer_id, recipient_email }),
  });

  console.log('[ServiceWorker] API response status:', response.status);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API error ${response.status}: ${text}`);
  }

  const data = await response.json();
  console.log('[ServiceWorker] API response data:', data);
  return { success: true, emailId: data.id || email_id };
}

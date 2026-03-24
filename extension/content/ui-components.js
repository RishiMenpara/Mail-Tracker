/**
 * ui-components.js — Creates tracking toggle, confirmation dialog, and notifications
 */

const DISCLAIMER_TEXT =
  'This email uses open tracking. The recipient will be notified when they open this email. ' +
  'Only enable tracking when you have consent or a legitimate reason.';

/** Create the tracking toggle button for the Gmail compose toolbar */
function createTrackingToggle(composerId) {
  const container = document.createElement('div');
  container.className = 'mt-toggle-container';
  container.dataset.composerId = composerId;

  const toggle = document.createElement('button');
  toggle.className = 'mt-toggle mt-toggle--off';
  toggle.dataset.enabled = 'false';
  toggle.dataset.composerId = composerId;
  toggle.title = 'MailTrackr: tracking is OFF';
  toggle.setAttribute('aria-label', 'Enable email open tracking');

  toggle.innerHTML = `
    <span class="mt-toggle__icon">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
    </span>
    <span class="mt-toggle__label">Track</span>
  `;

  toggle.addEventListener('click', () => {
    const isEnabled = toggle.dataset.enabled === 'true';
    const newState = !isEnabled;
    toggle.dataset.enabled = String(newState);
    toggle.className = `mt-toggle ${newState ? 'mt-toggle--on' : 'mt-toggle--off'}`;
    toggle.title = `MailTrackr: tracking is ${newState ? 'ON' : 'OFF'}`;
  });

  container.appendChild(toggle);
  return container;
}

/** Create and show a confirmation dialog before sending a tracked email */
function showConfirmationDialog(senderEmail, recipientEmail, onConfirm, onCancel) {
  // Backdrop
  const backdrop = document.createElement('div');
  backdrop.className = 'mt-backdrop';

  const dialog = document.createElement('div');
  dialog.className = 'mt-dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 'mt-dialog-title');

  dialog.innerHTML = `
    <div class="mt-dialog__header">
      <div class="mt-dialog__icon">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      </div>
      <h3 id="mt-dialog-title" class="mt-dialog__title">Enable Open Tracking?</h3>
    </div>
    <div class="mt-dialog__body">
      <p class="mt-dialog__disclaimer">${DISCLAIMER_TEXT}</p>
      <div class="mt-dialog__details">
        <div class="mt-dialog__detail-row">
          <span class="mt-dialog__detail-label">From:</span>
          <span class="mt-dialog__detail-value">${escapeHtml(senderEmail || 'Unknown')}</span>
        </div>
        <div class="mt-dialog__detail-row">
          <span class="mt-dialog__detail-label">To:</span>
          <span class="mt-dialog__detail-value">${escapeHtml(recipientEmail || 'Unknown')}</span>
        </div>
      </div>
    </div>
    <div class="mt-dialog__actions">
      <button class="mt-btn mt-btn--secondary" id="mt-cancel-btn">Cancel</button>
      <button class="mt-btn mt-btn--primary" id="mt-confirm-btn">Send with Tracking</button>
    </div>
  `;

  backdrop.appendChild(dialog);
  document.body.appendChild(backdrop);

  // Animate in
  requestAnimationFrame(() => backdrop.classList.add('mt-backdrop--visible'));

  const cleanup = () => {
    backdrop.classList.remove('mt-backdrop--visible');
    setTimeout(() => backdrop.remove(), 200);
  };

  dialog.querySelector('#mt-confirm-btn').addEventListener('click', () => {
    cleanup();
    onConfirm();
  });

  dialog.querySelector('#mt-cancel-btn').addEventListener('click', () => {
    cleanup();
    onCancel();
  });

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) {
      cleanup();
      onCancel();
    }
  });
}

/** Show a toast notification */
function showNotification(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `mt-toast mt-toast--${type}`;
  toast.innerHTML = `
    <span class="mt-toast__icon">${type === 'success' ? '✓' : '!'}</span>
    <span class="mt-toast__message">${escapeHtml(message)}</span>
  `;
  document.body.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('mt-toast--visible'));
  setTimeout(() => {
    toast.classList.remove('mt-toast--visible');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

window.MailTrackrUI = { createTrackingToggle, showConfirmationDialog, showNotification };

/**
 * gmail-inject.js — Main content script for Gmail compose integration.
 * Uses MutationObserver to detect compose windows and injects the tracking toggle.
 * VERSION 2.0 — 2026-03-25
 */

(function () {
  'use strict';

  console.log('[MailTrackr v2.0] Content script loaded on', window.location.href);

  // Track which compose windows we've already processed
  const processedComposers = new WeakSet();

  // ── Helper: reliable chrome.runtime.sendMessage with timeout ────────────
  function sendMessageToBackground(msg, timeoutMs = 55000) { // Render needs up to 50s for cold start
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('Service worker response timed out after ' + Math.round(timeoutMs/1000) + 's'));
      }, timeoutMs);

      try {
        chrome.runtime.sendMessage(msg, (response) => {
          clearTimeout(timer);
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve(response);
        });
      } catch (err) {
        clearTimeout(timer);
        reject(err);
      }
    });
  }

  function interceptSendButton(sendButton, composeEl, toggleContainer) {
    let sendingInProgress = false;

    sendButton.addEventListener('click', (e) => {
      if (sendingInProgress) {
        console.log('[MailTrackr] Re-entry — letting Gmail handle the click');
        return;
      }

      const toggle = toggleContainer.querySelector('.mt-toggle');
      if (!toggle || toggle.dataset.enabled !== 'true') return;

      const recipientEmail = getRecipientEmail(composeEl);
      
      // CRITICAL FIX: Ensure we only block the Send button if we successfully found a recipient email.
      // If we can't parse it (e.g., they typed an invalid address or it's empty), we MUST
      // return immediately WITHOUT calling preventDefault(). This allows Gmail's native validation
      // to pop up its error dialog (e.g. "The address is not recognized").
      if (!recipientEmail || recipientEmail.trim() === '') {
        console.warn('[MailTrackr] Recipient email is empty or blocked. Bypassing MailTrackr so Gmail can show its native error dialog.');
        return;
      }

      e.preventDefault();
      e.stopImmediatePropagation();

      const senderEmail = getSenderEmail() || 'unknown-sender@gmail.com';
      const subject = getSubject(composeEl);

      console.log('[MailTrackr] Send intercepted. sender:', senderEmail, 'to:', recipientEmail, 'subject:', subject);

      window.MailTrackrUI.showConfirmationDialog(
        senderEmail,
        recipientEmail,
        () => {
          sendingInProgress = true;
          injectPixelAndSend(composeEl, sendButton, senderEmail, subject, recipientEmail);
        },
        () => {
          sendingInProgress = true;
          toggle.dataset.enabled = 'false';
          toggle.className = 'mt-toggle mt-toggle--off';
          toggle.title = 'MailTrackr: tracking is OFF';
          window.MailTrackrUI.showNotification('Tracking cancelled. Email sent without tracking.', 'success');
          sendButton.click();
        },
      );
    }, true);
  }

  /**
   * Register the email with the backend, inject the pixel, then trigger send.
   */
  async function injectPixelAndSend(composeEl, sendButton, senderEmail, subject, recipientEmail) {
    const emailId = window.MailTrackrUUID.generate();
    const viewerId = window.MailTrackrUUID.generate();

    console.log('[MailTrackr] Registering email…', { emailId, viewerId, senderEmail, subject, recipientEmail });
    
    // Add an explicit message that the server might be waking up
    window.MailTrackrUI.showNotification('Registering tracking... (may take up to 50s if server is waking up)', 'success');

    let registered = false;

    try {
      console.log('[MailTrackr] sending REGISTER_EMAIL to service worker');

      const response = await sendMessageToBackground({
        type: 'REGISTER_EMAIL',
        payload: {
          email_id: emailId,
          sender_email: senderEmail,
          subject,
          viewer_id: viewerId,
          recipient_email: recipientEmail,
        },
      });

      console.log('[MailTrackr] Service worker response:', JSON.stringify(response));

      if (response && response.success) {
        const trackingEmailId = response.emailId || emailId;
        console.log('[MailTrackr] Registration success! emailId:', trackingEmailId);

        // Inject pixel into compose body
        const bodyEl = composeEl.querySelector('[contenteditable="true"]') ||
          composeEl.querySelector('.Am.Al.editable') ||
          composeEl.querySelector('[role="textbox"]');

        if (bodyEl) {
          const pixelHtml = window.MailTrackrPixel.generatePixelHTML(trackingEmailId, viewerId);
          bodyEl.insertAdjacentHTML('beforeend', pixelHtml);
          
          // Force Gmail's internal state (React) to acknowledge the change
          bodyEl.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
          
          console.log('[MailTrackr] Pixel injected into email body');
        } else {
          console.warn('[MailTrackr] Could not find email body element');
        }

        saveTrackedEmail({
          id: trackingEmailId,
          subject,
          recipientEmail,
          sentAt: new Date().toISOString(),
        });

        window.MailTrackrUI.showNotification('✓ Tracking pixel injected — sending email…');
        registered = true;
      } else {
        console.warn('[MailTrackr] Backend returned failure:', response?.error);
      }
    } catch (err) {
      console.error('[MailTrackr] Error during registration:', err.message);
    }

    if (!registered) {
      console.error('[MailTrackr] Registration failed');
      window.MailTrackrUI.showNotification('Tracking failed — sending without tracking', 'error');
    }

    // Always send the email after a tiny delay so Gmail state catches up
    console.log('[MailTrackr] Triggering Gmail send… 150ms delay');
    setTimeout(() => {
      sendButton.click();
    }, 150);
  }

  /** Save tracked email metadata to chrome.storage.local for popup display */
  function saveTrackedEmail(emailData) {
    chrome.storage.local.get(['trackedEmails'], (result) => {
      const emails = result.trackedEmails || [];
      emails.unshift(emailData);
      chrome.storage.local.set({ trackedEmails: emails.slice(0, 50) });
    });
  }

  // ── MutationObserver: watch for new compose windows ───────────────────
  function observeGmail() {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;

          const composeContainers = [];

          if (node.classList && (node.classList.contains('AD') || node.classList.contains('nH'))) {
            composeContainers.push(node);
          }

          const found = node.querySelectorAll ? node.querySelectorAll('.aYF, .Am.Al.editable') : [];
          found.forEach((el) => {
            let parent = el;
            while (parent && !parent.classList.contains('AD') && !parent.classList.contains('aSt')) {
              parent = parent.parentElement;
            }
            if (parent && !processedComposers.has(parent)) {
              composeContainers.push(parent);
            }
          });

          composeContainers.forEach((container) => {
            setTimeout(() => injectTrackingToggle(container), 200);
          });
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  // ── Also scan for already-open compose windows on load ────────────────
  function scanExistingComposeWindows() {
    const composeWindows = document.querySelectorAll('.AD, .nH > .no');
    composeWindows.forEach((cw) => {
      setTimeout(() => injectTrackingToggle(cw), 300);
    });
  }

  // ── Init ──────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      observeGmail();
      scanExistingComposeWindows();
    });
  } else {
    observeGmail();
    scanExistingComposeWindows();
  }
})();

/**
 * gmail-inject.js — Main content script for Gmail compose integration.
 * Uses MutationObserver to detect compose windows and injects the tracking toggle.
 * VERSION 2.1 — 2026-03-25
 */

(function () {
  'use strict';

  console.log('[MailTrackr v2.1] Content script loaded on', window.location.href);

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

  /**
   * Find the Gmail send button inside a compose container.
   * Gmail uses data-tooltip attributes to identify buttons.
   */
  function findSendButton(composeEl) {
    return (
      composeEl.querySelector('[data-tooltip="Send"]') ||
      composeEl.querySelector('[data-tooltip^="Send"]') ||
      composeEl.querySelector('.T-I.J-J5-Ji.aoO') ||
      composeEl.querySelector('[aria-label="Send"]')
    );
  }

  /**
   * Find the compose toolbar (where we inject the toggle).
   */
  function findToolbar(composeEl) {
    return (
      composeEl.querySelector('.IZ') ||       // Bottom toolbar row
      composeEl.querySelector('.aDh') ||      // Formatting toolbar row
      composeEl.querySelector('[gh="mtb"]')   // Gmail toolbar body
    );
  }

  /**
   * Extract the recipient email from a compose window.
   */
  function getRecipientEmail(composeEl) {
    const toField = composeEl.querySelector('[name="to"]') ||
      composeEl.querySelector('input.vO') ||
      composeEl.querySelector('input.agP');

    if (toField && toField.value) return toField.value;

    // Try to find email chips (the pill element added after typing an email)
    const chips = composeEl.querySelectorAll('[data-hovercard-id], .vN, .afV');
    for (const chip of chips) {
      const email = chip.getAttribute('data-hovercard-id') || chip.getAttribute('email') || chip.innerText.trim();
      if (email && email.includes('@')) return email.replace(/[<>]/g, '').trim();
    }
    
    // As a last fallback, return what's in the input field, even if partial
    if (toField && toField.innerText) return toField.innerText.trim();

    return '';
  }

  /**
   * Get the email subject from the compose window.
   */
  function getSubject(composeEl) {
    const subjectField = composeEl.querySelector('input[name="subjectbox"]') ||
      composeEl.querySelector('.aoT');
    return subjectField ? subjectField.value.trim() : '(no subject)';
  }

  function getSenderEmail() {
    const accountEl = document.querySelector('[aria-label*="Google Account:"]') ||
      document.querySelector('[data-email]') ||
      document.querySelector('.gb_d.gb_Fa.gb_A');
      
    if (accountEl) {
      const email = accountEl.getAttribute('data-email') ||
        (accountEl.getAttribute('aria-label') || '').match(/[\w.-]+@[\w.-]+/)?.[0];
      if (email) return email;
    }
    const metaEmail = document.querySelector('meta[name="email"]');
    if (metaEmail) return metaEmail.content;
    
    // Fallback: search for any div containing an email in the top right user menu
    const titleUser = document.querySelector('.gb_ef[title], .gb_de[title]');
    if (titleUser) {
      const match = titleUser.getAttribute('title').match(/[\w.-]+@[\w.-]+/);
      if (match) return match[0];
    }
    return '';
  }

  /**
   * Core: inject tracking toggle into a compose window.
   */
  function injectTrackingToggle(composeEl) {
    if (processedComposers.has(composeEl)) return;

    const toolbar = findToolbar(composeEl);
    if (!toolbar) return;

    const composerId = window.MailTrackrUUID.generate();
    processedComposers.add(composeEl);

    const toggleContainer = window.MailTrackrUI.createTrackingToggle(composerId);
    toolbar.appendChild(toggleContainer);

    const sendButton = findSendButton(composeEl);
    if (sendButton) {
      interceptSendButton(sendButton, composeEl, toggleContainer);
    } else {
      const obs = new MutationObserver(() => {
        const btn = findSendButton(composeEl);
        if (btn) {
          obs.disconnect();
          interceptSendButton(btn, composeEl, toggleContainer);
        }
      });
      obs.observe(composeEl, { childList: true, subtree: true });
    }
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

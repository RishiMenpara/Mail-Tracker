/**
 * gmail-inject.js — Main content script for Gmail compose integration.
 * Uses MutationObserver to detect compose windows and injects the tracking toggle.
 */

(function () {
  'use strict';

  // Track which compose windows we've already processed
  const processedComposers = new WeakSet();

  /**
   * Find the Gmail send button inside a compose container.
   * Gmail uses data-tooltip attributes to identify buttons.
   */
  function findSendButton(composeEl) {
    // MUI send button selectors (Gmail's class names change — use multiple strategies)
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
      composeEl.querySelector('.vO') ||
      composeEl.querySelector('[data-hovercard-id]');

    if (toField && toField.value) return toField.value;
    if (toField && toField.getAttribute('data-hovercard-id')) {
      return toField.getAttribute('data-hovercard-id');
    }

    // Try to find email chips
    const chip = composeEl.querySelector('.vN.aXj .vN, .afV .vN');
    if (chip) return chip.getAttribute('email') || chip.textContent.trim();

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

  /**
   * Get the sender email from the Gmail page header.
   */
  function getSenderEmail() {
    const accountEl = document.querySelector('[aria-label*="Google Account:"]') ||
      document.querySelector('[data-email]');
    if (accountEl) {
      const email = accountEl.getAttribute('data-email') ||
        (accountEl.getAttribute('aria-label') || '').match(/[\w.-]+@[\w.-]+/)?.[0];
      if (email) return email;
    }
    // Fallback: look for the logged-in user indicator
    const metaEmail = document.querySelector('meta[name="email"]');
    if (metaEmail) return metaEmail.content;
    return '';
  }

  /**
   * Core: inject tracking toggle into a compose window.
   */
  function injectTrackingToggle(composeEl) {
    if (processedComposers.has(composeEl)) return;

    const toolbar = findToolbar(composeEl);
    if (!toolbar) return; // Toolbar not ready yet

    const composerId = window.MailTrackrUUID.generate();
    processedComposers.add(composeEl);

    // Create and inject toggle
    const toggleContainer = window.MailTrackrUI.createTrackingToggle(composerId);
    toolbar.appendChild(toggleContainer);

    // Find the send button and intercept clicks
    const sendButton = findSendButton(composeEl);
    if (sendButton) {
      interceptSendButton(sendButton, composeEl, toggleContainer);
    } else {
      // Wait for send button if it appears later
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

  /**
   * Intercept the Gmail send button to inject tracking pixel before send.
   */
  function interceptSendButton(sendButton, composeEl, toggleContainer) {
    let sendingInProgress = false; // Guard against re-entry after pixel injection

    sendButton.addEventListener('click', (e) => {
      // If we already injected the pixel and are re-clicking to actually send, let it through
      if (sendingInProgress) return;

      const toggle = toggleContainer.querySelector('.mt-toggle');
      if (!toggle || toggle.dataset.enabled !== 'true') return; // Tracking OFF — let Gmail handle it normally

      e.preventDefault();
      e.stopImmediatePropagation();

      const senderEmail = getSenderEmail();
      const recipientEmail = getRecipientEmail(composeEl);
      const subject = getSubject(composeEl);

      window.MailTrackrUI.showConfirmationDialog(
        senderEmail,
        recipientEmail,
        () => {
          // User confirmed — inject pixel and send
          sendingInProgress = true;
          injectPixelAndSend(composeEl, sendButton, senderEmail, subject, recipientEmail);
        },
        () => {
          // User cancelled — disable tracking for this compose
          sendingInProgress = true;
          toggle.dataset.enabled = 'false';
          toggle.className = 'mt-toggle mt-toggle--off';
          toggle.title = 'MailTrackr: tracking is OFF';
          window.MailTrackrUI.showNotification('Tracking cancelled. Email sent without tracking.', 'success');
          // Let Gmail send normally
          sendButton.click();
        },
      );
    }, true); // capture phase
  }

  /**
   * Register the email with the backend, inject the pixel, then trigger send.
   */
  async function injectPixelAndSend(composeEl, sendButton, senderEmail, subject, recipientEmail) {
    const emailId = window.MailTrackrUUID.generate();
    const viewerId = window.MailTrackrUUID.generate();

    try {
      // Register with backend via background service worker
      const response = await chrome.runtime.sendMessage({
        type: 'REGISTER_EMAIL',
        payload: {
          email_id: emailId,
          sender_email: senderEmail,
          subject,
          viewer_id: viewerId,
          recipient_email: recipientEmail,
        },
      });

      if (response && response.success) {
        // Inject pixel into compose body
        const bodyEl = composeEl.querySelector('[contenteditable="true"]') ||
          composeEl.querySelector('.Am.Al.editable') ||
          composeEl.querySelector('[role="textbox"]');

        if (bodyEl) {
          const pixelHtml = window.MailTrackrPixel.generatePixelHTML(
            response.emailId || emailId,
            viewerId,
          );
          bodyEl.insertAdjacentHTML('beforeend', pixelHtml);
        }

        // Save to local storage for popup
        saveTrackedEmail({
          id: response.emailId || emailId,
          subject,
          recipientEmail,
          sentAt: new Date().toISOString(),
        });

        window.MailTrackrUI.showNotification('✓ Tracking pixel injected — sending email…');
      } else {
        console.warn('[MailTrackr] Backend registration failed, sending without tracking');
        window.MailTrackrUI.showNotification('Tracking failed — sending normally', 'error');
      }
    } catch (err) {
      console.error('[MailTrackr] Failed to register email:', err);
      window.MailTrackrUI.showNotification('Tracking failed — sending normally', 'error');
    }

    // Always send the email
    sendButton.click();
  }

  /** Save tracked email metadata to chrome.storage.local for popup display */
  function saveTrackedEmail(emailData) {
    chrome.storage.local.get(['trackedEmails'], (result) => {
      const emails = result.trackedEmails || [];
      emails.unshift(emailData);
      // Keep only last 50
      chrome.storage.local.set({ trackedEmails: emails.slice(0, 50) });
    });
  }

  // ── MutationObserver: watch for new compose windows ───────────────────
  function observeGmail() {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;

          // Gmail compose containers: .aDh or .M9 or the compose wrapper
          const composeContainers = [];

          // Check if the node itself is a compose window
          if (node.classList && (node.classList.contains('AD') || node.classList.contains('nH'))) {
            composeContainers.push(node);
          }

          // Also search within the added node
          const found = node.querySelectorAll ? node.querySelectorAll('.aYF, .Am.Al.editable') : [];
          found.forEach((el) => {
            // Walk up to the compose container
            let parent = el;
            while (parent && !parent.classList.contains('AD') && !parent.classList.contains('aSt')) {
              parent = parent.parentElement;
            }
            if (parent && !processedComposers.has(parent)) {
              composeContainers.push(parent);
            }
          });

          composeContainers.forEach((container) => {
            // Slight delay to let Gmail finish rendering the compose window
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

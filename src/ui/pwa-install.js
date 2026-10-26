/**
 * pwa-install.js
 *
 * Handles PWA installation prompt detection and the install button lifecycle.
 *
 * Responsibilities:
 * - Listens for `beforeinstallprompt` (Chrome/Edge/Android) and stores the event.
 * - Detects iOS Safari and offers "Add to Home Screen" guidance.
 * - Exposes `initInstallButton(buttonElement)` to wire up the install button.
 * - Hides the button once the app is installed (`appinstalled`).
 * - Does NOT show any UI element unless there is a real install action available.
 * - Does NOT touch IndexedDB, localStorage, or user data.
 */

let _deferredPrompt = null; // The stored BeforeInstallPromptEvent

/**
 * Detect iOS Safari — it supports "Add to Home Screen" but not the standard
 * BeforeInstallPromptEvent, and has its own standalone detection.
 * @returns {boolean}
 */
function isIosSafari() {
  const ua = navigator.userAgent;
  const isIOS = /iphone|ipad|ipod/i.test(ua);
  // iOS Chrome / Firefox also match isIOS but they use WKWebView and can't install PWAs
  const isSafari = /safari/i.test(ua) && !/crios|fxios|opios/i.test(ua);
  return isIOS && isSafari;
}

/**
 * Detect if the app is already running in standalone mode (installed).
 * @returns {boolean}
 */
function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  );
}

/**
 * Initializes the install button element.
 * Wires up the correct behavior based on platform:
 *   - Chromium/Android: uses BeforeInstallPromptEvent
 *   - iOS Safari: shows a tooltip with manual instructions
 *   - Already installed / unsupported: button stays hidden
 *
 * @param {HTMLElement} buttonEl - The install button element
 */
export function initInstallButton(buttonEl) {
  if (!buttonEl) return;

  // If already installed in standalone mode, hide permanently
  if (isStandalone()) {
    buttonEl.style.display = 'none';
    return;
  }

  // iOS Safari: show button with instructional tooltip
  if (isIosSafari()) {
    buttonEl.style.display = '';
    buttonEl.setAttribute('aria-label', 'Instalar aplicativo — toque em Compartilhar e depois em "Adicionar à Tela de Início"');
    buttonEl.title = 'Instalar: toque em Compartilhar (⬆) e depois em "Adicionar à Tela de Início"';

    buttonEl.addEventListener('click', () => {
      showIosInstallTooltip(buttonEl);
    });
    return;
  }

  // Chromium/Android: wait for beforeinstallprompt
  // If it already fired (stored in _deferredPrompt), wire it up now
  if (_deferredPrompt) {
    activateInstallButton(buttonEl);
    return;
  }

  // Otherwise the button stays hidden; the beforeinstallprompt listener below will activate it
}

/**
 * Wires the install button to trigger the native prompt.
 * @param {HTMLElement} buttonEl
 */
function activateInstallButton(buttonEl) {
  buttonEl.style.display = '';
  buttonEl.setAttribute('aria-label', 'Instalar aplicativo');
  buttonEl.title = 'Instalar aplicativo';

  buttonEl.addEventListener('click', async () => {
    if (!_deferredPrompt) return;

    try {
      await _deferredPrompt.prompt();
      const { outcome } = await _deferredPrompt.userChoice;

      if (outcome === 'accepted') {
        buttonEl.style.display = 'none';
      }
    } catch (_) {
      // Prompt may have already been used — hide the button
      buttonEl.style.display = 'none';
    } finally {
      _deferredPrompt = null;
    }
  }, { once: true });
}

/**
 * Shows a brief non-modal tooltip near the button for iOS instructions.
 * @param {HTMLElement} anchorEl
 */
function showIosInstallTooltip(anchorEl) {
  // Remove any existing tooltip
  document.getElementById('pwa-ios-tip')?.remove();

  const tip = document.createElement('div');
  tip.id = 'pwa-ios-tip';
  tip.setAttribute('role', 'tooltip');
  tip.setAttribute('aria-live', 'polite');
  tip.innerHTML = `
    <strong>Instalar no iPhone/iPad:</strong><br>
    Toque em <strong>⬆ Compartilhar</strong> e depois em<br>
    <strong>"Adicionar à Tela de Início"</strong>.
    <button id="pwa-ios-tip-close" aria-label="Fechar dica de instalação">✕</button>
  `;

  Object.assign(tip.style, {
    position: 'fixed',
    bottom: '70px',
    right: '16px',
    zIndex: '9999',
    background: 'var(--color-surface-2)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    padding: 'var(--space-3) var(--space-4)',
    fontSize: 'var(--font-size-sm)',
    lineHeight: '1.5',
    color: 'var(--color-text)',
    boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
    maxWidth: '260px'
  });

  document.body.appendChild(tip);

  const closeBtn = tip.querySelector('#pwa-ios-tip-close');
  if (closeBtn) {
    Object.assign(closeBtn.style, {
      position: 'absolute',
      top: '6px',
      right: '8px',
      background: 'none',
      border: 'none',
      color: 'var(--color-text-muted)',
      cursor: 'pointer',
      fontSize: '14px',
      padding: '2px'
    });
    closeBtn.addEventListener('click', () => tip.remove());
  }

  // Auto-dismiss after 8 seconds
  setTimeout(() => tip.remove(), 8000);
}

// ─── Global event listeners ────────────────────────────────────────────────

window.addEventListener('beforeinstallprompt', (event) => {
  // Prevent Chrome's default mini-infobar
  event.preventDefault();
  _deferredPrompt = event;

  // If the install button is already in the DOM, activate it now
  const btn = document.getElementById('btn-pwa-install');
  if (btn && btn.style.display !== 'none') {
    activateInstallButton(btn);
  } else if (btn) {
    activateInstallButton(btn);
  }
});

window.addEventListener('appinstalled', () => {
  _deferredPrompt = null;
  const btn = document.getElementById('btn-pwa-install');
  if (btn) btn.style.display = 'none';
});

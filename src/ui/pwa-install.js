/**
 * pwa-install.js
 *
 * Handles PWA installation prompt detection, platform-specific guidance,
 * and install button lifecycle.
 *
 * Responsibilities:
 * - Detects standalone mode across Chromium, Safari, and iPadOS.
 * - Listens for BeforeInstallPromptEvent (Chromium/Android) to trigger 1-click install.
 * - Shows the install button for non-installed users on mobile and desktop.
 * - Displays clear, native-feeling step-by-step guidance for iOS, iPadOS, and browsers
 *   where programmatic prompt is delayed or unsupported.
 * - Automatically hides the install button and header container once installed.
 * - Does NOT touch IndexedDB or user data.
 */

let _deferredPrompt = null;

/**
 * Detects if the app is currently running in standalone / PWA mode.
 * @returns {boolean}
 */
export function isStandalone() {
  if (typeof window === 'undefined') return false;

  const isStandaloneMedia =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches;

  const isNavigatorStandalone = window.navigator && window.navigator.standalone === true;

  return Boolean(isStandaloneMedia || isNavigatorStandalone);
}

/**
 * Detects the user's platform family.
 * Supports iOS (including iPadOS 13+ where Safari reports as Mac with touch).
 * @returns {{ platform: 'ios' | 'android' | 'desktop', isMobile: boolean }}
 */
export function getPlatformInfo() {
  if (typeof navigator === 'undefined') {
    return { platform: 'desktop', isMobile: false };
  }

  const ua = navigator.userAgent || '';
  const isIPadOS = Boolean(navigator.maxTouchPoints > 1 && /macintosh/i.test(ua));
  const isIOS = /iphone|ipad|ipod/i.test(ua) || isIPadOS;
  const isAndroid = /android/i.test(ua);
  const isMobile = isIOS || isAndroid || /mobile/i.test(ua);

  if (isIOS) return { platform: 'ios', isMobile: true };
  if (isAndroid) return { platform: 'android', isMobile: true };
  return { platform: 'desktop', isMobile };
}

/**
 * Hides the install button and cleans up the sidebar header.
 * @param {HTMLElement} buttonEl
 */
export function hideInstallButton(buttonEl) {
  if (!buttonEl) return;
  buttonEl.style.display = 'none';
  const headerEl = buttonEl.closest('.sidebar-header');
  if (headerEl) {
    headerEl.classList.add('is-hidden');
  }
}

/**
 * Shows the install button and reveals the sidebar header.
 * @param {HTMLElement} buttonEl
 */
export function showInstallButton(buttonEl) {
  if (!buttonEl) return;
  buttonEl.style.display = 'flex';
  const headerEl = buttonEl.closest('.sidebar-header');
  if (headerEl) {
    headerEl.classList.remove('is-hidden');
  }
}

/**
 * Shows an accessible modal with platform-appropriate instructions
 * for installing the PWA when BeforeInstallPromptEvent is not available.
 * @param {'ios' | 'android' | 'desktop'} platform
 */
export function showInstallModal(platform = 'desktop') {
  const existing = document.getElementById('pwa-install-modal');
  if (existing) existing.remove();

  let title = 'Instalar Aplicativo';
  let subtitle = 'Instale o Kartei no seu dispositivo para acesso rápido e modo offline completo:';
  let steps = [];

  if (platform === 'ios') {
    title = 'Instalar no iPhone / iPad';
    subtitle = 'Para instalar o Kartei na sua tela de início pelo Safari:';
    steps = [
      'Toque no ícone de <strong>Compartilhar (⬆)</strong> na barra do Safari.',
      'Role as opções para baixo e toque em <strong>"Adicionar à Tela de Início"</strong>.',
      'Toque em <strong>"Adicionar"</strong> no canto superior direito para confirmar.'
    ];
  } else if (platform === 'android') {
    title = 'Instalar no Celular';
    subtitle = 'Para instalar o Kartei no seu aparelho Android:';
    steps = [
      'Toque no menu de <strong>três pontos (⋮)</strong> no topo do seu navegador.',
      'Selecione a opção <strong>"Instalar aplicativo"</strong> ou <strong>"Adicionar à tela inicial"</strong>.',
      'Confirme a instalação quando a notificação aparecer.'
    ];
  } else {
    title = 'Instalar no Computador';
    subtitle = 'Para instalar o Kartei no seu navegador:';
    steps = [
      'Clique no ícone de instalação <strong>(⊕)</strong> na barra de endereços do navegador.',
      'Ou abra o menu de opções <strong>(⋮)</strong> e clique em <strong>"Instalar Kartei"</strong>.'
    ];
  }

  const modal = document.createElement('div');
  modal.id = 'pwa-install-modal';
  modal.className = 'modal-backdrop';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'pwa-modal-title');

  modal.innerHTML = `
    <div class="modal-dialog">
      <div class="modal-header" id="pwa-modal-title" style="display: flex; align-items: center; gap: var(--space-3);">
        <svg width="22" height="22" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: var(--color-primary); flex-shrink: 0;" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
        </svg>
        <span>${title}</span>
      </div>
      <div style="color: var(--color-text-muted); font-size: var(--font-size-sm); line-height: 1.6;">
        <p style="margin-bottom: var(--space-3); color: var(--color-text-main);">
          ${subtitle}
        </p>
        <ol style="margin-left: var(--space-5); margin-bottom: var(--space-4); display: flex; flex-direction: column; gap: var(--space-2);">
          ${steps.map((step) => `<li>${step}</li>`).join('')}
        </ol>
        <p style="font-size: var(--font-size-xs); color: var(--color-text-subtle);">
          Uma vez instalado, o aplicativo inicia em tela cheia e funciona totalmente offline.
        </p>
      </div>
      <div class="modal-actions">
        <button type="button" class="btn btn-primary" id="btn-close-pwa-modal">Entendi</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const closeModal = () => modal.remove();

  const confirmBtn = modal.querySelector('#btn-close-pwa-modal');
  confirmBtn?.addEventListener('click', closeModal);

  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  const onKeydown = (e) => {
    if (e.key === 'Escape') {
      closeModal();
      document.removeEventListener('keydown', onKeydown);
    }
  };
  document.addEventListener('keydown', onKeydown);
  confirmBtn?.focus();
}

/**
 * Handles clicks on the install button.
 * Triggers native BeforeInstallPromptEvent if available, or displays
 * instructions modal appropriate for the user's platform.
 * @param {HTMLElement} buttonEl
 */
async function handleInstallClick(buttonEl) {
  if (_deferredPrompt) {
    try {
      await _deferredPrompt.prompt();
      const choice = await _deferredPrompt.userChoice;
      if (choice && choice.outcome === 'accepted') {
        hideInstallButton(buttonEl);
      }
    } catch (err) {
      console.warn('[pwa] Erro ao disparar prompt de instalação:', err);
    } finally {
      _deferredPrompt = null;
    }
    return;
  }

  const { platform } = getPlatformInfo();
  showInstallModal(platform);
}

/**
 * Initializes the PWA install button.
 * - Hides the button if the app is already installed in standalone mode.
 * - Shows the button on mobile and desktop browsers if not installed.
 * - Wires up native BeforeInstallPromptEvent or fallback modal.
 * @param {HTMLElement} buttonEl
 */
export function initInstallButton(buttonEl) {
  if (!buttonEl) return;

  if (isStandalone()) {
    hideInstallButton(buttonEl);
    return;
  }

  showInstallButton(buttonEl);
  buttonEl.setAttribute('aria-label', 'Instalar aplicativo');
  buttonEl.title = 'Instalar aplicativo';

  buttonEl.onclick = () => handleInstallClick(buttonEl);
}

// ─── Global Browser Event Listeners ────────────────────────────────────────

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    // Prevent Chromium's mini-infobar so our own button controls the trigger
    event.preventDefault();
    _deferredPrompt = event;

    const btn = document.getElementById('btn-pwa-install');
    if (btn && !isStandalone()) {
      showInstallButton(btn);
    }
  });

  window.addEventListener('appinstalled', () => {
    _deferredPrompt = null;
    const btn = document.getElementById('btn-pwa-install');
    if (btn) hideInstallButton(btn);
  });

  // Watch for standalone display mode changes
  const mql = window.matchMedia('(display-mode: standalone)');
  if (mql && mql.addEventListener) {
    mql.addEventListener('change', (e) => {
      if (e.matches) {
        const btn = document.getElementById('btn-pwa-install');
        if (btn) hideInstallButton(btn);
      }
    });
  }
}

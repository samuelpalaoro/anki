import { Router } from './ui/router.js';
import { renderCardsView } from './ui/views/cards-view.js';
import { renderDecksView } from './ui/views/decks-view.js';
import { renderEditorView } from './ui/views/editor-view.js';
import { renderStudyView } from './ui/views/study-view.js';
import { renderSettingsView } from './ui/views/settings-view.js';
import { getDatabase } from './db/database.js';
import { initInstallButton } from './ui/pwa-install.js';

async function initApp() {
  const contentElement = document.getElementById('app-view-container');

  // ── Database initialization ──────────────────────────────────────────────
  try {
    await getDatabase();
  } catch (err) {
    contentElement.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon" aria-hidden="true">⚠️</div>
        <h2 class="empty-title">Falha no Armazenamento Local</h2>
        <p class="empty-desc">${err.message || 'IndexedDB inacessível neste navegador.'}</p>
        <p class="empty-desc" style="font-size:var(--font-size-xs);color:var(--color-text-subtle);">
          Verifique se o modo privado/anônimo não está bloqueando o armazenamento local.
        </p>
      </div>
    `;
    return;
  }

  // ── Request persistent storage (reduces risk of browser eviction) ────────
  // This is a best-effort request — it does NOT guarantee permanent storage.
  // See: https://web.dev/persistent-storage/
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().then((granted) => {
      if (!granted) {
        console.info('[storage] Armazenamento persistente não concedido. Dados podem ser removidos pelo navegador em situações de pressão de armazenamento.');
      }
    });
  }

  // ── Router setup ─────────────────────────────────────────────────────────
  const routes = {
    '/': renderCardsView,
    '/cards': renderCardsView,
    '/cards/new': renderEditorView,
    '/cards/edit': renderEditorView,
    '/decks': renderDecksView,
    '/study': renderStudyView,
    '/settings': renderSettingsView
  };

  const router = new Router(routes, contentElement);
  router.init();

  // ── PWA install button ───────────────────────────────────────────────────
  // The button is hidden by default in the HTML. initInstallButton() will
  // show it only if the platform supports installation and the app isn't
  // already installed.
  const installBtn = document.getElementById('btn-pwa-install');
  initInstallButton(installBtn);

  // ── Service Worker registration ──────────────────────────────────────────
  if ('serviceWorker' in navigator) {
    // Register in both prod and dev (dev mode skips caching but enables SW features)
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').then((registration) => {
        // Listen for a waiting SW (update available)
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // A new SW is waiting. We can notify the user or auto-activate.
              // For now: silently activate to avoid serving stale assets.
              // Data in IndexedDB is NOT affected by SW updates.
              newWorker.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });
      }).catch((err) => {
        console.warn('[sw] Falha ao registrar Service Worker:', err);
      });

      // Reload once the new SW has taken control (after SKIP_WAITING)
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

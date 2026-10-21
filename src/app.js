import { Router } from './ui/router.js';
import { renderCardsView } from './ui/views/cards-view.js';
import { renderDecksView } from './ui/views/decks-view.js';
import { renderEditorView } from './ui/views/editor-view.js';
import { renderStudyView } from './ui/views/study-view.js';
import { renderSettingsView } from './ui/views/settings-view.js';
import { getDatabase } from './db/database.js';

async function initApp() {
  const contentElement = document.getElementById('app-view-container');

  try {
    await getDatabase();
  } catch (err) {
    contentElement.innerHTML = `
      <div class="empty-state">
        <h2 class="empty-title">Falha no Armazenamento Local</h2>
        <p class="empty-desc">${err.message || 'IndexedDB inacessível.'}</p>
      </div>
    `;
    return;
  }

  // Simplified navigation: Cards as default home, Decks, Study, and Settings
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

  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch((err) => {
        console.warn('Falha ao registrar Service Worker:', err);
      });
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

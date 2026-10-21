import { studyService } from '../../services/study-service.js';
import { deckService } from '../../services/deck-service.js';

export async function renderDashboardView(container, queryParams, router) {
  const stats = await studyService.getDashboardStats();
  const decks = await deckService.getAllDecksWithStats();

  const hasCards = stats.totalCards > 0;
  const hasDueOrNew = stats.dueCards > 0 || stats.newCards > 0;

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Painel de Estudos</h1>
        <p class="page-subtitle">Acompanhe seu ritmo de aprendizagem e revisões pendentes</p>
      </div>
      <div>
        ${hasDueOrNew ? `<button id="btn-start-study" class="btn btn-primary btn-lg">Começar a Estudar</button>` : ''}
      </div>
    </div>

    <!-- Stats Grid -->
    <div class="stats-grid">
      <div class="stat-card">
        <span class="stat-label">Total de Cartões</span>
        <span class="stat-value">${stats.totalCards}</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Revisões Pendentes</span>
        <span class="stat-value ${stats.dueCards > 0 ? 'stat-highlight' : ''}">${stats.dueCards}</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Novos Cartões</span>
        <span class="stat-value">${stats.newCards}</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Revisões Hoje</span>
        <span class="stat-value">${stats.todayReviews}</span>
      </div>
    </div>

    ${!hasCards ? `
      <div class="empty-state">
        <h2 class="empty-title">Sua coleção está vazia</h2>
        <p class="empty-desc">Crie seu primeiro baralho para começar a adicionar cartões de estudo.</p>
        <button id="btn-empty-deck" class="btn btn-primary">Criar Primeiro Baralho</button>
      </div>
    ` : `
      <div class="card-panel">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-4);">
          <h2 style="font-size: var(--font-size-lg); font-weight: 700;">Seus Baralhos</h2>
          <button id="btn-create-card-quick" class="btn btn-secondary btn-sm">+ Novo Cartão</button>
        </div>

        ${decks.length === 0 ? `
          <p style="color: var(--color-text-muted);">Nenhum baralho cadastrado.</p>
        ` : `
          <table class="data-table">
            <thead>
              <tr>
                <th>Nome do Baralho</th>
                <th>Total</th>
                <th>Pendentes</th>
                <th>Novos</th>
                <th style="text-align: right;">Ações</th>
              </tr>
            </thead>
            <tbody>
              ${decks.map((deck) => `
                <tr>
                  <td>
                    <strong>${deck.name}</strong>
                    ${deck.description ? `<br><small style="color: var(--color-text-muted);">${deck.description}</small>` : ''}
                  </td>
                  <td>${deck.totalCards}</td>
                  <td><span class="badge ${deck.dueCards > 0 ? 'badge-status-due' : ''}">${deck.dueCards}</span></td>
                  <td><span class="badge ${deck.newCards > 0 ? 'badge-status-new' : ''}">${deck.newCards}</span></td>
                  <td style="text-align: right;">
                    ${(deck.dueCards > 0 || deck.newCards > 0) ? `
                      <button class="btn btn-primary btn-sm btn-study-deck" data-deck-id="${deck.id}">Estudar</button>
                    ` : `
                      <button class="btn btn-secondary btn-sm" disabled title="Tudo revisado!">Revisado</button>
                    `}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `}
      </div>
    `}
  `;

  // Bind actions
  const btnStartStudy = container.querySelector('#btn-start-study');
  if (btnStartStudy) {
    btnStartStudy.addEventListener('click', () => {
      router.navigate('/study');
    });
  }

  const btnEmptyDeck = container.querySelector('#btn-empty-deck');
  if (btnEmptyDeck) {
    btnEmptyDeck.addEventListener('click', () => {
      router.navigate('/decks');
    });
  }

  const btnCreateCardQuick = container.querySelector('#btn-create-card-quick');
  if (btnCreateCardQuick) {
    btnCreateCardQuick.addEventListener('click', () => {
      router.navigate('/cards/new');
    });
  }

  container.querySelectorAll('.btn-study-deck').forEach((btn) => {
    btn.addEventListener('click', () => {
      const deckId = btn.getAttribute('data-deck-id');
      router.navigate(`/study?deckId=${deckId}`);
    });
  });

  return {
    destroy: () => {}
  };
}

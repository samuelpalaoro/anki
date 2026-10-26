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
      ${hasDueOrNew ? `
        <button id="btn-start-study" class="btn btn-primary btn-lg" aria-label="Iniciar revisão de todos os cartões pendentes">
          <svg style="width:18px;height:18px;flex-shrink:0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/>
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          Estudar Agora
        </button>
      ` : ''}
    </div>

    <!-- Stats Grid -->
    <div class="stats-grid" role="region" aria-label="Estatísticas de estudo">
      <div class="stat-card">
        <span class="stat-label">Total de Cartões</span>
        <span class="stat-value">${stats.totalCards}</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Revisões Pendentes</span>
        <span class="stat-value ${stats.dueCards > 0 ? 'stat-highlight' : ''}" aria-label="${stats.dueCards} revisões pendentes">${stats.dueCards}</span>
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
        <div class="empty-icon" aria-hidden="true">🗃️</div>
        <h2 class="empty-title">Sua coleção está vazia</h2>
        <p class="empty-desc">Crie seu primeiro baralho para começar a adicionar cartões de estudo.</p>
        <button id="btn-empty-deck" class="btn btn-primary">Criar Primeiro Baralho</button>
      </div>
    ` : `
      <div class="card-panel">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: var(--space-4); gap: var(--space-3); flex-wrap: wrap;">
          <h2 class="section-title" style="margin-bottom:0;">Seus Baralhos</h2>
          <button id="btn-create-card-quick" class="btn btn-secondary btn-sm" aria-label="Criar novo cartão">+ Novo Cartão</button>
        </div>

        ${decks.length === 0 ? `
          <p class="text-muted text-sm">Nenhum baralho cadastrado ainda.</p>
        ` : `
          <div style="overflow-x: auto;">
            <table class="data-table" aria-label="Lista de baralhos">
              <thead>
                <tr>
                  <th scope="col">Baralho</th>
                  <th scope="col">Total</th>
                  <th scope="col">Pendentes</th>
                  <th scope="col">Novos</th>
                  <th scope="col" style="text-align: right;">Ação</th>
                </tr>
              </thead>
              <tbody>
                ${decks.map((deck) => `
                  <tr>
                    <td data-label="Baralho"><strong>${deck.name}</strong>${deck.description ? `<br><span class="text-subtle text-xs">${deck.description}</span>` : ''}</td>
                    <td data-label="Total">${deck.totalCards}</td>
                    <td data-label="Pendentes"><span class="${deck.dueCards > 0 ? 'badge-status-due' : 'text-subtle'}">${deck.dueCards}</span></td>
                    <td data-label="Novos"><span class="${deck.newCards > 0 ? 'badge-status-new' : 'text-subtle'}">${deck.newCards}</span></td>
                    <td data-label="Ação" style="text-align: right;">
                      ${(deck.dueCards > 0 || deck.newCards > 0) ? `
                        <button class="btn btn-primary btn-sm btn-study-deck" data-deck-id="${deck.id}" aria-label="Estudar baralho ${deck.name}">Estudar</button>
                      ` : `
                        <span class="text-subtle text-xs" title="Nenhum cartão pendente">✓ Em dia</span>
                      `}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
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

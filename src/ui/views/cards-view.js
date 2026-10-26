import { cardService } from '../../services/card-service.js';
import { deckRepository } from '../../db/repositories/deck-repository.js';
import { searchService } from '../../services/search-service.js';
import { showToast } from '../components/toast.js';

export async function renderCardsView(container, queryParams, router) {
  let decks = await deckRepository.findAll();
  let deckMap = new Map(decks.map((d) => [d.id, d.name]));

  let currentQuery = queryParams.get('q') || '';
  let currentDeckId = queryParams.get('deckId') || '';
  let filteredCards = [];

  async function fetchAndRender() {
    filteredCards = await searchService.searchCards({
      query: currentQuery,
      deckId: currentDeckId || undefined
    });

    // Sort by recent first
    filteredCards.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));

    const selectedDeckName = currentDeckId ? deckMap.get(currentDeckId) : null;

    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">${selectedDeckName ? `Cartões — ${selectedDeckName}` : 'Cartões'}</h1>
          <p class="page-subtitle">${filteredCards.length} ${filteredCards.length === 1 ? 'cartão encontrado' : 'cartões encontrados'}</p>
        </div>
        <div style="display: flex; gap: var(--space-2);">
          ${currentDeckId ? `
            <button id="btn-study-this-deck" class="btn btn-secondary btn-sm">Estudar este baralho</button>
          ` : ''}
          <button id="btn-create-card-header" class="btn btn-primary btn-sm">+ Novo Cartão</button>
        </div>
      </div>

      <!-- Compact Search & Filter Toolbar -->
      <div class="filter-bar" role="search" aria-label="Filtrar cartões">
        <input type="text" id="cards-search-input" class="form-input" placeholder="Pesquisar por pergunta ou resposta..." value="${currentQuery}" aria-label="Pesquisar cartões" style="flex: 2; min-width: 200px;">
        <select id="cards-deck-filter" class="form-select" aria-label="Filtrar por baralho" style="flex: 1; min-width: 140px;">
          <option value="">Todos os baralhos</option>
          ${decks.map((d) => `<option value="${d.id}" ${d.id === currentDeckId ? 'selected' : ''}>${d.name}</option>`).join('')}
        </select>
        ${(currentQuery || currentDeckId) ? `
          <button id="btn-reset-filters" class="btn btn-ghost btn-sm" title="Limpar filtros" aria-label="Limpar filtros">✕ Limpar</button>
        ` : ''}
      </div>

      <!-- Cards List -->
      ${filteredCards.length === 0 ? `
        <div class="empty-state">
          <div class="empty-icon" aria-hidden="true">${(currentQuery || currentDeckId) ? '🔍' : '📋'}</div>
          <h2 class="empty-title">Nenhum cartão encontrado</h2>
          <p class="empty-desc">${(currentQuery || currentDeckId) ? 'Nenhum resultado corresponde à sua pesquisa.' : 'Crie seu primeiro cartão para começar.'}</p>
          <button id="btn-empty-new-card" class="btn btn-primary">+ Criar Cartão</button>
        </div>

      ` : `
        <div class="item-list">
          ${filteredCards.map((c) => {
            const cleanFront = c.front.replace(/[#*`_\[\]]/g, '').trim();
            const tags = (c.tags || []);
            return `
              <div class="item-row" data-card-id="${c.id}">
                <div class="item-main">
                  <div class="item-title" title="${c.front}">${cleanFront}</div>
                  <div class="item-meta">
                    <span class="badge badge-deck">${deckMap.get(c.deckId) || 'Sem Baralho'}</span>
                    ${tags.map((t) => `<span class="badge badge-tag">#${t}</span>`).join('')}
                  </div>
                </div>
                <div class="item-actions">
                  <button class="btn btn-ghost btn-sm btn-edit-card" data-card-id="${c.id}" title="Editar cartão">Editar</button>
                  <button class="btn btn-ghost btn-sm btn-move-card" data-card-id="${c.id}" title="Mover para outro baralho">Mover</button>
                  <button class="btn btn-ghost btn-sm btn-duplicate-card" data-card-id="${c.id}" title="Duplicar cartão">Duplicar</button>
                  <button class="btn btn-danger btn-sm btn-delete-card" data-card-id="${c.id}" title="Excluir cartão">Excluir</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `}

      <!-- Action Modals Placeholder -->
      <div id="card-action-modal"></div>
    `;

    bindEvents();
  }

  function showMoveModal(cardId) {
    const card = filteredCards.find((c) => c.id === cardId);
    if (!card) return;

    const modalHost = container.querySelector('#card-action-modal');
    modalHost.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal-dialog">
          <h2 class="modal-header">Mover Cartão</h2>
          <p style="font-size: var(--font-size-sm); color: var(--color-text-muted); margin-bottom: var(--space-4);">
            Selecione o novo baralho de destino para este cartão:
          </p>
          <div class="form-group">
            <select id="move-dest-select" class="form-select">
              ${decks.map((d) => `<option value="${d.id}" ${d.id === card.deckId ? 'selected' : ''}>${d.name}</option>`).join('')}
            </select>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn btn-secondary btn-sm" id="btn-cancel-move">Cancelar</button>
            <button type="button" class="btn btn-primary btn-sm" id="btn-confirm-move">Mover</button>
          </div>
        </div>
      </div>
    `;

    modalHost.querySelector('#btn-cancel-move').addEventListener('click', () => {
      modalHost.innerHTML = '';
    });

    modalHost.querySelector('#btn-confirm-move').addEventListener('click', async () => {
      const targetDeckId = modalHost.querySelector('#move-dest-select').value;
      try {
        await cardService.updateCard(cardId, { deckId: targetDeckId });
        showToast('Cartão movido com sucesso!', 'success');
        modalHost.innerHTML = '';
        await fetchAndRender();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  function bindEvents() {
    const searchInput = container.querySelector('#cards-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        currentQuery = e.target.value;
        fetchAndRender();
      });
    }

    const deckFilter = container.querySelector('#cards-deck-filter');
    if (deckFilter) {
      deckFilter.addEventListener('change', (e) => {
        currentDeckId = e.target.value;
        fetchAndRender();
      });
    }

    const btnReset = container.querySelector('#btn-reset-filters');
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        currentQuery = '';
        currentDeckId = '';
        fetchAndRender();
      });
    }

    const btnCreateHeader = container.querySelector('#btn-create-card-header');
    if (btnCreateHeader) {
      btnCreateHeader.addEventListener('click', () => {
        const dest = currentDeckId ? `/cards/new?deckId=${currentDeckId}` : '/cards/new';
        router.navigate(dest);
      });
    }

    const btnEmptyNew = container.querySelector('#btn-empty-new-card');
    if (btnEmptyNew) {
      btnEmptyNew.addEventListener('click', () => {
        const dest = currentDeckId ? `/cards/new?deckId=${currentDeckId}` : '/cards/new';
        router.navigate(dest);
      });
    }

    const btnStudyDeck = container.querySelector('#btn-study-this-deck');
    if (btnStudyDeck) {
      btnStudyDeck.addEventListener('click', () => {
        router.navigate(`/study?deckId=${currentDeckId}`);
      });
    }

    container.querySelectorAll('.btn-edit-card').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-card-id');
        router.navigate(`/cards/edit?id=${id}`);
      });
    });

    container.querySelectorAll('.btn-move-card').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-card-id');
        showMoveModal(id);
      });
    });

    container.querySelectorAll('.btn-duplicate-card').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-card-id');
        const original = filteredCards.find((c) => c.id === id);
        if (!original) return;

        try {
          await cardService.createCard({
            deckId: original.deckId,
            front: `${original.front} (cópia)`,
            back: original.back,
            contentFormat: original.contentFormat,
            tags: original.tags,
            imageIds: original.imageIds
          });
          showToast('Cartão duplicado!', 'success');
          await fetchAndRender();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });

    container.querySelectorAll('.btn-delete-card').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-card-id');
        if (confirm('Tem certeza que deseja excluir este cartão?')) {
          try {
            await cardService.deleteCard(id);
            showToast('Cartão excluído.', 'success');
            await fetchAndRender();
          } catch (err) {
            showToast(err.message, 'error');
          }
        }
      });
    });
  }

  await fetchAndRender();

  return {
    destroy: () => {}
  };
}

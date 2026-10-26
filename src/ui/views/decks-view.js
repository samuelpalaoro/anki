import { deckService } from '../../services/deck-service.js';
import { showToast } from '../components/toast.js';

export async function renderDecksView(container, queryParams, router) {
  let decks = await deckService.getAllDecksWithStats();

  function render() {
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">Baralhos</h1>
          <p class="page-subtitle">${decks.length} ${decks.length === 1 ? 'coleção' : 'coleções'} disponíveis</p>
        </div>
        <button id="btn-create-deck" class="btn btn-primary btn-sm">+ Novo Baralho</button>
      </div>

        ${decks.length === 0 ? `
        <div class="empty-state">
          <div class="empty-icon" aria-hidden="true">🗂️</div>
          <h2 class="empty-title">Nenhum baralho criado</h2>
          <p class="empty-desc">Crie um baralho para organizar seus cartões por assunto ou disciplina.</p>
          <button id="btn-empty-deck" class="btn btn-primary">+ Criar Baralho</button>
        </div>
      ` : `
        <div class="item-list" role="list" aria-label="Lista de baralhos">
          ${decks.map((deck) => `
            <div class="item-row" data-deck-id="${deck.id}" role="listitem">
              <div class="item-main">
                <div class="item-title">${deck.name}</div>
                <div class="item-meta">
                  <span>${deck.totalCards} ${deck.totalCards === 1 ? 'cartão' : 'cartões'}</span>
                  ${deck.dueCards > 0 ? `<span class="badge badge-due">${deck.dueCards} pendente${deck.dueCards !== 1 ? 's' : ''}</span>` : ''}
                  ${deck.newCards > 0 ? `<span class="badge badge-new">${deck.newCards} novo${deck.newCards !== 1 ? 's' : ''}</span>` : ''}
                </div>
              </div>

              <div class="item-actions">
                ${(deck.dueCards > 0 || deck.newCards > 0) ? `
                  <button class="btn btn-primary btn-sm btn-study" data-deck-id="${deck.id}" aria-label="Estudar baralho ${deck.name}">Estudar</button>
                ` : `
                  <span class="text-subtle text-xs" style="padding: 0 var(--space-2);">✓ Em dia</span>
                `}
                <button class="btn btn-ghost btn-sm btn-add-card" data-deck-id="${deck.id}" title="Adicionar cartão neste baralho" aria-label="Adicionar cartão ao baralho ${deck.name}">+ Cartão</button>
                <button class="btn btn-ghost btn-sm btn-view-cards" data-deck-id="${deck.id}" title="Ver cartões deste baralho" aria-label="Ver cartões do baralho ${deck.name}">Ver</button>
                <button class="btn btn-ghost btn-sm btn-rename-deck" data-deck-id="${deck.id}" aria-label="Renomear baralho ${deck.name}">Renomear</button>
                <button class="btn btn-danger btn-sm btn-delete-deck" data-deck-id="${deck.id}" data-card-count="${deck.totalCards}" aria-label="Excluir baralho ${deck.name}">Excluir</button>
              </div>
            </div>
          `).join('')}
        </div>
      `}


      <!-- Modals Container -->
      <div id="deck-modal-host"></div>
    `;

    bindEvents();
  }

  function showDeckModal(deckToEdit = null) {
    const modalHost = container.querySelector('#deck-modal-host');
    const isEdit = !!deckToEdit;

    modalHost.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal-dialog">
          <h2 class="modal-header">${isEdit ? 'Renomear Baralho' : 'Novo Baralho'}</h2>
          <form id="deck-modal-form">
            <div class="form-group">
              <label class="form-label" for="deck-name-field">Nome do Baralho *</label>
              <input type="text" id="deck-name-field" class="form-input" required value="${deckToEdit ? deckToEdit.name : ''}" placeholder="Ex: Vocabulário Inglês" autofocus>
            </div>
            <div class="modal-actions">
              <button type="button" class="btn btn-secondary btn-sm" id="btn-cancel-modal">Cancelar</button>
              <button type="submit" class="btn btn-primary btn-sm">${isEdit ? 'Salvar' : 'Criar Baralho'}</button>
            </div>
          </form>
        </div>
      </div>
    `;

    const input = modalHost.querySelector('#deck-name-field');
    input.focus();

    modalHost.querySelector('#btn-cancel-modal').addEventListener('click', () => {
      modalHost.innerHTML = '';
    });

    modalHost.querySelector('#deck-modal-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = input.value.trim();
      try {
        if (isEdit) {
          await deckService.updateDeck(deckToEdit.id, { name });
          showToast('Baralho renomeado!', 'success');
        } else {
          await deckService.createDeck({ name });
          showToast('Baralho criado!', 'success');
        }
        modalHost.innerHTML = '';
        decks = await deckService.getAllDecksWithStats();
        render();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  function showDeleteModal(deckId, cardCount) {
    const modalHost = container.querySelector('#deck-modal-host');
    const otherDecks = decks.filter((d) => d.id !== deckId);

    modalHost.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal-dialog">
          <h2 class="modal-header">Excluir Baralho</h2>
          ${cardCount === 0 ? `
            <p style="font-size: var(--font-size-sm); color: var(--color-text-muted); margin-bottom: var(--space-4);">
              Deseja excluir este baralho?
            </p>
            <div class="modal-actions">
              <button type="button" class="btn btn-secondary btn-sm" id="btn-cancel-del">Cancelar</button>
              <button type="button" class="btn btn-danger btn-sm" id="btn-confirm-del-direct">Excluir</button>
            </div>
          ` : `
            <p style="font-size: var(--font-size-sm); color: var(--color-text-muted); margin-bottom: var(--space-4);">
              Este baralho contém <strong>${cardCount} cartão(ões)</strong>. Escolha o que fazer com eles:
            </p>
            <div class="form-group">
              <label style="font-size: var(--font-size-sm); margin-bottom: var(--space-2); cursor: pointer;">
                <input type="radio" name="del-strategy" value="cascade" checked>
                Excluir o baralho e <strong>todos os seus ${cardCount} cartões</strong>
              </label>
              ${otherDecks.length > 0 ? `
                <label style="font-size: var(--font-size-sm); cursor: pointer;">
                  <input type="radio" name="del-strategy" value="move">
                  Mover os cartões para:
                </label>
                <select id="move-dest-deck" class="form-select" style="margin-top: var(--space-1);">
                  ${otherDecks.map((d) => `<option value="${d.id}">${d.name}</option>`).join('')}
                </select>
              ` : ''}
            </div>
            <div class="modal-actions">
              <button type="button" class="btn btn-secondary btn-sm" id="btn-cancel-del">Cancelar</button>
              <button type="button" class="btn btn-danger btn-sm" id="btn-confirm-del-strategy">Confirmar Exclusão</button>
            </div>
          `}
        </div>
      </div>
    `;

    modalHost.querySelector('#btn-cancel-del').addEventListener('click', () => {
      modalHost.innerHTML = '';
    });

    const btnDirect = modalHost.querySelector('#btn-confirm-del-direct');
    if (btnDirect) {
      btnDirect.addEventListener('click', async () => {
        try {
          await deckService.deleteDeck(deckId);
          showToast('Baralho excluído.', 'success');
          modalHost.innerHTML = '';
          decks = await deckService.getAllDecksWithStats();
          render();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    }

    const btnStrategy = modalHost.querySelector('#btn-confirm-del-strategy');
    if (btnStrategy) {
      btnStrategy.addEventListener('click', async () => {
        const strategy = modalHost.querySelector('input[name="del-strategy"]:checked').value;
        const targetDeck = modalHost.querySelector('#move-dest-deck')?.value;

        try {
          await deckService.deleteDeck(deckId, strategy, targetDeck);
          showToast('Baralho excluído e cartões processados.', 'success');
          modalHost.innerHTML = '';
          decks = await deckService.getAllDecksWithStats();
          render();
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    }
  }

  function bindEvents() {
    container.querySelector('#btn-create-deck')?.addEventListener('click', () => showDeckModal());
    container.querySelector('#btn-empty-deck')?.addEventListener('click', () => showDeckModal());

    container.querySelectorAll('.btn-study').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-deck-id');
        router.navigate(`/study?deckId=${id}`);
      });
    });

    container.querySelectorAll('.btn-add-card').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-deck-id');
        router.navigate(`/cards/new?deckId=${id}`);
      });
    });

    container.querySelectorAll('.btn-view-cards').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-deck-id');
        router.navigate(`/cards?deckId=${id}`);
      });
    });

    container.querySelectorAll('.btn-rename-deck').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-deck-id');
        const deck = decks.find((d) => d.id === id);
        if (deck) showDeckModal(deck);
      });
    });

    container.querySelectorAll('.btn-delete-deck').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-deck-id');
        const count = parseInt(btn.getAttribute('data-card-count'), 10) || 0;
        showDeleteModal(id, count);
      });
    });
  }

  render();

  return {
    destroy: () => {}
  };
}

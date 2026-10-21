import { cardService } from '../../services/card-service.js';
import { deckRepository } from '../../db/repositories/deck-repository.js';
import { deckService } from '../../services/deck-service.js';
import { imageRepository } from '../../db/repositories/image-repository.js';
import { validateImageBlob } from '../../utils/validation.js';
import { generateId } from '../../utils/ids.js';
import { showToast } from '../components/toast.js';

// Session-level memory for last selected deck to speed up consecutive creation
let lastUsedDeckId = null;

export async function renderEditorView(container, queryParams, router) {
  const cardId = queryParams.get('id');
  const queryDeckId = queryParams.get('deckId');
  const isEdit = !!cardId;

  let decks = await deckRepository.findAll();

  let card = null;
  if (isEdit) {
    card = await cardService.getCardById(cardId);
    if (!card) {
      showToast('Cartão não encontrado.', 'error');
      router.navigate('/cards');
      return { destroy: () => {} };
    }
  }

  // Determine initially selected deck
  let selectedDeckId = card ? card.deckId : (queryDeckId || lastUsedDeckId || (decks[0]?.id || null));

  let activeImageIds = card ? [...(card.imageIds || [])] : [];
  let loadedImageUrls = new Map();

  for (const imgId of activeImageIds) {
    const asset = await imageRepository.findById(imgId);
    if (asset && asset.blob) {
      loadedImageUrls.set(imgId, URL.createObjectURL(asset.blob));
    }
  }

  function render() {
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">${isEdit ? 'Editar Cartão' : 'Novo Cartão'}</h1>
          <p class="page-subtitle">${isEdit ? 'Atualize as informações do cartão' : 'Pressione Ctrl+Enter ou Cmd+Enter para salvar rapidamente'}</p>
        </div>
        <button id="btn-cancel-editor" class="btn btn-ghost btn-sm">Voltar para Cartões</button>
      </div>

      <div class="card-panel">
        <form id="card-form">
          <!-- Deck Selection & Inline Creation -->
          <div class="form-group">
            <label class="form-label" for="deck-select">Baralho *</label>
            <div class="deck-selector-row">
              <select id="deck-select" class="form-select" required style="flex: 1;">
                ${decks.length === 0 ? '<option value="">Nenhum baralho disponível</option>' : ''}
                ${decks.map((d) => `
                  <option value="${d.id}" ${d.id === selectedDeckId ? 'selected' : ''}>${d.name}</option>
                `).join('')}
              </select>
              <button type="button" id="btn-inline-new-deck" class="btn btn-secondary btn-sm" title="Criar novo baralho sem perder dados digitados">+ Criar Baralho</button>
            </div>
          </div>

          <!-- Question & Answer Fields -->
          <div class="form-group">
            <label class="form-label" for="front-input">Pergunta (Frente) *</label>
            <textarea id="front-input" class="form-textarea" required placeholder="Digite a pergunta, conceito ou código..." style="min-height: 100px;">${card ? card.front : ''}</textarea>
          </div>

          <div class="form-group">
            <label class="form-label" for="back-input">Resposta (Verso) *</label>
            <textarea id="back-input" class="form-textarea" required placeholder="Digite a resposta esperada..." style="min-height: 100px;">${card ? card.back : ''}</textarea>
          </div>

          <!-- Secondary details (Format, Tags, Image) in clean compact layout -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); margin-top: var(--space-3);">
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label" for="tags-input">Etiquetas (opcional)</label>
              <input type="text" id="tags-input" class="form-input" placeholder="ex: javascript, algoritmos" value="${card ? (card.tags || []).join(', ') : ''}">
            </div>

            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label" for="format-select">Formato</label>
              <select id="format-select" class="form-select">
                <option value="markdown" ${(card ? card.contentFormat : 'markdown') === 'markdown' ? 'selected' : ''}>Markdown / Código</option>
                <option value="plain" ${(card ? card.contentFormat : '') === 'plain' ? 'selected' : ''}>Texto Simples</option>
              </select>
            </div>
          </div>

          <!-- Attached Images -->
          <div style="margin-top: var(--space-4); padding-top: var(--space-3); border-top: 1px solid var(--color-border-subtle);">
            <div style="display: flex; align-items: center; justify-content: space-between;">
              <label class="form-label" style="margin-bottom: 0;">Imagens</label>
              <label for="image-upload-input" class="btn btn-ghost btn-sm" style="cursor: pointer;">
                📷 Anexar imagem
              </label>
              <input type="file" id="image-upload-input" accept="image/png, image/jpeg, image/webp, image/gif" style="display: none;">
            </div>

            <div id="image-previews" style="display: flex; gap: var(--space-2); flex-wrap: wrap; margin-top: var(--space-2);">
              ${activeImageIds.map((id) => {
                const url = loadedImageUrls.get(id);
                return `
                  <div style="position: relative; width: 64px; height: 64px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); overflow: hidden;">
                    <img src="${url}" style="width: 100%; height: 100%; object-fit: cover;">
                    <button type="button" class="btn-remove-img" data-img-id="${id}" style="position: absolute; top: 1px; right: 1px; background: rgba(0,0,0,0.6); color: #fff; width: 18px; height: 18px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px;">&times;</button>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          ${isEdit ? `
            <div style="margin-top: var(--space-4); padding: var(--space-3); background: var(--color-surface-hover); border-radius: var(--radius-sm);">
              <label style="display: flex; align-items: center; gap: var(--space-2); cursor: pointer; font-size: var(--font-size-xs);">
                <input type="checkbox" id="chk-reset-srs">
                Reiniciar agendamento de repetição deste cartão
              </label>
            </div>
          ` : ''}

          <!-- Form Buttons -->
          <div style="display: flex; justify-content: flex-end; gap: var(--space-2); margin-top: var(--space-6);">
            ${!isEdit ? `
              <button type="button" id="btn-save-and-create-another" class="btn btn-secondary">Salvar e criar outro</button>
            ` : ''}
            <button type="submit" id="btn-save-card" class="btn btn-primary">
              ${isEdit ? 'Salvar Alterações' : 'Salvar Cartão'}
            </button>
          </div>
        </form>
      </div>

      <!-- Inline Create Deck Modal -->
      <div id="inline-deck-modal"></div>
    `;

    bindEvents();
  }

  function showInlineCreateDeckModal() {
    const modalHost = container.querySelector('#inline-deck-modal');
    modalHost.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal-dialog">
          <h2 class="modal-header">Criar Novo Baralho</h2>
          <div class="form-group">
            <label class="form-label" for="inline-deck-name">Nome do Baralho *</label>
            <input type="text" id="inline-deck-name" class="form-input" placeholder="Ex: Algoritmos e Complexidade" autofocus>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn btn-secondary btn-sm" id="btn-cancel-inline-deck">Cancelar</button>
            <button type="button" class="btn btn-primary btn-sm" id="btn-confirm-inline-deck">Criar e Selecionar</button>
          </div>
        </div>
      </div>
    `;

    const nameInput = modalHost.querySelector('#inline-deck-name');
    nameInput.focus();

    modalHost.querySelector('#btn-cancel-inline-deck').addEventListener('click', () => {
      modalHost.innerHTML = '';
    });

    const createAction = async () => {
      const name = nameInput.value.trim();
      if (!name) {
        showToast('Informe o nome do baralho.', 'error');
        return;
      }
      try {
        const newDeck = await deckService.createDeck({ name });
        decks = await deckRepository.findAll();
        selectedDeckId = newDeck.id;
        lastUsedDeckId = newDeck.id;

        // Preserve current inputs in memory before updating select options
        const currentFront = container.querySelector('#front-input')?.value || '';
        const currentBack = container.querySelector('#back-input')?.value || '';
        const currentTags = container.querySelector('#tags-input')?.value || '';
        const currentFormat = container.querySelector('#format-select')?.value || 'markdown';

        modalHost.innerHTML = '';
        render();

        // Restore values
        if (container.querySelector('#front-input')) container.querySelector('#front-input').value = currentFront;
        if (container.querySelector('#back-input')) container.querySelector('#back-input').value = currentBack;
        if (container.querySelector('#tags-input')) container.querySelector('#tags-input').value = currentTags;
        if (container.querySelector('#format-select')) container.querySelector('#format-select').value = currentFormat;

        showToast(`Baralho "${newDeck.name}" criado!`, 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    };

    modalHost.querySelector('#btn-confirm-inline-deck').addEventListener('click', createAction);
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        createAction();
      }
    });
  }

  async function handleSave(createAnother = false) {
    const deckSelect = container.querySelector('#deck-select');
    const frontInput = container.querySelector('#front-input');
    const backInput = container.querySelector('#back-input');
    const tagsInput = container.querySelector('#tags-input');
    const formatSelect = container.querySelector('#format-select');

    const deckId = deckSelect.value;
    const front = frontInput.value.trim();
    const back = backInput.value.trim();
    const tags = tagsInput.value;
    const contentFormat = formatSelect.value;
    const resetSrs = !!container.querySelector('#chk-reset-srs')?.checked;

    if (!deckId) {
      showToast('Selecione ou crie um baralho.', 'error');
      return;
    }
    if (!front) {
      showToast('A pergunta é obrigatória.', 'error');
      frontInput.focus();
      return;
    }
    if (!back) {
      showToast('A resposta é obrigatória.', 'error');
      backInput.focus();
      return;
    }

    try {
      if (isEdit) {
        await cardService.updateCard(
          cardId,
          {
            deckId,
            front,
            back,
            tags,
            contentFormat,
            imageIds: activeImageIds
          },
          resetSrs
        );
        showToast('Cartão salvo com sucesso!', 'success');
        router.navigate('/cards');
      } else {
        await cardService.createCard({
          deckId,
          front,
          back,
          tags,
          contentFormat,
          imageIds: activeImageIds
        });

        lastUsedDeckId = deckId;
        showToast('Cartão criado com sucesso!', 'success');

        if (createAnother) {
          // Clear question & answer, keep selected deck & tags
          frontInput.value = '';
          backInput.value = '';
          activeImageIds = [];
          for (const url of loadedImageUrls.values()) {
            URL.revokeObjectURL(url);
          }
          loadedImageUrls.clear();
          const previewList = container.querySelector('#image-previews');
          if (previewList) previewList.innerHTML = '';
          frontInput.focus();
        } else {
          router.navigate('/cards');
        }
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  function bindEvents() {
    container.querySelector('#btn-cancel-editor').addEventListener('click', () => {
      router.navigate('/cards');
    });

    const deckSelect = container.querySelector('#deck-select');
    deckSelect.addEventListener('change', (e) => {
      selectedDeckId = e.target.value;
      lastUsedDeckId = selectedDeckId;
    });

    container.querySelector('#btn-inline-new-deck').addEventListener('click', () => {
      showInlineCreateDeckModal();
    });

    const form = container.querySelector('#card-form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      handleSave(false);
    });

    const btnCreateAnother = container.querySelector('#btn-save-and-create-another');
    if (btnCreateAnother) {
      btnCreateAnother.addEventListener('click', () => {
        handleSave(true);
      });
    }

    // Keyboard shortcut: Ctrl+Enter or Cmd+Enter to save immediately
    form.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSave(false);
      }
    });

    // Image Upload
    const imgUpload = container.querySelector('#image-upload-input');
    imgUpload.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const validation = validateImageBlob(file);
      if (!validation.isValid) {
        showToast(validation.error, 'error');
        imgUpload.value = '';
        return;
      }

      try {
        const imageId = generateId();
        await imageRepository.save({
          id: imageId,
          blob: file,
          mimeType: file.type,
          sizeBytes: file.size,
          name: file.name,
          createdAt: new Date().toISOString()
        });
        activeImageIds.push(imageId);
        loadedImageUrls.set(imageId, URL.createObjectURL(file));

        const previewList = container.querySelector('#image-previews');
        const url = loadedImageUrls.get(imageId);
        const div = document.createElement('div');
        div.style.cssText = 'position: relative; width: 64px; height: 64px; border: 1px solid var(--color-border); border-radius: var(--radius-sm); overflow: hidden;';
        div.innerHTML = `
          <img src="${url}" style="width: 100%; height: 100%; object-fit: cover;">
          <button type="button" class="btn-remove-img" data-img-id="${imageId}" style="position: absolute; top: 1px; right: 1px; background: rgba(0,0,0,0.6); color: #fff; width: 18px; height: 18px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px;">&times;</button>
        `;
        previewList.appendChild(div);

        div.querySelector('.btn-remove-img').addEventListener('click', () => {
          activeImageIds = activeImageIds.filter((id) => id !== imageId);
          URL.revokeObjectURL(url);
          loadedImageUrls.delete(imageId);
          div.remove();
        });

        showToast('Imagem adicionada.', 'success');
      } catch (err) {
        showToast('Erro ao salvar imagem: ' + err.message, 'error');
      }
    });

    container.querySelectorAll('.btn-remove-img').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-img-id');
        activeImageIds = activeImageIds.filter((imgId) => imgId !== id);
        if (loadedImageUrls.has(id)) {
          URL.revokeObjectURL(loadedImageUrls.get(id));
          loadedImageUrls.delete(id);
        }
        btn.parentElement.remove();
      });
    });

    // Auto-focus question input
    const frontInput = container.querySelector('#front-input');
    if (frontInput) frontInput.focus();
  }

  render();

  return {
    destroy: () => {
      for (const url of loadedImageUrls.values()) {
        URL.revokeObjectURL(url);
      }
      loadedImageUrls.clear();
    }
  };
}

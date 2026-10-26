import { studyService } from '../../services/study-service.js';
import { deckRepository } from '../../db/repositories/deck-repository.js';
import { imageRepository } from '../../db/repositories/image-repository.js';
import { renderCardContent } from '../render.js';
import { showToast } from '../components/toast.js';

export async function renderStudyView(container, queryParams, router) {
  const targetDeckId = queryParams.get('deckId') || undefined;
  const decks = await deckRepository.findAll();
  const deckMap = new Map(decks.map((d) => [d.id, d.name]));

  let queue = [];
  let currentIndex = 0;
  let isAnswerRevealed = false;
  let isSavingReview = false;
  let reviewedCount = 0;
  let totalQueueSize = 0;
  let activeImageUrls = [];

  try {
    const sessionData = await studyService.buildStudySession({
      deckId: targetDeckId,
      includeNew: true,
      limitNew: 20,
      limitDue: 100
    });
    queue = [...sessionData.queue];
    totalQueueSize = queue.length;
  } catch (err) {
    showToast('Erro ao carregar sessão: ' + err.message, 'error');
  }

  function cleanupImageUrls() {
    for (const url of activeImageUrls) {
      URL.revokeObjectURL(url);
    }
    activeImageUrls = [];
  }

  async function render() {
    cleanupImageUrls();

    // Session finished or empty
    if (queue.length === 0 || currentIndex >= queue.length) {
      container.innerHTML = `
        <div class="study-screen" style="padding-top: var(--space-6);">
          <div class="empty-state">
            <div class="empty-icon" aria-hidden="true">✓</div>
            <h2 class="empty-title">Revisão Concluída</h2>
            <p class="empty-desc">
              ${reviewedCount > 0
                ? `Você revisou <strong>${reviewedCount}</strong> cartão(ões) com sucesso.`
                : 'Não há cartões pendentes de revisão ou novos para estudar neste momento.'}
            </p>
            <div style="display: flex; justify-content: center; gap: var(--space-2); flex-wrap: wrap;">
              <button id="btn-back-decks" class="btn btn-secondary">Ver Baralhos</button>
              <button id="btn-create-more-cards" class="btn btn-primary">+ Criar Cartões</button>
            </div>
          </div>
        </div>
      `;

      container.querySelector('#btn-back-decks').addEventListener('click', () => router.navigate('/decks'));
      container.querySelector('#btn-create-more-cards').addEventListener('click', () => {
        const dest = targetDeckId ? `/cards/new?deckId=${targetDeckId}` : '/cards/new';
        router.navigate(dest);
      });
      return;
    }

    const currentItem = queue[currentIndex];
    const currentCard = currentItem.card;
    const remainingInQueue = queue.length - currentIndex;
    const deckName = deckMap.get(currentCard.deckId) || 'Estudo';

    // Progress: based on how many of the original total were processed
    const progressPct = totalQueueSize > 0
      ? Math.min(100, Math.round((reviewedCount / totalQueueSize) * 100))
      : 0;

    // Load any card images
    const imageElements = [];
    if (currentCard.imageIds && currentCard.imageIds.length > 0) {
      for (const imgId of currentCard.imageIds) {
        const asset = await imageRepository.findById(imgId);
        if (asset && asset.blob) {
          const url = URL.createObjectURL(asset.blob);
          activeImageUrls.push(url);
          imageElements.push(
            `<img src="${url}" alt="Imagem do cartão" style="max-width: 100%; max-height: 200px; border-radius: var(--radius-md); border: 1px solid var(--color-border); object-fit: contain;">`
          );
        }
      }
    }

    container.innerHTML = `
      <div class="study-screen" role="main" aria-label="Revisão de cartão">
        <!-- Compact, non-distracting header -->
        <div class="study-header">
          <div class="study-meta">
            <span class="study-deck-name" title="${deckName}">${deckName}</span>
            <div class="study-progress-bar" role="progressbar" aria-valuenow="${progressPct}" aria-valuemin="0" aria-valuemax="100" aria-label="Progresso da sessão">
              <div class="study-progress-fill" style="width: ${progressPct}%;"></div>
            </div>
            <span class="study-remaining">${remainingInQueue} restante${remainingInQueue !== 1 ? 's' : ''}</span>
          </div>
          <button id="btn-exit-study" class="btn btn-ghost btn-sm" title="Encerrar sessão de estudo" aria-label="Encerrar estudo">
            Encerrar
          </button>
        </div>

        <!-- The Flashcard -->
        <div class="study-card" aria-live="polite" aria-atomic="false">
          <!-- Question -->
          <div class="study-question card-content" id="study-question-content">
            ${renderCardContent(currentCard.front, currentCard.contentFormat)}
          </div>

          ${imageElements.length > 0 ? `
            <div style="display: flex; gap: var(--space-3); flex-wrap: wrap; margin-top: var(--space-4);">
              ${imageElements.join('')}
            </div>
          ` : ''}

          <!-- Answer (shown after reveal) -->
          ${isAnswerRevealed ? `
            <hr class="study-divider" aria-hidden="true">
            <div class="study-answer card-content" id="study-answer-content">
              ${renderCardContent(currentCard.back, currentCard.contentFormat)}
            </div>
          ` : ''}
        </div>

        <!-- Controls -->
        <div class="study-controls">
          ${!isAnswerRevealed ? `
            <button id="btn-reveal-answer" class="btn btn-primary btn-lg" style="width: 100%;" aria-label="Mostrar a resposta">
              Mostrar Resposta
              <span style="font-size: var(--font-size-xs); opacity: 0.75; font-weight: 400; margin-left: var(--space-2);">Espaço</span>
            </button>
          ` : `
            <div class="study-ratings" role="group" aria-label="Como foi sua resposta?">
              <button id="btn-rate-again" class="btn-rating rating-again" ${isSavingReview ? 'disabled aria-disabled="true"' : ''} aria-label="De novo — menos de 1 minuto">
                De novo
                <small>1</small>
                <small>&lt; 1 min</small>
              </button>
              <button id="btn-rate-hard" class="btn-rating rating-hard" ${isSavingReview ? 'disabled aria-disabled="true"' : ''} aria-label="Difícil — 1 dia">
                Difícil
                <small>2</small>
                <small>1 dia</small>
              </button>
              <button id="btn-rate-good" class="btn-rating rating-good" ${isSavingReview ? 'disabled aria-disabled="true"' : ''} aria-label="Bom">
                Bom
                <small>3</small>
                <small>${currentCard.scheduling?.repetitions === 0 ? '1 dia' : (currentCard.scheduling?.repetitions === 1 ? '3 dias' : `${Math.round(currentCard.scheduling?.intervalDays * 2)}d`)}</small>
              </button>
              <button id="btn-rate-easy" class="btn-rating rating-easy" ${isSavingReview ? 'disabled aria-disabled="true"' : ''} aria-label="Fácil">
                Fácil
                <small>4</small>
                <small>${currentCard.scheduling?.repetitions === 0 ? '4 dias' : `${Math.round(currentCard.scheduling?.intervalDays * 2.5)}d`}</small>
              </button>
            </div>
          `}
        </div>
      </div>
    `;

    bindEvents();
  }

  async function handleRating(rating) {
    if (isSavingReview) return;
    isSavingReview = true;

    container.querySelectorAll('.study-ratings button').forEach((b) => {
      b.disabled = true;
      b.setAttribute('aria-disabled', 'true');
    });

    const currentItem = queue[currentIndex];
    const currentCard = currentItem.card;

    try {
      const result = await studyService.submitRating(
        currentCard.id,
        rating,
        currentItem.lapseCountInSession
      );

      reviewedCount++;

      if (result.requeue) {
        queue.push({
          card: result.card,
          lapseCountInSession: result.nextLapseCount
        });
      }

      currentIndex++;
      isAnswerRevealed = false;
      isSavingReview = false;
      await render();
    } catch (err) {
      showToast('Erro ao salvar avaliação: ' + err.message, 'error');
      isSavingReview = false;
      container.querySelectorAll('.study-ratings button').forEach((b) => {
        b.disabled = false;
        b.removeAttribute('aria-disabled');
      });
    }
  }

  function handleKeyDown(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (!isAnswerRevealed) {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        isAnswerRevealed = true;
        render();
      }
    } else {
      if (e.key === '1') handleRating('again');
      if (e.key === '2') handleRating('hard');
      if (e.key === '3') handleRating('good');
      if (e.key === '4') handleRating('easy');
    }
  }

  function bindEvents() {
    container.querySelector('#btn-exit-study')?.addEventListener('click', () => {
      router.navigate('/decks');
    });

    const btnReveal = container.querySelector('#btn-reveal-answer');
    if (btnReveal) {
      btnReveal.addEventListener('click', () => {
        isAnswerRevealed = true;
        render();
      });
    }

    container.querySelector('#btn-rate-again')?.addEventListener('click', () => handleRating('again'));
    container.querySelector('#btn-rate-hard')?.addEventListener('click', () => handleRating('hard'));
    container.querySelector('#btn-rate-good')?.addEventListener('click', () => handleRating('good'));
    container.querySelector('#btn-rate-easy')?.addEventListener('click', () => handleRating('easy'));
  }

  window.addEventListener('keydown', handleKeyDown);
  await render();

  return {
    destroy: () => {
      window.removeEventListener('keydown', handleKeyDown);
      cleanupImageUrls();
    }
  };
}

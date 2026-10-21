import { describe, it, expect, beforeEach } from 'vitest';
import { deckService } from '../../src/services/deck-service.js';
import { cardService } from '../../src/services/card-service.js';
import { studyService } from '../../src/services/study-service.js';
import { searchService } from '../../src/services/search-service.js';
import { backupService } from '../../src/services/backup-service.js';
import { deckRepository } from '../../src/db/repositories/deck-repository.js';
import { cardRepository } from '../../src/db/repositories/card-repository.js';
import { reviewRepository } from '../../src/db/repositories/review-repository.js';
import { imageRepository } from '../../src/db/repositories/image-repository.js';

describe('Comprehensive Mandatory Flow Tests (Item 9)', () => {
  beforeEach(async () => {
    await deckRepository.clear();
    await cardRepository.clear();
    await reviewRepository.clear();
    await imageRepository.clear();
  });

  // 1 & 2. Criar e editar um baralho, criar e editar um cartão
  it('creates and edits decks and cards cleanly', async () => {
    const deck = await deckService.createDeck({ name: 'Matemática', description: 'Cálculo I' });
    expect(deck.name).toBe('Matemática');

    const updatedDeck = await deckService.updateDeck(deck.id, { name: 'Cálculo Avançado', description: 'Cálculo I e II' });
    expect(updatedDeck.name).toBe('Cálculo Avançado');

    const card = await cardService.createCard({
      deckId: deck.id,
      front: 'O que é limite?',
      back: 'Valor do qual uma função se aproxima.',
      tags: ['calc', 'analise']
    });
    expect(card.front).toBe('O que é limite?');

    const updatedCard = await cardService.updateCard(card.id, {
      deckId: deck.id,
      front: 'Definição formal de limite',
      back: 'Para todo epsilon > 0 existe delta > 0...'
    });
    expect(updatedCard.front).toBe('Definição formal de limite');
  });

  // 3. Persistir após recarregar a página (verificar que dados salvos em repositórios permanecem íntegros)
  it('persists data reliably in IndexedDB across reads', async () => {
    const deck = await deckService.createDeck({ name: 'Física Clássica' });
    await cardService.createCard({
      deckId: deck.id,
      front: 'Segunda Lei de Newton',
      back: 'F = m * a'
    });

    const retrievedDecks = await deckRepository.findAll();
    const retrievedCards = await cardRepository.findAll();

    expect(retrievedDecks.length).toBe(1);
    expect(retrievedCards.length).toBe(1);
    expect(retrievedCards[0].back).toBe('F = m * a');
  });

  // 4. Pesquisar e filtrar cartões
  it('searches and filters cards by text, deck, tags and review status', async () => {
    const deckA = await deckService.createDeck({ name: 'Deck A' });
    const deckB = await deckService.createDeck({ name: 'Deck B' });

    await cardService.createCard({
      deckId: deckA.id,
      front: 'Pergunta Alpha',
      back: 'Resposta Especial',
      tags: ['tag1']
    });

    await cardService.createCard({
      deckId: deckB.id,
      front: 'Pergunta Beta',
      back: 'Outra coisa',
      tags: ['tag2']
    });

    const searchResult = await searchService.searchCards({ query: 'especial' });
    expect(searchResult.length).toBe(1);
    expect(searchResult[0].front).toBe('Pergunta Alpha');

    const filterByDeck = await searchService.searchCards({ deckId: deckB.id });
    expect(filterByDeck.length).toBe(1);
    expect(filterByDeck[0].front).toBe('Pergunta Beta');

    const filterByTag = await searchService.searchCards({ tags: ['tag1'] });
    expect(filterByTag.length).toBe(1);
    expect(filterByTag[0].front).toBe('Pergunta Alpha');
  });

  // 5 & 6. Registrar uma revisão e atualizar corretamente o agendamento
  it('records reviews and updates scheduling according to spaced repetition rules', async () => {
    const refClock = new Date('2026-10-21T12:00:00.000Z');
    const deck = await deckService.createDeck({ name: 'Biologia' }, refClock);
    const card = await cardService.createCard({
      deckId: deck.id,
      front: 'Função da mitocôndria',
      back: 'Respiração celular e geração de ATP'
    }, refClock);

    // Initial review: Good -> 1 day interval
    const reviewResult = await studyService.submitRating(card.id, 'good', 0, refClock);
    expect(reviewResult.card.scheduling.intervalDays).toBe(1);
    expect(reviewResult.card.scheduling.repetitions).toBe(1);

    const history = await reviewRepository.findByCardId(card.id);
    expect(history.length).toBe(1);
    expect(history[0].rating).toBe('good');
    expect(history[0].nextIntervalDays).toBe(1);
  });

  // 7, 8 & 9. Exportar, validar, restaurar, rejeitar backup inválido e tratar IDs duplicados na mesclagem
  it('exports backup and handles restore, rejection and ID deduplication on merge', async () => {
    const deck = await deckService.createDeck({ name: 'Química Orgânica' });
    const card = await cardService.createCard({
      deckId: deck.id,
      front: 'Fórmula do Metano',
      back: 'CH4'
    });

    const backup = await backupService.exportBackup();
    expect(backup.format).toBe('anki-web-backup');

    // Reject invalid backup without modifying database
    expect(() => backupService.validateBackup({ invalid: true })).not.toThrow();
    const validation = backupService.validateBackup({ invalid: true });
    expect(validation.isValid).toBe(false);

    // Rejection doesn't touch existing data
    await expect(backupService.importBackup({ invalid: true })).rejects.toThrow();
    const cardsStillThere = await cardRepository.findAll();
    expect(cardsStillThere.length).toBe(1);

    // Test Merge strategy with duplicate deck name / IDs:
    // It should remap duplicate IDs cleanly without crashing
    const mergeResult = await backupService.importBackup(backup, 'merge');
    expect(mergeResult).toBeDefined();

    const allCardsAfterMerge = await cardRepository.findAll();
    // 1 original card + 1 remapped merged card
    expect(allCardsAfterMerge.length).toBe(2);
  });

  // 11. Excluir cartões e respectivos históricos
  it('deletes cards and their associated review history transactionally', async () => {
    const deck = await deckService.createDeck({ name: 'Geografia' });
    const card = await cardService.createCard({
      deckId: deck.id,
      front: 'Capital da Austrália',
      back: 'Camberra'
    });

    await studyService.submitRating(card.id, 'easy', 0);
    const reviewsBefore = await reviewRepository.findByCardId(card.id);
    expect(reviewsBefore.length).toBe(1);

    await cardService.deleteCard(card.id);
    const cardAfter = await cardRepository.findById(card.id);
    expect(cardAfter).toBeNull();
    const reviewsAfter = await reviewRepository.findByCardId(card.id);
    expect(reviewsAfter.length).toBe(0);
  });
});

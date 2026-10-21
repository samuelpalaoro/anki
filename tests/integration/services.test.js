import { describe, it, expect, beforeEach } from 'vitest';
import { deckRepository } from '../../src/db/repositories/deck-repository.js';
import { cardRepository } from '../../src/db/repositories/card-repository.js';
import { reviewRepository } from '../../src/db/repositories/review-repository.js';
import { imageRepository } from '../../src/db/repositories/image-repository.js';
import { settingsRepository } from '../../src/db/repositories/settings-repository.js';
import { deckService } from '../../src/services/deck-service.js';
import { cardService } from '../../src/services/card-service.js';
import { studyService } from '../../src/services/study-service.js';
import { searchService } from '../../src/services/search-service.js';
import { backupService } from '../../src/services/backup-service.js';

describe('Business Services & Workflows Integration', () => {
  beforeEach(async () => {
    await deckRepository.clear();
    await cardRepository.clear();
    await reviewRepository.clear();
    await imageRepository.clear();
    await settingsRepository.clear();
  });

  it('creates deck, prevents duplicates and handles deletion with cards', async () => {
    const deck1 = await deckService.createDeck({ name: 'Matemática', description: 'Cálculo' });
    expect(deck1.id).toBeDefined();

    // Reject duplicate name
    await expect(deckService.createDeck({ name: ' matemática ' })).rejects.toThrow();

    // Add card to deck
    const card = await cardService.createCard({
      deckId: deck1.id,
      front: 'O que é derivada?',
      back: 'Taxa de variação instantânea.'
    });
    expect(card.id).toBeDefined();

    // Attempting to delete deck with cards without strategy must fail
    await expect(deckService.deleteDeck(deck1.id)).rejects.toThrow();

    // Create another deck to test move strategy
    const deck2 = await deckService.createDeck({ name: 'Física Geral' });
    await deckService.deleteDeck(deck1.id, 'move', deck2.id);

    const updatedCard = await cardService.getCardById(card.id);
    expect(updatedCard.deckId).toBe(deck2.id);

    // Delete deck2 with cascade
    await deckService.deleteDeck(deck2.id, 'cascade');
    const remainingCard = await cardService.getCardById(card.id);
    expect(remainingCard).toBeNull();
  });

  it('executes study session workflow and records reviews', async () => {
    const fixedNow = new Date('2026-10-21T10:00:00.000Z');
    const deck = await deckService.createDeck({ name: 'Inglês' }, fixedNow);

    const card = await cardService.createCard({
      deckId: deck.id,
      front: 'Book',
      back: 'Livro'
    }, fixedNow);

    // Build session
    const session = await studyService.buildStudySession({
      deckId: deck.id,
      includeNew: true,
      clock: fixedNow
    });
    expect(session.queue.length).toBe(1);
    expect(session.queue[0].card.id).toBe(card.id);

    // Submit rating 'good'
    const result = await studyService.submitRating(card.id, 'good', 0, fixedNow);
    expect(result.card.scheduling.intervalDays).toBe(1);
    expect(result.card.scheduling.repetitions).toBe(1);
    expect(result.requeue).toBe(false);

    // Check review saved
    const reviews = await reviewRepository.findByCardId(card.id);
    expect(reviews.length).toBe(1);
    expect(reviews[0].rating).toBe('good');
  });

  it('searches cards with query and filters', async () => {
    const deck = await deckService.createDeck({ name: 'Programação' });
    await cardService.createCard({
      deckId: deck.id,
      front: 'O que é Array?',
      back: 'Estrutura linear contígua.',
      tags: ['estrutura-dados', 'algoritmos']
    });
    await cardService.createCard({
      deckId: deck.id,
      front: 'O que é Objeto?',
      back: 'Coleção chave-valor.',
      tags: ['oop', 'javascript']
    });

    const search1 = await searchService.searchCards({ query: 'linear' });
    expect(search1.length).toBe(1);
    expect(search1[0].front).toContain('Array');

    const searchTags = await searchService.searchCards({ tags: ['oop'] });
    expect(searchTags.length).toBe(1);
    expect(searchTags[0].front).toContain('Objeto');
  });

  it('exports and restores backup accurately', async () => {
    const deck = await deckService.createDeck({ name: 'História' });
    const card = await cardService.createCard({
      deckId: deck.id,
      front: 'Ano da Proclamação da República',
      back: '1889',
      tags: ['brasil']
    });

    const backup = await backupService.exportBackup();
    expect(backup.decks.length).toBe(1);
    expect(backup.cards.length).toBe(1);

    // Clear DB
    await deckRepository.clear();
    await cardRepository.clear();

    // Import replace
    await backupService.importBackup(backup, 'replace');

    const restoredDecks = await deckRepository.findAll();
    const restoredCards = await cardRepository.findAll();
    expect(restoredDecks.length).toBe(1);
    expect(restoredDecks[0].name).toBe('História');
    expect(restoredCards.length).toBe(1);
    expect(restoredCards[0].front).toBe(card.front);
  });
});

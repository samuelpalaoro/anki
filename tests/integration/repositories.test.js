import { describe, it, expect, beforeEach } from 'vitest';
import { deckRepository } from '../../src/db/repositories/deck-repository.js';
import { cardRepository } from '../../src/db/repositories/card-repository.js';
import { reviewRepository } from '../../src/db/repositories/review-repository.js';
import { imageRepository } from '../../src/db/repositories/image-repository.js';
import { settingsRepository } from '../../src/db/repositories/settings-repository.js';

describe('IndexedDB Repositories integration', () => {
  beforeEach(async () => {
    await deckRepository.clear();
    await cardRepository.clear();
    await reviewRepository.clear();
    await imageRepository.clear();
    await settingsRepository.clear();
  });

  it('persists and retrieves decks', async () => {
    const deck = {
      id: 'deck-1',
      name: 'JavaScript & Web',
      description: 'Conceitos web',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await deckRepository.save(deck);

    const found = await deckRepository.findById('deck-1');
    expect(found).not.toBeNull();
    expect(found.name).toBe('JavaScript & Web');

    const byName = await deckRepository.findByName('javascript & web');
    expect(byName).not.toBeNull();
    expect(byName.id).toBe('deck-1');
  });

  it('persists and retrieves cards and queries by deckId', async () => {
    const card1 = {
      id: 'c-1',
      deckId: 'deck-1',
      front: 'O que é closure?',
      back: 'Função com escopo léxico.',
      contentFormat: 'plain',
      tags: ['js'],
      imageIds: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      scheduling: {
        dueAt: new Date().toISOString(),
        lastReviewedAt: null,
        intervalDays: 0,
        repetitions: 0,
        lapses: 0,
        status: 'new'
      }
    };
    await cardRepository.save(card1);

    const cards = await cardRepository.findByDeckId('deck-1');
    expect(cards.length).toBe(1);
    expect(cards[0].front).toBe('O que é closure?');
  });

  it('persists and queries reviews', async () => {
    const review = {
      id: 'r-1',
      cardId: 'c-1',
      reviewedAt: new Date().toISOString(),
      rating: 'good',
      previousIntervalDays: 0,
      nextIntervalDays: 1
    };
    await reviewRepository.save(review);

    const reviews = await reviewRepository.findByCardId('c-1');
    expect(reviews.length).toBe(1);
    expect(reviews[0].rating).toBe('good');
  });

  it('persists image blobs and reads them back', async () => {
    const blob = new Blob(['sample-image-data'], { type: 'image/png' });
    const img = {
      id: 'img-1',
      blob,
      mimeType: 'image/png',
      sizeBytes: blob.size,
      name: 'teste.png',
      createdAt: new Date().toISOString()
    };
    await imageRepository.save(img);

    const found = await imageRepository.findById('img-1');
    expect(found).not.toBeNull();
    expect(found.sizeBytes).toBe(blob.size);
  });

  it('reads and writes settings key-values', async () => {
    await settingsRepository.set('theme', 'light');
    const val = await settingsRepository.get('theme');
    expect(val).toBe('light');

    const defaultVal = await settingsRepository.get('non_existent', 42);
    expect(defaultVal).toBe(42);
  });
});

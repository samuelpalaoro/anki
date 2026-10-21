import { cardRepository } from '../db/repositories/card-repository.js';
import { deckRepository } from '../db/repositories/deck-repository.js';
import { reviewRepository } from '../db/repositories/review-repository.js';
import { validateCardData } from '../utils/validation.js';
import { generateId } from '../utils/ids.js';
import { toISOString } from '../utils/dates.js';
import { createInitialScheduling } from './scheduler.js';
import { withTransaction } from '../db/database.js';
import { DB_CONFIG } from '../config/constants.js';

export const cardService = {
  /**
   * Retrieves a card by ID
   * @param {string} id
   * @returns {Promise<Object|null>}
   */
  async getCardById(id) {
    return await cardRepository.findById(id);
  },

  /**
   * Retrieves all cards
   * @returns {Promise<Array<Object>>}
   */
  async getAllCards() {
    return await cardRepository.findAll();
  },

  /**
   * Creates a new card
   * @param {Object} input
   * @param {Date|string|number} [clock]
   * @returns {Promise<Object>}
   */
  async createCard(input, clock = new Date()) {
    const validation = validateCardData(input);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    const { sanitized } = validation;
    const deck = await deckRepository.findById(sanitized.deckId);
    if (!deck) {
      throw new Error('Baralho informado não existe.');
    }

    const nowISO = toISOString(clock);
    const newCard = {
      id: generateId(),
      deckId: sanitized.deckId,
      front: sanitized.front,
      back: sanitized.back,
      contentFormat: sanitized.contentFormat,
      imageIds: sanitized.imageIds,
      tags: sanitized.tags,
      createdAt: nowISO,
      updatedAt: nowISO,
      scheduling: createInitialScheduling(clock)
    };

    return await cardRepository.save(newCard);
  },

  /**
   * Updates an existing card
   * @param {string} id
   * @param {Object} input
   * @param {boolean} [resetScheduling=false]
   * @param {Date|string|number} [clock]
   * @returns {Promise<Object>}
   */
  async updateCard(id, input, resetScheduling = false, clock = new Date()) {
    const existing = await cardRepository.findById(id);
    if (!existing) {
      throw new Error('Cartão não encontrado.');
    }

    const validation = validateCardData({
      deckId: input.deckId || existing.deckId,
      front: input.front ?? existing.front,
      back: input.back ?? existing.back,
      contentFormat: input.contentFormat ?? existing.contentFormat,
      imageIds: input.imageIds ?? existing.imageIds,
      tags: input.tags ?? existing.tags
    });

    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    const { sanitized } = validation;
    if (sanitized.deckId !== existing.deckId) {
      const targetDeck = await deckRepository.findById(sanitized.deckId);
      if (!targetDeck) {
        throw new Error('Baralho de destino não existe.');
      }
    }

    const nowISO = toISOString(clock);
    existing.deckId = sanitized.deckId;
    existing.front = sanitized.front;
    existing.back = sanitized.back;
    existing.contentFormat = sanitized.contentFormat;
    existing.imageIds = sanitized.imageIds;
    existing.tags = sanitized.tags;
    existing.updatedAt = nowISO;

    if (resetScheduling) {
      existing.scheduling = createInitialScheduling(clock);
    }

    return await cardRepository.save(existing);
  },

  /**
   * Deletes a card and its associated reviews atomically
   * @param {string} id
   * @returns {Promise<boolean>}
   */
  async deleteCard(id) {
    const existing = await cardRepository.findById(id);
    if (!existing) {
      throw new Error('Cartão não encontrado.');
    }

    const { STORES } = DB_CONFIG;
    await withTransaction([STORES.CARDS, STORES.REVIEWS], 'readwrite', async (stores) => {
      stores[STORES.CARDS].delete(id);
      const reviewIndex = stores[STORES.REVIEWS].index('cardId');
      const req = reviewIndex.getAllKeys(id);
      req.onsuccess = () => {
        const keys = req.result || [];
        for (const k of keys) {
          stores[STORES.REVIEWS].delete(k);
        }
      };
    });

    return true;
  },

  /**
   * Returns all unique normalized tags across all cards
   * @returns {Promise<string[]>}
   */
  async getAllTags() {
    const cards = await cardRepository.findAll();
    const tagSet = new Set();
    for (const card of cards) {
      if (Array.isArray(card.tags)) {
        for (const t of card.tags) {
          tagSet.add(t);
        }
      }
    }
    return Array.from(tagSet).sort();
  },

  /**
   * Removes a tag from all cards without deleting the cards
   * @param {string} tagToRemove
   * @returns {Promise<number>} Number of cards modified
   */
  async removeTag(tagToRemove) {
    const cleanTag = tagToRemove.trim().toLowerCase().replace(/^#+/, '');
    const cards = await cardRepository.findAll();
    const modifiedCards = [];

    for (const card of cards) {
      if (Array.isArray(card.tags) && card.tags.includes(cleanTag)) {
        card.tags = card.tags.filter((t) => t !== cleanTag);
        card.updatedAt = new Date().toISOString();
        modifiedCards.push(card);
      }
    }

    if (modifiedCards.length > 0) {
      await cardRepository.saveMany(modifiedCards);
    }

    return modifiedCards.length;
  }
};

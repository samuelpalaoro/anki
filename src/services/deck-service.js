import { deckRepository } from '../db/repositories/deck-repository.js';
import { cardRepository } from '../db/repositories/card-repository.js';
import { reviewRepository } from '../db/repositories/review-repository.js';
import { validateDeckData } from '../utils/validation.js';
import { generateId } from '../utils/ids.js';
import { toISOString } from '../utils/dates.js';
import { withTransaction } from '../db/database.js';
import { DB_CONFIG } from '../config/constants.js';

export const deckService = {
  /**
   * Retrieves all decks with card statistics
   * @returns {Promise<Array<Object>>}
   */
  async getAllDecksWithStats(clock = new Date()) {
    const decks = await deckRepository.findAll();
    const cards = await cardRepository.findAll();
    const nowTime = new Date(clock).getTime();

    return decks.map((deck) => {
      const deckCards = cards.filter((c) => c.deckId === deck.id);
      const newCount = deckCards.filter((c) => c.scheduling?.status === 'new').length;
      const dueCount = deckCards.filter((c) => {
        if (!c.scheduling?.dueAt) return false;
        return new Date(c.scheduling.dueAt).getTime() <= nowTime && c.scheduling?.status !== 'new';
      }).length;

      return {
        ...deck,
        totalCards: deckCards.length,
        newCards: newCount,
        dueCards: dueCount
      };
    });
  },

  /**
   * Creates a new deck
   * @param {Object} input
   * @param {Date|string|number} [clock]
   * @returns {Promise<Object>}
   */
  async createDeck(input, clock = new Date()) {
    const validation = validateDeckData(input);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    const existing = await deckRepository.findByName(validation.sanitizedName);
    if (existing) {
      throw new Error(`Já existe um baralho com o nome "${validation.sanitizedName}".`);
    }

    const nowISO = toISOString(clock);
    const newDeck = {
      id: generateId(),
      name: validation.sanitizedName,
      description: input.description ? input.description.trim() : '',
      createdAt: nowISO,
      updatedAt: nowISO
    };

    return await deckRepository.save(newDeck);
  },

  /**
   * Updates an existing deck
   * @param {string} id
   * @param {Object} input
   * @param {Date|string|number} [clock]
   * @returns {Promise<Object>}
   */
  async updateDeck(id, input, clock = new Date()) {
    const deck = await deckRepository.findById(id);
    if (!deck) {
      throw new Error('Baralho não encontrado.');
    }

    const validation = validateDeckData(input);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    const existing = await deckRepository.findByName(validation.sanitizedName);
    if (existing && existing.id !== id) {
      throw new Error(`Já existe outro baralho com o nome "${validation.sanitizedName}".`);
    }

    const nowISO = toISOString(clock);
    deck.name = validation.sanitizedName;
    deck.description = input.description ? input.description.trim() : '';
    deck.updatedAt = nowISO;

    return await deckRepository.save(deck);
  },

  /**
   * Deletes a deck.
   * If deck has cards, action must be explicitly specified:
   * 'cascade' (delete cards and reviews) or 'move' (with targetDeckId)
   *
   * @param {string} deckId
   * @param {'cascade'|'move'} [strategy]
   * @param {string} [targetDeckId]
   * @returns {Promise<{deletedDeckId: string, affectedCards: number}>}
   */
  async deleteDeck(deckId, strategy, targetDeckId) {
    const deck = await deckRepository.findById(deckId);
    if (!deck) {
      throw new Error('Baralho não encontrado.');
    }

    const cards = await cardRepository.findByDeckId(deckId);

    if (cards.length > 0 && !strategy) {
      throw new Error(
        `O baralho possui ${cards.length} cartão(ões). Escolha excluir os cartões ou movê-los para outro baralho.`
      );
    }

    if (strategy === 'move') {
      if (!targetDeckId || targetDeckId === deckId) {
        throw new Error('Baralho de destino inválido para movimentação de cartões.');
      }
      const targetDeck = await deckRepository.findById(targetDeckId);
      if (!targetDeck) {
        throw new Error('Baralho de destino não encontrado.');
      }
    }

    // Atomic transaction covering decks, cards and reviews
    const { STORES } = DB_CONFIG;
    await withTransaction([STORES.DECKS, STORES.CARDS, STORES.REVIEWS], 'readwrite', async (stores) => {
      if (strategy === 'move') {
        for (const card of cards) {
          card.deckId = targetDeckId;
          card.updatedAt = new Date().toISOString();
          stores[STORES.CARDS].put(card);
        }
      } else if (strategy === 'cascade' || cards.length === 0) {
        for (const card of cards) {
          // Delete card
          stores[STORES.CARDS].delete(card.id);
          // Delete card reviews
          const reviewIndex = stores[STORES.REVIEWS].index('cardId');
          const reviewReq = reviewIndex.getAllKeys(card.id);
          reviewReq.onsuccess = () => {
            const keys = reviewReq.result || [];
            for (const key of keys) {
              stores[STORES.REVIEWS].delete(key);
            }
          };
        }
      }

      // Delete deck
      stores[STORES.DECKS].delete(deckId);
    });

    return { deletedDeckId: deckId, affectedCards: cards.length };
  }
};

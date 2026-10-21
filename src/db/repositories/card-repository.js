import { DB_CONFIG } from '../../config/constants.js';
import { withTransaction, wrapRequest } from '../database.js';

const STORE = DB_CONFIG.STORES.CARDS;

export const cardRepository = {
  /**
   * Finds a card by ID
   * @param {string} id
   * @returns {Promise<Object|null>}
   */
  async findById(id) {
    return withTransaction([STORE], 'readonly', async (stores) => {
      const res = await wrapRequest(stores[STORE].get(id));
      return res || null;
    });
  },

  /**
   * Retrieves all cards
   * @returns {Promise<Object[]>}
   */
  async findAll() {
    return withTransaction([STORE], 'readonly', async (stores) => {
      const res = await wrapRequest(stores[STORE].getAll());
      return res || [];
    });
  },

  /**
   * Finds all cards belonging to a specific deck
   * @param {string} deckId
   * @returns {Promise<Object[]>}
   */
  async findByDeckId(deckId) {
    return withTransaction([STORE], 'readonly', async (stores) => {
      const index = stores[STORE].index('deckId');
      const res = await wrapRequest(index.getAll(deckId));
      return res || [];
    });
  },

  /**
   * Saves or updates a card
   * @param {Object} card
   * @returns {Promise<Object>}
   */
  async save(card) {
    return withTransaction([STORE], 'readwrite', async (stores) => {
      await wrapRequest(stores[STORE].put(card));
      return card;
    });
  },

  /**
   * Saves multiple cards in a single atomic transaction
   * @param {Object[]} cards
   * @returns {Promise<Object[]>}
   */
  async saveMany(cards) {
    return withTransaction([STORE], 'readwrite', async (stores) => {
      for (const card of cards) {
        await wrapRequest(stores[STORE].put(card));
      }
      return cards;
    });
  },

  /**
   * Deletes a card by ID
   * @param {string} id
   * @returns {Promise<boolean>}
   */
  async deleteById(id) {
    return withTransaction([STORE], 'readwrite', async (stores) => {
      await wrapRequest(stores[STORE].delete(id));
      return true;
    });
  },

  /**
   * Clears all cards
   */
  async clear() {
    return withTransaction([STORE], 'readwrite', async (stores) => {
      await wrapRequest(stores[STORE].clear());
      return true;
    });
  }
};

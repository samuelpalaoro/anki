import { DB_CONFIG } from '../../config/constants.js';
import { withTransaction, wrapRequest } from '../database.js';

const STORE = DB_CONFIG.STORES.REVIEWS;

export const reviewRepository = {
  /**
   * Finds a review by ID
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
   * Retrieves all reviews
   * @returns {Promise<Object[]>}
   */
  async findAll() {
    return withTransaction([STORE], 'readonly', async (stores) => {
      const res = await wrapRequest(stores[STORE].getAll());
      return res || [];
    });
  },

  /**
   * Finds all reviews for a specific card
   * @param {string} cardId
   * @returns {Promise<Object[]>}
   */
  async findByCardId(cardId) {
    return withTransaction([STORE], 'readonly', async (stores) => {
      const index = stores[STORE].index('cardId');
      const res = await wrapRequest(index.getAll(cardId));
      return res || [];
    });
  },

  /**
   * Saves a review entry
   * @param {Object} review
   * @returns {Promise<Object>}
   */
  async save(review) {
    return withTransaction([STORE], 'readwrite', async (stores) => {
      await wrapRequest(stores[STORE].put(review));
      return review;
    });
  },

  /**
   * Deletes reviews associated with a card
   * @param {string} cardId
   * @returns {Promise<number>}
   */
  async deleteByCardId(cardId) {
    return withTransaction([STORE], 'readwrite', async (stores) => {
      const index = stores[STORE].index('cardId');
      const keys = await wrapRequest(index.getAllKeys(cardId));
      for (const key of keys) {
        await wrapRequest(stores[STORE].delete(key));
      }
      return keys.length;
    });
  },

  /**
   * Clears all reviews
   */
  async clear() {
    return withTransaction([STORE], 'readwrite', async (stores) => {
      await wrapRequest(stores[STORE].clear());
      return true;
    });
  }
};

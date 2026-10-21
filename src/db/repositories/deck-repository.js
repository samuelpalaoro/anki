import { DB_CONFIG } from '../../config/constants.js';
import { withTransaction, wrapRequest } from '../database.js';

const STORE = DB_CONFIG.STORES.DECKS;

export const deckRepository = {
  /**
   * Finds a deck by its ID
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
   * Retrieves all decks
   * @returns {Promise<Object[]>}
   */
  async findAll() {
    return withTransaction([STORE], 'readonly', async (stores) => {
      const res = await wrapRequest(stores[STORE].getAll());
      return res || [];
    });
  },

  /**
   * Finds a deck by normalized name
   * @param {string} name
   * @returns {Promise<Object|null>}
   */
  async findByName(name) {
    const targetName = name.trim().toLowerCase();
    const all = await this.findAll();
    return all.find((d) => d.name.trim().toLowerCase() === targetName) || null;
  },

  /**
   * Saves or updates a deck entity
   * @param {Object} deck
   * @returns {Promise<Object>}
   */
  async save(deck) {
    return withTransaction([STORE], 'readwrite', async (stores) => {
      await wrapRequest(stores[STORE].put(deck));
      return deck;
    });
  },

  /**
   * Deletes a deck by ID
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
   * Clears all decks (used in tests or collection restore)
   */
  async clear() {
    return withTransaction([STORE], 'readwrite', async (stores) => {
      await wrapRequest(stores[STORE].clear());
      return true;
    });
  }
};

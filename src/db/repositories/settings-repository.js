import { DB_CONFIG } from '../../config/constants.js';
import { withTransaction, wrapRequest } from '../database.js';

const STORE = DB_CONFIG.STORES.SETTINGS;

export const settingsRepository = {
  /**
   * Retrieves a setting value by key
   * @param {string} key
   * @param {any} [defaultValue=null]
   * @returns {Promise<any>}
   */
  async get(key, defaultValue = null) {
    return withTransaction([STORE], 'readonly', async (stores) => {
      const res = await wrapRequest(stores[STORE].get(key));
      return res ? res.value : defaultValue;
    });
  },

  /**
   * Sets a setting value
   * @param {string} key
   * @param {any} value
   * @returns {Promise<void>}
   */
  async set(key, value) {
    return withTransaction([STORE], 'readwrite', async (stores) => {
      await wrapRequest(stores[STORE].put({ key, value }));
    });
  },

  /**
   * Retrieves all settings as a key-value map
   * @returns {Promise<Object>}
   */
  async getAll() {
    return withTransaction([STORE], 'readonly', async (stores) => {
      const all = await wrapRequest(stores[STORE].getAll());
      const map = {};
      for (const item of all || []) {
        map[item.key] = item.value;
      }
      return map;
    });
  },

  /**
   * Clears all settings
   */
  async clear() {
    return withTransaction([STORE], 'readwrite', async (stores) => {
      await wrapRequest(stores[STORE].clear());
      return true;
    });
  }
};

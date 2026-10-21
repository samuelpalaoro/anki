import { DB_CONFIG } from '../../config/constants.js';
import { withTransaction, wrapRequest } from '../database.js';

const STORE = DB_CONFIG.STORES.IMAGES;

export const imageRepository = {
  /**
   * Finds an image asset by ID
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
   * Retrieves all image assets
   * @returns {Promise<Object[]>}
   */
  async findAll() {
    return withTransaction([STORE], 'readonly', async (stores) => {
      const res = await wrapRequest(stores[STORE].getAll());
      return res || [];
    });
  },

  /**
   * Saves an image asset
   * @param {Object} image
   * @returns {Promise<Object>}
   */
  async save(image) {
    return withTransaction([STORE], 'readwrite', async (stores) => {
      await wrapRequest(stores[STORE].put(image));
      return image;
    });
  },

  /**
   * Deletes an image by ID
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
   * Clears all images
   */
  async clear() {
    return withTransaction([STORE], 'readwrite', async (stores) => {
      await wrapRequest(stores[STORE].clear());
      return true;
    });
  }
};

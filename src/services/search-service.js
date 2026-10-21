import { cardRepository } from '../db/repositories/card-repository.js';
import { isDue } from '../utils/dates.js';
import { SCHEDULER_CONFIG } from '../config/constants.js';

export const searchService = {
  /**
   * Filters and searches cards with multiple criteria
   *
   * @param {Object} options
   * @param {string} [options.query]
   * @param {string} [options.deckId]
   * @param {string[]} [options.tags]
   * @param {'all'|'new'|'due'|'learning'} [options.status='all']
   * @param {Date|string|number} [options.clock]
   * @returns {Promise<Array<Object>>}
   */
  async searchCards(options = {}) {
    const {
      query = '',
      deckId,
      tags = [],
      status = 'all',
      clock = new Date()
    } = options;

    let cards = await cardRepository.findAll();

    // 1. Deck Filter
    if (deckId) {
      cards = cards.filter((c) => c.deckId === deckId);
    }

    // 2. Query Search (case-insensitive, trims extra whitespace)
    const cleanQuery = query.trim().toLowerCase();
    if (cleanQuery) {
      cards = cards.filter((c) => {
        const frontMatch = (c.front || '').toLowerCase().includes(cleanQuery);
        const backMatch = (c.back || '').toLowerCase().includes(cleanQuery);
        return frontMatch || backMatch;
      });
    }

    // 3. Tags Filter (all specified tags must match)
    if (tags && tags.length > 0) {
      const cleanTags = tags.map((t) => t.trim().toLowerCase().replace(/^#+/, ''));
      cards = cards.filter((c) => {
        const cardTags = (c.tags || []).map((t) => t.toLowerCase());
        return cleanTags.every((t) => cardTags.includes(t));
      });
    }

    // 4. Status Filter
    if (status && status !== 'all') {
      cards = cards.filter((c) => {
        if (status === 'new') {
          return c.scheduling?.status === SCHEDULER_CONFIG.STATUS.NEW;
        }
        if (status === 'due') {
          return c.scheduling?.status !== SCHEDULER_CONFIG.STATUS.NEW && isDue(c.scheduling?.dueAt, clock);
        }
        if (status === 'learning') {
          return c.scheduling?.status === SCHEDULER_CONFIG.STATUS.LEARNING && !isDue(c.scheduling?.dueAt, clock);
        }
        return true;
      });
    }

    return cards;
  }
};

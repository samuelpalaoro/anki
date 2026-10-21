import { cardRepository } from '../db/repositories/card-repository.js';
import { reviewRepository } from '../db/repositories/review-repository.js';
import { calculateNextSchedule } from './scheduler.js';
import { generateId } from '../utils/ids.js';
import { toISOString, isDue } from '../utils/dates.js';
import { withTransaction } from '../db/database.js';
import { DB_CONFIG, SCHEDULER_CONFIG } from '../config/constants.js';

export const studyService = {
  /**
   * Builds the study queue based on user filters
   *
   * @param {Object} options
   * @param {string} [options.deckId]
   * @param {boolean} [options.includeNew=true]
   * @param {number} [options.limitNew=20]
   * @param {number} [options.limitDue=50]
   * @param {Date|string|number} [options.clock]
   * @returns {Promise<{queue: Array<Object>, totalDue: number, totalNew: number}>}
   */
  async buildStudySession(options = {}) {
    const {
      deckId,
      includeNew = true,
      limitNew = 20,
      limitDue = 100,
      clock = new Date()
    } = options;

    let allCards = deckId
      ? await cardRepository.findByDeckId(deckId)
      : await cardRepository.findAll();

    const dueCards = [];
    const newCards = [];

    for (const card of allCards) {
      if (card.scheduling?.status === SCHEDULER_CONFIG.STATUS.NEW) {
        newCards.push(card);
      } else if (isDue(card.scheduling?.dueAt, clock)) {
        dueCards.push(card);
      }
    }

    // Sort due cards (oldest due first)
    dueCards.sort((a, b) => new Date(a.scheduling.dueAt) - new Date(b.scheduling.dueAt));

    // Sort new cards (oldest created first)
    newCards.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    const selectedDue = dueCards.slice(0, limitDue);
    const selectedNew = includeNew ? newCards.slice(0, limitNew) : [];

    // Prioritize due cards first, followed by new cards
    const initialQueue = [...selectedDue, ...selectedNew].map((card) => ({
      card,
      lapseCountInSession: 0
    }));

    return {
      queue: initialQueue,
      totalDue: dueCards.length,
      totalNew: newCards.length
    };
  },

  /**
   * Submits a rating for a card in the study session.
   * Persists card update and review history atomically.
   * Returns updated card, review entry, and boolean whether card should be requeued in this session.
   *
   * @param {string} cardId
   * @param {'again'|'hard'|'good'|'easy'} rating
   * @param {number} [currentLapseCountInSession=0]
   * @param {Date|string|number} [clock=new Date()]
   * @returns {Promise<{card: Object, review: Object, requeue: boolean, nextLapseCount: number}>}
   */
  async submitRating(cardId, rating, currentLapseCountInSession = 0, clock = new Date()) {
    const card = await cardRepository.findById(cardId);
    if (!card) {
      throw new Error('Cartão não encontrado.');
    }

    const nowISO = toISOString(clock);
    const scheduleResult = calculateNextSchedule(card.scheduling, rating, clock);

    const review = {
      id: generateId(),
      cardId: card.id,
      reviewedAt: nowISO,
      rating,
      previousIntervalDays: scheduleResult.meta.previousIntervalDays,
      nextIntervalDays: scheduleResult.meta.nextIntervalDays
    };

    const updatedCard = {
      ...card,
      scheduling: scheduleResult.scheduling,
      updatedAt: nowISO
    };

    // Atomic transaction
    const { STORES } = DB_CONFIG;
    await withTransaction([STORES.CARDS, STORES.REVIEWS], 'readwrite', async (stores) => {
      stores[STORES.CARDS].put(updatedCard);
      stores[STORES.REVIEWS].put(review);
    });

    let requeue = false;
    let nextLapseCount = currentLapseCountInSession;

    if (rating === SCHEDULER_CONFIG.RATINGS.AGAIN) {
      nextLapseCount += 1;
      // Re-queue card if not exceeded session retry limit
      if (nextLapseCount <= SCHEDULER_CONFIG.AGAIN_LAPSE_RETRY_LIMIT) {
        requeue = true;
      }
    }

    return {
      card: updatedCard,
      review,
      requeue,
      nextLapseCount
    };
  },

  /**
   * Retrieves summary statistics for the home dashboard
   * @param {Date|string|number} [clock=new Date()]
   * @returns {Promise<Object>}
   */
  async getDashboardStats(clock = new Date()) {
    const cards = await cardRepository.findAll();
    const reviews = await reviewRepository.findAll();
    const nowTime = new Date(clock).getTime();

    const todayStart = new Date(clock);
    todayStart.setHours(0, 0, 0, 0);
    const todayStartTime = todayStart.getTime();

    let totalCards = cards.length;
    let dueCount = 0;
    let newCount = 0;

    for (const card of cards) {
      if (card.scheduling?.status === SCHEDULER_CONFIG.STATUS.NEW) {
        newCount++;
      } else if (new Date(card.scheduling?.dueAt).getTime() <= nowTime) {
        dueCount++;
      }
    }

    let todayReviewsCount = 0;
    for (const r of reviews) {
      if (new Date(r.reviewedAt).getTime() >= todayStartTime) {
        todayReviewsCount++;
      }
    }

    return {
      totalCards,
      dueCards: dueCount,
      newCards: newCount,
      todayReviews: todayReviewsCount
    };
  }
};

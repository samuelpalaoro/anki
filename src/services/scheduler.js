import { SCHEDULER_CONFIG } from '../config/constants.js';
import { addDays, toISOString } from '../utils/dates.js';

const { RATINGS, STATUS, INTERVALS } = SCHEDULER_CONFIG;

/**
 * Pure function that calculates the next scheduling state for a card
 * given its current state, the rating selected, and an explicit clock.
 *
 * @param {Object} currentScheduling
 * @param {'again'|'hard'|'good'|'easy'} rating
 * @param {Date|string|number} [now]
 * @returns {Object} Updated scheduling object and review meta
 */
export function calculateNextSchedule(currentScheduling, rating, now = new Date()) {
  const currentNowISO = toISOString(now);

  const repetitions = currentScheduling?.repetitions || 0;
  const currentInterval = currentScheduling?.intervalDays || 0;
  const lapses = currentScheduling?.lapses || 0;

  let nextIntervalDays = 0;
  let nextRepetitions = repetitions;
  let nextLapses = lapses;
  let nextStatus = currentScheduling?.status || STATUS.NEW;

  switch (rating) {
    case RATINGS.AGAIN: {
      // De novo: Próximo intervalo: 0 dias, repetições: 0, incrementa lapses
      nextIntervalDays = INTERVALS.AGAIN_DAYS;
      nextRepetitions = 0;
      nextLapses = lapses + 1;
      nextStatus = STATUS.LEARNING;
      break;
    }

    case RATINGS.HARD: {
      // Difícil: 1ª revisão = 1 dia; revisões posteriores = round(anterior * 1.2), min 1 dia
      if (repetitions === 0) {
        nextIntervalDays = INTERVALS.HARD_FIRST_DAYS;
      } else {
        nextIntervalDays = Math.max(1, Math.round(currentInterval * INTERVALS.HARD_FACTOR));
      }
      nextRepetitions = repetitions + 1;
      nextStatus = STATUS.LEARNING;
      break;
    }

    case RATINGS.GOOD: {
      // Bom: 1ª revisão = 1 dia; 2ª revisão = 3 dias; seguintes = round(anterior * 2), min 1 dia
      if (repetitions === 0) {
        nextIntervalDays = INTERVALS.GOOD_FIRST_DAYS;
      } else if (repetitions === 1) {
        nextIntervalDays = INTERVALS.GOOD_SECOND_DAYS;
      } else {
        nextIntervalDays = Math.max(1, Math.round(currentInterval * INTERVALS.GOOD_FACTOR));
      }
      nextRepetitions = repetitions + 1;
      nextStatus = STATUS.LEARNING;
      break;
    }

    case RATINGS.EASY: {
      // Fácil: 1ª revisão = 4 dias; posteriores = round(anterior * 2.5), min 1 dia
      if (repetitions === 0) {
        nextIntervalDays = INTERVALS.EASY_FIRST_DAYS;
      } else {
        nextIntervalDays = Math.max(1, Math.round(currentInterval * INTERVALS.EASY_FACTOR));
      }
      nextRepetitions = repetitions + 1;
      nextStatus = STATUS.LEARNING;
      break;
    }

    default:
      throw new Error(`Avaliação inválida: "${rating}". Esperado: again, hard, good ou easy.`);
  }

  // Calculate next due date
  const nextDueAt = addDays(now, nextIntervalDays);

  return {
    scheduling: {
      dueAt: nextDueAt,
      lastReviewedAt: currentNowISO,
      intervalDays: nextIntervalDays,
      repetitions: nextRepetitions,
      lapses: nextLapses,
      status: nextStatus
    },
    meta: {
      previousIntervalDays: currentInterval,
      nextIntervalDays
    }
  };
}

/**
 * Creates initial default scheduling for a newly created card
 * @param {Date|string|number} [now]
 * @returns {Object}
 */
export function createInitialScheduling(now = new Date()) {
  const nowISO = toISOString(now);
  return {
    dueAt: nowISO,
    lastReviewedAt: null,
    intervalDays: 0,
    repetitions: 0,
    lapses: 0,
    status: STATUS.NEW
  };
}

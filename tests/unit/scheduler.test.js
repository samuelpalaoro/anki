import { describe, it, expect } from 'vitest';
import { calculateNextSchedule, createInitialScheduling } from '../../src/services/scheduler.js';

describe('Scheduler pure business rules', () => {
  const fixedClock = new Date('2026-10-21T12:00:00.000Z');

  it('creates default initial scheduling for a new card', () => {
    const s = createInitialScheduling(fixedClock);
    expect(s.dueAt).toBe('2026-10-21T12:00:00.000Z');
    expect(s.lastReviewedAt).toBeNull();
    expect(s.intervalDays).toBe(0);
    expect(s.repetitions).toBe(0);
    expect(s.lapses).toBe(0);
    expect(s.status).toBe('new');
  });

  describe('Rating: Again (De novo)', () => {
    it('resets interval to 0, resets repetitions to 0, increments lapses and sets learning', () => {
      const initial = {
        dueAt: '2026-10-20T12:00:00.000Z',
        lastReviewedAt: '2026-10-15T12:00:00.000Z',
        intervalDays: 5,
        repetitions: 3,
        lapses: 1,
        status: 'learning'
      };

      const result = calculateNextSchedule(initial, 'again', fixedClock);
      expect(result.scheduling.intervalDays).toBe(0);
      expect(result.scheduling.repetitions).toBe(0);
      expect(result.scheduling.lapses).toBe(2);
      expect(result.scheduling.status).toBe('learning');
      expect(result.scheduling.lastReviewedAt).toBe('2026-10-21T12:00:00.000Z');
      expect(result.scheduling.dueAt).toBe('2026-10-21T12:00:00.000Z');
      expect(result.meta.previousIntervalDays).toBe(5);
      expect(result.meta.nextIntervalDays).toBe(0);
    });
  });

  describe('Rating: Hard (Difícil)', () => {
    it('sets first review to 1 day and increments repetitions', () => {
      const initial = createInitialScheduling(fixedClock);
      const result = calculateNextSchedule(initial, 'hard', fixedClock);
      expect(result.scheduling.intervalDays).toBe(1);
      expect(result.scheduling.repetitions).toBe(1);
      expect(result.scheduling.lapses).toBe(0);
      expect(result.scheduling.dueAt).toBe('2026-10-22T12:00:00.000Z');
    });

    it('multiplies subsequent reviews by 1.2 with round, min 1 day', () => {
      const state = {
        intervalDays: 4,
        repetitions: 2,
        lapses: 0,
        status: 'learning'
      };
      // 4 * 1.2 = 4.8 => round is 5
      const result = calculateNextSchedule(state, 'hard', fixedClock);
      expect(result.scheduling.intervalDays).toBe(5);
      expect(result.scheduling.repetitions).toBe(3);
    });
  });

  describe('Rating: Good (Bom)', () => {
    it('sets first review to 1 day', () => {
      const initial = createInitialScheduling(fixedClock);
      const res1 = calculateNextSchedule(initial, 'good', fixedClock);
      expect(res1.scheduling.intervalDays).toBe(1);
      expect(res1.scheduling.repetitions).toBe(1);
      expect(res1.scheduling.dueAt).toBe('2026-10-22T12:00:00.000Z');

      // 2nd review: 3 days
      const res2 = calculateNextSchedule(res1.scheduling, 'good', fixedClock);
      expect(res2.scheduling.intervalDays).toBe(3);
      expect(res2.scheduling.repetitions).toBe(2);
      expect(res2.scheduling.dueAt).toBe('2026-10-24T12:00:00.000Z');

      // 3rd review: 3 * 2 = 6 days
      const res3 = calculateNextSchedule(res2.scheduling, 'good', fixedClock);
      expect(res3.scheduling.intervalDays).toBe(6);
      expect(res3.scheduling.repetitions).toBe(3);
      expect(res3.scheduling.dueAt).toBe('2026-10-27T12:00:00.000Z');
    });
  });

  describe('Rating: Easy (Fácil)', () => {
    it('sets first review to 4 days', () => {
      const initial = createInitialScheduling(fixedClock);
      const res1 = calculateNextSchedule(initial, 'easy', fixedClock);
      expect(res1.scheduling.intervalDays).toBe(4);
      expect(res1.scheduling.repetitions).toBe(1);
      expect(res1.scheduling.dueAt).toBe('2026-10-25T12:00:00.000Z');

      // Subsequent review: 4 * 2.5 = 10 days
      const res2 = calculateNextSchedule(res1.scheduling, 'easy', fixedClock);
      expect(res2.scheduling.intervalDays).toBe(10);
      expect(res2.scheduling.repetitions).toBe(2);
      expect(res2.scheduling.dueAt).toBe('2026-10-31T12:00:00.000Z');
    });
  });

  it('throws an error on invalid rating', () => {
    const initial = createInitialScheduling(fixedClock);
    expect(() => calculateNextSchedule(initial, 'unknown_rating', fixedClock)).toThrow();
  });
});

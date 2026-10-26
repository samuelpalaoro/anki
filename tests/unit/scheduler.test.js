import { describe, it, expect } from 'vitest';
import { calculateNextSchedule, createInitialScheduling } from '../../src/services/scheduler.js';

/**
 * Scheduler Deterministic Test Suite
 *
 * Algorithm implemented: Simplified SM-2 variant
 *
 * Rules (from constants.js):
 *   AGAIN: interval=0, repetitions=0, lapses+1, status='learning'
 *   HARD:  rep=0→1d; rep>0→round(prev*1.2), min 1d; repetitions+1, status='learning'
 *   GOOD:  rep=0→1d; rep=1→3d; rep>1→round(prev*2.0), min 1d; repetitions+1, status='learning'
 *   EASY:  rep=0→4d; rep>0→round(prev*2.5), min 1d; repetitions+1, status='learning'
 *
 * Notable design decisions (NOT bugs):
 * - No 'graduated' status; all cards remain 'learning' (simplified product choice)
 * - No ease factor per-card (fixed multipliers instead of SM-2 EF)
 * - AGAIN always sets interval=0 (due "now"), never negative
 * - Intervals are in whole days (Math.round), using millisecond arithmetic in addDays
 */

describe('Scheduler pure business rules', () => {
  const fixedClock = new Date('2026-10-21T12:00:00.000Z');

  // ─── Initial State ──────────────────────────────────────────────────────
  describe('createInitialScheduling', () => {
    it('creates correct initial scheduling with injected clock', () => {
      const s = createInitialScheduling(fixedClock);
      expect(s.dueAt).toBe('2026-10-21T12:00:00.000Z');
      expect(s.lastReviewedAt).toBeNull();
      expect(s.intervalDays).toBe(0);
      expect(s.repetitions).toBe(0);
      expect(s.lapses).toBe(0);
      expect(s.status).toBe('new');
    });

    it('creates correct initial scheduling with default clock (real time — structural check only)', () => {
      const s = createInitialScheduling();
      expect(s.status).toBe('new');
      expect(s.repetitions).toBe(0);
      expect(s.lapses).toBe(0);
      expect(s.lastReviewedAt).toBeNull();
      expect(s.intervalDays).toBe(0);
      // dueAt should be a valid ISO string close to now
      expect(() => new Date(s.dueAt)).not.toThrow();
      expect(new Date(s.dueAt).getTime()).toBeGreaterThan(0);
    });
  });

  // ─── Rating: Again ──────────────────────────────────────────────────────
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
      expect(result.scheduling.lapses).toBe(2); // incremented from 1
      expect(result.scheduling.status).toBe('learning');
      expect(result.scheduling.lastReviewedAt).toBe('2026-10-21T12:00:00.000Z');
      expect(result.scheduling.dueAt).toBe('2026-10-21T12:00:00.000Z'); // due "now" (0 days)
      expect(result.meta.previousIntervalDays).toBe(5);
      expect(result.meta.nextIntervalDays).toBe(0);
    });

    it('increments lapses from 0 correctly on first lapse', () => {
      const initial = createInitialScheduling(fixedClock);
      const result = calculateNextSchedule(initial, 'again', fixedClock);
      expect(result.scheduling.lapses).toBe(1);
      expect(result.scheduling.repetitions).toBe(0);
    });

    it('never produces a negative interval from again', () => {
      const state = { intervalDays: 0, repetitions: 0, lapses: 0, status: 'new' };
      const result = calculateNextSchedule(state, 'again', fixedClock);
      expect(result.scheduling.intervalDays).toBeGreaterThanOrEqual(0);
    });

    it('again after long interval resets repetitions to 0, not to previous reps', () => {
      const state = { intervalDays: 120, repetitions: 15, lapses: 0, status: 'learning' };
      const result = calculateNextSchedule(state, 'again', fixedClock);
      expect(result.scheduling.repetitions).toBe(0);
      expect(result.scheduling.intervalDays).toBe(0);
    });
  });

  // ─── Rating: Hard ──────────────────────────────────────────────────────
  describe('Rating: Hard (Difícil)', () => {
    it('sets first review to 1 day and increments repetitions', () => {
      const initial = createInitialScheduling(fixedClock);
      const result = calculateNextSchedule(initial, 'hard', fixedClock);
      expect(result.scheduling.intervalDays).toBe(1);
      expect(result.scheduling.repetitions).toBe(1);
      expect(result.scheduling.lapses).toBe(0);
      expect(result.scheduling.dueAt).toBe('2026-10-22T12:00:00.000Z');
    });

    it('multiplies subsequent reviews by 1.2, rounded, min 1', () => {
      // interval=4, 4 * 1.2 = 4.8 → round → 5
      const state = { intervalDays: 4, repetitions: 2, lapses: 0, status: 'learning' };
      const result = calculateNextSchedule(state, 'hard', fixedClock);
      expect(result.scheduling.intervalDays).toBe(5);
      expect(result.scheduling.repetitions).toBe(3);
    });

    it('rounds correctly for interval=1: 1*1.2=1.2 → round → 1', () => {
      const state = { intervalDays: 1, repetitions: 1, lapses: 0, status: 'learning' };
      const result = calculateNextSchedule(state, 'hard', fixedClock);
      expect(result.scheduling.intervalDays).toBe(1);
    });

    it('rounds correctly for interval=3: 3*1.2=3.6 → round → 4', () => {
      const state = { intervalDays: 3, repetitions: 2, lapses: 0, status: 'learning' };
      const result = calculateNextSchedule(state, 'hard', fixedClock);
      expect(result.scheduling.intervalDays).toBe(4);
    });

    it('enforces minimum of 1 day even if multiplication result is 0', () => {
      // Edge case: if interval were 0 and reps>0, max(1, round(0*1.2)) = max(1,0) = 1
      const state = { intervalDays: 0, repetitions: 1, lapses: 0, status: 'learning' };
      const result = calculateNextSchedule(state, 'hard', fixedClock);
      expect(result.scheduling.intervalDays).toBeGreaterThanOrEqual(1);
    });
  });

  // ─── Rating: Good ───────────────────────────────────────────────────────
  describe('Rating: Good (Bom)', () => {
    it('progression: first=1d, second=3d, third=6d (3*2=6)', () => {
      const initial = createInitialScheduling(fixedClock);

      const res1 = calculateNextSchedule(initial, 'good', fixedClock);
      expect(res1.scheduling.intervalDays).toBe(1);
      expect(res1.scheduling.repetitions).toBe(1);
      expect(res1.scheduling.dueAt).toBe('2026-10-22T12:00:00.000Z');

      const res2 = calculateNextSchedule(res1.scheduling, 'good', fixedClock);
      expect(res2.scheduling.intervalDays).toBe(3);
      expect(res2.scheduling.repetitions).toBe(2);
      expect(res2.scheduling.dueAt).toBe('2026-10-24T12:00:00.000Z');

      const res3 = calculateNextSchedule(res2.scheduling, 'good', fixedClock);
      expect(res3.scheduling.intervalDays).toBe(6); // 3 * 2.0 = 6
      expect(res3.scheduling.repetitions).toBe(3);
      expect(res3.scheduling.dueAt).toBe('2026-10-27T12:00:00.000Z');
    });

    it('progression: 4th review = 6*2=12d, 5th=12*2=24d', () => {
      const state3 = { intervalDays: 6, repetitions: 3, lapses: 0, status: 'learning' };

      const res4 = calculateNextSchedule(state3, 'good', fixedClock);
      expect(res4.scheduling.intervalDays).toBe(12);
      expect(res4.scheduling.repetitions).toBe(4);

      const res5 = calculateNextSchedule(res4.scheduling, 'good', fixedClock);
      expect(res5.scheduling.intervalDays).toBe(24);
      expect(res5.scheduling.repetitions).toBe(5);
    });

    it('enforces minimum of 1 day on subsequent reviews', () => {
      const state = { intervalDays: 0, repetitions: 2, lapses: 0, status: 'learning' };
      const result = calculateNextSchedule(state, 'good', fixedClock);
      expect(result.scheduling.intervalDays).toBeGreaterThanOrEqual(1);
    });

    it('dueAt is correctly computed as clock + intervalDays', () => {
      // Use midnight to verify date arithmetic is clean
      const midnight = new Date('2026-11-01T00:00:00.000Z');
      const state = { intervalDays: 3, repetitions: 2, lapses: 0, status: 'learning' };
      const result = calculateNextSchedule(state, 'good', midnight);
      // 3*2=6 days after midnight Nov 1 = Nov 7 at 00:00:00Z
      expect(result.scheduling.dueAt).toBe('2026-11-07T00:00:00.000Z');
    });
  });

  // ─── Rating: Easy ───────────────────────────────────────────────────────
  describe('Rating: Easy (Fácil)', () => {
    it('sets first review to 4 days', () => {
      const initial = createInitialScheduling(fixedClock);
      const res1 = calculateNextSchedule(initial, 'easy', fixedClock);
      expect(res1.scheduling.intervalDays).toBe(4);
      expect(res1.scheduling.repetitions).toBe(1);
      expect(res1.scheduling.dueAt).toBe('2026-10-25T12:00:00.000Z');
    });

    it('subsequent review: 4*2.5=10d', () => {
      const res1 = { intervalDays: 4, repetitions: 1, lapses: 0, status: 'learning' };
      const res2 = calculateNextSchedule(res1, 'easy', fixedClock);
      expect(res2.scheduling.intervalDays).toBe(10);
      expect(res2.scheduling.repetitions).toBe(2);
      expect(res2.scheduling.dueAt).toBe('2026-10-31T12:00:00.000Z');
    });

    it('rounds correctly: 3*2.5=7.5 → round → 8', () => {
      const state = { intervalDays: 3, repetitions: 1, lapses: 0, status: 'learning' };
      const result = calculateNextSchedule(state, 'easy', fixedClock);
      expect(result.scheduling.intervalDays).toBe(8); // round(7.5) = 8
    });

    it('rounds correctly: 2*2.5=5 → 5', () => {
      const state = { intervalDays: 2, repetitions: 1, lapses: 0, status: 'learning' };
      const result = calculateNextSchedule(state, 'easy', fixedClock);
      expect(result.scheduling.intervalDays).toBe(5);
    });

    it('enforces minimum of 1 day on subsequent reviews', () => {
      const state = { intervalDays: 0, repetitions: 1, lapses: 0, status: 'learning' };
      const result = calculateNextSchedule(state, 'easy', fixedClock);
      expect(result.scheduling.intervalDays).toBeGreaterThanOrEqual(1);
    });
  });

  // ─── Sequential sessions ────────────────────────────────────────────────
  describe('Sequential review sessions', () => {
    it('good→good→good→again→good restores and continues correctly', () => {
      let state = createInitialScheduling(fixedClock);

      state = calculateNextSchedule(state, 'good', fixedClock).scheduling;
      expect(state.repetitions).toBe(1); // 1d

      state = calculateNextSchedule(state, 'good', fixedClock).scheduling;
      expect(state.repetitions).toBe(2); // 3d

      state = calculateNextSchedule(state, 'good', fixedClock).scheduling;
      expect(state.repetitions).toBe(3); // 6d

      // Lapse: again resets reps to 0
      state = calculateNextSchedule(state, 'again', fixedClock).scheduling;
      expect(state.repetitions).toBe(0);
      expect(state.lapses).toBe(1);
      expect(state.intervalDays).toBe(0);

      // Resume with good from rep=0: should go back to 1d
      state = calculateNextSchedule(state, 'good', fixedClock).scheduling;
      expect(state.intervalDays).toBe(1);
      expect(state.repetitions).toBe(1);
    });

    it('easy→easy produces exponential growth', () => {
      let state = createInitialScheduling(fixedClock);
      state = calculateNextSchedule(state, 'easy', fixedClock).scheduling; // 4d
      state = calculateNextSchedule(state, 'easy', fixedClock).scheduling; // 10d (round(4*2.5))
      state = calculateNextSchedule(state, 'easy', fixedClock).scheduling; // 25d (round(10*2.5))
      expect(state.intervalDays).toBe(25);
      expect(state.repetitions).toBe(3);
    });

    it('preserves lastReviewedAt as the clock used for the review', () => {
      const clock1 = new Date('2026-10-01T08:00:00.000Z');
      const clock2 = new Date('2026-10-10T14:30:00.000Z');
      let state = createInitialScheduling(clock1);

      state = calculateNextSchedule(state, 'good', clock1).scheduling;
      expect(state.lastReviewedAt).toBe('2026-10-01T08:00:00.000Z');

      state = calculateNextSchedule(state, 'good', clock2).scheduling;
      expect(state.lastReviewedAt).toBe('2026-10-10T14:30:00.000Z');
    });
  });

  // ─── Temporal edge cases ────────────────────────────────────────────────
  describe('Temporal edge cases', () => {
    it('works correctly around midnight UTC', () => {
      // Clock is 1 millisecond before midnight
      const almostMidnight = new Date('2026-10-21T23:59:59.999Z');
      const state = createInitialScheduling(almostMidnight);
      const result = calculateNextSchedule(state, 'good', almostMidnight);
      // 1 day = exactly 24*60*60*1000ms after almostMidnight
      const expected = new Date(almostMidnight.getTime() + 24 * 60 * 60 * 1000);
      expect(result.scheduling.dueAt).toBe(expected.toISOString());
    });

    it('works correctly at epoch start (very early date)', () => {
      const epoch = new Date(0);
      const state = createInitialScheduling(epoch);
      const result = calculateNextSchedule(state, 'easy', epoch);
      // 4 days from epoch
      expect(result.scheduling.intervalDays).toBe(4);
      expect(new Date(result.scheduling.dueAt).getTime()).toBe(
        epoch.getTime() + 4 * 24 * 60 * 60 * 1000
      );
    });

    it('dueAt from again equals clock exactly (0 day offset)', () => {
      const clock = new Date('2026-06-15T09:00:00.000Z');
      const state = { intervalDays: 30, repetitions: 5, lapses: 0, status: 'learning' };
      const result = calculateNextSchedule(state, 'again', clock);
      expect(result.scheduling.dueAt).toBe(clock.toISOString());
    });

    it('is reproducible: same inputs always produce same outputs', () => {
      const state = { intervalDays: 7, repetitions: 3, lapses: 1, status: 'learning' };
      const r1 = calculateNextSchedule(state, 'hard', fixedClock);
      const r2 = calculateNextSchedule(state, 'hard', fixedClock);
      expect(r1.scheduling.dueAt).toBe(r2.scheduling.dueAt);
      expect(r1.scheduling.intervalDays).toBe(r2.scheduling.intervalDays);
    });
  });

  // ─── Invalid input ──────────────────────────────────────────────────────
  describe('Invalid inputs', () => {
    it('throws on unknown rating string', () => {
      const initial = createInitialScheduling(fixedClock);
      expect(() => calculateNextSchedule(initial, 'unknown_rating', fixedClock)).toThrow();
    });

    it('throws on empty string rating', () => {
      const initial = createInitialScheduling(fixedClock);
      expect(() => calculateNextSchedule(initial, '', fixedClock)).toThrow();
    });

    it('handles missing scheduling object gracefully (treats as new card)', () => {
      // Should not throw; undefined scheduling → repetitions=0, intervalDays=0
      const result = calculateNextSchedule(undefined, 'good', fixedClock);
      expect(result.scheduling.intervalDays).toBe(1); // rep=0 → first good = 1
      expect(result.scheduling.repetitions).toBe(1);
    });

    it('handles null scheduling gracefully', () => {
      const result = calculateNextSchedule(null, 'easy', fixedClock);
      expect(result.scheduling.intervalDays).toBe(4); // rep=0 → first easy = 4
    });
  });

  // ─── Algorithm documentation ────────────────────────────────────────────
  describe('Algorithm documentation (formula verification)', () => {
    /**
     * This test group documents the exact formulas and verifies them explicitly.
     * It serves as a living specification of the scheduling algorithm.
     *
     * Algorithm: Simplified SM-2 variant (no per-card ease factor)
     *
     * AGAIN: nextInterval = 0, nextReps = 0, lapses++
     * HARD:  nextInterval = reps===0 ? 1 : max(1, round(prevInterval * 1.2))
     *        nextReps = reps + 1
     * GOOD:  nextInterval = reps===0 ? 1 : reps===1 ? 3 : max(1, round(prevInterval * 2.0))
     *        nextReps = reps + 1
     * EASY:  nextInterval = reps===0 ? 4 : max(1, round(prevInterval * 2.5))
     *        nextReps = reps + 1
     *
     * Comparison with standard SM-2:
     *   - SM-2 uses EF (ease factor) per card, starting at 2.5
     *   - This implementation uses FIXED multipliers (1.2/2.0/2.5) — simpler but less adaptive
     *   - SM-2 has minimum EF of 1.3; this implementation has min interval of 1 day
     *   - No 'graduated' status here — SM-2 has separate "new", "learning", "review" phases
     *
     * Known pedagogical limitations:
     *   1. HARD multiplier (1.2) on a 1-day interval stays at 1 day — no growth signal
     *   2. No per-card difficulty tracking — same card always gets same growth rate
     *   3. No maximum interval cap — intervals can grow unboundedly
     *
     * These are product decisions, NOT mathematical bugs.
     */

    it('hard on 1-day interval stays at 1 day (1.2 rounds down)', () => {
      const state = { intervalDays: 1, repetitions: 1, lapses: 0, status: 'learning' };
      const result = calculateNextSchedule(state, 'hard', fixedClock);
      // 1 * 1.2 = 1.2, Math.round(1.2) = 1, max(1, 1) = 1
      expect(result.scheduling.intervalDays).toBe(1);
    });

    it('hard on 2-day interval grows to 2 days (2*1.2=2.4→round→2)', () => {
      const state = { intervalDays: 2, repetitions: 2, lapses: 0, status: 'learning' };
      const result = calculateNextSchedule(state, 'hard', fixedClock);
      expect(result.scheduling.intervalDays).toBe(2);
    });

    it('hard starts growing meaningfully at 3-day intervals (3*1.2=3.6→4)', () => {
      const state = { intervalDays: 3, repetitions: 2, lapses: 0, status: 'learning' };
      const result = calculateNextSchedule(state, 'hard', fixedClock);
      expect(result.scheduling.intervalDays).toBe(4);
    });
  });
});

/**
 * Global constants for Anki Web application
 */
export const DB_CONFIG = {
  NAME: 'anki_web_db',
  VERSION: 1,
  STORES: {
    DECKS: 'decks',
    CARDS: 'cards',
    REVIEWS: 'reviews',
    IMAGES: 'images',
    SETTINGS: 'settings'
  }
};

export const SCHEDULER_CONFIG = {
  RATINGS: {
    AGAIN: 'again',
    HARD: 'hard',
    GOOD: 'good',
    EASY: 'easy'
  },
  STATUS: {
    NEW: 'new',
    LEARNING: 'learning'
  },
  // Intervals in days or multipliers
  INTERVALS: {
    AGAIN_DAYS: 0,
    HARD_FIRST_DAYS: 1,
    HARD_FACTOR: 1.2,
    GOOD_FIRST_DAYS: 1,
    GOOD_SECOND_DAYS: 3,
    GOOD_FACTOR: 2.0,
    EASY_FIRST_DAYS: 4,
    EASY_FACTOR: 2.5
  },
  AGAIN_LAPSE_RETRY_LIMIT: 3
};

export const IMAGE_CONFIG = {
  MAX_SIZE_BYTES: 5 * 1024 * 1024, // 5 MB
  ALLOWED_MIME_TYPES: [
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif'
  ]
};

export const BACKUP_CONFIG = {
  FORMAT_ID: 'anki-web-backup',
  VERSION: '1.0'
};

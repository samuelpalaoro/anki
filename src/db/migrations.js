import { DB_CONFIG } from '../config/constants.js';

/**
 * Executes database migrations sequentially based on oldVersion and newVersion
 * @param {IDBDatabase} db
 * @param {IDBVersionChangeEvent} event
 */
export function runMigrations(db, event) {
  const oldVersion = event.oldVersion;

  if (oldVersion < 1) {
    // Migration v1: Initial Schema
    const { STORES } = DB_CONFIG;

    // 1. Decks store
    if (!db.objectStoreNames.contains(STORES.DECKS)) {
      const deckStore = db.createObjectStore(STORES.DECKS, { keyPath: 'id' });
      deckStore.createIndex('name', 'name', { unique: false });
      deckStore.createIndex('updatedAt', 'updatedAt', { unique: false });
    }

    // 2. Cards store
    if (!db.objectStoreNames.contains(STORES.CARDS)) {
      const cardStore = db.createObjectStore(STORES.CARDS, { keyPath: 'id' });
      cardStore.createIndex('deckId', 'deckId', { unique: false });
      cardStore.createIndex('dueAt', 'scheduling.dueAt', { unique: false });
      cardStore.createIndex('updatedAt', 'updatedAt', { unique: false });
      cardStore.createIndex('status', 'scheduling.status', { unique: false });
    }

    // 3. Reviews store
    if (!db.objectStoreNames.contains(STORES.REVIEWS)) {
      const reviewStore = db.createObjectStore(STORES.REVIEWS, { keyPath: 'id' });
      reviewStore.createIndex('cardId', 'cardId', { unique: false });
      reviewStore.createIndex('reviewedAt', 'reviewedAt', { unique: false });
    }

    // 4. Images store
    if (!db.objectStoreNames.contains(STORES.IMAGES)) {
      const imageStore = db.createObjectStore(STORES.IMAGES, { keyPath: 'id' });
      imageStore.createIndex('createdAt', 'createdAt', { unique: false });
    }

    // 5. Settings store
    if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
      db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
    }
  }
}

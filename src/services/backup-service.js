import { deckRepository } from '../db/repositories/deck-repository.js';
import { cardRepository } from '../db/repositories/card-repository.js';
import { reviewRepository } from '../db/repositories/review-repository.js';
import { imageRepository } from '../db/repositories/image-repository.js';
import { settingsRepository } from '../db/repositories/settings-repository.js';
import { BACKUP_CONFIG, DB_CONFIG } from '../config/constants.js';
import { generateId } from '../utils/ids.js';
import { toISOString } from '../utils/dates.js';
import { withTransaction } from '../db/database.js';

/**
 * Converts a Blob to Base64 string
 * @param {Blob} blob
 * @returns {Promise<string>}
 */
export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result;
      resolve(base64String);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Converts Base64 data URL to Blob
 * @param {string} dataUrl
 * @returns {Blob}
 */
export function base64ToBlob(dataUrl) {
  const parts = dataUrl.split(',');
  const mimeMatch = parts[0].match(/:(.*?);/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
  const byteString = atob(parts[1]);
  const arrayBuffer = new ArrayBuffer(byteString.length);
  const uint8Array = new Uint8Array(arrayBuffer);

  for (let i = 0; i < byteString.length; i++) {
    uint8Array[i] = byteString.charCodeAt(i);
  }

  return new Blob([uint8Array], { type: mimeType });
}

export const backupService = {
  /**
   * Generates a complete serialized backup object
   * @param {Date|string|number} [clock=new Date()]
   * @returns {Promise<Object>}
   */
  async exportBackup(clock = new Date()) {
    const decks = await deckRepository.findAll();
    const cards = await cardRepository.findAll();
    const reviews = await reviewRepository.findAll();
    const settings = await settingsRepository.getAll();
    const imagesRaw = await imageRepository.findAll();

    const serializedImages = [];
    for (const img of imagesRaw) {
      const dataUrl = await blobToBase64(img.blob);
      serializedImages.push({
        id: img.id,
        name: img.name || '',
        mimeType: img.mimeType,
        sizeBytes: img.sizeBytes,
        createdAt: img.createdAt,
        dataUrl
      });
    }

    return {
      format: BACKUP_CONFIG.FORMAT_ID,
      version: BACKUP_CONFIG.VERSION,
      exportedAt: toISOString(clock),
      decks,
      cards,
      reviews,
      settings,
      images: serializedImages
    };
  },

  /**
   * Validates backup data structure and integrity before any import action
   * @param {any} data
   * @returns {{isValid: boolean, error?: string, summary?: Object}}
   */
  validateBackup(data) {
    if (!data || typeof data !== 'object') {
      return { isValid: false, error: 'Arquivo de backup inválido ou vazio.' };
    }

    if (data.format !== BACKUP_CONFIG.FORMAT_ID) {
      return { isValid: false, error: `Formato de backup inválido ou incompatível: "${data.format}".` };
    }

    if (data.version !== BACKUP_CONFIG.VERSION) {
      return { isValid: false, error: `Versão do backup incompatível: "${data.version}". Esperada: ${BACKUP_CONFIG.VERSION}.` };
    }

    if (!Array.isArray(data.decks)) {
      return { isValid: false, error: 'O backup não contém uma lista válida de baralhos.' };
    }

    if (!Array.isArray(data.cards)) {
      return { isValid: false, error: 'O backup não contém uma lista válida de cartões.' };
    }

    // Validate decks structure
    const deckIds = new Set();
    for (const d of data.decks) {
      if (!d.id || typeof d.name !== 'string' || !d.name.trim()) {
        return { isValid: false, error: 'Um ou mais baralhos contêm estrutura ou nome inválido.' };
      }
      deckIds.add(d.id);
    }

    // Validate cards structure and deck reference
    for (const c of data.cards) {
      if (!c.id || !c.deckId || !c.front || !c.back) {
        return { isValid: false, error: 'Um ou mais cartões possuem campos obrigatórios ausentes.' };
      }
      if (!deckIds.has(c.deckId)) {
        return {
          isValid: false,
          error: `Cartão "${c.id}" referencia um baralho inexistente ("${c.deckId}").`
        };
      }
    }

    const reviews = Array.isArray(data.reviews) ? data.reviews : [];
    const images = Array.isArray(data.images) ? data.images : [];

    return {
      isValid: true,
      summary: {
        decksCount: data.decks.length,
        cardsCount: data.cards.length,
        reviewsCount: reviews.length,
        imagesCount: images.length,
        exportedAt: data.exportedAt
      }
    };
  },

  /**
   * Imports backup data using either 'merge' or 'replace' strategy
   *
   * @param {Object} data
   * @param {'merge'|'replace'} strategy
   * @returns {Promise<Object>} Summary of imported entities
   */
  async importBackup(data, strategy = 'merge') {
    const validation = this.validateBackup(data);
    if (!validation.isValid) {
      throw new Error(validation.error);
    }

    const { STORES } = DB_CONFIG;

    if (strategy === 'replace') {
      // Clear all existing stores and insert backup directly
      await withTransaction(
        [STORES.DECKS, STORES.CARDS, STORES.REVIEWS, STORES.IMAGES, STORES.SETTINGS],
        'readwrite',
        async (stores) => {
          stores[STORES.DECKS].clear();
          stores[STORES.CARDS].clear();
          stores[STORES.REVIEWS].clear();
          stores[STORES.IMAGES].clear();
          stores[STORES.SETTINGS].clear();

          // Restore Decks
          for (const d of data.decks) {
            stores[STORES.DECKS].put(d);
          }
          // Restore Cards
          for (const c of data.cards) {
            stores[STORES.CARDS].put(c);
          }
          // Restore Reviews
          for (const r of data.reviews || []) {
            stores[STORES.REVIEWS].put(r);
          }
          // Restore Settings
          if (data.settings && typeof data.settings === 'object') {
            for (const [key, value] of Object.entries(data.settings)) {
              stores[STORES.SETTINGS].put({ key, value });
            }
          }
          // Restore Images
          for (const img of data.images || []) {
            const blob = base64ToBlob(img.dataUrl);
            stores[STORES.IMAGES].put({
              id: img.id,
              name: img.name,
              mimeType: img.mimeType,
              sizeBytes: img.sizeBytes,
              createdAt: img.createdAt,
              blob
            });
          }
        }
      );

      return validation.summary;
    }

    // Strategy === 'merge'
    // In merge mode, prevent duplicate ID collision by remapping IDs and keeping existing records intact
    const existingDecks = await deckRepository.findAll();
    const existingCards = await cardRepository.findAll();

    const existingDeckNamesMap = new Map();
    for (const d of existingDecks) {
      existingDeckNamesMap.set(d.name.trim().toLowerCase(), d.id);
    }

    const existingDeckIds = new Set(existingDecks.map((d) => d.id));
    const existingCardIds = new Set(existingCards.map((c) => c.id));

    const deckIdRemap = new Map();
    const cardIdRemap = new Map();
    const imageIdRemap = new Map();

    const decksToInsert = [];

    for (const deck of data.decks) {
      const normalizedName = deck.name.trim().toLowerCase();
      // If a deck with same name exists, map cards to existing deck!
      if (existingDeckNamesMap.has(normalizedName)) {
        deckIdRemap.set(deck.id, existingDeckNamesMap.get(normalizedName));
      } else {
        let newDeckId = deck.id;
        if (existingDeckIds.has(deck.id)) {
          newDeckId = generateId();
        }
        deckIdRemap.set(deck.id, newDeckId);
        decksToInsert.push({
          ...deck,
          id: newDeckId
        });
      }
    }

    // Remap Images
    const imagesToInsert = [];
    for (const img of data.images || []) {
      const newImgId = generateId();
      imageIdRemap.set(img.id, newImgId);
      const blob = base64ToBlob(img.dataUrl);
      imagesToInsert.push({
        id: newImgId,
        name: img.name,
        mimeType: img.mimeType,
        sizeBytes: img.sizeBytes,
        createdAt: img.createdAt,
        blob
      });
    }

    // Remap Cards
    const cardsToInsert = [];
    for (const card of data.cards) {
      let newCardId = card.id;
      if (existingCardIds.has(card.id)) {
        newCardId = generateId();
      }
      cardIdRemap.set(card.id, newCardId);

      const targetDeckId = deckIdRemap.get(card.deckId) || card.deckId;
      const remappedImageIds = (card.imageIds || []).map((imgId) => imageIdRemap.get(imgId) || imgId);

      cardsToInsert.push({
        ...card,
        id: newCardId,
        deckId: targetDeckId,
        imageIds: remappedImageIds
      });
    }

    // Remap Reviews
    const reviewsToInsert = [];
    for (const r of data.reviews || []) {
      const targetCardId = cardIdRemap.get(r.cardId);
      if (targetCardId) {
        reviewsToInsert.push({
          ...r,
          id: generateId(),
          cardId: targetCardId
        });
      }
    }

    // Atomic transaction for merge
    await withTransaction(
      [STORES.DECKS, STORES.CARDS, STORES.REVIEWS, STORES.IMAGES],
      'readwrite',
      async (stores) => {
        for (const d of decksToInsert) {
          stores[STORES.DECKS].put(d);
        }
        for (const c of cardsToInsert) {
          stores[STORES.CARDS].put(c);
        }
        for (const r of reviewsToInsert) {
          stores[STORES.REVIEWS].put(r);
        }
        for (const img of imagesToInsert) {
          stores[STORES.IMAGES].put(img);
        }
      }
    );

    return {
      decksAdded: decksToInsert.length,
      cardsAdded: cardsToInsert.length,
      reviewsAdded: reviewsToInsert.length,
      imagesAdded: imagesToInsert.length
    };
  }
};

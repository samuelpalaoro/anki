import { IMAGE_CONFIG } from '../config/constants.js';

/**
 * Normalizes text by trimming whitespace
 * @param {string} str
 * @returns {string}
 */
export function normalizeString(str) {
  if (typeof str !== 'string') return '';
  return str.trim();
}

/**
 * Normalizes a list of tags (lowercase, trimmed, deduplicated, non-empty)
 * @param {string[]|string} tags
 * @returns {string[]}
 */
export function normalizeTags(tags) {
  if (!tags) return [];
  const list = Array.isArray(tags) ? tags : String(tags).split(',');
  const normalizedSet = new Set();

  for (const item of list) {
    if (typeof item === 'string') {
      const clean = item.trim().toLowerCase().replace(/^#+/, '');
      if (clean.length > 0) {
        normalizedSet.add(clean);
      }
    }
  }
  return Array.from(normalizedSet).sort();
}

/**
 * Validates a deck entity data
 * @param {Object} deckData
 * @param {string} [deckData.name]
 * @returns {{isValid: boolean, error?: string, sanitizedName?: string}}
 */
export function validateDeckData(deckData) {
  if (!deckData || typeof deckData !== 'object') {
    return { isValid: false, error: 'Dados do baralho não fornecidos.' };
  }
  const name = normalizeString(deckData.name);
  if (!name) {
    return { isValid: false, error: 'O nome do baralho é obrigatório e não pode ser vazio.' };
  }
  return { isValid: true, sanitizedName: name };
}

/**
 * Validates card entity data
 * @param {Object} cardData
 * @returns {{isValid: boolean, error?: string, sanitized?: Object}}
 */
export function validateCardData(cardData) {
  if (!cardData || typeof cardData !== 'object') {
    return { isValid: false, error: 'Dados do cartão não fornecidos.' };
  }

  const deckId = normalizeString(cardData.deckId);
  if (!deckId) {
    return { isValid: false, error: 'O baralho do cartão é obrigatório.' };
  }

  const front = normalizeString(cardData.front);
  if (!front) {
    return { isValid: false, error: 'A pergunta (frente) do cartão é obrigatória.' };
  }

  const back = normalizeString(cardData.back);
  if (!back) {
    return { isValid: false, error: 'A resposta (verso) do cartão é obrigatória.' };
  }

  const contentFormat = cardData.contentFormat === 'markdown' ? 'markdown' : 'plain';
  const tags = normalizeTags(cardData.tags);
  const imageIds = Array.isArray(cardData.imageIds) ? cardData.imageIds.filter(Boolean) : [];

  return {
    isValid: true,
    sanitized: {
      deckId,
      front,
      back,
      contentFormat,
      tags,
      imageIds
    }
  };
}

/**
 * Validates an image file or blob
 * @param {Blob|File} blob
 * @returns {{isValid: boolean, error?: string}}
 */
export function validateImageBlob(blob) {
  if (!blob || !(blob instanceof Blob)) {
    return { isValid: false, error: 'Arquivo de imagem inválido.' };
  }

  if (blob.size > IMAGE_CONFIG.MAX_SIZE_BYTES) {
    const maxMb = IMAGE_CONFIG.MAX_SIZE_BYTES / (1024 * 1024);
    return { isValid: false, error: `A imagem excede o tamanho máximo permitido de ${maxMb}MB.` };
  }

  if (!IMAGE_CONFIG.ALLOWED_MIME_TYPES.includes(blob.type)) {
    return {
      isValid: false,
      error: `Formato de imagem "${blob.type}" não suportado. Utilize PNG, JPEG, WebP ou GIF.`
    };
  }

  return { isValid: true };
}

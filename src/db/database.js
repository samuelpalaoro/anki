import { DB_CONFIG } from '../config/constants.js';
import { runMigrations } from './migrations.js';

let dbInstance = null;
let dbPromise = null;

/**
 * Opens and initializes the IndexedDB database connection with proper event listeners
 * @returns {Promise<IDBDatabase>}
 */
export async function getDatabase() {
  if (dbInstance) {
    return dbInstance;
  }
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB não está disponível neste navegador/ambiente.'));
    }

    const request = indexedDB.open(DB_CONFIG.NAME, DB_CONFIG.VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      runMigrations(db, event);
    };

    request.onsuccess = () => {
      const db = request.result;
      dbInstance = db;

      db.onversionchange = () => {
        db.close();
        dbInstance = null;
        dbPromise = null;
        console.warn('Banco de dados fechado devido a alteração de versão em outra aba.');
      };

      db.onerror = (event) => {
        console.error('Erro geral no IndexedDB:', event.target.error);
      };

      resolve(db);
    };

    request.onerror = () => {
      dbPromise = null;
      const error = request.error;
      if (error && error.name === 'QuotaExceededError') {
        reject(new Error('Espaço de armazenamento esgotado no navegador.'));
      } else {
        reject(new Error(`Falha ao abrir o banco de dados: ${error?.message || 'Erro desconhecido'}`));
      }
    };

    request.onblocked = () => {
      console.warn('Abertura do banco bloqueada: feche outras abas abertas deste aplicativo.');
    };
  });

  return dbPromise;
}

/**
 * Closes the active database connection if open
 */
export function closeDatabase() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
  dbPromise = null;
}

/**
 * Promisified helper to execute a transaction
 * @param {string[]} storeNames
 * @param {'readonly'|'readwrite'} mode
 * @param {(stores: Object.<string, IDBObjectStore>, transaction: IDBTransaction) => Promise<any>} callback
 * @returns {Promise<any>}
 */
export async function withTransaction(storeNames, mode, callback) {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    let callbackResult;
    const tx = db.transaction(storeNames, mode);

    tx.onabort = () => {
      const err = tx.error || new Error('Transação abortada.');
      reject(err);
    };

    tx.onerror = () => {
      const err = tx.error || new Error('Erro na transação.');
      reject(err);
    };

    tx.oncomplete = () => {
      resolve(callbackResult);
    };

    const storesMap = {};
    for (const name of storeNames) {
      storesMap[name] = tx.objectStore(name);
    }

    try {
      const res = callback(storesMap, tx);
      if (res && typeof res.then === 'function') {
        res.then((r) => {
          callbackResult = r;
        }).catch((err) => {
          try { tx.abort(); } catch (_) {}
          reject(err);
        });
      } else {
        callbackResult = res;
      }
    } catch (err) {
      try { tx.abort(); } catch (_) {}
      reject(err);
    }
  });
}

/**
 * Helper to wrap IDBRequest in a clean Promise
 * @param {IDBRequest} request
 * @returns {Promise<any>}
 */
export function wrapRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Falha na requisição IndexedDB'));
  });
}

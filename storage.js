// Module de stockage utilisant IndexedDB natif (pour le cache côté client)

// Ouvrir la base de données IndexedDB
let dbPromise = null;

function openDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open('ff14msq-cache', 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('cache')) {
          db.createObjectStore('cache');
        }
      };
    });
  }
  return dbPromise;
}

// ---------- Gestion des quêtes ----------
export async function getCachedQuests() {
  const db = await openDB();
  const transaction = db.transaction(['cache'], 'readonly');
  const store = transaction.objectStore('cache');
  const request = store.get('quests');

  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function setCachedQuests(quests) {
  const db = await openDB();
  const transaction = db.transaction(['cache'], 'readwrite');
  const store = transaction.objectStore('cache');
  const request = store.put(quests, 'quests');

  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function clearQuestsCache() {
  const db = await openDB();
  const transaction = db.transaction(['cache'], 'readwrite');
  const store = transaction.objectStore('cache');
  const request = store.delete('quests');

  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// ---------- Gestion des résumés ----------
function getSummaryKey(questId, settings) {
  // Créer une clé unique basée sur l'ID quête et les paramètres
  const hash = btoa(JSON.stringify({
    model: settings.model,
    fr: settings.fr,
    short: settings.short
  })).replace(/[^a-zA-Z0-9]/g, '');
  return `summary:${questId}:${hash}`;
}

export async function getCachedSummary(questId, settings) {
  const db = await openDB();
  const transaction = db.transaction(['cache'], 'readonly');
  const store = transaction.objectStore('cache');
  const key = getSummaryKey(questId, settings);
  const request = store.get(key);

  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function setCachedSummary(questId, settings, summary) {
  const db = await openDB();
  const transaction = db.transaction(['cache'], 'readwrite');
  const store = transaction.objectStore('cache');
  const key = getSummaryKey(questId, settings);
  const request = store.put(summary, key);

  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function clearAllSummaries() {
  const db = await openDB();
  const transaction = db.transaction(['cache'], 'readwrite');
  const store = transaction.objectStore('cache');

  // Récupérer toutes les clés commençant par 'summary:'
  const request = store.openCursor();

  return new Promise((resolve, reject) => {
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        if (cursor.key.startsWith('summary:')) {
          cursor.delete();
        }
        cursor.continue();
      } else {
        resolve();
      }
    };
    request.onerror = () => reject(request.error);
  });
}

// ---------- Utilitaires ----------
export async function clearAllCache() {
  await clearQuestsCache();
  await clearAllSummaries();
}

export async function getCacheStats() {
  const db = await openDB();
  const transaction = db.transaction(['cache'], 'readonly');
  const store = transaction.objectStore('cache');
  const request = store.openCursor();

  let questCount = 0;
  let summaryCount = 0;

  return new Promise((resolve, reject) => {
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if (cursor) {
        if (cursor.key === 'quests') questCount = 1;
        else if (cursor.key.startsWith('summary:')) summaryCount++;
        cursor.continue();
      } else {
        resolve({ questCount, summaryCount });
      }
    };
    request.onerror = () => reject(request.error);
  });
}
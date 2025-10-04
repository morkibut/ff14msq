// Module API pour gérer les appels au serveur local

const SERVER_BASE = 'http://localhost:3000/api';
const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';

// ---------- Fonctions utilitaires (maintenant gérées côté serveur) ----------

export async function loadAllQuests(onProgress, onLog, forceReload = false) {
  try {
    onLog('Chargement des quêtes depuis le serveur local…');

    const url = forceReload ? `${SERVER_BASE}/quests/refresh` : `${SERVER_BASE}/quests`;
    const method = forceReload ? 'POST' : 'GET';

    const response = await fetch(url, { method });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const quests = await response.json();
    onLog(`Quêtes chargées depuis le serveur (${quests.length} entrées)`);
    onProgress(100, `Serveur chargé (${quests.length} quêtes)`);

    return quests;
  } catch (e) {
    throw new Error('Erreur de chargement: ' + e.message);
  }
}

// ---------- Récupération des modèles OpenRouter ----------
export async function fetchOpenRouterModels(apiKey) {
  const res = await fetch(`${OPENROUTER_BASE}/models`, {
    headers: { 'Authorization': 'Bearer ' + apiKey }
  });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const data = await res.json();
  return data.data || [];
}

export function filterFreeModels(models) {
  // Filtrer les modèles gratuits : ceux dont l'id contient ":free"
  return models.filter(model => model.id && model.id.includes(':free'));
}

// ---------- Génération de résumé via serveur local ----------
export async function generateSummary(settings, questName, questId, textChunks, onChunk) {
  console.log('[DEBUG] generateSummary: Envoi au serveur pour quête', questName, 'ID', questId);
  console.log('[DEBUG] generateSummary: Key present in settings:', !!settings.key);

  const response = await fetch(`${SERVER_BASE}/summaries/${questId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: settings.model,
      fr: settings.fr,
      short: settings.short,
      questName,
      textChunks,
      key: settings.key
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Erreur serveur: ${error}`);
  }

  const data = await response.json();

  // Simuler le streaming en envoyant le résultat complet
  if (onChunk) {
    // Diviser en chunks pour simuler le streaming
    const words = data.summary.split(' ');
    let currentChunk = '';
    for (const word of words) {
      currentChunk += word + ' ';
      if (currentChunk.length > 50) { // Envoyer par blocs de ~50 caractères
        onChunk(currentChunk);
        await new Promise(resolve => setTimeout(resolve, 10)); // Petit délai pour l'effet
        currentChunk = '';
      }
    }
    if (currentChunk) onChunk(currentChunk);
  }

  console.log('[DEBUG] generateSummary: Résumé reçu du serveur');
  return data.summary;
}

// ---------- Détail d'une quête ----------
export async function fetchQuestDetail(questId) {
  const url = `${SERVER_BASE}/quests/${questId}`;
  console.log('GET ' + url);
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

// ---------- Extraction de texte ----------
export function extractTextChunks(detail) {
  const chunks = [];
  const TD = detail?.TextData || {};
  for (const key of ['Dialogue', 'Journal', 'System', 'QA_Question', 'QA_Answer', 'ToDo']) {
    const arr = TD[key];
    if (Array.isArray(arr)) {
      for (const s of arr) {
        const val = (typeof s === 'string') ? s : (s?.Text || s?.line || '');
        if (val) chunks.push(val);
      }
    }
  }
  if (detail?.Name_fr || detail?.Name_en || detail?.Name) chunks.push('Titre: ' + (detail.Name_fr || detail.Name_en || detail.Name));
  if (detail?.Introduction) chunks.push('Intro: ' + detail.Introduction);
  return chunks;
}

// ---------- Métadonnées des filtres ----------
export async function fetchFilterMetadata() {
  const url = `${SERVER_BASE}/filters`;
  console.log('GET ' + url);
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

// ---------- Filtrage côté serveur ----------
export async function filterQuests(filters, searchTerm, limit = 50, offset = 0) {
  const url = `${SERVER_BASE}/quests/filter`;
  console.log('POST ' + url);

  const body = {
    filters,
    searchTerm,
    limit,
    offset
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}
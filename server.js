// Serveur Express.js avec stockage LevelDB pour FF14 MSQ

import express from 'express';
import { Level } from 'level';
import path from 'path';
import { fileURLToPath } from 'url';

// Configuration
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3000;
const DEFAULT_OPENROUTER_KEY = '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';

// Ouvrir la base de données LevelDB
const db = new Level('./ff14msq-db', { valueEncoding: 'json' });

// Initialiser Express
const app = express();
app.use(express.json());

// Middleware pour logger les requêtes
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// ---------- Routes API ----------

// GET /api/quests/:id - Récupérer le détail d'une quête spécifique
app.get('/api/quests/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const quest = await getQuestDetail(id);
    if (!quest) {
      return res.status(404).json({ error: 'Quête non trouvée' });
    }
    res.json(quest);
  } catch (error) {
    console.error('Erreur GET /api/quests/:id:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/quests - Récupérer toutes les quêtes
app.get('/api/quests', async (req, res) => {
  try {
    const quests = await getCachedQuests();
    if (quests) {
      console.log(`Quêtes servies depuis cache LevelDB (${quests.length} entrées)`);
      return res.json(quests);
    }

    // Si pas en cache, récupérer depuis l'API externe
    console.log('Quêtes non trouvées en cache, récupération depuis API externe...');
    const freshQuests = await loadQuestsFromAPI();
    await setCachedQuests(freshQuests);
    console.log(`Quêtes chargées depuis API et stockées (${freshQuests.length} entrées)`);
    res.json(freshQuests);
  } catch (error) {
    console.error('Erreur GET /api/quests:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/quests/refresh - Forcer le rechargement des quêtes
app.post('/api/quests/refresh', async (req, res) => {
  try {
    console.log('Forçage du rechargement des quêtes...');
    await clearQuestsCache();
    const freshQuests = await loadQuestsFromAPI();
    await setCachedQuests(freshQuests);
    console.log(`Quêtes rechargées et stockées (${freshQuests.length} entrées)`);
    res.json({ message: 'Quêtes rechargées', count: freshQuests.length });
  } catch (error) {
    console.error('Erreur POST /api/quests/refresh:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/summaries/:questId - Récupérer un résumé
app.get('/api/summaries/:questId', async (req, res) => {
  try {
    const { questId } = req.params;
    const { model, fr, short } = req.query;

    const settings = {
      model: model || 'meta-llama/llama-3.1-8b-instruct:free',
      fr: fr === 'true',
      short: short === 'true'
    };

    const summary = await getCachedSummary(questId, settings);
    if (summary) {
      console.log(`Résumé servi depuis cache pour quête ${questId}`);
      return res.json({ summary, cached: true });
    }

    res.status(404).json({ error: 'Résumé non trouvé en cache' });
  } catch (error) {
    console.error('Erreur GET /api/summaries:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/summaries/:questId - Créer/générer un résumé
app.post('/api/summaries/:questId', async (req, res) => {
  try {
    const { questId } = req.params;
    const { model, fr, short, questName, textChunks, key } = req.body;

    const settings = {
      model: model || 'deepseek/deepseek-chat-v3.1:free',
      fr: fr || false,
      short: short || false,
      key: key || DEFAULT_OPENROUTER_KEY
    };
    console.log('[DEBUG] Server received settings:', { keyPresent: !!settings.key, model: settings.model, fr: settings.fr, short: settings.short });

    // Vérifier d'abord le cache
    const cached = await getCachedSummary(questId, settings);
    if (cached) {
      console.log(`Résumé déjà en cache pour quête ${questId}`);
      return res.json({ summary: cached, cached: true });
    }

    // Générer le résumé
    console.log(`Génération du résumé pour quête ${questId}...`);
    const summary = await generateSummary(settings, questName, questId, textChunks);

    // Stocker en cache
    await setCachedSummary(questId, settings, summary);
    console.log(`Résumé généré et stocké pour quête ${questId}`);

    res.json({ summary, cached: false });
  } catch (error) {
    console.error('Erreur POST /api/summaries:', error);
    res.status(500).json({ error: error.message });
  }
});

// ---------- Fonctions utilitaires LevelDB ----------

async function getCachedQuests() {
  try {
    return await db.get('quests');
  } catch (error) {
    if (error.notFound) return null;
    throw error;
  }
}

async function setCachedQuests(quests) {
  await db.put('quests', quests);
}

async function clearQuestsCache() {
  try {
    await db.del('quests');
  } catch (error) {
    if (!error.notFound) throw error;
  }
}

function getSummaryKey(questId, settings) {
  const hash = btoa(JSON.stringify({
    model: settings.model,
    fr: settings.fr,
    short: settings.short
  })).replace(/[^a-zA-Z0-9]/g, '');
  return `summary:${questId}:${hash}`;
}

async function getCachedSummary(questId, settings) {
  try {
    const key = getSummaryKey(questId, settings);
    return await db.get(key);
  } catch (error) {
    if (error.notFound) return null;
    throw error;
  }
}

async function setCachedSummary(questId, settings, summary) {
  const key = getSummaryKey(questId, settings);
  await db.put(key, summary);
}

// ---------- Fonctions API externes (migrées depuis api.js) ----------

const API_BASE = 'https://cafemaker.wakingsands.com';
const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';
const COLUMNS = encodeURIComponent('ID,Name,Name_en,Name_fr,JournalGenre.Name_en,ClassJobLevel0');

async function fetchQuestPage(page) {
  const url = `${API_BASE}/Quest?page=${page}&limit=3000&columns=${COLUMNS}&language=fr`;
  console.log('GET ' + url);
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

async function loadQuestsFromAPI() {
  const first = await fetchQuestPage(1);
  const totalPages = first.Pagination?.PageTotal || 1;
  let allQuests = [...(first.Results || [])];

  for (let p = 2; p <= totalPages; p++) {
    const data = await fetchQuestPage(p);
    allQuests.push(...(data.Results || []));
  }

  return allQuests;
}

async function getQuestDetail(questId) {
  // D'abord vérifier dans le cache des quêtes
  const quests = await getCachedQuests();
  if (quests) {
    const quest = quests.find(q => q.ID == questId);
    if (quest) return quest;
  }

  // Sinon récupérer depuis l'API externe
  const API_BASE = 'https://cafemaker.wakingsands.com';
  const url = `${API_BASE}/Quest/${questId}?language=fr`;
  console.log('Récupération détail quête depuis API:', questId);

  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

async function generateSummary(settings, questName, questId, textChunks) {
  if (!settings.key) throw new Error('Clé OpenRouter manquante.');

  const langLine = settings.fr ? 'Rédige en FRANÇAIS.' : 'Write in ENGLISH.';
  const lenLine = settings.short ? 'Longueur: 2 à 3 phrases, max 70 mots.' : 'Longueur: 3 à 5 phrases, max 120 mots.';
  const src = textChunks.filter(Boolean).join('\n').slice(0, 6000);

  const messages = [
    { role: 'system', content: "Tu es un assistant qui résume strictement le récit et les dialogues d'une quête FFXIV sans spoiler au-delà de cette quête." },
    { role: 'user', content: `${langLine}\n${lenLine}\nStyle: clair, narratif, sans bullet points. Pas de mécaniques de gameplay. Pas de spoiler futur.\n\nTitre de la quête: ${questName} (ID ${questId}).\nExtraits fournis (dialogues/journal):\n---\n${src}\n---\nRédige un résumé fidèle et concis.` }
  ];

  console.log('[DEBUG] OpenRouter request with model:', settings.model, 'key present:', !!settings.key);

  const body = {
    model: settings.model,
    messages,
    temperature: 0.4,
    max_tokens: settings.short ? 160 : 300,
    stream: false
  };

  const resp = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + settings.key,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'http://localhost:3000',
      'X-Title': 'FFXIV MSQ Summarizer (Server)'
    },
    body: JSON.stringify(body)
  });

  if (!resp.ok) {
    const errorText = await resp.text();
    throw new Error(`HTTP ${resp.status}: ${errorText}`);
  }

  const data = await resp.json();
  const result = data.choices?.[0]?.message?.content?.trim();

  if (!result) {
    throw new Error('Aucune réponse générée par l\'IA.');
  }

  return result;
}

// ---------- Service des fichiers statiques ----------

app.use(express.static(path.join(__dirname)));

// Route catch-all pour SPA
app.use((req, res, next) => {
  // Servir index.html pour toutes les routes non-API
  if (!req.path.startsWith('/api/')) {
    res.sendFile(path.join(__dirname, 'index.html'));
  } else {
    next();
  }
});

// ---------- Démarrage du serveur ----------

app.listen(PORT, () => {
  console.log(`🚀 Serveur FF14 MSQ démarré sur http://localhost:${PORT}`);
  console.log(`📁 Base de données LevelDB: ${path.resolve('./ff14msq-db')}`);
});

export default app;
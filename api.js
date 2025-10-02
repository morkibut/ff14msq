// Module API pour gérer les appels externes

const API_BASE = 'https://cafemaker.wakingsands.com';
const OPENROUTER_BASE = 'https://openrouter.ai/api/v1';
const COLUMNS = encodeURIComponent('ID,Name,Name_en,Name_fr,JournalGenre.Name_en,ClassJobLevel0');

// ---------- Chargement des quêtes ----------
export async function fetchQuestPage(page) {
  const url = `${API_BASE}/Quest?page=${page}&limit=3000&columns=${COLUMNS}&language=fr`;
  console.log('GET ' + url);
  const res = await fetch(url);
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

export async function loadAllQuests(onProgress, onLog) {
  try {
    onLog('Chargement des quêtes (colonnes + FR)…');
    const first = await fetchQuestPage(1);
    const totalPages = first.Pagination?.PageTotal || 1;
    let loadedPages = 1;
    let allQuests = [...(first.Results || [])];
    onProgress(loadedPages / totalPages * 100, `Page ${loadedPages}/${totalPages} reçue (${first.Results?.length || 0} entrées)`);
    for (let p = 2; p <= totalPages; p++) {
      const data = await fetchQuestPage(p);
      allQuests.push(...(data.Results || []));
      loadedPages = p;
      onProgress(loadedPages / totalPages * 100, `Page ${loadedPages}/${totalPages} reçue (${data.Results?.length || 0} entrées)`);
    }
    onLog(`Total quêtes reçues: ${allQuests.length}`);
    if (allQuests[0]) onLog('Exemple brut: ' + JSON.stringify(allQuests[0]).slice(0, 300) + '…');
    return allQuests;
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

// ---------- Génération de résumé avec OpenRouter ----------
export async function generateSummary(settings, questName, questId, textChunks, onChunk) {
  console.log('[DEBUG] generateSummary: Début pour quête', questName, 'ID', questId);
  if (!settings.key) throw new Error('Clé OpenRouter manquante.');
  const langLine = settings.fr ? 'Rédige en FRANÇAIS.' : 'Write in ENGLISH.';
  const lenLine = settings.short ? 'Longueur: 2 à 3 phrases, max 70 mots.' : 'Longueur: 3 à 5 phrases, max 120 mots.';
  const src = textChunks.filter(Boolean).join('\n').slice(0, 6000);
  const messages = [
    { role: 'system', content: 'Tu es un assistant qui résume strictement le récit et les dialogues d’une quête FFXIV sans spoiler au‑delà de cette quête.' },
    { role: 'user', content: `${langLine}\n${lenLine}\nStyle: clair, narratif, sans bullet points. Pas de mécaniques de gameplay. Pas de spoiler futur.\n\nTitre de la quête: ${questName} (ID ${questId}).\nExtraits fournis (dialogues/journal):\n---\n${src}\n---\nRédige un résumé fidèle et concis.` }
  ];
  const body = { model: settings.model, messages, temperature: 0.4, max_tokens: settings.short ? 160 : 300, stream: true };
  console.log('[DEBUG] generateSummary: Envoi requête à OpenRouter, modèle:', settings.model);
  const resp = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + settings.key,
      'Content-Type': 'application/json',
      'HTTP-Referer': location.origin,
      'X-Title': 'FFXIV MSQ Summarizer (Local)'
    },
    body: JSON.stringify(body)
  });
  console.log('[DEBUG] generateSummary: Réponse reçue, status:', resp.status);
  if (!resp.ok) {
    const errorText = await resp.text();
    console.log('[DEBUG] generateSummary: Erreur HTTP, corps:', errorText);
    throw new Error(`HTTP ${resp.status}: ${errorText}`);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let fullText = '';
  let buffer = '';
  let chunkCount = 0;

  console.log('[DEBUG] generateSummary: Début lecture stream');
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      console.log('[DEBUG] generateSummary: Stream terminé, fullText length:', fullText.length);
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const data = line.slice(6);
        if (data === '[DONE]') {
          console.log('[DEBUG] generateSummary: [DONE] reçu, fin stream');
          return fullText.trim();
        }
        try {
          const json = JSON.parse(data);
          const content = json.choices?.[0]?.delta?.content || '';
          if (content) {
            chunkCount++;
            fullText += content;
            console.log(`[DEBUG] generateSummary: Chunk ${chunkCount} reçu, content: "${content}"`);
            if (onChunk) onChunk(content);
          }
        } catch (e) {
          console.log('[DEBUG] generateSummary: Erreur parsing JSON pour data:', data, 'Erreur:', e.message);
          // Ignore parse errors
        }
      }
    }
  }
  const result = fullText.trim();
  console.log('[DEBUG] generateSummary: Fin fonction, fullText length:', result.length);
  if (!result) {
    throw new Error('Aucune réponse générée par l\'IA. Le modèle peut être indisponible ou le prompt rejeté. Essayez un autre modèle.');
  }
  return result;
}

// ---------- Détail d'une quête ----------
export async function fetchQuestDetail(questId) {
  const url = `${API_BASE}/Quest/${questId}?language=fr`;
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
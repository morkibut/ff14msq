/*  */// Module UI pour gérer l'interface utilisateur

import { getCachedSummary, setCachedSummary } from './storage.js';

// ---------- Sélecteurs ----------
const input = document.getElementById('searchInput');
const resultsDiv = document.getElementById('results');
const logsDiv = document.getElementById('logsDiv');
const statusEl = document.getElementById('status');
const bar = document.getElementById('bar');
const onlyMsq = document.getElementById('onlyMsq');
const btnSettings = document.getElementById('btnSettings');
const btnTest = document.getElementById('btnTest');
const btnRefreshModels = document.getElementById('btnRefreshModels');
const btnReloadCache = document.getElementById('btnReloadCache');
const dlg = document.getElementById('settingsDialog');
const orModelSelect = document.getElementById('orModel');
const summaryDialog = document.getElementById('summaryDialog');
const summaryPrompt = document.getElementById('summaryPrompt');
const summaryResponse = document.getElementById('summaryResponse');
const closeSummaryDialog = document.getElementById('closeSummaryDialog');
const togglePrompt = document.getElementById('togglePrompt');
const globalLoader = document.getElementById('globalLoader');

// ---------- Onglets ----------
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');

export function initTabs() {
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabId = button.getAttribute('data-tab');
      showTab(tabId);
    });
  });
  showTab('search'); // Onglet par défaut
}

function showTab(tabId) {
  tabContents.forEach(content => {
    content.classList.remove('active');
  });
  tabButtons.forEach(button => {
    button.classList.remove('active');
  });
  document.getElementById(tabId).classList.add('active');
  document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
}

// ---------- Logs ----------
export function log(msg) {
  const time = new Date().toLocaleTimeString();
  logsDiv.innerHTML += `[${time}] ${msg}\n`;
  logsDiv.scrollTop = logsDiv.scrollHeight;
  console.log(msg);
}

// ---------- Progress ----------
export function setProgress(p, label) {
  bar.style.width = `${Math.max(0, Math.min(100, p))}%`;
  if (label) statusEl.textContent = label;
}

// ---------- Paramètres ----------
const DEFAULT_API_KEY = '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';

export function getSettings() {
  return {
    key: localStorage.getItem('orKey') || DEFAULT_API_KEY,
    model: localStorage.getItem('orModel') || 'deepseek/deepseek-chat-v3.1:free',
    fr: localStorage.getItem('sumFR') !== '0',
    short: localStorage.getItem('sumShort') !== '0',
  };
}

export function saveSettings(s) {
  localStorage.setItem('orKey', s.key || '');
  localStorage.setItem('orModel', s.model || '');
  localStorage.setItem('sumFR', s.fr ? '1' : '0');
  localStorage.setItem('sumShort', s.short ? '1' : '0');
}

export function restoreSettingsUI() {
  const s = getSettings();
  document.getElementById('orKey').value = s.key;
  document.getElementById('orModel').value = s.model;
  document.getElementById('sumFR').checked = !!s.fr;
  document.getElementById('sumShort').checked = !!s.short;
}

export function updateModelSelect(models) {
  orModelSelect.innerHTML = '';
  models.forEach(model => {
    const option = document.createElement('option');
    option.value = model.id;
    option.textContent = model.name || model.id;
    orModelSelect.appendChild(option);
  });
  // Restaurer la sélection
  const s = getSettings();
  orModelSelect.value = s.model;
}

export async function refreshModels() {
  const s = getSettings();
  if (!s.key) {
    alert('Renseigne ta clé OpenRouter dans Paramètres.');
    return;
  }
  try {
    btnRefreshModels.disabled = true;
    btnRefreshModels.textContent = 'Chargement…';
    log('Actualisation des modèles OpenRouter…');
    const models = await fetchOpenRouterModels(s.key);
    const freeModels = filterFreeModels(models);
    updateModelSelect(freeModels);
    log(`Modèles gratuits actualisés: ${freeModels.length}`);
    alert(`Modèles actualisés ! ${freeModels.length} modèles gratuits disponibles.`);
  } catch (e) {
    log('Erreur actualisation modèles: ' + e.message);
    // Fallback aux modèles statiques
    updateModelSelect([
      { id: 'meta-llama/llama-3.1-8b-instruct:free', name: 'Llama 3.1 8B Instruct (gratuit)' },
      { id: 'google/gemma-2-9b-it:free', name: 'Gemma 2 9B IT (gratuit)' },
      { id: 'mistralai/mixtral-8x7b-instruct:free', name: 'Mixtral 8x7B Instruct (gratuit)' },
      { id: 'qwen/qwen2.5-7b-instruct:free', name: 'Qwen2.5 7B Instruct (gratuit)' },
      { id: 'deepseek/deepseek-chat-v3.1:free', name: 'DeepSeek Chat v3.1 (gratuit)' },
      { id: 'openrouter/auto', name: 'OpenRouter Auto' }
    ]);
    alert('Erreur lors de l\'actualisation. Modèles par défaut utilisés.');
  } finally {
    btnRefreshModels.disabled = false;
    btnRefreshModels.textContent = 'Actualiser';
  }
}

// ---------- Recherche ----------
function getBadgeClass(genre) {
  const g = genre.toLowerCase();
  if (g.includes('main scenario')) return 'badge badge-msq';
  if (g.includes('side')) return 'badge badge-side';
  if (g.includes('class')) return 'badge badge-class';
  if (g.includes('role')) return 'badge badge-role';
  if (g.includes('beast tribe') || g.includes('tribal')) return 'badge badge-beast';
  return 'badge';
}

export function doSearch(allQuests, dataset, term) {
  const q = term.toLowerCase();
  log('Recherche: ' + q);
  const matches = dataset.filter(x => {
    const n = (x.Name || '').toLowerCase();
    const nfr = (x.Name_fr || '').toLowerCase();
    const nen = (x.Name_en || '').toLowerCase();
    return n.includes(q) || nfr.includes(q) || nen.includes(q);
  }).slice(0, 30);
  log('Résultats: ' + matches.length);
  resultsDiv.innerHTML = matches.length ? '' : '<p>Aucune quête trouvée.</p>';
  for (const qst of matches) {
    const div = document.createElement('div');
    div.className = 'result';
    const title = qst.Name || qst.Name_fr || qst.Name_en || '(Sans nom)';
    const genre = qst.JournalGenre?.Name_en || '';
    const level = qst.ClassJobLevel0 ?? 'N/A';
    const id = qst.ID;
    div.innerHTML = `<strong>${title}</strong> <span class="${getBadgeClass(genre)}">${genre}</span><br><strong>Niv. ${level}</strong> <small style="font-size: 10px;">ID: ${id}</small>`;
    div.addEventListener('click', () => openQuestWithSummary(qst.ID, div, allQuests));
    resultsDiv.appendChild(div);
  }
}

export function rebuildDataset(allQuests, onlyMsqChecked) {
  const msqFiltered = allQuests.filter(q => (q.JournalGenre?.Name_en || '').toLowerCase().includes('main scenario'));
  const dataset = onlyMsqChecked ? (msqFiltered.length ? msqFiltered : allQuests) : allQuests;
  if (onlyMsqChecked && !msqFiltered.length) log('⚠️ Aucun MSQ détecté via JournalGenre — fallback sur toutes les quêtes.');
  log(`Dataset actif: ${dataset.length} entrées (MSQ=${onlyMsqChecked})`);
  return dataset;
}

// ---------- Ouverture d’une quête & Génération du résumé ----------
import { extractTextChunks, generateSummary, loadAllQuests, fetchOpenRouterModels, filterFreeModels, fetchQuestDetail } from './api.js';
import { clearQuestsCache } from './storage.js';

export async function openQuestWithSummary(id, container, allQuests) {
  // Vérifier si un résumé est déjà affiché ou en cours
  const existingSummary = container.querySelector('.quest-summary');
  if (existingSummary) {
    // Si déjà affiché, le masquer
    existingSummary.remove();
    return;
  }

  try {
    const detail = await fetchQuestDetail(id);
    const name = detail.Name || detail.Name_fr || detail.Name_en || '(Sans nom)';
    const settings = getSettings();
    const cachedSummary = await getCachedSummary(id, settings);

    const summaryDiv = document.createElement('div');
    summaryDiv.className = 'quest-summary';

    if (cachedSummary) {
      // Afficher le résumé en cache immédiatement
      summaryDiv.innerHTML = `<div style="font-weight:600; margin-bottom:6px;">Résumé IA (depuis cache)</div><div>${cachedSummary.replace(/\n/g, '<br>')}</div>`;
      log('Résumé chargé depuis le cache local.');
    } else {
      // Générer un nouveau résumé
      summaryDiv.innerHTML = '<div style="font-weight:600;">Préparation de la génération…</div>';
      try {
        const chunks = extractTextChunks(detail);
        if (!chunks.length) throw new Error('Aucun texte exploitable (TextData vide).');

        const langLine = settings.fr ? 'Rédige en FRANÇAIS.' : 'Write in ENGLISH.';
        const lenLine = settings.short ? 'Longueur: 2 à 3 phrases, max 70 mots.' : 'Longueur: 3 à 5 phrases, max 120 mots.';
        const src = chunks.filter(Boolean).join('\n').slice(0, 6000);
        const prompt = `${langLine}\n${lenLine}\nStyle: clair, narratif, sans bullet points. Pas de mécaniques de gameplay. Pas de spoiler futur.\n\nTitre de la quête: ${name} (ID ${id}).\nExtraits fournis (dialogues/journal):\n---\n${src}\n---\nRédige un résumé fidèle et concis.`;

        globalLoader.classList.remove('hidden');
        const txt = await generateSummary(settings, name, id, chunks, (chunk) => {
          // Pas de streaming visible, juste attendre la fin
        });
        globalLoader.classList.add('hidden');

        // Stocker en cache
        await setCachedSummary(id, settings, txt);

        summaryDiv.innerHTML = `<div style="font-weight:600; margin-bottom:6px;">Résumé IA</div><div>${txt.replace(/\n/g, '<br>')}</div>`;
        log('Génération réussie et stockée en cache.');
      } catch (e) {
        globalLoader.classList.add('hidden');
        summaryDiv.innerHTML = `<div style="color:#b91c1c;">Erreur: ${e.message}</div>`;
        log('Erreur résumé: ' + e.message);
      }
    }

    container.appendChild(summaryDiv);
  } catch (e) {
    log('Erreur détail: ' + e.message);
  }
}

// ---------- Événements ----------
export function initEvents(allQuests, datasetRef) {
  let debounceT = null;

  btnSettings.addEventListener('click', () => {
    restoreSettingsUI();
    dlg.showModal();
  });

  document.getElementById('saveSettings').addEventListener('click', (e) => {
    e.preventDefault();
    const s = {
      key: document.getElementById('orKey').value.trim(),
      model: document.getElementById('orModel').value,
      fr: document.getElementById('sumFR').checked,
      short: document.getElementById('sumShort').checked,
    };
    saveSettings(s);
    dlg.close();
    log('Paramètres enregistrés.');
  });

  btnTest.addEventListener('click', async () => {
    const s = getSettings();
    if (!s.key) {
      alert('Renseigne ta clé OpenRouter dans Paramètres.');
      return;
    }
    try {
      const res = await fetch('https://openrouter.ai/api/v1/models', { headers: { 'Authorization': 'Bearer ' + s.key } });
      log('Test OpenRouter GET /models => HTTP ' + res.status);
      alert(res.ok ? 'Connexion OpenRouter OK ✅' : 'Échec de connexion OpenRouter ❌');
    } catch (e) {
      alert('Erreur test: ' + e.message);
    }
  });

  btnRefreshModels.addEventListener('click', refreshModels);

  btnReloadCache.addEventListener('click', async () => {
    if (confirm('Forcer le rechargement des quêtes depuis l\'API ? Cela effacera le cache local.')) {
      try {
        btnReloadCache.disabled = true;
        btnReloadCache.textContent = 'Rechargement…';
        log('Forçage du rechargement des quêtes…');
        await clearQuestsCache();
        const quests = await loadAllQuests(
          (progress, label) => setProgress(progress, label),
          (msg) => log(msg),
          true // forceReload
        );
        // Mettre à jour le dataset global (nécessite accès à allQuests et datasetRef)
        // Note: Cette logique pourrait être améliorée en passant des callbacks
        log('Rechargement terminé. Actualisez la page pour appliquer les changements.');
        alert('Rechargement terminé ! Actualisez la page pour voir les nouvelles quêtes.');
      } catch (e) {
        log('Erreur rechargement: ' + e.message);
        alert('Erreur lors du rechargement: ' + e.message);
      } finally {
        btnReloadCache.disabled = false;
        btnReloadCache.textContent = 'Forcer rechargement';
      }
    }
  });

  onlyMsq.addEventListener('change', () => {
    datasetRef.current = rebuildDataset(allQuests, onlyMsq.checked);
    statusEl.textContent = `Index reconstruit. ${datasetRef.current.length} entrées`;
    resultsDiv.innerHTML = '';
    if (input.value.trim().length >= 2) doSearch(allQuests, datasetRef.current, input.value.trim());
  });

  input.addEventListener('input', (e) => {
    if (datasetRef.loading) {
      statusEl.textContent = `Chargement en cours… (${datasetRef.loadedPages}/${datasetRef.totalPages})`;
      return;
    }
    const val = e.target.value;
    clearTimeout(debounceT);
    if (val.trim().length < 2) {
      resultsDiv.innerHTML = '';
      return;
    }
    debounceT = setTimeout(() => doSearch(allQuests, datasetRef.current, val), 200);
  });
}
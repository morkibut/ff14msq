/*  */// Module UI pour gérer l'interface utilisateur

import { getCachedSummary, setCachedSummary } from './storage.js';
import { fetchFilterMetadata, filterQuests } from './api.js';

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

// Filtres
const toggleFilters = document.getElementById('toggleFilters');
const filtersPanel = document.getElementById('filtersPanel');
const filterType = document.getElementById('filterType');
const filterJob = document.getElementById('filterJob');
const filterExpansion = document.getElementById('filterExpansion');
const filterRegion = document.getElementById('filterRegion');
const minLevel = document.getElementById('minLevel');
const maxLevel = document.getElementById('maxLevel');
const applyFilters = document.getElementById('applyFilters');
const resetFiltersBtn = document.getElementById('resetFilters');

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

export async function doSearch(searchTerm, currentFilters = {}) {
  try {
    const term = searchTerm.toLowerCase().trim();
    log('Recherche: ' + term);

    const result = await filterQuests(currentFilters, term, 50, 0);

    log(`Résultats: ${result.quests.length} (total: ${result.total})`);
    resultsDiv.innerHTML = result.quests.length ? '' : '<p>Aucune quête trouvée.</p>';

    for (const qst of result.quests) {
      const div = document.createElement('div');
      div.className = 'result';

      // Améliorer l'affichage du nom
      const title = qst.Name || qst.Name_fr || qst.Name_en || 'Quête sans nom';
      const genre = qst.JournalGenre?.Name_en || 'Type inconnu';
      const level = qst.ClassJobLevel0 ?? '?';
      const expansion = qst.Expansion?.Name_en || '';
      const region = qst.PlaceName?.Name_en || '';
      const job = qst.ClassJobCategory?.Name_en || '';

      // Construire les badges de manière plus robuste
      let badges = '';
      if (genre && genre !== 'Type inconnu') {
        badges += `<span class="${getBadgeClass(genre)}">${genre}</span>`;
      }
      if (expansion) {
        badges += ` <span class="badge badge-expansion">${expansion}</span>`;
      }
      if (job) {
        badges += ` <span class="badge badge-job">${job}</span>`;
      }

      // Améliorer l'affichage avec plus d'informations
      const levelText = level !== '?' ? `Niv. ${level}` : 'Niveau inconnu';
      const locationText = region ? ` (${region})` : '';

      div.innerHTML = `<strong>${title}</strong>${badges}<br><strong>${levelText}</strong>${locationText} <small style="font-size: 10px;">ID: ${qst.ID}</small>`;
      div.addEventListener('click', () => openQuestWithSummary(qst.ID, div, []));
      resultsDiv.appendChild(div);
    }

    // Afficher un message si plus de résultats disponibles
    if (result.hasMore) {
      const loadMoreDiv = document.createElement('div');
      loadMoreDiv.className = 'result load-more';
      loadMoreDiv.innerHTML = '<em>Charger plus de résultats...</em>';
      loadMoreDiv.addEventListener('click', () => loadMoreResults(searchTerm, currentFilters, result.quests.length));
      resultsDiv.appendChild(loadMoreDiv);
    }
  } catch (error) {
    log('Erreur de recherche: ' + error.message);
    resultsDiv.innerHTML = '<p>Erreur lors de la recherche.</p>';
  }
}

async function loadMoreResults(searchTerm, filters, offset) {
  try {
    const result = await filterQuests(filters, searchTerm, 50, offset);
    log(`Chargement supplémentaire: ${result.quests.length} résultats`);

    // Supprimer le bouton "charger plus"
    const loadMoreBtn = resultsDiv.querySelector('.load-more');
    if (loadMoreBtn) loadMoreBtn.remove();

    // Ajouter les nouveaux résultats
    for (const qst of result.quests) {
      const div = document.createElement('div');
      div.className = 'result';

      // Améliorer l'affichage du nom
      const title = qst.Name || qst.Name_fr || qst.Name_en || 'Quête sans nom';
      const genre = qst.JournalGenre?.Name_en || 'Type inconnu';
      const level = qst.ClassJobLevel0 ?? '?';
      const expansion = qst.Expansion?.Name_en || '';
      const region = qst.PlaceName?.Name_en || '';
      const job = qst.ClassJobCategory?.Name_en || '';

      // Construire les badges de manière plus robuste
      let badges = '';
      if (genre && genre !== 'Type inconnu') {
        badges += `<span class="${getBadgeClass(genre)}">${genre}</span>`;
      }
      if (expansion) {
        badges += ` <span class="badge badge-expansion">${expansion}</span>`;
      }
      if (job) {
        badges += ` <span class="badge badge-job">${job}</span>`;
      }

      // Améliorer l'affichage avec plus d'informations
      const levelText = level !== '?' ? `Niv. ${level}` : 'Niveau inconnu';
      const locationText = region ? ` (${region})` : '';

      div.innerHTML = `<strong>${title}</strong>${badges}<br><strong>${levelText}</strong>${locationText} <small style="font-size: 10px;">ID: ${qst.ID}</small>`;
      div.addEventListener('click', () => openQuestWithSummary(qst.ID, div, []));
      resultsDiv.appendChild(div);
    }

    // Ajouter un nouveau bouton si plus de résultats
    if (result.hasMore) {
      const loadMoreDiv = document.createElement('div');
      loadMoreDiv.className = 'result load-more';
      loadMoreDiv.innerHTML = '<em>Charger plus de résultats...</em>';
      loadMoreDiv.addEventListener('click', () => loadMoreResults(searchTerm, filters, offset + result.quests.length));
      resultsDiv.appendChild(loadMoreDiv);
    }
  } catch (error) {
    log('Erreur chargement supplémentaire: ' + error.message);
  }
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

// ---------- Gestion des filtres ----------
let currentFilters = {};
let filterMetadata = null;

export async function loadFilterMetadata() {
  try {
    filterMetadata = await fetchFilterMetadata();
    console.log('Métadonnées reçues:', filterMetadata);
    populateFilterOptions();
    log('Métadonnées des filtres chargées');
  } catch (error) {
    log('Erreur chargement métadonnées filtres: ' + error.message);
  }
}

function populateFilterOptions() {
  if (!filterMetadata) return;

  // Types de quête
  filterType.innerHTML = '<option value="">Tous les types</option>';
  // Ajouter MSQ en premier
  const msqOption = document.createElement('option');
  msqOption.value = 'main scenario';
  msqOption.textContent = 'Main Scenario Quest (MSQ)';
  filterType.appendChild(msqOption);

  filterMetadata.types.forEach(type => {
    // Éviter de dupliquer MSQ
    if (!type.toLowerCase().includes('main scenario')) {
      const option = document.createElement('option');
      option.value = type;
      option.textContent = type;
      filterType.appendChild(option);
    }
  });

  // Métiers
  filterJob.innerHTML = '<option value="">Tous les métiers</option>';
  filterMetadata.jobs.forEach(job => {
    const option = document.createElement('option');
    option.value = job;
    option.textContent = job;
    filterJob.appendChild(option);
  });

  // Expansions
  filterExpansion.innerHTML = '<option value="">Toutes les expansions</option>';
  filterMetadata.expansions.forEach(exp => {
    const option = document.createElement('option');
    option.value = exp;
    option.textContent = exp;
    filterExpansion.appendChild(option);
  });

  // Régions
  filterRegion.innerHTML = '<option value="">Toutes les régions</option>';
  filterMetadata.regions.forEach(region => {
    const option = document.createElement('option');
    option.value = region;
    option.textContent = region;
    filterRegion.appendChild(option);
  });

  // Niveaux par défaut
  if (filterMetadata.levels) {
    minLevel.placeholder = filterMetadata.levels.min;
    maxLevel.placeholder = filterMetadata.levels.max;
  }
}

function getSelectedFilters() {
  const filters = {};

  // Récupérer les valeurs sélectionnées des selects multiples
  const selectedTypes = Array.from(filterType.selectedOptions).map(opt => opt.value).filter(v => v);
  if (selectedTypes.length > 0) filters.types = selectedTypes;

  const selectedJobs = Array.from(filterJob.selectedOptions).map(opt => opt.value).filter(v => v);
  if (selectedJobs.length > 0) filters.jobs = selectedJobs;

  const selectedExpansions = Array.from(filterExpansion.selectedOptions).map(opt => opt.value).filter(v => v);
  if (selectedExpansions.length > 0) filters.expansions = selectedExpansions;

  const selectedRegions = Array.from(filterRegion.selectedOptions).map(opt => opt.value).filter(v => v);
  if (selectedRegions.length > 0) filters.regions = selectedRegions;

  // Niveaux
  const min = parseInt(minLevel.value) || undefined;
  const max = parseInt(maxLevel.value) || undefined;
  if (min !== undefined) filters.minLevel = min;
  if (max !== undefined) filters.maxLevel = max;

  return filters;
}

function resetFilters() {
  filterType.selectedIndex = 0;
  filterJob.selectedIndex = 0;
  filterExpansion.selectedIndex = 0;
  filterRegion.selectedIndex = 0;
  minLevel.value = '';
  maxLevel.value = '';
  currentFilters = {};
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

  // Toggle filtres
  toggleFilters.addEventListener('click', () => {
    const isVisible = filtersPanel.style.display !== 'none';
    filtersPanel.style.display = isVisible ? 'none' : 'block';
    toggleFilters.textContent = isVisible ? 'Filtres ▼' : 'Filtres ▲';
  });

  // Appliquer les filtres
  applyFilters.addEventListener('click', () => {
    currentFilters = getSelectedFilters();
    const searchTerm = input.value.trim();
    if (searchTerm.length >= 2 || Object.keys(currentFilters).length > 0) {
      doSearch(searchTerm, currentFilters);
    } else {
      resultsDiv.innerHTML = '';
    }
  });

  // Réinitialiser les filtres
  resetFiltersBtn.addEventListener('click', () => {
    resetFilters();
    const searchTerm = input.value.trim();
    if (searchTerm.length >= 2) {
      doSearch(searchTerm, {});
    } else {
      resultsDiv.innerHTML = '';
    }
  });

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
        // Recharger les métadonnées des filtres
        await loadFilterMetadata();
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

  input.addEventListener('input', (e) => {
    if (datasetRef.loading) {
      statusEl.textContent = `Chargement en cours… (${datasetRef.loadedPages}/${datasetRef.totalPages})`;
      return;
    }
    const val = e.target.value;
    clearTimeout(debounceT);
    if (val.trim().length < 2 && Object.keys(currentFilters).length === 0) {
      resultsDiv.innerHTML = '';
      return;
    }
    debounceT = setTimeout(() => doSearch(val, currentFilters), 200);
  });
}
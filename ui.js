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
const filterTypeSearch = document.getElementById('filterTypeSearch');
const onlyMsqBtn = document.getElementById('onlyMsqBtn');
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
  if (g.includes('main scenario') || g === 'main quests' ||
      g === 'ishgardian restoration main quests' ||
      g === 'cosmic exploration main quests' ||
      g === 'seventh umbral era' ||
      g === 'seventh astral era') return 'badge badge-msq';
  if (g.includes('side')) return 'badge badge-side';
  if (g.includes('class')) return 'badge badge-class';
  if (g.includes('role')) return 'badge badge-role';
  if (g.includes('beast tribe') || g.includes('tribal')) return 'badge badge-beast';
  return 'badge';
}

// Fonction pour obtenir le texte du badge traduit
function getBadgeText(genre) {
  return translateType(genre) || genre;
}

export async function doSearch(searchTerm, currentFilters = {}) {
  try {
    const term = searchTerm.toLowerCase().trim();
    log('Recherche: ' + term);

    const result = await filterQuests(currentFilters, term, 50, 0);

    log(`Résultats: ${result.quests.length} (total: ${result.total})`);
    resultsDiv.innerHTML = result.quests.length ? '' : '<p>Aucune quête trouvée.</p>';

    // Trier les quêtes par niveau croissant
    const sortedQuests = result.quests.sort((a, b) => {
      const levelA = a.ClassJobLevel0 || 0;
      const levelB = b.ClassJobLevel0 || 0;
      return levelA - levelB;
    });

    for (const qst of sortedQuests) {
      const div = document.createElement('div');
      div.className = 'result';

      // Améliorer l'affichage du nom
      const title = qst.Name || qst.Name_fr || qst.Name_en || 'Quête sans nom';
      const genre = qst.JournalGenre?.Name_en || 'Type inconnu';
      const level = qst.ClassJobLevel0 ?? '?';
      const expansion = qst.Expansion?.Name_en || '';
      const region = qst.PlaceName?.Name_en || '';
      const job = qst.ClassJobCategory?.Name_en ||
                  qst.ClassJobCategory?.Name_fr ||
                  qst.ClassJobLevel0Target ||
                  qst.ClassJobLevel1Target || '';

      // Construire les badges de manière plus robuste
      let badges = '';
      if (genre && genre !== 'Type inconnu') {
        badges += `<span class="${getBadgeClass(genre)}">${getBadgeText(genre)}</span>`;
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

    // Trier les quêtes par niveau croissant
    const sortedQuests = result.quests.sort((a, b) => {
      const levelA = a.ClassJobLevel0 || 0;
      const levelB = b.ClassJobLevel0 || 0;
      return levelA - levelB;
    });

    // Ajouter les nouveaux résultats
    for (const qst of sortedQuests) {
      const div = document.createElement('div');
      div.className = 'result';

      // Améliorer l'affichage du nom
      const title = qst.Name || qst.Name_fr || qst.Name_en || 'Quête sans nom';
      const genre = qst.JournalGenre?.Name_en || 'Type inconnu';
      const level = qst.ClassJobLevel0 ?? '?';
      const expansion = qst.Expansion?.Name_en || '';
      const region = qst.PlaceName?.Name_en || '';
      const job = qst.ClassJobCategory?.Name_en ||
                  qst.ClassJobCategory?.Name_fr ||
                  qst.ClassJobLevel0Target ||
                  qst.ClassJobLevel1Target || '';

      // Construire les badges de manière plus robuste
      let badges = '';
      if (genre && genre !== 'Type inconnu') {
        badges += `<span class="${getBadgeClass(genre)}">${getBadgeText(genre)}</span>`;
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

// Mapping des traductions des types de quêtes
const typeTranslations = {
  // Vrais types MSQ
  'Main Quests': 'Quêtes principales',
  'Ishgardian Restoration Main Quests': 'Quêtes principales de restauration d\'Ishgard',
  'Cosmic Exploration Main Quests': 'Quêtes principales d\'exploration cosmique',
  'Seventh Umbral Era': 'Septième ère ombrale',
  'Seventh Astral Era': 'Septième ère astrale',
  // Anciens types (au cas où)
  'Main Scenario Quest': 'Quête d\'épopée principale',
  'Main Scenario (A Realm Reborn)': 'Épopée principale (A Realm Reborn)',
  'Main Scenario (Heavensward)': 'Épopée principale (Heavensward)',
  'Main Scenario (Stormblood)': 'Épopée principale (Stormblood)',
  'Main Scenario (Shadowbringers)': 'Épopée principale (Shadowbringers)',
  'Main Scenario (Endwalker)': 'Épopée principale (Endwalker)',
  'Main Scenario (Dawntrail)': 'Épopée principale (Dawntrail)',
  'Side Quest': 'Quête secondaire',
  'Class Quest': 'Quête de classe',
  'Job Quest': 'Quête de job',
  'Role Quest': 'Quête de rôle',
  'Beast Tribe Quest': 'Quête de tribu bestiale',
  'Tribal Quest': 'Quête tribale',
  'Grand Company Quest': 'Quête de grande compagnie',
  'Hunting Log': 'Carnet de chasse',
  'Levequest': 'Mandat',
  'Feature Quest': 'Quête de fonctionnalité',
  'Seasonal Event': 'Événement saisonnier',
  'Halloween Event': 'Événement Halloween',
  'Little Ladies\' Day Event': 'Événement Journée des petites dames',
  'Hatching-tide Event': 'Événement Fête des œufs',
  'Moonfire Faire Event': 'Événement Fête de la lune de feu',
  'Starlight Celebration Event': 'Événement Célébration des étoiles',
  'Heavensturn Event': 'Événement Nouvel an céleste',
  'All Saints\' Wake Event': 'Événement Veillée de tous les saints',
  'Make It Rain Event': 'Événement Fais pleuvoir',
  'The Rising Event': 'Événement L\'ascension',
  'Realm Reborn (Patch)': 'Realm Reborn (Patch)',
  'Heavensward (Patch)': 'Heavensward (Patch)',
  'Stormblood (Patch)': 'Stormblood (Patch)',
  'Shadowbringers (Patch)': 'Shadowbringers (Patch)',
  'Endwalker (Patch)': 'Endwalker (Patch)',
  'Dawntrail (Patch)': 'Dawntrail (Patch)',
  // Artisanat
  'Alchemist Quests': 'Quêtes d\'alchimiste',
  'Armorer Quests': 'Quêtes d\'armurier',
  'Blacksmith Quests': 'Quêtes de forgeron',
  'Carpenter Quests': 'Quêtes de menuisier',
  'Culinarian Quests': 'Quêtes de cuisinier',
  'Goldsmith Quests': 'Quêtes d\'orfèvre',
  'Leatherworker Quests': 'Quêtes de tanneur',
  'Weaver Quests': 'Quêtes de tisserand',
  // Récolte
  'Botanist Quests': 'Quêtes de botaniste',
  'Fisher Quests': 'Quêtes de pêcheur',
  'Miner Quests': 'Quêtes de mineur',
  // Classes DPS
  'Monk Quests': 'Quêtes de moine',
  'Dragoon Quests': 'Quêtes de dragon',
  'Ninja Quests': 'Quêtes de ninja',
  'Samurai Quests': 'Quêtes de samouraï',
  'Reaper Quests': 'Quêtes de faucheur',
  'Viper Quests': 'Quêtes de vipère',
  'Bard Quests': 'Quêtes de barde',
  'Machinist Quests': 'Quêtes de machiniste',
  'Dancer Quests': 'Quêtes de danseur',
  'Red Mage Quests': 'Quêtes de mage rouge',
  'Black Mage Quests': 'Quêtes de mage noir',
  'Summoner Quests': 'Quêtes d\'invocateur',
  'Pictomancer Quests': 'Quêtes de pictomancien',
  // Tanks
  'Paladin Quests': 'Quêtes de paladin',
  'Warrior Quests': 'Quêtes de guerrier',
  'Dark Knight Quests': 'Quêtes de chevalier noir',
  'Gunbreaker Quests': 'Quêtes de pisto-sabreur',
  // Healers
  'White Mage Quests': 'Quêtes de mage blanc',
  'Scholar Quests': 'Quêtes d\'érudit',
  'Astrologian Quests': 'Quêtes d\'astrologue',
  'Sage Quests': 'Quêtes de sage',
  // Classes limitées
  'Blue Mage Quests': 'Quêtes de mage bleu',
  'Arcanist Quests': 'Quêtes d\'arcaniste',
  'Conjurer Quests': 'Quêtes d\'élémentaliste',
  'Gladiator Quests': 'Quêtes de gladiateur',
  'Lancer Quests': 'Quêtes de lancier',
  'Marauder Quests': 'Quêtes de maraudeur',
  'Pugilist Quests': 'Quêtes de pugiliste',
  'Rogue Quests': 'Quêtes de voleur',
  'Thaumaturge Quests': 'Quêtes de thaumaturge',
  'Archer Quests': 'Quêtes d\'archer'
};

// Fonction pour traduire un type
function translateType(type) {
  return typeTranslations[type] || type;
}

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

  // Types de quête - organisation par catégories
  filterType.innerHTML = '';

  // Créer les groupes optgroup dynamiquement
  const createOptGroup = (label, emoji) => {
    const group = document.createElement('optgroup');
    group.label = `${emoji} ${label}`;
    filterType.appendChild(group);
    return group;
  };

  const msqGroup = createOptGroup('Histoire principale', '📖');
  const classGroup = createOptGroup('Classes & Jobs', '⚔️');
  const craftGroup = createOptGroup('Artisanat', '🔨');
  const gatherGroup = createOptGroup('Récolte', '🌾');

  // Option "Tous les types" en premier
  const allOption = document.createElement('option');
  allOption.value = '';
  allOption.textContent = 'Tous les types';
  filterType.insertBefore(allOption, filterType.firstChild);

  // Trier et organiser les types
  const sortedTypes = filterMetadata.types.sort();

  sortedTypes.forEach(type => {
    const typeLower = type.toLowerCase();

    if (typeLower === 'main quests' ||
        typeLower === 'ishgardian restoration main quests' ||
        typeLower === 'cosmic exploration main quests' ||
        typeLower === 'seventh umbral era' ||
        typeLower === 'seventh astral era' ||
        typeLower.includes('main scenario')) {
      const option = document.createElement('option');
      option.value = type;
      option.textContent = translateType(type);
      option.setAttribute('data-original', type); // Garder la valeur originale pour la recherche
      msqGroup.appendChild(option);
    } else if (typeLower.includes('mage') || typeLower.includes('knight') || typeLower.includes('monk') ||
               typeLower.includes('bard') || typeLower.includes('dragoon') || typeLower.includes('ninja') ||
               typeLower.includes('samurai') || typeLower.includes('reaper') || typeLower.includes('viper') ||
               typeLower.includes('machinist') || typeLower.includes('dancer') || typeLower.includes('gunbreaker') ||
               typeLower.includes('paladin') || typeLower.includes('warrior') || typeLower.includes('dark knight') ||
               typeLower.includes('white mage') || typeLower.includes('black mage') || typeLower.includes('summoner') ||
               typeLower.includes('scholar') || typeLower.includes('astrologian') || typeLower.includes('sage') ||
               typeLower.includes('red mage') || typeLower.includes('blue mage') || typeLower.includes('pictomancer') ||
               typeLower.includes('role quests')) {
      const option = document.createElement('option');
      option.value = type;
      option.textContent = translateType(type);
      option.setAttribute('data-original', type);
      classGroup.appendChild(option);
    } else if (typeLower.includes('smith') || typeLower.includes('armor') || typeLower.includes('goldsmith') ||
               typeLower.includes('leatherworker') || typeLower.includes('weaver') || typeLower.includes('alchemist') ||
               typeLower.includes('carpenter') || typeLower.includes('blacksmith') || typeLower.includes('culinarian')) {
      const option = document.createElement('option');
      option.value = type;
      option.textContent = translateType(type);
      option.setAttribute('data-original', type);
      craftGroup.appendChild(option);
    } else if (typeLower.includes('miner') || typeLower.includes('botanist') || typeLower.includes('fisher')) {
      const option = document.createElement('option');
      option.value = type;
      option.textContent = translateType(type);
      option.setAttribute('data-original', type);
      gatherGroup.appendChild(option);
    } else {
      // Autres types non catégorisés - ajouter directement au select
      const option = document.createElement('option');
      option.value = type;
      option.textContent = translateType(type);
      option.setAttribute('data-original', type);
      filterType.appendChild(option);
    }
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

  // Initialiser le filtrage des options
  initTypeFilter();
}

// Fonction pour filtrer les options du select des types
function initTypeFilter() {
  filterTypeSearch.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase().trim();
    const options = filterType.querySelectorAll('option');

    options.forEach(option => {
      if (option.value === '') {
        // Garder toujours "Tous les types" visible
        option.style.display = 'block';
        return;
      }

      const originalText = option.getAttribute('data-original') || option.textContent;
      const translatedText = option.textContent;

      const matches = originalText.toLowerCase().includes(searchTerm) ||
                     translatedText.toLowerCase().includes(searchTerm);

      option.style.display = matches ? 'block' : 'none';
    });
  });
}

// Fonction pour sélectionner uniquement les MSQ
function selectOnlyMSQ() {
  const options = filterType.querySelectorAll('option');
  const msqTypes = [];

  options.forEach(option => {
    if (option.value && option.getAttribute('data-original')) {
      const original = option.getAttribute('data-original').toLowerCase();
      // Les vraies MSQ incluent Main Quests et les ères ombrales/astrales
      if (original === 'main quests' ||
          original === 'ishgardian restoration main quests' ||
          original === 'cosmic exploration main quests' ||
          original === 'seventh umbral era' ||
          original === 'seventh astral era') {
        msqTypes.push(option.value);
      }
    }
  });

  // Désélectionner tout
  options.forEach(option => {
    option.selected = false;
  });

  // Sélectionner les MSQ
  msqTypes.forEach(type => {
    const option = Array.from(options).find(opt => opt.value === type);
    if (option) option.selected = true;
  });

  log(`Sélection automatique de ${msqTypes.length} types MSQ`);
}

function getSelectedFilters() {
  const filters = {};

  // Récupérer les valeurs sélectionnées des selects multiples
  const selectedTypes = Array.from(filterType.selectedOptions).map(opt => opt.value).filter(v => v);
  if (selectedTypes.length > 0) filters.types = selectedTypes;

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

  // Bouton "Uniquement MSQ"
  onlyMsqBtn.addEventListener('click', selectOnlyMSQ);

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
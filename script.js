// Script principal pour l'app FF14 MSQ

import { loadAllQuests, fetchOpenRouterModels, filterFreeModels } from './api.js';
import { initTabs, log, setProgress, getSettings, updateModelSelect, rebuildDataset, doSearch, initEvents } from './ui.js';

// ---------- État global ----------
let allQuests = [];
let dataset = [];
let loadedPages = 0;
let totalPages = 0;
let loading = true;

// Référence pour dataset
const datasetRef = { current: dataset, loading, loadedPages, totalPages };

// ---------- Chargement initial ----------
async function init() {
  try {
    // Charger les modèles OpenRouter
    const s = getSettings();
    if (s.key) {
      try {
        log('Récupération des modèles OpenRouter…');
        const models = await fetchOpenRouterModels(s.key);
        const freeModels = filterFreeModels(models);
        updateModelSelect(freeModels);
        log(`Modèles gratuits récupérés: ${freeModels.length}`);
      } catch (e) {
        log('Erreur récupération modèles: ' + e.message);
        // Fallback aux modèles statiques
        updateModelSelect([
          { id: 'meta-llama/llama-3.1-8b-instruct:free', name: 'Llama 3.1 8B Instruct (gratuit)' },
          { id: 'google/gemma-2-9b-it:free', name: 'Gemma 2 9B IT (gratuit)' },
          { id: 'mistralai/mixtral-8x7b-instruct:free', name: 'Mixtral 8x7B Instruct (gratuit)' },
          { id: 'qwen/qwen2.5-7b-instruct:free', name: 'Qwen2.5 7B Instruct (gratuit)' },
          { id: 'openrouter/auto', name: 'OpenRouter Auto' }
        ]);
      }
    }

    // Charger les quêtes
    allQuests = await loadAllQuests(
      (progress, label) => setProgress(progress, label),
      (msg) => log(msg)
    );
    dataset = rebuildDataset(allQuests, document.getElementById('onlyMsq').checked);
    datasetRef.current = dataset;
    loading = false;
    datasetRef.loading = false;
    document.getElementById('search').disabled = false;
    setProgress(100);
    log(`Prêt. ${dataset.length} entrées dans l’index`);
  } catch (e) {
    loading = false;
    datasetRef.loading = false;
    log('Erreur: ' + e.message);
  }
}

// ---------- Lancement ----------
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initEvents(allQuests, datasetRef);
  init();
});
// Script principal pour l'app FF14 MSQ

import { loadAllQuests, fetchOpenRouterModels, filterFreeModels } from './api.js';
import { initTabs, log, setProgress, getSettings, updateModelSelect, doSearch, initEvents, loadFilterMetadata } from './ui.js';

// ---------- État global ----------
let loading = true;

// Référence pour dataset (simplifié pour compatibilité)
const datasetRef = { loading };

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
    await loadAllQuests(
      (progress, label) => setProgress(progress, label),
      (msg) => log(msg)
    );

    // Charger les métadonnées des filtres
    await loadFilterMetadata();

    loading = false;
    datasetRef.loading = false;
    document.getElementById('searchInput').disabled = false;
    setProgress(100);
    log('Prêt. Utilisez les filtres pour rechercher des quêtes.');
  } catch (e) {
    loading = false;
    datasetRef.loading = false;
    log('Erreur: ' + e.message);
  }
}

// ---------- Lancement ----------
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initEvents([], datasetRef); // Plus besoin d'allQuests car on utilise l'API
  init();
});
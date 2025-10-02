// Module UI pour gérer l'interface utilisateur

// ---------- Sélecteurs ----------
const input = document.getElementById('searchInput');
const resultsDiv = document.getElementById('results');
const logsDiv = document.getElementById('logsDiv');
const statusEl = document.getElementById('status');
const bar = document.getElementById('bar');
const onlyMsq = document.getElementById('onlyMsq');
const btnSettings = document.getElementById('btnSettings');
const btnTest = document.getElementById('btnTest');
const dlg = document.getElementById('settingsDialog');
const orModelSelect = document.getElementById('orModel');

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
    model: localStorage.getItem('orModel') || 'meta-llama/llama-3.1-8b-instruct:free',
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

// ---------- Recherche ----------
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
    div.innerHTML = `<strong>${title}</strong> <span class="badge">${genre}</span><br><small>ID: ${qst.ID} · Niv. ${qst.ClassJobLevel0 ?? 'N/A'}</small>`;
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
import { fetchQuestDetail, extractTextChunks, generateSummary } from './api.js';

export async function openQuestWithSummary(id, container, allQuests) {
  try {
    const detail = await fetchQuestDetail(id);
    const name = detail.Name || detail.Name_fr || detail.Name_en || '(Sans nom)';
    const wrap = document.createElement('div');
    wrap.className = 'details';
    wrap.innerHTML = `
      <h3>${name}</h3>
      <p><strong>ID:</strong> ${detail.ID} · <strong>Niv. req.:</strong> ${detail.ClassJobLevel0 ?? 'N/A'}</p>
      <div class="row" style="gap:8px; margin:6px 0;">
        <button class="btn primary" id="btnGen-${id}">Générer le résumé IA</button>
        <span class="muted">(utilise ta clé OpenRouter)</span>
      </div>
      <div id="sum-${id}" style="border:1px dashed #94a3b8; border-radius:8px; padding:10px; background:#f8fafc; display:none;"></div>
    `;
    const old = container.querySelector('.details');
    if (old) old.remove();
    container.appendChild(wrap);

    const btn = document.getElementById(`btnGen-${id}`);
    const out = document.getElementById(`sum-${id}`);
    btn.addEventListener('click', async () => {
      try {
        btn.disabled = true;
        btn.textContent = 'Génération en cours…';
        const chunks = extractTextChunks(detail);
        if (!chunks.length) throw new Error('Aucun texte exploitable (TextData vide).');
        const txt = await generateSummary(getSettings(), name, id, chunks);
        out.style.display = 'block';
        out.innerHTML = `<div style="font-weight:600; margin-bottom:6px;">Résumé IA</div><div>${txt.replace(/\n/g, '<br>')}</div>`;
      } catch (e) {
        out.style.display = 'block';
        out.innerHTML = `<div style="color:#b91c1c;">Erreur: ${e.message}</div>`;
        log('Erreur résumé: ' + e.message);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Générer le résumé IA';
      }
    });
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
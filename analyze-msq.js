// Script d'analyse des quêtes MSQ
// À exécuter avec : node analyze-msq.js

async function analyzeMSQ() {
  try {
    console.log('🔍 Analyse des quêtes MSQ...\n');

    // Récupérer les quêtes depuis l'API locale
    console.log('📡 Récupération des quêtes depuis l\'API...');
    const response = await fetch('http://localhost:3050/api/quests');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const quests = await response.json();
    console.log(`📊 Total des quêtes stockées: ${quests.length}\n`);

    // Analyser les JournalGenre
    const genres = new Map();
    const msqCandidates = [];

    quests.forEach(quest => {
      const genre = quest.JournalGenre?.Name_en;
      if (genre) {
        genres.set(genre, (genres.get(genre) || 0) + 1);

        // Chercher les candidats MSQ
        const genreLower = genre.toLowerCase();
        if (genreLower.includes('main') || genreLower.includes('scenario') ||
            genreLower.includes('epop') || genreLower.includes('story')) {
          msqCandidates.push({
            id: quest.ID,
            name: quest.Name_en || quest.Name,
            genre: genre,
            level: quest.ClassJobLevel0
          });
        }
      }
    });

    console.log('📋 Répartition par JournalGenre.Name_en:');
    console.log('=====================================');
    Array.from(genres.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([genre, count]) => {
        console.log(`${genre}: ${count} quêtes`);
      });

    console.log('\n🎯 Candidats MSQ trouvés:');
    console.log('==========================');
    msqCandidates
      .sort((a, b) => a.level - b.level)
      .forEach(quest => {
        console.log(`ID ${quest.id}: ${quest.name} (Niv.${quest.level}) - ${quest.genre}`);
      });

    console.log(`\n✅ Total candidats MSQ: ${msqCandidates.length}`);

    // Vérifier les métadonnées des filtres
    try {
      const metadata = await db.get('filter-metadata');
      console.log('\n🏷️  Métadonnées des filtres:');
      console.log('===========================');
      console.log(`Types: ${metadata.types.length}`);
      metadata.types.forEach(type => console.log(`  - ${type}`));
    } catch (e) {
      console.log('\n❌ Pas de métadonnées de filtres trouvées');
    }

  } catch (error) {
    console.error('❌ Erreur:', error.message);
  }
}

analyzeMSQ();
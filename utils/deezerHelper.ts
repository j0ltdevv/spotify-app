/**
 * deezerHelper.ts
 * Helper pour rechercher des extraits audio sur Deezer
 * API gratuite, sans clé requise pour la recherche simple
 */

/**
 * Recherche un extrait audio sur Deezer (30 secondes)
 * Retourne l'URL de preview ou null si aucun résultat
 */
export const fetchAudioFromDeezer = async (
  title: string,
  artist: string
): Promise<string | null> => {
  try {
    // Deezer est très performant avec une recherche simple "Artiste Titre"
    const query = encodeURIComponent(`${artist} ${title}`);
    
    console.log(`   🔎 Deezer: Recherche de "${title}" par ${artist}`);
    console.log(`   🌐 Query = "${artist} ${title}"`);
    
    // L'API Deezer est gratuite et ne nécessite pas de clé pour la recherche
    const response = await fetch(
      `https://api.deezer.com/search?q=${query}&limit=1`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.log(`   ❌ Deezer API error: ${response.status}`);
      return null;
    }

    const data = await response.json();

    if (data.data && data.data.length > 0) {
      const track = data.data[0];
      console.log(`   ✅ ✅ ✅ DEEZER TROUVÉ !`);
      console.log(`      Deezer: "${track.title}" par ${track.artist.name}`);
      console.log(`      Original: "${title}" par ${artist}`);
      console.log(`      Preview URL: ${track.preview}`);
      return track.preview; // URL mp3 de 30 secondes
    }

    console.log(`   ❌ ❌ ❌ Deezer: Aucun résultat`);
    console.log(`      Cherché: "${title}" par ${artist}`);
    return null;
    
  } catch (error) {
    console.error("   ❌ ❌ ❌ Erreur Deezer API:", error);
    return null;
  }
};

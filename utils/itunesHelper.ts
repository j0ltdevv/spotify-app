import { API_ENDPOINTS } from '../config';
import { ITunesSearchResult, ITunesTrack } from '../types';

/**
 * Nettoie un titre de track pour la recherche iTunes
 * Supprime les versions spéciales, feat, remix, etc.
 */
export const cleanTrackTitle = (title: string): string => {
  // 1. Suppression des versions spéciales (feat, remix, etc.)
  let cleanTitle = title
    .replace(/ - .*/, '')
    .replace(/\(.*\)/, '')
    .replace(/feat\..*/i, '')
    .trim();
    
  // 2. Normalisation : Supprime les accents et les caractères complexes
  cleanTitle = cleanTitle.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  return cleanTitle;
};

/**
 * Normalise une chaîne pour la comparaison (minuscules, sans accents, sans ponctuation)
 * Amélioration : gestion des feat., versions, etc.
 */
const normalizeForComparison = (str: string): string => {
  return str.toLowerCase()
    // Normalisation des featuring
    .replace(/\bfeat\.?\b/gi, 'ft')
    .replace(/\bfeaturing\b/gi, 'ft')
    .replace(/\bft\.?\b/gi, 'ft')
    .replace(/\bwith\b/gi, 'ft')
    .replace(/\s*&\s*/g, ' ft ')
    // Normalisation des versions entre crochets et tirets
    .replace(/\[(.*?)\]/g, '($1)') // [Radio Edit] → (Radio Edit)
    .replace(/\s+-\s+(.*?)$/g, ' ($1)') // - Radio Edit → (Radio Edit)
    // Suppression des accents
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, '')
    // Suppression de la ponctuation (mais garde les parenthèses pour les versions)
    .replace(/[^a-z0-9\s()]/g, '')
    // Normalisation des espaces
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Normalise un nom d'artiste (gère "The Beatles" vs "Beatles")
 */
const normalizeArtistName = (artist: string): string => {
  return normalizeForComparison(artist)
    // Suppression des articles au début
    .replace(/^the\s+/i, '')
    .replace(/^le\s+/i, '')
    .replace(/^la\s+/i, '')
    .replace(/^les\s+/i, '')
    .replace(/^l\s+/i, '')
    .trim();
};

/**
 * Mots-clés à toujours éviter dans les titres iTunes
 */
const ALWAYS_AVOID_KEYWORDS = [
  'karaoke', 'tribute', 'cover'
];

/**
 * Mots-clés à éviter SAUF si présents dans le titre original
 */
const CONDITIONAL_AVOID_KEYWORDS = [
  'live', 'remix', 'instrumental', 'acoustic', 'remaster', 'demo'
];

/**
 * Vérifie si un track iTunes est acceptable
 * NOUVELLE LOGIQUE: Si le titre original contient "Remix", on autorise les remixes iTunes
 */
const isAcceptableVersion = (track: ITunesTrack, originalTitle: string): boolean => {
  const lowerItunesName = track.trackName.toLowerCase();
  const lowerItunesCollection = track.collectionName?.toLowerCase() || '';
  const lowerOriginalTitle = originalTitle.toLowerCase();
  
  // 1. Toujours rejeter karaoke, tribute, cover
  const alwaysReject = ALWAYS_AVOID_KEYWORDS.find(keyword => 
    lowerItunesName.includes(keyword) || lowerItunesCollection.includes(keyword)
  );
  
  if (alwaysReject) {
    console.log(`      ❌ Rejeté : contient "${alwaysReject}" (liste noire)`);
    return false;
  }
  
  // 2. Pour les autres mots-clés, vérifier si présents dans l'original
  for (const keyword of CONDITIONAL_AVOID_KEYWORDS) {
    const keywordInItunes = lowerItunesName.includes(keyword) || lowerItunesCollection.includes(keyword);
    const keywordInOriginal = lowerOriginalTitle.includes(keyword);
    
    // Si le mot-clé est dans iTunes mais PAS dans l'original, rejeter
    if (keywordInItunes && !keywordInOriginal) {
      console.log(`      ❌ Rejeté : contient "${keyword}" (pas dans l'original)`);
      console.log(`         iTunes: "${track.trackName}"`);
      console.log(`         Original: "${originalTitle}"`);
      return false;
    }
    
    if (keywordInItunes && keywordInOriginal) {
      console.log(`      ✅ Accepté : "${keyword}" présent dans original ET iTunes`);
    }
  }
  
  return true;
};

/**
 * Calcule le ratio de correspondance entre deux titres
 */
const calculateTitleMatchRatio = (originalTitle: string, trackTitle: string): number => {
  const originalWords = normalizeForComparison(originalTitle)
    .split(/\s+/)
    .filter(w => w.length > 2);
  const trackWords = normalizeForComparison(trackTitle)
    .split(/\s+/)
    .filter(w => w.length > 2);
  
  if (originalWords.length === 0) return 0;
  
  const matchingWords = originalWords.filter(w => 
    trackWords.some(tw => tw.includes(w) || w.includes(tw))
  );
  
  return matchingWords.length / originalWords.length;
};

/**
 * Vérifie si l'artiste correspond (avec gestion avancée)
 */
const isArtistMatch = (originalArtist: string, trackArtist: string): boolean => {
  if (!originalArtist || !trackArtist) return true;
  
  const normalizedOriginal = normalizeArtistName(originalArtist);
  const normalizedTrack = normalizeArtistName(trackArtist);
  
  // Match exact
  if (normalizedOriginal === normalizedTrack) return true;
  
  // L'un contient l'autre
  if (normalizedTrack.includes(normalizedOriginal) || normalizedOriginal.includes(normalizedTrack)) {
    return true;
  }
  
  // Gestion des featuring (prendre seulement l'artiste principal)
  const originalMainArtist = normalizedOriginal.split(/\bft\b/)[0].trim();
  const trackMainArtist = normalizedTrack.split(/\bft\b/)[0].trim();
  
  if (originalMainArtist === trackMainArtist) return true;
  
  // Match partiel pour les noms similaires
  if (originalMainArtist.includes(trackMainArtist) || trackMainArtist.includes(originalMainArtist)) {
    return true;
  }
  
  // Similarité phonétique (au moins 75% de correspondance)
  const similarity = calculateStringSimilarity(originalMainArtist, trackMainArtist);
  return similarity >= 0.75;
};

/**
 * Calcule la similarité entre deux chaînes (0 = différent, 1 = identique)
 */
const calculateStringSimilarity = (str1: string, str2: string): number => {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
};

/**
 * Calcule la distance de Levenshtein entre deux chaînes
 */
const levenshteinDistance = (str1: string, str2: string): number => {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
};

/**
 * Résultat normalisé de la recherche iTunes
 */
export interface ItunesResult {
  audioUrl: string;
  title: string;
  artist: string;
  album: string;
  cover: string;
}

/**
 * Recherche un extrait audio sur iTunes
 * Retourne les détails du track iTunes trouvé ou null
 */
export const fetchAudioFromItunes = async (
  title: string, 
  artist: string
): Promise<ItunesResult | null> => {
  try {
    const cleanedTitle = cleanTrackTitle(title);
    // console.log(`   🔎 iTunes: Recherche de "${title}" par ${artist}`);
    // console.log(`   📝 Titre nettoyé: "${cleanedTitle}"`);
    
    // --- TENTATIVE 1 : Titre + Artiste (Le plus précis) ---
    let query = encodeURIComponent(`${cleanedTitle} ${artist}`);
    // console.log(`   🌐 T1: Query = "${cleanedTitle} ${artist}"`);
    let response = await fetch(`${API_ENDPOINTS.ITUNES_SEARCH}?term=${query}&media=music&entity=song&limit=5`);
    let data: ITunesSearchResult = await response.json();
    
    // console.log(`   📊 T1: ${data.resultCount} résultats trouvés`);
    
    if (data.resultCount === 0) {
      // console.log(`   ❌ iTunes: T1 échec pour ${title}. Essai T2 (Artiste seul)...`);
      
      // --- TENTATIVE 2 (Plan B) : Artiste seul ---
      query = encodeURIComponent(artist);
      // console.log(`   🌐 T2: Query = "${artist}"`);
      response = await fetch(`${API_ENDPOINTS.ITUNES_SEARCH}?term=${query}&media=music&entity=song&limit=5`);
      data = await response.json();

      // console.log(`   📊 T2: ${data.resultCount} résultats trouvés`);

      if (data.resultCount === 0) {
        // console.log(`   ❌ iTunes: T2 échec pour ${artist}. Abandon.`);
        return null;
      }
    }

    const normalizedOriginalTitle = normalizeForComparison(cleanedTitle);
    const normalizedOriginalArtist = normalizeForComparison(artist);

    // console.log(`   🎯 Analyse de ${data.results.length} résultats iTunes...`);

    // 1. Chercher le meilleur match (90% de correspondance minimum)
    const bestMatch = data.results.find((track: ITunesTrack) => {
      // console.log(`      🔍 Analyse: "${track.trackName}" par ${track.artistName}`);
      
      if (!track.previewUrl) {
        // console.log(`      ❌ Rejeté : Pas de previewUrl`);
        return false;
      }
      
      if (!isAcceptableVersion(track, title)) {
        return false;
      }
      
      const titleMatchRatio = calculateTitleMatchRatio(cleanedTitle, track.trackName);
      const artistMatch = isArtistMatch(artist, track.artistName);
      
      // console.log(`      📊 Match: ${(titleMatchRatio * 100).toFixed(0)}% titre, Artiste: ${artistMatch ? '✅' : '❌'}`);
      
      if (titleMatchRatio >= 0.9 && artistMatch) {
        // console.log(`      🎉 EXCELLENT MATCH (≥90%) !`);
      }
      
      return titleMatchRatio >= 0.9 && artistMatch;
    });

    if (bestMatch) {
      // console.log(`   ✅ ✅ ✅ MATCH PARFAIT TROUVÉ (≥90%) !`);
      return {
        audioUrl: bestMatch.previewUrl!,
        title: bestMatch.trackName,
        artist: bestMatch.artistName,
        album: bestMatch.collectionName,
        cover: bestMatch.artworkUrl100?.replace('100x100', '600x600') || ''
      };
    }

    // console.log(`   🔄 Aucun match ≥90%, tentative avec seuil 80%...`);

    // 2. Fallback avec seuil à 80%
    const fallbackMatch = data.results.find((track: ITunesTrack) => {
      // console.log(`      🔍 Fallback: "${track.trackName}"`);
      
      if (!track.previewUrl) {
        // console.log(`      ❌ Pas de preview`);
        return false;
      }
      
      if (!isAcceptableVersion(track, title)) {
        return false;
      }
      
      const titleMatchRatio = calculateTitleMatchRatio(cleanedTitle, track.trackName);
      const artistMatch = isArtistMatch(artist, track.artistName);
      
      console.log(`      📊 Match: ${(titleMatchRatio * 100).toFixed(0)}% titre, Artiste: ${artistMatch ? '✅' : '❌'}`);
      
      if (titleMatchRatio >= 0.8 && artistMatch) {
        console.log(`      ✅ BON MATCH (≥80%) !`);
      }
      
      return titleMatchRatio >= 0.8 && artistMatch;
    });

    if (fallbackMatch) {
      console.log(`   ⚠️ ✅ Match de secours trouvé (80-89%)`);
      console.log(`      iTunes: "${fallbackMatch.trackName}" par ${fallbackMatch.artistName}`);
      console.log(`      Original: "${title}" par ${artist}`);
      return {
        audioUrl: fallbackMatch.previewUrl!,
        title: fallbackMatch.trackName,
        artist: fallbackMatch.artistName,
        album: fallbackMatch.collectionName,
        cover: fallbackMatch.artworkUrl100?.replace('100x100', '600x600') || ''
      };
    }

    console.log(`   ❌ ❌ ❌ iTunes: Aucun extrait valide trouvé`);
    console.log(`      Cherché: "${title}" par ${artist}`);
    return null;
  } catch (error) {
    console.error("❌ Erreur dans iTunes Bridge:", error);
    return null;
  }
};

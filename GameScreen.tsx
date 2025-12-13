import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Animated, Alert, ActivityIndicator } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../App';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';

type GameScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Game'>;
  route: RouteProp<RootStackParamList, 'Game'>;
};

// --- CONFIGURATION ---
const MAX_ROUNDS = 5; // La limite est bien définie ici !
const INITIAL_TIME = 30;

const MOCK_PLAYERS = [
  { id: '1', name: 'Moi', color: '#1DB954', emoji: '😎' },
  { id: '2', name: 'Julie', color: '#FF6B6B', emoji: '🎀' },
  { id: '3', name: 'Thomas', color: '#4ECDC4', emoji: '🎸' },
  { id: '4', name: 'Léa', color: '#FFE66D', emoji: '✨' },
];

const { width } = Dimensions.get('window');

const cleanTrackTitle = (title: string) => {
  return title.replace(/ - .*/, '').replace(/\(.*\)/, '').trim();
};

export default function GameScreen(props: GameScreenProps) {
  const { navigation, route } = props;
  // Récupération des paramètres avec valeurs par défaut
  const { accessToken: rawAccessToken } = useAuth();
  // Force string pour les appels API
  const accessToken = rawAccessToken || '';
  // Typage robuste pour route.params
  const { gameId, round = 1, category = 'TOP_RECENT' } = (route.params || {}) as { gameId?: number; round?: number; category?: string };
  
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [currentTrack, setCurrentTrack] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [timeLeft, setTimeLeft] = useState(INITIAL_TIME);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [pulseAnim] = useState(new Animated.Value(1));
  const [timerScale] = useState(new Animated.Value(1));
  const [loading, setLoading] = useState(true);
  const [playedTracks, setPlayedTracks] = useState<string[]>([]);
  // Nouveau : cumul des scores par joueur
  const [playerScores, setPlayerScores] = useState<{ [playerId: string]: number }>({
    '1': 0,
    '2': 0,
    '3': 0,
    '4': 0,
  });
  
  const soundRef = useRef<Audio.Sound | null>(null);

  // --- 1. INITIALISATION ET BOUCLE DE JEU ---
  useEffect(() => {
    // Reset played tracks et scores pour nouvelle partie
    if (round === 1) {
      setPlayedTracks([]);
      setPlayerScores({ '1': 0, '2': 0, '3': 0, '4': 0 });
    }

    // Vérification de fin de partie
    if (round > MAX_ROUNDS) {
      // Générer les résultats finaux réels
      const results = MOCK_PLAYERS.map(player => ({
        name: player.name,
        score: playerScores[player.id] || 0,
        avatar: { color: player.color, emoji: player.emoji }
      }));
      navigation.replace('GameOver', { results });
      return;
    }

    Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    });

    if (accessToken) {
      startRound();
    }
    
    return () => { stopSound(); };
  }, [accessToken, gameId, round]);

  const stopSound = async () => {
    if (soundRef.current) {
      try { await soundRef.current.unloadAsync(); } catch (e) {}
      soundRef.current = null;
    }
  };

  // --- 2. LOGIQUE API & ITUNES ---
  // Fonction utilitaire pour trouver un extrait fiable (avec filtrage anti-mauvaises versions)
  const fetchAudioFromItunes = async (title: string, artist: string): Promise<string | null> => {
    try {
      // Nettoyage agressif : enlève les versions spéciales (Remastered, feat, live, etc.)
      const cleanTitle = title
        .replace(/ - .*/, '')
        .replace(/\(.*\)/, '')
        .replace(/feat\..*/i, '')
        .trim();

      const query = encodeURIComponent(`${cleanTitle} ${artist}`);
      // On demande 5 résultats pour pouvoir comparer et trier
      const response = await fetch(`https://itunes.apple.com/search?term=${query}&media=music&entity=song&limit=5`);
      const data = await response.json();

      if (data.resultCount === 0) {
        console.log(`❌ iTunes: Aucune correspondance trouvée pour ${title}`);
        return null;
      }

      // LISTE DES MOTS CLÉS À ÉVITER DANS LE TITRE OU L'ALBUM
      const avoidKeywords = ['live', 'remix', 'cover', 'karaoke', 'instrumental', 'acoustic', 'tribute'];

      // 1. Chercher le meilleur match (le titre le plus "clean")
      const bestMatch = data.results.find((track: any) => {
        const lowerName = track.trackName.toLowerCase();
        const lowerCollection = track.collectionName?.toLowerCase() || '';
        // On vérifie que les mots-clés "à éviter" ne sont PAS présents
        const isClean = !avoidKeywords.some(keyword => lowerName.includes(keyword) || lowerCollection.includes(keyword));
        // On s'assure que l'extrait existe
        return isClean && track.previewUrl;
      });

      // 2. Si un match propre est trouvé, on le retourne immédiatement
      if (bestMatch) {
        console.log(`✅ Extrait trouvé et propre: ${bestMatch.trackName}`);
        return bestMatch.previewUrl;
      }

      // 3. Sinon, on prend le premier qui a un extrait, même s'il n'est pas idéal
      const fallbackTrack = data.results.find((track: any) => track.previewUrl);
      if (fallbackTrack) {
        console.log(`⚠️ Extrait de secours trouvé: ${fallbackTrack.trackName}`);
        return fallbackTrack.previewUrl;
      }

      // Si rien n'a marché
      return null;
    } catch (error) {
      console.error("Erreur dans iTunes Bridge:", error);
      return null;
    }
  };


  // NOUVELLE FONCTION UTILE
  const fetchSpotifyTopTracks = async (accessToken: string, timeRange: 'short_term' | 'medium_term' | 'long_term'): Promise<any[]> => {
    const response = await fetch(`https://api.spotify.com/v1/me/top/tracks?time_range=${timeRange}&limit=50`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await response.json();
    // Ajoute lastPlayed à chaque track (en cherchant dans l'historique récent)
    const recentResp = await fetch('https://api.spotify.com/v1/me/player/recently-played?limit=50', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const recentData = await recentResp.json();
    const lastPlayedMap: { [trackId: string]: string } = {};
    (recentData.items || []).forEach((item: any) => {
      if (item.track && item.played_at) lastPlayedMap[item.track.id] = item.played_at;
    });
    return (data.items || []).map((track: any) => ({
      ...track,
      lastPlayed: lastPlayedMap[track.id] || null
    }));
  };

  const startRound = async () => {
    setLoading(true);
    console.log("🔄 Démarrage de la manche...");
    try {
      let targetTracks: any[] = [];
      // On récupère le Top Récent pour l'utiliser comme liste noire
      const recentTracks = await fetchSpotifyTopTracks(accessToken, 'short_term');
      const recentTrackIds = new Set(recentTracks.map(track => track.id));

      if (category === 'TOP_5Y' || category === '5_ANS_PLUS') {
        // 1. On récupère le "Long Terme"
        const longTermTracks = await fetchSpotifyTopTracks(accessToken, 'long_term');
        // 2. On filtre : On ne garde que les titres du Long Terme qui NE sont PAS dans le Court Terme
        targetTracks = longTermTracks.filter(track => !recentTrackIds.has(track.id));
        if (targetTracks.length === 0) {
          Alert.alert("Pas de chance", "Impossible de trouver de vieux titres qui ne soient pas récents !");
          setLoading(false);
          return;
        }
      } else if (category === 'GUILTY_PLEASURES') {
        // GUILTY PLEASURES : on cherche des titres "atypiques" dans le top (ex: années 80, K-pop, génériques, etc.)
        // Ici, on prend le long_term, puis on filtre sur des mots-clés fun
        const longTermTracks = await fetchSpotifyTopTracks(accessToken, 'long_term');
        const keywords = ['k-pop', 'anime', 'cartoon', 'disney', 'générique', 'opening', 'ending', '80', '90', '2000', 'karaoke', 'kids', 'child', 'enfant', 'tv', 'series', 'soundtrack'];
        targetTracks = longTermTracks.filter(track => {
          const name = (track.name || '').toLowerCase();
          const album = (track.album?.name || '').toLowerCase();
          return keywords.some(k => name.includes(k) || album.includes(k));
        });
        if (targetTracks.length === 0) {
          Alert.alert("Pas de chance", "Aucun plaisir coupable détecté dans ton historique Spotify !");
          setLoading(false);
          return;
        }
      } else if (category === 'SOUNDTRACKS') {
        // SOUNDTRACKS : on utilise une playlist publique de bandes originales (exemple)
        // Ici, on prend une playlist thématique (ex: "Bandes originales de films")
        // Remplace playlistId par une vraie playlist si tu veux personnaliser
        const playlistId = '37i9dQZF1DX7YCknf2jT6s'; // Ex: "Bandes originales de films" (Spotify officiel)
        const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=50`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const data = await response.json();
        targetTracks = (data.items || []).map((item: any) => item.track).filter((track: any) => track && track.preview_url);
        if (targetTracks.length === 0) {
          Alert.alert("Pas de chance", "Aucune bande originale trouvée !");
          setLoading(false);
          return;
        }
      } else if (category === 'FOCUS_ARTIST') {
        // FOCUS ARTIST : on demande à l'utilisateur de choisir un artiste (ici, on prend le top artiste du user)
        // Pour une vraie UX, il faudrait demander le nom de l'artiste dans le lobby
        // Ici, on prend le top artiste du short_term
        const response = await fetch('https://api.spotify.com/v1/me/top/artists?time_range=short_term&limit=1', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const data = await response.json();
        const artistId = data.items && data.items[0]?.id;
        if (!artistId) {
          Alert.alert("Pas de chance", "Impossible de trouver un artiste pour ce focus !");
          setLoading(false);
          return;
        }
        // On récupère les top tracks de cet artiste
        const tracksResp = await fetch(`https://api.spotify.com/v1/artists/${artistId}/top-tracks?market=FR`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const tracksData = await tracksResp.json();
        targetTracks = tracksData.tracks || [];
        if (targetTracks.length === 0) {
          Alert.alert("Pas de chance", "Aucun titre trouvé pour cet artiste !");
          setLoading(false);
          return;
        }
      } else {
        // Par défaut : TOP_RECENT
        targetTracks = recentTracks;
      }

      // ... (le reste du code est inchangé)
      // Au lieu de data.items, tu utilises targetTracks maintenant :
      const shuffledTracks = [...targetTracks].sort(() => 0.5 - Math.random());
      // Filter out already played tracks
      const availableTracks = shuffledTracks.filter(track => !playedTracks.includes(track.id));

      let playableTrack = null;
      // 3. Recherche d’un extrait jouable (limite volontaire)
      const MAX_ATTEMPTS = 10;
      for (let i = 0; i < Math.min(MAX_ATTEMPTS, availableTracks.length); i++) {
        const track = availableTracks[i];
        try {
          const audioUrl = await fetchAudioFromItunes(
            track.name,
            track.artists && track.artists[0]?.name
          );
          if (audioUrl) {
            playableTrack = {
              id: track.id,
              title: track.name,
              artist: track.artists && track.artists[0]?.name,
              album: track.album?.name || '',
              albumImage: (track.album && track.album.images && track.album.images[0]?.url) || '',
              preview_url: audioUrl,
              correctPlayer: 'Moi',
              lastPlayed: track.lastPlayed || null,
            };
            break;
          }
        } catch (itunesError) {
          console.warn('Erreur iTunes sur un titre, on skip');
        }
      }
      // 4. Résultat
      if (!playableTrack) {
        Alert.alert(
          "Pas de chance",
          "Aucun extrait audio trouvé pour cette manche.",
          [{ text: "Suivant", onPress: () => handleSkip() }]
        );
        return;
      }
      console.log("🎵 Titre jouable :", playableTrack.title);
      setCurrentTrack(playableTrack);
      setPlayedTracks(prev => [...prev, playableTrack.id]);
      if (typeof prepareSound === 'function') {
        await prepareSound(playableTrack.preview_url);
      }
    } catch (error) {
      console.error('❌ Erreur critique startRound:', error);
      Alert.alert(
        "Erreur",
        "Session expirée ou problème réseau. Reconnexion requise."
      );
    }

  useEffect(() => {
    if (isPlaying) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 400, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [isPlaying]);

  // --- 4. ACTIONS JOUEUR ---
  // On passe aussi les scores cumulés à Reveal
  const navigateToReveal = (score: number) => {
    navigation.navigate('Reveal', {
      correctPlayer: currentTrack?.correctPlayer || 'Inconnu',
      track: currentTrack,
      score: score,
      // accessToken n'est pas attendu ici, on le retire
      round: round,
      playerScores: playerScores,
      selectedPlayer: selectedPlayer ?? undefined,
    });
  };

  const handleVote = (playerId: string) => {
    if (selectedPlayer) return;
    setSelectedPlayer(playerId);
    stopSound(); 
    setIsPlaying(false);

    const baseScore = 500;
    const timeBonus = timeLeft * 30;
    // On incrémente le score du joueur sélectionné
    setPlayerScores(prev => ({
      ...prev,
      [playerId]: (prev[playerId] || 0) + baseScore + timeBonus
    }));
    navigateToReveal(baseScore + timeBonus);
  };

  const handleSkip = () => {
    stopSound();
    setIsPlaying(false);
    navigateToReveal(0);
  };

  const handleTimeOut = () => {
    stopSound();
    setIsPlaying(false);
    navigateToReveal(0);
  };

  // --- 5. RENDER ---
  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#1DB954" />
        <Text style={styles.loadingText}>Manche {round} / {MAX_ROUNDS}</Text>
        <Text style={styles.loadingSubText}>Recherche d'un extrait...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.roundIndicator}>MANCHE {round} / {MAX_ROUNDS}</Text>
        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipText}>PASSER ⏭️</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.timerContainer}>
        <Animated.Text style={[styles.timer, { transform: [{ scale: timerScale }] }, timeLeft <= 10 && styles.timerDanger]}>
          {timeLeft}
        </Animated.Text>
        <Text style={styles.pointsPreview}>Potentiel: {500 + (timeLeft * 30)} pts</Text>
      </View>

      <View style={styles.visualizerContainer}>
        {[...Array(5)].map((_, i) => (
          <Animated.View key={i} style={[styles.visualizerBar, { transform: [{ scaleY: pulseAnim }], height: 30 + Math.random() * 50 }]} />
        ))}
      </View>

      <View style={styles.playersGrid}>
        {MOCK_PLAYERS.map((player) => (
          <TouchableOpacity key={player.id} style={[styles.playerVote]} onPress={() => handleVote(player.id)} activeOpacity={0.7}>
            <View style={[styles.avatar, { backgroundColor: player.color }]}>
              <Text style={styles.avatarEmoji}>{player.emoji}</Text>
            </View>
            <Text style={styles.playerVoteName}>{player.name}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#191414', alignItems: 'center', paddingTop: 60 },
  header: { width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 20 },
  roundIndicator: { color: '#B3B3B3', fontWeight: '800', fontSize: 14, letterSpacing: 1 },
  skipButton: { backgroundColor: '#282828', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  skipText: { color: '#B3B3B3', fontWeight: '700', fontSize: 12 },
  timerContainer: { alignItems: 'center', marginBottom: 40 },
  timer: { fontSize: 64, fontWeight: '900', color: '#FFFFFF' },
  timerDanger: { color: '#FF6B6B' },
  pointsPreview: { color: '#1DB954', fontSize: 14, fontWeight: '600', marginTop: 5 },
  visualizerContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 100, marginBottom: 40 },
  visualizerBar: { width: 12, backgroundColor: '#1DB954', marginHorizontal: 6, borderRadius: 6 },
  playersGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', width: '100%', gap: 15 },
  playerVote: { width: (width / 2) - 30, backgroundColor: '#282828', paddingVertical: 25, borderRadius: 20, alignItems: 'center', borderWidth: 1, borderColor: '#333', elevation: 8 },
  avatar: { width: 70, height: 70, borderRadius: 35, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  avatarEmoji: { fontSize: 32 },
  playerVoteName: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  loadingText: { marginTop: 20, color: '#1DB954', fontSize: 22, fontWeight: '800' },
  loadingSubText: { color: '#B3B3B3', fontSize: 16, marginTop: 5 }
});

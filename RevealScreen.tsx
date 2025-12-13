import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions, Image, Alert } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../App';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';

type RevealScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Reveal'>;
  route: RouteProp<RootStackParamList, 'Reveal'>;
};

const { width } = Dimensions.get('window');

export default function RevealScreen({ navigation, route }: RevealScreenProps) {
  // On récupère le score, les scores cumulés et le joueur sélectionné
  const { correctPlayer, track, score = 0, round, playerScores = {}, selectedPlayer } = route.params;
  const { accessToken } = useAuth();

  const [scaleAnim] = useState(new Animated.Value(0));
  const [fadeAnim] = useState(new Animated.Value(0));
  const [scoreAnim] = useState(new Animated.Value(0));
  const [addedToLiked, setAddedToLiked] = useState(false);
  const [bgColor, setBgColor] = useState('#191414');
  const [sfxSound, setSfxSound] = useState<Audio.Sound | null>(null);

  useEffect(() => {
    // Charger SFX
    const loadSfx = async () => {
      const soundUrl = score > 0 
        ? 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav' // Succès
        : 'https://www.soundjay.com/misc/sounds/fail-buzzer-01.wav'; // Échec
      const { sound } = await Audio.Sound.createAsync({ uri: soundUrl }, { shouldPlay: false });
      setSfxSound(sound);
      await sound.playAsync(); // Jouer immédiatement
    };
    loadSfx();

    // Haptics
    if (score > 0) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }

    // Couleur de fond fixe (adaptive colors removed for Expo Go compatibility)
    setBgColor('#191414');

    // Séquence d'animation : Apparition infos -> Puis apparition Score
    Animated.sequence([
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, tension: 50, friction: 7, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
      Animated.spring(scoreAnim, { toValue: 1, friction: 4, useNativeDriver: true })
    ]).start();

    return () => {
      if (sfxSound) sfxSound.unloadAsync();
    };
  }, []);

  const handleNextRound = () => {
    // On prépare les nouveaux scores cumulés pour la prochaine manche
    let newScores = { ...playerScores };
    if (selectedPlayer && score > 0) {
      newScores[selectedPlayer] = (newScores[selectedPlayer] || 0) + score;
    }
    navigation.replace('Game', {
      gameId: Date.now(),
      round: round + 1,
      playerScores: newScores
    });
  };

  const handleAddToLiked = async () => {
    if (!track.id) {
      Alert.alert('Erreur', 'ID de piste manquant');
      return;
    }
    try {
      const response = await fetch(`https://api.spotify.com/v1/me/tracks?ids=${track.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });
      if (response.ok) {
        setAddedToLiked(true);
        Alert.alert('Succès', 'Piste ajoutée à vos favoris !');
      } else {
        Alert.alert('Erreur', 'Impossible d\'ajouter la piste');
      }
    } catch (error) {
      Alert.alert('Erreur', 'Erreur réseau');
    }
  };

  return (
    <Animated.View style={[styles.container, { backgroundColor: bgColor }]}>
      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        
        {/* Header Résultat */}
        <View style={styles.resultHeader}>
          <Text style={styles.resultTitle}>C'ÉTAIT</Text>
          <Text style={styles.correctPlayerName}>{correctPlayer.toUpperCase()}</Text>
          
          {/* AFFICHAGE DU SCORE GAGNÉ */}
          <Animated.View style={{ transform: [{ scale: scoreAnim }], opacity: scoreAnim }}>
            {score > 0 ? (
              <Text style={styles.scoreGained}>+{Math.floor(score)} PTS 🚀</Text>
            ) : (
              <Text style={styles.scoreSkipped}>PAS DE POINTS 😢</Text>
            )}
          </Animated.View>
        </View>

        {/* Pochette Album (Vraie Image) */}
        <View style={styles.coverContainer}>
          {track.albumImage ? (
            <Image source={{ uri: track.albumImage }} style={styles.coverImage} />
          ) : (
            <View style={styles.coverPlaceholder}>
              <Ionicons name="musical-notes" color="#1DB954" size={80} />
            </View>
          )}
          {/* Effet Disque Vinyle */}
          <View style={styles.vinylEffect} /> 
        </View>

        {/* Infos Titre */}
        <View style={styles.trackInfo}>
          <Text style={styles.trackTitle}>{track.title}</Text>
          <Text style={styles.trackArtist}>{track.artist}</Text>
          <Text style={styles.albumName}>{track.album}</Text>
        </View>

      </Animated.View>

      {/* Footer Boutons */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.nextButton}
          activeOpacity={0.8}
          onPress={handleNextRound}
        >
          <Text style={styles.nextButtonText}>Manche Suivante</Text>
          <Ionicons name="play-skip-forward" color="#FFFFFF" size={24} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.addButton, addedToLiked && styles.addedButton]}
          activeOpacity={0.8}
          onPress={handleAddToLiked}
          disabled={addedToLiked}
        >
          <Text style={styles.addButtonText}>
            {addedToLiked ? 'Ajouté aux favoris !' : 'Ajouter aux favoris'}
          </Text>
          <Ionicons name={addedToLiked ? "heart" : "heart-outline"} color="#FFFFFF" size={20} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.quitButton}
          onPress={() => navigation.navigate('Lobby')}
        >
          <Text style={styles.quitButtonText}>Arrêter la partie</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 40,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  resultHeader: {
    alignItems: 'center',
    marginBottom: 30,
  },
  resultTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#B3B3B3',
    letterSpacing: 2,
  },
  correctPlayerName: {
    fontSize: 36,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 5,
    textAlign: 'center',
  },
  scoreGained: {
    fontSize: 28,
    fontWeight: '800',
    color: '#F5B041', // Jaune Or pour le score
    marginTop: 10,
    textShadowColor: 'rgba(245, 176, 65, 0.3)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  scoreSkipped: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FF6B6B', // Rouge pour le skip
    marginTop: 10,
  },
  coverContainer: {
    width: width * 0.7,
    height: width * 0.7,
    marginBottom: 30,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 15,
  },
  coverImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  coverPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#282828',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vinylEffect: {
    position: 'absolute',
    zIndex: -1,
    top: 5,
    right: -15,
    bottom: 5,
    width: '100%',
    backgroundColor: '#111',
    borderRadius: 1000, // Rond
    borderWidth: 2,
    borderColor: '#333',
  },
  trackInfo: {
    alignItems: 'center',
    width: '100%',
  },
  trackTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 5,
  },
  trackArtist: {
    fontSize: 18,
    color: '#1DB954', // Vert Spotify
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 5,
  },
  albumName: {
    fontSize: 14,
    color: '#B3B3B3',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  footer: {
    paddingHorizontal: 30,
    width: '100%',
  },
  nextButton: {
    backgroundColor: '#1DB954',
    paddingVertical: 16,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },
  nextButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 10,
  },
  quitButton: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  quitButtonText: {
    color: '#B3B3B3',
    fontSize: 14,
    fontWeight: '600',
  },
  addButton: {
    backgroundColor: '#FF6B6B',
    paddingVertical: 12,
    borderRadius: 25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },
  addedButton: {
    backgroundColor: '#1DB954',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
  },
});
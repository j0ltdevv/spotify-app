import React, { useEffect, useState } from 'react';
import { useToast } from '../contexts/ToastContext';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Animated, ScrollView } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../App';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { COLORS, ANIMATION_CONFIG } from '../constants';
import { GameResult } from '../types';
import Logger from '../utils/logger';

type GameOverScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'GameOver'>;
  route: RouteProp<RootStackParamList, 'GameOver'>;
};

const { width, height } = Dimensions.get('window');

export default function GameOverScreen({ navigation, route }: GameOverScreenProps) {
  const { results = [] } = route.params as { results?: GameResult[] };
  const { showToast } = useToast();

  // Vérification de sécurité
  if (!results || results.length === 0) {
    Logger.error('GameOverScreen: Pas de résultats fournis');
    // Rediriger vers le lobby si pas de résultats
    React.useEffect(() => {
      navigation.replace('Lobby', {});
    }, []);
    return null;
  }

  const [fadeAnim] = useState(new Animated.Value(0));
  const [podiumAnims] = useState([
    new Animated.Value(0), // 1er
    new Animated.Value(0), // 2e
    new Animated.Value(0), // 3e
  ]);
  const [listAnim] = useState(new Animated.Value(0));
  const [confettiAnim] = useState(new Animated.Value(0));
  const [rotateAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    // Haptic feedback
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    
    // Log des résultats avec vérification de sécurité
    const sortedResults = [...results].sort((a, b) => (b?.score || 0) - (a?.score || 0));
    const winner = sortedResults[0];
    
    if (winner) {
      Logger.game.end(winner.score || 0);
      Logger.success(`🏆 Gagnant: ${winner.name} avec ${winner.score || 0} points`);
      Logger.info(`Classement final: ${results.length} joueurs`);
      
      // Toast de félicitations après un court délai
      setTimeout(() => {
        showToast(`🏆 ${winner.name} remporte la partie !`, 'success', 3000);
      }, 1500);
    } else {
      Logger.warn('GameOverScreen: Aucun gagnant trouvé');
    }

    // Animation séquencée
    Animated.sequence([
      // 1. Fade in général
      Animated.timing(fadeAnim, { 
        toValue: 1, 
        duration: 500, 
        useNativeDriver: true 
      }),
      // 2. Confettis
      Animated.timing(confettiAnim, { 
        toValue: 1, 
        duration: 800, 
        useNativeDriver: true 
      }),
      // 3. Podium en cascade (2e, 1er, 3e pour l'effet)
      Animated.stagger(200, [
        Animated.spring(podiumAnims[1], { 
          toValue: 1, 
          friction: 8, 
          tension: 40,
          useNativeDriver: true 
        }),
        Animated.spring(podiumAnims[0], { 
          toValue: 1, 
          friction: 8, 
          tension: 40,
          useNativeDriver: true 
        }),
        Animated.spring(podiumAnims[2], { 
          toValue: 1, 
          friction: 8, 
          tension: 40,
          useNativeDriver: true 
        }),
      ]),
      // 4. Liste des autres
      Animated.timing(listAnim, { 
        toValue: 1, 
        duration: 500, 
        useNativeDriver: true 
      }),
    ]).start();

    // Animation de rotation continue du trophée
    Animated.loop(
      Animated.sequence([
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(rotateAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // Trier avec vérification de sécurité
  const sortedResults = [...results].sort((a, b) => (b?.score || 0) - (a?.score || 0));
  const topThree = sortedResults.slice(0, 3).filter(r => r && r.name); // Filtrer les résultats valides
  const others = sortedResults.slice(3).filter(r => r && r.name);

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['-10deg', '10deg'],
  });

  const handleReplay = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Logger.info('Relancer une nouvelle partie');
    Logger.nav('Game', { round: 1, replay: true });
    showToast('Nouvelle partie lancée !', 'info', 2000);
    navigation.replace('Game', { round: 1, gameId: Date.now() });
  };

  const handleBackToMenu = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Logger.info('Retour au lobby');
    Logger.nav('Lobby');
    navigation.navigate('Lobby', {});
  };

  const getPodiumHeight = (position: number) => {
    switch(position) {
      case 0: return 140; // 1er - le plus haut
      case 1: return 105; // 2e
      case 2: return 75;  // 3e
      default: return 70;
    }
  };

  const getMedalColor = (position: number): [string, string] => {
    switch(position) {
      case 0: return ['#1DB954', '#1ed760']; // Vert Spotify pour le 1er
      case 1: return ['#282828', '#404040']; // Gris foncé pour le 2e
      case 2: return ['#535353', '#6a6a6a']; // Gris clair pour le 3e
      default: return ['#282828', '#1a1a1a'];
    }
  };

  const renderPodiumPlayer = (player: any, position: number, arrayIndex: number) => {
    const medals = ['🥇', '🥈', '🥉'];
    const heights = [140, 105, 75];
    
    return (
      <Animated.View
        key={position}
        style={[
          styles.podiumSlot,
          {
            opacity: podiumAnims[arrayIndex],
            transform: [
              {
                translateY: podiumAnims[arrayIndex].interpolate({
                  inputRange: [0, 1],
                  outputRange: [100, 0],
                }),
              },
              {
                scale: podiumAnims[arrayIndex].interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.5, 1],
                }),
              },
            ],
          },
        ]}
      >
        {/* Avatar */}
        <View style={[
          styles.podiumAvatar, 
          { 
            backgroundColor: player.avatar.color,
            borderColor: position === 0 ? COLORS.SPOTIFY_GREEN : COLORS.TEXT_PRIMARY
          }
        ]}>
          <Text style={styles.podiumEmoji}>{player.avatar.emoji}</Text>
          <View style={[
            styles.medalBadge,
            { backgroundColor: position === 0 ? COLORS.SPOTIFY_GREEN : 'rgba(0,0,0,0.8)' }
          ]}>
            <Text style={styles.medalIcon}>{medals[position]}</Text>
          </View>
        </View>

        {/* Nom */}
        <Text style={styles.podiumName} numberOfLines={1}>{player.name}</Text>
        
        {/* Score */}
        <View style={styles.scoreContainer}>
          <Text style={styles.podiumScore}>{player.score}</Text>
          <Text style={styles.ptsLabel}>pts</Text>
        </View>

        {/* Piédestal */}
        <LinearGradient
          colors={getMedalColor(position)}
          style={[styles.pedestal, { height: heights[position] }]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        >
          <Text style={styles.pedestalRank}>#{position + 1}</Text>
        </LinearGradient>
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[COLORS.DARK_BG, COLORS.SPOTIFY_GREEN, COLORS.DARK_BG]}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        locations={[0, 0.3, 1]}
      />

      {/* Confettis décoratifs - Thème Spotify */}
      <Animated.View style={[styles.confettiContainer, { opacity: confettiAnim }]}>
        {[...Array(20)].map((_, i) => (
          <Animated.View
            key={i}
            style={[
              styles.confetti,
              {
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 30}%`,
                backgroundColor: [COLORS.SPOTIFY_GREEN, COLORS.SPOTIFY_GREEN_LIGHT, COLORS.TEXT_PRIMARY, COLORS.DARK_BG][i % 4],
                transform: [
                  {
                    rotate: confettiAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', `${360 * (i % 2 ? 1 : -1)}deg`],
                    }),
                  },
                ],
              },
            ]}
          />
        ))}
      </Animated.View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header avec trophée - Thème Spotify */}
        <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
          <Animated.View style={{ transform: [{ rotate: rotation }] }}>
            <Ionicons name="trophy" size={50} color={COLORS.SPOTIFY_GREEN} />
          </Animated.View>
          <Text style={styles.title}>CLASSEMENT FINAL</Text>
          <Text style={styles.subtitle}>Bravo à tous les joueurs !</Text>
        </Animated.View>

        {/* Podium - Ordre: 2e, 1er, 3e pour effet visuel */}
        <View style={styles.podiumContainer}>
          {topThree.length > 1 && renderPodiumPlayer(topThree[1], 1, 1)}
          {topThree.length > 0 && renderPodiumPlayer(topThree[0], 0, 0)}
          {topThree.length > 2 && renderPodiumPlayer(topThree[2], 2, 2)}
        </View>

        {/* Autres joueurs */}
        {others.length > 0 && (
          <Animated.View style={[styles.othersList, { opacity: listAnim }]}>
            <Text style={styles.othersTitle}>AUTRES JOUEURS</Text>
            {others.map((player, index) => (
              <View key={index} style={styles.otherPlayerRow}>
                <Text style={styles.otherRank}>#{index + 4}</Text>
                <View style={[styles.otherAvatar, { backgroundColor: player.avatar.color }]}>
                  <Text style={styles.otherEmoji}>{player.avatar.emoji}</Text>
                </View>
                <View style={styles.otherInfo}>
                  <Text style={styles.otherName}>{player.name}</Text>
                  <Text style={styles.otherScore}>{player.score} pts</Text>
                </View>
              </View>
            ))}
          </Animated.View>
        )}

        {/* Boutons d'action */}
        <Animated.View style={[styles.actions, { opacity: fadeAnim }]}>
          <TouchableOpacity 
            style={styles.replayButton} 
            onPress={handleReplay}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={[COLORS.SPOTIFY_GREEN, COLORS.SPOTIFY_GREEN_LIGHT]}
              style={styles.buttonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Ionicons name="refresh" size={20} color={COLORS.TEXT_PRIMARY} />
              <Text style={styles.buttonText}>REJOUER</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.menuButton} 
            onPress={handleBackToMenu}
            activeOpacity={0.8}
          >
            <View style={styles.menuButtonInner}>
              <Ionicons name="home" size={20} color={COLORS.TEXT_PRIMARY} />
              <Text style={styles.buttonText}>MENU</Text>
            </View>
          </TouchableOpacity>
        </Animated.View>

        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  confettiContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
    pointerEvents: 'none',
  },
  confetti: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  header: {
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 12,
    letterSpacing: 1.5,
    textShadowColor: 'rgba(29, 185, 84, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  subtitle: {
    fontSize: 14,
    color: '#B3B3B3',
    marginTop: 6,
    fontWeight: '600',
  },
  podiumContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 20,
    gap: 12,
  },
  podiumSlot: {
    alignItems: 'center',
    flex: 1,
  },
  podiumAvatar: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 3,
    borderColor: COLORS.TEXT_PRIMARY,
  },
  podiumEmoji: {
    fontSize: 32,
  },
  medalBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: 13,
    width: 26,
    height: 26,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.TEXT_PRIMARY,
  },
  medalIcon: {
    fontSize: 14,
  },
  podiumName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 4,
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 6,
  },
  podiumScore: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1DB954',
  },
  ptsLabel: {
    fontSize: 11,
    color: '#FFFFFF',
    marginLeft: 2,
    fontWeight: '600',
  },
  pedestal: {
    width: '100%',
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  pedestalRank: {
    fontSize: 28,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.95)',
    textShadowColor: 'rgba(0, 0, 0, 0.7)',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 5,
  },
  othersList: {
    paddingHorizontal: 20,
    marginTop: 16,
  },
  othersTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#B3B3B3',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: 1,
  },
  otherPlayerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(40, 40, 40, 0.9)',
    padding: 12,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(29, 185, 84, 0.2)',
  },
  otherRank: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFFFF',
    width: 36,
    textAlign: 'center',
  },
  otherAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  otherEmoji: {
    fontSize: 20,
  },
  otherInfo: {
    flex: 1,
  },
  otherName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  otherScore: {
    fontSize: 13,
    color: '#1DB954',
    fontWeight: '600',
    marginTop: 2,
  },
  actions: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  replayButton: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 12,
  },
  buttonGradient: {
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  menuButton: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(40, 40, 40, 0.8)',
    borderWidth: 2,
    borderColor: '#1DB954',
  },
  menuButtonInner: {
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 1,
  },
});
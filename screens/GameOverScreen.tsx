import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Animated, ScrollView, StatusBar, Platform, Image } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur'; // Optionnel pour effet verre, sinon View simple

import { useToast } from '../contexts/ToastContext';
import { useGame } from '../contexts/GameContext';
import { useAuth } from '../contexts/AuthContext';
import { RootStackParamList } from '../App';
import { COLORS } from '../constants';
import { GameResult } from '../types';
import Logger from '../utils/logger';

const { width, height } = Dimensions.get('window');
const PODIUM_WIDTH = width * 0.9; // 90% de la largeur
const SLOT_WIDTH = PODIUM_WIDTH / 3; // 3 colonnes exactes

type GameOverScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'GameOver'>;
  route: RouteProp<RootStackParamList, 'GameOver'>;
};

// --- COMPOSANT PODIUM ITEM (Design Épuré Amélioré) ---
const PodiumItem = ({ player, rank, animValue }: { player: GameResult; rank: number; animValue: Animated.Value }) => {
  const isWinner = rank === 0;
  
  // Config visuelle selon le rang
  const config = useMemo(() => {
    switch(rank) {
      case 0: return { height: 160, medal: '🥇', scale: 1.1, color: ['#1DB954', '#1ed760'] };
      case 1: return { height: 110, medal: '🥈', scale: 0.9, color: ['#3E3E3E', '#505050'] };
      case 2: return { height: 80,  medal: '🥉', scale: 0.8, color: ['#2A2A2A', '#333333'] };
      default: return { height: 50, medal: '', scale: 1, color: ['#000', '#000'] };
    }
  }, [rank]);

  return (
    <Animated.View style={[
      styles.podiumSlot,
      {
        opacity: animValue,
        transform: [
          { translateY: animValue.interpolate({ inputRange: [0, 1], outputRange: [150, 0] }) },
        ],
      }
    ]}>
      {/* Avatar & Info Container */}
      <View style={[styles.avatarContainer, { transform: [{ scale: config.scale }] }]}>
        <View style={[styles.avatarCircle, { backgroundColor: player.avatar.color, borderColor: isWinner ? '#1DB954' : 'transparent', borderWidth: isWinner ? 3 : 0 }]}>
          {player.avatar.image ? (
            <Image source={{ uri: player.avatar.image }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarEmoji}>{player.avatar.emoji}</Text>
          )}
          {/* Le rankBadge a été retiré ici */}
        </View>
        <Text style={styles.playerName} numberOfLines={1}>{player.name}</Text>
        <Text style={[styles.playerScore, { color: isWinner ? '#1DB954' : '#FFF' }]}>{player.score} pts</Text>
      </View>

      {/* Barre du Podium (MODIFIÉE) */}
      <LinearGradient
        colors={config.color as any}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[styles.podiumBar, { height: config.height }]}
      >
        {/* NOUVEAU : Rang en très grand et semi-transparent */}
        <Text style={styles.pedestalRankLarge}>#{rank + 1}</Text>
        {/* L'icône de médaille reste en haut */}
        <Text style={styles.medalIcon}>{config.medal}</Text>
      </LinearGradient>
    </Animated.View>
  );
};

export default function GameOverScreen({ navigation, route }: GameOverScreenProps) {
  const { results = [] } = route.params || {};
  const { showToast } = useToast();
  const { isHost, startNewGame, category, players, status, returnToLobby } = useGame();
  const { firebaseUser } = useAuth();

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const podiumAnims = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];
  const listAnim = useRef(new Animated.Value(0)).current;

  // Re-direction automatique si la partie redémarre (pour les invités)
  useEffect(() => {
    if (status === 'playing') {
      navigation.replace('Game', { 
        round: 1, 
        gameId: Date.now(), 
        category: category || 'TOP_RECENT'
      });
    } else if (status === 'READY') {
      // Si l'hôte a réinitialisé la partie pour revenir au lobby
      navigation.navigate('Lobby', {});
    }
  }, [status, navigation, category]);

  // Data processing
  const { topThree, others, winner } = useMemo(() => {
    if (!results || !results.length) return { topThree: [], others: [], winner: null };
    const sorted = [...results].sort((a, b) => (b?.score || 0) - (a?.score || 0));
    return { winner: sorted[0], topThree: sorted.slice(0, 3), others: sorted.slice(3) };
  }, [results]);

  useEffect(() => {
    if (!results || !results.length) {
      navigation.navigate('Lobby', {});
      return;
    }

    // Sequence d'animation
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.stagger(150, [
        Animated.spring(podiumAnims[1], { toValue: 1, damping: 12, useNativeDriver: true }), // 2nd
        Animated.spring(podiumAnims[0], { toValue: 1, damping: 12, useNativeDriver: true }), // 1er
        Animated.spring(podiumAnims[2], { toValue: 1, damping: 12, useNativeDriver: true }), // 3eme
      ]),
      Animated.timing(listAnim, { toValue: 1, duration: 500, useNativeDriver: true })
    ]).start();

  }, []);

  const handleReplay = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isHost) {
      startNewGame(category || 'TOP_RECENT');
    } else {
      showToast("Seul l'hôte peut relancer la partie", "info");
    }
  };

  const handleMenu = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isHost) {
      await returnToLobby();
    } else {
      navigation.navigate('Lobby', {});
    }
  };

  if (!results.length) return null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Background Gradient plus subtil */}
      <LinearGradient
        colors={['#191414', '#1DB954', '#191414']}
        style={[StyleSheet.absoluteFill, { opacity: 0.6 }]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        locations={[0, 0.4, 0.9]}
      />

      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
      >
        {/* Header Centré */}
        <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
          <Text style={styles.title}>RÉSULTATS</Text>
          <Text style={styles.subtitle}>La partie est terminée</Text>
        </Animated.View>

        {/* Podium Centré */}
        <View style={styles.podiumWrapper}>
          <View style={styles.podiumContainer}>
            {/* Ordre visuel : 2, 1, 3 */}
            {topThree[1] && <PodiumItem player={topThree[1]} rank={1} animValue={podiumAnims[1]} />}
            {topThree[0] && <PodiumItem player={topThree[0]} rank={0} animValue={podiumAnims[0]} />}
            {topThree[2] && <PodiumItem player={topThree[2]} rank={2} animValue={podiumAnims[2]} />}
          </View>
        </View>

        {/* Liste des autres joueurs (Glassmorphism style) */}
        {others.length > 0 && (
          <Animated.View style={[styles.listContainer, { opacity: listAnim, transform: [{ translateY: listAnim.interpolate({ inputRange: [0, 1], outputRange: [50, 0] }) }] }]}>
            <Text style={styles.listHeader}>CLASSEMENT SUIVANT</Text>
            {others.map((player, index) => (
              <View key={index} style={styles.listItem}>
                <Text style={styles.listRank}>#{index + 4}</Text>
                <View style={[styles.listAvatar, { backgroundColor: player.avatar.color }]}>
                  {!!player.avatar.image ? (
                    <Image source={{ uri: player.avatar.image }} style={styles.avatarImageSmall} />
                  ) : (
                    <Text style={{ fontSize: 16 }}>{player.avatar.emoji}</Text>
                  )}
                </View>
                <Text style={styles.listName} numberOfLines={1}>{player.name}</Text>
                <Text style={styles.listScore}>{player.score} pts</Text>
              </View>
            ))}
          </Animated.View>
        )}
        
        {/* Espace pour les boutons flottants */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Boutons Flottants en bas (Fixed) */}
      <Animated.View style={[styles.bottomControls, { opacity: fadeAnim }]}>
        <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={handleMenu}>
          <Ionicons name="home" size={20} color="#FFF" />
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={handleReplay}>
          <Text style={styles.btnText}>REJOUER</Text>
          <Ionicons name="refresh" size={20} color="#000" />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  scrollContent: {
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 40,
    alignItems: 'center', // Vital pour le centrage global
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFF',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 5,
  },
  
  // --- PODIUM STYLES ---
  podiumWrapper: {
    width: '100%',
    alignItems: 'center', // Assure que le bloc podium est centré dans l'écran
    marginBottom: 30,
  },
  podiumContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center', // Colle les barres au centre
    width: PODIUM_WIDTH,
    height: 300, // Hauteur fixe pour éviter les sauts
  },
  podiumSlot: {
    width: SLOT_WIDTH, // Largeur fixe : 1/3 de l'espace alloué
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 10,
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
    overflow: 'hidden', // Pour l'image
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarEmoji: {
    fontSize: 28,
  },
  rankBadge: {
    position: 'absolute',
    bottom: -5,
    backgroundColor: '#FFF',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#000',
  },
  playerName: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
    width: '100%',
  },
  playerScore: {
    fontWeight: '900',
    fontSize: 14,
    marginTop: 2,
  },
  podiumBar: {
    width: '90%', // Laisse un petit espace entre les barres
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 10,
    // AJOUTÉ: Permet de placer le rang en absolu
    position: 'relative', 
    overflow: 'hidden', 
  },
  medalIcon: {
    fontSize: 20,
    zIndex: 2, // S'assure que la médaille est au-dessus du grand nombre
  },
  // NOUVEAU STYLE
  pedestalRankLarge: {
    position: 'absolute',
    fontSize: 80, // Très grand !
    fontWeight: '900',
    color: 'rgba(255,255,255,0.1)', // Semi-transparent
    top: '30%', 
    zIndex: 1, // Sous le medalIcon
  },

  // --- LISTE STYLES ---
  listContainer: {
    width: width * 0.9,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    padding: 20,
  },
  listHeader: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.3)',
    padding: 12,
    borderRadius: 12,
  },
  listRank: {
    color: '#FFF',
    fontWeight: 'bold',
    width: 30,
    fontSize: 14,
  },
  listAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  avatarImageSmall: {
    width: '100%',
    height: '100%',
  },
  listName: {
    flex: 1,
    color: '#FFF',
    fontWeight: '600',
    fontSize: 15,
  },
  listScore: {
    color: '#1DB954',
    fontWeight: 'bold',
    fontSize: 15,
  },

  // --- BUTTONS STYLES ---
  bottomControls: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 15,
  },
  btn: {
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  btnSecondary: {
    width: 56, // Bouton rond pour Menu
    backgroundColor: '#333',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  btnPrimary: {
    flex: 1, // Prend le reste de la place
    backgroundColor: '#1DB954',
  },
  btnText: {
    color: '#000',
    fontWeight: '900',
    fontSize: 16,
    marginRight: 8,
    letterSpacing: 0.5,
  },
});
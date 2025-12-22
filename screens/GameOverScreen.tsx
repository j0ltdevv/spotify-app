import React, { useEffect, useState, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, TouchableOpacity, Animated, Dimensions, Platform, StatusBar } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../App';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import { useToast } from '../contexts/ToastContext';
import { useSettings } from '../contexts/SettingsContext';

const { width } = Dimensions.get('window');
const PODIUM_WIDTH = width * 0.9;
const SLOT_WIDTH = PODIUM_WIDTH / 3;

type GameOverScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'GameOver'>;
  route: RouteProp<RootStackParamList, 'GameOver'>;
};

const PodiumItem = ({ player, rank, animValue }: { player: any, rank: number, animValue: Animated.Value }) => {
  // 0 = 1st, 1 = 2nd, 2 = 3rd
  const height = rank === 0 ? 180 : rank === 1 ? 130 : 100;
  const color = rank === 0 ? '#FFD700' : rank === 1 ? '#C0C0C0' : '#CD7F32'; // Gold, Silver, Bronze
  const rankLabel = rank + 1;

  return (
    <Animated.View style={[styles.podiumSlot, { transform: [{ translateY: animValue.interpolate({ inputRange: [0, 1], outputRange: [300, 0] }) }] }]}>
      <View style={styles.avatarContainer}>
        <View style={[styles.avatarCircle, { borderColor: color, borderWidth: 3 }]}>
           {player.avatar.image ? (
             <Image source={{ uri: player.avatar.image }} style={styles.avatarImage} />
           ) : (
             <Text style={styles.avatarEmoji}>{player.avatar.emoji}</Text>
           )}
        </View>
        <Text style={styles.playerName} numberOfLines={1}>{player.name}</Text>
        <Text style={[styles.playerScore, { color }]}>{player.score}</Text>
      </View>
      <LinearGradient
        colors={[color, '#333']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[styles.podiumBar, { height }]}
      >
        <Text style={styles.pedestalRankLarge}>{rankLabel}</Text>
        <Ionicons name="ribbon" style={[styles.medalIcon, { color: '#FFF' }]} />
      </LinearGradient>
    </Animated.View>
  );
};

export default function GameOverScreen({ navigation, route }: GameOverScreenProps) {
  const { results = [] } = route.params || {};
  const { showToast } = useToast();
  const { isHost, startNewGame, category, players, status, returnToLobby } = useGame();
  const { firebaseUser } = useAuth();
  const { t } = useSettings(); 

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const listAnim = useRef(new Animated.Value(0)).current;
  const podiumAnims = useRef([new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]).current;

  // Data processing
  const { topThree, others, winner } = useMemo(() => {
    if (!results || !results.length) return { topThree: [], others: [], winner: null };
    const sorted = [...results].sort((a, b) => (b?.score || 0) - (a?.score || 0));
    return { winner: sorted[0], topThree: sorted.slice(0, 3), others: sorted.slice(3) };
  }, [results]);

  useEffect(() => {
    // 🚨 IMPORTANT : On coupe tout lien avec la partie précédente
    // Cela évite que le GameContext ne tente de relancer une manche ou un timer
    if (status !== 'finished') {
        // Force le statut 'finished' si ce n'est pas déjà fait
        // (Note: updateDoc est asynchrone, mais l'effet est immédiat pour l'utilisateur qui est déjà sur GameOver)
    }
    
    // On pourrait aussi appeler leaveGame() ici si on voulait forcer une déconnexion totale de la room
    // mais on veut garder les joueurs ensemble pour le "Rejouer".
    // Donc on s'assure juste que le GameScreen ne tourne plus.
  }, []);

  useEffect(() => {
    if (!results || !results.length) {
      navigation.navigate('Lobby', {});
      return;
    }

    // Sequence d'animation
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.stagger(200, [
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
      showToast(t('only_host_start'), "info");
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
          <Text style={styles.title}>{t('results')}</Text>
          <Text style={styles.subtitle}>{t('game_over_subtitle')}</Text>
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
        {others.length > 0 ? (
          <Animated.View style={[styles.listContainer, { opacity: listAnim, transform: [{ translateY: listAnim.interpolate({ inputRange: [0, 1], outputRange: [50, 0] }) }] }]}>
            <Text style={styles.listHeader}>{t('next_ranking')}</Text>
            {others.map((player, index) => (
              <View key={index} style={styles.listItem}>
                <Text style={styles.listRank}>#{index + 4}</Text>
                <View style={[styles.listAvatar, { backgroundColor: player.avatar.color }]}>{!!player.avatar.image ? (<Image source={{ uri: player.avatar.image }} style={styles.avatarImageSmall} />) : (<Text style={{ fontSize: 16 }}>{player.avatar.emoji}</Text>)}</View>
                <Text style={styles.listName} numberOfLines={1}>{player.name}</Text>
                <Text style={styles.listScore}>{player.score} {t('points_short')}</Text>
              </View>
            ))}
          </Animated.View>
        ) : null}
        
        {/* Espace pour les boutons flottants */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Boutons Flottants en bas (Fixed) */}
      <Animated.View style={[styles.bottomControls, { opacity: fadeAnim }]}>
        <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={handleMenu}>
          <Ionicons name="home" size={20} color="#FFF" />
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={handleReplay}>
          <Text style={styles.btnText}>{t('replay')}</Text>
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
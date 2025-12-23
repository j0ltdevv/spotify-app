import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, Animated, ScrollView, StatusBar, Platform, Image, TouchableOpacity } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { useToast } from '../contexts/ToastContext';
import { useGame } from '../contexts/GameContext';
import { useAuth } from '../contexts/AuthContext';
import { useSettings } from '../contexts/SettingsContext';
import { RootStackParamList } from '../App';
import { GameResult } from '../types';
import { COLORS } from '../constants';

const { width } = Dimensions.get('window');
const PODIUM_WIDTH = width * 0.9;
const SLOT_WIDTH = PODIUM_WIDTH / 3;

type GameOverScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'GameOver'>;
  route: RouteProp<RootStackParamList, 'GameOver'>;
};

// --- COMPOSANT PODIUM ITEM ---
const PodiumItem = ({ player, rank, animValue, t }: { player: any; rank: number; animValue: Animated.Value; t: any }) => {
  const isWinner = rank === 0;
  
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
      <View style={[styles.avatarContainer, { transform: [{ scale: config.scale }] }]}>
        <View style={[styles.avatarCircle, { backgroundColor: player.avatar.color, borderColor: isWinner ? '#1DB954' : 'transparent', borderWidth: isWinner ? 3 : 0 }]}>
          {player.avatar.image ? (
            <Image source={{ uri: player.avatar.image }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarEmoji}>{player.avatar.emoji}</Text>
          )}
        </View>
        <Text style={styles.playerName} numberOfLines={1}>{player.name}</Text>
        <Text style={[styles.playerScore, { color: isWinner ? '#1DB954' : '#FFF' }]}>{player.score} {t('points_short')}</Text>
      </View>

      <LinearGradient
        colors={config.color as any}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[styles.podiumBar, { height: config.height }]}
      >
        <Text style={styles.pedestalRankLarge}>#{rank + 1}</Text>
        <Text style={styles.medalIcon}>{config.medal}</Text>
      </LinearGradient>
    </Animated.View>
  );
};

export default function GameOverScreen({ navigation, route }: GameOverScreenProps) {
  const { results = [] } = route.params || {};
  const { showToast } = useToast();
  const { isHost, startNewGame, category, status, returnToLobby, gameId: contextGameId } = useGame();
  const { t } = useSettings();
  
  // 🛑 FIX CRITIQUE : On mémorise l'ID de la partie qui vient de se terminer
  const finishedGameId = useRef(contextGameId);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const podiumAnims = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];
  const listAnim = useRef(new Animated.Value(0)).current;

  // --- LOGIQUE DE REDIRECTION BLINDÉE ---
  useEffect(() => {
    if (status === 'playing' && contextGameId !== finishedGameId.current) {
      // console.log("🎮 [GameOver] Nouvelle partie détectée ! Redirection...");
      navigation.replace('Game', { 
        round: 1, 
        gameId: contextGameId || Date.now(), 
        category: category || 'TOP_RECENT'
      });
    } else if (status === 'READY') {
      navigation.navigate('Lobby', {});
    }
  }, [status, contextGameId, navigation, category]);

  // Data processing
  const { topThree, others } = useMemo(() => {
    if (!results || !results.length) return { topThree: [], others: [] };
    const sorted = [...results].sort((a, b) => (b?.score || 0) - (a?.score || 0));
    return { topThree: sorted.slice(0, 3), others: sorted.slice(3) };
  }, [results]);

  useEffect(() => {
    if (!results || !results.length) {
      navigation.navigate('Lobby', {});
      return;
    }

    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.stagger(150, [
        Animated.spring(podiumAnims[1], { toValue: 1, damping: 12, useNativeDriver: true }),
        Animated.spring(podiumAnims[0], { toValue: 1, damping: 12, useNativeDriver: true }),
        Animated.spring(podiumAnims[2], { toValue: 1, damping: 12, useNativeDriver: true }),
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
        <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
          <Text style={styles.title}>{t('results')}</Text>
          <Text style={styles.subtitle}>{t('game_over_subtitle')}</Text>
        </Animated.View>

        <View style={styles.podiumWrapper}>
          <View style={styles.podiumContainer}>
            {topThree[1] && <PodiumItem player={topThree[1]} rank={1} animValue={podiumAnims[1]} t={t} />}
            {topThree[0] && <PodiumItem player={topThree[0]} rank={0} animValue={podiumAnims[0]} t={t} />}
            {topThree[2] && <PodiumItem player={topThree[2]} rank={2} animValue={podiumAnims[2]} t={t} />}
          </View>
        </View>

        {others.length > 0 && (
          <Animated.View style={[styles.listContainer, { opacity: listAnim, transform: [{ translateY: listAnim.interpolate({ inputRange: [0, 1], outputRange: [50, 0] }) }] }]}>
            <Text style={styles.listHeader}>{t('next_ranking')}</Text>
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
                <Text style={styles.listScore}>{player.score} {t('points_short')}</Text>
              </View>
            ))}
          </Animated.View>
        )}
        
        <View style={{ height: 100 }} />
      </ScrollView>

      <Animated.View style={[styles.bottomControls, { opacity: fadeAnim }]}>
        <TouchableOpacity style={[styles.btn, styles.btnSecondary]} onPress={handleMenu}>
          <Ionicons name="home" size={20} color="#FFF" />
        </TouchableOpacity>
        
        {isHost && (
            <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={handleReplay}>
            <Text style={styles.btnText}>{t('replay')}</Text>
            <Ionicons name="refresh" size={20} color="#000" />
            </TouchableOpacity>
        )}
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
    alignItems: 'center',
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
  podiumWrapper: {
    width: '100%',
    alignItems: 'center',
    marginBottom: 30,
  },
  podiumContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    width: PODIUM_WIDTH,
    height: 300,
  },
  podiumSlot: {
    width: SLOT_WIDTH,
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
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarEmoji: {
    fontSize: 28,
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
    width: '90%',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 10,
    position: 'relative', 
    overflow: 'hidden', 
  },
  medalIcon: {
    fontSize: 20,
    zIndex: 2,
  },
  pedestalRankLarge: {
    position: 'absolute',
    fontSize: 80,
    fontWeight: '900',
    color: 'rgba(255,255,255,0.1)',
    top: '30%', 
    zIndex: 1,
  },
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
    width: 56,
    backgroundColor: '#333',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  btnPrimary: {
    flex: 1,
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
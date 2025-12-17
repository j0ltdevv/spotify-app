import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext'; // Added useGame
import { useToast } from '../contexts/ToastContext';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Dimensions, Image, Animated, Alert, ActivityIndicator } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../App';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { CATEGORIES, COLORS, GAME_MODES } from '../constants';
import SafeContainer from '../components/SafeContainer';
import UserService from '../services/UserService';
import MusicService from '../services/MusicService'; // Added
import { Player, Category } from '../types';
import GlassCard from '../components/GlassCard';
import PressableCard from '../components/PressableCard';
import Logger from '../utils/logger';

type LobbyScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Lobby'>;
  route: RouteProp<RootStackParamList, 'Lobby'>;
};

const { width } = Dimensions.get('window');

export default function LobbyScreen({ navigation, route }: LobbyScreenProps) {
  const { accessToken, logout, firebaseUser } = useAuth();
  // Using real multiplayer data
  const { players, roomCode, isHost, leaveGame, status, startNewGame, addToTrackPool } = useGame(); 
  
  const { showToast } = useToast();
  const scrollViewRef = useRef<ScrollView>(null);
  
  const [selectedCategory, setSelectedCategory] = useState<string>(CATEGORIES[0].key);
  const [selectedGameMode, setSelectedGameMode] = useState<string>(GAME_MODES[0].key); // Mode de jeu (Normal par défaut)
  // Remove isAdmin state, use isHost from context
  const [isLoadingProfile, setIsLoadingProfile] = useState(false); // No longer needed as much
  const [isSharingTracks, setIsSharingTracks] = useState(false); // Pour éviter le spam

  // Deezer Import Check
  const deezerTracks = route.params?.tracks;
  const playlistName = route.params?.playlistName;

  // --- AUTO-SHARING MUSIC ---
  // Dès qu'on arrive ou change de catégorie, on partage nos musiques si c'est pertinent
  useEffect(() => {
      const shareUserTracks = async () => {
          // On ne partage que si on est loggé et que c'est une catégorie "Top" (pas une playlist fixe)
          // Et seulement si on a un token Spotify
          if (!accessToken || !selectedCategory.startsWith('TOP_') || isSharingTracks) return;

          try {
              setIsSharingTracks(true);
              console.log(`🎵 Préparation des musiques pour le pot commun (${selectedCategory})...`);
              
              // 1. Récupérer mes tracks
              const tracks = await MusicService.fetchTracksByCategory({
                  accessToken,
                  category: selectedCategory,
                  limit: 20 // On en prend 20 chacun
              });

              if (tracks.length > 0) {
                  // 2. Les envoyer au pot commun
                  await addToTrackPool(tracks);
                  console.log("📤 Musiques partagées avec succès !");
                  // Feedback visuel discret (optionnel)
              }
          } catch (error) {
              console.error("Erreur partage musique:", error);
          } finally {
              setIsSharingTracks(false);
          }
      };

      // Petit délai pour laisser le temps à la connexion de se stabiliser
      const timer = setTimeout(() => {
          shareUserTracks();
      }, 1000);

      return () => clearTimeout(timer);
  }, [selectedCategory, accessToken]); // Re-run si on change de catégorie

  // Effect to navigate when game starts
  useEffect(() => {
    if (status === 'playing') {
        // Récupérer le nombre de manches selon le mode sélectionné
        const selectedMode = GAME_MODES.find(mode => mode.key === selectedGameMode);
        const maxRounds = selectedMode ? selectedMode.rounds : 10;
        
        Logger.nav('Game', { round: 1, category: selectedCategory, maxRounds });
        navigation.navigate('Game', { 
            round: 1, 
            gameId: Date.now(), 
            category: selectedCategory,
            tracks: deezerTracks,
            maxRounds 
        });
    }
  }, [status, navigation, selectedCategory, deezerTracks]); // Removed selectedGameMode from dependencies

  // Fonction pour retirer un joueur (admin uniquement)
  const removePlayer = (playerId: string, playerName: string) => {
    if (isHost && players.length > 1) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      Alert.alert(
        'Retirer le joueur',
        `Voulez-vous retirer ${playerName} de la partie ?`,
        [
          {
            text: 'Annuler',
            style: 'cancel',
            onPress: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
          },
          {
            text: 'Retirer',
            style: 'destructive',
            onPress: () => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              // Logic to remove player via context (not yet implemented in leaveGame for others)
              // For now, just local or todo
              showToast("Fonctionnalité d'exclusion à venir", "info");
            },
          },
        ]
      );
    }
  };

  // Fonction pour déconnexion avec confirmation
  const handleLogout = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Quitter',
      'Voulez-vous quitter la partie ?',
      [
        {
          text: 'Annuler',
          style: 'cancel',
          onPress: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
        },
        {
          text: 'Quitter',
          style: 'destructive',
          onPress: async () => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            await leaveGame();
            navigation.navigate('Menu'); // Go back to Menu
          },
        },
      ]
    );
  };

  return (
    <SafeContainer>
      <View style={styles.containerContent}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <Ionicons name="close" color="#FF6B6B" size={24} />
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <View style={styles.headerTitleRow}>
            {isLoadingProfile ? (
              <ActivityIndicator color={COLORS.SPOTIFY_GREEN} size="small" />
            ) : (
              <Ionicons name={deezerTracks ? "radio" : "people"} color={deezerTracks ? "#A238FF" : "#1DB954"} size={28} />
            )}
            <Text style={styles.headerTitle}>{deezerTracks ? "MODE DEEZER" : "SALLE D'ATTENTE"}</Text>
          </View>
          <Text style={styles.headerSubtitle}>
            {/* Show Room Code here subtly */}
            Code: {roomCode} • {players.length} joueurs connectés
          </Text>
        </View>
        
        <View style={styles.headerRight}>
          <TouchableOpacity 
            style={styles.settingsButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              navigation.navigate('Settings');
            }}
            activeOpacity={0.7}
          >
            <Ionicons name="settings-outline" color="#FFFFFF" size={20} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Si Deezer Mode : Pas de choix de catégorie */}
      {!deezerTracks && (
      <View style={styles.categorySection}>
        <View style={styles.categoryHeader}>
          <Ionicons name="grid" color="#1DB954" size={20} />
          <Text style={styles.categoryTitle}>Choisis ta catégorie</Text>
        </View>
        <View style={styles.scrollContainer}>
          <ScrollView 
            ref={scrollViewRef}
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesContainer}
            style={styles.categoriesScroll}
          >
            {CATEGORIES.map((cat: Category, index: number) => {
              const isSelected = selectedCategory === cat.key;
              return (
                <TouchableOpacity
                  key={cat.key}
                  style={styles.categoryCard}
                  onPress={() => {
                    if (!isHost) return; // Only host can change category
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedCategory(cat.key);
                  }}
                  activeOpacity={0.9}
                >
                  {isSelected ? (
                    <LinearGradient
                      colors={cat.gradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.categoryCardGradient}
                    >
                      <View style={styles.categoryContent}>
                        <View style={styles.categoryIconContainer}>
                          <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
                        </View>
                        <Text style={styles.categoryLabelSelected}>{cat.label}</Text>
                        <Text style={styles.categoryDescriptionSelected}>{cat.description}</Text>
                        <View style={styles.selectedIndicator}>
                          <Ionicons name="checkmark-circle" color="#FFFFFF" size={14} />
                        </View>
                      </View>
                    </LinearGradient>
                  ) : (
                    <View style={styles.categoryCardDefault}>
                      <View style={styles.categoryContent}>
                        <View style={[styles.categoryIconContainer, { backgroundColor: '#282828' }]}>
                          <Text style={styles.categoryEmoji}>{cat.emoji}</Text>
                        </View>
                        <Text style={styles.categoryLabelDefault}>{cat.label}</Text>
                        <Text style={styles.categoryDescriptionDefault}>{cat.description}</Text>
                      </View>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
        
        {/* Indicateur de pagination */}
        <View style={styles.paginationDots}>
          {CATEGORIES.map((_, index) => (
            <View
              key={index}
              style={[
                styles.paginationDot,
                selectedCategory === CATEGORIES[index].key && styles.paginationDotActive,
              ]}
            />
          ))}
        </View>
      </View>
      )}

      {/* Section des sous-modes pour le mode Aléatoire */}
      {!deezerTracks && selectedCategory === 'LIKED_SHUFFLE' && (
      <View style={styles.gameModeSection}>
        <View style={styles.categoryHeader}>
          <Ionicons name="game-controller" color="#A78BFA" size={20} />
          <Text style={styles.categoryTitle}>Durée de la partie</Text>
        </View>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.gameModesContainer}
        >
          {GAME_MODES.map((mode) => {
            const isSelected = selectedGameMode === mode.key;
            return (
              <TouchableOpacity
                key={mode.key}
                style={styles.gameModeCard}
                onPress={() => {
                  if (!isHost) return; // Only host can change mode
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setSelectedGameMode(mode.key);
                }}
                activeOpacity={0.9}
              >
                {isSelected ? (
                  <LinearGradient
                    colors={mode.gradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.gameModeCardGradient}
                  >
                    <Text style={styles.gameModeEmoji}>{mode.emoji}</Text>
                    <Text style={styles.gameModeLabelSelected}>{mode.label}</Text>
                    <Text style={styles.gameModeDescriptionSelected}>{mode.description}</Text>
                    <View style={styles.selectedIndicator}>
                      <Ionicons name="checkmark-circle" color="#FFFFFF" size={12} />
                    </View>
                  </LinearGradient>
                ) : (
                  <View style={styles.gameModeCardDefault}>
                    <Text style={styles.gameModeEmoji}>{mode.emoji}</Text>
                    <Text style={styles.gameModeLabelDefault}>{mode.label}</Text>
                    <Text style={styles.gameModeDescriptionDefault}>{mode.description}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
      )}

      {/* Players List avec glassmorphism */}
      <ScrollView style={styles.playersList} contentContainerStyle={styles.playersContent}>
        <View style={styles.playersHeader}>
          <Text style={styles.playersHeaderText}>Joueurs</Text>
          {isHost && (
            <View style={styles.adminBadge}>
              <Ionicons name="shield-checkmark" color="#FFD700" size={14} />
              <Text style={styles.adminBadgeText}>Admin</Text>
            </View>
          )}
        </View>
        
        {players.map((player: Player, index: number) => (
          <View key={player.id} style={styles.playerCardWrapper}>
            <PressableCard
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              style={styles.playerCard}
            >
              <GlassCard style={styles.playerCardGlass} intensity={25}>
                <View style={styles.playerCardContent}>
                  <View style={styles.playerInfo}>
                    <View style={[styles.avatar, { backgroundColor: player.color }]}>
                      {player.image ? (
                        <Image source={{ uri: player.image }} style={styles.avatarImage} />
                      ) : (
                        <Text style={styles.avatarEmoji}>{player.emoji}</Text>
                      )}
                      {/* Cercle animé autour de l'avatar */}
                      <View style={[styles.avatarBorder, { borderColor: player.color }]} />
                    </View>
                    <View style={styles.playerDetails}>
                      <View style={styles.playerNameRow}>
                        <Text style={styles.playerName}>{player.name}</Text>
                        {/* Identify Host based on first player or logic? Logic: Host is index 0 in creation usually, but let's assume we can't easily know who is host visually without a flag in Player object. Assuming index 0 is host for list */}
                        {index === 0 && (
                          <View style={styles.hostBadge}>
                            <Text style={styles.hostBadgeText}>Hôte</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.statusContainer}>
                        <View style={styles.statusDot} />
                        <Text style={styles.playerStatus}>Prêt</Text>
                      </View>
                    </View>
                  </View>
                  <View style={styles.playerActions}>
                    {isHost && player.id !== firebaseUser?.uid && (
                      <TouchableOpacity
                        style={styles.removePlayerButton}
                        onPress={() => removePlayer(player.id, player.name)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="close-circle" color="#FF6B6B" size={22} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </GlassCard>
            </PressableCard>
          </View>
        ))}
      </ScrollView>

      {/* Bouton d'action */}
      <View style={styles.footer}>
        <PressableCard
          onPress={() => {
            if (!isHost) {
                showToast("Seul l'hôte peut lancer la partie", "info");
                return;
            }
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            // Start game via context
            startNewGame(selectedCategory);
          }}
          style={{ width: '100%' }}
        >
          <LinearGradient
            colors={!isHost ? ['#555', '#444'] : (deezerTracks ? ['#A238FF', '#B560FF'] : [COLORS.SPOTIFY_GREEN, COLORS.SPOTIFY_GREEN_LIGHT])}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.startButton}
          >
            {isHost ? (
                <>
                    <Ionicons name="play" color="#FFFFFF" size={28} />
                    <Text style={styles.startButtonText}>{deezerTracks ? "Lancer la Playlist" : "Lancer la partie"}</Text>
                </>
            ) : (
                <>
                    <ActivityIndicator color="white" style={{marginRight: 10}} />
                    <Text style={styles.startButtonText}>En attente de l'hôte...</Text>
                </>
            )}
            
            <View style={styles.playerCountBadge}>
              <Text style={styles.playerCountText}>{players.length}</Text>
            </View>
          </LinearGradient>
        </PressableCard>
      </View>
      </View>
    </SafeContainer>
  );
}

const styles = StyleSheet.create({
  containerContent: {
    flex: 1,
  },
  header: {
    paddingTop: 16,
    paddingBottom: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  logoutButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.3)',
    marginTop: 2,
  },
  settingsButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    marginTop: 2,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRight: {
    width: 36,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: COLORS.TEXT_PRIMARY,
    letterSpacing: 0.5,
    lineHeight: 22,
  },
  headerSubtitle: {
    fontSize: 12,
    color: COLORS.TEXT_SECONDARY,
    marginTop: 3,
    fontWeight: '600',
  },
  playersList: {
    flex: 1,
  },
  playersContent: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  playersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  playersHeaderText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.3)',
  },
  adminBadgeText: {
    color: '#FFD700',
    fontSize: 10,
    fontWeight: '700',
  },
  playerCardWrapper: {
    marginBottom: 8,
  },
  playerCard: {
    borderRadius: 16,
  },
  playerCardGlass: {
    borderRadius: 16,
  },
  playerCardContent: {
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  playerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  avatarBorder: {
    position: 'absolute',
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 2,
    opacity: 0.5,
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarEmoji: {
    fontSize: 22,
  },
  playerDetails: {
    marginLeft: 10,
    flex: 1,
  },
  playerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  playerName: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.TEXT_PRIMARY,
  },
  hostBadge: {
    backgroundColor: 'rgba(29, 185, 84, 0.2)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(29, 185, 84, 0.4)',
  },
  hostBadgeText: {
    color: COLORS.SPOTIFY_GREEN,
    fontSize: 9,
    fontWeight: '700',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    gap: 5,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: COLORS.SPOTIFY_GREEN,
    shadowColor: COLORS.SPOTIFY_GREEN,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  playerStatus: {
    fontSize: 12,
    color: COLORS.SPOTIFY_GREEN,
    fontWeight: '600',
  },
  playerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  removePlayerButton: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.3)',
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 12,
  },
  startButton: {
    paddingVertical: 16,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    shadowColor: COLORS.SPOTIFY_GREEN,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  startButtonText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  playerCountBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  playerCountText: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 14,
    fontWeight: '900',
  },
  categorySection: {
    marginBottom: 12,
    paddingHorizontal: 20,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 6,
  },
  categoryTitle: {
    color: COLORS.TEXT_PRIMARY,
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0.5,
  },
  paginationDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
    marginTop: 10,
  },
  paginationDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: COLORS.DARK_TERTIARY,
  },
  paginationDotActive: {
    backgroundColor: COLORS.SPOTIFY_GREEN,
    width: 18,
  },
  // Styles pour les modes de jeu
  gameModeSection: {
    marginBottom: 12,
    paddingHorizontal: 20,
  },
  gameModesContainer: {
    paddingHorizontal: 20,
    gap: 8,
  },
  gameModeCard: {
    width: 100,
    height: 100,
    marginRight: 8,
  },
  gameModeCardGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#A78BFA',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  gameModeCardDefault: {
    width: '100%',
    height: '100%',
    backgroundColor: COLORS.DARK_SECONDARY,
    borderRadius: 12,
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  gameModeEmoji: {
    fontSize: 28,
    marginBottom: 4,
  },
  gameModeLabelSelected: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 2,
  },
  gameModeDescriptionSelected: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 10,
    textAlign: 'center',
    fontWeight: '600',
  },
  gameModeLabelDefault: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 2,
  },
  gameModeDescriptionDefault: {
    color: COLORS.TEXT_MUTED,
    fontSize: 10,
    textAlign: 'center',
    fontWeight: '500',
  },
  scrollContainer: {
    position: 'relative',
  },
  categoriesScroll: {
    marginHorizontal: -20,
  },
  categoriesContainer: {
    paddingHorizontal: 20,
    gap: 8,
  },
  categoryCard: {
    width: 135,
    height: 155,
    marginRight: 8,
  },
  categoryCardGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 14,
    padding: 10,
    shadowColor: '#1DB954',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  categoryCardDefault: {
    width: '100%',
    height: '100%',
    backgroundColor: COLORS.DARK_SECONDARY,
    borderRadius: 14,
    padding: 10,
    borderWidth: 2,
    borderColor: COLORS.DARK_TERTIARY,
  },
  categoryContent: {
    flex: 1,
    justifyContent: 'space-between',
  },
  categoryIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryEmoji: {
    fontSize: 24,
  },
  categoryLabelSelected: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 2,
    letterSpacing: 0.3,
  },
  categoryLabelDefault: {
    color: COLORS.TEXT_PRIMARY,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 2,
  },
  categoryDescriptionSelected: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: 9,
    fontWeight: '500',
    lineHeight: 12,
  },
  categoryDescriptionDefault: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 9,
    fontWeight: '500',
    lineHeight: 12,
  },
  selectedIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 10,
    padding: 3,
  },
});

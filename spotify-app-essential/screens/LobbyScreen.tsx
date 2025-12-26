import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import { useToast } from '../contexts/ToastContext';
import { useSettings } from '../contexts/SettingsContext';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Dimensions, Image, Alert, ActivityIndicator, Platform } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../App';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { CATEGORIES, COLORS, GAME_MODES } from '../constants';
import SafeContainer from '../components/SafeContainer';
import MusicService from '../services/MusicService';
import SoundManager from '../utils/SoundManager';
import { Player, Category, SpotifyTrack } from '../types';
import GlassCard from '../components/GlassCard';
import PressableCard from '../components/PressableCard';
import Logger from '../utils/logger';

type LobbyScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Lobby'>;
  route: RouteProp<RootStackParamList, 'Lobby'>;
};

const { width } = Dimensions.get('window');

export default function LobbyScreen({ navigation, route }: LobbyScreenProps) {
  const { accessToken, firebaseUser } = useAuth();
  const { 
    players, roomCode, isHost, leaveGame, status, startNewGame, 
    addToTrackPool, addBot, setup, markSetupAsComplete,
    trackPool, setGamePlaylist, kickPlayer, setGameCategory, category 
  } = useGame();  
  
  const { t } = useSettings();
  
  const [selectedCategory, setSelectedCategory] = useState<string>(CATEGORIES[0].key);
  const [activeCategoryIndex, setActiveCategoryIndex] = useState(0);
  const [selectedGameMode, setSelectedGameMode] = useState<string>(GAME_MODES[0].key);
  const [isSharingTracks, setIsSharingTracks] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  // Sync local selection with global game category (for guests)
  useEffect(() => {
    if (category && category !== selectedCategory) {
      setSelectedCategory(category);
    }
  }, [category]);

  const onScroll = (event: any) => {
    const slideSize = event.nativeEvent.layoutMeasurement.width;
    const contentOffset = event.nativeEvent.contentOffset.x;
    const index = Math.floor(contentOffset / (125 + 10)); // Adjust based on card width
    setActiveCategoryIndex(index);
  };
  
  const deezerTracks = route.params?.tracks;

  // Effect to share user's music when room is joined or category changes
  useEffect(() => {
    const shareUserTracks = async () => {
      // Allow sharing as long as game hasn't started (status is waiting or READY)
      if (status !== 'waiting' && status !== 'READY') return;

      const isUserMusicCategory = selectedCategory.startsWith('TOP_') || selectedCategory === 'LIKED_SHUFFLE';
      
      // ✅ FIX: Allow ALL players to contribute, not just host
      if (!accessToken || !isUserMusicCategory || !firebaseUser || !roomCode) return;
      
      // Prevent duplicates: Check if I already have tracks in the pool
      // Note: We check if ANY track in the pool belongs to me. 
      // Since changing category clears the pool, this works perfectly to trigger re-fetch.
      const hasContributed = trackPool.some(t => t.correctPlayer === firebaseUser.uid);
      if (hasContributed || isSharingTracks) return;

      try {
        setIsSharingTracks(true);
        console.log(`🎵 [${isHost ? t('host_badge') : t('guest')}] ${t('preparation_music')} (${selectedCategory})...`);
        
        const tracks = await MusicService.fetchTracksByCategory({ accessToken, category: selectedCategory, limit: 20 });

        if (tracks.length > 0) {
          const taggedTracks: SpotifyTrack[] = tracks.map(t => ({ ...t, correctPlayer: firebaseUser.uid }));
          await addToTrackPool(taggedTracks);
          
          if (isHost) {
             markSetupAsComplete(); 
          }
        } else {
          showToast(t('no_music_found'), "info");
        }
      } catch (error) {
        console.error(t('music_share_error'), error);
        showToast(t('error_playlist'), "error");
      } finally {
        setIsSharingTracks(false);
      }
    };

    shareUserTracks();
  }, [selectedCategory, roomCode, accessToken, firebaseUser, isHost, addToTrackPool, markSetupAsComplete, trackPool, status]);

  useEffect(() => {
    if (status === 'playing') {
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
    } else if (status === 'waiting') {
      setIsStarting(false);
    }
  }, [status, navigation, selectedCategory, deezerTracks, selectedGameMode]);

  const handleLogout = () => {
    Alert.alert(t('quit'), t('quit_lobby_confirm'),
      [{ text: t('cancel'), style: 'cancel' }, { text: t('quit'), style: 'destructive', onPress: async () => {
          await leaveGame();
          navigation.navigate('Menu');
      }}]
    );
  };
  
  const handleStartGame = async () => {
    if (!isHost) {
      showToast(t('only_host_start'), "info");
      return;
    }
    if (status !== 'READY') {
      showToast(t('preparation_music'), "info");
      return;
    }

    // Keep app alive in background
    SoundManager.playSilence();

    try {
      setIsStarting(true);
      
      const selectedMode = GAME_MODES.find(mode => mode.key === selectedGameMode);
      const roundsNeeded = selectedMode ? selectedMode.rounds : 10;
      
      const verifiedPlaylist = await MusicService.generateVerifiedPlaylist(trackPool, roundsNeeded);
      
      if (verifiedPlaylist.length < roundsNeeded) {
        if (verifiedPlaylist.length === 0) {
            showToast(t('no_playable_track'), "error");
            setIsStarting(false);
            return;
        }
      }
      
      setGamePlaylist(verifiedPlaylist);
      startNewGame(selectedCategory);
    } catch (error) {
      console.error(t('launch_error'), error);
      showToast(t('error_playlist'), "error");
      setIsStarting(false);
    }
  };

  const getButtonContent = () => {
    if (isStarting) {
        return (
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <ActivityIndicator color="white" style={{marginRight: 10}} />
            <Text style={styles.startButtonText}>{t('launching')}</Text>
          </View>
        );
    }
    if (!isHost) {
      return (
        <View style={{flexDirection: 'row', alignItems: 'center'}}>
          <ActivityIndicator color="white" style={{marginRight: 10}} />
          <Text style={styles.startButtonText}>{t('waiting_host')}</Text>
        </View>
      );
    }
    switch (status) {
      case 'waiting':
        return (
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <ActivityIndicator color="white" style={{marginRight: 10}} />
            <Text style={styles.startButtonText}>{t('preparing')}</Text>
          </View>
        );
      default:
        return (
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <Ionicons name="play" color="#FFFFFF" size={28} style={{marginRight: 10}} />
            <Text style={styles.startButtonText}>{t('start_game')}</Text>
          </View>
        );
    }
  };

  return (
    <SafeContainer>
      <View style={styles.containerContent}>
        <View style={styles.header}>
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.7}>
              <Ionicons name="close" color="#FF6B6B" size={24} />
            </TouchableOpacity>
            <View style={styles.headerCenter}>
                <View style={styles.headerTitleRow}>
                  <Ionicons name={deezerTracks ? "radio" : "people"} color={deezerTracks ? "#A238FF" : "#1DB954"} size={28} />
                  <Text style={styles.headerTitle}>{deezerTracks ? t('mode_deezer') : t('waiting_room')}</Text>
                </View>
                <Text style={styles.headerSubtitle}>{players.length} {t('players_connected')}</Text>
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity style={styles.settingsButton} onPress={() => navigation.navigate('Settings')} activeOpacity={0.7}>
                <Ionicons name="settings-outline" color="#FFFFFF" size={20} />
              </TouchableOpacity>
            </View>
        </View>

        {/* 🎫 CARTE CODE GÉANTE */}
        <View style={styles.codeCardContainer}>
            <GlassCard style={styles.codeCard}>
                <Text style={styles.codeLabel}>{t('code_label').toUpperCase()}</Text>
                <TouchableOpacity 
                    activeOpacity={0.8} 
                    onPress={() => {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        showToast(t('code_copied') || "Code copié !", "success");
                    }}
                >
                    <Text style={styles.hugeCodeText}>{roomCode}</Text>
                </TouchableOpacity>
                <View style={styles.copyHint}>
                    <Ionicons name="copy-outline" size={12} color={COLORS.SPOTIFY_GREEN} />
                    <Text style={styles.copyHintText}>{t('tap_to_copy') || "Appuyez pour copier"}</Text>
                </View>
            </GlassCard>
        </View>

        {!deezerTracks ? (
            <View style={styles.categorySection}>
                <View style={styles.categoryHeader}>
                  <Ionicons name="grid" color="#1DB954" size={16} />
                  <Text style={styles.categoryTitle}>{t('choose_category')}</Text>
                </View>
                <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false} 
                    style={styles.categoriesScroll} 
                    contentContainerStyle={styles.categoriesContainer}
                    onScroll={onScroll}
                    scrollEventThrottle={16}
                    decelerationRate="fast"
                    snapToInterval={135} // Card width + gap
                >
                    {CATEGORIES.map((cat) => {
                        const isSelected = selectedCategory === cat.key;
                        return (
                            <PressableCard 
                                key={cat.key} 
                                onPress={() => {
                                    if (isHost) {
                                        setGameCategory(cat.key);
                                        setSelectedCategory(cat.key); // Optimistic update
                                    }
                                }} 
                                style={styles.categoryCard}
                            >
                                {isSelected ? (
                                    <LinearGradient colors={cat.gradient} start={{x: 0, y: 0}} end={{x: 1, y: 1}} style={styles.categoryCardGradient}>
                                        <View style={styles.selectedIndicator}><Ionicons name="checkmark" size={10} color="white" /></View>
                                        <View style={styles.categoryIconContainer}><Text style={styles.categoryEmoji}>{cat.emoji}</Text></View>
                                        <View style={styles.categoryContent}>
                                            <View>
                                              <Text style={styles.categoryLabelSelected}>{t(('cat_' + cat.key + '_label') as any)}</Text>
                                            </View>
                                        </View>
                                    </LinearGradient>
                                ) : (
                                    <View style={styles.categoryCardDefault}>
                                        <View style={[styles.categoryIconContainer, { backgroundColor: 'transparent' }]}><Text style={[styles.categoryEmoji, {opacity: 0.7}]}>{cat.emoji}</Text></View>
                                        <View style={styles.categoryContent}>
                                            <View>
                                              <Text style={styles.categoryLabelDefault}>{t(('cat_' + cat.key + '_label') as any)}</Text>
                                            </View>
                                        </View>
                                    </View>
                                )}
                            </PressableCard>
                        );
                    })}
                </ScrollView>
                <View style={styles.paginationDots}>
                    {CATEGORIES.map((_, index) => (
                        <View
                        key={index}
                        style={[styles.paginationDot, activeCategoryIndex === index && styles.paginationDotActive]}
                        />
                    ))}
                </View>
            </View>
        ) : null}

        {selectedCategory === 'LIKED_SHUFFLE' && !deezerTracks ? (
            <View style={styles.gameModeSection}>
                <View style={styles.categoryHeader}>
                  <Ionicons name="timer-outline" color="#A78BFA" size={16} />
                  <Text style={styles.categoryTitle}>{t('game_duration')}</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gameModesContainer}>
                    {GAME_MODES.map((mode) => {
                        const isSelected = selectedGameMode === mode.key;
                        return (
                            <PressableCard key={mode.key} onPress={() => setSelectedGameMode(mode.key)} style={styles.gameModeCard}>
                                {isSelected ? (
                                    <LinearGradient colors={mode.gradient} start={{x: 0, y: 0}} end={{x: 1, y: 1}} style={styles.gameModeCardGradient}>
                                        <View style={styles.selectedIndicator}><Ionicons name="checkmark" size={10} color="white" /></View>
                                        <Text style={styles.gameModeEmoji}>{mode.emoji}</Text>
                                        <View>
                                          <Text style={styles.gameModeLabelSelected}>{t(('mode_' + mode.key + '_label') as any)}</Text>
                                          <Text style={styles.gameModeDescriptionSelected}>{t(('mode_' + mode.key + '_desc') as any)}</Text>
                                        </View>
                                    </LinearGradient>
                                ) : (
                                    <View style={styles.gameModeCardDefault}>
                                        <Text style={[styles.gameModeEmoji, {opacity: 0.7}]}>{mode.emoji}</Text>
                                        <View>
                                          <Text style={styles.gameModeLabelDefault}>{t(('mode_' + mode.key + '_label') as any)}</Text>
                                          <Text style={styles.gameModeDescriptionDefault}>{t(('mode_' + mode.key + '_desc') as any)}</Text>
                                        </View>
                                    </View>
                                )}
                            </PressableCard>
                        );
                    })}
                </ScrollView>
            </View>
        ) : null}

        <ScrollView style={styles.playersList} contentContainerStyle={styles.playersContent}>
            <View style={styles.playersHeader}>
                <Text style={styles.playersHeaderText}>{t('players_title')}</Text>
                {isHost ? (
                  <TouchableOpacity onPress={addBot} style={styles.adminBadge}>
                    <Ionicons name="add-circle" color="#FFD700" size={14} />
                    <Text style={styles.adminBadgeText}>{t('add_bot')}</Text>
                  </TouchableOpacity>
                ) : null}
            </View>
            {players.map((player: Player) => (
                <View key={player.id} style={styles.playerCardWrapper}>
                    <PressableCard onPress={() => {}} style={styles.playerCard}>
                      <GlassCard style={styles.playerCardGlass}>
                        <View style={styles.playerCardContent}>
                          <View style={styles.playerInfo}>
                            <View style={[styles.avatar, { backgroundColor: player.color }]}>
                              {player.image ? (
                                <Image source={{ uri: player.image }} style={styles.avatarImage} />
                              ) : (
                                <Text style={styles.avatarEmoji}>{player.emoji}</Text>
                              )}
                              <View style={[styles.avatarBorder, { borderColor: player.color }]} />
                            </View>
                            <View style={styles.playerDetails}>
                              <View style={styles.playerNameRow}>
                                <Text style={styles.playerName}>{player.name}</Text>
                                {player.id === setup?.hostId || players[0].id === player.id ? ( // Fallback check for host
                                  <Ionicons name="crown" size={16} color={COLORS.GOLD} style={{ marginLeft: 6 }} />
                                ) : null}
                              </View>
                              <View style={styles.statusContainer}>
                                <View style={styles.statusDot} />
                                <Text style={styles.playerStatus}>{t('ready_status')}</Text>
                              </View>
                            </View>
                          </View>
                          
                          {/* 👢 KICK BUTTON (Host Only) */}
                          {isHost && player.id !== firebaseUser?.uid && (
                            <TouchableOpacity 
                                onPress={() => {
                                    Alert.alert(
                                        t('kick_player') || "Expulser", 
                                        `Voulez-vous vraiment expulser ${player.name} ?`,
                                        [
                                            { text: t('cancel'), style: 'cancel' },
                                            { text: t('kick') || "Oui", style: 'destructive', onPress: () => kickPlayer(player.id) }
                                        ]
                                    );
                                }}
                                style={styles.kickButton}
                            >
                                <Ionicons name="close-circle" size={24} color={COLORS.ERROR_RED} />
                            </TouchableOpacity>
                          )}

                        </View>
                      </GlassCard>
                    </PressableCard>
                </View>
            ))}
        </ScrollView>
        <View style={styles.footer}>
            <PressableCard onPress={handleStartGame} style={{ width: '100%' }}>
                <LinearGradient colors={!isHost || status !== 'READY' ? ['#555', '#444'] : (deezerTracks ? ['#A238FF', '#B560FF'] : [COLORS.SPOTIFY_GREEN, COLORS.SPOTIFY_GREEN_LIGHT])} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.startButton}>
                    {getButtonContent()}
                </LinearGradient>
            </PressableCard>
        </View>
      </View>
    </SafeContainer>
  );
}


const styles = StyleSheet.create({
  containerContent: { flex: 1 },
  header: { paddingTop: 16, paddingBottom: 12, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  logoutButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255, 107, 107, 0.15)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255, 107, 107, 0.3)', marginTop: 2 },
  settingsButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255, 255, 255, 0.1)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.2)', marginTop: 2 },
  headerCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerRight: { width: 36 },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: COLORS.TEXT_PRIMARY, letterSpacing: 0.5, lineHeight: 22 },
  headerSubtitle: { fontSize: 12, color: COLORS.TEXT_SECONDARY, marginTop: 3, fontWeight: '600' },
  
  /* 🎫 Styles de la Carte Code */
  codeCardContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
    alignItems: 'center',
  },
  codeCard: {
    width: '100%',
    paddingVertical: 20,
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'rgba(29, 185, 84, 0.3)', // Bordure subtile verte
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  codeLabel: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 4,
  },
  hugeCodeText: {
    color: COLORS.SPOTIFY_GREEN,
    fontSize: 64,
    fontWeight: '900',
    letterSpacing: 10,
    textShadowColor: 'rgba(29, 185, 84, 0.5)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 15,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', // Style digital
  },
  copyHint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 4,
    opacity: 0.6,
  },
  copyHintText: {
    color: COLORS.SPOTIFY_GREEN,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },

  playersList: { flex: 1, marginBottom: 12 },
  playersContent: { paddingHorizontal: 20, paddingBottom: 8, flexGrow: 1 },
  playersHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingHorizontal: 2 },
  playersHeaderText: { color: COLORS.TEXT_PRIMARY, fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },
  adminBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 215, 0, 0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, gap: 4, borderWidth: 1, borderColor: 'rgba(255, 215, 0, 0.3)' },
  adminBadgeText: { color: '#FFD700', fontSize: 10, fontWeight: '700' },
  kickButton: { padding: 4 },
  playerCardWrapper: { marginBottom: 8 },
  playerCard: { borderRadius: 16 },
  playerCardGlass: { borderRadius: 16 },
  playerCardContent: { padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  playerInfo: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  avatar: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', position: 'relative', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 8 },
  avatarBorder: { position: 'absolute', width: 54, height: 54, borderRadius: 27, borderWidth: 2, opacity: 0.5 },
  avatarImage: { width: 40, height: 40, borderRadius: 20 },
  avatarEmoji: { fontSize: 22 },
  playerDetails: { marginLeft: 10, flex: 1 },
  playerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  playerName: { fontSize: 16, fontWeight: '700', color: COLORS.TEXT_PRIMARY },
  hostBadge: { backgroundColor: 'rgba(29, 185, 84, 0.2)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(29, 185, 84, 0.4)' },
  hostBadgeText: { color: COLORS.SPOTIFY_GREEN, fontSize: 9, fontWeight: '700' },
  statusContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 3, gap: 5 },
  statusDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: COLORS.SPOTIFY_GREEN, shadowColor: COLORS.SPOTIFY_GREEN, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 4 },
  playerStatus: { fontSize: 12, color: COLORS.SPOTIFY_GREEN, fontWeight: '600' },
  playerActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  removePlayerButton: { width: 28, height: 28, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255, 107, 107, 0.15)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255, 107, 107, 0.3)' },
  footer: { paddingHorizontal: 20, paddingBottom: 20, paddingTop: 12 },
  startButton: { paddingVertical: 16, borderRadius: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, shadowColor: COLORS.SPOTIFY_GREEN, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 12 },
  startButtonText: { color: COLORS.TEXT_PRIMARY, fontSize: 18, fontWeight: '900', letterSpacing: 0.5 },
  playerCountBadge: { backgroundColor: 'rgba(255, 255, 255, 0.3)', width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'rgba(255, 255, 255, 0.5)' },
  playerCountText: { color: COLORS.TEXT_PRIMARY, fontSize: 14, fontWeight: '900' },
  categorySection: { marginBottom: 12, paddingHorizontal: 20 },
  categoryHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 6 },
  categoryTitle: { color: COLORS.TEXT_PRIMARY, fontWeight: '800', fontSize: 16, letterSpacing: 0.5 },
  paginationDots: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 10 },
  paginationDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: COLORS.DARK_TERTIARY },
  paginationDotActive: { backgroundColor: COLORS.SPOTIFY_GREEN, width: 18 },
  gameModeSection: { marginBottom: 12, paddingHorizontal: 20 },
  gameModesContainer: { gap: 8 },
  gameModeCard: { width: 125, height: 125 },
  gameModeCardGradient: { width: '100%', height: '100%', borderRadius: 12, padding: 8, alignItems: 'center', justifyContent: 'space-around', shadowColor: '#A78BFA', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  gameModeCardDefault: { width: '100%', height: '100%', backgroundColor: COLORS.DARK_SECONDARY, borderRadius: 12, padding: 8, alignItems: 'center', justifyContent: 'space-around', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)' },
  gameModeEmoji: { fontSize: 26, marginBottom: 4 },
  gameModeLabelSelected: { color: COLORS.TEXT_PRIMARY, fontSize: 12, fontWeight: '800', textAlign: 'center', marginBottom: 2 },
  gameModeDescriptionSelected: { color: 'rgba(255, 255, 255, 0.9)', fontSize: 10, textAlign: 'center', fontWeight: '600' },
  gameModeLabelDefault: { color: COLORS.TEXT_SECONDARY, fontSize: 12, fontWeight: '700', textAlign: 'center', marginBottom: 2 },
  gameModeDescriptionDefault: { color: COLORS.TEXT_MUTED, fontSize: 10, textAlign: 'center', fontWeight: '500' },
  scrollContainer: { position: 'relative' },
  categoriesScroll: {},
  categoriesContainer: { gap: 10, paddingHorizontal: 2 }, // Added padding
  categoryCard: { width: 125, height: 130 },
  categoryCardGradient: { width: '100%', height: '100%', borderRadius: 14, padding: 10, justifyContent: 'center', shadowColor: '#1DB954', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },
  categoryCardDefault: { width: '100%', height: '100%', backgroundColor: COLORS.DARK_SECONDARY, borderRadius: 14, padding: 10, justifyContent: 'center', borderWidth: 2, borderColor: COLORS.DARK_TERTIARY },
  categoryContent: { alignItems: 'center' }, // Centered content
  categoryIconContainer: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255, 255, 255, 0.2)', justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  categoryEmoji: { fontSize: 22 },
  categoryLabelSelected: { color: COLORS.TEXT_PRIMARY, fontSize: 12, fontWeight: '800', letterSpacing: 0.3, textAlign: 'center' },
  categoryLabelDefault: { color: COLORS.TEXT_PRIMARY, fontSize: 12, fontWeight: '700', textAlign: 'center' },
  categoryDescriptionSelected: { display: 'none' }, // Hide description to save space
  categoryDescriptionDefault: { display: 'none' }, // Hide description to save space
  selectedIndicator: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(255, 255, 255, 0.3)', borderRadius: 10, padding: 3 },
});
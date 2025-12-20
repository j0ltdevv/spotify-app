import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import { useToast } from '../contexts/ToastContext';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Dimensions, Image, Alert, ActivityIndicator } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../App';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { CATEGORIES, COLORS, GAME_MODES } from '../constants';
import SafeContainer from '../components/SafeContainer';
import MusicService from '../services/MusicService';
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
  const { players, roomCode, isHost, leaveGame, status, startNewGame, addToTrackPool, addBots, setup, markSetupAsComplete } = useGame(); 
  
  const { showToast } = useToast();
  
  const [selectedCategory, setSelectedCategory] = useState<string>(CATEGORIES[0].key);
  const [selectedGameMode, setSelectedGameMode] = useState<string>(GAME_MODES[0].key);
  const [isSharingTracks, setIsSharingTracks] = useState(false);

  const deezerTracks = route.params?.tracks;

  // Effect to share user's music when room is joined or category changes
  useEffect(() => {
    const shareUserTracks = async () => {
      // Use the backend lock to ensure this runs only once
      if (setup?.tracksPrepared) return;

      const isUserMusicCategory = selectedCategory.startsWith('TOP_') || selectedCategory === 'LIKED_SHUFFLE';
      if (!isHost || !accessToken || !isUserMusicCategory || !firebaseUser || !roomCode) return;
      if (isSharingTracks) return;

      try {
        setIsSharingTracks(true);
        console.log(`🎵 Préparation des musiques pour le pot commun (${selectedCategory})...`);
        
        const tracks = await MusicService.fetchTracksByCategory({ accessToken, category: selectedCategory, limit: 20 });

        if (tracks.length > 0) {
          const taggedTracks: SpotifyTrack[] = tracks.map(t => ({ ...t, correctPlayer: firebaseUser.uid }));
          await addToTrackPool(taggedTracks);
          // Atomically mark setup as complete and game as ready
          markSetupAsComplete();
        } else {
          showToast("Aucune musique trouvée pour cette catégorie.", "info");
          markSetupAsComplete(); // Mark as ready even if no tracks are found to prevent getting stuck
        }
      } catch (error) {
        console.error("Erreur partage musique:", error);
        showToast("Erreur lors de l'ajout de vos musiques.", "error");
      } finally {
        setIsSharingTracks(false);
      }
    };

    shareUserTracks();
  }, [selectedCategory, roomCode, accessToken, firebaseUser, isHost, setup, addToTrackPool, markSetupAsComplete]);

  // Effect to navigate when game starts
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
    }
  }, [status, navigation, selectedCategory, deezerTracks, selectedGameMode]);

  const handleLogout = () => {
    Alert.alert('Quitter', 'Voulez-vous quitter la partie ?',
      [{ text: 'Annuler', style: 'cancel' }, { text: 'Quitter', style: 'destructive', onPress: async () => {
          await leaveGame();
          navigation.navigate('Menu');
      }}]
    );
  };
  
  const handleStartGame = () => {
    if (!isHost) {
      showToast("Seul l'hôte peut lancer la partie", "info");
      return;
    }
    if (status !== 'READY') {
      showToast("Préparation des musiques...", "info");
      return;
    }
    startNewGame(selectedCategory);
  };

  const getButtonContent = () => {
    if (!isHost) {
      return <><ActivityIndicator color="white" style={{marginRight: 10}} /><Text style={styles.startButtonText}>En attente de l'hôte...</Text></>;
    }
    switch (status) {
      case 'waiting':
        return <><ActivityIndicator color="white" style={{marginRight: 10}} /><Text style={styles.startButtonText}>Préparation...</Text></>;
      case 'READY':
        return <><Ionicons name="play" color="#FFFFFF" size={28} /><Text style={styles.startButtonText}>{deezerTracks ? "Lancer la Playlist" : "Lancer la partie"}</Text></>;
      default:
        return <><Ionicons name="play" color="#FFFFFF" size={28} /><Text style={styles.startButtonText}>Lancer la partie</Text></>;
    }
  };

  return (
    <SafeContainer>
      <View style={styles.containerContent}>
        <View style={styles.header}>
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.7}><Ionicons name="close" color="#FF6B6B" size={24} /></TouchableOpacity>
            <View style={styles.headerCenter}>
                <View style={styles.headerTitleRow}><Ionicons name={deezerTracks ? "radio" : "people"} color={deezerTracks ? "#A238FF" : "#1DB954"} size={28} /><Text style={styles.headerTitle}>{deezerTracks ? "MODE DEEZER" : "SALLE D'ATTENTE"}</Text></View>
                <Text style={styles.headerSubtitle}>Code: {roomCode} • {players.length} joueurs connectés</Text>
            </View>
            <View style={styles.headerRight}><TouchableOpacity style={styles.settingsButton} onPress={() => navigation.navigate('Settings')} activeOpacity={0.7}><Ionicons name="settings-outline" color="#FFFFFF" size={20} /></TouchableOpacity></View>
        </View>

        {!deezerTracks && (
            <View style={styles.categorySection}>
                <View style={styles.categoryHeader}><Ionicons name="grid" color="#1DB954" size={16} /><Text style={styles.categoryTitle}>Choisis ta catégorie</Text></View>
                <View style={styles.scrollContainer}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoriesContainer}>
                        {CATEGORIES.map((cat: Category) => {
                            const isSelected = selectedCategory === cat.key;
                            return (<TouchableOpacity key={cat.key} style={styles.categoryCard} onPress={() => { if (isHost) setSelectedCategory(cat.key); }} activeOpacity={0.9}>
                                {isSelected ? (<LinearGradient colors={cat.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.categoryCardGradient}><View style={styles.categoryContent}><View style={styles.categoryIconContainer}><Text style={styles.categoryEmoji}>{cat.emoji}</Text></View><Text style={styles.categoryLabelSelected}>{cat.label}</Text><Text style={styles.categoryDescriptionSelected}>{cat.description}</Text><View style={styles.selectedIndicator}><Ionicons name="checkmark-circle" color="#FFFFFF" size={14} /></View></View></LinearGradient>) : (<View style={styles.categoryCardDefault}><View style={styles.categoryContent}><View style={[styles.categoryIconContainer, { backgroundColor: '#282828' }]}><Text style={styles.categoryEmoji}>{cat.emoji}</Text></View><Text style={styles.categoryLabelDefault}>{cat.label}</Text><Text style={styles.categoryDescriptionDefault}>{cat.description}</Text></View></View>)}
                            </TouchableOpacity>);
                        })}
                    </ScrollView>
                </View>
                <View style={styles.paginationDots}>{CATEGORIES.map((_, index) => (<View key={index} style={[styles.paginationDot, selectedCategory === CATEGORIES[index].key && styles.paginationDotActive]}/>))}</View>
            </View>
        )}
        <ScrollView style={styles.playersList} contentContainerStyle={styles.playersContent}>
            <View style={styles.playersHeader}>
                <Text style={styles.playersHeaderText}>Joueurs</Text>
                {isHost && (<TouchableOpacity onPress={addBots} style={styles.adminBadge}><Ionicons name="add-circle" color="#FFD700" size={14} /><Text style={styles.adminBadgeText}>+ Bots</Text></TouchableOpacity>)}
            </View>
            {players.map((player: Player) => (
                <View key={player.id} style={styles.playerCardWrapper}>
                    <PressableCard onPress={() => {}} style={styles.playerCard}><GlassCard style={styles.playerCardGlass}><View style={styles.playerCardContent}><View style={styles.playerInfo}><View style={[styles.avatar, { backgroundColor: player.color }]}>{player.image ? (<Image source={{ uri: player.image }} style={styles.avatarImage} />) : (<Text style={styles.avatarEmoji}>{player.emoji}</Text>)}<View style={[styles.avatarBorder, { borderColor: player.color }]} /></View><View style={styles.playerDetails}><View style={styles.playerNameRow}><Text style={styles.playerName}>{player.name}</Text>{player.id === isHost && (<View style={styles.hostBadge}><Text style={styles.hostBadgeText}>Hôte</Text></View>)}</View><View style={styles.statusContainer}><View style={styles.statusDot} /><Text style={styles.playerStatus}>Prêt</Text></View></View></View></View></GlassCard></PressableCard>
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
  playersList: { flex: 1, marginBottom: 12 },
  playersContent: { paddingHorizontal: 20, paddingBottom: 8, flexGrow: 1 },
  playersHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingHorizontal: 2 },
  playersHeaderText: { color: COLORS.TEXT_PRIMARY, fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },
  adminBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 215, 0, 0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, gap: 4, borderWidth: 1, borderColor: 'rgba(255, 215, 0, 0.3)' },
  adminBadgeText: { color: '#FFD700', fontSize: 10, fontWeight: '700' },
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
  gameModeCard: { width: 135, height: 155 },
  gameModeCardGradient: { width: '100%', height: '100%', borderRadius: 12, padding: 8, alignItems: 'center', justifyContent: 'space-around', shadowColor: '#A78BFA', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  gameModeCardDefault: { width: '100%', height: '100%', backgroundColor: COLORS.DARK_SECONDARY, borderRadius: 12, padding: 8, alignItems: 'center', justifyContent: 'space-around', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)' },
  gameModeEmoji: { fontSize: 28, marginBottom: 4 },
  gameModeLabelSelected: { color: COLORS.TEXT_PRIMARY, fontSize: 13, fontWeight: '800', textAlign: 'center', marginBottom: 2 },
  gameModeDescriptionSelected: { color: 'rgba(255, 255, 255, 0.9)', fontSize: 10, textAlign: 'center', fontWeight: '600' },
  gameModeLabelDefault: { color: COLORS.TEXT_SECONDARY, fontSize: 13, fontWeight: '700', textAlign: 'center', marginBottom: 2 },
  gameModeDescriptionDefault: { color: COLORS.TEXT_MUTED, fontSize: 10, textAlign: 'center', fontWeight: '500' },
  scrollContainer: { position: 'relative' },
  categoriesScroll: {},
  categoriesContainer: { gap: 8 },
  categoryCard: { width: 135, height: 155 },
  categoryCardGradient: { width: '100%', height: '100%', borderRadius: 14, padding: 10, shadowColor: '#1DB954', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },
  categoryCardDefault: { width: '100%', height: '100%', backgroundColor: COLORS.DARK_SECONDARY, borderRadius: 14, padding: 10, borderWidth: 2, borderColor: COLORS.DARK_TERTIARY },
  categoryContent: { flex: 1, justifyContent: 'space-between' },
  categoryIconContainer: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255, 255, 255, 0.2)', justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  categoryEmoji: { fontSize: 24 },
  categoryLabelSelected: { color: COLORS.TEXT_PRIMARY, fontSize: 13, fontWeight: '800', marginBottom: 2, letterSpacing: 0.3 },
  categoryLabelDefault: { color: COLORS.TEXT_PRIMARY, fontSize: 12, fontWeight: '700', marginBottom: 2 },
  categoryDescriptionSelected: { color: 'rgba(255, 255, 255, 0.9)', fontSize: 9, fontWeight: '500', lineHeight: 12 },
  categoryDescriptionDefault: { color: COLORS.TEXT_SECONDARY, fontSize: 9, fontWeight: '500', lineHeight: 12 },
  selectedIndicator: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(255, 255, 255, 0.3)', borderRadius: 10, padding: 3 },
});
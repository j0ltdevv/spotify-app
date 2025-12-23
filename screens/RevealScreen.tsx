import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext';
import { useToast } from '../contexts/ToastContext';
import { useSettings } from '../contexts/SettingsContext';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions, Image, Alert, ScrollView, PanResponder, ActivityIndicator } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../App';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { COLORS, GAME_CONFIG } from '../constants';
import SafeContainer from '../components/SafeContainer';
import MusicService from '../services/MusicService';
import SoundManager from '../utils/SoundManager';
import { GameTrack, Player, PlayerScores } from '../types';
import Confetti from '../components/Confetti';
import PressableCard from '../components/PressableCard';
import Logger from '../utils/logger';

import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/FirebaseService';

type RevealScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Reveal'>;
  route: RouteProp<RootStackParamList, 'Reveal'>;
};

const { width } = Dimensions.get('window');

export default function RevealScreen({ navigation, route }: RevealScreenProps) {
  const {
    correctPlayer, track, score = 0, round,
    playerScores = {}, previousScores = {},
    selectedPlayer, category, maxRounds = GAME_CONFIG.MAX_ROUNDS
  } = route.params;
  const { players, leaveGame, isHost, activeGameDocId, currentRound, status: gameStatus, nextRound, markPlayerReady, readyPlayers } = useGame();
  const { firebaseUser } = useAuth();
  const { showToast } = useToast();
  const { t } = useSettings();

  const [isReady, setIsReady] = useState(false); // Local UI state

  console.log(`🔍 [REVEAL] Screen MOUNTED/RENDERED. 
  > Round: ${round} 
  > ContextRound: ${currentRound}
  > GameStatus: ${gameStatus}
  > IsHost: ${isHost}
  > ReadyPlayers: ${readyPlayers?.length}/${players.length}`);

  // 🐛 FIX CRITIQUE : Ecouteur passif pour les Invités
  // Si l'hôte force le passage au round suivant, on doit suivre même si on n'a pas cliqué
  useEffect(() => {
    if (gameStatus === 'playing' && currentRound > round) {
        console.log(`🔍 [REVEAL] 🚀 DETECTED NEW ROUND FROM CONTEXT! Navigating automatically...
        > My Local Round: ${round}
        > Context Round: ${currentRound}
        `);
        
        // Nettoyage avant départ
        if (nextRoundTimer.current) clearTimeout(nextRoundTimer.current);
        if (countdownInterval.current) clearInterval(countdownInterval.current);
        SoundManager.stopSound();

        navigation.replace('Game', {
            round: currentRound,
            playerScores,
            category,
            maxRounds
        });
    }
  }, [currentRound, gameStatus, round, navigation]);

  const safeTrack: GameTrack = track || { id: '', title: t('unknown_title'), artist: t('unknown_artist'), album: t('unknown_album'), albumImage: '', preview_url: '', correctPlayer: '?' };       

  const myId = firebaseUser?.uid;
  const isGuessCorrect = myId ? score > 0 : false; 
  const voter = players.find(p => p.id === myId);
  const correctPlayerObj = players.find(p => p.id === safeTrack.correctPlayer);

  const [anims] = useState({
    bgFade: new Animated.Value(0),
    coverScale: new Animated.Value(0.8),
    coverRotate: new Animated.Value(0),
    infoFade: new Animated.Value(0),
    buttonFade: new Animated.Value(0),
    bannerFade: new Animated.Value(0),
    bannerY: new Animated.Value(-100),
  });
  const [showConfetti, setShowConfetti] = useState(isGuessCorrect);
  const [autoNextTime, setAutoNextTime] = useState(8);
  const [bannerVisible, setBannerVisible] = useState(true);
  const bannerTimerRef = useRef<NodeJS.Timeout | null>(null);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy < 0) {
          anims.bannerY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy < -30) {
          dismissBanner();
        } else {
          Animated.spring(anims.bannerY, { toValue: 0, tension: 50, friction: 8, useNativeDriver: true }).start();
        }
      },
    })
  ).current;

  const dismissBanner = () => {
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    Animated.parallel([
      Animated.timing(anims.bannerFade, { toValue: 0, duration: 300, useNativeDriver: true }),
      Animated.timing(anims.bannerY, { toValue: -150, duration: 300, useNativeDriver: true }),
    ]).start(() => setBannerVisible(false));
  };

  const handleQuit = () => {
    Alert.alert(
      t('quit_title'),
      t('quit_game_confirm'),
      [
        { text: t('cancel'), style: "cancel" },
        {
          text: t('quit'),
          style: "destructive",
          onPress: async () => {
            if (nextRoundTimer.current) clearTimeout(nextRoundTimer.current);
            if (countdownInterval.current) clearInterval(countdownInterval.current);
            if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
            await SoundManager.stopSound();
            await leaveGame();
            navigation.navigate('Menu');
          }
        }
      ]
    );
  };

  const nextRoundTimer = useRef<NodeJS.Timeout | null>(null);
  const countdownInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    SoundManager.stopSound();

    if (isGuessCorrect) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }

    Animated.sequence([
      Animated.timing(anims.bgFade, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.parallel([
        Animated.spring(anims.coverScale, { toValue: 1, tension: 40, friction: 7, useNativeDriver: true }),
        Animated.timing(anims.coverRotate, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
      Animated.timing(anims.infoFade, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(anims.buttonFade, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();

    Animated.parallel([
      Animated.timing(anims.bannerFade, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(anims.bannerY, { toValue: 0, tension: 50, friction: 8, useNativeDriver: true }),
    ]).start();

    bannerTimerRef.current = setTimeout(() => {
      dismissBanner();
    }, 3000);

    countdownInterval.current = setInterval(() => {
      setAutoNextTime(prev => {
        if (prev <= 1) {
          if (countdownInterval.current) clearInterval(countdownInterval.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

        // Only set auto timer if HOST. 

        // Logic: If everyone is ready before 10s, Context will trigger nextRound.

        // If not, this timer will FORCE nextRound.

        if (isHost) {

            console.log("🔍 [REVEAL] I am HOST. Scheduling forced next-round in 10s.");

            nextRoundTimer.current = setTimeout(() => {

              console.log("🔍 [REVEAL] ⏰ Time's up! Forcing next round.");

              handleNext(true); // Force execute

            }, 10000);

        } else {

            console.log("🔍 [REVEAL] I am GUEST. Waiting for Host or Unanimity.");

        }

    

        return () => {

          if (nextRoundTimer.current) clearTimeout(nextRoundTimer.current);

          if (countdownInterval.current) clearInterval(countdownInterval.current);

          SoundManager.stopSound();

        };

      }, []);

    

      // force=true means Timer expired

      const handleNext = async (force: boolean = false) => {

        console.log(`🔍 [REVEAL] handleNext triggered! (Force: ${force})`);

        

        // Clear intervals if we are moving

        if (force || round >= maxRounds) {

            if (nextRoundTimer.current) clearTimeout(nextRoundTimer.current);

            if (countdownInterval.current) clearInterval(countdownInterval.current);

        }

    

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        

        // FIN DU JEU (Seul l'hôte décide, ou tout le monde clique et l'hôte relaie)

        if (round >= maxRounds) {

             if (!isHost) {

                showToast(t('waiting_host'), "info");

                return;

             }

             

             console.log("🔍 [REVEAL] Game Finished. Updating Firestore status -> finished");

             if (activeGameDocId) {

                await updateDoc(doc(db, 'games', activeGameDocId), {

                  status: 'finished',

                  isGameActive: false

                });

             }

             const results = players.map(p => ({

                name: p.name,

                score: playerScores[p.id] || 0,

                avatar: { color: p.color, emoji: p.emoji, image: p.image }

             })).sort((a, b) => b.score - a.score);

             navigation.replace('GameOver', { results });

             return;

        }

    

        // ROUND SUIVANT

        if (force) {

            // Le timer a expiré, l'hôte FORCE le passage

            if (isHost && nextRound) {

                console.log("🔍 [REVEAL] ⏰ Forced Next Round.");

                nextRound();

            }

        } else {

            // Clic manuel -> On se met "Prêt"

            console.log("🔍 [REVEAL] Marking myself as ready.");

            setIsReady(true);

            if (markPlayerReady) markPlayerReady();

        }

      };

      

      // Wrapper for manual button press

      const handleNextAction = () => {

          if (isReady) return; // Prevent double click

          console.log(`🔍 [REVEAL] Manual 'Next' button pressed.`);

          handleNext(false);

      };

    

      const coverRotate = anims.coverRotate.interpolate({

        inputRange: [0, 1],

        outputRange: ['-15deg', '0deg'],

      });

    

      const getButtonText = () => {

          if (round >= maxRounds) return t('show_results');

          if (isReady) return `${t('waiting_others')} (${readyPlayers?.length || 0}/${players.length})`;

          return `${t('next_round')} (${autoNextTime}s)`;

      };

    

      return (

        <SafeContainer>

          {isGuessCorrect && <Confetti />}

          <Animated.View style={[styles.container, { opacity: anims.bgFade }]}>

    

            <View style={styles.header}>

              <TouchableOpacity style={styles.quitButton} onPress={handleQuit}>

                <Ionicons name="close" size={24} color="#FF6B6B" />

              </TouchableOpacity>

              <Text style={styles.roundTitle}>{t('round_x_of_y').replace('{0}', String(round)).replace('{1}', String(maxRounds))}</Text>

              <View style={{ width: 40 }} />

            </View>

    

            {bannerVisible && (

              <Animated.View

                {...panResponder.panHandlers}

                style={[

                  styles.resultBannerPopup,

                  {

                    opacity: anims.bannerFade,

                    transform: [{ translateY: anims.bannerY }]

                  }

                ]}

              >

                <LinearGradient

                  colors={isGuessCorrect ? ['#1DB954', '#178F43'] : ['#FF6B6B', '#D64545']}

                  style={styles.resultBanner}

                >

                  <View style={styles.bannerIconContainer}>

                    <Ionicons name={isGuessCorrect ? "checkmark-circle" : "close-circle"} size={36} color="white" />

                  </View>

                  <View style={styles.bannerTextContainer}>

                    <Text style={styles.resultBannerText}>{isGuessCorrect ? t('bravo') : (selectedPlayer ? t('missed') : t('timeout'))}</Text>

                    {isGuessCorrect && <Text style={styles.scoreGained}>+{Math.floor(score)} {t('points_short')}</Text>}

                  </View>

                </LinearGradient>

              </Animated.View>

            )}

    

            <View style={styles.content}>

              <Animated.View style={{ transform: [{ scale: anims.coverScale }, { rotate: coverRotate }] }}>

                {safeTrack.albumImage ? (

                    <Image source={{ uri: safeTrack.albumImage }} style={styles.coverImage} />

                ) : (

                    <View style={[styles.coverImage, { backgroundColor: '#333', justifyContent: 'center', alignItems: 'center' }]}>

                        <Ionicons name="musical-notes" size={60} color="#666" />

                    </View>

                )}

                <View style={[styles.glow, isGuessCorrect ? styles.glowCorrect : styles.glowIncorrect]} />

              </Animated.View>

    

              <Animated.View style={[styles.trackInfo, { opacity: anims.infoFade }]}>

                <Text style={styles.trackTitle} numberOfLines={1}>{safeTrack.title}</Text>

                <Text style={styles.trackArtist}>{safeTrack.artist}</Text>

                <View style={styles.ownerInfo}>

                  <Text style={styles.ownerText}>{t('it_was')} </Text>

                  {correctPlayerObj?.image ? (

                    <Image source={{ uri: correctPlayerObj.image }} style={styles.ownerAvatar} />

                  ) : (

                    <View style={[styles.ownerAvatar, { backgroundColor: correctPlayerObj?.color || '#555', justifyContent: 'center', alignItems: 'center' }]}>

                        <Text style={{ fontSize: 10 }}>{correctPlayerObj?.emoji || '👤'}</Text>

                    </View>

                  )}

                  <Text style={styles.ownerName}>{correctPlayerObj?.name}</Text>

                </View>

              </Animated.View>

            </View>

    

              <View style={styles.scoreboardWrapper}>

                <Text style={styles.scoreboardTitle}>{t('results')}</Text>

                <ScrollView

                  style={styles.scoreboardScroll}

                  showsVerticalScrollIndicator={false}

                  contentContainerStyle={styles.scoreboardContent}

                >

                  {[...players]

                    .sort((a, b) => (playerScores[b.id] || 0) - (playerScores[a.id] || 0))

                    .map((player, index) => {

                      const currentPScore = playerScores[player.id] || 0;

                      const prevPScore = previousScores[player.id] || 0;

                      const hasGainedPoints = currentPScore > prevPScore;

    

                      return (

                        <View key={player.id} style={[styles.scoreRow, hasGainedPoints ? styles.scoreRowCorrect : styles.scoreRowIncorrect]}>

                          <View style={styles.scorePlayerInfo}>

                            <Text style={styles.rankNumber}>#{index + 1}</Text>

                            {!!player.image ? (<Image source={{ uri: player.image }} style={styles.scoreAvatar} />) : (<View style={[styles.scoreAvatar, { backgroundColor: player.color }]}><Text style={{ fontSize: 14 }}>{player.emoji}</Text></View>)}

                            <Text style={styles.scorePlayerName} numberOfLines={1}>{player.name}</Text>

                          </View>

                          <View style={{ alignItems: 'flex-end' }}>

                            <Text style={styles.scoreTotal}>{currentPScore} {t('points_short')}</Text>

                            {hasGainedPoints ? (<Text style={styles.pointsGainedText}>+{currentPScore - prevPScore}</Text>) : null}

                          </View>

                        </View>

                      );

                    })}

                </ScrollView>

              </View>

    

            <Animated.View style={[styles.footer, { opacity: anims.buttonFade }]}>

              <PressableCard onPress={handleNextAction} style={{ width: '100%' }}>

                <LinearGradient 

                    colors={isReady ? ['#444', '#555'] : [COLORS.SPOTIFY_GREEN, COLORS.SPOTIFY_GREEN_LIGHT]} 

                    start={{x:0, y:0}} end={{x:1, y:0}} 

                    style={styles.nextButton}

                >

                  <Text style={[styles.nextButtonText, isReady && { color: '#AAA' }]}>

                    {getButtonText()}

                  </Text>

                  {!isReady && <Ionicons name={round >= maxRounds ? "stats-chart" : "arrow-forward"} color="white" size={24} />}

                  {isReady && <ActivityIndicator size="small" color="#AAA" />}

                </LinearGradient>

              </PressableCard>

            </Animated.View>

          </Animated.View>

        </SafeContainer>

      );

    }

    

    const styles = StyleSheet.create({

      container: { flex: 1, justifyContent: 'space-between' },

      header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 5,
    zIndex: 10,
  },
  quitButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 107, 0.2)',
  },
  roundTitle: {
    color: '#B3B3B3',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  resultBannerPopup: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  resultBanner: {
    margin: 16,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 15,
  },
  bannerIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bannerTextContainer: {
    flex: 1,
  },
  resultBannerText: {
    fontSize: 20,
    fontWeight: '900',
    color: 'white',
    letterSpacing: 0.5,
  },
  scoreGained: {
    fontSize: 16,
    fontWeight: '800',
    color: 'white',
    opacity: 0.9,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingTop: 80,
  },
  coverImage: {
    width: width * 0.45,
    height: width * 0.45,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 15,
  },
  glow: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 20,
    zIndex: -1,
  },
  glowCorrect: {
    shadowColor: COLORS.SPOTIFY_GREEN,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20,
  },
  glowIncorrect: {
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
  },
  trackInfo: {
    alignItems: 'center',
    marginTop: 15,
    paddingHorizontal: 16,
  },
  trackTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: 'white',
    textAlign: 'center',
    marginBottom: 4,
  },
  trackArtist: {
    fontSize: 15,
    fontWeight: '600',
    color: '#B3B3B3',
    textAlign: 'center',
    marginBottom: 8,
  },
  ownerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 15,
  },
  ownerText: {
    color: '#B3B3B3',
    fontSize: 12,
  },
  ownerAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginHorizontal: 6,
  },
  ownerName: {
    color: 'white',
    fontSize: 12,
    fontWeight: '700',
  },
  scoreboardWrapper: {
    flex: 1,
    paddingHorizontal: 20,
    marginTop: 10,
  },
  scoreboardTitle: {
    color: '#B3B3B3',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 8,
    textAlign: 'center',
  },
  scoreboardScroll: {
    flex: 1,
  },
  scoreboardContent: {
    paddingBottom: 10,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderRadius: 12,
    marginBottom: 6,
    borderWidth: 1,
  },
  scoreRowCorrect: {
    backgroundColor: 'rgba(29, 185, 84, 0.1)',
    borderColor: 'rgba(29, 185, 84, 0.3)',
  },
  scoreRowIncorrect: {
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    borderColor: 'rgba(255, 107, 107, 0.3)',
  },
  scorePlayerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rankNumber: {
    color: '#B3B3B3',
    fontSize: 12,
    fontWeight: '900',
    width: 25,
  },
  scoreAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scorePlayerName: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
    maxWidth: width * 0.45,
  },
  scoreTotal: {
    color: 'white',
    fontSize: 14,
    fontWeight: '900',
  },
  pointsGainedText: {
    color: COLORS.SPOTIFY_GREEN,
    fontSize: 10,
    fontWeight: '800',
    marginTop: -2,
  },
  footer: {
    padding: 16,
  },
  nextButton: {
    paddingVertical: 16,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  nextButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '800',
  }
});
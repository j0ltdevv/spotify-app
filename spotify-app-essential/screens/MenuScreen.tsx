import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Animated, Dimensions, Image, Pressable, Keyboard } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { COLORS } from '../constants';
import { useGame } from '../contexts/GameContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useSettings } from '../contexts/SettingsContext';
import GlassCard from '../components/GlassCard';
import PressableCard from '../components/PressableCard';
import SafeContainer from '../components/SafeContainer';
import ProfileModal from '../components/ProfileModal';
import UserService from '../services/UserService';
import { updateProfile } from 'firebase/auth';

type MenuScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Menu'>;
};

const { width } = Dimensions.get('window');

// Styles (kept from the original file, assuming they are correct)
const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#121212' },
    content: { flex: 1, padding: 24, justifyContent: 'space-between', zIndex: 10 },
    heroContainer: { marginTop: Platform.OS === 'ios' ? 10 : 20, marginBottom: 10 },
    heroCard: { padding: 0, borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
    heroGradient: { padding: 16 },
    heroContent: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    heroAvatarContainer: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#282828', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: COLORS.SPOTIFY_GREEN, shadowColor: COLORS.SPOTIFY_GREEN, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 },
    heroAvatarImage: { width: 56, height: 56, borderRadius: 28 },
    heroAvatarEmoji: { fontSize: 28 },
    statusBadge: { position: 'absolute', bottom: 0, right: 0, width: 14, height: 14, borderRadius: 7, backgroundColor: COLORS.SPOTIFY_GREEN, borderWidth: 2, borderColor: '#181818' },
    heroTextContainer: { flex: 1, gap: 4 },
    heroGreeting: { color: 'white', fontSize: 18, fontWeight: '800', letterSpacing: 0.5 },
    rankContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    rankBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, gap: 4 },
    rankText: { fontSize: 10, fontWeight: '800', color: 'black' },
    heroLogoutButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255, 107, 107, 0.1)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255, 107, 107, 0.2)' },
    titleContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    centerLogo: { width: width * 1.7, height: 360 },
    actionCenterer: { justifyContent: 'flex-end', paddingBottom: Platform.OS === 'ios' ? 40 : 20, paddingHorizontal: 20, zIndex: 50, width: '100%' },
    buttonsStack: { gap: 16, width: '100%' },
    actionButton: { paddingVertical: 16, borderRadius: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, shadowColor: COLORS.SPOTIFY_GREEN, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.4, shadowRadius: 16, elevation: 12 },
    actionButtonText: { color: 'white', fontSize: 18, fontWeight: '900', letterSpacing: 0.5 },
    joinContainer: { padding: 24, borderRadius: 20, alignItems: 'center', backgroundColor: '#181818' },
    joinHeader: { flexDirection: 'row', width: '100%', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    backButton: { padding: 8, margin: -8 },
    joinTitle: { fontSize: 17, fontWeight: '700', color: 'white' },
    joinInstructions: { color: '#999', fontSize: 14, marginBottom: 24 },
    codeInputContainer: { flexDirection: 'row', gap: 10, marginBottom: 24, width: '100%', justifyContent: 'center', alignItems: 'center', position: 'relative', height: 64 },
    codeDigitBox: { width: 52, height: 64, borderRadius: 12, backgroundColor: '#222', borderWidth: 1.5, borderColor: '#333', justifyContent: 'center', alignItems: 'center' },
    codeDigitBoxActive: { borderColor: COLORS.SPOTIFY_GREEN, backgroundColor: 'rgba(29, 185, 84, 0.05)' },
    codeDigitBoxFilled: { borderColor: '#555', backgroundColor: '#2a2a2a' },
    codeDigitText: { fontSize: 28, fontWeight: 'bold', color: 'white' },
    hiddenInput: { position: 'absolute', width: '100%', height: '100%', opacity: 0, zIndex: 2, color: 'transparent' },
    validateButton: { width: '100%', backgroundColor: COLORS.SPOTIFY_GREEN, paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
    validateButtonDisabled: { opacity: 0.4, backgroundColor: '#333' },
    validateButtonText: { color: '#000', fontWeight: '800', fontSize: 15, letterSpacing: 0.5 },
    backgroundGradient: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
});

export default function MenuScreen({ navigation }: MenuScreenProps) {
  const { createGame, joinGame, roomCode } = useGame();
  const { logout, firebaseUser } = useAuth();
  const { showToast } = useToast();
  const { t } = useSettings();
  
  const [mode, setMode] = useState<'main' | 'join'>('main');
  const [joinCode, setJoinCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    if (roomCode) {
      navigation.replace('Lobby', {});
    }
  }, [roomCode, navigation]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 40, useNativeDriver: true })
    ]).start();
  }, []);

  useEffect(() => {
    if (mode === 'join') {
        setTimeout(() => { inputRef.current?.focus(); }, 300);
    } else {
        Keyboard.dismiss();
        setJoinCode('');
    }
  }, [mode]);

  const handleCreate = async () => {
    try {
      setIsLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await createGame();
    } catch (error) {
      console.error('Create Game Error:', error);
      showToast(t('creation_error'), "error");
      setIsLoading(false);
    }
  };

  const handleJoin = async () => {
    if (joinCode.length !== 4) return;
    Keyboard.dismiss();
    try {
      setIsLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const success = await joinGame(joinCode);
      if (!success) {
        showToast(t('game_not_found'), "error");
        setIsLoading(false);
      }
    } catch (error) {
        console.error(error);
        showToast(t('connection_error'), "error");
        setIsLoading(false);
    }
  };

  const handleLogout = async () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await logout();
      navigation.replace('Welcome');
  };

  const handleSaveProfile = async (username: string, photoURL: string | null) => {
    if (!firebaseUser) return;
    try {
      await updateProfile(firebaseUser, { displayName: username, photoURL: photoURL });
      await UserService.updateUserProfile(firebaseUser.uid, { display_name: username, images: photoURL ? [{ url: photoURL }] : [] });
      showToast(t('success'), "success");
      setShowProfileModal(false);
    } catch (error) {
      console.error('Erreur sauvegarde profil:', error);
      showToast(t('error'), "error");
    }
  };

  const renderCodeInput = () => (
    <Pressable style={styles.codeInputContainer} onPress={() => inputRef.current?.focus()}>
      <TextInput
        ref={inputRef}
        style={styles.hiddenInput}
        value={joinCode}
        onChangeText={(text) => {
           const cleaned = text.replace(/[^0-9]/g, '').slice(0, 4);
           setJoinCode(cleaned);
           if (cleaned.length > joinCode.length) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
           if (cleaned.length === 4) Keyboard.dismiss();
        }}
        keyboardType="number-pad"
        maxLength={4}
      />
      {[0, 1, 2, 3].map((index) => (
        <View key={index} style={[styles.codeDigitBox, joinCode.length === index && mode === 'join' && styles.codeDigitBoxActive, joinCode.length > index && styles.codeDigitBoxFilled]}>
          <Text style={styles.codeDigitText}>{joinCode[index] || ''}</Text>
        </View>
      ))}
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#191414', '#121212']} style={styles.backgroundGradient} />
      <SafeContainer>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }} enabled={mode === 'join'}>
            <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            
            <View style={styles.heroContainer}>
                <TouchableOpacity activeOpacity={0.9} onPress={() => setShowProfileModal(true)}>
                    <GlassCard style={styles.heroCard}>
                        <LinearGradient colors={['rgba(29, 185, 84, 0.15)', 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0.5 }} style={styles.heroGradient}>
                            <View style={styles.heroContent}>
                                <View style={styles.heroAvatarContainer}>
                                    {!!firebaseUser?.photoURL ? <Image source={{ uri: firebaseUser.photoURL }} style={styles.heroAvatarImage} resizeMode="cover" /> : <Text style={styles.heroAvatarEmoji}>🕵️‍♂️</Text>}
                                    <View style={styles.statusBadge} />
                                </View>
                                <View style={[styles.heroTextContainer, { justifyContent: 'center' }]}>
                                    <Text style={styles.heroGreeting}>{t('hello')}, {firebaseUser?.displayName?.split(' ')[0] || t('detective')} 👋</Text>
                                    <View style={styles.rankContainer}>
                                        <LinearGradient colors={['#FFD700', '#FDB931']} style={styles.rankBadge}>
                                            <Ionicons name="star" size={10} color="black" />
                                            <Text style={styles.rankText}>{t('vip')}</Text>
                                        </LinearGradient>
                                    </View>
                                </View>
                                <TouchableOpacity onPress={handleLogout} style={styles.heroLogoutButton} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}><Ionicons name="power" size={20} color="#FF6B6B" /></TouchableOpacity>
                            </View>
                        </LinearGradient>
                    </GlassCard>
                </TouchableOpacity>
            </View>

            <View style={styles.titleContainer}><Image source={require('../assets/LogoTransparent.png')} style={styles.centerLogo} resizeMode="contain" /></View>

            <View style={styles.actionCenterer}>
                {mode === 'main' ? (
                <View style={styles.buttonsStack}>
                    <PressableCard onPress={handleCreate} disabled={isLoading} style={{ width: '100%' }}>
                        <LinearGradient colors={[COLORS.SPOTIFY_GREEN, COLORS.SPOTIFY_GREEN]} start={{x: 0, y: 0}} end={{x: 1, y: 0}} style={styles.actionButton}>
                            <Ionicons name="add" size={28} color="white" />
                            <Text style={styles.actionButtonText}>{t('create_game')}</Text>
                        </LinearGradient>
                    </PressableCard>
                    <PressableCard onPress={() => setMode('join')} disabled={isLoading} style={{ width: '100%' }}>
                        <LinearGradient colors={['#9b51e0', '#9b51e0']} start={{x: 0, y: 0}} end={{x: 1, y: 0}} style={styles.actionButton}>
                            <Ionicons name="enter-outline" size={28} color="white" />
                            <Text style={styles.actionButtonText}>{t('join_game')}</Text>
                        </LinearGradient>
                    </PressableCard>
                </View>
                ) : (
                <GlassCard style={styles.joinContainer}>
                    <View style={styles.joinHeader}>
                        <TouchableOpacity onPress={() => setMode('main')} style={styles.backButton}><Ionicons name="arrow-back" size={24} color="white" /></TouchableOpacity>
                        <Text style={styles.joinTitle}>{t('join_room')}</Text>
                        <View style={{width: 24}} /> 
                    </View>
                    <Text style={styles.joinInstructions}>{t('room_code_placeholder')}</Text>
                    {renderCodeInput()}
                    <TouchableOpacity style={[styles.validateButton, joinCode.length !== 4 && styles.validateButtonDisabled]} onPress={handleJoin} disabled={isLoading || joinCode.length !== 4}>
                        {isLoading ? <ActivityIndicator color="black" /> : <Text style={styles.validateButtonText}>{t('join_game_button')}</Text>}
                    </TouchableOpacity>
                </GlassCard>
                )}
            </View>
            </Animated.View>
        </KeyboardAvoidingView>

        <ProfileModal visible={showProfileModal} onClose={() => setShowProfileModal(false)} currentUsername={firebaseUser?.displayName || t('detective')} currentPhotoURL={firebaseUser?.photoURL || null} onSave={handleSaveProfile} />
      </SafeContainer>
    </View>
  );
}
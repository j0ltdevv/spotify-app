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
import GlassCard from '../components/GlassCard';
import PressableCard from '../components/PressableCard';
import SafeContainer from '../components/SafeContainer';
import ProfileModal from '../components/ProfileModal';

type MenuScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Menu'>;
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  content: { flex: 1, padding: 24, justifyContent: 'space-between', zIndex: 10 },
  
  headerProfile: { 
      flexDirection: 'row', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      marginTop: Platform.OS === 'ios' ? 10 : 20,
      marginBottom: 20
  },
  
  titleContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
  },
  centerLogo: {
      width: width * 1.7,
      height: 360,
  },
  profileInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  avatarContainer: { 
      width: 44, height: 44, borderRadius: 22, backgroundColor: '#282828', 
      justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#333',
      overflow: 'hidden'
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarEmoji: { fontSize: 20 },
  greeting: { color: '#B3B3B3', fontSize: 13, fontWeight: '600' },
  username: { color: 'white', fontSize: 16, fontWeight: '700', maxWidth: 200 },
  logoutButton: { 
      padding: 10, backgroundColor: 'rgba(255, 107, 107, 0.1)', 
      borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255, 107, 107, 0.15)' 
  },

  actionCenterer: { 
      justifyContent: 'flex-end', 
      paddingBottom: Platform.OS === 'ios' ? 40 : 20, 
      paddingHorizontal: 20,
      zIndex: 50, 
      width: '100%' 
  },
  buttonsStack: { gap: 16, width: '100%' },
  actionButton: {
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
  actionButtonText: {
      color: 'white',
      fontSize: 18,
      fontWeight: '900',
      letterSpacing: 0.5,
  },

  joinContainer: { padding: 24, borderRadius: 20, alignItems: 'center', backgroundColor: '#181818' },
  joinHeader: { flexDirection: 'row', width: '100%', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  backButton: { padding: 8, margin: -8 },
  joinTitle: { fontSize: 17, fontWeight: '700', color: 'white' },
  joinInstructions: { color: '#999', fontSize: 14, marginBottom: 24 },
  
  codeInputContainer: { 
      flexDirection: 'row', gap: 10, marginBottom: 24, 
      width: '100%', justifyContent: 'center', alignItems: 'center',
      position: 'relative', height: 64
  },
  codeDigitBox: {
      width: 52, height: 64, borderRadius: 12, backgroundColor: '#222',
      borderWidth: 1.5, borderColor: '#333',
      justifyContent: 'center', alignItems: 'center'
  },
  codeDigitBoxActive: { borderColor: COLORS.SPOTIFY_GREEN, backgroundColor: 'rgba(29, 185, 84, 0.05)' },
  codeDigitBoxFilled: { borderColor: '#555', backgroundColor: '#2a2a2a' },
  codeDigitText: { fontSize: 28, fontWeight: 'bold', color: 'white' },
  hiddenInput: { 
      position: 'absolute', 
      width: '100%', height: '100%', 
      opacity: 0, 
      zIndex: 2, 
      color: 'transparent'
  },

  validateButton: {
      width: '100%', backgroundColor: COLORS.SPOTIFY_GREEN,
      paddingVertical: 16, borderRadius: 14, alignItems: 'center'
  },
  validateButtonDisabled: { opacity: 0.4, backgroundColor: '#333' },
  validateButtonText: { color: '#000', fontWeight: '800', fontSize: 15, letterSpacing: 0.5 },
  
  backgroundGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
});

export default function MenuScreen({ navigation }: MenuScreenProps) {
  const { createGame, joinGame, roomCode } = useGame();
  const { logout, firebaseUser } = useAuth();
  const { showToast } = useToast();
  
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
        setTimeout(() => {
            inputRef.current?.focus();
        }, 300);
    } else {
        Keyboard.dismiss();
        setJoinCode('');
    }
  }, [mode]);

  const handleCreate = async () => {
    try {
      setIsLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const timeoutPromise = new Promise((_, reject) => 
         setTimeout(() => reject(new Error("Timeout creating game")), 8000)
      );
      await Promise.race([createGame(), timeoutPromise]);
    } catch (error) {
      console.error('Create Game Error:', error);
      showToast("Erreur lors de la création", "error");
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
        showToast("Partie introuvable", "error");
        setIsLoading(false);
        setTimeout(() => inputRef.current?.focus(), 500);
      }
    } catch (error) {
        console.error(error);
        showToast("Erreur de connexion", "error");
        setIsLoading(false);
    }
  };

  const handleLogout = async () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await logout();
      navigation.replace('Welcome');
  };

  const handleSaveProfile = async (username: string, photoURL: string | null) => {
    try {
      showToast("Profil mis à jour avec succès", "success");
      setShowProfileModal(false);
    } catch (error) {
      console.error('Erreur lors de la sauvegarde du profil:', error);
      showToast("Erreur lors de la sauvegarde", "error");
      throw error;
    }
  };

  const renderCodeInput = () => {
    return (
      <Pressable style={styles.codeInputContainer} onPress={() => inputRef.current?.focus()}>
        <TextInput
          ref={inputRef}
          style={styles.hiddenInput}
          value={joinCode}
          onChangeText={(text) => {
             const cleaned = text.replace(/[^0-9]/g, '').slice(0, 4);
             if (cleaned !== joinCode) {
                setJoinCode(cleaned);
                if (cleaned.length > joinCode.length) {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }
                if (cleaned.length === 4) {
                    Keyboard.dismiss();
                }
             }
          }}
          keyboardType="number-pad"
          maxLength={4}
          returnKeyType="done"
          caretHidden={true}
        />
        {[0, 1, 2, 3].map((index) => (
          <View 
            key={index} 
            style={[
              styles.codeDigitBox, 
              joinCode.length === index && mode === 'join' && styles.codeDigitBoxActive,
              joinCode.length > index && styles.codeDigitBoxFilled
            ]}
          >
            <Text style={styles.codeDigitText}>{joinCode[index] || ''}</Text>
          </View>
        ))}
      </Pressable>
    );
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#191414', '#121212']}
        style={styles.backgroundGradient}
      />
      <SafeContainer>
        <KeyboardAvoidingView 
            behavior={Platform.OS === "ios" ? "padding" : "height"} 
            style={{ flex: 1 }}
            enabled={mode === 'join'}
        >
            <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <View style={styles.headerProfile}>
                <TouchableOpacity 
                    style={styles.profileInfo}
                    onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setShowProfileModal(true);
                    }}
                    activeOpacity={0.7}
                >
                    <View style={styles.avatarContainer}>
                        {firebaseUser?.photoURL ? (
                            <Image source={{ uri: firebaseUser.photoURL }} style={styles.avatarImage} resizeMode="cover" />
                        ) : (
                            <Text style={styles.avatarEmoji}>🕵️‍♂️</Text>
                        )}
                    </View>
                    <View>
                        <Text style={styles.greeting}>Bonjour,</Text>
                        <Text style={styles.username} numberOfLines={1}>
                            {firebaseUser?.displayName || 'Détective'}
                        </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#999" style={{ marginLeft: 8 }} />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
                    <Ionicons name="log-out-outline" size={20} color="#FF6B6B" />
                </TouchableOpacity>
            </View>

            <View style={styles.titleContainer}>
                <Image source={require('../assets/LogoTransparent.png')} style={styles.centerLogo} resizeMode="contain" />
            </View>

            <View style={styles.actionCenterer}>
                {mode === 'main' ? (
                <View style={styles.buttonsStack}>
                    <PressableCard onPress={handleCreate} disabled={isLoading} style={{ width: '100%' }}>
                    <LinearGradient colors={[COLORS.SPOTIFY_GREEN, COLORS.SPOTIFY_GREEN]} start={{x: 0, y: 0}} end={{x: 1, y: 0}} style={styles.actionButton}>
                        <Ionicons name="add" size={28} color="white" />
                        <Text style={styles.actionButtonText}>CRÉER UNE PARTIE</Text>
                    </LinearGradient>
                    </PressableCard>

                    <PressableCard onPress={() => setMode('join')} disabled={isLoading} style={{ width: '100%' }}>
                    <LinearGradient colors={['#9b51e0', '#9b51e0']} start={{x: 0, y: 0}} end={{x: 1, y: 0}} style={styles.actionButton}>
                        <Ionicons name="enter-outline" size={28} color="white" />
                        <Text style={styles.actionButtonText}>REJOINDRE</Text>
                    </LinearGradient>
                    </PressableCard>
                </View>
                ) : (
                <GlassCard style={styles.joinContainer}>
                    <View style={styles.joinHeader}>
                    <TouchableOpacity onPress={() => setMode('main')} style={styles.backButton} hitSlop={{top: 15, bottom: 15, left: 15, right: 15}}>
                        <Ionicons name="arrow-back" size={24} color="white" />
                    </TouchableOpacity>
                    <Text style={styles.joinTitle}>Rejoindre une salle</Text>
                    <View style={{width: 24}} /> 
                    </View>
                    <Text style={styles.joinInstructions}>Code d'accès à 4 chiffres</Text>
                    {renderCodeInput()}
                    <TouchableOpacity 
                    style={[styles.validateButton, joinCode.length !== 4 && styles.validateButtonDisabled]}
                    onPress={handleJoin}
                    disabled={isLoading || joinCode.length !== 4}
                    activeOpacity={0.8}
                    >
                    {isLoading ? <ActivityIndicator color="black" /> : <Text style={styles.validateButtonText}>COMMENCER L'ENQUÊTE</Text>}
                    </TouchableOpacity>
                </GlassCard>
                )}
            </View>
            </Animated.View>
        </KeyboardAvoidingView>

        <ProfileModal
            visible={showProfileModal}
            onClose={() => setShowProfileModal(false)}
            currentUsername={firebaseUser?.displayName || 'Détective'}
            currentPhotoURL={firebaseUser?.photoURL || null}
            onSave={handleSaveProfile}
        />
      </SafeContainer>
    </View>
  );
}

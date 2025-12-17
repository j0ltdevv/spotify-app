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

type MenuScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Menu'>;
};

const { width } = Dimensions.get('window');

export default function MenuScreen({ navigation }: MenuScreenProps) {
  const { createGame, joinGame, roomCode } = useGame();
  const { logout, firebaseUser } = useAuth();
  const { showToast } = useToast();
  
  const [mode, setMode] = useState<'main' | 'join'>('main');
  const [joinCode, setJoinCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // Animations Refs
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const bubbleAnim1 = useRef(new Animated.Value(0)).current;
  const bubbleAnim2 = useRef(new Animated.Value(0)).current;
  // Stockage des animations pour pouvoir les stopper proprement
  const loopAnim1 = useRef<Animated.CompositeAnimation>();
  const loopAnim2 = useRef<Animated.CompositeAnimation>();

  useEffect(() => {
    // Si une session est déjà active, on redirige
    if (roomCode) {
      navigation.replace('Lobby', {});
    }
  }, [roomCode, navigation]);

  useEffect(() => {
    // Animation d'entrée de l'interface
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, tension: 40, useNativeDriver: true })
    ]).start();

    // Configuration des animations de fond (Bulles)
    const createLoop = (animValue: Animated.Value, duration: number) => {
        return Animated.loop(
            Animated.sequence([
              Animated.timing(animValue, { toValue: 1, duration: duration, useNativeDriver: true }),
              Animated.timing(animValue, { toValue: 0, duration: duration, useNativeDriver: true })
            ])
        );
    };

    loopAnim1.current = createLoop(bubbleAnim1, 8000);
    loopAnim2.current = createLoop(bubbleAnim2, 12000);

    loopAnim1.current.start();
    loopAnim2.current.start();

    // Nettoyage
    return () => {
        loopAnim1.current?.stop();
        loopAnim2.current?.stop();
    };
  }, []);

  // Gestion du focus pour le mode Rejoindre
  useEffect(() => {
    if (mode === 'join') {
        // Petit délai pour laisser l'animation se finir avant d'ouvrir le clavier
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
      await createGame();
      // La navigation est gérée par le context ou le useEffect qui surveille roomCode
    } catch (error) {
      console.error(error);
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
        // Redonner le focus en cas d'erreur pour réessayer vite
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

  const renderCodeInput = () => {
    return (
      <Pressable style={styles.codeInputContainer} onPress={() => inputRef.current?.focus()}>
        {/* Input Invisible qui couvre toute la zone pour garantir le clic */}
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
        
        {/* Affichage visuel des cases */}
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
      
      {/* --- FOND D'ÉCRAN (Background) --- */}
      {/* pointerEvents="none" est CRUCIAL ici pour que le fond ne bloque pas les clics */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <LinearGradient
            colors={['#121212', '#080808']}
            style={StyleSheet.absoluteFillObject}
          />
          
          {/* Background Animé - Bulles */}
          <Animated.View style={[styles.bubble, { 
            top: '10%', left: -50, width: width * 0.8, height: width * 0.8, backgroundColor: 'rgba(29, 185, 84, 0.06)',
            transform: [{ translateY: bubbleAnim1.interpolate({ inputRange: [0, 1], outputRange: [0, -40] }) }] 
          }]} />
          
          <Animated.View style={[styles.bubble, { 
            bottom: '15%', right: -50, width: width * 0.9, height: width * 0.9, backgroundColor: 'rgba(162, 56, 255, 0.05)',
            transform: [{ translateY: bubbleAnim2.interpolate({ inputRange: [0, 1], outputRange: [0, 40] }) }] 
          }]} />
      </View>

      {/* --- CONTENU --- */}
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"} 
        style={{ flex: 1, zIndex: 10 }} // zIndex élevé pour passer au dessus du fond
        enabled={mode === 'join'} // ACTIVÉ SEULEMENT EN MODE JOIN
      >
        <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
          
          {/* Header Profil */}
          <View style={styles.headerProfile}>
              <View style={styles.profileInfo}>
                  <View style={styles.avatarContainer}>
                      {firebaseUser?.photoURL ? (
                          <Image 
                            source={{ uri: firebaseUser.photoURL }} 
                            style={styles.avatarImage} 
                            resizeMode="cover"
                          />
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
              </View>
              <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
                  <Ionicons name="log-out-outline" size={20} color="#FF6B6B" />
              </TouchableOpacity>
          </View>

          {/* TITRE PRINCIPAL */}
          {mode === 'main' && (
            <View style={styles.titleContainer}>
                <Text style={styles.heroTitle}>WHO</Text>
                <Text style={[styles.heroTitle, { color: COLORS.SPOTIFY_GREEN }]}>LISTENING ?</Text>
                
                {/* Tagline du document concept */}
                <View style={styles.taglineBox}>
                    <Text style={styles.taglineText}>
                        Ne cherchez pas le titre.{'\n'}Cherchez le <Text style={{color: COLORS.SPOTIFY_GREEN, fontWeight: '800'}}>coupable</Text>.
                    </Text>
                </View>
            </View>
          )}

          {/* ZONE D'ACTION */}
          <View style={styles.actionCenterer}>
            {mode === 'main' ? (
              <View style={styles.buttonsStack}>
                {/* Bouton Créer */}
                <PressableCard onPress={handleCreate} disabled={isLoading} style={styles.mainCard}>
                  <LinearGradient
                      colors={[COLORS.SPOTIFY_GREEN, '#158a3f']}
                      start={{x: 0, y: 0}} end={{x: 1, y: 0}}
                      style={styles.gradientButton}
                  >
                      <View style={styles.cardContent}>
                          <View style={styles.iconCircle}>
                              <Ionicons name="add" size={30} color={COLORS.SPOTIFY_GREEN} />
                          </View>
                          <View style={styles.textContainer}>
                              <Text style={styles.cardTitle}>CRÉER</Text>
                              <Text style={styles.cardSubtitle}>Lancer une enquête</Text>
                          </View>
                      </View>
                  </LinearGradient>
                </PressableCard>

                {/* Bouton Rejoindre */}
                <PressableCard onPress={() => setMode('join')} disabled={isLoading} style={styles.mainCard}>
                  <GlassCard style={styles.glassButton}>
                      <View style={styles.cardContent}>
                          <View style={[styles.iconCircle, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                              <Ionicons name="enter-outline" size={28} color="white" />
                          </View>
                          <View style={styles.textContainer}>
                              <Text style={[styles.cardTitle, { color: 'white' }]}>REJOINDRE</Text>
                              <Text style={styles.cardSubtitle}>Entrer dans une salle</Text>
                          </View>
                      </View>
                  </GlassCard>
                </PressableCard>
              </View>
            ) : (
              /* Mode Rejoindre */
              <GlassCard style={styles.joinContainer}>
                <View style={styles.joinHeader}>
                  <TouchableOpacity 
                    onPress={() => setMode('main')} 
                    style={styles.backButton} 
                    hitSlop={{top: 15, bottom: 15, left: 15, right: 15}}
                  >
                      <Ionicons name="arrow-back" size={24} color="white" />
                  </TouchableOpacity>
                  <Text style={styles.joinTitle}>Salle d'interrogatoire</Text>
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
                  {isLoading ? (
                      <ActivityIndicator color="black" />
                  ) : (
                      <Text style={styles.validateButtonText}>COMMENCER L'ENQUÊTE</Text>
                  )}
                </TouchableOpacity>
              </GlassCard>
            )}
          </View>

        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  bubble: { position: 'absolute', borderRadius: 999 },
  content: { flex: 1, padding: 24, justifyContent: 'space-between' },
  
  // Profile Header
  headerProfile: { 
      flexDirection: 'row', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      marginTop: Platform.OS === 'ios' ? 50 : 60,
      marginBottom: 20
  },
  profileInfo: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  avatarContainer: { 
      width: 44, height: 44, borderRadius: 22, backgroundColor: '#282828', 
      justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#333',
      overflow: 'hidden' // Important pour que l'image ne dépasse pas
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarEmoji: { fontSize: 20 },
  greeting: { color: '#B3B3B3', fontSize: 13, fontWeight: '600' },
  username: { color: 'white', fontSize: 16, fontWeight: '700', maxWidth: 200 },
  logoutButton: { 
      padding: 10, backgroundColor: 'rgba(255, 107, 107, 0.1)', 
      borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255, 107, 107, 0.15)' 
  },

  // Hero Title Styling
  titleContainer: { alignItems: 'center', justifyContent: 'center', flexGrow: 1, paddingBottom: 60 },
  heroTitle: { 
      fontSize: 56, fontWeight: '900', color: 'white', 
      lineHeight: 56, letterSpacing: -1, textAlign: 'center',
      fontStyle: 'italic'
  },
  taglineBox: {
      marginTop: 24, paddingHorizontal: 20, paddingVertical: 10,
      borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)',
      borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)'
  },
  taglineText: {
      color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '500', 
      textAlign: 'center', fontStyle: 'italic', lineHeight: 20
  },

  // Action Area
  actionCenterer: { justifyContent: 'flex-end', paddingBottom: Platform.OS === 'ios' ? 40 : 20, zIndex: 50, width: '100%' },
  buttonsStack: { gap: 16, width: '100%' },
  mainCard: { width: '100%', height: 85, borderRadius: 16 },
  gradientButton: { width: '100%', height: '100%', borderRadius: 16 },
  glassButton: { width: '100%', height: '100%', borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.05)' },
  
  cardContent: { 
      flex: 1, flexDirection: 'row', alignItems: 'center', 
      paddingHorizontal: 20 
  },
  iconCircle: { 
      width: 46, height: 46, borderRadius: 23, backgroundColor: 'white', 
      justifyContent: 'center', alignItems: 'center', marginRight: 16
  },
  textContainer: { flex: 1 },
  cardTitle: { fontSize: 17, fontWeight: '800', color: '#000', letterSpacing: 0.3, marginBottom: 2 },
  cardSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.6)', fontWeight: '500' },

  // Join Mode Styles
  joinContainer: { padding: 24, borderRadius: 20, alignItems: 'center', backgroundColor: '#181818' },
  joinHeader: { flexDirection: 'row', width: '100%', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  backButton: { padding: 8, margin: -8 }, // HitSlop géré inline
  joinTitle: { fontSize: 17, fontWeight: '700', color: 'white' },
  joinInstructions: { color: '#999', fontSize: 14, marginBottom: 24 },
  
  // Code Input Styles
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
      width: '100%', height: '100%', // Couvre toute la zone
      opacity: 0, // Invisible
      zIndex: 2, // Au dessus des cases visuelles
      color: 'transparent'
  },

  validateButton: {
      width: '100%', backgroundColor: COLORS.SPOTIFY_GREEN,
      paddingVertical: 16, borderRadius: 14, alignItems: 'center'
  },
  validateButtonDisabled: { opacity: 0.4, backgroundColor: '#333' },
  validateButtonText: { color: '#000', fontWeight: '800', fontSize: 15, letterSpacing: 0.5 },
});
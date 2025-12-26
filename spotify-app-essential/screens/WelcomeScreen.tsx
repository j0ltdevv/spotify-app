import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useGame } from '../contexts/GameContext'; // Import useGame
import { useToast } from '../contexts/ToastContext';
import { useSettings } from '../contexts/SettingsContext';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Animated, ActivityIndicator, Image } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { makeRedirectUri, useAuthRequest, ResponseType, exchangeCodeAsync } from 'expo-auth-session';
import { RootStackParamList } from '../App';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { SPOTIFY_CONFIG, API_ENDPOINTS } from '../config';
import { COLORS } from '../constants';
import Logger from '../utils/logger';
import DeezerImportModal from '../components/DeezerImportModal';

type WelcomeScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Welcome'>;
};

const { width, height } = Dimensions.get('window');

// --- CONFIGURATION ENDPOINTS SPOTIFY ---
const discovery = {
  authorizationEndpoint: API_ENDPOINTS.SPOTIFY_AUTH,
  tokenEndpoint: API_ENDPOINTS.SPOTIFY_TOKEN,
};

export default function WelcomeScreen({ navigation }: WelcomeScreenProps) {
    const { accessToken, setAccessToken, isLoading, loginWithSpotifyFirebase } = useAuth();
    const { tryRejoinLastGame, activeGameDocId } = useGame();
    const { showToast } = useToast();
    const { settings, updateSetting, t } = useSettings();
    const [isAuthenticating, setIsAuthenticating] = useState(false);
    const [isReconnecting, setIsReconnecting] = useState(true);
    const [showDeezerModal, setShowDeezerModal] = useState(false);
  
    // Animations
    const floatAnim = useRef(new Animated.Value(0)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const fallAnim = useRef(new Animated.Value(-height)).current;
  
    // 1. Auth Setup
    const redirectUri = makeRedirectUri({
      scheme: SPOTIFY_CONFIG.REDIRECT_SCHEME,
      preferLocalhost: false,
    });
  
    const [request, response, promptAsync] = useAuthRequest(
      {
        clientId: SPOTIFY_CONFIG.CLIENT_ID,
        scopes: SPOTIFY_CONFIG.SCOPES,
        usePKCE: true,
        responseType: ResponseType.Code,
        redirectUri: redirectUri,
      },
      discovery
    );
  
    // --- AUTO RECONNECT & NAVIGATION LOGIC ---
    useEffect(() => {
      // Give animations a moment to breathe
      const navigationTimer = setTimeout(async () => {
        // If we are already in a game via reconnect, navigate
        if (activeGameDocId) {
          console.log("🚀 Welcome -> Lobby (reconnected game found in context)");
          setIsReconnecting(false);
          navigation.replace('Lobby', {});
          return;
        }
        
        // If we are logged in, try to rejoin or go to Menu
        if (accessToken) {
          const reconnected = await tryRejoinLastGame();
          if (!reconnected) {
              console.log("🚀 Welcome -> Menu (no previous game to join)");
              setIsReconnecting(false);
              navigation.replace('Menu');
          }
          // If reconnected, the first "if" will catch it on next render
        } else {
          // Not logged in, stay here and show login buttons
          setIsReconnecting(false);
        }
      }, 2500); // Wait 2.5s on splash screen
  
      return () => clearTimeout(navigationTimer);
    }, [accessToken, tryRejoinLastGame]);
  
  
    useEffect(() => {
      // Animations de fond en boucle
      Animated.loop(
        Animated.sequence([
          Animated.timing(floatAnim, { toValue: -15, duration: 2000, useNativeDriver: true }),
          Animated.timing(floatAnim, { toValue: 0, duration: 2000, useNativeDriver: true }),
        ])
      ).start();
  
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.1, duration: 1500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
        ])
      ).start();
  
      // Animations d'apparition
      Animated.parallel([
        Animated.spring(fallAnim, {
          toValue: 0,
          tension: 10,
          friction: 8,
          delay: 200,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          delay: 300,
          useNativeDriver: true
        }),
      ]).start();
    }, []);
  
    // Gestion Auth
    useEffect(() => {
      if (response?.type === 'success') {
        setIsAuthenticating(true);
        const { code } = response.params;
        
        exchangeCodeAsync(
          {
            clientId: SPOTIFY_CONFIG.CLIENT_ID,
            code,
            redirectUri,
            extraParams: { code_verifier: request?.codeVerifier || '' },
          },
          discovery
        ).then(async tokenResult => {
          try {
            await loginWithSpotifyFirebase(tokenResult.accessToken);
            await setAccessToken(tokenResult.accessToken, tokenResult.refreshToken); 
            showToast(t('connection_success'), 'success', 2000);
            // Navigation will be handled by the auto-reconnect logic
          } catch (firebaseError) {
            showToast(t('connection_error'), 'error', 4000);
            setIsAuthenticating(false);
          }
        }).catch(err => {
          setIsAuthenticating(false);
          showToast(t('connection_error'), 'error', 4000);
        });
      } else if (response?.type === 'error') {
        showToast(t('auth_refused'), 'error', 3000);
      }
    }, [response]);
  
    const LanguageSwitcher = () => (
      <View style={styles.langSelectorContainer}>
        <TouchableOpacity onPress={() => updateSetting('language', 'fr')} style={[styles.langButton, settings.language === 'fr' && styles.langButtonActive]}>
          <Text style={[styles.langButtonText, settings.language === 'fr' && styles.langButtonTextActive]}>FR</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => updateSetting('language', 'en')} style={[styles.langButton, settings.language === 'en' && styles.langButtonActive]}>
          <Text style={[styles.langButtonText, settings.language === 'en' && styles.langButtonTextActive]}>EN</Text>
        </TouchableOpacity>
      </View>
    );
  
    return (
      <View style={[styles.container, { backgroundColor: COLORS.DARK_BG }]}>
        <View style={styles.outerContainer}>
          <LanguageSwitcher />
          <Animated.Image
            source={require('../assets/LogoTransparent.png')}
            style={[styles.logo, { opacity: fadeAnim, transform: [{ translateY: fallAnim }, { scale: pulseAnim }] }]}
            resizeMode="contain"
          />
          <View style={styles.content}>
            
            {(isReconnecting || isLoading) ? (
              <View style={{ alignItems: 'center' }}>
                  <ActivityIndicator size="large" color={COLORS.SPOTIFY_GREEN} />
                  <Text style={styles.reconnectText}>{t('reconnecting') || 'Reconnexion...'}</Text>
              </View>
            ) : (
              <Animated.View style={[{ alignItems: 'center', opacity: fadeAnim, transform: [{ translateY: floatAnim }] }, { marginTop: 50 }]}>
                  <Animated.Text style={styles.promptText}>{t('connect_account')}</Animated.Text>
  
                  <TouchableOpacity
                    style={[styles.loginButton, (!request || isAuthenticating) && { opacity: 0.7 }]}
                    disabled={!request || isAuthenticating}
                    activeOpacity={0.8}
                    onPress={() => promptAsync()}
                  >
                    {isAuthenticating ? (
                      <View style={{flexDirection: 'row', alignItems: 'center'}}>
                        <ActivityIndicator color="white" size="small" style={{ marginRight: 10 }} />
                        <Text style={styles.loginButtonText}>{t('loading')}</Text>
                      </View>
                    ) : (
                      <View style={{flexDirection: 'row', alignItems: 'center'}}>
                        <FontAwesome5 name="spotify" size={24} color="white" style={{ marginRight: 10 }} />
                        <Text style={styles.loginButtonText}>{t('login_spotify')}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
  
                  <TouchableOpacity
                    style={[styles.deezerButton, (!request || isAuthenticating) && { opacity: 0.7 }]}
                    disabled={!request || isAuthenticating}
                    activeOpacity={0.8}
                    onPress={() => setShowDeezerModal(true)}
                  >
                    <View style={{flexDirection: 'row', alignItems: 'center'}}>
                      <FontAwesome5 name="deezer" size={24} color="white" style={{ marginRight: 10 }} />
                      <Text style={styles.deezerButtonText}>{t('login_deezer')}</Text>
                    </View>
                  </TouchableOpacity>
              </Animated.View>
            )}
  
          </View>
  
          <View style={styles.footer}>
            <View style={styles.versionContainer}>
              <Text style={styles.version}>{t('version')} 1.4.0</Text>
            </View>
          </View>
        </View>
  
        <DeezerImportModal
          visible={showDeezerModal}
          onClose={() => setShowDeezerModal(false)}
          onPlaylistSelected={(tracks, playlistName) => navigation.replace('Lobby', { tracks, playlistName })}
        />
      </View>
    );
  }
  
  const styles = StyleSheet.create({
    container: {
      flex: 1,
    },
    outerContainer: {
      flex: 1,
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 50,
    },
    content: {
      flex: 1,
      justifyContent: 'flex-end',
      alignItems: 'center',
      paddingBottom: 80,
    },
    promptText: {
      color: 'white',
      fontSize: 24,
      fontWeight: '800',
      textAlign: 'center',
      textShadowColor: 'rgba(0, 0, 0, 0.75)',
      textShadowOffset: { width: 0, height: 2 },
      textShadowRadius: 4,
      marginTop: 20,
    },
    reconnectText: {
      color: 'white',
      fontSize: 16,
      fontWeight: '700',
      marginTop: 20,
      opacity: 0.8,
    },
    footer: {
      paddingBottom: 20,
      width: '100%',
      height: 60,
    },
    loginButton: {
      backgroundColor: COLORS.SPOTIFY_GREEN,
      width: 300,
      paddingVertical: 18,
      borderRadius: 30,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 5,
      elevation: 5,
      marginTop: 50,
    },
    loginButtonText: {
      color: 'white',
      fontSize: 14,
      fontWeight: '800',
      letterSpacing: 1,
    },
    deezerButton: {
      backgroundColor: '#9B51E0',
      width: 300,
      paddingVertical: 18,
      borderRadius: 30,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 5,
      elevation: 5,
      marginTop: 15,
    },
    deezerButtonText: {
      color: COLORS.TEXT_PRIMARY,
      fontSize: 14,
      fontWeight: '800',
      letterSpacing: 1,
    },
    versionContainer: {
      position: 'absolute',
      bottom: 20,
      right: 0,
    },
    version: {
      color: 'rgba(255, 255, 255, 0.6)',
      fontSize: 12,
      fontWeight: '600',
      textShadowColor: 'rgba(0, 0, 0, 0.5)',
      textShadowOffset: { width: 1, height: 1 },
      textShadowRadius: 3
    },
    logo: {
      position: 'absolute',
      top: 100,
      width: width * 1.5,
      height: width * 1.5 * (1000 / 1732),
      alignSelf: 'center',
    },
    langSelectorContainer: { position: 'absolute', top: 60, right: 20, flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: 2, zIndex: 100 },
    langButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, },
    langButtonActive: { backgroundColor: COLORS.SPOTIFY_GREEN, shadowColor: COLORS.SPOTIFY_GREEN, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 8, },
    langButtonText: { color: 'white', fontWeight: '700', fontSize: 13, },
    langButtonTextActive: { color: '#000' },
  });
  
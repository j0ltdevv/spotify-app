import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Animated, ActivityIndicator } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { makeRedirectUri, useAuthRequest, ResponseType, exchangeCodeAsync } from 'expo-auth-session';
import { RootStackParamList } from '../App';
import { Ionicons } from '@expo/vector-icons';
import { SPOTIFY_CONFIG, API_ENDPOINTS } from '../config';
import { COLORS, ANIMATION_CONFIG } from '../constants';
import Logger from '../utils/logger';

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
  const { accessToken, setAccessToken, isLoading } = useAuth();
  const { showToast } = useToast();
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  
  // Animations
  const floatAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current; // Nouvelle animation de pulsation

  // 1. Auth Setup
  const redirectUri = makeRedirectUri({
    scheme: SPOTIFY_CONFIG.REDIRECT_SCHEME,
    preferLocalhost: false, // Important pour Expo Go
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

  // Redirection automatique si déjà connecté
  useEffect(() => {
    if (!isLoading && accessToken) {
      Logger.auth.success('Auto-login');
      Logger.nav('Lobby', { auto: true });
      navigation.replace('Lobby', {});
    }
  }, [isLoading, accessToken, navigation]);

  useEffect(() => {
    // Animation flottante
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: -15, duration: 2000, useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ])
    ).start();

    // Animation de pulsation (scale)
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ])
    ).start();

    // Fade In
    Animated.timing(fadeAnim, { toValue: 1, duration: 1000, delay: 300, useNativeDriver: true }).start();

    // Gestion Auth
    if (response?.type === 'success') {
      setIsAuthenticating(true);
      const { code } = response.params;
      Logger.auth.login('Spotify');
      Logger.info('Code d\'autorisation reçu, échange en cours...');
      
      exchangeCodeAsync(
        {
          clientId: SPOTIFY_CONFIG.CLIENT_ID,
          code,
          redirectUri,
          extraParams: { code_verifier: request?.codeVerifier || '' },
        },
        discovery
      ).then(tokenResult => {
        Logger.auth.success('Token obtenu');
        setAccessToken(tokenResult.accessToken);
        showToast('Connexion réussie !', 'success', 2000);
        setTimeout(() => {
          Logger.nav('Lobby');
          navigation.replace('Lobby', {});
        }, 500);
      }).catch(err => {
        Logger.auth.error('Erreur échange de code', err);
        setIsAuthenticating(false);
        showToast('Erreur de connexion à Spotify. Réessayez.', 'error', 4000);
      });
    } else if (response?.type === 'error') {
      Logger.auth.error('Erreur d\'autorisation', response.error);
      showToast('Autorisation refusée ou annulée', 'error', 3000);
    }
  }, [response]);

  return (
    <View style={[styles.container, { backgroundColor: COLORS.DARK_BG }]}>
      <View style={styles.outerContainer}>
        {/* Contenu central: Texte + Bouton */}
        <View style={styles.content}>
          <Animated.View style={{ alignItems: 'center', opacity: fadeAnim, transform: [{ translateY: floatAnim }] }}>
            <Animated.Text style={[styles.promptText, { transform: [{ scale: pulseAnim }] }]}>Connecte ton compte</Animated.Text>
            
            <TouchableOpacity
              style={[styles.loginButton, (!request || isLoading || isAuthenticating) && { opacity: 0.7 }]} 
              disabled={!request || isLoading || isAuthenticating}
              activeOpacity={0.8}
              onPress={() => {
                Logger.auth.login('Spotify - User initiated');
                promptAsync();
              }}
            >
              {isAuthenticating ? (
                <>
                  <ActivityIndicator color="white" size="small" style={{ marginRight: 10 }} />
                  <Text style={styles.loginButtonText}>CONNEXION EN COURS...</Text>
                </>
              ) : (
                <>
                  <Ionicons name="musical-notes" size={24} color="white" style={{ marginRight: 10 }} />
                  <Text style={styles.loginButtonText}>
                    {isLoading ? 'CHARGEMENT...' : 'CONTINUER AVEC SPOTIFY'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </Animated.View>
        </View>

        {/* Footer: Version uniquement */}
        <View style={styles.footer}>
          {/* Version en bas à droite */}
          <View style={styles.versionContainer}>
            <Text style={styles.version}>Version 1.0</Text>
          </View>
        </View>
      </View>
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  promptText: {
    color: 'white',
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
    // marginBottom: 5, // Supprimé pour positionnement indépendant du bouton
  },
  // promptTextSub est maintenant inutilisé après la suppression du texte "Spotify"
  // et le positionnement indépendant du bouton
  footer: {
    paddingBottom: 20,
    width: '100%',
    height: 60, // Hauteur fixe pour le footer
  },
  loginButton: {
    backgroundColor: COLORS.SPOTIFY_GREEN,
    width: 300, // Largeur agrandie
    paddingVertical: 18, // Hauteur agrandie
    borderRadius: 30,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
    marginTop: 100, // Nouvelle marge pour positionner le bouton indépendamment, descente accentuée
  },
  loginButtonText: {
    color: 'white',
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
});
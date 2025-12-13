import React, { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Animated, ImageBackground } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { makeRedirectUri, useAuthRequest, ResponseType, exchangeCodeAsync } from 'expo-auth-session';
import { RootStackParamList } from '../App';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient'; // Assure-toi d'avoir installé expo-linear-gradient

// Si tu n'as pas expo-linear-gradient, lance : npx expo install expo-linear-gradient
// Sinon, retire l'import et le composant <LinearGradient> (ça sera juste moins joli)

type WelcomeScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Welcome'>;
};

const { width, height } = Dimensions.get('window');

// --- CONFIGURATION ENDPOINTS SPOTIFY ---
const discovery = {
  authorizationEndpoint: 'https://accounts.spotify.com/authorize',
  tokenEndpoint: 'https://accounts.spotify.com/api/token',
};

export default function WelcomeScreen({ navigation }: WelcomeScreenProps) {
  const { setAccessToken } = useAuth();
  // Animations
  const floatAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // 1. Auth Setup
  const redirectUri = makeRedirectUri({
    scheme: 'trackroulette',
    preferLocalhost: false, // Important pour Expo Go
  });

  const [request, response, promptAsync] = useAuthRequest(
    {
      clientId: '3765c558e9704334bbe1acebe13998fa', // Ton Client ID
      scopes: [
        'user-read-email',
        'user-top-read',
        'user-read-recently-played',
        'user-library-read'
      ],
      usePKCE: true,
      responseType: ResponseType.Code,
      redirectUri: redirectUri,
    },
    discovery
  );

  useEffect(() => {
    // Animation flottante du logo
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: -15, duration: 2000, useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ])
    ).start();

    // Fade In des textes
    Animated.timing(fadeAnim, { toValue: 1, duration: 1000, delay: 300, useNativeDriver: true }).start();

    // Gestion Auth
    if (response?.type === 'success') {
      const { code } = response.params;
      exchangeCodeAsync(
        {
          clientId: '3765c558e9704334bbe1acebe13998fa',
          code,
          redirectUri,
          extraParams: { code_verifier: request?.codeVerifier || '' },
        },
        discovery
      ).then(tokenResult => {
        setAccessToken(tokenResult.accessToken);
        navigation.navigate({ name: 'Lobby' });
      }).catch(err => console.error(err));
    }
  }, [response]);

  return (
    <View style={styles.container}>
      {/* Fond Dégradé (Nécessite expo-linear-gradient) */}
      <LinearGradient
        colors={['#191414', '#082512', '#191414']}
        style={styles.background}
      />

      {/* Cercles décoratifs en arrière-plan */}
      <View style={[styles.circle, { top: -50, left: -50, backgroundColor: 'rgba(29, 185, 84, 0.1)' }]} />
      <View style={[styles.circle, { bottom: 100, right: -50, backgroundColor: 'rgba(29, 185, 84, 0.05)' }]} />

      <View style={styles.content}>
        
        {/* Logo Animé */}
        <Animated.View style={[styles.logoContainer, { transform: [{ translateY: floatAnim }] }]}>
          <View style={styles.logoCircle}>
            <Ionicons name="musical-notes" color="#191414" size={60} />
          </View>
          <View style={styles.badgeIcon}>
            <Ionicons name="help" color="white" size={20} />
          </View>
        </Animated.View>

        {/* Titres */}
        <Animated.View style={{ opacity: fadeAnim, alignItems: 'center' }}>
          <Text style={styles.surtitle}>LE BLIND TEST SOCIAL</Text>
          <Text style={styles.title}>TRACK</Text>
          <Text style={styles.titleFilled}>ROULETTE</Text>
          
          <Text style={styles.description}>
            Connecte ton Spotify.{"\n"}
            Tes amis devinent ce que tu écoutes.{"\n"}
            Les dossiers sortent. 📂
          </Text>
        </Animated.View>
      </View>

      {/* Bouton Connexion */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.loginButton, !request && { opacity: 0.7 }]} 
          disabled={!request}
          activeOpacity={0.8}
          onPress={() => promptAsync()}
        >
          <Ionicons name="musical-notes" size={24} color="white" style={{ marginRight: 10 }} />
          <Text style={styles.loginButtonText}>CONTINUER AVEC SPOTIFY</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Version 1.0 • Powered by Expo</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#191414',
    justifyContent: 'space-between',
  },
  background: {
    position: 'absolute',
    left: 0, right: 0, top: 0, bottom: 0,
  },
  circle: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 60,
  },
  logoContainer: {
    marginBottom: 40,
    position: 'relative',
  },
  logoCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#1DB954', // Vert Spotify
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#1DB954',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 15,
  },
  badgeIcon: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#FF4757',
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#191414',
  },
  surtitle: {
    color: '#1DB954',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 10,
  },
  title: {
    fontSize: 56,
    fontWeight: '900',
    color: 'white', 
    letterSpacing: -2,
    lineHeight: 60,
  },
  titleFilled: {
    fontSize: 56,
    fontWeight: '900',
    color: '#1DB954',
    letterSpacing: -2,
    lineHeight: 60,
    marginTop: -10,
  },
  description: {
    color: '#B3B3B3',
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 24,
    marginTop: 20,
    fontWeight: '500',
  },
  footer: {
    padding: 30,
    paddingBottom: 50,
    alignItems: 'center',
  },
  loginButton: {
    backgroundColor: '#1DB954',
    width: '100%',
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
  },
  loginButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
  },
  version: {
    marginTop: 20,
    color: '#555',
    fontSize: 12,
  },
});
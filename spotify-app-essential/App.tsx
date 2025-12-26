import React, { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { AuthProvider } from './contexts/AuthContext';
import { GameProvider } from './contexts/GameContext';
import { ToastProvider } from './contexts/ToastContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import WelcomeScreen from './screens/WelcomeScreen';
import MenuScreen from './screens/MenuScreen'; 
import LobbyScreen from './screens/LobbyScreen';
import GameScreen from './screens/GameScreen';
import RevealScreen from './screens/RevealScreen';
import GameOverScreen from './screens/GameOverScreen';
import SettingsScreen from './screens/SettingsScreen';
import LegalScreen from './screens/LegalScreen';
import ErrorBoundary from './components/ErrorBoundary';
import SoundManager from './utils/SoundManager';
import { COLORS } from './constants';
import { app } from './services/FirebaseService'; 
import { GameTrack } from './types';
import { cancelAllScheduledNotifications, scheduleRetentionNotification } from './services/NotificationService';

export type RootStackParamList = {
  Welcome: undefined;
  Menu: undefined; 
  Lobby: { gameId?: number; tracks?: GameTrack[]; playlistName?: string };
  Game: { gameId?: number; round?: number; playerScores?: PlayerScores; category?: string; tracks?: GameTrack[]; maxRounds?: number };
  Reveal: { correctPlayer: string; track: GameTrack; score: number; round: number; playerScores?: PlayerScores; previousScores?: PlayerScores; selectedPlayer?: string | null; category?: string; maxRounds?: number };
  GameOver: { results: Array<{ name: string; score: number; avatar: { color: string; emoji: string; image?: string } }> };
  Settings: undefined;
  Legal: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    // Initialiser le SoundManager au démarrage de l'app
    SoundManager.initialize().catch(error => {
      console.error('❌ Erreur initialisation SoundManager:', error);
    });

    // Gestion du cycle de vie de l'app pour les notifications de rappel
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('☀️ App passée au premier plan : annulation des rappels.');
        cancelAllScheduledNotifications();
      }

      if (nextAppState.match(/inactive|background/)) {
        console.log('🌙 App passée en arrière-plan : programmation d\'un rappel dans 48h.');
        // On programme un rappel pour dans 48 heures (172800 secondes)
        scheduleRetentionNotification(172800);
      }

      appState.current = nextAppState;
    });

    // Au démarrage, on nettoie aussi les notifs au cas où
    cancelAllScheduledNotifications();

    return () => {
      // Nettoyer à la fermeture de l'app
      subscription.remove();
      SoundManager.cleanup();
    };
  }, []);

  return (
    <ErrorBoundary>
      <SettingsProvider>
        <ToastProvider>
          <AuthProvider>
            <GameProvider>
              <NavigationContainer>
                <StatusBar style="light" />
                <Stack.Navigator
                  screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: COLORS.DARK_BG },
                    animation: 'fade',
                  }}
                >
                  <Stack.Screen name="Welcome" component={WelcomeScreen} />
                  <Stack.Screen name="Menu" component={MenuScreen} /> 
                  <Stack.Screen name="Lobby" component={LobbyScreen} />
                  <Stack.Screen name="Game" component={GameScreen} />
                  <Stack.Screen name="Reveal" component={RevealScreen} />
                  <Stack.Screen name="GameOver" component={GameOverScreen} />
                  <Stack.Screen 
                    name="Settings" 
                    component={SettingsScreen}
                    options={{
                      animation: 'slide_from_bottom',
                      presentation: 'modal',
                    }}
                  />
                  <Stack.Screen 
                    name="Legal" 
                    component={LegalScreen}
                    options={{
                      animation: 'slide_from_bottom',
                      presentation: 'modal',
                    }}
                  />
                </Stack.Navigator>
              </NavigationContainer>
            </GameProvider>
          </AuthProvider>
        </ToastProvider>
      </SettingsProvider>
    </ErrorBoundary>
  );
}
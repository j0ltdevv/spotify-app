import React, { useEffect } from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { GameProvider } from './contexts/GameContext';
import { ToastProvider } from './contexts/ToastContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import WelcomeScreen from './screens/WelcomeScreen';
import LobbyScreen from './screens/LobbyScreen';
import GameScreen from './screens/GameScreen';
import RevealScreen from './screens/RevealScreen';
import GameOverScreen from './screens/GameOverScreen';
import SettingsScreen from './screens/SettingsScreen';
import ErrorBoundary from './components/ErrorBoundary';
import SoundManager from './utils/SoundManager';
import { COLORS } from './constants';

export type RootStackParamList = {
  Welcome: undefined;
  Lobby: { gameId?: number };
  Game: { gameId?: number; round?: number; playerScores?: any; category?: string };
  Reveal: { correctPlayer: string; track: any; score: number; round: number; playerScores?: any; selectedPlayer?: string; category?: string };
  GameOver: { results: Array<{ name: string; score: number; avatar: { color: string; emoji: string } }> };
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  useEffect(() => {
    // Initialiser le SoundManager au démarrage de l'app
    SoundManager.initialize().catch(error => {
      console.error('❌ Erreur initialisation SoundManager:', error);
    });

    return () => {
      // Nettoyer à la fermeture de l'app
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
                </Stack.Navigator>
              </NavigationContainer>
            </GameProvider>
          </AuthProvider>
        </ToastProvider>
      </SettingsProvider>
    </ErrorBoundary>
  );
}

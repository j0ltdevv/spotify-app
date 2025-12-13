import React from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import WelcomeScreen from './screens/WelcomeScreen';
import LobbyScreen from './screens/LobbyScreen';
import GameScreen from './screens/GameScreen';
import RevealScreen from './screens/RevealScreen';
import GameOverScreen from './screens/GameOverScreen';

export type RootStackParamList = {
  Welcome: undefined;
  Lobby: { gameId?: number };
  Game: { gameId?: number; round?: number; playerScores?: any };
  Reveal: { correctPlayer: string; track: any; score: number; round: number; playerScores?: any; selectedPlayer?: string };
  GameOver: { results: Array<{ name: string; score: number; avatar: { color: string; emoji: string } }> };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <StatusBar style="light" />
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#191414' },
            animation: 'fade',
          }}
        >
          <Stack.Screen name="Welcome" component={WelcomeScreen} />
          <Stack.Screen name="Lobby" component={LobbyScreen} />
          <Stack.Screen name="Game" component={GameScreen} />
          <Stack.Screen name="Reveal" component={RevealScreen} />
          <Stack.Screen name="GameOver" component={GameOverScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </AuthProvider>
  );
}
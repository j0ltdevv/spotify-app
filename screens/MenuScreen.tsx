import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants';
import SafeContainer from '../components/SafeContainer';
import { useGame } from '../contexts/GameContext';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import * as Haptics from 'expo-haptics';
import GlassCard from '../components/GlassCard';

type MenuScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Menu'>;
};

export default function MenuScreen({ navigation }: MenuScreenProps) {
  const { createGame, joinGame, roomCode } = useGame();
  const { logout } = useAuth();
  const { showToast } = useToast();
  
  const [mode, setMode] = useState<'main' | 'join'>('main');
  const [joinCode, setJoinCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Si on a déjà un roomCode (restauration), on va direct au Lobby
  if (roomCode) {
      navigation.replace('Lobby', {});
  }

  const handleCreate = async () => {
    try {
      setIsLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await createGame();
      // La navigation se fera automatiquement ou via le useEffect dans Lobby, 
      // mais ici on force le passage
      navigation.replace('Lobby', {});
    } catch (error) {
      console.error(error);
      showToast("Erreur lors de la création", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoin = async () => {
    if (joinCode.length !== 4) {
      showToast("Le code doit faire 4 chiffres", "error");
      return;
    }
    try {
      setIsLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const success = await joinGame(joinCode);
      if (success) {
        navigation.replace('Lobby', {});
      } else {
        showToast("Partie introuvable", "error");
      }
    } catch (error) {
      console.error(error);
      showToast("Erreur de connexion", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
      await logout();
      navigation.replace('Welcome');
  };

  return (
    <SafeContainer>
      <View style={styles.container}>
        <View style={styles.header}>
            <TouchableOpacity onPress={handleLogout} style={styles.iconButton}>
                <Ionicons name="log-out-outline" size={24} color="#FF6B6B" />
            </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <Text style={styles.title}>Blind Test</Text>
          <Text style={styles.subtitle}>Spotify Edition</Text>

          {mode === 'main' ? (
            <View style={styles.buttonsContainer}>
              <TouchableOpacity 
                style={styles.mainButton} 
                onPress={handleCreate}
                disabled={isLoading}
              >
                <GlassCard style={styles.glassButton} intensity={20}>
                    {isLoading ? <ActivityIndicator color="white" /> : (
                        <>
                            <Ionicons name="add-circle" size={40} color={COLORS.SPOTIFY_GREEN} />
                            <Text style={styles.buttonText}>CRÉER UNE PARTIE</Text>
                        </>
                    )}
                </GlassCard>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.mainButton} 
                onPress={() => setMode('join')}
                disabled={isLoading}
              >
                <GlassCard style={styles.glassButton} intensity={20}>
                    <Ionicons name="enter" size={40} color="#fff" />
                    <Text style={styles.buttonText}>REJOINDRE</Text>
                </GlassCard>
              </TouchableOpacity>
            </View>
          ) : (
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.joinContainer}>
              <TouchableOpacity onPress={() => setMode('main')} style={styles.backButton}>
                <Ionicons name="arrow-back" size={30} color="white" />
              </TouchableOpacity>
              
              <Text style={styles.label}>Code de la salle</Text>
              <TextInput
                style={styles.input}
                value={joinCode}
                onChangeText={setJoinCode}
                placeholder="0000"
                placeholderTextColor="rgba(255,255,255,0.3)"
                keyboardType="number-pad"
                maxLength={4}
                autoFocus
              />
              
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={handleJoin}
                disabled={isLoading}
              >
                {isLoading ? <ActivityIndicator color="black" /> : (
                    <Text style={styles.actionButtonText}>VALIDER</Text>
                )}
              </TouchableOpacity>
            </KeyboardAvoidingView>
          )}
        </View>
      </View>
    </SafeContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  header: { alignItems: 'flex-start' },
  iconButton: { padding: 10, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 20 },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 48, fontWeight: '900', color: 'white', letterSpacing: 2, marginBottom: 5 },
  subtitle: { fontSize: 18, color: COLORS.SPOTIFY_GREEN, fontWeight: '600', marginBottom: 60, letterSpacing: 4 },
  buttonsContainer: { width: '100%', gap: 20 },
  mainButton: { width: '100%', height: 100 },
  glassButton: { width: '100%', height: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 20, borderRadius: 20 },
  buttonText: { color: 'white', fontSize: 20, fontWeight: '800', letterSpacing: 1 },
  
  joinContainer: { width: '100%', alignItems: 'center' },
  backButton: { position: 'absolute', top: -60, left: 0 },
  label: { color: 'white', fontSize: 16, marginBottom: 15, fontWeight: '600' },
  input: { 
      fontSize: 48, 
      fontWeight: 'bold', 
      color: 'white', 
      borderBottomWidth: 3, 
      borderBottomColor: COLORS.SPOTIFY_GREEN, 
      width: 150, 
      textAlign: 'center', 
      marginBottom: 40,
      letterSpacing: 10
  },
  actionButton: { 
      backgroundColor: COLORS.SPOTIFY_GREEN, 
      paddingVertical: 15, 
      paddingHorizontal: 50, 
      borderRadius: 30 
  },
  actionButtonText: { fontSize: 18, fontWeight: 'bold', color: 'black' }
});

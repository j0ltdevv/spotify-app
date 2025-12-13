import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Dimensions, Image } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../App';
import { Ionicons } from '@expo/vector-icons';

type LobbyScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'Lobby'>;
  route: RouteProp<RootStackParamList, 'Lobby'>;
};

const MOCK_PLAYERS = [
  { id: '1', name: 'Moi', color: '#1DB954', emoji: '😎' },
  { id: '2', name: 'Julie', color: '#FF6B6B', emoji: '🎀' },
  { id: '3', name: 'Thomas', color: '#4ECDC4', emoji: '🎸' },
  { id: '4', name: 'Léa', color: '#FFE66D', emoji: '✨' },
];

const { width } = Dimensions.get('window');

const INITIAL_PLAYERS = [
  { id: '1', name: 'Moi', color: '#1DB954', emoji: '😎' },
  { id: '2', name: 'Julie', color: '#FF6B6B', emoji: '🎀' },
  { id: '3', name: 'Thomas', color: '#4ECDC4', emoji: '🎸' },
  { id: '4', name: 'Léa', color: '#FFE66D', emoji: '✨' },
];

export default function LobbyScreen({ navigation, route }: LobbyScreenProps) {
  const { accessToken } = useAuth();
  const [players, setPlayers] = useState(INITIAL_PLAYERS);
  // Catégories proposées
  const CATEGORIES = [
    { key: 'TOP_RECENT', label: 'Top Récent' },
    { key: 'GUILTY_PLEASURES', label: 'Guilty Pleasures' },
    { key: 'TOP_5Y', label: 'Hits d’il y a 5 ans' },
    { key: 'SOUNDTRACKS', label: 'Bandes Originales' },
    { key: 'FOCUS_ARTIST', label: 'Focus Artiste' },
  ];
  const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[0].key);

  useEffect(() => {
    if (accessToken) {
      console.log('Access Token in Lobby:', accessToken);
      // Fetch user data from Spotify
      fetch('https://api.spotify.com/v1/me', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })
        .then(response => response.json())
        .then(data => {
          console.log('Spotify User Data:', data);
          const displayName = data.display_name || 'Utilisateur';
          const profileImage = data.images && data.images.length > 0 ? data.images[0].url : null;
          // Update the first player
          setPlayers(prevPlayers => 
            prevPlayers.map((player, index) => 
              index === 0 
                ? { ...player, name: displayName, image: profileImage }
                : player
            )
          );
        })
        .catch(error => {
          console.error('Error fetching Spotify user data:', error);
        });
    }
  }, [accessToken]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="people" color="#1DB954" size={32} />
        <Text style={styles.headerTitle}>SALLE D'ATTENTE</Text>
        <Text style={styles.headerSubtitle}>{players.length} joueurs connectés</Text>
      </View>

      {/* Sélection de la catégorie */}
      <View style={{ marginBottom: 24 }}>
        <Text style={{ color: '#B3B3B3', fontWeight: '700', fontSize: 16, marginBottom: 8 }}>Catégorie de la partie :</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat.key}
              style={{
                backgroundColor: selectedCategory === cat.key ? '#1DB954' : '#282828',
                paddingVertical: 10,
                paddingHorizontal: 16,
                borderRadius: 20,
                marginRight: 8,
                marginBottom: 8,
              }}
              onPress={() => setSelectedCategory(cat.key)}
              activeOpacity={0.8}
            >
              <Text style={{ color: selectedCategory === cat.key ? '#fff' : '#B3B3B3', fontWeight: 'bold' }}>{cat.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Players List */}
      <ScrollView style={styles.playersList} contentContainerStyle={styles.playersContent}>
        {players.map((player, index) => (
          <View key={player.id} style={styles.playerCard}>
            <View style={styles.playerInfo}>
              <View style={[styles.avatar, { backgroundColor: player.color }]}>
                {player.image ? (
                  <Image source={{ uri: player.image }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarEmoji}>{player.emoji}</Text>
                )}
              </View>
              <View style={styles.playerDetails}>
                <Text style={styles.playerName}>{player.name}</Text>
                <Text style={styles.playerStatus}>✓ Prêt</Text>
              </View>
            </View>
            <View style={styles.playerBadge}>
              <Text style={styles.playerNumber}>#{index + 1}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Start Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.startButton}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('Game', { round: 1, gameId: Date.now(), category: selectedCategory })}
        >
          <Ionicons name="play" color="#FFFFFF" size={24} />
          <Text style={styles.startButtonText}>Lancer la partie</Text>
        </TouchableOpacity>

        <Text style={styles.tip}>
          💡 Connectez vos comptes Spotify pour jouer
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#191414',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 30,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    marginTop: 15,
    letterSpacing: 1,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#B3B3B3',
    marginTop: 8,
    fontWeight: '600',
  },
  playersList: {
    flex: 1,
  },
  playersContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  playerCard: {
    backgroundColor: '#282828',
    borderRadius: 16,
    padding: 20,
    marginBottom: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  playerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  playerDetails: {
    marginLeft: 15,
    flex: 1,
  },
  playerName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  playerStatus: {
    fontSize: 13,
    color: '#1DB954',
    marginTop: 4,
    fontWeight: '600',
  },
  playerBadge: {
    backgroundColor: '#1DB954',
    width: 35,
    height: 35,
    borderRadius: 17.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playerNumber: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  footer: {
    paddingHorizontal: 30,
    paddingBottom: 40,
    paddingTop: 20,
  },
  startButton: {
    backgroundColor: '#1DB954',
    paddingVertical: 18,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#1DB954',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 10,
    letterSpacing: 0.5,
  },
  tip: {
    textAlign: 'center',
    color: '#B3B3B3',
    fontSize: 12,
    marginTop: 15,
    fontWeight: '500',
  },
});
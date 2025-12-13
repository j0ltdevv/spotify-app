import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Animated, FlatList } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../App';
import { Ionicons } from '@expo/vector-icons';

type GameOverScreenProps = {
  navigation: NativeStackNavigationProp<RootStackParamList, 'GameOver'>;
  route: RouteProp<RootStackParamList, 'GameOver'>;
};

const { width, height } = Dimensions.get('window');

export default function GameOverScreen({ navigation, route }: GameOverScreenProps) {
  const { results } = route.params;

  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(height));

  useEffect(() => {
    // Animation d'entrée
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 1000, useNativeDriver: true }),
    ]).start();
  }, []);

  const sortedResults = results.sort((a, b) => b.score - a.score);
  const winner = sortedResults[0];

  const renderItem = ({ item, index }: { item: any; index: number }) => (
    <Animated.View style={[styles.playerRow, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      <Text style={styles.rank}>#{index + 1}</Text>
      <View style={[styles.avatar, { backgroundColor: item.avatar.color }]}>
        <Text style={styles.avatarEmoji}>{item.avatar.emoji}</Text>
      </View>
      <View style={styles.playerInfo}>
        <Text style={styles.playerName}>{item.name}</Text>
        <Text style={styles.playerScore}>{item.score} pts</Text>
      </View>
      {index === 0 && <Ionicons name="trophy" size={24} color="#FFD700" />}
    </Animated.View>
  );

  const handleReplay = () => {
    navigation.replace('Game', { round: 1, accessToken: '', gameId: Date.now() });
  };

  const handleBackToMenu = () => {
    navigation.navigate('Lobby', {});
  };

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
        <Text style={styles.gameOverTitle}>GAME OVER</Text>
        <Text style={styles.winnerTitle}>🏆 VAINQUEUR 🏆</Text>
        <View style={styles.winnerContainer}>
          <View style={[styles.winnerAvatar, { backgroundColor: winner.avatar.color }]}>
            <Text style={styles.winnerEmoji}>{winner.avatar.emoji}</Text>
          </View>
          <Text style={styles.winnerName}>{winner.name.toUpperCase()}</Text>
          <Text style={styles.winnerScore}>{winner.score} PTS</Text>
        </View>
      </Animated.View>

      <Animated.View style={[styles.leaderboard, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <Text style={styles.leaderboardTitle}>CLASSEMENT FINAL</Text>
        <FlatList
          data={sortedResults}
          renderItem={renderItem}
          keyExtractor={(item, index) => index.toString()}
          showsVerticalScrollIndicator={false}
        />
      </Animated.View>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.replayButton} onPress={handleReplay} activeOpacity={0.8}>
          <Text style={styles.replayButtonText}>REJOUER</Text>
          <Ionicons name="refresh" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuButton} onPress={handleBackToMenu} activeOpacity={0.8}>
          <Text style={styles.menuButtonText}>RETOUR AU MENU</Text>
          <Ionicons name="home" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#191414',
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  gameOverTitle: {
    fontSize: 48,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 10,
  },
  winnerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1DB954',
    marginBottom: 20,
  },
  winnerContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  winnerAvatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
    borderWidth: 4,
    borderColor: '#FFD700',
  },
  winnerEmoji: {
    fontSize: 60,
  },
  winnerName: {
    fontSize: 32,
    fontWeight: '900',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  winnerScore: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFD700',
    marginTop: 5,
  },
  leaderboard: {
    flex: 1,
    paddingHorizontal: 20,
  },
  leaderboardTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#B3B3B3',
    textAlign: 'center',
    marginBottom: 20,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#282828',
    padding: 15,
    borderRadius: 15,
    marginBottom: 10,
    elevation: 5,
  },
  rank: {
    fontSize: 18,
    fontWeight: '900',
    color: '#FFFFFF',
    width: 40,
    textAlign: 'center',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  avatarEmoji: {
    fontSize: 24,
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  playerScore: {
    fontSize: 14,
    color: '#1DB954',
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: 30,
  },
  replayButton: {
    backgroundColor: '#1DB954',
    paddingVertical: 16,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },
  replayButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 10,
  },
  menuButton: {
    backgroundColor: '#FF6B6B',
    paddingVertical: 16,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
    marginRight: 10,
  },
});
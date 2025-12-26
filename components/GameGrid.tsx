import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants';
import { Player } from '../types';
import GlassCard from './GlassCard';
import PressableCard from './PressableCard';

interface GameGridProps {
  players: Player[];
  selectedPlayer: string | null;
  onVote: (playerId: string) => void;
}

// 🎨 Helper: Calcule la taille des éléments en fonction du nombre de joueurs
const getGridLayout = (numPlayers: number) => {
  if (numPlayers <= 2) return { cardWidth: '80%', avatarSize: 140, nameSize: 20, gap: 16 };
  if (numPlayers <= 4) return { cardWidth: '45%', avatarSize: 100, nameSize: 16, gap: 16 };
  if (numPlayers <= 6) return { cardWidth: '45%', avatarSize: 80, nameSize: 14, gap: 12 };
  return { cardWidth: '30%', avatarSize: 60, nameSize: 12, gap: 8 };
};

export default function GameGrid({ players, selectedPlayer, onVote }: GameGridProps) {
  const { cardWidth, avatarSize, nameSize, gap } = getGridLayout(players.length);

  return (
    <View style={[styles.playersGrid, { gap }]}>
      {players.map(p => (
        <PressableCard key={p.id} style={{ width: cardWidth as any }} onPress={() => onVote(p.id)}>
          <GlassCard style={[styles.playerVote, selectedPlayer === p.id && styles.playerVoteSelected]}>
              {!!p.image ? (
                <Image source={{ uri: p.image }} style={{ width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2, marginBottom: 8 }} />
              ) : (
                <View style={[{ width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2, marginBottom: 8 }, { backgroundColor: p.color || '#555', justifyContent: 'center', alignItems: 'center' }]}>
                    <Text style={{ fontSize: avatarSize * 0.4 }}>{p.emoji || '👤'}</Text>
                </View>
              )}
              <Text style={[styles.playerVoteName, { fontSize: nameSize }]} numberOfLines={1}>{p.name}</Text>
              {selectedPlayer === p.id ? (<View style={styles.checkmarkBadge}><Ionicons name="checkmark" size={avatarSize * 0.18} color="#fff" /></View>) : null}
          </GlassCard>
        </PressableCard>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  playersGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: 'auto', paddingBottom: 20 },
  playerVote: { padding: 8, alignItems: 'center', borderWidth: 3, borderColor: 'transparent', borderRadius: 20, width: '100%' },
  playerVoteSelected: { borderColor: COLORS.SPOTIFY_GREEN },
  playerVoteName: { color: 'white', fontWeight: '700', textAlign: 'center' },
  checkmarkBadge: { position: 'absolute', top: 5, right: 5, width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.SPOTIFY_GREEN, justifyContent: 'center', alignItems: 'center' },
});
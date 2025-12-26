import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  intensity?: number; // Non utilisé ici mais gardé pour la compatibilité
}

export default function GlassCard({ children, style }: GlassCardProps) {
  return (
    <View style={[styles.glass, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  glass: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    overflow: 'hidden',
  },
});
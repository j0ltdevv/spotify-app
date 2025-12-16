import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  intensity?: number;
  borderColor?: string;
}

export default function GlassCard({ 
  children, 
  style, 
  intensity = 20,
  borderColor = 'rgba(255, 255, 255, 0.1)'
}: GlassCardProps) {
  return (
    <View style={[styles.container, style]}>
      {/* Gradient de bordure */}
      <LinearGradient
        colors={['rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0.05)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.borderGradient}
      />
      
      {/* Effet de blur (glassmorphism) */}
      <BlurView intensity={intensity} style={styles.blur}>
        <View style={[styles.content, { borderColor }]}>
          {children}
        </View>
      </BlurView>
      
      {/* Reflet de lumière */}
      <LinearGradient
        colors={['rgba(255, 255, 255, 0.1)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.shine}
        pointerEvents="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
  },
  borderGradient: {
    position: 'absolute',
    top: -1,
    left: -1,
    right: -1,
    bottom: -1,
    borderRadius: 20,
  },
  blur: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  content: {
    backgroundColor: 'rgba(40, 40, 40, 0.5)',
    borderWidth: 1,
    borderRadius: 20,
    overflow: 'hidden',
  },
  shine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '40%',
    pointerEvents: 'none',
  },
});

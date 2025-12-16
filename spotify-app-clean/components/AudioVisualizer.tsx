import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { COLORS } from '../constants';

interface AudioVisualizerProps {
  isPlaying: boolean;
  barCount?: number;
  height?: number;
}

export default function AudioVisualizer({ 
  isPlaying, 
  barCount = 20, 
  height = 100 
}: AudioVisualizerProps) {
  const bars = useRef(
    Array.from({ length: barCount }, () => new Animated.Value(0.3))
  ).current;

  useEffect(() => {
    if (isPlaying) {
      // Animation de chaque barre indépendamment
      const animations = bars.map((bar, index) => {
        return Animated.loop(
          Animated.sequence([
            Animated.timing(bar, {
              toValue: 0.5 + Math.random() * 0.5,
              duration: 300 + Math.random() * 400,
              useNativeDriver: false, // height n'est pas supporté en natif
            }),
            Animated.timing(bar, {
              toValue: 0.2 + Math.random() * 0.3,
              duration: 300 + Math.random() * 400,
              useNativeDriver: false, // height n'est pas supporté en natif
            }),
          ])
        );
      });

      // Démarrer toutes les animations avec un léger délai
      animations.forEach((anim, index) => {
        setTimeout(() => anim.start(), index * 20);
      });

      return () => {
        animations.forEach(anim => anim.stop());
      };
    } else {
      // Réinitialiser les barres
      bars.forEach(bar => {
        Animated.timing(bar, {
          toValue: 0.3,
          duration: 200,
          useNativeDriver: false, // height n'est pas supporté en natif
        }).start();
      });
    }
  }, [isPlaying]);

  return (
    <View style={[styles.container, { height }]}>
      {/* Effet de lueur en arrière-plan */}
      {isPlaying && (
        <View style={styles.glowBackground} />
      )}
      
      {/* Barres animées */}
      {bars.map((bar, index) => {
        const barHeight = bar.interpolate({
          inputRange: [0, 1],
          outputRange: [height * 0.2, height],
        });

        return (
          <Animated.View
            key={index}
            style={[
              styles.bar,
              {
                height: barHeight,
                backgroundColor: isPlaying 
                  ? COLORS.SPOTIFY_GREEN 
                  : COLORS.DARK_SECONDARY,
              },
            ]}
          />
        );
      })}
      
      {/* Effet de vague (overlay) */}
      {isPlaying && (
        <View style={styles.waveOverlay} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    position: 'relative',
  },
  bar: {
    width: 6,
    borderRadius: 3,
    shadowColor: COLORS.SPOTIFY_GREEN,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 4,
  },
  glowBackground: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    backgroundColor: COLORS.SPOTIFY_GREEN,
    opacity: 0.1,
    borderRadius: 20,
  },
  waveOverlay: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(29, 185, 84, 0.3)',
  },
});

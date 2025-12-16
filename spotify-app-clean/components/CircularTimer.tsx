import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Svg, Circle } from 'react-native-svg';
import { COLORS } from '../constants';

interface CircularTimerProps {
  timeLeft: number;
  maxTime: number;
  size?: number;
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export default function CircularTimer({ timeLeft, maxTime, size = 180 }: CircularTimerProps) {
  const progress = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  
  const radius = (size - 20) / 2;
  const circumference = 2 * Math.PI * radius;
  
  useEffect(() => {
    // Animation de la progression circulaire
    Animated.timing(progress, {
      toValue: timeLeft / maxTime,
      duration: 1000,
      useNativeDriver: true,
    }).start();
    
    // Animation d'urgence quand < 10 secondes
    if (timeLeft <= 10 && timeLeft > 0) {
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [timeLeft]);
  
  // Couleur qui évolue progressivement selon le temps restant
  const getTimerColor = () => {
    const ratio = timeLeft / maxTime;
    if (ratio > 0.66) return COLORS.SUCCESS_GREEN;  // Vert : 67%-100%
    if (ratio > 0.5) return '#90EE90';              // Vert clair : 51%-66%
    if (ratio > 0.4) return '#FFD700';              // Jaune : 41%-50%
    if (ratio > 0.26) return COLORS.WARNING_ORANGE; // Orange : 27%-40%
    return COLORS.ERROR_RED;                        // Rouge : 0%-26%
  };
  
  const strokeDashoffset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  return (
    <Animated.View style={[styles.container, { transform: [{ scale: scaleAnim }] }]}>
      <Svg width={size} height={size} style={styles.svg}>
        {/* Cercle de fond */}
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={COLORS.DARK_SECONDARY}
          strokeWidth={10}
          fill="none"
        />
        
        {/* Cercle de progression */}
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={getTimerColor()}
          strokeWidth={10}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      
      {/* Texte du timer au centre */}
      <View style={styles.timerTextContainer}>
        <Text style={[styles.timerText, { color: getTimerColor() }]}>
          {timeLeft}
        </Text>
      </View>
      
      {/* Effet de lueur */}
      {timeLeft <= 10 && (
        <View style={[styles.glow, { backgroundColor: getTimerColor() }]} />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  svg: {
    transform: [{ rotate: '0deg' }],
  },
  timerTextContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerText: {
    fontSize: 48,
    fontWeight: '900',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  timerLabel: {
    fontSize: 12,
    color: COLORS.TEXT_SECONDARY,
    marginTop: -5,
  },
  glow: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    opacity: 0.2,
    zIndex: -1,
  },
});

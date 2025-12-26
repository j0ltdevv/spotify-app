import React, { useEffect, useRef } from 'react';
import { View, Animated, Dimensions, StyleSheet } from 'react-native';

const { width, height } = Dimensions.get('window');

interface ConfettiPieceProps {
  color: string;
  delay: number;
}

const ConfettiPiece = ({ color, delay }: ConfettiPieceProps) => {
  const translateY = useRef(new Animated.Value(-50)).current;
  const translateX = useRef(new Animated.Value(Math.random() * width)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: height + 100,
        duration: 3000 + Math.random() * 2000,
        delay,
        useNativeDriver: true,
      }),
      Animated.timing(translateX, {
        toValue: translateX._value + (Math.random() - 0.5) * 200,
        duration: 3000 + Math.random() * 2000,
        delay,
        useNativeDriver: true,
      }),
      Animated.loop(
        Animated.timing(rotate, {
          toValue: 1,
          duration: 1000 + Math.random() * 1000,
          useNativeDriver: true,
        })
      ),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 3000,
        delay: delay + 1000,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const rotateInterpolate = rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View
      style={[
        styles.confettiPiece,
        {
          backgroundColor: color,
          transform: [
            { translateX },
            { translateY },
            { rotate: rotateInterpolate },
          ],
          opacity,
        },
      ]}
    />
  );
};

export default function Confetti() {
  const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#1DB954', '#FF8E8E', '#A78BFA'];
  const confettiCount = 50;

  return (
    <View style={styles.container} pointerEvents="none">
      {Array.from({ length: confettiCount }).map((_, index) => (
        <ConfettiPiece
          key={index}
          color={colors[Math.floor(Math.random() * colors.length)]}
          delay={Math.random() * 500}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  confettiPiece: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});

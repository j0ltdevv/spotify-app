import React, { useRef } from 'react'; // useRef est mieux pour les valeurs animées
import { Pressable, StyleSheet, ViewStyle, Animated } from 'react-native';
import * as Haptics from 'expo-haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface PressableCardProps {
  children: React.ReactNode;
  onPress: () => void;
  style?: ViewStyle;
  disabled?: boolean;
}

export default function PressableCard({ children, onPress, style, disabled }: PressableCardProps) {
  // Utiliser useRef pour que la valeur persiste entre les rendus
  const animatedScale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(animatedScale, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 20,
    }).start();
    if (!disabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handlePressOut = () => {
    Animated.spring(animatedScale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
    }).start();
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      style={[
        styles.container,
        style,
        disabled && styles.disabled,
        { transform: [{ scale: animatedScale }] }
      ]}
    >
      {children}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  disabled: {
    opacity: 0.6,
  }
});
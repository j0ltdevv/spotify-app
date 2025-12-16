/**
 * SafeContainer.tsx
 * Composant wrapper avec SafeAreaView pour tous les écrans
 */

import React, { ReactNode } from 'react';
import { SafeAreaView, StyleSheet, ViewStyle, StatusBar } from 'react-native';
import { COLORS } from '../constants';

interface SafeContainerProps {
  children: ReactNode;
  style?: ViewStyle;
  backgroundColor?: string;
}

/**
 * Container sécurisé qui gère automatiquement les zones de safe area
 * (encoche iPhone, barre d'accueil, etc.)
 */
const SafeContainer: React.FC<SafeContainerProps> = ({ 
  children, 
  style, 
  backgroundColor = COLORS.DARK_BG 
}) => {
  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor={backgroundColor} />
      <SafeAreaView style={[styles.container, { backgroundColor }, style]}>
        {children}
      </SafeAreaView>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default SafeContainer;

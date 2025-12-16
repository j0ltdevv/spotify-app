import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { COLORS } from '../constants';

interface VideoBackgroundProps {
  source: any; // ex: require('../assets/background.mp4')
  children?: React.ReactNode;
  style?: ViewStyle;
  overlayColor?: string; // Couleur de surcouche optionnelle (ex: 'rgba(0,0,0,0.5)') pour lisibilité
}

const VideoBackground: React.FC<VideoBackgroundProps> = ({ 
  source, 
  children, 
  style,
  overlayColor = 'rgba(0, 0, 0, 0.4)' // Assombrit légèrement par défaut pour que le texte ressorte
}) => {
  return (
    <View style={[styles.container, style]}>
      <Video
        source={source}
        style={StyleSheet.absoluteFill}
        resizeMode={ResizeMode.COVER}
        shouldPlay
        isLooping={false} // Désactiver la lecture en boucle
        isMuted
      />
      
      {/* Overlay pour améliorer la lisibilité du texte */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: overlayColor }]} />
      
      {/* Contenu de l'écran */}
      <View style={styles.content}>
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.DARK_BG, // Fallback si la vidéo ne charge pas
  },
  content: {
    flex: 1,
  }
});

export default VideoBackground;

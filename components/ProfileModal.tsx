import React, { useState } from 'react';
import { View, Text, Modal, StyleSheet, TouchableOpacity, TextInput, Image, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { COLORS } from '../constants';
import GlassCard from './GlassCard';
import PressableCard from './PressableCard';

type ProfileModalProps = {
  visible: boolean;
  onClose: () => void;
  currentUsername: string;
  currentPhotoURL: string | null;
  onSave: (username: string, photoURL: string | null) => Promise<void>;
};

export default function ProfileModal({ visible, onClose, currentUsername, currentPhotoURL, onSave }: ProfileModalProps) {
  const [username, setUsername] = useState(currentUsername);
  const [photoURL, setPhotoURL] = useState<string | null>(currentPhotoURL);
  const [isLoading, setIsLoading] = useState(false);

  const handleTakePhoto = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      // Demander la permission
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission requise', 'Nous avons besoin de votre autorisation pour accéder à la caméra.');
        return;
      }

      // Ouvrir la caméra
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled && result.assets[0]) {
        setPhotoURL(result.assets[0].uri);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Erreur lors de la prise de photo:', error);
      Alert.alert('Erreur', 'Impossible de prendre une photo.');
    }
  };

  const handlePickPhoto = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      // Demander la permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission requise', 'Nous avons besoin de votre autorisation pour accéder à la galerie.');
        return;
      }

      // Ouvrir la galerie
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled && result.assets[0]) {
        setPhotoURL(result.assets[0].uri);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (error) {
      console.error('Erreur lors de la sélection de photo:', error);
      Alert.alert('Erreur', 'Impossible de sélectionner une photo.');
    }
  };

  const handleSave = async () => {
    if (username.trim().length === 0) {
      Alert.alert('Pseudo requis', 'Veuillez entrer un pseudo.');
      return;
    }

    try {
      setIsLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await onSave(username.trim(), photoURL);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      Alert.alert('Erreur', 'Impossible de sauvegarder le profil.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemovePhoto = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPhotoURL(null);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <GlassCard style={styles.modalContent} intensity={40}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Mon Profil</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="white" />
              </TouchableOpacity>
            </View>

            {/* Photo de profil */}
            <View style={styles.photoSection}>
              <View style={styles.photoContainer}>
                {photoURL ? (
                  <Image source={{ uri: photoURL }} style={styles.photoImage} />
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Ionicons name="person" size={60} color="#666" />
                  </View>
                )}
                {photoURL && (
                  <TouchableOpacity 
                    style={styles.removePhotoButton}
                    onPress={handleRemovePhoto}
                  >
                    <Ionicons name="close-circle" size={28} color="#FF6B6B" />
                  </TouchableOpacity>
                )}
              </View>
              
              <View style={styles.photoButtons}>
                <PressableCard onPress={handleTakePhoto} style={styles.photoButton}>
                  <View style={styles.photoButtonContent}>
                    <Ionicons name="camera" size={24} color={COLORS.SPOTIFY_GREEN} />
                    <Text style={styles.photoButtonText}>Prendre</Text>
                  </View>
                </PressableCard>
                
                <PressableCard onPress={handlePickPhoto} style={styles.photoButton}>
                  <View style={styles.photoButtonContent}>
                    <Ionicons name="images" size={24} color={COLORS.SPOTIFY_GREEN} />
                    <Text style={styles.photoButtonText}>Galerie</Text>
                  </View>
                </PressableCard>
              </View>
            </View>

            {/* Input pseudo */}
            <View style={styles.usernameSection}>
              <Text style={styles.label}>Pseudo</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={20} color="#999" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={username}
                  onChangeText={setUsername}
                  placeholder="Ton pseudo de détective..."
                  placeholderTextColor="#666"
                  maxLength={20}
                  autoCapitalize="none"
                />
                <Text style={styles.charCount}>{username.length}/20</Text>
              </View>
            </View>

            {/* Bouton Sauvegarder */}
            <PressableCard onPress={handleSave} disabled={isLoading} style={styles.saveButtonCard}>
              <LinearGradient
                colors={[COLORS.SPOTIFY_GREEN, '#158a3f']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.saveButton}
              >
                <Ionicons name="checkmark-circle" size={24} color="white" />
                <Text style={styles.saveButtonText}>
                  {isLoading ? 'Enregistrement...' : 'Enregistrer'}
                </Text>
              </LinearGradient>
            </PressableCard>
          </GlassCard>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'flex-start',
    alignItems: 'center',
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 80 : 60,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
  },
  modalContent: {
    borderRadius: 24,
    padding: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: 'white',
    letterSpacing: 0.5,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  photoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 16,
    position: 'relative',
  },
  photoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 60,
    borderWidth: 3,
    borderColor: COLORS.SPOTIFY_GREEN,
  },
  photoPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 60,
    backgroundColor: '#282828',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#444',
  },
  removePhotoButton: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#121212',
    borderRadius: 14,
  },
  photoButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  photoButton: {
    borderRadius: 12,
  },
  photoButtonContent: {
    backgroundColor: 'rgba(29, 185, 84, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(29, 185, 84, 0.3)',
  },
  photoButtonText: {
    color: COLORS.SPOTIFY_GREEN,
    fontSize: 14,
    fontWeight: '700',
  },
  usernameSection: {
    marginBottom: 24,
  },
  label: {
    color: 'white',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#282828',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#333',
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    paddingVertical: 14,
  },
  charCount: {
    color: '#666',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 8,
  },
  saveButtonCard: {
    borderRadius: 16,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});

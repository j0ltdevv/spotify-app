import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Modal, TextInput, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useSettings } from '../contexts/SettingsContext';
import { COLORS } from '../constants';
import GlassCard from './GlassCard';
import PressableCard from './PressableCard';

interface ProfileModalProps {
  visible: boolean;
  onClose: () => void;
  currentUsername: string;
  currentPhotoURL: string | null;
  onSave: (username: string, photoURL: string | null) => Promise<void>;
}

export default function ProfileModal({ visible, onClose, currentUsername, currentPhotoURL, onSave }: ProfileModalProps) {
  const [username, setUsername] = useState(currentUsername);
  const [photoURL, setPhotoURL] = useState<string | null>(currentPhotoURL);
  const [isLoading, setIsLoading] = useState(false);
  const { t } = useSettings(); // 🌍 Use translation hook

  const handleTakePhoto = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('permission_required'), t('camera_permission_msg')); // ✅ Translated
        return;
      }

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
      Alert.alert(t('error'), t('camera_error')); // ✅ Translated
    }
  };

  const handlePickPhoto = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(t('permission_required'), t('gallery_permission_msg')); // ✅ Translated
        return;
      }

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
      Alert.alert(t('error'), t('gallery_error')); // ✅ Translated
    }
  };

  const handleSave = async () => {
    if (username.trim().length === 0) {
      Alert.alert(t('pseudo_required'), t('pseudo_missing')); // ✅ Translated
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
      Alert.alert(t('error'), t('save_error')); // ✅ Translated
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
              <Text style={styles.modalTitle}>{t('my_profile')}</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="white" />
              </TouchableOpacity>
            </View>

            {/* Photo de profil */}
            <View style={styles.photoSection}>
              <View style={styles.photoContainer}>
                {!!photoURL ? (
                  <Image source={{ uri: photoURL }} style={styles.photoImage} />
                ) : (
                  <View style={styles.photoPlaceholder}>
                    <Ionicons name="person" size={60} color="#666" />
                  </View>
                )}
                {!!photoURL ? (
                  <TouchableOpacity 
                    style={styles.removePhotoButton}
                    onPress={handleRemovePhoto}
                  >
                    <Ionicons name="close-circle" size={28} color="#FF6B6B" />
                  </TouchableOpacity>
                ) : null}
                <View style={styles.editBadge}>
                    <Ionicons name="pencil" size={14} color="white" />
                </View>
              </View>
              
              <View style={styles.photoButtons}>
                <PressableCard onPress={handleTakePhoto} style={styles.photoButton}>
                  <View style={styles.photoButtonContent}>
                    <Ionicons name="camera" size={20} color={COLORS.SPOTIFY_GREEN} />
                    <Text style={styles.photoButtonText}>{t('camera')}</Text>
                  </View>
                </PressableCard>
                
                <PressableCard onPress={handlePickPhoto} style={styles.photoButton}>
                  <View style={styles.photoButtonContent}>
                    <Ionicons name="images" size={20} color={COLORS.SPOTIFY_GREEN} />
                    <Text style={styles.photoButtonText}>{t('gallery')}</Text>
                  </View>
                </PressableCard>
              </View>
            </View>

            {/* Input pseudo */}
            <View style={styles.usernameSection}>
              <Text style={styles.label}>{t('identity_secret')}</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="person-outline" size={20} color={COLORS.SPOTIFY_GREEN} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={username}
                  onChangeText={setUsername}
                  placeholder={t('pseudo_placeholder')}
                  placeholderTextColor="#555"
                  maxLength={15}
                  autoCapitalize="none"
                />
                <Text style={styles.charCount}>{username.length}/15</Text>
              </View>
            </View>

            {/* Stats (Décoratif pour l'instant) */}
            <View style={styles.statsRow}>
                <View style={styles.statCard}>
                    <Ionicons name="trophy" size={24} color="#FFD700" />
                    <Text style={styles.statValue}>--</Text>
                    <Text style={styles.statLabel}>{t('wins')}</Text>
                </View>
                <View style={styles.statCard}>
                    <Ionicons name="flame" size={24} color="#FF6B6B" />
                    <Text style={styles.statValue}>--</Text>
                    <Text style={styles.statLabel}>{t('streak')}</Text>
                </View>
                <View style={styles.statCard}>
                    <Ionicons name="musical-notes" size={24} color="#4ECDC4" />
                    <Text style={styles.statValue}>--</Text>
                    <Text style={styles.statLabel}>{t('titles')}</Text>
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
                  {isLoading ? t('saving') : t('save')}
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
    borderWidth: 4,
    borderColor: 'rgba(29, 185, 84, 0.2)',
  },
  photoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 60,
    borderWidth: 2,
    borderColor: COLORS.SPOTIFY_GREEN,
  },
  photoPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 60,
    backgroundColor: '#181818',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#333',
  },
  removePhotoButton: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#121212',
    borderRadius: 14,
    zIndex: 10,
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: COLORS.SPOTIFY_GREEN,
    width: 32, height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#181818',
  },
  photoButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  photoButton: {
    borderRadius: 12,
  },
  photoButtonContent: {
    backgroundColor: '#181818',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  photoButtonText: {
    color: '#CCC',
    fontSize: 13,
    fontWeight: '600',
  },
  usernameSection: {
    marginBottom: 24,
  },
  label: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 8,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#121212',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#333',
    paddingHorizontal: 16,
    height: 56,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
    height: '100%',
  },
  charCount: {
    color: '#444',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 8,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  statCard: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    color: 'white',
    fontSize: 18,
    fontWeight: '900',
    marginVertical: 4,
  },
  statLabel: {
    color: '#666',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
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

import React from 'react';
import { View, Text, StyleSheet, Switch, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSettings, AppSettings } from '../contexts/SettingsContext';
import { useAuth } from '../contexts/AuthContext';
import SafeContainer from '../components/SafeContainer';
import GlassCard from '../components/GlassCard';
import { COLORS } from '../constants';
import * as Linking from 'expo-linking';
import { registerForPushNotificationsAsync } from '../services/NotificationService';

type SettingsScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

export default function SettingsScreen({ navigation }: SettingsScreenProps) {
  const { settings, updateSetting, resetSettings } = useSettings();
  const { user, deleteAccount } = useAuth(); // Get deleteAccount from context

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Menu'); 
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Supprimer mon compte",
      "ATTENTION : Cette action est irréversible. Toutes vos données (scores, historique, profil) seront définitivement effacées.",
      [
        { text: "Annuler", style: "cancel" },
        { 
          text: "Supprimer définitivement", 
          style: "destructive", 
          onPress: async () => {
            try {
              await deleteAccount();
              // La redirection vers Welcome se fera automatiquement via le AuthContext qui change l'état user
            } catch (error) {
              Alert.alert("Erreur", "Impossible de supprimer le compte. Veuillez vous reconnecter et réessayer.");
            }
          }
        }
      ]
    );
  };

  const handleNotificationToggle = async (newValue: boolean) => {
    if (newValue) {
        // Activation : On demande la permission
        try {
            const token = await registerForPushNotificationsAsync();
            if (token) {
                console.log("✅ Notifications activées, Token:", token);
                updateSetting('notificationsEnabled', true);
                // TODO: Sauvegarder ce token dans Firebase user profile
            } else {
                Alert.alert("Permission requise", "Pour activer les notifications, vous devez autoriser l'application dans les réglages de votre téléphone.");
                updateSetting('notificationsEnabled', false);
            }
        } catch (error) {
            console.error("Erreur activation notifs:", error);
            updateSetting('notificationsEnabled', false);
        }
    } else {
        // Désactivation
        updateSetting('notificationsEnabled', false);
        // TODO: Supprimer le token de Firebase pour ne plus être dérangé
    }
  };

  const handleReset = () => {
    Alert.alert(
      "Réinitialiser les paramètres",
      "Voulez-vous vraiment remettre tous les paramètres par défaut ?",
      [
        { text: "Annuler", style: "cancel" },
        { text: "Réinitialiser", style: "destructive", onPress: resetSettings }
      ]
    );
  };

  const openLink = async (url: string) => {
    console.log(`[Settings] Tentative d'ouverture du lien : ${url}`);
    try {
        const supported = await Linking.canOpenURL(url);
        if (supported) {
            await Linking.openURL(url);
        } else {
            console.warn(`[Settings] Impossible d'ouvrir l'URL : ${url}`);
            Alert.alert("Erreur", "Impossible d'ouvrir ce lien sur votre appareil.");
        }
    } catch (err) {
        console.error("[Settings] Erreur critique lors de l'ouverture du lien", err);
        Alert.alert("Erreur", "Une erreur est survenue lors de l'ouverture du lien.");
    }
  };

  const SettingItem = ({ 
    label, 
    value, 
    onValueChange, 
    icon, 
    description,
    disabled = false
  }: { 
    label: string; 
    value: boolean; 
    onValueChange: (val: boolean) => void;
    icon: keyof typeof Ionicons.glyphMap;
    description?: string;
    disabled?: boolean;
  }) => (
    <TouchableOpacity 
        style={styles.settingItem} 
        activeOpacity={0.7}
        onPress={() => {
            if (!disabled) {
                console.log(`[Settings] Row tapped: Toggling ${label} to ${!value}`);
                onValueChange(!value);
            }
        }}
    >
      <View style={styles.settingIconContainer}>
        <Ionicons name={icon} size={22} color={COLORS.TEXT_PRIMARY} />
      </View>
      <View style={styles.settingContent}>
        <Text style={styles.settingLabel}>{label}</Text>
        {description && <Text style={styles.settingDescription}>{description}</Text>}
      </View>
      <View pointerEvents="none">
        <Switch
            trackColor={{ false: '#3e3e3e', true: 'rgba(29, 185, 84, 0.5)' }}
            thumbColor={value ? COLORS.SPOTIFY_GREEN : '#f4f3f4'}
            ios_backgroundColor="#3e3e3e"
            value={value}
            disabled={disabled}
        />
      </View>
    </TouchableOpacity>
  );

  const SectionHeader = ({ title }: { title: string }) => (
    <Text style={styles.sectionTitle}>{title}</Text>
  );

  if (!settings) return null; // Safety check

  return (
    <SafeContainer>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={handleBack}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.TEXT_PRIMARY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Paramètres</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* SECTION AUDIO */}
        <SectionHeader title="AUDIO & SON" />
        <GlassCard style={styles.card}>
          <SettingItem
            label="Effets sonores"
            description="Sons de victoire, compte à rebours..."
            icon="musical-note"
            value={settings.soundEnabled}
            onValueChange={(v) => updateSetting('soundEnabled', v)}
          />
          <View style={styles.divider} />
          <SettingItem
            label="Audio Haute Qualité"
            description="Utilise plus de données"
            icon="cellular"
            value={settings.highQualityAudio}
            onValueChange={(v) => updateSetting('highQualityAudio', v)}
          />
        </GlassCard>

        {/* SECTION INTERFACE */}
        <SectionHeader title="INTERFACE" />
        <GlassCard style={styles.card}>
          <SettingItem
            label="Vibrations"
            description="Retour haptique au toucher"
            icon="phone-portrait-outline"
            value={settings.hapticsEnabled}
            onValueChange={(v) => updateSetting('hapticsEnabled', v)}
          />
          <View style={styles.divider} />
          <SettingItem
            label="Notifications"
            description="Invitations et mises à jour"
            icon="notifications-outline"
            value={settings.notificationsEnabled}
            onValueChange={handleNotificationToggle}
          />
        </GlassCard>

        {/* SECTION A PROPOS */}
        <SectionHeader title="À PROPOS" />
        <GlassCard style={styles.card}>
           <TouchableOpacity style={styles.linkItem} onPress={() => openLink('https://github.com/votre-repo')}>
            <View style={styles.linkContent}>
              <Ionicons name="logo-github" size={22} color={COLORS.TEXT_PRIMARY} />
              <Text style={styles.linkLabel}>Code Source</Text>
            </View>
            <Ionicons name="open-outline" size={20} color={COLORS.TEXT_SECONDARY} />
          </TouchableOpacity>
          
          <View style={styles.divider} />
          
          <TouchableOpacity style={styles.linkItem} onPress={() => navigation.navigate('Legal')}>
            <View style={styles.linkContent}>
              <Ionicons name="information-circle-outline" size={22} color={COLORS.TEXT_PRIMARY} />
              <Text style={styles.linkLabel}>Mentions Légales & Conditions</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.TEXT_SECONDARY} />
          </TouchableOpacity>

          <View style={styles.divider} />

          <View style={styles.versionContainer}>
             <Text style={styles.versionLabel}>Version de l'application</Text>
             <Text style={styles.versionValue}>1.2.0 (Build 2024)</Text>
          </View>
        </GlassCard>

        {/* ZONE DANGER */}
        <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
          <Text style={styles.resetText}>Rétablir les paramètres par défaut</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.resetButton, { marginTop: 10, marginBottom: 40 }]} onPress={handleDeleteAccount}>
          <Text style={[styles.resetText, { color: '#D32F2F', fontWeight: '800' }]}>SUPPRIMER MON COMPTE</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.TEXT_PRIMARY,
    letterSpacing: 0.5,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.TEXT_SECONDARY,
    marginTop: 20,
    marginBottom: 10,
    marginLeft: 10,
    letterSpacing: 1,
  },
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    padding: 0, // Pour que les items touchent les bords
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    justifyContent: 'space-between',
  },
  settingIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingContent: {
    flex: 1,
    marginRight: 10,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.TEXT_PRIMARY,
  },
  settingDescription: {
    fontSize: 12,
    color: COLORS.TEXT_SECONDARY,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginLeft: 64, // Aligné avec le texte
  },
  linkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  linkContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  linkLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.TEXT_PRIMARY,
  },
  versionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  versionLabel: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
  },
  versionValue: {
    fontSize: 14,
    color: COLORS.TEXT_SECONDARY,
    fontWeight: '700',
  },
  resetButton: {
    marginTop: 30,
    alignItems: 'center',
    padding: 15,
  },
  resetText: {
    color: '#FF6B6B',
    fontSize: 14,
    fontWeight: '600',
  },
});

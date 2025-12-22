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
import { Language } from '../constants/translations';

type SettingsScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

export default function SettingsScreen({ navigation }: SettingsScreenProps) {
  const { settings, updateSetting, resetSettings, t } = useSettings();
  const { firebaseUser, logout, deleteAccount } = useAuth(); // Get deleteAccount and logout

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('Menu'); 
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      t('delete_account_title'),
      t('delete_account_warning'),
      [
        { text: t('cancel'), style: "cancel" },
        { 
          text: t('delete_account_final'), 
          style: "destructive", 
          onPress: async () => {
            try {
              await deleteAccount();
            } catch (error) {
              Alert.alert(t('error'), t('delete_account_error'));
            }
          }
        }
      ]
    );
  };

  const handleNotificationToggle = async (newValue: boolean) => {
    if (newValue) {
        try {
            const token = await registerForPushNotificationsAsync();
            if (token) {
                console.log("✅ Notifications activées, Token:", token);
                updateSetting('notificationsEnabled', true);
            } else {
                Alert.alert(t('notification_permission_title'), t('notification_permission_desc'));
                updateSetting('notificationsEnabled', false);
            }
        } catch (error) {
            console.error(t('notification_error'), error);
            updateSetting('notificationsEnabled', false);
        }
    } else {
        updateSetting('notificationsEnabled', false);
    }
  };

  const handleReset = () => {
    Alert.alert(
      t('reset_settings'),
      t('reset_confirm'),
      [
        { text: t('cancel'), style: "cancel" },
        { text: t('reset_settings'), style: "destructive", onPress: resetSettings }
      ]
    );
  };

  const openLink = async (url: string) => {
    try {
        const supported = await Linking.canOpenURL(url);
        if (supported) {
            await Linking.openURL(url);
        } else {
            Alert.alert(t('error'), t('open_link_error'));
        }
    } catch (err) {
        Alert.alert(t('error'), t('generic_error'));
    }
  };

  const SettingItem = ({ 
    label, value, onValueChange, icon, description, disabled = false
  }: { 
    label: string; value: boolean; onValueChange: (val: boolean) => void;
    icon: keyof typeof Ionicons.glyphMap; description?: string; disabled?: boolean;
  }) => (
    <TouchableOpacity style={styles.settingItem} activeOpacity={0.7} onPress={() => { if (!disabled) onValueChange(!value); }}>
      <View style={styles.settingIconContainer}><Ionicons name={icon} size={22} color={COLORS.TEXT_PRIMARY} /></View>
      <View style={styles.settingContent}><Text style={styles.settingLabel}>{label}</Text>{!!description ? <Text style={styles.settingDescription}>{description}</Text> : null}</View>
      <View pointerEvents="none"><Switch trackColor={{ false: '#3e3e3e', true: 'rgba(29, 185, 84, 0.5)' }} thumbColor={value ? COLORS.SPOTIFY_GREEN : '#f4f3f4'} ios_backgroundColor="#3e3e3e" value={value} disabled={disabled}/></View>
    </TouchableOpacity>
  );

  const LanguageSelector = ({ 
    value, onValueChange 
  }: { 
    value: Language, onValueChange: (lang: Language) => void 
  }) => (
    <View style={styles.settingItem}>
      <View style={styles.settingIconContainer}><Ionicons name="language" size={22} color={COLORS.TEXT_PRIMARY} /></View>
      <View style={styles.settingContent}><Text style={styles.settingLabel}>{t('language')}</Text></View>
      <View style={styles.langSelectorContainer}>
        <TouchableOpacity onPress={() => onValueChange('fr')} style={[styles.langButton, value === 'fr' && styles.langButtonActive]}><Text style={[styles.langButtonText, value === 'fr' && styles.langButtonTextActive]}>FR</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => onValueChange('en')} style={[styles.langButton, value === 'en' && styles.langButtonActive]}><Text style={[styles.langButtonText, value === 'en' && styles.langButtonTextActive]}>EN</Text></TouchableOpacity>
      </View>
    </View>
  );

  const SectionHeader = ({ title }: { title: string }) => (<Text style={styles.sectionTitle}>{title}</Text>);

  if (!settings) return null;

  return (
    <SafeContainer>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleBack}><Ionicons name="arrow-back" size={24} color={COLORS.TEXT_PRIMARY} /></TouchableOpacity>
        <Text style={styles.headerTitle}>{t('settings_title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* SECTION INTERFACE */}
        <SectionHeader title={t('interface_section')} />
        <GlassCard style={styles.card}>
          <LanguageSelector value={settings.language} onValueChange={(v) => updateSetting('language', v)} />
          <View style={styles.divider} />
          <SettingItem label={t('haptics')} description="Retour haptique au toucher" icon="phone-portrait-outline" value={settings.hapticsEnabled} onValueChange={(v) => updateSetting('hapticsEnabled', v)}/>
          <View style={styles.divider} />
          <SettingItem label={t('notifications')} description="Invitations et mises à jour" icon="notifications-outline" value={settings.notificationsEnabled} onValueChange={handleNotificationToggle}/>
        </GlassCard>

        {/* SECTION AUDIO */}
        <SectionHeader title={t('audio_section')} />
        <GlassCard style={styles.card}>
          <SettingItem label={t('sound_effects')} description="Sons de victoire, compte à rebours..." icon="musical-note" value={settings.soundEnabled} onValueChange={(v) => updateSetting('soundEnabled', v)}/>
          <View style={styles.divider} />
          <SettingItem label={t('high_quality')} description="Utilise plus de données" icon="cellular" value={settings.highQualityAudio} onValueChange={(v) => updateSetting('highQualityAudio', v)}/>
        </GlassCard>

        {/* SECTION A PROPOS */}
        <SectionHeader title={t('about_section')} />
        <GlassCard style={styles.card}>
           <TouchableOpacity style={styles.linkItem} onPress={() => openLink('https://github.com/votre-repo')}><View style={styles.linkContent}><Ionicons name="logo-github" size={22} color={COLORS.TEXT_PRIMARY} /><Text style={styles.linkLabel}>{t('source_code')}</Text></View><Ionicons name="open-outline" size={20} color={COLORS.TEXT_SECONDARY} /></TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.linkItem} onPress={() => navigation.navigate('Legal')}><View style={styles.linkContent}><Ionicons name="information-circle-outline" size={22} color={COLORS.TEXT_PRIMARY} /><Text style={styles.linkLabel}>{t('legal')}</Text></View><Ionicons name="chevron-forward" size={20} color={COLORS.TEXT_SECONDARY} /></TouchableOpacity>
          <View style={styles.divider} />
          <View style={styles.versionContainer}><Text style={styles.versionLabel}>{t('version')}</Text><Text style={styles.versionValue}>1.3.0</Text></View>
        </GlassCard>

        {/* ZONE DANGER */}
        <TouchableOpacity style={styles.resetButton} onPress={handleReset}><Text style={styles.resetText}>{t('reset_settings')}</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.resetButton, { marginTop: 10, marginBottom: 40 }]} onPress={handleDeleteAccount}><Text style={[styles.resetText, { color: '#D32F2F', fontWeight: '800' }]}>{t('delete_account')}</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.resetButton, { marginTop: -20 }]} onPress={logout}><Text style={[styles.resetText, { color: '#FF6B6B'}]}>{t('logout')}</Text></TouchableOpacity>

      </ScrollView>
    </SafeContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 15, },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', },
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.TEXT_PRIMARY, letterSpacing: 0.5, },
  scrollContent: { padding: 20, paddingBottom: 40, },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: COLORS.TEXT_SECONDARY, marginTop: 20, marginBottom: 10, marginLeft: 10, letterSpacing: 1, },
  card: { borderRadius: 16, overflow: 'hidden', padding: 0, },
  settingItem: { flexDirection: 'row', alignItems: 'center', padding: 16, justifyContent: 'space-between', },
  settingIconContainer: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 12, },
  settingContent: { flex: 1, marginRight: 10, },
  settingLabel: { fontSize: 16, fontWeight: '600', color: COLORS.TEXT_PRIMARY, },
  settingDescription: { fontSize: 12, color: COLORS.TEXT_SECONDARY, marginTop: 2, },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginLeft: 64, },
  linkItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, },
  linkContent: { flexDirection: 'row', alignItems: 'center', gap: 12, },
  linkLabel: { fontSize: 16, fontWeight: '500', color: COLORS.TEXT_PRIMARY, },
  versionContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: 'rgba(0,0,0,0.2)', },
  versionLabel: { fontSize: 14, color: COLORS.TEXT_SECONDARY, },
  versionValue: { fontSize: 14, color: COLORS.TEXT_SECONDARY, fontWeight: '700', },
  resetButton: { marginTop: 30, alignItems: 'center', padding: 15, },
  resetText: { color: '#FF6B6B', fontSize: 14, fontWeight: '600', },
  langSelectorContainer: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: 2, },
  langButton: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, },
  langButtonActive: { backgroundColor: COLORS.SPOTIFY_GREEN, shadowColor: COLORS.SPOTIFY_GREEN, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 8, },
  langButtonText: { color: 'white', fontWeight: '700', fontSize: 13, },
  langButtonTextActive: { color: '#000' },
});

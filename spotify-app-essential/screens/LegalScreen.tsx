import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import SafeContainer from '../components/SafeContainer';
import { COLORS } from '../constants';

type LegalScreenProps = {
  navigation: NativeStackNavigationProp<any>;
};

export default function LegalScreen({ navigation }: LegalScreenProps) {
  
  const Section = ({ title, children }: { title: string, children: React.ReactNode }) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionText}>{children}</Text>
    </View>
  );

  return (
    <SafeContainer>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.TEXT_PRIMARY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mentions Légales</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        
        <Text style={styles.lastUpdate}>Dernière mise à jour : 20 Décembre 2025</Text>

        <Section title="1. À propos de l'application">
          Who Listening est un jeu de quiz musical à but divertissant. L'application est développée par Julien Poitou et Eloic Cottier et n'a pas de but commercial direct.
        </Section>

        <Section title="2. Utilisation des données (Confidentialité)">
          Nous respectons votre vie privée. Voici les données que nous utilisons :
          {"\n\n"}• **Authentification :** Nous utilisons votre compte Spotify uniquement pour identifier votre profil (Nom, Photo) et récupérer vos playlists pour le jeu.
          {"\n"}• **Firebase :** Nous utilisons Google Firebase pour stocker temporairement l'état de la partie en cours (scores, manche actuelle). Ces données ne sont pas revendues.
          {"\n"}• **Notifications :** Si vous l'acceptez, nous stockons un "token" unique pour vous envoyer des invitations de jeu. Vous pouvez retirer ce consentement à tout moment dans les réglages.
        </Section>

        <Section title="3. Propriété Intellectuelle & Spotify">
          Cette application utilise l'API Web de Spotify mais n'est pas endossée, certifiée ou autrement approuvée par Spotify.
          {"\n\n"}
          • Toutes les musiques, titres, pochettes d'albums et noms d'artistes sont la propriété exclusive de leurs ayants droit respectifs.
          {"\n"}• Le contenu est fourni uniquement à des fins de démonstration et de jeu via les extraits officiels fournis par les plateformes (Spotify, Deezer, iTunes).
          {"\n"}• Logo et nom : Who Listening est un produit indépendant.
        </Section>

        <Section title="4. Responsabilité">
          L'application est fournie "telle quelle". Nous ne garantissons pas qu'elle sera exempte d'erreurs ou disponible en permanence. L'utilisation de l'application se fait à vos propres risques.
        </Section>

        <Section title="5. Suppression des données">
          Vous pouvez demander la suppression intégrale de vos données de jeu en nous contactant ou en supprimant votre compte via les paramètres de l'application (fonctionnalité à venir).
        </Section>

        <Section title="Contact">
          Pour toute question légale ou technique, vous pouvez nous contacter à : julien234aa@gmail.com
        </Section>

        <View style={styles.footer}>
            <Text style={styles.footerText}>Fait avec ❤️ et de la musique.</Text>
        </View>

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
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
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
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.TEXT_PRIMARY,
  },
  content: {
    padding: 24,
    paddingBottom: 50,
  },
  lastUpdate: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 12,
    marginBottom: 24,
    fontStyle: 'italic',
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.SPOTIFY_GREEN,
    marginBottom: 12,
  },
  sectionText: {
    fontSize: 15,
    color: '#E0E0E0',
    lineHeight: 24,
    textAlign: 'justify',
  },
  footer: {
    marginTop: 20,
    alignItems: 'center',
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  footerText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 14,
  }
});

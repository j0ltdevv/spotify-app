import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  Modal, 
  StyleSheet, 
  FlatList, 
  Image, 
  ActivityIndicator,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants';
import { GameTrack } from '../types';

// --- Types Deezer (Internes au composant) ---

interface DeezerPlaylist {
  id: number;
  title: string;
  picture_medium: string;
  nb_tracks: number;
  user?: {
    name: string;
  };
}

interface DeezerTrack {
  id: number;
  title: string;
  artist: {
    name: string;
  };
  album: {
    title: string;
    cover_medium: string;
  };
  preview: string;
}

// --- Props du Composant ---

interface DeezerImportModalProps {
  visible: boolean;
  onClose: () => void;
  onPlaylistSelected: (tracks: GameTrack[], playlistName: string) => void;
}

// --- Composant Principal ---

const DeezerImportModal: React.FC<DeezerImportModalProps> = ({ visible, onClose, onPlaylistSelected }) => {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  
  // --- Logic 3. Normalisation (Adapter Pattern) ---
  const normalizeDeezerTrack = (track: DeezerTrack): GameTrack => {
    return {
      id: track.id.toString(),
      title: track.title,
      artist: track.artist.name,
      album: track.album.title,
      albumImage: track.album.cover_medium,
      preview_url: track.preview,
      correctPlayer: 'Deezer', // Valeur par défaut
      source: 'Deezer'
    };
  };

  // --- Logic 2. Cœur du système ---

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);

    try {
      await handleUrlImport(query);
    } catch (error) {
      console.error('Erreur Deezer:', error);
      Alert.alert('Erreur', 'Impossible de récupérer les données Deezer.');
    } finally {
      setLoading(false);
    }
  };

  const handleUrlImport = async (url: string) => {
    console.log('Deezer URL input:', url); // Log pour debug
    let finalUrl = url;

    // Gestion des liens courts (link.deezer.com ou deezer.page.link)
    if (url.includes('link.deezer.com') || url.includes('deezer.page.link')) {
        try {
            console.log('Resolving short link...');
            const response = await fetch(url, { method: 'HEAD' }); // On demande juste les en-têtes pour suivre la redirection
            finalUrl = response.url;
            console.log('Resolved URL:', finalUrl);
        } catch (error) {
            console.error('Error resolving short link:', error);
            // On continue avec l'URL d'origine au cas où, mais ça risque d'échouer
        }
    }

    // Regex améliorée pour supporter :
    // - https://www.deezer.com/fr/playlist/123456
    // - https://deezer.com/playlist/123456
    // - playlist/123456
    const regex = /playlist\/(\d+)/;
    const match = finalUrl.match(regex);
    
    if (!match || !match[1]) {
      // Tentative de fallback : chercher juste une série de chiffres à la fin si c'est une URL propre
      const fallbackRegex = /(\d+)$/;
      const fallbackMatch = finalUrl.split('?')[0].match(fallbackRegex); // Enlever les query params

      if (fallbackMatch && fallbackMatch[1]) {
         console.log('Deezer ID found (fallback):', fallbackMatch[1]);
         await fetchAndStartPlaylist(fallbackMatch[1]);
         return;
      }

      console.log('Deezer regex match failed on:', finalUrl);
      Alert.alert('Lien invalide', 'Impossible de trouver l\'ID de la playlist. Assurez-vous d\'utiliser un lien complet (ex: deezer.com/playlist/...)');
      return;
    }

    const playlistId = match[1];
    console.log('Deezer ID found:', playlistId);
    await fetchAndStartPlaylist(playlistId);
  };

  const fetchAndStartPlaylist = async (playlistId: string | number) => {
    setLoading(true);
    try {
      // 2. Appelle l'API Playlist
      const response = await fetch(`https://api.deezer.com/playlist/${playlistId}`);
      const data = await response.json();

      if (data.tracks && data.tracks.data) {
        // Filtrer les tracks sans preview
        const validTracks = data.tracks.data.filter((t: any) => t.preview);
        
        if (validTracks.length === 0) {
          Alert.alert('Erreur', 'Cette playlist ne contient aucun extrait écoutable (30s).');
          return;
        }

        // 3. Récupère les tracks et formate-les
        const formattedTracks = validTracks.map((t: any) => normalizeDeezerTrack(t));

        // 4. Lance la partie
        onPlaylistSelected(formattedTracks, data.title || 'Playlist Deezer');
        handleClose();
      } else {
        Alert.alert('Erreur', 'Impossible de lire cette playlist.');
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Erreur', 'Erreur réseau lors du chargement de la playlist.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setQuery('');
    setLoading(false); // Réinitialiser le loading aussi
    onClose();
  };

  // --- Rendu UI ---

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.SPOTIFY_GREEN} />
          <Text style={styles.loadingText}>Connexion à Deezer...</Text>
        </View>
      );
    }

    return (
      <View>
        <View style={styles.inputContainer}>
          <Ionicons name="link-outline" size={24} color="#888" style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Colle un lien de playlist Deezer"
            placeholderTextColor="#666"
            value={query}
            onChangeText={setQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        <Text style={styles.helperText}>Ex: "https://deezer.com/fr/playlist/..."</Text>
        
        <TouchableOpacity style={styles.searchButton} onPress={handleSearch} activeOpacity={0.8}>
          <Text style={styles.searchButtonText}>IMPORTER PLAYLIST</Text>
          <Ionicons name="arrow-forward" size={20} color="black" />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Import Deezer (Public)</Text>
            <TouchableOpacity onPress={handleClose}>
              <Ionicons name="close" size={24} color="white" />
            </TouchableOpacity>
          </View>

          {renderContent()}
        </View>
      </View>
    </Modal>
  );
};

// --- Styles ---

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#191414', // Fond sombre
    borderRadius: 20,
    padding: 20,
    maxHeight: '80%',
    width: '100%',
    borderWidth: 1,
    borderColor: '#333',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  // Input Styles
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#333',
    borderRadius: 10,
    paddingHorizontal: 15,
    height: 50,
    marginBottom: 10,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: 'white',
    fontSize: 16,
  },
  helperText: {
    color: '#888',
    fontSize: 12,
    marginBottom: 20,
    marginLeft: 5,
  },
  searchButton: {
    backgroundColor: COLORS.SPOTIFY_GREEN, // Vert Néon demandé
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 15,
    borderRadius: 30,
    shadowColor: COLORS.SPOTIFY_GREEN,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 5,
  },
  searchButtonText: {
    color: 'black',
    fontWeight: 'bold',
    fontSize: 16,
    marginRight: 10,
  },
  // Loading
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    color: '#ccc',
    marginTop: 15,
  },
});

export default DeezerImportModal;


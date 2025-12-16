# Architecture des Services

## 📁 Structure

```
services/
├── MusicService.ts    # Gestion de la musique (Spotify + iTunes)
├── UserService.ts     # Gestion du profil utilisateur
└── README.md          # Cette documentation

utils/
└── SoundManager.ts    # Gestionnaire audio centralisé (Singleton)

components/
├── ErrorBoundary.tsx  # Gestion des erreurs React
└── SafeContainer.tsx  # Container avec SafeAreaView
```

---

## 🎵 MusicService

### Objectif
Centraliser toute la logique de récupération et de traitement de la musique.

### Méthodes principales

#### `fetchTracksByCategory(options: FetchTracksOptions): Promise<SpotifyTrack[]>`
Récupère les tracks selon la catégorie sélectionnée.

**Exemple:**
```typescript
import MusicService from '../services/MusicService';

const tracks = await MusicService.fetchTracksByCategory({
  accessToken: 'YOUR_TOKEN',
  category: 'TOP_RECENT', // ou 'TOP_5Y', 'GUILTY_PLEASURES'
  excludedTrackIds: ['track1', 'track2'],
  limit: 100
});
```

#### `findPlayableTrack(tracks, excludedIds, maxAttempts): Promise<PlayableTrackResult>`
Trouve un track avec preview audio (iTunes prioritaire, Spotify en fallback).

**Exemple:**
```typescript
const result = await MusicService.findPlayableTrack(
  tracks,
  playedTrackIds,
  15 // nombre max de tentatives
);

if (result.success && result.track) {
  console.log('Track trouvé:', result.track.title);
} else {
  console.error('Erreur:', result.error);
}
```

#### `addTrackToLiked(trackId, accessToken): Promise<boolean>`
Ajoute un track aux favoris Spotify.

**Exemple:**
```typescript
const success = await MusicService.addTrackToLiked(trackId, accessToken);
if (success) {
  console.log('✅ Ajouté aux favoris');
}
```

---

## 👤 UserService

### Objectif
Gérer le profil utilisateur Spotify avec cache intelligent (5 minutes).

### Méthodes principales

#### `fetchUserProfile(accessToken, forceRefresh): Promise<UserProfileResult>`
Récupère le profil utilisateur avec cache automatique.

**Exemple:**
```typescript
import UserService from '../services/UserService';

const result = await UserService.fetchUserProfile(accessToken);

if (result.success && result.user) {
  const displayName = UserService.getDisplayName(result.user);
  const profileImage = UserService.getProfileImage(result.user);
  
  console.log('Utilisateur:', displayName);
}
```

#### `clearCache(): void`
Vide le cache (à appeler lors de la déconnexion).

---

## 🔊 SoundManager

### Objectif
**SINGLETON** pour gérer un seul son à la fois et éviter les fuites mémoire.

### Pourquoi ?
- ❌ **AVANT**: Plusieurs `Audio.Sound.createAsync()` dans chaque écran → fuites mémoire
- ✅ **APRÈS**: Un seul gestionnaire centralisé → déchargement automatique

### Méthodes principales

#### `initialize(): Promise<void>`
À appeler au démarrage de l'app (dans `App.tsx`).

**Exemple:**
```typescript
import SoundManager from '../utils/SoundManager';

useEffect(() => {
  SoundManager.initialize();
}, []);
```

#### `playSound(audioUrl, trackId, options): Promise<boolean>`
Charge et joue un son (arrête automatiquement le précédent).

**Exemple:**
```typescript
const success = await SoundManager.playSound(
  'https://audio-url.com/preview.mp3',
  'track123',
  {
    shouldLoop: false,
    volume: 1.0,
    onPlaybackStatusUpdate: (isPlaying) => {
      setIsPlaying(isPlaying);
    }
  }
);
```

#### `stopSound(): Promise<void>`
Arrête et décharge le son (libère la mémoire).

**Exemple:**
```typescript
await SoundManager.stopSound();
```

#### `cleanup(): Promise<void>`
Nettoie complètement (à appeler lors de la déconnexion).

---

## 🛡️ ErrorBoundary

### Objectif
Capturer les erreurs React et afficher une UI de secours.

### Utilisation

Dans `App.tsx`:
```typescript
import ErrorBoundary from './components/ErrorBoundary';

<ErrorBoundary>
  <YourApp />
</ErrorBoundary>
```

Avec fallback personnalisé:
```typescript
<ErrorBoundary fallback={<CustomErrorScreen />}>
  <YourScreen />
</ErrorBoundary>
```

---

## 📱 SafeContainer

### Objectif
Wrapper avec `SafeAreaView` pour gérer automatiquement les zones sûres (encoche, barre d'accueil).

### Utilisation

Dans vos écrans:
```typescript
import SafeContainer from '../components/SafeContainer';

export default function MyScreen() {
  return (
    <SafeContainer>
      <View>
        <Text>Mon contenu</Text>
      </View>
    </SafeContainer>
  );
}
```

Avec couleur personnalisée:
```typescript
<SafeContainer backgroundColor={COLORS.SPOTIFY_GREEN}>
  {/* Contenu */}
</SafeContainer>
```

---

## 🔄 Migration des écrans existants

### Avant (GameScreen.tsx)
```typescript
// ❌ Logique métier mélangée avec l'UI
const tracks = await fetch(...);
const { sound } = await Audio.Sound.createAsync(...);
```

### Après (GameScreen.tsx)
```typescript
// ✅ Logique séparée
const tracks = await MusicService.fetchTracksByCategory({ ... });
const result = await MusicService.findPlayableTrack(tracks, ...);
await SoundManager.playSound(result.track.preview_url, result.track.id);
```

---

## 📊 Avantages de cette architecture

| Avant | Après |
|-------|-------|
| Logique dans les écrans | Logique dans les services |
| Pas de cache | Cache automatique (UserService) |
| Fuites mémoire audio | Gestion centralisée (SoundManager) |
| Pas de gestion d'erreurs | Error Boundary global |
| Pas de SafeArea | SafeContainer automatique |

---

## 🚀 Prochaines étapes

1. **Initialiser SoundManager** dans `App.tsx`
2. **Wrapper les écrans** avec `SafeContainer`
3. **Remplacer les appels API** par les services
4. **Ajouter ErrorBoundary** autour de la navigation
5. **Tester sur iPhone** pour vérifier SafeArea et mémoire audio

---

## 📝 Notes importantes

- **SoundManager**: Toujours appeler `stopSound()` dans `useEffect` cleanup
- **UserService**: Le cache est automatique, pas besoin de le gérer manuellement
- **MusicService**: iTunes est toujours testé en premier (meilleur matching)
- **ErrorBoundary**: Ne capture pas les erreurs asynchrones, utiliser try/catch

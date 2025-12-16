# 🚀 Guide de Refactoring - Architecture & Services

## 📋 Résumé des changements

Ce refactoring sépare la **logique métier** (services) de l'**affichage** (UI) et centralise la gestion des ressources lourdes (audio, API).

### ✅ Fichiers créés

```
services/
├── MusicService.ts          # 🎵 Gestion musique (Spotify + iTunes)
├── UserService.ts           # 👤 Gestion profil utilisateur
├── README.md                # 📚 Documentation des services
└── MIGRATION_EXAMPLE.tsx    # 💡 Exemples de code avant/après

utils/
└── SoundManager.ts          # 🔊 Gestionnaire audio (Singleton)

components/
├── ErrorBoundary.tsx        # 🛡️ Gestion d'erreurs React
└── SafeContainer.tsx        # 📱 Container avec SafeAreaView

REFACTORING_GUIDE.md         # 📖 Ce guide
```

---

## 🎯 Objectifs atteints

| Problème | Solution |
|----------|----------|
| ❌ Logique dans les écrans | ✅ Services séparés (MusicService, UserService) |
| ❌ Fuites mémoire audio | ✅ SoundManager singleton avec unload automatique |
| ❌ Appels API dupliqués | ✅ Cache automatique (UserService: 5 min) |
| ❌ Pas de SafeArea | ✅ SafeContainer pour tous les écrans |
| ❌ Crashs non gérés | ✅ ErrorBoundary global |
| ❌ Code difficile à tester | ✅ Services mockables |

---

## 📝 Plan de migration (Étape par étape)

### **Phase 1: Initialisation** ⚙️

#### 1.1 Mettre à jour `App.tsx`

```typescript
import React, { useEffect } from 'react';
import ErrorBoundary from './components/ErrorBoundary';
import SoundManager from './utils/SoundManager';
import { AuthProvider } from './contexts/AuthContext';
import { GameProvider } from './contexts/GameContext';
// ... autres imports

export default function App() {
  useEffect(() => {
    // Initialiser le SoundManager au démarrage
    SoundManager.initialize().catch(error => {
      console.error('❌ Erreur initialisation SoundManager:', error);
    });

    return () => {
      // Nettoyer à la fermeture
      SoundManager.cleanup();
    };
  }, []);

  return (
    <ErrorBoundary>
      <AuthProvider>
        <GameProvider>
          {/* Votre NavigationContainer */}
        </GameProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
```

---

### **Phase 2: Migrer LobbyScreen** 👥

#### 2.1 Ajouter SafeContainer

**Avant:**
```typescript
return (
  <View style={styles.container}>
    {/* Contenu */}
  </View>
);
```

**Après:**
```typescript
import SafeContainer from '../components/SafeContainer';

return (
  <SafeContainer>
    <View style={styles.content}>
      {/* Contenu */}
    </View>
  </SafeContainer>
);
```

#### 2.2 Remplacer la logique de profil par UserService

**Avant (lignes 70-98):**
```typescript
fetch(API_ENDPOINTS.SPOTIFY_USER, {
  headers: { Authorization: `Bearer ${accessToken}` },
})
  .then(response => response.json())
  .then((data: SpotifyUser) => {
    const displayName = data.display_name || 'Utilisateur';
    const profileImage = data.images?.[0]?.url;
    // ...
  });
```

**Après:**
```typescript
import UserService from '../services/UserService';

const loadUserProfile = async () => {
  if (!accessToken) return;

  const result = await UserService.fetchUserProfile(accessToken);
  
  if (result.success && result.user) {
    const displayName = UserService.getDisplayName(result.user);
    const profileImage = UserService.getProfileImage(result.user);
    
    setPlayers(prevPlayers => 
      prevPlayers.map((player, index) => 
        index === 0 
          ? { ...player, name: displayName, image: profileImage }
          : player
      )
    );
  } else {
    console.error('Erreur profil:', result.error);
  }
};

useEffect(() => {
  if (accessToken) {
    loadUserProfile();
  }
}, [accessToken]);
```

---

### **Phase 3: Migrer GameScreen** 🎮

C'est le plus gros changement. Voici les étapes :

#### 3.1 Ajouter les imports

```typescript
import SafeContainer from '../components/SafeContainer';
import MusicService from '../services/MusicService';
import SoundManager from '../utils/SoundManager';
```

#### 3.2 Remplacer `startRound()` (lignes 219-499)

**Avant:** Logique complexe mélangée (fetch, iTunes, audio)

**Après:**
```typescript
const startRound = async () => {
  if (isLoadingRef.current) {
    console.log("⚠️ Démarrage déjà en cours");
    return;
  }
  
  isLoadingRef.current = true;
  setLoading(true);

  const currentRoundId = `round-${round}-${Date.now()}`;
  roundIdRef.current = currentRoundId;

  // Arrêter le son précédent
  await SoundManager.stopSound();
  setCurrentTrack(null);
  expectedTrackRef.current = null;

  try {
    // ✅ SERVICE: Récupérer les tracks par catégorie
    const tracks = await MusicService.fetchTracksByCategory({
      accessToken: accessToken || '',
      category: category || 'TOP_RECENT',
      excludedTrackIds: playedTracks,
      limit: 100,
    });

    // ✅ SERVICE: Trouver un track jouable
    const result = await MusicService.findPlayableTrack(
      tracks,
      [...playedTracks, ...Array.from(playedTracksGlobalRef.current)],
      15
    );

    if (!result.success || !result.track) {
      Alert.alert(
        "Pas de chance",
        result.error || "Aucun extrait audio trouvé",
        [{ text: "Suivant", onPress: () => handleSkip() }]
      );
      return;
    }

    // Vérifier qu'on est toujours dans le bon round
    if (roundIdRef.current !== currentRoundId) {
      console.warn("⚠️ Round ID a changé, annulation");
      return;
    }

    console.log("\n========================================");
    console.log("🎵 TRACK SÉLECTIONNÉ:", result.track.title);
    console.log("🎵 Artiste:", result.track.artist);
    console.log("🎵 Source:", result.track.source);
    console.log("========================================\n");

    // Mettre à jour les états
    const trackWithRound = { ...result.track, roundId: currentRoundId };
    expectedTrackRef.current = trackWithRound;
    setCurrentTrack(result.track);
    
    // Ajouter aux tracks joués
    setPlayedTracks(prev => [...prev, result.track!.id]);
    playedTracksGlobalRef.current.add(result.track.id);

    await new Promise(resolve => setTimeout(resolve, 50));

    // Vérifier à nouveau le round
    if (roundIdRef.current !== currentRoundId) {
      console.warn("⚠️ Round ID a changé après setState");
      return;
    }

    // ✅ SOUNDMANAGER: Jouer l'audio
    const success = await SoundManager.playSound(
      result.track.preview_url,
      result.track.id,
      {
        shouldLoop: false,
        volume: 1.0,
        onPlaybackStatusUpdate: (playing) => {
          setIsPlaying(playing);
        },
      }
    );

    if (!success) {
      Alert.alert("Erreur", "Impossible de lire l'audio");
    }

  } catch (error) {
    console.error('❌ Erreur startRound:', error);
    Alert.alert("Erreur", "Session expirée ou problème réseau");
  } finally {
    setLoading(false);
    isLoadingRef.current = false;
  }
};
```

#### 3.3 Supprimer les fonctions obsolètes

**À supprimer:**
- `prepareSound()` (lignes 136-214) → Remplacé par `SoundManager.playSound()`
- Toute la logique de fetch Spotify/iTunes → Remplacée par `MusicService`

#### 3.4 Mettre à jour `stopSound()`

**Avant:**
```typescript
const stopSound = async (clearExpectedTrack: boolean = true) => {
  if (soundRef.current) {
    await soundRef.current.stopAsync();
    await soundRef.current.unloadAsync();
    // ...
  }
};
```

**Après:**
```typescript
const stopSound = async (clearExpectedTrack: boolean = true) => {
  await SoundManager.stopSound();
  
  if (clearExpectedTrack) {
    expectedTrackRef.current = null;
  }
  
  setIsPlaying(false);
};
```

#### 3.5 Cleanup dans useEffect

```typescript
useEffect(() => {
  // ... logique existante
  
  return () => { 
    SoundManager.stopSound(); // Au lieu de stopSound()
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };
}, [accessToken, gameId, round]);
```

#### 3.6 Wrapper avec SafeContainer

```typescript
return (
  <SafeContainer>
    {loading ? (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={COLORS.SPOTIFY_GREEN} />
        {/* ... */}
      </View>
    ) : (
      <View style={styles.container}>
        {/* Contenu existant */}
      </View>
    )}
  </SafeContainer>
);
```

---

### **Phase 4: Migrer RevealScreen** 🎉

#### 4.1 Ajouter SafeContainer

```typescript
import SafeContainer from '../components/SafeContainer';

return (
  <SafeContainer>
    <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
      {/* Contenu existant */}
    </Animated.View>
  </SafeContainer>
);
```

#### 4.2 Remplacer `handleAddToLiked()` (lignes 95-139)

**Après:**
```typescript
import MusicService from '../services/MusicService';

const handleAddToLiked = async () => {
  if (!accessToken) {
    Alert.alert('Erreur', 'Vous devez être connecté à Spotify');
    return;
  }

  if (!safeTrack.id) {
    Alert.alert('Erreur', 'ID de piste manquant');
    return;
  }

  // ✅ SERVICE: Ajouter aux favoris
  const success = await MusicService.addTrackToLiked(
    safeTrack.id,
    accessToken
  );

  if (success) {
    setAddedToLiked(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } else {
    Alert.alert('Erreur', "Impossible d'ajouter la piste");
  }
};
```

---

### **Phase 5: Tests et vérifications** ✅

#### 5.1 Checklist de migration

- [ ] `App.tsx`: ErrorBoundary ajouté
- [ ] `App.tsx`: SoundManager initialisé
- [ ] `LobbyScreen`: SafeContainer ajouté
- [ ] `LobbyScreen`: UserService utilisé
- [ ] `GameScreen`: SafeContainer ajouté
- [ ] `GameScreen`: MusicService utilisé
- [ ] `GameScreen`: SoundManager utilisé
- [ ] `RevealScreen`: SafeContainer ajouté
- [ ] `RevealScreen`: MusicService utilisé (favoris)

#### 5.2 Tests à effectuer

1. **Test iPhone avec encoche**
   - Vérifier que le contenu ne passe pas sous l'encoche
   - Tester avec SafeContainer

2. **Test mémoire audio**
   - Jouer plusieurs manches
   - Vérifier qu'il n'y a pas de superposition audio
   - Surveiller la mémoire (pas de crash sur vieux iPhones)

3. **Test cache UserService**
   - Revenir sur LobbyScreen plusieurs fois
   - Vérifier que le profil n'est pas re-fetch à chaque fois

4. **Test ErrorBoundary**
   - Provoquer une erreur volontaire
   - Vérifier que l'app ne crash pas complètement

---

## 📊 Comparaison avant/après

### Lignes de code

| Fichier | Avant | Après | Réduction |
|---------|-------|-------|-----------|
| GameScreen.tsx | ~686 lignes | ~400 lignes | -42% |
| LobbyScreen.tsx | ~538 lignes | ~450 lignes | -16% |
| RevealScreen.tsx | ~350 lignes | ~300 lignes | -14% |

### Architecture

**Avant:**
```
screens/
├── GameScreen.tsx (686 lignes, tout mélangé)
├── LobbyScreen.tsx (538 lignes)
└── RevealScreen.tsx (350 lignes)
```

**Après:**
```
services/
├── MusicService.ts (logique musique)
└── UserService.ts (logique utilisateur)

utils/
└── SoundManager.ts (gestion audio)

components/
├── ErrorBoundary.tsx (gestion erreurs)
└── SafeContainer.tsx (SafeAreaView)

screens/
├── GameScreen.tsx (UI uniquement)
├── LobbyScreen.tsx (UI uniquement)
└── RevealScreen.tsx (UI uniquement)
```

---

## 🎓 Bonnes pratiques adoptées

### ✅ Séparation des responsabilités
- **Services**: Logique métier (API, traitement données)
- **Utils**: Outils réutilisables (SoundManager)
- **Components**: UI réutilisables (SafeContainer, ErrorBoundary)
- **Screens**: Orchestration et affichage

### ✅ Singleton pattern
- `SoundManager`: Un seul gestionnaire audio pour toute l'app
- `MusicService`: Un seul point d'entrée pour la musique
- `UserService`: Cache automatique, pas de duplication

### ✅ Gestion mémoire
- `SoundManager.stopSound()`: Décharge automatiquement l'audio
- Cache intelligent (5 min) pour éviter les appels API inutiles
- Cleanup dans `useEffect` return

### ✅ Safe Area
- `SafeContainer`: Gère automatiquement les encoches et barres
- Compatible iPhone X, 11, 12, 13, 14, 15

### ✅ Gestion d'erreurs
- `ErrorBoundary`: Empêche les crashes complets
- Try/catch dans les services
- Messages d'erreur clairs

---

## 🚨 Points d'attention

### ⚠️ SoundManager
- **Toujours** appeler `stopSound()` dans le cleanup de `useEffect`
- **Ne pas** créer d'instances multiples de `Audio.Sound`
- **Initialiser** dans `App.tsx` au démarrage

### ⚠️ Services
- **Ne pas** instancier manuellement (`new MusicService()`)
- **Utiliser** le singleton (`MusicService.getInstance()` ou import direct)

### ⚠️ Cache UserService
- **Expire** après 5 minutes automatiquement
- **Vider** lors de la déconnexion (`UserService.clearCache()`)

---

## 🔧 Commandes utiles

### Test de l'app
```bash
npm start
npm run ios
npm run android
```

### Vérifier la structure
```bash
# Lister les nouveaux fichiers
ls -la services/
ls -la components/
ls -la utils/
```

---

## 📞 Support

Si vous avez des questions ou problèmes lors de la migration :

1. Consultez `services/README.md` pour la doc des services
2. Consultez `services/MIGRATION_EXAMPLE.tsx` pour des exemples
3. Vérifiez les logs console (🎵, ✅, ❌ pour filtrer)

---

## 🎉 Prochaines étapes recommandées

1. **Tests unitaires** pour les services (Jest)
2. **Analytics** dans les services (tracking des erreurs)
3. **Offline mode** avec cache local (AsyncStorage)
4. **Préchargement** des tracks (améliorer la fluidité)
5. **Retry logic** en cas d'échec réseau

---

**Bonne migration ! 🚀**

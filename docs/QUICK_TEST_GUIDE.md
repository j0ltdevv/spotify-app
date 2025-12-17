# 🚀 GUIDE DE TEST RAPIDE

## ⚡ Démarrage immédiat

```bash
# Lancer l'app
npm start

# Puis appuyez sur 'i' pour iOS ou 'a' pour Android
```

---

## 🎯 5 Tests prioritaires à faire MAINTENANT

### ✅ Test 1 : L'app démarre sans crash (2 min)
**Commande :** `npm start`

**Vérifications :**
- [ ] L'app démarre sans erreur
- [ ] Vous voyez l'écran de bienvenue
- [ ] Logs console : `✅ SoundManager initialisé`

**Si ça ne marche pas :**
- Vérifier que `expo-av` est installé : `npm install expo-av`
- Vérifier que `react-native-safe-area-context` est installé : `npm install react-native-safe-area-context`

---

### ✅ Test 2 : LobbyScreen - Profil utilisateur (1 min)
**Action :** Connectez-vous et allez sur le LobbyScreen

**Logs attendus :**
```
🔍 Récupération du profil utilisateur depuis Spotify...
✅ Profil utilisateur récupéré: [Votre nom]
```

**Vérifications :**
- [ ] Votre nom Spotify s'affiche
- [ ] Votre photo de profil s'affiche (si vous en avez une)
- [ ] Pas d'erreur dans la console

**Test du cache :**
1. Revenez sur le LobbyScreen plusieurs fois
2. **Logs attendus :** `✅ Profil utilisateur récupéré depuis le cache`

---

### ✅ Test 3 : GameScreen - Lancer une manche (3 min)
**Action :** Lancez une partie

**Logs attendus :**
```
🔄 Démarrage de la manche 1 avec ID: round-1-[timestamp]
🎵 Récupération des tracks pour la catégorie: TOP_RECENT
✅ 100 tracks récupérés pour TOP_RECENT
🔍 Recherche d'un track jouable parmi 100 tracks
   🍎 Recherche iTunes pour: "[Titre du track]"
   ✅ iTunes OK - Audio trouvé

========================================
🎵 TRACK SÉLECTIONNÉ POUR LA MANCHE 1
🎵 Titre : [Titre]
🎵 Artiste : [Artiste]
🎵 Source audio: iTunes (ou Spotify)
========================================

🔊 Chargement audio pour track: [ID]
✅ Audio créé avec succès
✅ Lecture démarrée pour track: [ID]
```

**Vérifications :**
- [ ] La musique se lance
- [ ] Vous entendez l'extrait audio
- [ ] Le titre et l'artiste s'affichent
- [ ] Le timer démarre

---

### 🔥 Test 4 : SoundManager - Pas de fuites mémoire (5 min)
**Action :** Jouez 5-10 manches d'affilée

**Logs attendus (pour CHAQUE manche) :**
```
🛑 Arrêt du son en cours...
✅ Son arrêté et déchargé
🔊 Chargement audio pour track: [nouveau ID]
✅ Audio créé avec succès
✅ Lecture démarrée pour track: [nouveau ID]
```

**Vérifications CRITIQUES :**
- [ ] **UN SEUL son à la fois** (pas de superposition)
- [ ] Le son précédent s'arrête AVANT le nouveau
- [ ] Pas de crash après plusieurs manches
- [ ] L'app ne ralentit pas

**Si ça ne marche pas :**
- Si 2 sons se superposent → Bug dans SoundManager
- Si crash après 5-10 manches → Fuite mémoire possible
- Vérifier les logs : doit voir `✅ Son arrêté et déchargé` à CHAQUE fois

---

### ✅ Test 5 : RevealScreen - Ajout aux favoris (1 min)
**Action :** Terminez une manche et cliquez sur "❤️ Ajouter aux favoris"

**Logs attendus :**
```
✅ Track [ID] ajouté aux favoris
```

**Vérifications :**
- [ ] Le bouton change d'état (cœur rempli)
- [ ] Feedback haptique (vibration)
- [ ] Pas d'erreur

---

## 📱 Test SafeArea (iPhone uniquement)

**Si vous testez sur iPhone X, 11, 12, 13, 14, 15 :**

**Vérifications :**
- [ ] **LobbyScreen** : Le contenu ne passe PAS sous l'encoche
- [ ] **GameScreen** : Le contenu ne passe PAS sous l'encoche
- [ ] **RevealScreen** : Le contenu ne passe PAS sous l'encoche
- [ ] Le contenu ne passe PAS sous la barre d'accueil (home indicator)

**Attendu :** Tout le contenu doit être dans la "zone sûre" de l'écran.

---

## 🐛 Problèmes courants et solutions

### ❌ "Cannot find module 'expo-av'"
**Solution :**
```bash
npm install expo-av
npx expo install expo-av
```

### ❌ "SafeAreaProvider not found"
**Solution :**
```bash
npm install react-native-safe-area-context
npx expo install react-native-safe-area-context
```

### ❌ Superposition de musiques (2 sons en même temps)
**Cause :** Bug dans SoundManager  
**Vérifier :** Les logs doivent montrer `🛑 Arrêt du son en cours...` AVANT chaque nouveau son

### ❌ Crash après plusieurs manches
**Cause :** Fuite mémoire audio  
**Vérifier :** Les logs doivent montrer `✅ Son arrêté et déchargé` à CHAQUE changement de manche

### ❌ Contenu sous l'encoche iPhone
**Cause :** SafeContainer pas appliqué ou mal configuré  
**Vérifier :** Tous les écrans doivent utiliser `<SafeContainer>` comme wrapper

---

## 📊 Checklist rapide

### Tests de base (10 min)
- [ ] L'app démarre
- [ ] Connexion Spotify fonctionne
- [ ] LobbyScreen affiche le profil
- [ ] Une partie se lance
- [ ] La musique se joue
- [ ] Le timer fonctionne
- [ ] On peut répondre
- [ ] RevealScreen s'affiche
- [ ] Ajout aux favoris fonctionne

### Tests de qualité (5 min)
- [ ] Pas de crash après 5-10 manches
- [ ] Pas de superposition audio
- [ ] Cache UserService fonctionne (logs)
- [ ] SafeArea OK sur iPhone avec encoche

---

## 🎉 Si tous les tests passent

**Félicitations ! La migration est un succès ! 🚀**

**Prochaines étapes :**
1. ✅ Tests de performance (jouer 20+ manches)
2. ✅ Tests sur différents devices
3. ✅ Tests avec différentes connexions (3G, 4G, WiFi)
4. ✅ Tests avec différentes catégories (TOP_RECENT, GUILTY_PLEASURES, TOP_5Y)

---

## 📝 Logs à surveiller

### ✅ Logs normaux (tout va bien)
```
✅ SoundManager initialisé
✅ Profil utilisateur récupéré: [Nom]
✅ 100 tracks récupérés pour TOP_RECENT
✅ iTunes OK - Audio trouvé
✅ Audio créé avec succès
✅ Lecture démarrée pour track: [ID]
✅ Son arrêté et déchargé
✅ Track [ID] ajouté aux favoris
```

### ⚠️ Logs d'avertissement (pas grave)
```
⚠️ Peu de vieux favoris, fallback sur long_term sans recent...
⚠️ Aucun guilty trouvé, fallback sur titres moins récents...
⏭️ Passer au titre suivant (pas de preview disponible)
```

### ❌ Logs d'erreur (problème)
```
❌ Erreur fetchTracksByCategory: [message]
❌ Erreur fetchUserProfile: [message]
❌ Erreur playSound: [message]
❌ Erreur réseau addTrackToLiked
```

Si vous voyez des ❌, consultez `TEST_REPORT.md` pour le debugging.

---

## 🚀 Commandes utiles

```bash
# Lancer l'app
npm start

# Lancer sur iOS
npm run ios

# Lancer sur Android
npm run android

# Vérifier TypeScript
npx tsc --noEmit

# Nettoyer le cache
npx expo start -c

# Voir les logs en temps réel
npx expo start --dev-client
```

---

## 📞 En cas de problème

1. **Consultez les logs console** (emojis 🎵, ✅, ❌)
2. **Consultez TEST_REPORT.md** pour le debugging détaillé
3. **Consultez MIGRATION_COMPLETE.md** pour les instructions complètes
4. **Consultez services/README.md** pour la doc des services

---

**Bonne chance avec les tests ! 🎉**

**L'architecture est solide, les tests de compilation passent, il ne reste plus qu'à vérifier que tout fonctionne comme prévu ! 🚀**

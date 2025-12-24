# Guide d'Intégration Deezer (Final)

## 🎵 État de l'Intégration
L'intégration Deezer est **opérationnelle** et simplifiée.
Contrairement à Spotify, nous utilisons l'**API Publique** de Deezer, ce qui offre plusieurs avantages majeurs :

*   ✅ **Aucune Clé API Requise :** Pas de `CLIENT_ID` ni de `CLIENT_SECRET` à configurer.
*   ✅ **Aucun Login Utilisateur :** N'importe qui peut importer une playlist publique.
*   ✅ **Pas de Quotas Restrictifs :** L'API de recherche et de lecture est très permissive.

## 🚀 Comment ça marche ?

### 1. Importation
L'utilisateur ouvre le modal "Importer Deezer" depuis l'écran d'accueil (`WelcomeScreen`).
Il colle un lien de playlist (format web ou mobile) :
*   `https://www.deezer.com/fr/playlist/12345678`
*   `https://deezer.page.link/AbCdEf` (Lien court supporté !)

### 2. Traitement
Le composant `DeezerImportModal` :
1.  Résout les liens courts (redirections).
2.  Extrait l'ID de la playlist.
3.  Récupère les pistes via `api.deezer.com/playlist/{id}`.
4.  Filtre les pistes qui n'ont pas d'extrait audio (`preview`).
5.  Normalise les données en objets `GameTrack`.

### 3. Jeu
Les pistes Deezer sont traitées exactement comme les pistes Spotify par le moteur de jeu.
*   **Audio :** `SoundManager` lit les fichiers MP3 (`.mp3`) fournis par l'API Deezer.
*   **IDs :** Les IDs sont préfixés par `dz_` pour éviter les conflits.

## 🛠️ Maintenance & Debug

### Logs
Pour debugger une importation Deezer, filtrez les logs par :
`Deezer URL input`, `Deezer ID found` ou `Erreur Deezer`.

### Limitations Connues
*   **Playlists Privées :** L'importation ne fonctionnera pas si la playlist de l'utilisateur est privée. Il doit la rendre publique.
*   **Tonalité :** Les extraits Deezer sont des MP3 standard, la qualité est généralement excellente et le chargement rapide.

---
**Dernière mise à jour :** 23 Décembre 2025
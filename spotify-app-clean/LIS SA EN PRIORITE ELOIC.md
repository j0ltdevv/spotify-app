# Lisez-moi : Démarrer l'application Track Roulette

Salut ! Ce document contient les instructions pour lancer et tester l'application Track Roulette.

## 1. Prérequis

Avant de commencer, assure-toi d'avoir installé les éléments suivants sur ton système :

*   **Node.js** (version 18 ou supérieure recommandée) : Inclut `npm` (Node Package Manager).
*   **Expo CLI** : Peut être installé globalement via `npm install -g expo-cli`.
*   Un **éditeur de code** (par exemple, VS Code).
*   L'application **Expo Go** installée sur ton smartphone (disponible sur l'App Store ou Google Play) pour tester sur un appareil réel.

## 2. Décompresser le projet

Décompresse le fichier ZIP que tu as reçu dans un dossier de ton choix.

## 3. Installer les dépendances

Ouvre ton terminal (ou PowerShell/CMD sur Windows) et navigue jusqu'au répertoire racine du projet décompressé (par exemple : `cd C:\Users\TonNom\DossierProjet\spotify-app-clean`).

Une fois dans le dossier, exécute la commande suivante pour télécharger et installer toutes les bibliothèques et dépendances nécessaires :

```bash
npm install
```

## 4. Lancer l'application

Après l'installation des dépendances, tu peux démarrer l'application. Cette commande ouvrira l'interface d'Expo Dev Tools dans ton navigateur web :

```bash
npx expo start
```

Depuis l'interface d'Expo Dev Tools, tu auras plusieurs options pour tester l'application :

*   **Scanner le QR code** : Utilise l'application **Expo Go** sur ton smartphone pour scanner le QR code affiché. L'application se chargera directement sur ton téléphone.
*   **Exécuter dans le navigateur** : Clique sur "Run in web browser" pour un aperçu rapide dans ton navigateur.
*   **Exécuter sur émulateur/simulateur** : Clique sur "Run on Android device/emulator" ou "Run on iOS simulator" (si tu as un émulateur Android Studio ou un simulateur Xcode configuré sur ton machine).

## 5. Notes importantes et dépannage

### Authentification Spotify
*   **Erreur 403 (Forbidden)** : Si tu rencontres une erreur `Spotify API error: 403` lors de la connexion, cela indique généralement que l'application est en "mode développement" sur le tableau de bord des développeurs Spotify. Dans ce mode, seuls les comptes Spotify explicitement ajoutés par le propriétaire de l'application (Eloïc) peuvent se connecter. Si tu utilises un compte différent, demande-lui de t'ajouter à la liste des utilisateurs autorisés.

### Fonctionnalités prévues pour l'avenir
*   **Intégration Deezer :** La prise en charge de l'authentification Deezer est en cours de développement, mais n'est pas encore pleinement fonctionnelle.
*   **Thèmes Dynamiques :** L'application est conçue pour supporter des thèmes visuels dynamiques (par exemple, vert Spotify, violet Deezer), mais cette fonctionnalité sera implémentée ultérieurement.
*   **Firebase (Backend) :** L'intégration d'un backend Firebase pour les fonctionnalités multijoueurs et la gestion des données avancées est également prévue pour une phase ultérieure du projet.

Bon amusement et n'hésite pas à poser des questions si tu rencontres des problèmes !
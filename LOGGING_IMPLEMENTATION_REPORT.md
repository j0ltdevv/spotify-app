# Rapport d'Implémentation des Logs & Correctifs

## 🎯 Objectif
Ajouter une traçabilité massive ("logs par milliers") pour diagnostiquer et corriger le bug où les joueurs invités restaient bloqués sur l'écran de Révélation (RevealScreen) alors que l'hôte passait à la suite.

## 🛠️ Modifications Appliquées

### 1. `contexts/GameContext.tsx` (Le Cerveau)
*   **Logs d'État (Snapshot) :**
    *   Chaque mise à jour Firestore affiche désormais : le Statut (`waiting`, `playing`, `revealing`), le Round actuel, et l'ID du document.
    *   Préfixe : `🔍 [CTX] 🔥`
*   **Logs d'Action (`nextRound`) :**
    *   Affiche explicitement quand `nextRound` est appelé, par qui (Hôte/Invité), et si la mise à jour Firestore est envoyée.

### 2. `screens/RevealScreen.tsx` (Le point critique)
*   **🐛 CORRECTIF MAJEUR :**
    *   J'ai découvert que `RevealScreen` n'écoutait pas activement le changement de round dans Firestore.
    *   **Action :** Ajout d'un `useEffect` qui surveille `currentRound` du contexte.
    *   **Résultat :** Dès que l'hôte clique sur "Suivant" (mettant à jour Firestore -> Round + 1), TOUS les écrans `RevealScreen` des invités détectent le changement et naviguent automatiquement vers `GameScreen`.
*   **Logs de Montage :**
    *   Affiche les props reçues (Round, Scores) à l'ouverture de l'écran.
    *   Préfixe : `🔍 [REVEAL]`
*   **Logs de Navigation :**
    *   Le bouton "Suivant" utilise maintenant une logique stricte :
        *   **Hôte :** Appelle `nextRound()` dans Firestore.
        *   **Invité :** Affiche un Toast "En attente de l'hôte" (et ne fait rien localement pour éviter la désynchronisation).

### 3. Comment Debugger maintenant ?
Ouvrez votre terminal (Metro Bundler) et filtrez par `🔍`.

*   **Scénario Normal :**
    1.  L'Hôte clique "Suivant".
    2.  Log: `🔍 [REVEAL] Triggering nextRound() in DB`
    3.  Log: `🔍 [CTX] ✅ EXECUTING UPDATE`
    4.  Log (Chez tout le monde): `🔍 [CTX] 🔥 SNAPSHOT RECEIVED ... Status: playing ... Round: X+1`
    5.  Log (Chez tout le monde): `🔍 [REVEAL] 🚀 DETECTED NEW ROUND! Navigating...`

Si le jeu bloque, regardez quel log manque dans cette séquence.

---
**Date:** 23 Décembre 2025
**Auteur:** Gemini CLI

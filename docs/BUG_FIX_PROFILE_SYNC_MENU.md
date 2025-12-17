# Fix: "Bonjour Détective" / Profile Sync Issue

## Issue
The user reported that:
1.  Synchronization of icons/names was still not working.
2.  The Menu screen still displayed "Bonjour Détective" instead of the user's name.

## Root Cause
The `MenuScreen` relies on `firebaseUser` from `AuthContext` to display the name and avatar.
When logging in (`loginWithSpotifyFirebase`), the app uses `signInAnonymously`. By default, an anonymous Firebase user has `displayName: null` and `photoURL: null`.
Although `UserService.fetchUserProfile` was saving data to Firestore, it **was not updating the Firebase Auth user object** itself.
Consequently, `AuthContext` continued to provide a user object with null profile data, causing the "fallback" UI ("Détective") to appear.

## Fix
Modified `contexts/AuthContext.tsx`:
1.  **Login Flow**: Updated `loginWithSpotifyFirebase` to fetch the Spotify profile immediately after sign-in and call `updateProfile` on the Firebase user object.
2.  **Self-Healing**: Added a `useEffect` hook that checks on app load if the current user has a valid token but missing profile data. If so, it automatically fetches the profile and updates the user.

## Verification
-   **Login**: New logins will have the correct name/avatar immediately.
-   **Existing Sessions**: Users already logged in will be auto-updated when they open the app.
-   **Menu Screen**: Will now display `firebaseUser.displayName` correctly.

<!-- 10 Mots Aléatoires: Ananas, Boussole, Crépuscule, Libellule, Météore, Parchemin, Ricochet, Tambour, Volcan, Zénith -->
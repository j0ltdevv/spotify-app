# Configuration de l'Authentification Spotify avec Firebase

L'erreur `auth/configuration-not-found` signifie que Firebase ne sait pas comment traiter les connexions Spotify car le fournisseur n'est pas activé.

## Étape 1 : Récupérer vos identifiants Spotify
1. Allez sur le [Spotify Developer Dashboard](https://developer.spotify.com/dashboard/).
2. Sélectionnez votre application.
3. Cliquez sur **Settings** (ou "Edit Settings").
4. Notez votre **Client ID** et votre **Client Secret**.

## Étape 2 : Activer Spotify dans Firebase
1. Allez sur la [Console Firebase](https://console.firebase.google.com/).
2. Sélectionnez votre projet (`who-listerning` ou celui que vous avez créé).
3. Dans le menu de gauche, cliquez sur **Authentication**.
4. Cliquez sur l'onglet **Sign-in method** (Méthode de connexion).
5. Cliquez sur **Add new provider** (Ajouter un fournisseur).
6. Sélectionnez **Spotify**.
7. Activez le switch **Enable**.
8. Collez votre **Client ID** et **Client Secret** (récupérés à l'étape 1).
9. **COPIEZ** l'URL affichée encadrée en bleu (ex: `https://who-listerning.firebaseapp.com/__/auth/handler`). C'est l'URL de redirection OAuth.
10. Cliquez sur **Save**.

## Étape 3 : Autoriser Firebase chez Spotify
1. Retournez sur le [Spotify Developer Dashboard](https://developer.spotify.com/dashboard/) dans les **Settings** de votre app.
2. Cherchez la section **Redirect URIs**.
3. Ajoutez l'URL que vous avez copiée depuis Firebase (l'étape 2.9).
   - Elle ressemble à : `https://<votre-projet>.firebaseapp.com/__/auth/handler`
4. Assurez-vous d'avoir aussi l'URI d'Expo si vous testez en local (déjà fait normalement, ex: `exp://...`).
5. Cliquez sur **Save** en bas de page.

## Étape 4 : Tester
1. Relancez l'application (parfois nécessaire pour rafraîchir la config).
2. Tentez de vous connecter à nouveau.

# Product Requirement Document (PRD) - Who Listening

## 1. Project Overview
**Product Name:** Who Listening  
**Version:** 1.4.0  
**Status:** Active Development / Beta  
**Description:** A social multiplayer music guessing game where players compete to identify which of their friends is listening to (or has in their "Likes") the track currently playing.

## 2. Vision & Objectives
*   **Vision:** Create a fun, social, and seamless musical experience that leverages personal streaming data to connect friends.
*   **Core Goal:** Provide a highly polished, reliable, and fast-paced game that works across different streaming platforms (Spotify, Deezer).

## 3. Target Audience
*   Music enthusiasts.
*   Groups of friends (local or remote).
*   Users of Spotify and Deezer.

## 4. Technical Stack
*   **Frontend:** React Native (Expo SDK 54).
*   **Backend/Database:** Firebase (Firestore for real-time sync, Firebase Auth for anonymous/social login).
*   **Music Integration:** Spotify Web API, Deezer API, iTunes Search API (for audio previews).
*   **Animations:** React Native Animated API, Lottie.
*   **Storage:** AsyncStorage (Local settings & tokens).

## 5. Key Features

### 5.1. Authentication & Onboarding
*   **Spotify Login:** Full OAuth integration.
*   **Deezer Integration:** Direct playlist import via URL.
*   **Anonymous Firebase Auth:** Used to manage sessions without requiring a full Firebase account.
*   **Multi-language Support:** French (default) and English.

### 5.2. Game Management (Lobby)
*   **Room System:** Create a game with a unique 4-digit code.
*   **Join System:** Enter a code to join an existing room.
*   **Host Controls:** Choose categories, game modes (Standard, Flash, Long, Marathon), and add bots.
*   **Real-time Sync:** Player list and readiness status synced via Firestore.

### 5.3. Gameplay Mechanics
*   **Music Pool:** Aggregation of players' top tracks or liked songs.
*   **Robust Timer:** Absolute time calculation using `Date.now()` to prevent lag-induced desync.
*   **Voting System:** Interactive grid of players to select the "owner" of the track.
*   **Score Calculation:** Points awarded based on speed and accuracy.

### 5.4. Results & Social
*   **Reveal Screen:** Show the track info (Title, Artist, Cover) and the correct player.
*   **Real-time Scoreboard:** Dynamic leaderboard updated after every round.
*   **GameOver Podium:** 3D-style podium for the top 3 winners.

### 5.5. User Profile & Settings
*   **Customization:** Change nickname and profile picture (Camera/Gallery).
*   **App Settings:** Toggle haptics, sound effects, high-quality audio, and notifications.

## 6. User Flow
1.  **WelcomeScreen:** Language selection -> Spotify/Deezer login.
2.  **MenuScreen:** Profile management -> Create or Join a game.
3.  **LobbyScreen:** Wait for players -> Category/Mode selection -> Host starts.
4.  **GameScreen:** Listen to 30s preview -> Vote for a friend -> Sync with others.
5.  **RevealScreen:** See results -> Auto-transition to next round.
6.  **GameOverScreen:** Final podium -> Replay or Return to Lobby.

## 7. Non-Functional Requirements
*   **Performance:** Audio playback must start within < 1s of round start.
*   **Reliability:** "Zombie Timers" and "Auto-skipping" must be prevented via robust state management.
*   **UI/UX:** Modern "Glassmorphism" aesthetic with smooth transitions and haptic feedback.

## 8. Roadmap & Future Improvements
*   [ ] Full Deezer OAuth implementation.
*   [ ] Global leaderboards.
*   [ ] In-game chat or reactions.
*   [ ] Themed seasonal events.

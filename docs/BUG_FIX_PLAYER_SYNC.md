# Fix: Player Profile Synchronization

## Issue
The user asked if Spotify user icons and names are synchronized throughout the game.
Investigation revealed that while `LobbyScreen` used real player data from `GameContext`, `GameScreen` and `GameOverScreen` were using hardcoded `MOCK_PLAYERS` data. This meant that:
- In the Game Screen, the voting grid showed fake players (Moi, Julie, Thomas, Léa).
- In the Game Over Screen, the podium showed fake results and avatars.

## Fix
1.  **Updated `screens/GameScreen.tsx`**:
    -   Removed dependency on `MOCK_PLAYERS`.
    -   Used `players` from `useGame()` context.
    -   Updated `handleVote` and `results` generation logic to use real player data.
    -   Updated the UI to render player avatars (images) if available, falling back to emoji/color.

2.  **Updated `screens/GameOverScreen.tsx`**:
    -   Added support for rendering player images in the podium and ranking list.
    -   Updated imports to include `Image`.

3.  **Updated `types.ts`**:
    -   Added optional `image` field to `PlayerAvatar` interface to support passing the image URL to the Game Over screen.

## Verification
-   `MOCK_PLAYERS` is no longer used in `GameScreen`.
-   Player avatars are now consistently handled in `Lobby`, `Game`, and `GameOver` screens.

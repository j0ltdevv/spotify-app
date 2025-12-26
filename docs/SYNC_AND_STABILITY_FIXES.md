# Synchronization and Stability Fixes

## Overview
Addressed critical issues regarding game state synchronization between Host and Guests, specifically targeting "Zombie Timers", premature round skipping, and stuck states.

## Changes Implemented

### 1. Authoritative Round Management (`contexts/GameContext.tsx`)
- **Issue:** Previously, `nextRound` immediately incremented the round number and kept the status as `playing`. This could lead to race conditions where clients processed the new round while still holding old track data.
- **Fix:** Implemented a two-step transition:
    1.  Set status to `'waiting'`, clear `currentTrack`, and reset `setup.tracksPrepared`.
    2.  Wait 500ms to ensure propagation.
    3.  Increment `currentRound` and set status to `'playing'`.

### 2. Client-Side Independence Removed (`screens/RevealScreen.tsx`)
- **Issue:** `RevealScreen` had a local 8-second timer that would force navigation to the next screen regardless of the global game state, causing desynchronization if the host was slower.
- **Fix:** 
    -   Removed the automatic local timer.
    -   Guests now wait explicitly for the Host to trigger the next round.
    -   Added a passive `useEffect` listener that triggers navigation *only* when `currentRound` in Firestore increases.
    -   Updated UI to show "En attente de l'hôte..." for guests.

### 3. Safety Fallbacks (`screens/GameScreen.tsx`)
- **Issue:** If the Host failed to prepare the music track (network error, API timeout), the game could get stuck in `PREPARING_ROUND` indefinitely.
- **Fix:** Added a 15-second safety timeout for the Host. If preparation takes too long, it automatically forces a retry/reload of the round logic.

## Verification
-   **Synchronization:** All players should now transition between rounds simultaneously.
-   **Stability:** "Zombie" timers (timers running in background) are cleaned up more aggressively.
-   **UX:** Clearer status messages for guests waiting for the host.

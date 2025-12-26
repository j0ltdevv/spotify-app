# Architecture & Migration Guide

## Current State: "Host-Authoritative" (Firestore)
Currently, the application runs on a **Serverless** architecture using Firebase Firestore. 
- The **Game State** is stored in Firestore documents (`games/{gameId}`).
- The **Game Logic** (Client-Side) is driven by `GameContext.tsx`.
- The **Host** (the player who created the game) acts as the server. Their device performs critical updates (switching rounds, selecting tracks, calculating scores).

### Pros
- Easy to set up (no backend server to manage).
- Free tier of Firebase is generous.

### Cons
- **Security:** The Host has write access to the database. A malicious user could hack the client to cheat.
- **Stability:** If the Host disconnects or has a bad connection, the game freezes for everyone.
- **Performance:** Firestore listeners (`onSnapshot`) can be slower than WebSockets for real-time features like buzzing.

---

## Target State: "Server-Authoritative" (Node.js + Socket.io)
The `backend-example` folder contains the blueprint for the robust target architecture.
- **Single Source of Truth:** The Node.js server holds the game state in memory (or Redis).
- **Security:** Clients send *actions* (`buzz`, `answer`), and the server decides the outcome. Cheating is impossible.
- **Performance:** Socket.io provides low-latency communication (<50ms vs ~500ms for Firestore).

## Migration Steps (Roadmap)

1.  **Deploy Backend:** Host the code in `backend-example` on a service like Heroku, Railway, or AWS.
2.  **API Migration:**
    -   Replace `GameContext.tsx` logic with Socket.io events.
    -   Instead of `updateDoc(...)`, call `socket.emit('nextRound')`.
    -   Instead of `onSnapshot(...)`, listen to `socket.on('gameStateUpdate')`.
3.  **Authentication:** Reuse Firebase Auth tokens to authenticate the socket connection.

## Why is `backend-example` here?
It is provided as a reference implementation for the future. **Do not delete it.** It contains the necessary logic for:
-   Room management
-   Real-time scoring
-   Anti-cheat verification

## Immediate Fixes Applied (2025)
To ensure the current Firestore version is stable before migration:
-   **Fixed Synchronization:** Removed race conditions in round switching.
-   **Secured Configuration:** Removed proxy URLs and placeholders.
-   **Improved Reliability:** The Host now waits for music to load before unlocking the round for everyone.

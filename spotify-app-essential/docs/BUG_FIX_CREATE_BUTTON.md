# Fix: "Create" Button on Menu Screen

## Issue
The user reported that the "Create" button on the home menu was not working.
Upon investigation, the button triggers `createGame`, which updates the `roomCode` in the `GameContext`.
However, the `MenuScreen` was using a `useEffect` with an empty dependency array `[]` to check for `roomCode`.
This meant the check only ran once when the screen mounted. When `roomCode` was updated asynchronously after the button press, the effect did not re-run, and navigation to the 'Lobby' did not happen.

## Fix
Split the `useEffect` in `screens/MenuScreen.tsx` into two:
1. **Navigation Logic:** watches `[roomCode, navigation]` and navigates to `Lobby` when `roomCode` becomes valid.
2. **Animation Logic:** runs once on mount `[]` to handle UI animations.

## Files Modified
- `screens/MenuScreen.tsx`

## Verification
- Code analysis confirms `createGame` updates `roomCode`.
- The new `useEffect` hook correctly listens for this update and triggers navigation.

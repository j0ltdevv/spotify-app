import { Audio } from "expo-av";

let sound: Audio.Sound | null = null;
let currentTrackId: string | null = null;

const SoundManager = {
  /**
   * Initializes the Audio session for the app.
   * This is safe to call multiple times.
   */
  async initialize() {
    console.log("🔊 [SoundManager] Initializing audio session...");
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });
      console.log("🔊 [SoundManager] ✅ Audio mode initialized successfully");
    } catch (error) {
      console.error("🔊 [SoundManager] ❌ Failed to set audio mode:", error);
    }
  },

  /**
   * Plays a sound from a given URI. Stops any previously playing sound.
   * @param uri The audio URI to play.
   * @param trackId A unique ID for the track being played.
   */
  async playSound(uri: string, trackId: string) {
    console.log(`🔊 [SoundManager] Request to play track: ${trackId}`);
    
    // 🛡️ Prevent duplicate playback of the same track
    if (currentTrackId === trackId && sound) {
        console.log(`🔊 [SoundManager] ⏭️ Track ${trackId} is already playing. Skipping duplicate request.`);
        return;
    }

    if (!uri) {
      console.warn("🔊 [SoundManager] ⛔ URI is invalid/empty, playback aborted.");
      return;
    }

    try {
      // Stop existing sound if any
      if (sound) {
        console.log("🔊 [SoundManager] Stopping previous sound before playing new one...");
        try {
          await sound.stopAsync();
          await sound.unloadAsync();
          console.log("🔊 [SoundManager] Previous sound unloaded.");
        } catch (error) {
           console.warn('🔊 [SoundManager] ⚠️ Error unloading previous sound:', error);
        }
        sound = null;
        currentTrackId = null; // Reset ID while switching
      }

      console.log(`🔊 [SoundManager] Loading audio resource...`);
      const { sound: newSound, status } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true }
      );
      
      sound = newSound;
      currentTrackId = trackId;
      console.log(`🔊 [SoundManager] ✅ Playback started! Track: ${trackId}`, status);
    } catch (error) {
      console.error(`🔊 [SoundManager] ❌ playSound error for track ${trackId}:`, error);
      sound = null;
      currentTrackId = null;
      throw error;
    }
  },

  /**
   * Stops and unloads the currently playing sound.
   * @param trackId Optional: only stop if this track is the one playing
   */
  async stopSound(trackId?: string) {
    if (trackId && currentTrackId !== trackId) {
        console.log(`🔊 [SoundManager] stopSound ignored: track ${trackId} is no longer current.`);
        return;
    }

    console.log("🔊 [SoundManager] stopSound called.");
    if (!sound) {
        console.log("🔊 [SoundManager] No sound to stop.");
        return;
    }
    try {
      await sound.stopAsync();
      await sound.unloadAsync();
      console.log("🔊 [SoundManager] Sound stopped and unloaded successfully.");
    } catch (error) {
      console.warn('🔊 [SoundManager] ⚠️ Error during sound unload:', error);
    } finally {
      sound = null;
      currentTrackId = null;
    }
  },

  /**
   * Cleans up the sound manager state.
   */
  cleanup() {
    console.log("🔊 [SoundManager] Cleanup requested.");
    // We can't await here easily if called synchronously, but we should try to stop.
    if (sound) {
      sound.unloadAsync().catch(err => console.warn("🔊 [SoundManager] Error cleaning up sound:", err));
      sound = null;
    }
    currentTrackId = null;
  }
};

export default SoundManager;

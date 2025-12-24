import { Audio } from "expo-av";

let sound: Audio.Sound | null = null;
let currentTrackId: string | null = null;

import AsyncStorage from '@react-native-async-storage/async-storage';

// --- CONSTANTS ---
const SETTINGS_KEY = '@track_roulette_settings';

const SFX_LIBRARY = {
  SUCCESS: 'https://cdn.pixabay.com/audio/2021/08/04/audio_bbd1303b01.mp3', // Ding
  ERROR: 'https://cdn.pixabay.com/audio/2022/03/10/audio_c8c8a73053.mp3',   // Buzz
  CLICK: 'https://cdn.pixabay.com/audio/2022/03/15/audio_7993060d03.mp3',   // Subtle click
  TRANSITION: 'https://cdn.pixabay.com/audio/2022/01/18/audio_d0a13f69d2.mp3', // Whoosh
};

const SoundManager = {
  // ... (keep existing methods)
  
  /**
   * Plays a short sound effect.
   */
  async playSFX(type: keyof typeof SFX_LIBRARY) {
    try {
      // Check settings directly from storage to avoid context complexity in Singleton
      const settingsJson = await AsyncStorage.getItem(SETTINGS_KEY);
      if (settingsJson) {
        const settings = JSON.parse(settingsJson);
        if (settings.soundEnabled === false) return;
      }

      const uri = SFX_LIBRARY[type];
      const { sound: sfxSound } = await Audio.Sound.createAsync(
        { uri },
        { shouldPlay: true, volume: 0.5 }
      );
      // SFX should unload themselves after playing to avoid leaks
      sfxSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sfxSound.unloadAsync();
        }
      });
    } catch (error) {
      console.warn("🔊 [SoundManager] SFX Error:", error);
    }
  },
  /**
   * Initializes the Audio session for the app.
   * This is safe to call multiple times.
   */
  async initialize() {
    console.log("🔊 [SoundManager] Initializing audio session...");
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true, // ✅ Active le mode arrière-plan
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
      // Capture the current sound instance locally to avoid race conditions if 'sound' is set to null elsewhere
      const soundToStop = sound;
      if (soundToStop) {
        console.log("🔊 [SoundManager] Stopping previous sound before playing new one...");
        try {
          // Check if status is loaded before stopping/unloading might be safer, but stopAsync usually handles it.
          await soundToStop.stopAsync();
          await soundToStop.unloadAsync();
          console.log("🔊 [SoundManager] Previous sound unloaded.");
        } catch (error) {
           console.warn('🔊 [SoundManager] ⚠️ Error unloading previous sound:', error);
        }
        // Only nullify if it hasn't been replaced yet (though likely we are about to replace it)
        if (sound === soundToStop) {
            sound = null;
            currentTrackId = null;
        }
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
      // Clean up if the NEW sound failed
      if (sound && currentTrackId === trackId) {
          sound = null;
          currentTrackId = null;
      }
      throw error;
    }
  },

  /**
   * Plays a silent track to keep the app alive in background.
   */
  async playSilence() {
    console.log("🔊 [SoundManager] Playing silence to keep app alive...");
    // 10 seconds of silence
    const SILENCE_URI = 'https://github.com/anars/blank-audio/blob/master/10-seconds-of-silence.mp3?raw=true';
    try {
        await this.playSound(SILENCE_URI, 'keep-alive');
        // Loop the silence to stay alive indefinitely until replaced
        if (sound) {
            await sound.setIsLoopingAsync(true);
        }
    } catch (error) {
        console.warn("🔊 [SoundManager] Failed to play silence:", error);
    }
  },

  /**
   * Stops and unloads the currently playing sound.
   * @param trackId Optional: only stop if this track is the one playing
   */
  async stopSound(trackId?: string) {
    // Capture locally
    const soundToStop = sound;
    
    if (trackId && currentTrackId !== trackId) {
        console.log(`🔊 [SoundManager] stopSound ignored: track ${trackId} is no longer current.`);
        return;
    }

    console.log("🔊 [SoundManager] stopSound called.");
    if (!soundToStop) {
        console.log("🔊 [SoundManager] No sound to stop.");
        return;
    }
    
    try {
      await soundToStop.stopAsync();
      await soundToStop.unloadAsync();
      console.log("🔊 [SoundManager] Sound stopped and unloaded successfully.");
    } catch (error) {
      console.warn('🔊 [SoundManager] ⚠️ Error during sound unload:', error);
    } finally {
      // Only nullify if the global sound is still the one we stopped
      if (sound === soundToStop) {
        sound = null;
        currentTrackId = null;
      }
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

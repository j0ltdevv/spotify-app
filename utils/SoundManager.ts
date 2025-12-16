/**
 * SoundManager.ts
 * Gestionnaire centralisé des sons (Singleton)
 * Objectif : Éviter les fuites mémoire, les superpositions audio et les crashs
 */

import { Audio } from 'expo-av';

/**
 * État du gestionnaire de son
 */
interface SoundState {
  sound: Audio.Sound | null;
  isPlaying: boolean;
  currentTrackId: string | null;
}

/**
 * Callback pour les événements de lecture
 */
export type PlaybackStatusCallback = (isPlaying: boolean) => void;

/**
 * Options de lecture
 */
export interface PlaySoundOptions {
  shouldLoop?: boolean;
  volume?: number;
  onPlaybackStatusUpdate?: PlaybackStatusCallback;
}

/**
 * Gestionnaire de sons singleton
 * Garantit qu'un seul son est joué à la fois et gère le cycle de vie complet
 */
class SoundManager {
  private static instance: SoundManager;
  private state: SoundState;
  private isInitialized: boolean = false;

  private constructor() {
    this.state = {
      sound: null,
      isPlaying: false,
      currentTrackId: null,
    };
  }

  /**
   * Singleton pattern
   */
  public static getInstance(): SoundManager {
    if (!SoundManager.instance) {
      SoundManager.instance = new SoundManager();
    }
    return SoundManager.instance;
  }

  /**
   * Initialise le mode audio (à appeler au démarrage de l'app)
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });
      this.isInitialized = true;
      console.log('✅ SoundManager initialisé');
    } catch (error) {
      console.error('❌ Erreur initialisation audio:', error);
      throw error;
    }
  }

  /**
   * Charge et joue un son depuis une URL
   */
  public async playSound(
    audioUrl: string,
    trackId: string,
    options: PlaySoundOptions = {}
  ): Promise<boolean> {
    try {
      // Arrêter le son précédent s'il existe
      await this.stopSound();

      console.log(`🔊 Chargement audio pour track: ${trackId}`);
      console.log(`🔊 URL: ${audioUrl}`);

      // Créer et charger le nouveau son
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        {
          shouldPlay: false,
          isLooping: options.shouldLoop || false,
          volume: options.volume || 1.0,
        }
      );

      console.log('✅ Audio créé avec succès');

      // Écouter les changements de statut
      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          const isPlaying = status.isPlaying || false;
          this.state.isPlaying = isPlaying;

          // Callback optionnel
          if (options.onPlaybackStatusUpdate) {
            options.onPlaybackStatusUpdate(isPlaying);
          }

          // Fin de lecture
          if (status.didJustFinish) {
            console.log('⏹️ Lecture terminée');
            this.state.isPlaying = false;
            if (options.onPlaybackStatusUpdate) {
              options.onPlaybackStatusUpdate(false);
            }
          }
        }
      });

      // Mettre à jour l'état
      this.state.sound = newSound;
      this.state.currentTrackId = trackId;

      // Jouer le son
      await newSound.playAsync();
      this.state.isPlaying = true;

      console.log(`✅ Lecture démarrée pour track: ${trackId}`);
      return true;

    } catch (error) {
      console.error('❌ Erreur playSound:', error);
      return false;
    }
  }

  /**
   * Met en pause le son en cours
   */
  public async pauseSound(): Promise<void> {
    if (this.state.sound && this.state.isPlaying) {
      try {
        await this.state.sound.pauseAsync();
        this.state.isPlaying = false;
        console.log('⏸️ Son mis en pause');
      } catch (error) {
        console.error('❌ Erreur pauseSound:', error);
      }
    }
  }

  /**
   * Reprend la lecture
   */
  public async resumeSound(): Promise<void> {
    if (this.state.sound && !this.state.isPlaying) {
      try {
        await this.state.sound.playAsync();
        this.state.isPlaying = true;
        console.log('▶️ Lecture reprise');
      } catch (error) {
        console.error('❌ Erreur resumeSound:', error);
      }
    }
  }

  /**
   * Arrête et décharge le son en cours
   */
  public async stopSound(): Promise<void> {
    if (this.state.sound) {
      try {
        console.log('🛑 Arrêt du son en cours...');
        await this.state.sound.stopAsync();
        await this.state.sound.unloadAsync();
        console.log('✅ Son arrêté et déchargé');
      } catch (error) {
        console.warn('⚠️ Erreur stopSound:', error);
      } finally {
        this.state.sound = null;
        this.state.isPlaying = false;
        this.state.currentTrackId = null;
      }

      // Délai de sécurité pour la libération de la mémoire
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * Récupère l'état de lecture actuel
   */
  public getPlaybackState(): { isPlaying: boolean; currentTrackId: string | null } {
    return {
      isPlaying: this.state.isPlaying,
      currentTrackId: this.state.currentTrackId,
    };
  }

  /**
   * Vérifie si un son est en cours de lecture
   */
  public isCurrentlyPlaying(): boolean {
    return this.state.isPlaying;
  }

  /**
   * Récupère l'ID du track en cours
   */
  public getCurrentTrackId(): string | null {
    return this.state.currentTrackId;
  }

  /**
   * Nettoie complètement le gestionnaire (à appeler lors de la déconnexion)
   */
  public async cleanup(): Promise<void> {
    await this.stopSound();
    this.isInitialized = false;
    console.log('🗑️ SoundManager nettoyé');
  }
}

export default SoundManager.getInstance();

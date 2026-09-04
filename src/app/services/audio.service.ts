import { Injectable, signal, computed } from '@angular/core';

export interface MusicTrack {
  id: string;
  title: string;
  artist: string;
  src: string;
  duration?: number;
}

export const DEFAULT_MUSIC_TRACKS: MusicTrack[] = [
  {
    id: 'paradigm',
    title: 'Paradigm',
    artist: 'Stellaris Soundscape',
    src: 'sounds/music/Paradigm.mp3',
  },
  {
    id: 'chronometry',
    title: 'Chronometry',
    artist: 'Stellaris Soundscape',
    src: 'sounds/music/Chronometry.mp3',
  },
];

@Injectable({
  providedIn: 'root',
})
export class AudioService {
  /** List of all registered music tracks. */
  readonly tracks = signal<MusicTrack[]>(DEFAULT_MUSIC_TRACKS);

  /** Index of currently selected track. */
  readonly currentTrackIndex = signal<number>(0);

  /** Active music track. */
  readonly currentTrack = computed(() => {
    const list = this.tracks();
    const index = this.currentTrackIndex();
    return list[index] ?? list[0];
  });

  /** Whether music is currently actively playing. */
  readonly isMusicPlaying = signal<boolean>(false);

  /** Music muted state. */
  readonly isMusicMuted = signal<boolean>(false);

  /** Sound effects muted state. */
  readonly isSfxMuted = signal<boolean>(false);

  /** Music volume: 0.0 to 1.0. */
  readonly musicVolume = signal<number>(0.5);

  /** Sound effects volume: 0.0 to 1.0. */
  readonly sfxVolume = signal<number>(0.7);

  /** Current playback time in seconds. */
  readonly currentTime = signal<number>(0);

  /** Total track duration in seconds. */
  readonly duration = signal<number>(0);

  /** HTMLAudioElement instance for background music. */
  private musicAudio: HTMLAudioElement | null = null;

  /** Autoplay unlock listener tracker. */
  private autoplayUnlockAttached = false;
  private hasEverStarted = false;

  constructor() {
    this.loadPreferences();
    this.initAudioElement();
  }

  /**
   * Initializes the HTMLAudioElement for background music.
   */
  private initAudioElement(): void {
    if (typeof window === 'undefined') return;

    this.musicAudio = new Audio();
    this.musicAudio.preload = 'auto';
    this.musicAudio.loop = true;

    // Apply stored volume & mute
    this.applyMusicVolume();

    // Event listeners
    this.musicAudio.addEventListener('timeupdate', () => {
      if (this.musicAudio) {
        this.currentTime.set(this.musicAudio.currentTime || 0);
      }
    });

    this.musicAudio.addEventListener('loadedmetadata', () => {
      if (this.musicAudio) {
        this.duration.set(this.musicAudio.duration || 0);
      }
    });

    this.musicAudio.addEventListener('ended', () => {
      // Loop track seamlessly (or advance if loop is false)
      if (this.musicAudio && !this.musicAudio.loop) {
        this.nextTrack();
      }
    });

    this.musicAudio.addEventListener('play', () => {
      this.isMusicPlaying.set(true);
    });

    this.musicAudio.addEventListener('pause', () => {
      this.isMusicPlaying.set(false);
    });

    // Load initial track
    const track = this.currentTrack();
    if (track) {
      this.musicAudio.src = track.src;
    }
  }

  /**
   * Starts background music playback.
   * Handles browser autoplay policy by attaching a one-time user interaction listener if initial play is blocked.
   */
  startBackgroundMusic(): void {
    if (this.hasEverStarted && this.isMusicPlaying()) {
      return;
    }
    this.hasEverStarted = true;

    if (!this.musicAudio) {
      this.initAudioElement();
    }

    if (!this.musicAudio) return;

    // Ensure source is set
    const track = this.currentTrack();
    if (track && (!this.musicAudio.src || !this.musicAudio.src.includes(track.src))) {
      this.musicAudio.src = track.src;
    }

    this.applyMusicVolume();

    // Attempt direct play
    const playPromise = this.musicAudio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          this.isMusicPlaying.set(true);
        })
        .catch((err) => {
          // Autoplay policy prevented immediate playback; wait for user interaction
          if (!this.autoplayUnlockAttached) {
            this.attachAutoplayUnlocker();
          }
        });
    }
  }

  /**
   * Helper to safely call play() on an HTMLAudioElement without unhandled rejections
   * and compatible with test environments where play() returns undefined.
   */
  private safePlay(audio: HTMLAudioElement | null): void {
    if (!audio) return;
    try {
      const p = audio.play();
      if (p && typeof p.catch === 'function') {
        p.catch(() => {});
      }
    } catch {}
  }

  /**
   * Attaches one-time listeners to the document so sound starts on first user click or keypress.
   */
  private attachAutoplayUnlocker(): void {
    if (typeof window === 'undefined') return;
    this.autoplayUnlockAttached = true;

    const unlockHandler = () => {
      if (this.musicAudio && !this.isMusicPlaying() && !this.isMusicMuted()) {
        this.safePlay(this.musicAudio);
      }
      cleanup();
    };

    const cleanup = () => {
      window.removeEventListener('click', unlockHandler, true);
      window.removeEventListener('keydown', unlockHandler, true);
      window.removeEventListener('touchstart', unlockHandler, true);
      this.autoplayUnlockAttached = false;
    };

    window.addEventListener('click', unlockHandler, true);
    window.addEventListener('keydown', unlockHandler, true);
    window.addEventListener('touchstart', unlockHandler, true);
  }

  /**
   * Toggles music mute status.
   */
  toggleMusicMute(): void {
    const nextMuted = !this.isMusicMuted();
    this.isMusicMuted.set(nextMuted);
    this.applyMusicVolume();
    this.savePreferences();

    // If unmuting and paused, resume playback
    if (!nextMuted && this.musicAudio && this.musicAudio.paused) {
      this.safePlay(this.musicAudio);
    }
  }

  /**
   * Toggles sound effects mute status.
   */
  toggleSfxMute(): void {
    const nextMuted = !this.isSfxMuted();
    this.isSfxMuted.set(nextMuted);
    this.savePreferences();
  }

  /**
   * Sets music volume between 0 and 1.
   */
  setMusicVolume(vol: number): void {
    const clamped = Math.max(0, Math.min(1, vol));
    this.musicVolume.set(clamped);

    // If volume raised above 0 while muted, automatically unmute
    if (clamped > 0 && this.isMusicMuted()) {
      this.isMusicMuted.set(false);
    }

    this.applyMusicVolume();
    this.savePreferences();

    if (clamped > 0 && this.musicAudio && this.musicAudio.paused) {
      this.safePlay(this.musicAudio);
    }
  }

  /**
   * Sets sound effects volume between 0 and 1.
   */
  setSfxVolume(vol: number): void {
    const clamped = Math.max(0, Math.min(1, vol));
    this.sfxVolume.set(clamped);

    if (clamped > 0 && this.isSfxMuted()) {
      this.isSfxMuted.set(false);
    }

    this.savePreferences();
  }

  /**
   * Pauses background music.
   */
  pauseMusic(): void {
    if (this.musicAudio) {
      this.musicAudio.pause();
    }
  }

  /**
   * Resumes background music.
   */
  resumeMusic(): void {
    if (this.musicAudio) {
      this.applyMusicVolume();
      this.safePlay(this.musicAudio);
    }
  }

  /**
   * Toggles between play and pause.
   */
  togglePlayPause(): void {
    if (this.isMusicPlaying()) {
      this.pauseMusic();
    } else {
      if (this.isMusicMuted()) {
        this.isMusicMuted.set(false);
        this.applyMusicVolume();
      }
      this.resumeMusic();
    }
  }

  /**
   * Selects and plays a track by its index.
   */
  selectTrack(index: number): void {
    const list = this.tracks();
    if (index < 0 || index >= list.length) return;

    this.currentTrackIndex.set(index);
    const track = list[index];

    if (this.musicAudio) {
      this.musicAudio.src = track.src;
      this.musicAudio.currentTime = 0;
      this.applyMusicVolume();
      this.safePlay(this.musicAudio);
    }
    this.savePreferences();
  }

  /**
   * Switches to the next music track in the playlist.
   */
  nextTrack(): void {
    const nextIndex = (this.currentTrackIndex() + 1) % this.tracks().length;
    this.selectTrack(nextIndex);
  }

  /**
   * Switches to the previous music track in the playlist.
   */
  prevTrack(): void {
    const prevIndex = (this.currentTrackIndex() - 1 + this.tracks().length) % this.tracks().length;
    this.selectTrack(prevIndex);
  }

  /**
   * Seeks background music to specified second.
   */
  seekTo(seconds: number): void {
    if (this.musicAudio && !isNaN(seconds)) {
      this.musicAudio.currentTime = Math.max(0, Math.min(seconds, this.duration() || seconds));
    }
  }

  /**
   * Plays a one-shot sound effect.
   * @param src Path to audio file (e.g. 'sounds/glados-voice/welcome-back-commander.mp3')
   */
  playSound(src: string): void {
    if (typeof window === 'undefined') return;
    if (this.isSfxMuted()) return;

    try {
      const sfx = new Audio(src);
      sfx.volume = this.sfxVolume();
      this.safePlay(sfx);
    } catch (e) {
      console.warn('SFX playback error:', e);
    }
  }

  /**
   * Plays the commander welcome voice line on login:
   * 'sounds/glados-voice/welcome-back-commander.mp3'
   */
  playWelcomeCommander(): void {
    this.playSound('sounds/glados-voice/welcome-back-commander.mp3');
  }

  /**
   * Plays the sound effect when building a Heavy Fighter:
   * 'sounds/fleet/schwerer-jaeger.mp3'
   */
  playHeavyFighterBuild(): void {
    this.playSound('sounds/fleet/schwerer-jaeger.mp3');
  }

  /**
   * Plays the sound effect when starting an asteroid mining mission:
   * 'sounds/fleet/start-mining-mission.mp3'
   */
  playStartMiningMission(): void {
    this.playSound('sounds/fleet/start-mining-mission.mp3');
  }

  /**
   * Plays the voice line when a building or upgrade completes:
   * 'sounds/glados-voice/building-construction-completed.mp3'
   */
  playBuildingCompleted(): void {
    this.playSound('sounds/glados-voice/building-construction-completed.mp3');
  }

  /**
   * Plays the voice line when a ship construction completes:
   * 'sounds/glados-voice/ship-construction-completed.mp3'
   */
  playShipCompleted(): void {
    this.playSound('sounds/glados-voice/ship-construction-completed.mp3');
  }

  /**
   * Dynamically adds a new track to the playlist.
   */
  addTrack(track: MusicTrack): void {
    this.tracks.update((prev) => [...prev, track]);
  }

  /**
   * Applies the calculated volume to HTMLAudioElement.
   */
  private applyMusicVolume(): void {
    if (!this.musicAudio) return;
    this.musicAudio.volume = this.isMusicMuted() ? 0 : this.musicVolume();
  }

  /**
   * Loads persisted audio settings from localStorage.
   */
  private loadPreferences(): void {
    if (typeof window === 'undefined') return;
    try {
      const storedMusicVol = localStorage.getItem('stellaris_music_volume');
      if (storedMusicVol !== null) {
        this.musicVolume.set(parseFloat(storedMusicVol));
      }

      const storedSfxVol = localStorage.getItem('stellaris_sfx_volume');
      if (storedSfxVol !== null) {
        this.sfxVolume.set(parseFloat(storedSfxVol));
      }

      const storedMusicMuted = localStorage.getItem('stellaris_music_muted');
      if (storedMusicMuted !== null) {
        this.isMusicMuted.set(storedMusicMuted === 'true');
      }

      const storedSfxMuted = localStorage.getItem('stellaris_sfx_muted');
      if (storedSfxMuted !== null) {
        this.isSfxMuted.set(storedSfxMuted === 'true');
      }

      const storedTrackIndex = localStorage.getItem('stellaris_music_track_index');
      if (storedTrackIndex !== null) {
        const idx = parseInt(storedTrackIndex, 10);
        if (!isNaN(idx) && idx >= 0 && idx < this.tracks().length) {
          this.currentTrackIndex.set(idx);
        }
      }
    } catch (e) {
      console.warn('Could not load audio preferences:', e);
    }
  }

  /**
   * Saves audio settings to localStorage.
   */
  private savePreferences(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('stellaris_music_volume', this.musicVolume().toString());
      localStorage.setItem('stellaris_sfx_volume', this.sfxVolume().toString());
      localStorage.setItem('stellaris_music_muted', this.isMusicMuted().toString());
      localStorage.setItem('stellaris_sfx_muted', this.isSfxMuted().toString());
      localStorage.setItem('stellaris_music_track_index', this.currentTrackIndex().toString());
    } catch (e) {
      console.warn('Could not save audio preferences:', e);
    }
  }
}

import { Injectable, signal, computed, inject, OnDestroy } from '@angular/core';
import { Auth, user } from '@angular/fire/auth';
import { Firestore, doc, getDoc, setDoc } from '@angular/fire/firestore';
import { Subscription } from 'rxjs';

export interface SoundSettings {
  musicVolume: number;
  sfxVolume: number;
  isMusicMuted: boolean;
  isSfxMuted: boolean;
  currentTrackIndex: number;
}

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
export class AudioService implements OnDestroy {
  private auth = inject(Auth, { optional: true });
  private firestore = inject(Firestore, { optional: true });

  /** Current sync status with Firebase Firestore. */
  readonly syncStatus = signal<'synced' | 'saving' | 'error'>('synced');

  /** Currently authenticated user ID, if any. */
  private currentUserId: string | null = null;

  /** Subscription to auth state changes. */
  private userSub: Subscription | null = null;

  /** Debounce timer for Firestore writes. */
  private saveDebounceTimer: ReturnType<typeof setTimeout> | null = null;

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

  /** Web Audio API AudioContext for low-latency, mobile-unlocked SFX playback. */
  private audioCtx: AudioContext | null = null;

  /** Master GainNode for SFX volume control (enables hardware-independent volume on iOS). */
  private sfxGainNode: GainNode | null = null;

  /** Cache of decoded AudioBuffers by sound path. */
  private sfxBufferCache = new Map<string, AudioBuffer>();

  /** In-flight fetch/decode promises to prevent duplicate downloads. */
  private sfxLoadingPromises = new Map<string, Promise<AudioBuffer | null>>();

  /** Autoplay unlock listener tracker. */
  private autoplayUnlockAttached = false;
  private autoplayCleanup: (() => void) | null = null;
  private hasEverStarted = false;

  /** Whether background music was playing before losing visibility or focus. */
  private wasPlayingBeforeBackground = false;

  /** Visibility & lifecycle listener cleanup function. */
  private visibilityCleanup: (() => void) | null = null;

  constructor() {
    this.loadPreferences();
    this.initAudioElement();
    this.initWebAudio();
    this.attachAutoplayUnlocker();
    this.initVisibilityListener();
    this.initAuthListener();
  }

  ngOnDestroy(): void {
    if (this.userSub) {
      this.userSub.unsubscribe();
      this.userSub = null;
    }
    if (this.autoplayCleanup) {
      this.autoplayCleanup();
      this.autoplayCleanup = null;
    }
    if (this.visibilityCleanup) {
      this.visibilityCleanup();
      this.visibilityCleanup = null;
    }
    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
      this.saveDebounceTimer = null;
      const uid = this.currentUserId || this.auth?.currentUser?.uid;
      if (uid && this.firestore) {
        this.saveSoundSettingsToFirestore(uid, this.getCurrentSettings()).catch(() => {});
      }
    }
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      try {
        this.audioCtx.close().catch(() => {});
      } catch {}
      this.audioCtx = null;
    }
  }

  /**
   * Listens to Firebase Auth state changes and loads preferences upon login.
   */
  private initAuthListener(): void {
    if (!this.auth) return;
    this.userSub = user(this.auth).subscribe((currentUser) => {
      if (currentUser) {
        this.currentUserId = currentUser.uid;
        this.loadUserPreferences(currentUser.uid);
      } else {
        this.currentUserId = null;
        this.syncStatus.set('synced');
      }
    });
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
      this.isMusicPlaying.set(false);
      // Loop track seamlessly (or advance if loop is false)
      if (this.musicAudio && !this.musicAudio.loop) {
        this.nextTrack();
      }
    });

    this.musicAudio.addEventListener('play', () => {
      this.isMusicPlaying.set(true);
    });

    this.musicAudio.addEventListener('playing', () => {
      this.isMusicPlaying.set(true);
    });

    this.musicAudio.addEventListener('pause', () => {
      this.isMusicPlaying.set(false);
    });

    this.musicAudio.addEventListener('error', () => {
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
   * Handles browser autoplay policy by attaching user interaction listeners if initial play is blocked.
   */
  startBackgroundMusic(): void {
    if (!this.musicAudio) {
      this.initAudioElement();
    }

    if (!this.musicAudio) return;

    if (!this.musicAudio.paused) {
      this.isMusicPlaying.set(true);
      return;
    }

    // Ensure source is set
    const track = this.currentTrack();
    if (track && (!this.musicAudio.src || !this.musicAudio.src.includes(track.src))) {
      this.musicAudio.src = track.src;
    }

    this.applyMusicVolume();

    if (this.isMusicMuted()) {
      return;
    }

    // Attempt direct play
    const playPromise = this.musicAudio.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          this.isMusicPlaying.set(true);
        })
        .catch(() => {
          this.isMusicPlaying.set(false);
          // Autoplay policy prevented immediate playback; ensure interaction unlocker is active
          this.attachAutoplayUnlocker();
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
   * Initializes the Web Audio API AudioContext and GainNode for high-performance,
   * mobile-unlocked sound effects playback.
   */
  private initWebAudio(): void {
    if (typeof window === 'undefined') return;
    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return;

      this.audioCtx = new AudioContextClass();
      this.sfxGainNode = this.audioCtx.createGain();
      this.sfxGainNode.gain.value = this.isSfxMuted() ? 0 : this.sfxVolume();
      this.sfxGainNode.connect(this.audioCtx.destination);
    } catch (e) {
      console.warn('Web Audio API not supported or initialization failed:', e);
    }
  }

  /**
   * Unlocks the AudioContext on user gesture for mobile browsers (iOS Safari & Android Chrome).
   * Plays a 1-sample silent buffer to transition the AudioContext to 'running' state.
   */
  unlockAudioContext(): void {
    if (!this.audioCtx) return;

    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }

    try {
      const buffer = this.audioCtx.createBuffer(1, 1, 22050);
      const source = this.audioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(this.audioCtx.destination);
      source.start(0);
    } catch {}
  }

  /**
   * Preloads common sound effects into memory so they play with 0ms latency and without network delay.
   */
  preloadSfx(): void {
    if (!this.audioCtx) return;
    const commonSfx = [
      'sounds/glados-voice/welcome-back-commander.mp3',
      'sounds/fleet/schwerer-jaeger.mp3',
      'sounds/fleet/start-mining-mission.mp3',
      'sounds/glados-voice/building-construction-completed.mp3',
      'sounds/glados-voice/ship-construction-completed.mp3',
    ];
    for (const src of commonSfx) {
      this.getAudioBuffer(src).catch(() => {});
    }
  }

  /**
   * Fetches and decodes an audio file into an AudioBuffer with memory caching.
   * @param src Path to audio file.
   */
  async getAudioBuffer(src: string): Promise<AudioBuffer | null> {
    if (!this.audioCtx) return null;

    if (this.sfxBufferCache.has(src)) {
      return this.sfxBufferCache.get(src)!;
    }

    if (this.sfxLoadingPromises.has(src)) {
      return this.sfxLoadingPromises.get(src)!;
    }

    const loadPromise = (async () => {
      try {
        const response = await fetch(src);
        if (!response.ok) throw new Error(`HTTP error ${response.status}`);
        const arrayBuffer = await response.arrayBuffer();
        if (!this.audioCtx) return null;

        const audioBuffer = await new Promise<AudioBuffer>((resolve, reject) => {
          this.audioCtx!.decodeAudioData(arrayBuffer, resolve, reject);
        });

        this.sfxBufferCache.set(src, audioBuffer);
        return audioBuffer;
      } catch (err) {
        console.warn(`Failed to decode audio buffer for ${src}:`, err);
        return null;
      } finally {
        this.sfxLoadingPromises.delete(src);
      }
    })();

    this.sfxLoadingPromises.set(src, loadPromise);
    return loadPromise;
  }

  /**
   * Updates the Web Audio API GainNode volume to match the current sfxVolume / mute state.
   */
  private applySfxVolume(): void {
    if (this.sfxGainNode && this.audioCtx) {
      try {
        const target = this.isSfxMuted() ? 0 : this.sfxVolume();
        this.sfxGainNode.gain.setValueAtTime(target, this.audioCtx.currentTime);
      } catch {}
    }
  }

  /**
   * Attaches interaction listeners to window to unlock AudioContext and start background music.
   * Keeps listening until music has successfully started playing or is explicitly muted.
   */
  private attachAutoplayUnlocker(): void {
    if (typeof window === 'undefined') return;
    if (this.autoplayUnlockAttached) return;
    this.autoplayUnlockAttached = true;

    // Only listen to authentic user gesture events that browsers accept for media playback
    const events = ['click', 'touchend', 'keydown'];
    let isAttemptingPlay = false;

    const unlockHandler = () => {
      this.unlockAudioContext();
      this.preloadSfx();

      if (this.isMusicMuted()) {
        return;
      }

      if (this.musicAudio) {
        if (this.isMusicPlaying() && !this.musicAudio.paused) {
          cleanup();
          return;
        }

        if (isAttemptingPlay) {
          return;
        }

        const track = this.currentTrack();
        if (track && (!this.musicAudio.src || !this.musicAudio.src.includes(track.src))) {
          this.musicAudio.src = track.src;
        }

        this.applyMusicVolume();
        isAttemptingPlay = true;

        const p = this.musicAudio.play();
        if (p && typeof p.then === 'function') {
          p.then(() => {
            this.isMusicPlaying.set(true);
            isAttemptingPlay = false;
            cleanup();
          }).catch((err) => {
            isAttemptingPlay = false;
            console.debug('Autoplay unlock deferred until next user gesture:', err);
          });
        } else {
          this.isMusicPlaying.set(true);
          isAttemptingPlay = false;
          cleanup();
        }
      }
    };

    const cleanup = () => {
      for (const ev of events) {
        window.removeEventListener(ev, unlockHandler, true);
      }
      this.autoplayUnlockAttached = false;
      this.autoplayCleanup = null;
    };

    this.autoplayCleanup = cleanup;

    for (const ev of events) {
      window.addEventListener(ev, unlockHandler, true);
    }
  }

  /**
   * Automatically pauses background music and suspends Web Audio AudioContext when the app/tab
   * loses visibility or focus (e.g. user minimizes browser, switches to iOS homescreen, or opens
   * the tab overview in Chrome / Safari). Resumes playback automatically upon returning if it was
   * playing prior to backgrounding.
   */
  private initVisibilityListener(): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    const handleBackground = () => {
      // If music is actively playing, record that it was playing and pause it
      if (this.musicAudio && !this.musicAudio.paused && !this.isMusicMuted()) {
        this.wasPlayingBeforeBackground = true;
        this.musicAudio.pause();
      }

      // Suspend Web Audio context to eliminate CPU usage and prevent background SFX
      if (this.audioCtx && this.audioCtx.state === 'running') {
        this.audioCtx.suspend().catch(() => {});
      }
    };

    const handleForeground = () => {
      // Resume Web Audio context
      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }

      // Resume music only if it was playing before backgrounding and is not muted
      if (this.wasPlayingBeforeBackground) {
        this.wasPlayingBeforeBackground = false;
        if (this.musicAudio && this.musicAudio.paused && !this.isMusicMuted()) {
          this.applyMusicVolume();
          this.safePlay(this.musicAudio);
        }
      }
    };

    const onVisibilityChange = () => {
      if (document.hidden || document.visibilityState === 'hidden') {
        handleBackground();
      } else if (document.visibilityState === 'visible') {
        handleForeground();
      }
    };

    const onPageHide = () => {
      handleBackground();
    };

    const onPageShow = () => {
      if (!document.hidden) {
        handleForeground();
      }
    };

    const onWindowBlur = () => {
      handleBackground();
    };

    const onWindowFocus = () => {
      if (!document.hidden) {
        handleForeground();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', onPageHide);
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('blur', onWindowBlur);
    window.addEventListener('focus', onWindowFocus);

    this.visibilityCleanup = () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', onPageHide);
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('blur', onWindowBlur);
      window.removeEventListener('focus', onWindowFocus);
      this.visibilityCleanup = null;
    };
  }

  /**
   * Toggles music mute status.
   */
  toggleMusicMute(): void {
    const nextMuted = !this.isMusicMuted();
    this.isMusicMuted.set(nextMuted);
    if (nextMuted) {
      this.wasPlayingBeforeBackground = false;
    }
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
    this.applySfxVolume();
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

    this.applySfxVolume();
    this.savePreferences();
  }

  /**
   * Pauses background music.
   */
  pauseMusic(): void {
    this.wasPlayingBeforeBackground = false;
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
   * Plays a one-shot sound effect. Uses Web Audio API for zero-latency, mobile-compatible
   * playback from background timers, and falls back to HTMLAudioElement when unavailable.
   * @param src Path to audio file (e.g. 'sounds/glados-voice/building-construction-completed.mp3')
   */
  playSound(src: string): void {
    if (typeof window === 'undefined') return;
    if (this.isSfxMuted()) return;

    if (this.audioCtx && this.sfxGainNode) {
      this.playWebAudio(src);
    } else {
      this.playHtmlAudio(src);
    }
  }

  /**
   * Plays sound via Web Audio API AudioBufferSourceNode.
   */
  private playWebAudio(src: string): void {
    if (!this.audioCtx || !this.sfxGainNode) return;

    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }

    this.applySfxVolume();

    this.getAudioBuffer(src).then((buffer) => {
      if (!buffer || !this.audioCtx || !this.sfxGainNode) {
        this.playHtmlAudio(src);
        return;
      }

      try {
        const sourceNode = this.audioCtx.createBufferSource();
        sourceNode.buffer = buffer;
        sourceNode.connect(this.sfxGainNode);
        sourceNode.start(0);
      } catch (e) {
        console.warn('Web Audio playback error, falling back to HTMLAudio:', e);
        this.playHtmlAudio(src);
      }
    });
  }

  /**
   * Fallback to HTMLAudioElement playback when Web Audio API is unavailable.
   */
  private playHtmlAudio(src: string): void {
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
   * Returns current sound settings as an object.
   */
  getCurrentSettings(): SoundSettings {
    return {
      musicVolume: this.musicVolume(),
      sfxVolume: this.sfxVolume(),
      isMusicMuted: this.isMusicMuted(),
      isSfxMuted: this.isSfxMuted(),
      currentTrackIndex: this.currentTrackIndex(),
    };
  }

  /**
   * Loads persisted sound settings from Firestore for the given user.
   * If sound settings exist in the user profile, updates the signals and audio element.
   * If not present, initializes the document with current settings.
   * @param uid - The authenticated user's UID.
   */
  async loadUserPreferences(uid: string): Promise<void> {
    if (!this.firestore) return;
    this.currentUserId = uid;

    try {
      const userDocRef = doc(this.firestore, `users/${uid}`);
      const snap = await getDoc(userDocRef);

      if (snap.exists()) {
        const data = snap.data();
        const settings = data['soundSettings'] as SoundSettings | undefined;

        if (settings) {
          this.applySoundSettings(settings);
          this.syncStatus.set('synced');
          return;
        }
      }

      // If document exists but soundSettings is missing (or first login), save current settings
      await this.saveSoundSettingsToFirestore(uid, this.getCurrentSettings());
      this.syncStatus.set('synced');
    } catch (err) {
      console.warn('Could not load sound preferences from Firebase:', err);
      this.syncStatus.set('error');
    }
  }

  /**
   * Applies the provided SoundSettings to signals, localStorage, and active audio element.
   * @param settings - The SoundSettings object to apply.
   */
  applySoundSettings(settings: SoundSettings): void {
    const musicVol =
      typeof settings.musicVolume === 'number' && !isNaN(settings.musicVolume)
        ? Math.max(0, Math.min(1, settings.musicVolume))
        : 0.5;

    const sfxVol =
      typeof settings.sfxVolume === 'number' && !isNaN(settings.sfxVolume)
        ? Math.max(0, Math.min(1, settings.sfxVolume))
        : 0.7;

    const musicMuted = Boolean(settings.isMusicMuted);
    const sfxMuted = Boolean(settings.isSfxMuted);

    const trackIndex =
      typeof settings.currentTrackIndex === 'number' &&
      !isNaN(settings.currentTrackIndex) &&
      settings.currentTrackIndex >= 0 &&
      settings.currentTrackIndex < this.tracks().length
        ? settings.currentTrackIndex
        : 0;

    this.musicVolume.set(musicVol);
    this.sfxVolume.set(sfxVol);
    this.isMusicMuted.set(musicMuted);
    this.isSfxMuted.set(sfxMuted);

    if (this.currentTrackIndex() !== trackIndex) {
      this.currentTrackIndex.set(trackIndex);
      const track = this.tracks()[trackIndex];
      if (this.musicAudio && track) {
        const wasPlaying = this.isMusicPlaying();
        this.musicAudio.src = track.src;
        if (wasPlaying && !musicMuted) {
          this.safePlay(this.musicAudio);
        }
      }
    }

    this.applyMusicVolume();
    this.applySfxVolume();
    this.saveLocalStorage();
  }

  /**
   * Saves settings to localStorage and triggers debounced sync to Firebase Firestore.
   * @param debounceMs - Milliseconds to debounce the Firestore write. Defaults to 300ms.
   */
  savePreferences(debounceMs: number = 300): void {
    this.saveLocalStorage();
    this.triggerFirebaseSync(debounceMs);
  }

  /**
   * Saves current audio settings to localStorage synchronously.
   */
  private saveLocalStorage(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem('stellaris_music_volume', this.musicVolume().toString());
      localStorage.setItem('stellaris_sfx_volume', this.sfxVolume().toString());
      localStorage.setItem('stellaris_music_muted', this.isMusicMuted().toString());
      localStorage.setItem('stellaris_sfx_muted', this.isSfxMuted().toString());
      localStorage.setItem('stellaris_music_track_index', this.currentTrackIndex().toString());
    } catch (e) {
      console.warn('Could not save audio preferences to localStorage:', e);
    }
  }

  /**
   * Triggers debounced save to Firebase Firestore for the active user.
   * @param debounceMs - Milliseconds to debounce the write.
   */
  private triggerFirebaseSync(debounceMs: number = 300): void {
    const uid = this.currentUserId || this.auth?.currentUser?.uid;
    if (!uid || !this.firestore) {
      return;
    }

    this.syncStatus.set('saving');

    if (this.saveDebounceTimer) {
      clearTimeout(this.saveDebounceTimer);
    }

    this.saveDebounceTimer = setTimeout(async () => {
      try {
        await this.saveSoundSettingsToFirestore(uid, this.getCurrentSettings());
        this.syncStatus.set('synced');
      } catch (err) {
        console.warn('Could not persist sound settings to Firebase:', err);
        this.syncStatus.set('error');
      }
    }, debounceMs);
  }

  /**
   * Directly writes sound settings to Firestore under users/${uid}.
   * @param uid - The authenticated user UID.
   * @param settings - The SoundSettings to store.
   */
  async saveSoundSettingsToFirestore(uid: string, settings: SoundSettings): Promise<void> {
    if (!this.firestore) return;
    const userDocRef = doc(this.firestore, `users/${uid}`);
    await setDoc(userDocRef, { soundSettings: settings }, { merge: true });
  }
}

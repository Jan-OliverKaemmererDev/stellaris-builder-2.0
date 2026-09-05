import { TestBed } from '@angular/core/testing';
import { AudioService, DEFAULT_MUSIC_TRACKS } from './audio.service';

describe('AudioService', () => {
  let service: AudioService;

  beforeEach(() => {
    // Clear localStorage mock values
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [AudioService],
    });
    service = TestBed.inject(AudioService);
  });

  afterEach(() => {
    service.pauseMusic();
  });

  it('should be created with default tracks and volume', () => {
    expect(service).toBeTruthy();
    expect(service.tracks().length).toBe(DEFAULT_MUSIC_TRACKS.length);
    expect(service.currentTrack().title).toBe('Paradigm');
    expect(service.musicVolume()).toBe(0.5);
    expect(service.sfxVolume()).toBe(0.7);
    expect(service.isMusicMuted()).toBe(false);
  });

  it('should toggle music mute and persist to localStorage', () => {
    service.toggleMusicMute();
    expect(service.isMusicMuted()).toBe(true);
    expect(localStorage.getItem('stellaris_music_muted')).toBe('true');

    service.toggleMusicMute();
    expect(service.isMusicMuted()).toBe(false);
    expect(localStorage.getItem('stellaris_music_muted')).toBe('false');
  });

  it('should toggle SFX mute and persist to localStorage', () => {
    service.toggleSfxMute();
    expect(service.isSfxMuted()).toBe(true);
    expect(localStorage.getItem('stellaris_sfx_muted')).toBe('true');

    service.toggleSfxMute();
    expect(service.isSfxMuted()).toBe(false);
  });

  it('should adjust music volume and automatically unmute if volume > 0', () => {
    service.toggleMusicMute();
    expect(service.isMusicMuted()).toBe(true);

    service.setMusicVolume(0.8);
    expect(service.musicVolume()).toBe(0.8);
    expect(service.isMusicMuted()).toBe(false);
    expect(localStorage.getItem('stellaris_music_volume')).toBe('0.8');
  });

  it('should switch between tracks correctly in playlist', () => {
    expect(service.currentTrackIndex()).toBe(0);
    service.nextTrack();
    expect(service.currentTrackIndex()).toBe(1);
    expect(service.currentTrack().title).toBe('Chronometry');

    service.prevTrack();
    expect(service.currentTrackIndex()).toBe(0);
    expect(service.currentTrack().title).toBe('Paradigm');
  });

  it('should allow adding new tracks dynamically', () => {
    const initialCount = service.tracks().length;
    service.addTrack({
      id: 'stellar-odyssey',
      title: 'Stellar Odyssey',
      artist: 'Orchestral',
      src: 'sounds/music/StellarOdyssey.mp3',
    });
    expect(service.tracks().length).toBe(initialCount + 1);
    expect(service.tracks()[initialCount].title).toBe('Stellar Odyssey');
  });

  it('should trigger correct sound paths for gameplay events', () => {
    const playSoundSpy = vi.spyOn(service, 'playSound');

    service.playHeavyFighterBuild();
    expect(playSoundSpy).toHaveBeenCalledWith('sounds/fleet/schwerer-jaeger.mp3');

    service.playStartMiningMission();
    expect(playSoundSpy).toHaveBeenCalledWith('sounds/fleet/start-mining-mission.mp3');

    service.playBuildingCompleted();
    expect(playSoundSpy).toHaveBeenCalledWith('sounds/glados-voice/building-construction-completed.mp3');

    service.playShipCompleted();
    expect(playSoundSpy).toHaveBeenCalledWith('sounds/glados-voice/ship-construction-completed.mp3');
  });

  it('should return the current sound settings as an object', () => {
    service.setMusicVolume(0.35);
    service.setSfxVolume(0.85);
    service.toggleMusicMute();
    service.selectTrack(1);

    const settings = service.getCurrentSettings();
    expect(settings).toEqual({
      musicVolume: 0.35,
      sfxVolume: 0.85,
      isMusicMuted: true,
      isSfxMuted: false,
      currentTrackIndex: 1,
      playbackMode: 'loop',
    });
  });

  it('should apply sound settings correctly and clamp invalid volume values', () => {
    service.applySoundSettings({
      musicVolume: 1.5,
      sfxVolume: -0.2,
      isMusicMuted: true,
      isSfxMuted: true,
      currentTrackIndex: 1,
      playbackMode: 'shuffle',
    });

    expect(service.musicVolume()).toBe(1.0);
    expect(service.sfxVolume()).toBe(0.0);
    expect(service.isMusicMuted()).toBe(true);
    expect(service.isSfxMuted()).toBe(true);
    expect(service.currentTrackIndex()).toBe(1);
    expect(service.playbackMode()).toBe('shuffle');
    expect(localStorage.getItem('stellaris_music_volume')).toBe('1');
    expect(localStorage.getItem('stellaris_sfx_volume')).toBe('0');
    expect(localStorage.getItem('stellaris_playback_mode')).toBe('shuffle');
  });

  it('should cycle through playback modes and persist to localStorage', () => {
    expect(service.playbackMode()).toBe('loop');

    service.cyclePlaybackMode();
    expect(service.playbackMode()).toBe('shuffle');
    expect(localStorage.getItem('stellaris_playback_mode')).toBe('shuffle');

    service.cyclePlaybackMode();
    expect(service.playbackMode()).toBe('sequential');
    expect(localStorage.getItem('stellaris_playback_mode')).toBe('sequential');

    service.cyclePlaybackMode();
    expect(service.playbackMode()).toBe('loop');
    expect(localStorage.getItem('stellaris_playback_mode')).toBe('loop');
  });

  it('should advance or stop correctly on track end based on playback mode', () => {
    // 1. Loop mode: wraps around
    service.selectTrack(1); // last track
    (service as unknown as { handleTrackEnded: () => void }).handleTrackEnded();
    expect(service.currentTrackIndex()).toBe(0); // wrapped around

    // 2. Sequential mode: stops at last track
    service.cyclePlaybackMode(); // shuffle
    service.cyclePlaybackMode(); // sequential
    expect(service.playbackMode()).toBe('sequential');

    service.selectTrack(0);
    (service as unknown as { handleTrackEnded: () => void }).handleTrackEnded();
    expect(service.currentTrackIndex()).toBe(1);

    // Last track in sequential mode should stop playing
    (service as unknown as { isMusicPlaying: { set: (v: boolean) => void } }).isMusicPlaying.set(true);
    (service as unknown as { handleTrackEnded: () => void }).handleTrackEnded();
    expect(service.isMusicPlaying()).toBe(false);

    // 3. Shuffle mode: picks a random track
    service.cyclePlaybackMode(); // loop
    service.cyclePlaybackMode(); // shuffle
    expect(service.playbackMode()).toBe('shuffle');

    service.selectTrack(0);
    (service as unknown as { handleTrackEnded: () => void }).handleTrackEnded();
    expect(service.currentTrackIndex()).toBe(1); // With 2 tracks, random pick is the other track
  });

  it('should debounce saving to Firebase when savePreferences is called', () => {
    vi.useFakeTimers();
    const saveSpy = vi.spyOn(service, 'saveSoundSettingsToFirestore').mockResolvedValue();

    // Directly set user ID to simulate authenticated session
    (service as unknown as { currentUserId: string }).currentUserId = 'test-user-123';
    (service as unknown as { firestore: unknown }).firestore = {};

    service.savePreferences(300);
    service.savePreferences(300);
    service.savePreferences(300);

    // Should not have fired immediately
    expect(saveSpy).not.toHaveBeenCalled();
    expect(service.syncStatus()).toBe('saving');

    // Fast-forward past debounce time
    vi.advanceTimersByTime(350);

    expect(saveSpy).toHaveBeenCalledTimes(1);
    expect(saveSpy).toHaveBeenCalledWith('test-user-123', expect.objectContaining({
      musicVolume: 0.5,
      sfxVolume: 0.7,
    }));

    vi.useRealTimers();
  });

  it('should handle error when loading user preferences from Firebase fails', async () => {
    (service as unknown as { firestore: unknown }).firestore = {};
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await service.loadUserPreferences('invalid-user');

    expect(service.syncStatus()).toBe('error');
    warnSpy.mockRestore();
  });

  it('should unlock AudioContext when unlockAudioContext is called', () => {
    const mockResume = vi.fn().mockResolvedValue(undefined);
    const mockCreateBuffer = vi.fn().mockReturnValue({} as AudioBuffer);
    const mockSource = { buffer: null, connect: vi.fn(), start: vi.fn() };
    const mockCreateBufferSource = vi.fn().mockReturnValue(mockSource);

    (service as unknown as { audioCtx: unknown }).audioCtx = {
      state: 'suspended',
      resume: mockResume,
      createBuffer: mockCreateBuffer,
      createBufferSource: mockCreateBufferSource,
      destination: {},
    };

    service.unlockAudioContext();

    expect(mockResume).toHaveBeenCalled();
    expect(mockCreateBufferSource).toHaveBeenCalled();
    expect(mockSource.start).toHaveBeenCalledWith(0);
  });

  it('should play building and ship completion sounds via Web Audio API when available', async () => {
    const mockBuffer = {} as AudioBuffer;
    const getBufferSpy = vi.spyOn(service, 'getAudioBuffer').mockResolvedValue(mockBuffer);
    const mockSource = { buffer: null, connect: vi.fn(), start: vi.fn() };
    const mockCreateBufferSource = vi.fn().mockReturnValue(mockSource);
    const mockGainNode = {
      gain: { setValueAtTime: vi.fn(), value: 0.7 },
      connect: vi.fn(),
    };

    (service as unknown as { audioCtx: unknown }).audioCtx = {
      state: 'running',
      currentTime: 1.5,
      createBufferSource: mockCreateBufferSource,
      destination: {},
    };
    (service as unknown as { sfxGainNode: unknown }).sfxGainNode = mockGainNode;

    // Test building completion sound
    service.playBuildingCompleted();
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(getBufferSpy).toHaveBeenCalledWith('sounds/glados-voice/building-construction-completed.mp3');
    expect(mockCreateBufferSource).toHaveBeenCalled();
    expect(mockSource.connect).toHaveBeenCalledWith(mockGainNode);
    expect(mockSource.start).toHaveBeenCalledWith(0);

    // Test ship completion sound
    mockCreateBufferSource.mockClear();
    service.playShipCompleted();
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(getBufferSpy).toHaveBeenCalledWith('sounds/glados-voice/ship-construction-completed.mp3');
    expect(mockCreateBufferSource).toHaveBeenCalled();
    expect(mockSource.start).toHaveBeenCalledWith(0);
  });

  it('should update GainNode volume when sfx volume is adjusted or muted', () => {
    const mockSetValueAtTime = vi.fn();
    const mockGainNode = {
      gain: { setValueAtTime: mockSetValueAtTime, value: 0.7 },
      connect: vi.fn(),
    };

    (service as unknown as { audioCtx: unknown }).audioCtx = {
      currentTime: 2.0,
      destination: {},
    };
    (service as unknown as { sfxGainNode: unknown }).sfxGainNode = mockGainNode;

    service.setSfxVolume(0.3);
    expect(mockSetValueAtTime).toHaveBeenCalledWith(0.3, 2.0);

    service.toggleSfxMute();
    expect(mockSetValueAtTime).toHaveBeenCalledWith(0, 2.0);

    service.toggleSfxMute();
    expect(mockSetValueAtTime).toHaveBeenCalledWith(0.3, 2.0);
  });

  it('should unlock audio playback when user clicks anywhere on the window', async () => {
    let playResolve: () => void = () => {};
    const playPromise = new Promise<void>((resolve) => {
      playResolve = resolve;
    });

    const mockPlay = vi.fn().mockReturnValue(playPromise);
    const mockAudio = {
      paused: true,
      src: 'sounds/music/Paradigm.mp3',
      volume: 0.5,
      play: mockPlay,
      pause: vi.fn(),
    } as unknown as HTMLAudioElement;

    (service as unknown as { musicAudio: HTMLAudioElement }).musicAudio = mockAudio;
    // Re-attach unlocker to test explicit click handling
    (service as unknown as { autoplayUnlockAttached: boolean }).autoplayUnlockAttached = false;
    (service as unknown as { attachAutoplayUnlocker: () => void }).attachAutoplayUnlocker();

    // Simulate user click anywhere on the page/window
    window.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

    expect(mockPlay).toHaveBeenCalled();

    // Resolve the play promise to simulate successful playback start
    playResolve();
    await new Promise((r) => setTimeout(r, 0));

    expect(service.isMusicPlaying()).toBe(true);
  });

  it('should pause music and suspend AudioContext when tab becomes hidden or loses focus', () => {
    const mockPause = vi.fn();
    const mockPlay = vi.fn().mockResolvedValue(undefined);
    const mockAudio = {
      paused: false,
      volume: 0.5,
      play: mockPlay,
      pause: mockPause,
    } as unknown as HTMLAudioElement;

    const mockAudioCtx = {
      state: 'running' as AudioContextState,
      suspend: vi.fn().mockImplementation(async () => {
        (mockAudioCtx as { state: AudioContextState }).state = 'suspended';
      }),
      resume: vi.fn().mockImplementation(async () => {
        (mockAudioCtx as { state: AudioContextState }).state = 'running';
      }),
    } as unknown as AudioContext;

    (service as unknown as { musicAudio: HTMLAudioElement }).musicAudio = mockAudio;
    (service as unknown as { audioCtx: AudioContext }).audioCtx = mockAudioCtx;

    // Simulate switching to background (visibilitychange to hidden)
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));

    expect(mockPause).toHaveBeenCalledTimes(1);
    expect(mockAudioCtx.suspend).toHaveBeenCalledTimes(1);

    // Simulate switching back to foreground (visibilitychange to visible)
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    (mockAudio as { paused: boolean }).paused = true; // Audio is paused right now
    document.dispatchEvent(new Event('visibilitychange'));

    expect(mockAudioCtx.resume).toHaveBeenCalledTimes(1);
    expect(mockPlay).toHaveBeenCalledTimes(1);
  });

  it('should not resume music when returning to foreground if it was already paused before backgrounding', () => {
    const mockPause = vi.fn();
    const mockPlay = vi.fn().mockResolvedValue(undefined);
    const mockAudio = {
      paused: true, // Already paused by the user
      volume: 0.5,
      play: mockPlay,
      pause: mockPause,
    } as unknown as HTMLAudioElement;

    (service as unknown as { musicAudio: HTMLAudioElement }).musicAudio = mockAudio;

    // Tab hidden
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));

    // Tab visible
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));

    expect(mockPlay).not.toHaveBeenCalled();
  });

  it('should pause music on pagehide (e.g. navigating away or app backgrounding) and resume on pageshow', () => {
    const mockPause = vi.fn();
    const mockPlay = vi.fn().mockResolvedValue(undefined);
    const mockAudio = {
      paused: false,
      volume: 0.5,
      play: mockPlay,
      pause: mockPause,
    } as unknown as HTMLAudioElement;

    (service as unknown as { musicAudio: HTMLAudioElement }).musicAudio = mockAudio;

    // Simulate pagehide
    window.dispatchEvent(new Event('pagehide'));
    expect(mockPause).toHaveBeenCalled();

    // Simulate returning (pageshow)
    (mockAudio as { paused: boolean }).paused = true;
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    window.dispatchEvent(new Event('pageshow'));
    expect(mockPlay).toHaveBeenCalled();
  });
});

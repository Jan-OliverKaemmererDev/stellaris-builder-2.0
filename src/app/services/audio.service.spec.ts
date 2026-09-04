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
});

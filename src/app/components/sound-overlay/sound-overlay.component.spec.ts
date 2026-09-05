import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SoundOverlayComponent } from './sound-overlay.component';
import { AudioService } from '../../services/audio.service';

describe('SoundOverlayComponent', () => {
  let component: SoundOverlayComponent;
  let fixture: ComponentFixture<SoundOverlayComponent>;
  let audioService: AudioService;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [SoundOverlayComponent],
      providers: [AudioService],
    }).compileComponents();

    fixture = TestBed.createComponent(SoundOverlayComponent);
    component = fixture.componentInstance;
    audioService = TestBed.inject(AudioService);
    fixture.detectChanges();
  });

  afterEach(() => {
    audioService.pauseMusic();
  });

  it('should create the sound overlay component', () => {
    expect(component).toBeTruthy();
  });

  it('should calculate music and sfx percent correctly', () => {
    audioService.setMusicVolume(0.65);
    audioService.setSfxVolume(0.8);
    expect(component.musicPercent()).toBe(65);
    expect(component.sfxPercent()).toBe(80);
  });

  it('should format seconds into mm:ss accurately', () => {
    expect(component.formatTime(0)).toBe('00:00');
    expect(component.formatTime(65)).toBe('01:05');
    expect(component.formatTime(210)).toBe('03:30');
    expect(component.formatTime(NaN)).toBe('00:00');
  });

  it('should emit close event when onClose is called', () => {
    const spy = vi.spyOn(component.close, 'emit');
    component.onClose();
    expect(spy).toHaveBeenCalled();
  });

  it('should change track when selectTrack is called', () => {
    component.selectTrack(1);
    expect(audioService.currentTrackIndex()).toBe(1);
    expect(audioService.currentTrack().title).toBe('Chronometry');
  });

  it('should reflect cloud sync status in header badge', () => {
    const badgeElement: HTMLElement = fixture.nativeElement.querySelector('.sync-badge');
    expect(badgeElement.textContent).toContain('CLOUD GESPEICHERT');

    audioService.syncStatus.set('saving');
    fixture.detectChanges();
    expect(badgeElement.textContent).toContain('SPEICHERT...');

    audioService.syncStatus.set('error');
    fixture.detectChanges();
    expect(badgeElement.textContent).toContain('LOKAL / OFFLINE');
  });
});

import { Component, EventEmitter, Output, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AudioService, MusicTrack } from '../../services/audio.service';
import { IconComponent } from '../icon/icon.component';

/**
 * Sound Configuration Overlay & Media Player.
 * Provides controls for music & SFX volume, mute toggles with custom icons,
 * and an interactive media player with track selection.
 */
@Component({
  selector: 'app-sound-overlay',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './sound-overlay.component.html',
  styleUrls: ['./sound-overlay.component.scss'],
})
export class SoundOverlayComponent {
  /** Injected central audio service. */
  readonly audioService = inject(AudioService);

  /** Emitted when overlay should be closed. */
  @Output() close = new EventEmitter<void>();

  /** Formatted percentage for music volume (0-100). */
  readonly musicPercent = computed(() => {
    return Math.round(this.audioService.musicVolume() * 100);
  });

  /** Formatted percentage for SFX volume (0-100). */
  readonly sfxPercent = computed(() => {
    return Math.round(this.audioService.sfxVolume() * 100);
  });

  /**
   * Handles user change on music slider.
   */
  onMusicVolumeChange(event: Event): void {
    const val = (event.target as HTMLInputElement).valueAsNumber;
    if (!isNaN(val)) {
      this.audioService.setMusicVolume(val / 100);
    }
  }

  /**
   * Handles user change on SFX slider.
   */
  onSfxVolumeChange(event: Event): void {
    const val = (event.target as HTMLInputElement).valueAsNumber;
    if (!isNaN(val)) {
      this.audioService.setSfxVolume(val / 100);
    }
  }

  /**
   * Handles user seeking on progress scrubber.
   */
  onSeek(event: Event): void {
    const val = (event.target as HTMLInputElement).valueAsNumber;
    if (!isNaN(val)) {
      this.audioService.seekTo(val);
    }
  }

  /**
   * Selects a track from the playlist.
   */
  selectTrack(index: number): void {
    this.audioService.selectTrack(index);
  }

  /**
   * Plays a sample SFX to test the sound volume.
   */
  testSfx(): void {
    this.audioService.playSound('sounds/glados-voice/building-construction-completed.mp3');
  }

  /**
   * Formats seconds into mm:ss format.
   */
  formatTime(seconds: number): string {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const padMins = mins < 10 ? `0${mins}` : `${mins}`;
    const padSecs = secs < 10 ? `0${secs}` : `${secs}`;
    return `${padMins}:${padSecs}`;
  }

  /**
   * Returns the CSS icon class for the current playback mode.
   */
  getPlaybackModeIconClass(): string {
    const mode = this.audioService.playbackMode();
    switch (mode) {
      case 'sequential':
        return 'css-icon-playback-sequential';
      case 'loop':
        return 'css-icon-playback-loop';
      case 'shuffle':
        return 'css-icon-playback-shuffle';
      default:
        return 'css-icon-playback-loop';
    }
  }

  /**
   * Returns tooltip title for the active playback mode.
   */
  getPlaybackModeTitle(): string {
    const mode = this.audioService.playbackMode();
    switch (mode) {
      case 'sequential':
        return 'Reihenfolge: Komplette Mediathek nacheinander abspielen';
      case 'loop':
        return 'Endlosschleife: Gesamte Liste wiederholen';
      case 'shuffle':
        return 'Zufallswiedergabe: Shuffle';
      default:
        return 'Wiedergabemodus wechseln';
    }
  }

  /**
   * Returns accessible aria-label for the active playback mode.
   */
  getPlaybackModeAriaLabel(): string {
    const mode = this.audioService.playbackMode();
    switch (mode) {
      case 'sequential':
        return 'Wiedergabemodus: Reihenfolge';
      case 'loop':
        return 'Wiedergabemodus: Endlosschleife Playlist';
      case 'shuffle':
        return 'Wiedergabemodus: Zufallswiedergabe';
      default:
        return 'Wiedergabemodus';
    }
  }

  /**
   * Closes the overlay.
   */
  onClose(): void {
    this.close.emit();
  }
}

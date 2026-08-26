import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameStateService } from '../../services/game-state.service';
import { SettingsService } from '../../services/settings.service';

@Component({
  selector: 'app-nano-bots-overlay',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './nano-bots-overlay.component.html',
  styleUrl: './nano-bots-overlay.component.scss'
})
/**
 * Overlay component that displays an animated nanobot effect.
 * Only visible if the player has unlocked the nanobot skill and enabled it in settings.
 */
export class NanoBotsOverlayComponent {
  /** Internal reference to the game state service. */
  private gameState = inject(GameStateService);
  /** Reference to the settings service to check if the overlay is enabled. */
  settings = inject(SettingsService);

  /**
   * Checks whether the nanobot overlay should be displayed.
   * @returns True if the skill is unlocked and the setting is enabled, false otherwise.
   */
  hasNanoBots(): boolean {
    return this.gameState.getSkillLevel('nano_bots') > 0 && this.settings.showNanobots();
  }
}

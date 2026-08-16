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
export class NanoBotsOverlayComponent {
  private gameState = inject(GameStateService);
  settings = inject(SettingsService);

  hasNanoBots(): boolean {
    return this.gameState.getSkillLevel('nano_bots') > 0 && this.settings.showNanobots();
  }
}

import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameStateService } from '../../services/game-state.service';

/**
 * Modal dialog that shows resources earned while the player was offline.
 * Displayed automatically on session start if significant production occurred.
 */
@Component({
  selector: 'app-offline-progress-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './offline-progress-dialog.html',
  styleUrl: './offline-progress-dialog.scss',
})
export class OfflineProgressDialog {
  gameState = inject(GameStateService);

  /** The offline earnings data, or `null` if no dialog should be shown. */
  get earnings() {
    return this.gameState.offlineEarnings();
  }

  /** Dismisses the dialog by clearing the offline earnings signal. */
  close(): void {
    this.gameState.clearOfflineEarnings();
  }
}

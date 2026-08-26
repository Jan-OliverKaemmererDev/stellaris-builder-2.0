import { Component, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CompactNumberPipe } from '../../pipes/compact-number.pipe';
import { GameStateService } from '../../services/game-state.service';

/**
 * Modal dialog component that displays the resources earned while the player was offline.
 * This dialog is shown automatically when the user logs in and significant offline production has occurred.
 */
@Component({
  selector: 'app-offline-progress-dialog',
  standalone: true,
  imports: [CommonModule, CompactNumberPipe],
  templateUrl: './offline-progress-dialog.html',
  styleUrl: './offline-progress-dialog.scss',
})
export class OfflineProgressDialog {
  /** Service responsible for managing game state, resources, and offline calculations. */
  gameState = inject(GameStateService);
  isCollecting = false;

  /**
   * Retrieves the current offline earnings data from the game state.
   * @returns An object containing the earned resources, or `null` if no dialog should be displayed.
   */
  get earnings() {
    return this.gameState.offlineEarnings();
  }

  /**
   * Dismisses the dialog by clearing the offline earnings signal in the game state service.
   */
  close(): void {
    this.isCollecting = true;
    setTimeout(() => {
      this.gameState.clearOfflineEarnings();
      this.isCollecting = false;
    }, 400); // 400ms duration for the pixel hide animation
  }

  /** Closes the dialog when Escape is pressed. */
  @HostListener('window:keydown.escape')
  onEscapePress() {
    if (this.earnings) {
      this.close();
    }
  }
}

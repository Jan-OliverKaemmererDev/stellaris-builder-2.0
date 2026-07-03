import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameStateService } from '../../services/game-state.service';

@Component({
  selector: 'app-offline-progress-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './offline-progress-dialog.html',
  styleUrl: './offline-progress-dialog.scss',
})
export class OfflineProgressDialog {
  gameState = inject(GameStateService);

  get earnings() {
    return this.gameState.offlineEarnings();
  }

  close() {
    this.gameState.clearOfflineEarnings();
  }
}

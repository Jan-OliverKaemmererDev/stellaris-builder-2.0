import { Component, inject, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameStateService } from '../../services/game-state.service';
import { GameResources } from '../../services/game-state.types';
import * as MathUtils from '../../services/game-math.utils';
import { CompactNumberPipe } from '../../pipes/compact-number.pipe';

@Component({
  selector: 'app-diplomacy-dialog',
  standalone: true,
  imports: [CommonModule, CompactNumberPipe],
  templateUrl: './diplomacy-dialog.component.html',
  styleUrl: './diplomacy-dialog.component.scss',
})
export class DiplomacyDialogComponent implements OnInit {
  gameState = inject(GameStateService);

  @Output() closed = new EventEmitter<void>();

  /** Calculated diplomatic tribute demands from the enemy. */
  demands: Partial<GameResources> = {};

  /** Status message upon fulfilling tribute. */
  peaceAccepted = false;

  ngOnInit(): void {
    this.calculateDemands();
  }

  /** Calculates the required tribute. */
  calculateDemands(): void {
    this.demands = MathUtils.calcDiplomacyDemands(
      this.gameState.skills(),
      this.gameState.resources(),
      this.gameState.maxStorage()
    );
  }

  /** Checks whether the player has enough resources to fulfill the demands. */
  get canAfford(): boolean {
    return this.gameState.canAfford(this.demands);
  }

  /** Whether the enemy is currently active. */
  get isEnemyActive(): boolean {
    return this.gameState.enemyActivated();
  }

  /**
   * Accepts the tribute demand, deducts resources, and halts enemy raids.
   */
  async acceptTribute(): Promise<void> {
    if (!this.canAfford) return;
    try {
      await this.gameState.payDiplomacyDemands(this.demands);
      this.peaceAccepted = true;
      setTimeout(() => {
        this.closed.emit();
      }, 1800);
    } catch (e) {
      console.error('Failed to pay diplomacy demands', e);
    }
  }

  /** Closes the diplomacy dialog. */
  close(): void {
    this.closed.emit();
  }
}

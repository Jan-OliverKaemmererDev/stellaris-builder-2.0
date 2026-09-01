import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { EnemyAttackService } from '../../services/enemy-attack.service';
import { CompactNumberPipe } from '../../pipes/compact-number.pipe';

/**
 * Fullscreen modal overlay alerting the player to an incoming enemy raid result.
 * Displays combat evaluation, lost resources or captured war loot, and quick navigation to Fleet.
 */
@Component({
  selector: 'app-enemy-attack-overlay',
  standalone: true,
  imports: [CommonModule, CompactNumberPipe],
  templateUrl: './enemy-attack-overlay.component.html',
  styleUrl: './enemy-attack-overlay.component.scss',
})
export class EnemyAttackOverlayComponent {
  attackService = inject(EnemyAttackService);
  private router = inject(Router);

  /** Current active attack result signal from service. */
  attack = this.attackService.currentAttack;

  /** Closes the attack notification overlay. */
  close(): void {
    this.attackService.dismissAttack();
  }

  /**
   * Navigates the player directly to the Fleet page to build more ships or launch a counter-attack.
   */
  navigateToFleet(): void {
    this.attackService.dismissAttack();
    this.router.navigate(['/bridge/fleet']);
  }
}

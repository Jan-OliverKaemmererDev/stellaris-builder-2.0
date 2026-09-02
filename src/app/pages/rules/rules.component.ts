import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule, DOCUMENT, Location } from '@angular/common';
import { Router } from '@angular/router';
import { GameStateService } from '../../services/game-state.service';

import { IconComponent } from '../../components/icon/icon.component';

@Component({
  selector: 'app-rules',
  standalone: true,
  imports: [CommonModule, IconComponent],
  templateUrl: './rules.component.html',
  styleUrl: './rules.component.scss',
})
export class RulesComponent {
  private router = inject(Router);
  private gameState = inject(GameStateService);
  private document = inject(DOCUMENT);
  private location = inject(Location);

  isAcknowledging = signal(false);

  /** Only show back button if the user has already acknowledged the rules (i.e. not the initial first-login view) */
  canGoBack = computed(() => this.gameState.hasSeenRules());

  goBack(event: Event): void {
    event.preventDefault();
    this.location.back();
  }

  scrollToBottom(): void {
    const bottomElement = this.document.getElementById('rules-bottom');
    if (bottomElement) {
      bottomElement.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
    // Also scroll window / docElement as robust fallback
    window.scrollTo({
      top: this.document.documentElement.scrollHeight || this.document.body.scrollHeight,
      behavior: 'smooth',
    });
  }

  async acknowledgeRules(): Promise<void> {
    if (this.isAcknowledging()) return;
    this.isAcknowledging.set(true);

    try {
      await this.gameState.markRulesAsSeen();
    } catch (err) {
      console.warn('Could not mark rules as seen:', err);
    }

    setTimeout(() => {
      this.router.navigate(['/bridge']);
    }, 350);
  }
}

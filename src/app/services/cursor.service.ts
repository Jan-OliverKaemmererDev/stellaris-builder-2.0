import { Injectable, signal } from '@angular/core';
import { SHIP_IDS } from './game-state.types';

/** Supported page and category types for custom cursors. */
export type CursorCategory =
  | 'energy'
  | 'mining'
  | 'research'
  | 'infrastructure'
  | 'trade'
  | 'fleet';

/**
 * Service managing custom cursors and temporary completion feedback.
 * When a building or ship completes, the cursor is dynamically swapped for 2 seconds.
 */
@Injectable({
  providedIn: 'root',
})
export class CursorService {
  /** The currently active completion cursor category, or null if default. */
  readonly activeCursor = signal<CursorCategory | null>(null);

  /** Active timeout reference for reverting the cursor. */
  private timerId: ReturnType<typeof setTimeout> | null = null;

  /**
   * Triggers the page-specific completion cursor for a given duration.
   * @param category - The cursor category to activate.
   * @param durationMs - Time in milliseconds before reverting to default (default 2000ms).
   */
  triggerCompletionCursor(category: CursorCategory, durationMs = 2000): void {
    this.activeCursor.set(category);

    if (typeof document !== 'undefined' && document.body) {
      document.body.setAttribute('data-active-cursor', category);
    }

    if (this.timerId !== null) {
      clearTimeout(this.timerId);
    }

    this.timerId = setTimeout(() => {
      this.clearCompletionCursor();
    }, durationMs);
  }

  /**
   * Resets the cursor back to the default state immediately.
   */
  clearCompletionCursor(): void {
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
    this.activeCursor.set(null);
    if (typeof document !== 'undefined' && document.body) {
      document.body.removeAttribute('data-active-cursor');
    }
  }

  /**
   * Maps any skill or ship ID to its corresponding cursor category.
   * @param skillId - The unique skill or ship identifier.
   * @returns The resolved CursorCategory.
   */
  getCategoryForSkill(skillId: string): CursorCategory | null {
    if (SHIP_IDS.includes(skillId as any)) {
      return 'fleet';
    }

    if (
      skillId.startsWith('solar') ||
      skillId.startsWith('fusion') ||
      skillId.startsWith('antimaterie')
    ) {
      return 'energy';
    }

    if (skillId.includes('mine')) {
      return 'mining';
    }

    if (
      skillId.startsWith('bio') ||
      skillId.startsWith('ki_') ||
      skillId.startsWith('nano_') ||
      skillId.startsWith('antrieb_') ||
      skillId === 'biolabor' ||
      skillId === 'ki_automatisierung' ||
      skillId === 'nano_bots' ||
      skillId === 'antriebstechnik'
    ) {
      return 'research';
    }

    if (
      skillId.startsWith('lager') ||
      skillId.startsWith('refinery') ||
      skillId.startsWith('shipyard') ||
      skillId.startsWith('defense') ||
      skillId.startsWith('station') ||
      skillId === 'orbital_shipyard' ||
      skillId === 'planetary_defense' ||
      skillId === 'large_station'
    ) {
      return 'infrastructure';
    }

    if (
      skillId.startsWith('trade') ||
      skillId.startsWith('market') ||
      skillId.startsWith('exchange') ||
      skillId === 'trading_post' ||
      skillId === 'interstellar_market' ||
      skillId === 'galactic_exchange'
    ) {
      return 'trade';
    }

    return null;
  }
}

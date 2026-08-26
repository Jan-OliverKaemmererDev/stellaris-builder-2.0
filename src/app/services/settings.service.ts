import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
/**
 * Service responsible for managing user settings, such as visual toggles.
 * Persists settings to the browser's localStorage.
 */
export class SettingsService {
  /** Signal that controls whether the nanobot overlay animation should be shown. */
  showNanobots = signal<boolean>(true);

  constructor() {
    this.loadSettings();
  }

  /** Toggles the nanobot display setting and saves it to local storage. */
  toggleNanobots(): void {
    this.showNanobots.set(!this.showNanobots());
    this.saveSettings();
  }

  /** Saves the current settings to local storage. */
  private saveSettings(): void {
    try {
      localStorage.setItem('stellaris_showNanobots', JSON.stringify(this.showNanobots()));
    } catch (e) {
      console.warn('Could not save settings to localStorage', e);
    }
  }

  /** Loads settings from local storage if available. */
  private loadSettings(): void {
    try {
      const stored = localStorage.getItem('stellaris_showNanobots');
      if (stored !== null) {
        this.showNanobots.set(JSON.parse(stored));
      }
    } catch (e) {
      console.warn('Could not load settings from localStorage', e);
    }
  }
}

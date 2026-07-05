import { Component, inject, signal, HostListener } from '@angular/core';
import { RouterOutlet, RouterLink, Router } from '@angular/router';
import { Auth, signOut } from '@angular/fire/auth';
import { SideMenu } from '../side-menu/side-menu';
import { OfflineProgressDialog } from '../components/offline-progress-dialog/offline-progress-dialog';

/**
 * Shell component that wraps all authenticated game pages.
 * Provides the header, sidebar navigation, footer, and user dropdown menu.
 */
@Component({
  selector: 'app-game-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, SideMenu, OfflineProgressDialog],
  templateUrl: './game-layout.html',
  styleUrl: './game-layout.scss',
})
export class GameLayout {
  private auth = inject(Auth);
  private router = inject(Router);

  /** Whether the user dropdown menu is currently open. */
  dropdownOpen = signal(false);

  /** Derives a two-letter initial string from the current user's profile. */
  get userInitials(): string {
    const user = this.auth.currentUser;
    if (!user) return '?';
    if (user.displayName) return this.getInitialsFromName(user.displayName);
    if (user.isAnonymous) return 'G';
    if (user.email) return user.email.substring(0, 2).toUpperCase();
    return '?';
  }

  /**
   * Extracts up to two initials from a display name.
   * @param name - The user's display name.
   */
  private getInitialsFromName(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  /** Returns the commander display name for the greeting. */
  get commanderName(): string {
    const user = this.auth.currentUser;
    if (!user) return 'Commander';
    return user.displayName || (user.isAnonymous ? 'Gast-Commander' : 'Commander');
  }

  /** Toggles the user dropdown menu open/closed. */
  toggleDropdown(): void {
    this.dropdownOpen.set(!this.dropdownOpen());
  }

  /**
   * Closes the dropdown when clicking outside the user menu.
   * @param event - The document click event.
   */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.user-menu')) {
      this.dropdownOpen.set(false);
    }
  }

  /**
   * Closes the dropdown when the Escape key is pressed.
   * @param event - The keyboard event.
   */
  @HostListener('document:keydown.escape', ['$event'])
  onEscapePress(_event: Event): void {
    this.dropdownOpen.set(false);
  }

  /** Signs the user out and navigates back to the landing page. */
  async logout(): Promise<void> {
    try {
      await signOut(this.auth);
      this.dropdownOpen.set(false);
      this.router.navigate(['/']);
    } catch (error) {
      console.error('Logout error:', error);
    }
  }
}

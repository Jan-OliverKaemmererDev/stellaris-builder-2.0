import { Component, inject, signal, HostListener } from '@angular/core';
import { RouterOutlet, RouterLink, Router } from '@angular/router';
import { Auth, signOut } from '@angular/fire/auth';
import { deleteUser } from 'firebase/auth';
import { Firestore, doc, deleteDoc } from '@angular/fire/firestore';
import { SideMenu } from '../side-menu/side-menu';
import { OfflineProgressDialog } from '../components/offline-progress-dialog/offline-progress-dialog';

/**
 * Shell component that wraps all authenticated game pages.
 * Provides the top header, sidebar navigation, footer, and the user dropdown menu.
 */
@Component({
  selector: 'app-game-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, SideMenu, OfflineProgressDialog],
  templateUrl: './game-layout.html',
  styleUrl: './game-layout.scss',
})
export class GameLayout {
  /** Authentication service to retrieve the current user and sign out. */
  private auth = inject(Auth);

  /** Router service for navigating after logging out. */
  private router = inject(Router);

  /** Firestore service for deleting guest user documents on logout. */
  private firestore = inject(Firestore);

  /** Signal holding the current visibility state of the user dropdown menu. */
  dropdownOpen = signal(false);

  /**
   * Derives a two-letter initial string from the current user's profile.
   * @returns A string representing the user's initials, e.g., 'JD'.
   */
  get userInitials(): string {
    const user = this.auth.currentUser;
    if (!user) return '?';
    if (user.displayName) return this.getInitialsFromName(user.displayName);
    if (user.isAnonymous) return 'G';
    if (user.email) return user.email.substring(0, 2).toUpperCase();
    return '?';
  }

  /**
   * Extracts up to two initials from a provided display name.
   * @param name - The user's full display name.
   * @returns The extracted initials formatted as uppercase.
   */
  private getInitialsFromName(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }

  /**
   * Retrieves the commander's display name for greetings in the UI.
   * @returns The display name or a fallback title if none is set.
   */
  get commanderName(): string {
    const user = this.auth.currentUser;
    if (!user) return 'Commander';
    return user.displayName || (user.isAnonymous ? 'Gast-Commander' : 'Commander');
  }

  /**
   * Toggles the user dropdown menu open or closed.
   */
  toggleDropdown(): void {
    this.dropdownOpen.set(!this.dropdownOpen());
  }

  /**
   * Closes the dropdown menu when a click occurs outside the user menu area.
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
   * Closes the dropdown menu when the Escape key is pressed.
   * @param _event - The global keyboard event.
   */
  @HostListener('document:keydown.escape', ['$event'])
  onEscapePress(_event: Event): void {
    this.dropdownOpen.set(false);
  }

  /**
   * Signs the current user out of the application and redirects to the landing page.
   * If the user is an anonymous guest, their Firestore data and Firebase Auth account
   * are deleted before redirecting.
   * @returns A promise that resolves when the logout process completes.
   */
  async logout(): Promise<void> {
    try {
      const user = this.auth.currentUser;
      if (user?.isAnonymous) {
        await this.deleteGuestData(user.uid);
        await deleteUser(user);
      } else {
        await signOut(this.auth);
      }
      this.dropdownOpen.set(false);
      this.router.navigate(['/']);
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  /**
   * Deletes all Firestore documents associated with a guest user.
   * Removes the game state sub-document first, then the user profile document.
   * @param uid - The anonymous user's unique identifier.
   * @returns A promise that resolves when all documents are deleted.
   */
  private async deleteGuestData(uid: string): Promise<void> {
    const gameStateRef = doc(this.firestore, `users/${uid}/game/state`);
    const userDocRef = doc(this.firestore, `users/${uid}`);
    await deleteDoc(gameStateRef);
    await deleteDoc(userDocRef);
  }
}

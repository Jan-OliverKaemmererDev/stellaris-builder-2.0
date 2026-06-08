import { Component, inject, signal, HostListener } from '@angular/core';
import { RouterOutlet, RouterLink, Router } from '@angular/router';
import { Auth, signOut } from '@angular/fire/auth';
import { SideMenu } from '../side-menu/side-menu';

@Component({
  selector: 'app-game-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, SideMenu],
  templateUrl: './game-layout.html',
  styleUrl: './game-layout.scss',
})
export class GameLayout {
  private auth = inject(Auth);
  private router = inject(Router);

  dropdownOpen = signal(false);

  get userInitials(): string {
    const user = this.auth.currentUser;
    if (!user) return '?';

    const name = user.displayName;
    if (name) {
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return name.substring(0, 2).toUpperCase();
    }

    if (user.isAnonymous) {
      return 'G';
    }

    const email = user.email;
    if (email) {
      return email.substring(0, 2).toUpperCase();
    }

    return '?';
  }

  get commanderName(): string {
    const user = this.auth.currentUser;
    if (!user) return 'Commander';
    return user.displayName || (user.isAnonymous ? 'Gast-Commander' : 'Commander');
  }

  toggleDropdown() {
    this.dropdownOpen.set(!this.dropdownOpen());
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.user-menu')) {
      this.dropdownOpen.set(false);
    }
  }

  async logout() {
    try {
      await signOut(this.auth);
      this.dropdownOpen.set(false);
      this.router.navigate(['/']);
    } catch (error) {
      console.error('Logout error:', error);
    }
  }
}

import { Component, inject, signal, HostListener, ViewChild, ElementRef, AfterViewInit, OnDestroy, NgZone } from '@angular/core';
import { RouterOutlet, RouterLink, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { Auth, signOut } from '@angular/fire/auth';
import { deleteUser } from 'firebase/auth';
import { Firestore, doc, deleteDoc } from '@angular/fire/firestore';
import { SideMenu } from '../side-menu/side-menu';
import { OfflineProgressDialog } from '../components/offline-progress-dialog/offline-progress-dialog';
import { SunBackgroundComponent } from '../components/sun-background/sun-background.component';
import { GalaxyBackgroundComponent } from '../components/galaxy-background/galaxy-background.component';
import { SettingsService } from '../services/settings.service';
import { GameStateService } from '../services/game-state.service';
import { CompactNumberPipe } from '../pipes/compact-number.pipe';

class Particle {
  theta = Math.random() * Math.PI * 2;
  phi = Math.acos((Math.random() * 2) - 1);
  radius = 25; // Smaller radius for 60x60 canvas
  x = 30;
  y = 30;
  size = 1.0;

  update(time: number) {
    const speed = time * 0.4;
    const currentTheta = this.theta + speed;
    const x3d = this.radius * Math.sin(this.phi) * Math.cos(currentTheta);
    const y3d = this.radius * Math.cos(this.phi);
    this.x = 30 + x3d;
    this.y = 30 + y3d;
  }

  draw(ctx: CanvasRenderingContext2D) {
    ctx.fillStyle = '#a5f3fc';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Shell component that wraps all authenticated game pages.
 * Provides the top header, sidebar navigation, footer, and the user dropdown menu.
 */
@Component({
  selector: 'app-game-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, SideMenu, OfflineProgressDialog, SunBackgroundComponent, GalaxyBackgroundComponent, CompactNumberPipe],
  templateUrl: './game-layout.html',
  styleUrl: './game-layout.scss',
})
export class GameLayout implements AfterViewInit, OnDestroy {
  /** Authentication service to retrieve the current user and sign out. */
  private auth = inject(Auth);

  /** Router service for navigating after logging out. */
  private router = inject(Router);

  /** Firestore service for deleting guest user documents on logout. */
  private firestore = inject(Firestore);

  /** Settings service for toggling nanobots overlay. */
  settings = inject(SettingsService);

  /** GameState service to check if nanobots are unlocked and fetch resources. */
  gameState = inject(GameStateService);

  /** Signal holding the current visibility state of the user dropdown menu. */
  dropdownOpen = signal(false);

  /** Signal holding the current visibility state of the drawer nav menu. */
  navMenuOpen = signal(false);

  /** Current page title derived from the active route. */
  pageTitle = signal('BRÜCKE');

  /** Orb Canvas */
  @ViewChild('orbCanvas') orbCanvas!: ElementRef<HTMLCanvasElement>;

  /** Main Content Wrapper for initial focus */
  @ViewChild('mainContent') mainContent!: ElementRef<HTMLElement>;
  
  private ngZone = inject(NgZone);
  private animationFrameId?: number;
  private particles: Particle[] = [];

  constructor() {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      const url = event.urlAfterRedirects;
      if (url.includes('/mining')) this.pageTitle.set('ROHSTOFFABBAU');
      else if (url.includes('/energy')) this.pageTitle.set('ENERGIENETZ');
      else if (url.includes('/research')) this.pageTitle.set('FORSCHUNGS\u00ADZENTRUM');
      else if (url.includes('/infrastructure')) this.pageTitle.set('INFRASTRUKTUR');
      else if (url.includes('/trade')) this.pageTitle.set('HANDEL & WIRTSCHAFT');
      else if (url.includes('/fleet')) this.pageTitle.set('FLOTTE');
      else this.pageTitle.set('BRÜCKE');

      // Force scroll to top on route change
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });

      // Automatically close the side menu
      this.navMenuOpen.set(false);
    });
  }

  ngAfterViewInit() {
    this.initOrb();
    if (this.mainContent && this.mainContent.nativeElement) {
      setTimeout(() => this.mainContent.nativeElement.focus({ preventScroll: true }), 0);
    }
  }

  ngOnDestroy() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }

  private initOrb() {
    if (!this.orbCanvas) return;
    const canvas = this.orbCanvas.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    for (let i = 0; i < 300; i++) {
      this.particles.push(new Particle());
    }

    this.ngZone.runOutsideAngular(() => {
      const animate = (time: number) => {
        // Clear canvas for transparency (no trails in small version)
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const timeSec = time * 0.001;
        this.particles.forEach(p => {
          p.update(timeSec);
          p.draw(ctx);
        });

        this.animationFrameId = requestAnimationFrame(animate);
      };
      
      this.animationFrameId = requestAnimationFrame(animate);
    });
  }

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

  /** Checks if the nanobots skill is unlocked. */
  get hasNanobots(): boolean {
    return this.gameState.getSkillLevel('nano_bots') > 0;
  }

  /**
   * Toggles the user dropdown menu open or closed.
   */
  toggleDropdown(): void {
    this.dropdownOpen.set(!this.dropdownOpen());
  }

  /**
   * Toggles the navigation drawer menu open or closed.
   */
  toggleNavMenu(): void {
    this.navMenuOpen.set(!this.navMenuOpen());
  }

  /**
   * Closes the menus when a click occurs outside their respective areas.
   * @param event - The document click event.
   */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    
    // Dropdown close logic
    if (!target.closest('.user-menu')) {
      this.dropdownOpen.set(false);
    }
    
    // Drawer Nav Menu close logic
    if (!target.closest('.header-center') && !target.closest('.side-menu')) {
      this.navMenuOpen.set(false);
    }
  }

  /**
   * Closes all menus when the Escape key is pressed.
   * @param _event - The global keyboard event.
   */
  @HostListener('document:keydown.escape', ['$event'])
  onEscapePress(_event: Event): void {
    this.dropdownOpen.set(false);
    this.navMenuOpen.set(false);
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

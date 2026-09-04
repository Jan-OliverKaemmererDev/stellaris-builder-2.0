import { Component, inject, signal, computed, HostListener, ViewChild, ElementRef, AfterViewInit, OnDestroy, NgZone } from '@angular/core';
import { RouterOutlet, RouterLink, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { Auth, signOut } from '@angular/fire/auth';
import { deleteUser } from 'firebase/auth';
import { Firestore, doc, deleteDoc } from '@angular/fire/firestore';
import { SideMenu } from '../side-menu/side-menu';
import { OfflineProgressDialog } from '../components/offline-progress-dialog/offline-progress-dialog';
import { GalaxyBackgroundComponent } from '../components/galaxy-background/galaxy-background.component';
import { SettingsService } from '../services/settings.service';
import { GameStateService } from '../services/game-state.service';
import { CompactNumberPipe } from '../pipes/compact-number.pipe';
import { EnemyAttackOverlayComponent } from '../components/enemy-attack-overlay/enemy-attack-overlay.component';

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

interface SatelliteConfig {
  a: number;         // semi-major axis
  b: number;         // semi-minor axis
  tilt: number;      // orbital inclination tilt in radians
  speed: number;     // angular speed
  phase: number;     // initial angle offset
  size: number;      // satellite point size
  glowColor?: string;// aura glow color
  coreColor?: string;// bright center color
}

class Satellite {
  x = 30;
  y = 30;
  isBehind = false;

  constructor(public config: SatelliteConfig) {}

  update(time: number) {
    const theta = this.config.phase + time * this.config.speed;
    const x0 = this.config.a * Math.cos(theta);
    const y0 = this.config.b * Math.sin(theta);

    const cosT = Math.cos(this.config.tilt);
    const sinT = Math.sin(this.config.tilt);
    this.x = 30 + (x0 * cosT - y0 * sinT);
    this.y = 30 + (x0 * sinT + y0 * cosT);

    // Negative sin(theta) means the satellite is moving along the far/back arc of the orbit
    this.isBehind = Math.sin(theta) < 0;
  }

  draw(ctx: CanvasRenderingContext2D) {
    const glowColor = this.config.glowColor || 'rgba(56, 189, 248, 0.85)';
    const coreColor = this.config.coreColor || '#ffffff';
    const size = this.config.size;

    // Outer aura glow
    const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, size * 2.8);
    grad.addColorStop(0, glowColor);
    grad.addColorStop(0.5, 'rgba(56, 189, 248, 0.35)');
    grad.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(this.x, this.y, size * 2.8, 0, Math.PI * 2);
    ctx.fill();

    // Bright pinpoint core
    ctx.fillStyle = coreColor;
    ctx.beginPath();
    ctx.arc(this.x, this.y, size * 0.75, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Shell component that wraps all authenticated game pages.
 * Provides the top header, sidebar navigation, footer, and the user dropdown menu.
 */
import { IconComponent } from '../components/icon/icon.component';
import { UserOverlayComponent } from '../components/user-overlay/user-overlay.component';

@Component({
  selector: 'app-game-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, SideMenu, OfflineProgressDialog, GalaxyBackgroundComponent, CompactNumberPipe, EnemyAttackOverlayComponent, IconComponent, UserOverlayComponent],
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

  /** Signal holding the current visibility state of the user profile overlay. */
  userOverlayOpen = signal(false);

  /** Signal for immediate reactive commander name updates across the layout. */
  customCommanderName = signal<string | null>(null);

  /**
   * Computes the percentage of available energy relative to total produced energy.
   */
  energyPercentage = computed<number>(() => {
    const max = this.gameState.energyProduced();
    if (max <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round((this.gameState.availableEnergy() / max) * 100)));
  });

  /**
   * Computes the dynamic status color for energy (green, yellow, orange, red).
   */
  energyColor = computed<string>(() => {
    if (this.gameState.availableEnergy() < 0) return '#ef4444';
    const p = this.energyPercentage();
    if (p > 75) return '#22c55e'; // Green
    if (p > 50) return '#eab308'; // Yellow
    if (p > 25) return '#f97316'; // Orange
    return '#ef4444';             // Red
  });

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
  private isMobile = false;
  private particles: Particle[] = [];
  private satellites: Satellite[] = [];

  constructor() {
    this.updateTitle(this.router.url);

    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.updateTitle(event.urlAfterRedirects);

      // Force scroll to top on route change
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });

      // Automatically close the side menu and user dropdown
      this.navMenuOpen.set(false);
      this.dropdownOpen.set(false);
    });
  }

  private updateTitle(url: string): void {
    if (url.includes('/mining')) this.pageTitle.set('ROHSTOFF\u00ADABBAU');
    else if (url.includes('/energy')) this.pageTitle.set('ENERGIENETZ');
    else if (url.includes('/research')) this.pageTitle.set('FORSCHUNGS\u00ADZENTRUM');
    else if (url.includes('/infrastructure')) this.pageTitle.set('INFRA\u00ADSTRUKTUR');
    else if (url.includes('/trade')) this.pageTitle.set('HANDEL & WIRTSCHAFT');
    else if (url.includes('/fleet')) this.pageTitle.set('FLOTTE');
    else if (url.includes('/spielregeln')) this.pageTitle.set('SPIELREGELN');
    else this.pageTitle.set('BRÜCKE');
  }

  ngAfterViewInit() {
    this.initOrb();
    if (this.mainContent && this.mainContent.nativeElement) {
      setTimeout(() => this.mainContent.nativeElement.focus({ preventScroll: true }), 0);
    }
  }

  ngOnDestroy() {
    this.stopOrbAnimation();
  }

  @HostListener('document:visibilitychange')
  onVisibilityChange(): void {
    if (document.hidden) {
      this.stopOrbAnimation();
    } else {
      this.startOrbAnimation();
    }
  }

  private stopOrbAnimation(): void {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = undefined;
    }
  }

  private startOrbAnimation(): void {
    if (this.animationFrameId || !this.orbCanvas) return;
    const canvas = this.orbCanvas.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    this.ngZone.runOutsideAngular(() => {
      const animate = (time: number) => {
        const timeSec = time * 0.001;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (this.isMobile) {
          this.drawMobilePlanet(ctx, timeSec);
        } else {
          this.drawDesktopOrb(ctx, timeSec);
        }

        this.animationFrameId = requestAnimationFrame(animate);
      };
      this.animationFrameId = requestAnimationFrame(animate);
    });
  }

  /**
   * Renders the low-overhead Sci-Fi Blue Planet with orbiting satellites for mobile screens.
   */
  private drawMobilePlanet(ctx: CanvasRenderingContext2D, timeSec: number): void {
    const cx = 30;
    const cy = 30;
    const planetRadius = 24.5;

    // Update satellites position & 3D orbital depth
    for (let i = 0; i < this.satellites.length; i++) {
      this.satellites[i].update(timeSec);
    }

    // 1. Draw Satellites moving behind the planet (far arc)
    for (let i = 0; i < this.satellites.length; i++) {
      if (this.satellites[i].isBehind) {
        this.satellites[i].draw(ctx);
      }
    }

    // 2. Draw Soft Atmospheric Corona Glow
    const atmoGrad = ctx.createRadialGradient(cx, cy, planetRadius * 0.85, cx, cy, planetRadius * 1.22);
    atmoGrad.addColorStop(0, 'rgba(37, 99, 235, 0.45)');
    atmoGrad.addColorStop(0.6, 'rgba(56, 189, 248, 0.18)');
    atmoGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = atmoGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, planetRadius * 1.22, 0, Math.PI * 2);
    ctx.fill();

    // 3. Draw Solid Planet Body (Rich, vibrant cosmic deep blue with illuminated edge)
    const planetGrad = ctx.createRadialGradient(cx - 6, cy - 6, 2, cx, cy, planetRadius);
    planetGrad.addColorStop(0, '#2563eb');    // Electric royal highlight
    planetGrad.addColorStop(0.3, '#1d4ed8'); // Rich sapphire blue
    planetGrad.addColorStop(0.6, '#0f2b5c'); // Deep ocean cobalt
    planetGrad.addColorStop(0.85, '#0b1a36'); // Midnight navy
    planetGrad.addColorStop(1, '#050c1a');    // Deep space shadow
    ctx.fillStyle = planetGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, planetRadius, 0, Math.PI * 2);
    ctx.fill();

    // Subtle atmospheric limb softness on the sphere edge
    const limbGrad = ctx.createRadialGradient(cx, cy, planetRadius * 0.72, cx, cy, planetRadius);
    limbGrad.addColorStop(0, 'rgba(56, 189, 248, 0)');
    limbGrad.addColorStop(0.82, 'rgba(56, 189, 248, 0.12)');
    limbGrad.addColorStop(1, 'rgba(56, 189, 248, 0.35)');
    ctx.fillStyle = limbGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, planetRadius, 0, Math.PI * 2);
    ctx.fill();

    // 4. Draw Satellites moving in front of the planet (near arc)
    for (let i = 0; i < this.satellites.length; i++) {
      if (!this.satellites[i].isBehind) {
        this.satellites[i].draw(ctx);
      }
    }
  }

  /**
   * Renders the 3D Particle Orb for desktop screens.
   */
  private drawDesktopOrb(ctx: CanvasRenderingContext2D, timeSec: number): void {
    for (let i = 0; i < this.particles.length; i++) {
      this.particles[i].update(timeSec);
      this.particles[i].draw(ctx);
    }
  }

  private get isMobileDevice(): boolean {
    if (typeof window === 'undefined') return false;
    const isTouchOnly = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    return window.innerWidth <= 768 || (isTouchOnly && Math.max(window.innerWidth, window.innerHeight) <= 1024);
  }

  @HostListener('window:resize')
  onResize(): void {
    if (!this.orbCanvas) return;
    const isMobile = this.isMobileDevice;
    if (this.isMobile !== isMobile) {
      this.initOrb();
    }
  }

  private initOrb() {
    if (!this.orbCanvas) return;
    this.isMobile = this.isMobileDevice;
    this.particles = [];
    this.satellites = [];

    if (this.isMobile) {
      // Create lightweight orbital satellite for mobile
      this.satellites = [
        new Satellite({ a: 28.5, b: 11.5, tilt: -0.28, speed: 0.48, phase: 0, size: 1.4, glowColor: 'rgba(125, 211, 252, 0.9)' })
      ];
    } else {
      // 300 3D particle sphere for desktop
      for (let i = 0; i < 300; i++) {
        this.particles.push(new Particle());
      }
    }

    this.startOrbAnimation();
  }

  /**
   * Derives a two-letter initial string from the current user's profile.
   * @returns A string representing the user's initials, e.g., 'JD'.
   */
  get userInitials(): string {
    const name = this.commanderName;
    if (name && name !== 'Commander' && name !== 'Gast-Commander') {
      return this.getInitialsFromName(name);
    }
    const user = this.auth.currentUser;
    if (!user) return '?';
    if (user.isAnonymous) return 'G';
    if (user.email) return user.email.substring(0, 2).toUpperCase();
    return 'C';
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
    if (this.customCommanderName()) return this.customCommanderName()!;
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
   * Closes the user dropdown menu.
   */
  closeDropdown(): void {
    this.dropdownOpen.set(false);
  }

  /**
   * Toggles the navigation drawer menu open or closed.
   */
  toggleNavMenu(): void {
    this.navMenuOpen.set(!this.navMenuOpen());
  }

  /**
   * Opens the user profile settings overlay and closes dropdown.
   */
  openUserOverlay(): void {
    this.dropdownOpen.set(false);
    this.userOverlayOpen.set(true);
  }

  /**
   * Closes the user profile settings overlay.
   */
  closeUserOverlay(): void {
    this.userOverlayOpen.set(false);
  }

  /**
   * Updates the displayed commander name immediately after a successful save.
   */
  onCommanderNameChanged(newName: string): void {
    this.customCommanderName.set(newName);
  }

  /**
   * Closes the menus when a click occurs outside their respective areas.
   * @param event - The document click event.
   */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    
    // Dropdown close logic: close only when clicking outside both user-menu and user-dropdown
    if (!target.closest('.user-menu') && !target.closest('.user-dropdown')) {
      this.dropdownOpen.set(false);
    }
    
    // Drawer Nav Menu close logic
    if (!target.closest('.header-center') && !target.closest('.side-menu')) {
      this.navMenuOpen.set(false);
    }
  }

  /**
   * Closes all menus and overlays when the Escape key is pressed.
   * @param _event - The global keyboard event.
   */
  @HostListener('document:keydown.escape', ['$event'])
  onEscapePress(_event: Event): void {
    this.dropdownOpen.set(false);
    this.navMenuOpen.set(false);
    this.userOverlayOpen.set(false);
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

import { Component, inject, signal, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Auth, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, signInAnonymously } from '@angular/fire/auth';
import { Firestore, doc, setDoc } from '@angular/fire/firestore';
import { Router, RouterLink } from '@angular/router';
import { BlackHoleComponent } from '../components/black-hole/black-hole.component';

/**
 * Landing page with login and registration forms on a 3D rotating planet.
 * Supports email/password authentication and anonymous guest login.
 */
@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, BlackHoleComponent],
  templateUrl: './landing-page.component.html',
  styleUrls: ['./landing-page.component.scss'],
})
export class LandingPageComponent implements AfterViewInit {
  /** Authentication service to retrieve the current user and sign out. */
  private auth = inject(Auth);
  
  /** Router service for navigating after logging in. */
  private router = inject(Router);
  
  /** Firestore service for creating and updating user documents. */
  private firestore = inject(Firestore);

  /** Whether the form is in login mode (`true`) or registration mode (`false`). */
  isLoginMode = signal(true);

  /** Bound email input value. */
  email = signal('');

  /** Bound password input value. */
  password = signal('');

  /** Bound confirm password input value (registration only). */
  confirmPassword = signal('');

  /** Bound commander name input value (registration only). */
  commanderName = signal('');

  /** Whether the user accepted the privacy policy (registration only). */
  privacyAccepted = signal(false);

  /** Current error message to display, or `null`. */
  errorMessage = signal<string | null>(null);

  /** Current success message to display, or `null`. */
  successMessage = signal<string | null>(null);

  /** Whether an authentication operation is currently in progress. */
  isLoading = signal(false);

  /** Reference to the email input for initial focus. */
  @ViewChild('emailInput') emailInput!: ElementRef<HTMLInputElement>;

  ngAfterViewInit(): void {
    // Focus the email input on load to bypass browser UI when tabbing
    if (this.emailInput && this.emailInput.nativeElement) {
      setTimeout(() => this.emailInput.nativeElement.focus(), 0);
    }
  }

  /**
   * Toggles between login and registration mode, resetting all fields and messages.
   */
  toggleMode(): void {
    this.isLoginMode.set(!this.isLoginMode());
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.commanderName.set('');
    this.privacyAccepted.set(false);
    this.confirmPassword.set('');
  }

  /**
   * Handles the primary form submission by delegating to login or registration.
   * @returns A promise that resolves when the auth operation completes.
   */
  async onSubmit(): Promise<void> {
    if (!this.validateFields()) return;
    this.resetAuthUI();
    try {
      await this.executeAuth();
    } catch (error: unknown) {
      this.handleAuthError(error);
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Resets the authentication UI states (loading, errors, success) before an operation.
   */
  private resetAuthUI(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);
  }

  /**
   * Executes the authentication based on the current mode (login or registration).
   * @returns A promise that resolves after the respective operation finishes.
   */
  private async executeAuth(): Promise<void> {
    if (this.isLoginMode()) {
      await this.handleLogin();
    } else {
      await this.handleRegistration();
    }
  }

  /**
   * Validates required fields and privacy acceptance.
   * @returns `true` if all fields are valid, `false` otherwise.
   */
  private validateFields(): boolean {
    if (!this.email() || !this.password() || (!this.isLoginMode() && (!this.commanderName() || !this.confirmPassword()))) {
      this.errorMessage.set('Bitte fülle alle Felder aus.');
      this.successMessage.set(null);
      return false;
    }

    if (!this.isLoginMode() && this.password() !== this.confirmPassword()) {
      this.errorMessage.set('Die Passwörter stimmen nicht überein.');
      this.successMessage.set(null);
      return false;
    }

    if (!this.isLoginMode() && this.commanderName().trim().length < 3) {
      this.errorMessage.set('Der Commander Name muss mindestens 3 Zeichen lang sein.');
      this.successMessage.set(null);
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@.]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(this.email())) {
      this.errorMessage.set('Ungültige E-Mail-Adresse.');
      this.successMessage.set(null);
      return false;
    }

    if (!this.isLoginMode() && !this.privacyAccepted()) {
      this.errorMessage.set('Bitte akzeptiere die Privacy Policy.');
      this.successMessage.set(null);
      return false;
    }
    return true;
  }

  /**
   * Signs in with email and password, then navigates to the bridge.
   * @returns A promise that resolves when login is successful.
   */
  private async handleLogin(): Promise<void> {
    await signInWithEmailAndPassword(this.auth, this.email(), this.password());
    this.router.navigate(['/bridge']);
  }

  /**
   * Creates a new account, saves the commander profile, and switches to login mode.
   * @returns A promise that resolves when registration is successful.
   */
  private async handleRegistration(): Promise<void> {
    const cred = await createUserWithEmailAndPassword(this.auth, this.email(), this.password());
    if (cred.user) {
      await updateProfile(cred.user, { displayName: this.commanderName() });
      await this.createUserDocument(cred.user.uid);
    }
    this.isLoginMode.set(true);
    this.password.set('');
    this.confirmPassword.set('');
    this.commanderName.set('');
    this.successMessage.set('Account erfolgreich erstellt! Bitte einloggen.');
  }

  /**
   * Creates a Firestore user document with profile data.
   * @param uid - The new user's unique identifier.
   * @returns A promise that resolves when the document is created.
   */
  private async createUserDocument(uid: string): Promise<void> {
    const userDocRef = doc(this.firestore, `users/${uid}`);
    const data = {
      uid, email: this.email(), commanderName: this.commanderName(),
      createdAt: new Date().toISOString(),
    };
    await setDoc(userDocRef, data);
  }

  /**
   * Signs in anonymously and creates a guest user document.
   * @returns A promise that resolves when guest login is successful.
   */
  async loginAsGuest(): Promise<void> {
    this.resetAuthUI();
    try {
      const cred = await signInAnonymously(this.auth);
      await this.createGuestDocument(cred.user.uid);
      this.router.navigate(['/bridge']);
    } catch (error: unknown) {
      console.error(error);
      this.errorMessage.set('Gast-Login fehlgeschlagen. Bitte versuche es später.');
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Creates or merges a Firestore document for a guest user.
   * @param uid - The anonymous user's unique identifier.
   * @returns A promise that resolves when the document is merged.
   */
  private async createGuestDocument(uid: string): Promise<void> {
    const userDocRef = doc(this.firestore, `users/${uid}`);
    const data = {
      uid, email: null, isGuest: true,
      commanderName: `Gast-${uid.substring(0, 5)}`,
      createdAt: new Date().toISOString(),
    };
    await setDoc(userDocRef, data, { merge: true });
  }

  /**
   * Maps Firebase Auth error codes to German user-facing messages.
   * @param error - The caught authentication error object.
   */
  private handleAuthError(error: unknown): void {
    const code = (error as { code?: string })?.code;
    const errorMap: Record<string, string> = {
      'auth/invalid-email': 'Ungültige E-Mail-Adresse.',
      'auth/user-not-found': 'E-Mail oder Passwort ist falsch.',
      'auth/wrong-password': 'E-Mail oder Passwort ist falsch.',
      'auth/invalid-credential': 'E-Mail oder Passwort ist falsch.',
      'auth/email-already-in-use': 'Diese E-Mail wird bereits verwendet.',
      'auth/weak-password': 'Das Passwort muss mindestens 6 Zeichen lang sein.',
    };
    this.errorMessage.set(errorMap[code || ''] || 'Ein unerwarteter Fehler ist aufgetreten.');
  }
}

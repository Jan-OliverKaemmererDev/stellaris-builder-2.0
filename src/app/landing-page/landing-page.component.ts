import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Auth, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, signInAnonymously } from '@angular/fire/auth';
import { Firestore, doc, setDoc } from '@angular/fire/firestore';
import { Router, RouterLink } from '@angular/router';

/**
 * Landing page with login/registration forms on a 3D rotating planet.
 * Supports email/password authentication and anonymous guest login.
 */
@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './landing-page.component.html',
  styleUrls: ['./landing-page.component.scss'],
})
export class LandingPageComponent {
  private auth = inject(Auth);
  private router = inject(Router);
  private firestore = inject(Firestore);

  /** Whether the form is in login mode (`true`) or registration mode (`false`). */
  isLoginMode = signal(true);

  /** Bound email input value. */
  email = signal('');

  /** Bound password input value. */
  password = signal('');

  /** Bound commander name input value (registration only). */
  commanderName = signal('');

  /** Whether the user accepted the privacy policy (registration only). */
  privacyAccepted = signal(false);

  /** Current error message to display, or `null`. */
  errorMessage = signal<string | null>(null);

  /** Current success message to display, or `null`. */
  successMessage = signal<string | null>(null);

  /** Whether an auth operation is in progress. */
  isLoading = signal(false);

  /** Toggles between login and registration mode, resetting messages. */
  toggleMode(): void {
    this.isLoginMode.set(!this.isLoginMode());
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.commanderName.set('');
    this.privacyAccepted.set(false);
  }

  /** Handles form submission: delegates to login or registration handler. */
  async onSubmit(): Promise<void> {
    if (!this.validateFields()) return;
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    try {
      if (this.isLoginMode()) {
        await this.handleLogin();
      } else {
        await this.handleRegistration();
      }
    } catch (error: unknown) {
      console.error(error);
      this.handleAuthError(error);
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Validates required fields and privacy acceptance.
   * Sets an error message and returns `false` if validation fails.
   */
  private validateFields(): boolean {
    if (!this.email() || !this.password() || (!this.isLoginMode() && !this.commanderName())) {
      this.errorMessage.set('Bitte fülle alle Felder aus.');
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

  /** Signs in with email and password, then navigates to the bridge. */
  private async handleLogin(): Promise<void> {
    await signInWithEmailAndPassword(this.auth, this.email(), this.password());
    this.router.navigate(['/bridge']);
  }

  /** Creates a new account, saves the commander profile, and switches to login mode. */
  private async handleRegistration(): Promise<void> {
    const userCredential = await createUserWithEmailAndPassword(this.auth, this.email(), this.password());
    if (userCredential.user) {
      await updateProfile(userCredential.user, { displayName: this.commanderName() });
      await this.createUserDocument(userCredential.user.uid);
    }
    this.isLoginMode.set(true);
    this.password.set('');
    this.commanderName.set('');
    this.successMessage.set('Account erfolgreich erstellt! Bitte einloggen.');
  }

  /**
   * Creates a Firestore user document with profile data.
   * @param uid - The new user's UID.
   */
  private async createUserDocument(uid: string): Promise<void> {
    const userDocRef = doc(this.firestore, `users/${uid}`);
    await setDoc(userDocRef, {
      uid,
      email: this.email(),
      commanderName: this.commanderName(),
      createdAt: new Date().toISOString(),
    });
  }

  /** Signs in anonymously and creates a guest user document. */
  async loginAsGuest(): Promise<void> {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    try {
      const userCredential = await signInAnonymously(this.auth);
      await this.createGuestDocument(userCredential.user.uid);
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
   * @param uid - The anonymous user's UID.
   */
  private async createGuestDocument(uid: string): Promise<void> {
    const userDocRef = doc(this.firestore, `users/${uid}`);
    await setDoc(
      userDocRef,
      {
        uid,
        email: null,
        commanderName: `Gast-${uid.substring(0, 5)}`,
        isGuest: true,
        createdAt: new Date().toISOString(),
      },
      { merge: true },
    );
  }

  /**
   * Maps Firebase Auth error codes to German user-facing messages.
   * @param error - The caught authentication error.
   */
  private handleAuthError(error: unknown): void {
    const code = (error as { code?: string })?.code;
    switch (code) {
      case 'auth/invalid-email':
        this.errorMessage.set('Ungültige E-Mail-Adresse.');
        break;
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        this.errorMessage.set('E-Mail oder Passwort ist falsch.');
        break;
      case 'auth/email-already-in-use':
        this.errorMessage.set('Diese E-Mail wird bereits verwendet.');
        break;
      case 'auth/weak-password':
        this.errorMessage.set('Das Passwort muss mindestens 6 Zeichen lang sein.');
        break;
      default:
        this.errorMessage.set('Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es später.');
    }
  }
}

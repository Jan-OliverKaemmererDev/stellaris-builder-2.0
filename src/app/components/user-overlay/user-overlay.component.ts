import { Component, inject, signal, OnInit, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Auth, signOut, updateProfile } from '@angular/fire/auth';
import { updateEmail, updatePassword, deleteUser, reauthenticateWithCredential, EmailAuthProvider, linkWithCredential } from 'firebase/auth';
import { Firestore, doc, getDoc, setDoc, deleteDoc } from '@angular/fire/firestore';
import { GameStateService } from '../../services/game-state.service';
import { IconComponent } from '../icon/icon.component';

/**
 * Overlay component for managing user credentials, commander name,
 * password updates, full game state reset, and account deletion.
 */
@Component({
  selector: 'app-user-overlay',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  templateUrl: './user-overlay.component.html',
  styleUrl: './user-overlay.component.scss',
})
export class UserOverlayComponent implements OnInit {
  private auth = inject(Auth);
  private firestore = inject(Firestore);
  private router = inject(Router);
  gameState = inject(GameStateService);

  @Output() close = new EventEmitter<void>();
  @Output() nameChanged = new EventEmitter<string>();

  /** Form field signals */
  commanderName = signal('');
  email = signal('');
  newPassword = signal('');
  confirmPassword = signal('');
  currentPassword = signal('');

  /** State signals */
  isGuest = signal(false);
  showNewPassword = signal(false);
  showConfirmPassword = signal(false);
  showCurrentPassword = signal(false);
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);

  /** Confirmation sub-dialog state */
  confirmModal = signal<'delete' | 'reset' | null>(null);

  async ngOnInit(): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) return;

    this.isGuest.set(user.isAnonymous);
    this.commanderName.set(user.displayName || (user.isAnonymous ? 'Gast-Commander' : 'Commander'));
    this.email.set(user.email || '');

    try {
      const userDocRef = doc(this.firestore, `users/${user.uid}`);
      const snap = await getDoc(userDocRef);
      if (snap.exists()) {
        const data = snap.data();
        if (data['commanderName']) {
          this.commanderName.set(data['commanderName']);
        }
        if (data['email']) {
          this.email.set(data['email']);
        }
      }
    } catch (err) {
      console.warn('Could not retrieve Firestore user document:', err);
    }
  }

  toggleNewPassword(): void {
    this.showNewPassword.update(v => !v);
  }

  toggleConfirmPassword(): void {
    this.showConfirmPassword.update(v => !v);
  }

  toggleCurrentPassword(): void {
    this.showCurrentPassword.update(v => !v);
  }

  onClose(): void {
    this.close.emit();
  }

  /**
   * Saves updated commander name, email, and password to Firebase Auth and Firestore.
   */
  async saveProfile(): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) return;

    const trimmedName = this.commanderName().trim();
    const trimmedEmail = this.email().trim();
    const pwd = this.newPassword();
    const confirmPwd = this.confirmPassword();
    const currentPwd = this.currentPassword();

    this.errorMessage.set(null);
    this.successMessage.set(null);

    // Validation
    if (!trimmedName || trimmedName.length < 2) {
      this.errorMessage.set('Der Commander-Name muss mindestens 2 Zeichen lang sein.');
      return;
    }

    if (!this.isGuest() && (!trimmedEmail || !trimmedEmail.includes('@'))) {
      this.errorMessage.set('Bitte gib eine gültige E-Mail-Adresse ein.');
      return;
    }

    if (pwd) {
      if (pwd.length < 6) {
        this.errorMessage.set('Das neue Passwort muss mindestens 6 Zeichen lang sein.');
        return;
      }
      if (pwd !== confirmPwd) {
        this.errorMessage.set('Die eingegebenen Passwörter stimmen nicht überein.');
        return;
      }
    }

    this.isLoading.set(true);

    try {
      // Re-authentication if required for sensitive changes (email or password)
      if (!this.isGuest() && (pwd || (trimmedEmail && trimmedEmail !== user.email))) {
        if (!currentPwd) {
          this.errorMessage.set('Bitte gib dein aktuelles Passwort ein, um E-Mail oder Passwort zu ändern.');
          this.isLoading.set(false);
          return;
        }
        const credential = EmailAuthProvider.credential(user.email || '', currentPwd);
        await reauthenticateWithCredential(user, credential);
      }

      // 1. Update Profile Display Name in Firebase Auth & Firestore
      if (trimmedName !== user.displayName) {
        await updateProfile(user, { displayName: trimmedName });
      }
      const userDocRef = doc(this.firestore, `users/${user.uid}`);
      await setDoc(userDocRef, { commanderName: trimmedName, email: trimmedEmail }, { merge: true });
      this.nameChanged.emit(trimmedName);

      // 2. Handle guest converting to permanent account
      if (this.isGuest() && trimmedEmail && pwd) {
        const credential = EmailAuthProvider.credential(trimmedEmail, pwd);
        await linkWithCredential(user, credential);
        this.isGuest.set(false);
      } else {
        // 3. Update Email for registered user
        if (!this.isGuest() && trimmedEmail && trimmedEmail !== user.email) {
          await updateEmail(user, trimmedEmail);
          await setDoc(userDocRef, { email: trimmedEmail }, { merge: true });
        }

        // 4. Update Password for registered user
        if (!this.isGuest() && pwd) {
          await updatePassword(user, pwd);
        }
      }

      // Reset password fields
      this.newPassword.set('');
      this.confirmPassword.set('');
      this.currentPassword.set('');
      this.successMessage.set('Daten erfolgreich in Firebase gespeichert!');
    } catch (error: any) {
      console.error('Error updating user profile:', error);
      this.handleAuthError(error);
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Opens the confirmation sub-overlay.
   */
  openConfirmModal(type: 'delete' | 'reset'): void {
    this.errorMessage.set(null);
    this.confirmModal.set(type);
  }

  /**
   * Dismisses the confirmation sub-overlay.
   */
  closeConfirmModal(): void {
    this.confirmModal.set(null);
  }

  /**
   * Deletes the user's Firestore data and Firebase Auth account.
   */
  async executeDeleteAccount(): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) return;

    this.isLoading.set(true);
    try {
      // Reauthenticate if current password is provided and needed
      if (!user.isAnonymous && this.currentPassword()) {
        try {
          const cred = EmailAuthProvider.credential(user.email || '', this.currentPassword());
          await reauthenticateWithCredential(user, cred);
        } catch {
          // Continue or let deleteUser handle auth check
        }
      }

      // Delete Firestore records
      const gameStateRef = doc(this.firestore, `users/${user.uid}/game/state`);
      const userDocRef = doc(this.firestore, `users/${user.uid}`);
      await deleteDoc(gameStateRef);
      await deleteDoc(userDocRef);

      // Delete Auth Account
      await deleteUser(user);
      await signOut(this.auth);

      this.closeConfirmModal();
      this.close.emit();
      this.router.navigate(['/']);
    } catch (error: any) {
      console.error('Error deleting account:', error);
      if (error.code === 'auth/requires-recent-login') {
        this.errorMessage.set('Bitte gib im Profil dein aktuelles Passwort ein, um den Account aus Sicherheitsgründen zu löschen.');
      } else {
        this.errorMessage.set('Fehler beim Löschen des Accounts: ' + (error.message || error));
      }
      this.closeConfirmModal();
    } finally {
      this.isLoading.set(false);
    }
  }

  /**
   * Resets the player's game state back to default values.
   */
  async executeResetGame(): Promise<void> {
    this.isLoading.set(true);
    try {
      await this.gameState.resetGameState();
      this.closeConfirmModal();
      this.successMessage.set('Spielstand erfolgreich komplett zurückgesetzt!');
    } catch (error: any) {
      console.error('Error resetting game state:', error);
      this.errorMessage.set('Fehler beim Zurücksetzen des Spielstands: ' + (error.message || error));
      this.closeConfirmModal();
    } finally {
      this.isLoading.set(false);
    }
  }

  private handleAuthError(error: any): void {
    const code = error?.code;
    switch (code) {
      case 'auth/requires-recent-login':
        this.errorMessage.set('Sicherheitsüberprüfung: Bitte gib dein aktuelles Passwort ein, um sensible Daten zu ändern.');
        break;
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        this.errorMessage.set('Das eingegebene aktuelle Passwort ist nicht korrekt.');
        break;
      case 'auth/email-already-in-use':
        this.errorMessage.set('Diese E-Mail-Adresse wird bereits von einem anderen Commander genutzt.');
        break;
      case 'auth/invalid-email':
        this.errorMessage.set('Die angegebene E-Mail-Adresse ist ungültig.');
        break;
      case 'auth/weak-password':
        this.errorMessage.set('Das neue Passwort ist zu schwach (mindestens 6 Zeichen).');
        break;
      default:
        this.errorMessage.set(error?.message || 'Fehler beim Übermitteln der Daten an Firebase.');
    }
  }
}

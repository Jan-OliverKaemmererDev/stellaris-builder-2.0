import { Component, inject, signal, OnInit, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Auth, signOut, updateProfile } from '@angular/fire/auth';
import { updateEmail, verifyBeforeUpdateEmail, updatePassword, deleteUser, reauthenticateWithCredential, EmailAuthProvider, linkWithCredential } from 'firebase/auth';
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

  /** Initial state tracking to only update what was actually modified */
  private initialEmail = '';
  private initialCommanderName = '';

  async ngOnInit(): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) return;

    this.isGuest.set(user.isAnonymous);
    const authName = user.displayName || (user.isAnonymous ? 'Gast-Commander' : 'Commander');
    const authEmail = user.email || '';

    this.commanderName.set(authName);
    this.initialCommanderName = authName;

    this.email.set(authEmail);
    this.initialEmail = authEmail;

    try {
      const userDocRef = doc(this.firestore, `users/${user.uid}`);
      const snap = await getDoc(userDocRef);
      if (snap.exists()) {
        const data = snap.data();
        if (data['commanderName']) {
          this.commanderName.set(data['commanderName']);
          this.initialCommanderName = data['commanderName'];
        }
        // Only use Firestore email if user has no Auth email (e.g. guest conversion)
        if (!authEmail && data['email']) {
          this.email.set(data['email']);
          this.initialEmail = data['email'];
        }
      }
    } catch {
      // Silently ignore document fetch issues
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

    // Determine what was actually changed by the user in this session
    const isEmailChanged = !this.isGuest() && trimmedEmail.toLowerCase() !== this.initialEmail.toLowerCase();
    const isPasswordChanged = !this.isGuest() && !!pwd;
    const isNameChanged = trimmedName !== this.initialCommanderName;

    if (!isNameChanged && !isEmailChanged && !isPasswordChanged) {
      this.successMessage.set('Keine Änderungen vorgenommen.');
      return;
    }

    this.isLoading.set(true);

    try {
      // Re-authentication required for sensitive changes (password or email change)
      if (!this.isGuest() && (isPasswordChanged || isEmailChanged)) {
        if (!currentPwd) {
          this.errorMessage.set('Bitte gib dein aktuelles Passwort ein, um diese Änderung zu speichern.');
          this.isLoading.set(false);
          return;
        }
        const credential = EmailAuthProvider.credential(user.email || '', currentPwd);
        await reauthenticateWithCredential(user, credential);
      }

      const userDocRef = doc(this.firestore, `users/${user.uid}`);

      // 1. Update Profile Display Name
      if (isNameChanged) {
        await updateProfile(user, { displayName: trimmedName });
        await setDoc(userDocRef, { commanderName: trimmedName }, { merge: true });
        this.initialCommanderName = trimmedName;
        this.nameChanged.emit(trimmedName);
      }

      let emailVerificationSent = false;

      // 2. Handle guest converting to permanent account
      if (this.isGuest() && trimmedEmail && pwd) {
        const credential = EmailAuthProvider.credential(trimmedEmail, pwd);
        await linkWithCredential(user, credential);
        await setDoc(userDocRef, { email: trimmedEmail }, { merge: true });
        this.isGuest.set(false);
        this.initialEmail = trimmedEmail;
      } else {
        // 3. Update Password for registered user
        if (isPasswordChanged) {
          await updatePassword(user, pwd);
        }

        // 4. Update Email for registered user ONLY if user actually changed it
        if (isEmailChanged) {
          try {
            await updateEmail(user, trimmedEmail);
            await setDoc(userDocRef, { email: trimmedEmail }, { merge: true });
            this.initialEmail = trimmedEmail;
          } catch (emailErr: any) {
            if (
              emailErr?.code === 'auth/operation-not-allowed' ||
              emailErr?.message?.includes('verify the new email')
            ) {
              await verifyBeforeUpdateEmail(user, trimmedEmail);
              emailVerificationSent = true;
            } else {
              throw emailErr;
            }
          }
        }
      }

      // Reset password fields
      this.newPassword.set('');
      this.confirmPassword.set('');
      this.currentPassword.set('');

      if (emailVerificationSent) {
        this.successMessage.set(
          `Profil aktualisiert! Ein Bestätigungslink wurde an ${trimmedEmail} gesendet. Bitte klicke auf den Link in deiner E-Mail, um die neue E-Mail-Adresse zu aktivieren.`
        );
      } else if (isPasswordChanged && !isEmailChanged && !isNameChanged) {
        this.successMessage.set('Passwort erfolgreich geändert!');
      } else {
        this.successMessage.set('Daten erfolgreich in Firebase gespeichert!');
      }
    } catch (error: any) {
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

    if (!user.isAnonymous) {
      const pwd = this.currentPassword().trim();
      if (!pwd) {
        this.errorMessage.set('Bitte gib dein aktuelles Passwort zur Bestätigung ein.');
        return;
      }
    }

    this.isLoading.set(true);
    try {
      // Reauthenticate registered user before deletion
      if (!user.isAnonymous) {
        const cred = EmailAuthProvider.credential(user.email || '', this.currentPassword());
        await reauthenticateWithCredential(user, cred);
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
      const code = error?.code || '';
      const msg = (error?.message || '').toLowerCase();
      if (
        code === 'auth/wrong-password' ||
        code === 'auth/invalid-credential' ||
        code === 'auth/invalid-password' ||
        msg.includes('wrong-password') ||
        msg.includes('invalid-credential')
      ) {
        this.errorMessage.set('Das eingegebene Passwort ist falsch. Der Account wurde nicht gelöscht.');
      } else if (code === 'auth/requires-recent-login') {
        this.errorMessage.set('Bitte gib dein aktuelles Passwort ein, um den Account aus Sicherheitsgründen zu löschen.');
      } else {
        this.errorMessage.set('Fehler beim Löschen des Accounts. Bitte Passwort überprüfen.');
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
      this.errorMessage.set('Fehler beim Zurücksetzen des Spielstands. Bitte versuche es später erneut.');
      this.closeConfirmModal();
    } finally {
      this.isLoading.set(false);
    }
  }

  private handleAuthError(error: any): void {
    const code = error?.code || '';
    const msg = (error?.message || '').toLowerCase();

    // Check for wrong password or invalid credential during re-authentication
    if (
      code === 'auth/wrong-password' ||
      code === 'auth/invalid-credential' ||
      code === 'auth/invalid-password' ||
      msg.includes('wrong-password') ||
      msg.includes('invalid-credential')
    ) {
      this.errorMessage.set('Die Eingabe des aktuellen Passworts ist falsch. Bitte überprüfe dein Passwort.');
      return;
    }

    switch (code) {
      case 'auth/requires-recent-login':
        this.errorMessage.set('Sicherheitsüberprüfung: Bitte gib dein aktuelles Passwort ein, um diese Änderung zu speichern.');
        break;
      case 'auth/too-many-requests':
        this.errorMessage.set('Zu viele Fehlversuche. Bitte warte kurz und versuche es erneut.');
        break;
      case 'auth/network-request-failed':
        this.errorMessage.set('Die Eingabe des aktuellen Passworts ist falsch oder die Verbindung zum Server wurde unterbrochen.');
        break;
      case 'auth/email-already-in-use':
        this.errorMessage.set('Diese E-Mail-Adresse wird bereits von einem anderen Commander genutzt.');
        break;
      case 'auth/invalid-email':
        this.errorMessage.set('Die angegebene E-Mail-Adresse ist ungültig.');
        break;
      case 'auth/weak-password':
        this.errorMessage.set('Das neue Passwort ist zu schwach (mindestens 6 Zeichen erforderlich).');
        break;
      case 'auth/operation-not-allowed':
        this.errorMessage.set('Diese Aktion erfordert eine E-Mail-Verifizierung oder ist in Firebase noch nicht freigeschaltet.');
        break;
      default:
        this.errorMessage.set('Die Eingabe des aktuellen Passworts ist falsch oder die Daten konnten nicht übernommen werden.');
    }
  }
}

import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Auth, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, signInAnonymously } from '@angular/fire/auth';
import { Firestore, doc, setDoc } from '@angular/fire/firestore';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './landing-page.component.html',
  styleUrls: ['./landing-page.component.scss']
})
export class LandingPageComponent {
  private auth = inject(Auth);
  private router = inject(Router);
  private firestore = inject(Firestore);

  isLoginMode = signal(true);
  email = signal('');
  password = signal('');
  commanderName = signal('');
  privacyAccepted = signal(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);
  isLoading = signal(false);

  toggleMode() {
    this.isLoginMode.set(!this.isLoginMode());
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.commanderName.set('');
    this.privacyAccepted.set(false);
  }

  async onSubmit() {
    if (!this.email() || !this.password() || (!this.isLoginMode() && !this.commanderName())) {
      this.errorMessage.set('Bitte fülle alle Felder aus.');
      this.successMessage.set(null);
      return;
    }

    if (!this.isLoginMode() && !this.privacyAccepted()) {
      this.errorMessage.set('Bitte akzeptiere die Privacy Policy.');
      this.successMessage.set(null);
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    try {
      if (this.isLoginMode()) {
        await signInWithEmailAndPassword(this.auth, this.email(), this.password());
        console.log('Login erfolgreich');
        // Weiterleitung erfolgt später, wenn das Dashboard gebaut ist
      } else {
        const userCredential = await createUserWithEmailAndPassword(this.auth, this.email(), this.password());
        
        // Commander Name im Profil speichern und in Firestore eintragen
        if (userCredential.user) {
          await updateProfile(userCredential.user, {
            displayName: this.commanderName()
          });

          // Firestore-Dokument in der Collection 'users' anlegen
          const userDocRef = doc(this.firestore, `users/${userCredential.user.uid}`);
          await setDoc(userDocRef, {
            uid: userCredential.user.uid,
            email: this.email(),
            commanderName: this.commanderName(),
            createdAt: new Date().toISOString()
          });
        }
        
        console.log('Registrierung erfolgreich');
        // Nach erfolgreicher Registrierung zurück zum Login wechseln
        this.isLoginMode.set(true);
        this.password.set(''); // Passwort-Feld leeren
        this.commanderName.set(''); // Namen-Feld leeren
        this.successMessage.set('Account erfolgreich erstellt! Bitte einloggen.');
      }
    } catch (error: any) {
      console.error(error);
      this.handleAuthError(error);
    } finally {
      this.isLoading.set(false);
    }
  }

  async loginAsGuest() {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    try {
      const userCredential = await signInAnonymously(this.auth);
      console.log('Gast-Login erfolgreich');
      
      // Document in Firestore für Gast-Nutzer erstellen/updaten
      const userDocRef = doc(this.firestore, `users/${userCredential.user.uid}`);
      await setDoc(userDocRef, {
        uid: userCredential.user.uid,
        email: null,
        commanderName: `Gast-${userCredential.user.uid.substring(0, 5)}`,
        isGuest: true,
        createdAt: new Date().toISOString()
      }, { merge: true });

      // Weiterleitung erfolgt später, wenn das Dashboard gebaut ist
    } catch (error: any) {
      console.error(error);
      this.errorMessage.set('Gast-Login fehlgeschlagen. Bitte versuche es später.');
    } finally {
      this.isLoading.set(false);
    }
  }

  private handleAuthError(error: any) {
    switch (error.code) {
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

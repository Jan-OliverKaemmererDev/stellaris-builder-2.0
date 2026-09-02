import { Component, inject } from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';

/** Displays the privacy policy page explaining data handling practices. */
@Component({
  selector: 'app-privacy-policy',
  standalone: true,
  imports: [],
  templateUrl: './privacy-policy.html',
  styleUrl: './privacy-policy.scss',
})
export class PrivacyPolicy {
  /** Injected Angular Location service to manage browser history navigation. */
  private location = inject(Location);
  private router = inject(Router);

  /**
   * Navigates back to the previous page, or falls back to root if no history.
   * @param event - The click event to prevent default anchor behavior.
   */
  goBack(event: Event): void {
    event.preventDefault();
    if (typeof window !== 'undefined' && window.history.length > 1) {
      this.location.back();
    } else {
      this.router.navigate(['/']);
    }
  }
}

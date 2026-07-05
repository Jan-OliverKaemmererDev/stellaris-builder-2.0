import { Component, inject } from '@angular/core';
import { Location } from '@angular/common';

/** Displays the privacy policy page explaining data handling practices. */
@Component({
  selector: 'app-privacy-policy',
  standalone: true,
  imports: [],
  templateUrl: './privacy-policy.html',
  styleUrl: './privacy-policy.scss',
})
export class PrivacyPolicy {
  private location = inject(Location);

  /**
   * Navigates back to the previous page.
   * @param event - The click event to prevent default anchor behavior.
   */
  goBack(event: Event): void {
    event.preventDefault();
    this.location.back();
  }
}

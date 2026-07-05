import { Component, inject } from '@angular/core';
import { Location } from '@angular/common';

/** Displays the legal notice / imprint page with terms and conditions. */
@Component({
  selector: 'app-legal-notice',
  standalone: true,
  imports: [],
  templateUrl: './legal-notice.html',
  styleUrl: './legal-notice.scss',
})
export class LegalNotice {
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

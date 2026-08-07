import { Component, inject } from '@angular/core';
import { Location } from '@angular/common';

/**
 * Component that displays the legal notice and imprint page.
 * Provides static terms, conditions, and a mechanism to navigate back.
 */
@Component({
  selector: 'app-legal-notice',
  standalone: true,
  imports: [],
  templateUrl: './legal-notice.html',
  styleUrl: './legal-notice.scss',
})
export class LegalNotice {
  /** Angular service used to interact with the browser's URL history. */
  private location = inject(Location);

  /**
   * Navigates the user back to the previous page in their history stack.
   * @param event - The DOM click event, used to prevent default anchor navigation.
   */
  goBack(event: Event): void {
    event.preventDefault();
    this.location.back();
  }
}

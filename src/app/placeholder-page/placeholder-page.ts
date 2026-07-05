import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

/**
 * Generic placeholder page displayed for routes that are still under development.
 * Shows an animated icon, page title, and a progress indicator.
 */
@Component({
  selector: 'app-placeholder-page',
  standalone: true,
  imports: [],
  templateUrl: './placeholder-page.html',
  styleUrl: './placeholder-page.scss',
})
export class PlaceholderPage {
  private route = inject(ActivatedRoute);

  /** The page title from route data, or 'Unbekannt' as fallback. */
  get pageName(): string {
    return (this.route.snapshot.data['title'] as string) || 'Unbekannt';
  }

  /** The page icon emoji from route data, or '🚧' as fallback. */
  get pageIcon(): string {
    return (this.route.snapshot.data['icon'] as string) || '🚧';
  }
}

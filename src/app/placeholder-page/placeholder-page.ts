import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-placeholder-page',
  standalone: true,
  imports: [],
  templateUrl: './placeholder-page.html',
  styleUrl: './placeholder-page.scss',
})
export class PlaceholderPage {
  private route = inject(ActivatedRoute);

  get pageName(): string {
    return (this.route.snapshot.data['title'] as string) || 'Unbekannt';
  }

  get pageIcon(): string {
    return (this.route.snapshot.data['icon'] as string) || '🚧';
  }
}

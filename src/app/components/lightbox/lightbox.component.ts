import { Component, Input, Output, EventEmitter, HostListener } from '@angular/core';

/**
 * Data model for the lightbox overlay content.
 * Contains all information displayed when a skill node image is clicked.
 */
export interface LightboxData {
  /** Path to the full-size image displayed in the lightbox. */
  imagePath: string;
  /** Title displayed above the image. */
  title: string;
  /** Short description of the building/upgrade/ship. */
  description: string;
  /** Dynamically computed effect text based on the current level. */
  effectText: string;
}

/**
 * Reusable lightbox overlay component.
 * Displays a full-screen overlay with an enlarged image,
 * a title above and description + effect info below.
 */
import { IconComponent } from '../icon/icon.component';

@Component({
  selector: 'app-lightbox',
  standalone: true,
  imports: [IconComponent],
  templateUrl: './lightbox.component.html',
  styleUrl: './lightbox.component.scss',
})
export class LightboxComponent {
  /** The data to display in the lightbox. Set to null to hide. */
  @Input() data: LightboxData | null = null;

  /** Emits when the user requests to close the lightbox. */
  @Output() closed = new EventEmitter<void>();

  /** Closes the lightbox when Escape is pressed. */
  @HostListener('window:keydown.escape')
  onEscapePress() {
    this.closed.emit();
  }
}

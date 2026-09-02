import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { getResourceIconClass } from '../../constants/resources.constant';

/**
 * Reusable Icon Component for all custom game & resource icons.
 * Automatically resolves resource identifiers ('eisen', 'gold', 'credits'),
 * category titles ('title-resources'), ship identifiers ('ship-colony'),
 * or full CSS classes ('css-icon-iron').
 */
@Component({
  selector: 'app-icon',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="css-res-icon"
      [ngClass]="[computedIconClass, customClass]"
      [style.width]="size || null"
      [style.height]="size || null"
      [style.fontSize]="size || null"
      [attr.aria-hidden]="ariaHidden"
      [attr.title]="title || null"
    ></div>
  `,
  styles: [
    `
      :host {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        vertical-align: middle;
        line-height: 1;
      }
    `,
  ],
})
export class IconComponent {
  /** Identifier of the icon (e.g. 'eisen', 'gold', 'credits', 'title-resources', 'ship-colony', 'rules'). */
  @Input({ required: true }) name: string = '';

  /** Optional custom dimension (e.g. '24px', '38px', '2em', '100px'). Defaults to standard 1.4em. */
  @Input() size?: string;

  /** Optional additional CSS classes to append to the icon div. */
  @Input() customClass: string = '';

  /** Accessibility attribute; defaults to true for decorative icons. */
  @Input() ariaHidden: boolean = true;

  /** Optional tooltip title. */
  @Input() title?: string;

  /** Resolves the input name into the corresponding CSS class. */
  get computedIconClass(): string {
    return getResourceIconClass(this.name);
  }
}

import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CompactNumberPipe } from '../../pipes/compact-number.pipe';
import { PixelProgressBarComponent } from '../pixel-progress-bar/pixel-progress-bar.component';
import { ActiveBuild } from '../../services/game-state.types';

/**
 * Represents a single formatted cost entry for display.
 */
export interface CostEntry {
  /** Human-readable resource name (e.g., 'Eisen'). */
  name: string;
  /** The numeric cost amount. */
  amount: number;
  /** CSS color variable string (e.g., 'var(--color-eisen)'). */
  colorVar: string;
}

/**
 * Reusable skill node card component.
 * Renders a single building/upgrade/technology card with image,
 * level display, effect text, cost breakdown, and action button.
 */
@Component({
  selector: 'app-skill-node',
  standalone: true,
  imports: [CommonModule, CompactNumberPipe, PixelProgressBarComponent],
  templateUrl: './skill-node.component.html',
  styleUrl: './skill-node.component.scss',
})
export class SkillNodeComponent {
  /** Display title shown on the card header. */
  @Input() title: string = '';
  /** Path to the node's illustration image. */
  @Input() imagePath: string = '';
  /** Current level of the skill/building. */
  @Input() level: number = 0;
  /** Whether the node is locked (prerequisite not met). */
  @Input() locked: boolean = false;
  /** Text displayed on the lock overlay (e.g., 'Benötigt Eisenmine Lvl 10'). */
  @Input() lockText: string = '';
  /** Short description of what this building/upgrade does. */
  @Input() description: string = '';
  /** Dynamically computed effect text based on the current level. */
  @Input() effectText: string = '';
  /** Array of formatted cost entries to display. */
  @Input() costEntries: CostEntry[] = [];
  /** Additional continuous energy consumed after the next upgrade. */
  @Input() energyDelta: number = 0;
  /** Whether the player can afford the current upgrade cost. */
  @Input() canAfford: boolean = false;
  /** Label for the action button (e.g., 'Ausbauen', 'Erforschen', 'Kaufen'). */
  @Input() buttonText: string = 'Ausbauen';
  /** If true, shows a placeholder letter instead of an image. */
  @Input() showPlaceholder: boolean = false;
  /** The character displayed in the placeholder icon (usually the first letter of the title). */
  @Input() placeholderChar: string = '';
  /** If this node is currently being built, contains the active build data. */
  @Input() activeBuild: ActiveBuild | null = null;
  /** Whether the building is currently turned off to save energy. */
  @Input() isDeactivated: boolean = false;
  /** Whether power can be toggled (true when level > 0 and building has energy upkeep). */
  @Input() canTogglePower: boolean = false;

  /** Emits when the node image is clicked (to open the lightbox). */
  @Output() imageClicked = new EventEmitter<void>();
  /** Emits when the build process is started (button clicked). */
  @Output() buildStarted = new EventEmitter<void>();
  /** Emits when the build process completes (after progress bar reaches 100%). */
  @Output() upgradeCompleted = new EventEmitter<void>();
  /** Emits when the power toggle icon is clicked. */
  @Output() powerToggled = new EventEmitter<void>();

  startBuild(): void {
    if (this.locked || !this.canAfford || this.activeBuild) return;
    this.buildStarted.emit();
  }

  onBuildComplete(): void {
    this.upgradeCompleted.emit();
  }

  onTogglePower(event: Event): void {
    event.stopPropagation();
    this.powerToggled.emit();
  }
}


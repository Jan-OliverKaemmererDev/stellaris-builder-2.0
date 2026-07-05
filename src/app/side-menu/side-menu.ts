import { Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

/** A navigation item in the side menu. */
interface MenuItem {
  /** Emoji icon displayed in the collapsed sidebar. */
  icon: string;
  /** Text label shown when the sidebar is expanded. */
  label: string;
  /** Router path to navigate to on click. */
  route: string;
}

/**
 * Collapsible side navigation menu.
 * Expands on hover to reveal labels, collapses to icon-only on mouse leave.
 */
@Component({
  selector: 'app-side-menu',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './side-menu.html',
  styleUrl: './side-menu.scss',
})
export class SideMenu {
  /** Whether the sidebar is currently expanded. */
  isExpanded = signal(false);

  /** All menu items displayed in the sidebar navigation. */
  menuItems: MenuItem[] = [
    { icon: '⛏️', label: 'Rohstoffabbau', route: '/bridge/mining' },
    { icon: '⚡', label: 'Energie', route: '/bridge/energy' },
    { icon: '🔬', label: 'Forschungszentrum', route: '/bridge/research' },
    { icon: '🏗️', label: 'Infrastruktur', route: '/bridge/infrastructure' },
    { icon: '💹', label: 'Handel & Wirtschaft', route: '/bridge/trade' },
    { icon: '🚀', label: 'Flotte', route: '/bridge/fleet' },
  ];

  /** Expands the sidebar on mouse enter. */
  onMouseEnter(): void {
    this.isExpanded.set(true);
  }

  /** Collapses the sidebar on mouse leave. */
  onMouseLeave(): void {
    this.isExpanded.set(false);
  }
}

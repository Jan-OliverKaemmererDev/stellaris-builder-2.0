import { Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

/** A navigation item in the side menu. */
interface MenuItem {
  /** Image file name for the icon displayed in the collapsed sidebar. */
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
    { icon: 'energy.png', label: 'Energie', route: '/bridge/energy' },
    { icon: 'mining.png', label: 'Rohstoffabbau', route: '/bridge/mining' },
    { icon: 'research.png', label: 'Forschungszentrum', route: '/bridge/research' },
    { icon: 'infrastructure.png', label: 'Infrastruktur', route: '/bridge/infrastructure' },
    { icon: 'trade.png', label: 'Handel & Wirtschaft', route: '/bridge/trade' },
    { icon: 'fleet.png', label: 'Flotte', route: '/bridge/fleet' },
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

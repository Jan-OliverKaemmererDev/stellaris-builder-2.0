import { Component, Input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

/** A navigation item in the side menu. */
interface MenuItem {
  /** CSS class name for the icon displayed in the collapsed sidebar. */
  iconClass: string;
  /** Text label shown when the sidebar is expanded. */
  label: string;
  /** Router path to navigate to on click. */
  route: string;
}

/**
 * Drawer navigation menu component.
 */
@Component({
  selector: 'app-side-menu',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './side-menu.html',
  styleUrl: './side-menu.scss',
})
export class SideMenu {
  /** Whether the drawer is currently open. */
  @Input() isOpen = false;

  /** All menu items displayed in the drawer navigation. */
  menuItems: MenuItem[] = [
    { iconClass: 'icon-bridge', label: 'Brücke', route: '/bridge' },
    { iconClass: 'icon-energy', label: 'Energie', route: '/bridge/energy' },
    { iconClass: 'icon-mining', label: 'Rohstoffabbau', route: '/bridge/mining' },
    { iconClass: 'icon-research', label: 'Forschungszentrum', route: '/bridge/research' },
    { iconClass: 'icon-infrastructure', label: 'Infrastruktur', route: '/bridge/infrastructure' },
    { iconClass: 'icon-trade', label: 'Handel & Wirtschaft', route: '/bridge/trade' },
    { iconClass: 'icon-fleet', label: 'Flotte', route: '/bridge/fleet' },
  ];
}

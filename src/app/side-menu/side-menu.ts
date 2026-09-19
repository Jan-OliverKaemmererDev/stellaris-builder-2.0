import { Component, Input, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AudioService } from '../services/audio.service';

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
  private audioService = inject(AudioService);

  /** Whether the drawer is currently open. */
  @Input() isOpen = false;

  /** All menu items displayed in the drawer navigation. */
  menuItems: MenuItem[] = [
    { iconClass: 'icon-bridge', label: 'Brücke', route: '/bridge' },
    { iconClass: 'icon-energy', label: 'Energienetz', route: '/bridge/energy' },
    { iconClass: 'icon-mining', label: 'Rohstoffabbau', route: '/bridge/mining' },
    { iconClass: 'icon-research', label: 'Forschungszentrum', route: '/bridge/research' },
    { iconClass: 'icon-infrastructure', label: 'Infrastruktur', route: '/bridge/infrastructure' },
    { iconClass: 'icon-trade', label: 'Handel & Wirtschaft', route: '/bridge/trade' },
    { iconClass: 'icon-fleet', label: 'Flotte', route: '/bridge/fleet' },
  ];

  /**
   * Plays the modern UI hover sound effect when the cursor enters a drawer menu item.
   */
  onMenuItemHover(): void {
    if (!this.isOpen) return;
    this.audioService.playMenuHover();
  }
}

import { Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

interface MenuItem {
  icon: string;
  label: string;
  route: string;
}

@Component({
  selector: 'app-side-menu',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './side-menu.html',
  styleUrl: './side-menu.scss',
})
export class SideMenu {
  isExpanded = signal(false);

  menuItems: MenuItem[] = [
    { icon: '⛏️', label: 'Rohstoffabbau', route: '/bridge/mining' },
    { icon: '⚡', label: 'Energie', route: '/bridge/energy' },
    { icon: '🔬', label: 'Forschungszentrum', route: '/bridge/research' },
    { icon: '🏗️', label: 'Infrastruktur', route: '/bridge/infrastructure' },
    { icon: '💹', label: 'Handel & Wirtschaft', route: '/bridge/trade' },
    { icon: '🚀', label: 'Flotte', route: '/bridge/fleet' },
  ];

  onMouseEnter() {
    this.isExpanded.set(true);
  }

  onMouseLeave() {
    this.isExpanded.set(false);
  }
}

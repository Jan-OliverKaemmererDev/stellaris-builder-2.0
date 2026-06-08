import { Component, inject, computed, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { Auth } from '@angular/fire/auth';
import { GameStateService } from '../services/game-state.service';

interface Resource {
  name: string;
  icon: string;
  current: number;
  max: number;
  rate: number;
  colorVar: string;
}

interface ShipType {
  name: string;
  icon: string;
  count: number;
}

@Component({
  selector: 'app-bridge',
  standalone: true,
  imports: [DecimalPipe],
  templateUrl: './bridge.html',
  styleUrl: './bridge.scss',
})
export class Bridge {
  private auth = inject(Auth);
  private gameState = inject(GameStateService);

  get commanderName(): string {
    const user = this.auth.currentUser;
    if (!user) return 'Commander';
    return user.displayName || (user.isAnonymous ? 'Gast-Commander' : 'Commander');
  }

  // ── Data from Service ──

  resources = computed<Resource[]>(() => {
    const res = this.gameState.resources();
    return [
      { name: 'Mineralien', icon: '💎', current: res.minerals, max: 10000, rate: 124, colorVar: '--color-minerals' },
      { name: 'Gas', icon: '🌫️', current: res.gas, max: 5000, rate: 47, colorVar: '--color-gas' },
      { name: 'Kristalle', icon: '🔮', current: res.crystals, max: 3000, rate: 28, colorVar: '--color-crystals' },
      { name: 'Nahrung', icon: '🌾', current: res.food, max: 12000, rate: 210, colorVar: '--color-food' },
    ];
  });

  energyProduction = signal(580);
  energyConsumption = signal(412);

  get energyNet(): number {
    return this.energyProduction() - this.energyConsumption();
  }

  get energyPercent(): number {
    return Math.min(100, (this.energyConsumption() / this.energyProduction()) * 100);
  }

  population = signal({
    total: 1247,
    workers: 680,
    scientists: 312,
    free: 255,
  });

  fleet = signal<ShipType[]>([
    { name: 'Korvetten', icon: '🛸', count: 24 },
    { name: 'Zerstörer', icon: '⚔️', count: 8 },
    { name: 'Kreuzer', icon: '🚀', count: 4 },
    { name: 'Schlachtschiffe', icon: '🛡️', count: 1 },
  ]);

  get totalShips(): number {
    return this.fleet().reduce((sum, ship) => sum + ship.count, 0);
  }

  getResourcePercent(resource: Resource): number {
    return (resource.current / resource.max) * 100;
  }
}

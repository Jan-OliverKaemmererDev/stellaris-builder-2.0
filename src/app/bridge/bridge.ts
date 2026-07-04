import { Component, inject, computed, signal } from '@angular/core';
import { DecimalPipe, NgClass } from '@angular/common';
import { AnimatedNumberComponent } from '../components/animated-number/animated-number.component';
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
  imports: [DecimalPipe, NgClass, AnimatedNumberComponent],
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
    const rates = this.gameState.productionRates();
    const max = this.gameState.maxStorage();
    return [
      { name: 'Eisen', icon: '⛓️', current: res.eisen, max: max.eisen, rate: rates.eisen, colorVar: '--color-eisen' },
      { name: 'Silber', icon: '🔗', current: res.silber, max: max.silber, rate: rates.silber, colorVar: '--color-silber' },
      { name: 'Gold', icon: '✨', current: res.gold, max: max.gold, rate: rates.gold, colorVar: '--color-gold' },
      { name: 'Xenonit', icon: '💠', current: res.xenonit, max: max.xenonit, rate: rates.xenonit, colorVar: '--color-xenonit' },
      { name: 'Credits', icon: '🪙', current: res.credits, max: max.credits, rate: rates.credits, colorVar: '--color-credits' },
    ];
  });

  supplyResources = computed<Resource[]>(() => {
    const res = this.gameState.resources();
    const rates = this.gameState.productionRates();
    const max = this.gameState.maxStorage();
    return [
      { name: 'Nahrung', icon: '🌾', current: res.nahrung, max: max.nahrung, rate: rates.nahrung, colorVar: '--color-nahrung' },
      { name: 'Personal', icon: '👥', current: res.personal, max: max.personal, rate: rates.personal, colorVar: '--color-personal' },
    ];
  });

  // ── Energy Battery ──
  energyProduced = this.gameState.energyProduced;
  availableEnergy = this.gameState.availableEnergy;

  energyPercentage = computed<number>(() => {
    const max = this.energyProduced();
    if (max <= 0) return 0;
    const available = this.availableEnergy();
    return Math.max(0, Math.min(100, (available / max) * 100));
  });

  get energyColorClass(): string {
    const p = this.energyPercentage();
    if (p > 75) return 'energy-good';
    if (p > 25) return 'energy-warn';
    return 'energy-critical';
  }

  fleet = computed<ShipType[]>(() => {
    const s = this.gameState.skills();
    const ships = [];
    if (s['kolonisierungsschiffe']) ships.push({ name: 'Kolonie-Schiffe', icon: '🌍', count: s['kolonisierungsschiffe'] });
    if (s['logistikschiff']) ships.push({ name: 'Logistikschiffe', icon: '📦', count: s['logistikschiff'] });
    if (s['transportschiffe']) ships.push({ name: 'Transportschiffe', icon: '🚚', count: s['transportschiffe'] });
    if (s['mining_ship']) ships.push({ name: 'Mining Ships', icon: '⛏️', count: s['mining_ship'] });
    
    // Fallback if empty
    if (ships.length === 0) {
      ships.push({ name: 'Keine Schiffe', icon: '🛸', count: 0 });
    }
    return ships;
  });

  get totalShips(): number {
    return this.fleet().reduce((sum, ship) => sum + ship.count, 0);
  }

  getResourcePercent(resource: Resource): number {
    return (resource.current / resource.max) * 100;
  }
}

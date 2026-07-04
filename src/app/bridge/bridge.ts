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

  // ── Trading System ──

  hasTradingPost = computed(() => this.gameState.skills()['trading_post'] > 0 || this.gameState.skills()['interstellar_market'] > 0);
  hasInterstellarMarket = computed(() => this.gameState.skills()['interstellar_market'] > 0);

  tradeMultiplier = signal(100);
  setMultiplier(m: number) {
    this.tradeMultiplier.set(m);
  }

  sellableResources = [
    { id: 'eisen', name: 'Eisen', icon: '⛓️', colorVar: '--color-eisen' },
    { id: 'silber', name: 'Silber', icon: '🔗', colorVar: '--color-silber' },
    { id: 'gold', name: 'Gold', icon: '✨', colorVar: '--color-gold' },
    { id: 'xenonit', name: 'Xenonit', icon: '💠', colorVar: '--color-xenonit' }
  ] as const;

  buyableResources = [
    { id: 'eisen', name: 'Eisen', icon: '⛓️', colorVar: '--color-eisen' },
    { id: 'silber', name: 'Silber', icon: '🔗', colorVar: '--color-silber' },
    { id: 'gold', name: 'Gold', icon: '✨', colorVar: '--color-gold' },
    { id: 'xenonit', name: 'Xenonit', icon: '💠', colorVar: '--color-xenonit' },
    { id: 'nahrung', name: 'Nahrung', icon: '🌾', colorVar: '--color-nahrung' },
    { id: 'personal', name: 'Personal', icon: '👥', colorVar: '--color-personal' }
  ] as const;

  getSellRate(resId: string) { return this.gameState.getSellRate(resId); }
  getBuyRate(resId: string) { return this.gameState.getBuyRate(resId); }

  canSell(resId: string, amount: number): boolean {
    const current = (this.gameState.resources() as any)[resId] || 0;
    return current >= amount;
  }

  canBuy(resId: string, amount: number): boolean {
    const current = this.gameState.resources().credits || 0;
    const cost = this.getBuyRate(resId) * amount;
    return current >= cost;
  }

  async sell(resId: string) {
    const amount = this.tradeMultiplier();
    if (!this.canSell(resId, amount)) return;
    await this.gameState.sellResource(resId as any, amount);
  }

  async buy(resId: string) {
    const amount = this.tradeMultiplier();
    if (!this.canBuy(resId, amount)) return;
    await this.gameState.buyResource(resId as any, amount);
  }
}

import { Component, inject, computed, signal } from '@angular/core';
import { DecimalPipe, NgClass } from '@angular/common';
import { AnimatedNumberComponent } from '../components/animated-number/animated-number.component';
import { Auth } from '@angular/fire/auth';
import { GameStateService } from '../services/game-state.service';

/** A display-ready resource with current values, max capacity, and production rate. */
interface Resource {
  name: string;
  icon: string;
  current: number;
  max: number;
  rate: number;
  colorVar: string;
}

/** A fleet ship type with its display name, icon, and owned count. */
interface ShipType {
  name: string;
  icon: string;
  count: number;
}

/**
 * Bridge dashboard component – the main command center view.
 * Displays live resource overview, energy status, fleet summary, and trading panel.
 */
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

  /** Returns the display name for the current user. */
  get commanderName(): string {
    const user = this.auth.currentUser;
    if (!user) return 'Commander';
    return user.displayName || (user.isAnonymous ? 'Gast-Commander' : 'Commander');
  }

  baseResources = [
    { id: 'eisen', name: 'Eisen', icon: '⛓️', colorVar: '--color-eisen' },
    { id: 'silber', name: 'Silber', icon: '🔗', colorVar: '--color-silber' },
    { id: 'gold', name: 'Gold', icon: '✨', colorVar: '--color-gold' },
    { id: 'xenonit', name: 'Xenonit', icon: '💠', colorVar: '--color-xenonit' },
    { id: 'credits', name: 'Credits', icon: '🪙', colorVar: '--color-credits' },
  ];

  baseSupplyResources = [
    { id: 'nahrung', name: 'Nahrung', icon: '🌾', colorVar: '--color-nahrung' },
    { id: 'personal', name: 'Personal', icon: '👥', colorVar: '--color-personal' },
  ];

  /** Retrieves the array of standard resources for the dashboard. */
  resources = computed<Resource[]>(() => {
    return this.baseResources.map(r => ({
      ...r,
      current: (this.gameState.resources() as unknown as Record<string, number>)[r.id] || 0,
      max: (this.gameState.maxStorage() as unknown as Record<string, number>)[r.id] || 0,
      rate: (this.gameState.productionRates() as unknown as Record<string, number>)[r.id] || 0,
    }));
  });

  /** Retrieves the array of supply/personnel resources for the dashboard. */
  supplyResources = computed<Resource[]>(() => {
    return this.baseSupplyResources.map(r => ({
      ...r,
      current: (this.gameState.resources() as unknown as Record<string, number>)[r.id] || 0,
      max: (this.gameState.maxStorage() as unknown as Record<string, number>)[r.id] || 0,
      rate: (this.gameState.productionRates() as unknown as Record<string, number>)[r.id] || 0,
    }));
  });

  /** Total energy capacity produced by power plants. */
  energyProduced = this.gameState.energyProduced;

  /** Remaining free energy capacity. */
  availableEnergy = this.gameState.availableEnergy;

  /** Percentage of available energy relative to total produced (0–100). */
  energyPercentage = computed<number>(() => {
    const max = this.energyProduced();
    if (max <= 0) return 0;
    return Math.max(0, Math.min(100, (this.availableEnergy() / max) * 100));
  });

  /** CSS class indicating the energy status: good, warn, or critical. */
  get energyColorClass(): string {
    const p = this.energyPercentage();
    if (p > 75) return 'energy-good';
    if (p > 25) return 'energy-warn';
    return 'energy-critical';
  }

  /** Reactive fleet composition derived from owned ship skills. */
  fleet = computed<ShipType[]>(() => {
    const s = this.gameState.skills();
    const ships: ShipType[] = [];
    if (s['kolonisierungsschiffe']) ships.push({ name: 'Kolonie-Schiffe', icon: '🌍', count: s['kolonisierungsschiffe'] });
    if (s['logistikschiff']) ships.push({ name: 'Logistikschiffe', icon: '📦', count: s['logistikschiff'] });
    if (s['transportschiffe']) ships.push({ name: 'Transportschiffe', icon: '🚚', count: s['transportschiffe'] });
    if (s['mining_ship']) ships.push({ name: 'Mining Ships', icon: '⛏️', count: s['mining_ship'] });
    if (ships.length === 0) {
      ships.push({ name: 'Keine Schiffe', icon: '🛸', count: 0 });
    }
    return ships;
  });

  /** Total number of ships across all types. */
  get totalShips(): number {
    return this.fleet().reduce((sum, ship) => sum + ship.count, 0);
  }

  /**
   * Calculates the fill percentage of a resource bar.
   * @param resource - The resource to calculate for.
   */
  getResourcePercent(resource: Resource): number {
    return (resource.current / resource.max) * 100;
  }

  /** Whether the player has unlocked at least one trading building. */
  hasTradingPost = computed(() => this.gameState.skills()['trading_post'] > 0 || this.gameState.skills()['interstellar_market'] > 0);

  /** Whether the player has unlocked the interstellar market for buying. */
  hasInterstellarMarket = computed(() => this.gameState.skills()['interstellar_market'] > 0);

  /** Current trade multiplier (units per transaction). */
  tradeMultiplier = signal(100);

  /**
   * Updates the trade multiplier.
   * @param m - The new multiplier value.
   */
  setMultiplier(m: number): void {
    this.tradeMultiplier.set(m);
  }

  /** Resources available for selling. */
  sellableResources = [
    { id: 'eisen', name: 'Eisen', icon: '⛓️', colorVar: '--color-eisen' },
    { id: 'silber', name: 'Silber', icon: '🔗', colorVar: '--color-silber' },
    { id: 'gold', name: 'Gold', icon: '✨', colorVar: '--color-gold' },
    { id: 'xenonit', name: 'Xenonit', icon: '💠', colorVar: '--color-xenonit' },
  ] as const;

  /** Resources available for buying. */
  buyableResources = [
    { id: 'eisen', name: 'Eisen', icon: '⛓️', colorVar: '--color-eisen' },
    { id: 'silber', name: 'Silber', icon: '🔗', colorVar: '--color-silber' },
    { id: 'gold', name: 'Gold', icon: '✨', colorVar: '--color-gold' },
    { id: 'xenonit', name: 'Xenonit', icon: '💠', colorVar: '--color-xenonit' },
    { id: 'nahrung', name: 'Nahrung', icon: '🌾', colorVar: '--color-nahrung' },
    { id: 'personal', name: 'Personal', icon: '👥', colorVar: '--color-personal' },
  ] as const;

  /**
   * Returns the credit value per unit for selling a resource.
   * @param resId - The resource ID.
   */
  getSellRate(resId: string): number {
    return this.gameState.getSellRate(resId);
  }

  /**
   * Returns the credit cost per unit for buying a resource.
   * @param resId - The resource ID.
   */
  getBuyRate(resId: string): number {
    return this.gameState.getBuyRate(resId);
  }

  /**
   * Checks whether the player has enough of a resource to sell.
   * @param resId - The resource ID.
   * @param amount - The amount to sell.
   */
  canSell(resId: string, amount: number): boolean {
    const current = (this.gameState.resources() as unknown as Record<string, number>)[resId] || 0;
    return current >= amount;
  }

  /**
   * Checks whether the player has enough credits to buy a resource.
   * @param resId - The resource ID.
   * @param amount - The amount to buy.
   */
  canBuy(resId: string, amount: number): boolean {
    const cost = this.getBuyRate(resId) * amount;
    return (this.gameState.resources().credits || 0) >= cost;
  }

  /**
   * Sells the current trade multiplier amount of a resource.
   * @param resId - The resource ID to sell.
   */
  async sell(resId: string): Promise<void> {
    const amount = this.tradeMultiplier();
    if (!this.canSell(resId, amount)) return;
    await this.gameState.sellResource(resId as any, amount);
  }

  /**
   * Buys the current trade multiplier amount of a resource.
   * @param resId - The resource ID to buy.
   */
  async buy(resId: string): Promise<void> {
    const amount = this.tradeMultiplier();
    if (!this.canBuy(resId, amount)) return;
    await this.gameState.buyResource(resId as any, amount);
  }
}

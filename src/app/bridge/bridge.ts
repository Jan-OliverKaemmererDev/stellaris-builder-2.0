import { Component, inject, computed, signal } from '@angular/core';
import { DecimalPipe, NgClass } from '@angular/common';
import { AnimatedNumberComponent } from '../components/animated-number/animated-number.component';
import { Auth } from '@angular/fire/auth';
import { GameStateService } from '../services/game-state.service';

/**
 * Represents a display-ready resource with current values, max capacity, and production rate.
 */
interface Resource {
  name: string;
  icon: string;
  current: number;
  max: number;
  rate: number;
  colorVar: string;
}

/**
 * Represents a fleet ship type with its display name, icon, and owned count.
 */
interface ShipType {
  name: string;
  icon: string;
  count: number;
}

/**
 * Bridge dashboard component - the main command center view.
 * Displays a live resource overview, energy status, fleet summary, and a trading panel.
 */
@Component({
  selector: 'app-bridge',
  standalone: true,
  imports: [DecimalPipe, NgClass, AnimatedNumberComponent],
  templateUrl: './bridge.html',
  styleUrl: './bridge.scss',
})
export class Bridge {
  /** Authentication service to retrieve the current user. */
  private auth = inject(Auth);

  /** Game state service to interact with resources, skills, and trading. */
  private gameState = inject(GameStateService);

  /**
   * Retrieves the display name for the current user.
   * @returns The user's display name or a default fallback if none exists.
   */
  get commanderName(): string {
    const user = this.auth.currentUser;
    if (!user) return 'Commander';
    return user.displayName || (user.isAnonymous ? 'Gast-Commander' : 'Commander');
  }

  /** Configuration array for standard resources displayed on the dashboard. */
  baseResources = [
    { id: 'eisen', name: 'Eisen', icon: '⛓️', colorVar: '--color-eisen' },
    { id: 'silber', name: 'Silber', icon: '🔗', colorVar: '--color-silber' },
    { id: 'gold', name: 'Gold', icon: '✨', colorVar: '--color-gold' },
    { id: 'xenonit', name: 'Xenonit', icon: '💠', colorVar: '--color-xenonit' },
    { id: 'credits', name: 'Credits', icon: '🪙', colorVar: '--color-credits' },
  ];

  /** Configuration array for supply and personnel resources displayed on the dashboard. */
  baseSupplyResources = [
    { id: 'nahrung', name: 'Nahrung', icon: '🌾', colorVar: '--color-nahrung' },
    { id: 'personal', name: 'Personal', icon: '👥', colorVar: '--color-personal' },
  ];

  /**
   * Computes the array of standard resources enriched with live data from the game state.
   */
  resources = computed<Resource[]>(() => {
    return this.baseResources.map(r => ({
      ...r,
      current: (this.gameState.resources() as unknown as Record<string, number>)[r.id] || 0,
      max: (this.gameState.maxStorage() as unknown as Record<string, number>)[r.id] || 0,
      rate: (this.gameState.productionRates() as unknown as Record<string, number>)[r.id] || 0,
    }));
  });

  /**
   * Computes the array of supply and personnel resources enriched with live data from the game state.
   */
  supplyResources = computed<Resource[]>(() => {
    return this.baseSupplyResources.map(r => ({
      ...r,
      current: (this.gameState.resources() as unknown as Record<string, number>)[r.id] || 0,
      max: (this.gameState.maxStorage() as unknown as Record<string, number>)[r.id] || 0,
      rate: (this.gameState.productionRates() as unknown as Record<string, number>)[r.id] || 0,
    }));
  });

  /** Total energy capacity produced by all power plants. */
  energyProduced = this.gameState.energyProduced;

  /** Remaining free energy capacity after consumption. */
  availableEnergy = this.gameState.availableEnergy;

  /**
   * Computes the percentage of available energy relative to the total produced.
   * @returns A value between 0 and 100 representing the free energy percentage.
   */
  energyPercentage = computed<number>(() => {
    const max = this.energyProduced();
    if (max <= 0) return 0;
    return Math.max(0, Math.min(100, (this.availableEnergy() / max) * 100));
  });

  /**
   * Determines the CSS class indicating the energy network's health status.
   * @returns 'energy-good', 'energy-warn', or 'energy-critical' based on available energy.
   */
  get energyColorClass(): string {
    const p = this.energyPercentage();
    if (p > 75) return 'energy-good';
    if (p > 25) return 'energy-warn';
    return 'energy-critical';
  }

  /**
   * Computes the player's active fleet composition based on unlocked ship skills.
   */
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

  /**
   * Retrieves the total number of ships owned across all ship types.
   * @returns The total ship count.
   */
  get totalShips(): number {
    return this.fleet().reduce((sum, ship) => sum + ship.count, 0);
  }

  /**
   * Calculates the fill percentage of a resource's progress bar.
   * @param resource - The resource object to calculate the percentage for.
   * @returns The percentage filled (0-100).
   */
  getResourcePercent(resource: Resource): number {
    return (resource.current / resource.max) * 100;
  }

  /** Checks whether the player has unlocked at least one trading building. */
  hasTradingPost = computed(() => this.gameState.skills()['trading_post'] > 0 || this.gameState.skills()['interstellar_market'] > 0);

  /** Checks whether the player has unlocked the interstellar market for buying resources. */
  hasInterstellarMarket = computed(() => this.gameState.skills()['interstellar_market'] > 0);

  /** Signal holding the current trade multiplier (units traded per transaction). */
  tradeMultiplier = signal(100);

  /**
   * Updates the active trade multiplier.
   * @param m - The new multiplier value.
   */
  setMultiplier(m: number): void {
    this.tradeMultiplier.set(m);
  }

  /** Configuration array of resources available for selling at the trading post/market. */
  sellableResources = [
    { id: 'eisen', name: 'Eisen', icon: '⛓️', colorVar: '--color-eisen' },
    { id: 'silber', name: 'Silber', icon: '🔗', colorVar: '--color-silber' },
    { id: 'gold', name: 'Gold', icon: '✨', colorVar: '--color-gold' },
    { id: 'xenonit', name: 'Xenonit', icon: '💠', colorVar: '--color-xenonit' },
  ] as const;

  /** Configuration array of resources available for buying at the interstellar market. */
  buyableResources = [
    { id: 'eisen', name: 'Eisen', icon: '⛓️', colorVar: '--color-eisen' },
    { id: 'silber', name: 'Silber', icon: '🔗', colorVar: '--color-silber' },
    { id: 'gold', name: 'Gold', icon: '✨', colorVar: '--color-gold' },
    { id: 'xenonit', name: 'Xenonit', icon: '💠', colorVar: '--color-xenonit' },
    { id: 'nahrung', name: 'Nahrung', icon: '🌾', colorVar: '--color-nahrung' },
    { id: 'personal', name: 'Personal', icon: '👥', colorVar: '--color-personal' },
  ] as const;

  /**
   * Retrieves the credit value per unit when selling a specific resource.
   * @param resId - The identifier of the resource.
   * @returns The sell price in credits per unit.
   */
  getSellRate(resId: string): number {
    return this.gameState.getSellRate(resId);
  }

  /**
   * Retrieves the credit cost per unit when buying a specific resource.
   * @param resId - The identifier of the resource.
   * @returns The purchase cost in credits per unit.
   */
  getBuyRate(resId: string): number {
    return this.gameState.getBuyRate(resId);
  }

  /**
   * Verifies whether the player has enough of a specific resource to complete a sale.
   * @param resId - The identifier of the resource.
   * @param amount - The quantity of the resource to sell.
   * @returns True if the current resource amount is sufficient, false otherwise.
   */
  canSell(resId: string, amount: number): boolean {
    const current = (this.gameState.resources() as unknown as Record<string, number>)[resId] || 0;
    return current >= amount;
  }

  /**
   * Verifies whether the player has enough credits to purchase a specific resource.
   * @param resId - The identifier of the resource.
   * @param amount - The quantity of the resource to buy.
   * @returns True if the player has sufficient credits, false otherwise.
   */
  canBuy(resId: string, amount: number): boolean {
    const cost = this.getBuyRate(resId) * amount;
    return (this.gameState.resources().credits || 0) >= cost;
  }

  /**
   * Executes a sale transaction for a given resource based on the current trade multiplier.
   * @param resId - The identifier of the resource to sell.
   * @returns A promise that resolves when the transaction is complete.
   */
  async sell(resId: string): Promise<void> {
    const amount = this.tradeMultiplier();
    if (!this.canSell(resId, amount)) return;
    await this.gameState.sellResource(resId as any, amount);
  }

  /**
   * Executes a purchase transaction for a given resource based on the current trade multiplier.
   * @param resId - The identifier of the resource to buy.
   * @returns A promise that resolves when the transaction is complete.
   */
  async buy(resId: string): Promise<void> {
    const amount = this.tradeMultiplier();
    if (!this.canBuy(resId, amount)) return;
    await this.gameState.buyResource(resId as any, amount);
  }
}

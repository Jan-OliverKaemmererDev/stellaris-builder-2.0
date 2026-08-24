import { Component, inject, computed, signal } from '@angular/core';
import { DecimalPipe, NgClass } from '@angular/common';
import { CompactNumberPipe } from '../pipes/compact-number.pipe';
import { RouterLink } from '@angular/router';
import { AnimatedNumberComponent } from '../components/animated-number/animated-number.component';
import { Auth } from '@angular/fire/auth';
import { GameStateService } from '../services/game-state.service';
import { ENERGY_UPKEEP, SHIP_IDS } from '../services/game-state.types';
import * as MathUtils from '../services/game-math.utils';

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
  imports: [DecimalPipe, NgClass, AnimatedNumberComponent, RouterLink, CompactNumberPipe],
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
    { id: 'eisen', name: 'Eisen', icon: 'assets/icons/rohstoffe/iron.png', colorVar: '--color-eisen' },
    { id: 'silber', name: 'Silber', icon: 'assets/icons/rohstoffe/silver.png', colorVar: '--color-silber' },
    { id: 'gold', name: 'Gold', icon: 'assets/icons/rohstoffe/gold.png', colorVar: '--color-gold' },
    { id: 'xenonit', name: 'Xenonit', icon: 'assets/icons/rohstoffe/xenonit.png', colorVar: '--color-xenonit' },
    { id: 'credits', name: 'Credits', icon: 'assets/icons/rohstoffe/credits.png', colorVar: '--color-credits' },
  ];

  /** Configuration array for supply and personnel resources displayed on the dashboard. */
  baseSupplyResources = [
    { id: 'nahrung', name: 'Nahrung', icon: 'assets/icons/rohstoffe/food.png', colorVar: '--color-nahrung' },
    { id: 'personal', name: 'Personal', icon: 'assets/icons/rohstoffe/staff.png', colorVar: '--color-personal' },
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
   * Computes the energy breakdown by category for the pie chart.
   */
  energyBreakdown = computed<{ label: string, value: number, color: string }[]>(() => {
    const s = this.gameState.skills();
    const groups = [
      { label: 'Minen & Anlagen', ids: ['eisenmine', 'silbermine', 'goldmine', 'lager', 'refinery'], color: '#a8b2c1' },
      { label: 'Forschung & Tech', ids: ['biolabor', 'ki_automatisierung', 'antriebstechnik'], color: '#9b59b6' },
      { label: 'Wirtschaft', ids: ['trading_post', 'interstellar_market', 'galactic_exchange'], color: '#f1c40f' },
      { label: 'Schiffswerften', ids: ['orbital_shipyard', 'large_station'], color: '#e67e22' },
      { label: 'Flotte', ids: ['kolonisierungsschiffe', 'logistikschiff', 'transportschiffe', 'mining_ship', 'leichter_jaeger', 'schwerer_jaeger', 'zerstoerer', 'kreuzer'], color: '#3498db' }
    ];

    const breakdown = groups.map(g => {
      const val = g.ids.reduce((sum, id) => {
        const level = s[id] || 0;
        if (!level || !ENERGY_UPKEEP[id]) return sum;
        return sum + (SHIP_IDS.includes(id) ? ENERGY_UPKEEP[id] * level : MathUtils.calcCumulativeUpkeep(ENERGY_UPKEEP[id], level));
      }, 0);
      return { label: g.label, value: val, color: g.color };
    }).filter(g => g.value > 0);

    const available = this.availableEnergy();
    if (available > 0) {
      breakdown.push({ label: 'Freie Energie', value: available, color: 'var(--color-success)' });
    }

    return breakdown;
  });

  /**
   * Generates a conic-gradient string for the gauge (half pie chart) based on the energy breakdown.
   */
  pieChartGradient = computed<string>(() => {
    const breakdown = this.energyBreakdown();
    const total = breakdown.reduce((sum, item) => sum + item.value, 0);
    if (total === 0) return 'conic-gradient(from 270deg at 50% 100%, rgba(255, 255, 255, 0.05) 0deg 180deg)';

    let currentAngle = 0;
    const gradientStops: string[] = [];
    
    breakdown.forEach((item, index) => {
      const degrees = (item.value / total) * 180;
      const endAngle = currentAngle + degrees;
      
      // Use ~0.57 degrees for a 1.5px gap (at 150px radius: (1.5 / (150*2*PI)) * 360 = 0.573)
      const gap = (index < breakdown.length - 1) ? 0.57 : 0;
      
      gradientStops.push(`${item.color} ${currentAngle}deg ${endAngle - gap}deg`);
      
      if (gap > 0) {
        gradientStops.push(`#48e5e5 ${endAngle - gap}deg ${endAngle}deg`);
      }
      
      currentAngle += degrees;
    });

    return `conic-gradient(from 270deg at 50% 100%, ${gradientStops.join(', ')})`;
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
   * Computes the player's active colony ships.
   */
  colonyShips = computed<ShipType[]>(() => {
    const s = this.gameState.skills();
    return [
      { name: 'Kolonisierungsschiff', icon: 'assets/icons/fleet/colony-ship.png', count: s['kolonisierungsschiffe'] || 0 },
      { name: 'Logistikschiff', icon: 'assets/icons/fleet/logistics-ship.png', count: s['logistikschiff'] || 0 },
      { name: 'Transportschiff', icon: 'assets/icons/fleet/transport-ship.png', count: s['transportschiffe'] || 0 },
      { name: 'Miningschiff', icon: 'assets/icons/fleet/mining-ship.png', count: s['mining_ship'] || 0 }
    ];
  });

  /**
   * Retrieves the total number of colony ships.
   */
  get totalColonyShips(): number {
    return this.colonyShips().reduce((sum, ship) => sum + ship.count, 0);
  }

  /**
   * Computes the player's active battle ships.
   */
  battleShips = computed<ShipType[]>(() => {
    const s = this.gameState.skills();
    return [
      { name: 'Leichter Jäger', icon: 'assets/img/fleet/light_fighter.jpg', count: s['leichter_jaeger'] || 0 },
      { name: 'Schwerer Jäger', icon: 'assets/img/fleet/heavy_fighter.jpg', count: s['schwerer_jaeger'] || 0 },
      { name: 'Zerstörer', icon: 'assets/img/fleet/destroyer.jpg', count: s['zerstoerer'] || 0 },
      { name: 'Kreuzer', icon: 'assets/img/fleet/cruiser.jpg', count: s['kreuzer'] || 0 }
    ];
  });

  /**
   * Retrieves the total number of battle ships.
   */
  get totalBattleShips(): number {
    return this.battleShips().reduce((sum, ship) => sum + ship.count, 0);
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
    { id: 'eisen', name: 'Eisen', icon: 'assets/icons/rohstoffe/iron.png', colorVar: '--color-eisen' },
    { id: 'silber', name: 'Silber', icon: 'assets/icons/rohstoffe/silver.png', colorVar: '--color-silber' },
    { id: 'gold', name: 'Gold', icon: 'assets/icons/rohstoffe/gold.png', colorVar: '--color-gold' },
    { id: 'xenonit', name: 'Xenonit', icon: 'assets/icons/rohstoffe/xenonit.png', colorVar: '--color-xenonit' },
  ] as const;

  /** Configuration array of resources available for buying at the interstellar market. */
  buyableResources = [
    { id: 'eisen', name: 'Eisen', icon: 'assets/icons/rohstoffe/iron.png', colorVar: '--color-eisen' },
    { id: 'silber', name: 'Silber', icon: 'assets/icons/rohstoffe/silver.png', colorVar: '--color-silber' },
    { id: 'gold', name: 'Gold', icon: 'assets/icons/rohstoffe/gold.png', colorVar: '--color-gold' },
    { id: 'xenonit', name: 'Xenonit', icon: 'assets/icons/rohstoffe/xenonit.png', colorVar: '--color-xenonit' },
    { id: 'nahrung', name: 'Nahrung', icon: 'assets/icons/rohstoffe/food.png', colorVar: '--color-nahrung' },
    { id: 'personal', name: 'Personal', icon: 'assets/icons/rohstoffe/staff.png', colorVar: '--color-personal' },
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

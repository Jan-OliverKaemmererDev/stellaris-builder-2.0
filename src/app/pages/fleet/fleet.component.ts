import { Component, inject, computed, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CompactNumberPipe } from '../../pipes/compact-number.pipe';
import { GameStateService } from '../../services/game-state.service';
import { GameResources } from '../../services/game-state.types';
import { calcExponential, calculateCost } from '../../services/game-math.utils';
import { LightboxComponent, LightboxData } from '../../components/lightbox/lightbox.component';
import { NanoBotsOverlayComponent } from '../../components/nano-bots-overlay/nano-bots-overlay.component';
import { PixelProgressBarComponent } from '../../components/pixel-progress-bar/pixel-progress-bar.component';

/** Definition of a purchasable ship type in the shipyard. */
export interface ShipDef {
  /** Unique ship skill ID. */
  id: string;
  /** Display title shown on the ship card. */
  title: string;
  /** Description of the ship's passive bonuses. */
  description: string;
  /** Path to the ship's illustration image. */
  imagePath: string;
  /** Resource cost to build one unit. */
  cost: Partial<GameResources>;
  /** Dynamically computes the effect text based on the owned count. */
  effectFn: (count: number) => string;
}

/**
 * Fleet management page with a shipyard for building ships
 * and an asteroid mining mission system.
 */
@Component({
  selector: 'app-fleet',
  standalone: true,
  imports: [CommonModule, CompactNumberPipe, LightboxComponent, NanoBotsOverlayComponent, PixelProgressBarComponent],
  templateUrl: './fleet.component.html',
  styleUrl: './fleet.component.scss',
})
export class FleetComponent implements OnInit, OnDestroy {
  /** Injected game state service for resource management. */
  gameState = inject(GameStateService);

  /** Currently selected lightbox data, or null if closed. */
  selectedLightbox: LightboxData | null = null;

  /**
   * Opens the lightbox with ship details.
   * @param ship The ship whose details should be shown.
   */
  openLightbox(ship: ShipDef): void {
    this.selectedLightbox = {
      imagePath: ship.imagePath,
      title: ship.title,
      description: ship.description,
      effectText: ship.effectFn(this.getShipCount(ship.id)),
    };
  }

  /** Closes the lightbox overlay. */
  closeLightbox(): void {
    this.selectedLightbox = null;
  }

  /** Available ship types that can be built in the shipyard. */
  ships: ShipDef[] = [
    {
      id: 'kolonisierungsschiffe',
      title: 'Kolonisierungsschiff',
      description: 'Besiedelt ferne Planeten. Erhöht dauerhaft die Personal-Produktion und Kapazität.',
      imagePath: 'assets/img/fleet/kolonisierungsschiffe.png',
      cost: { eisen: 5000, nahrung: 1000, credits: 500, energie: 100 },
      effectFn: (count) => count === 0 ? 'Noch keines gebaut.' : `+${count * 10} Personal/h, +${count * 1000} Personalkapazität`,
    },
    {
      id: 'logistikschiff',
      title: 'Logistikschiff',
      description: 'Erhöht die globale Lagerkapazität aller Rohstoffe.',
      imagePath: 'assets/img/fleet/logistikschiff.png',
      cost: { eisen: 2000, credits: 500, energie: 50 },
      effectFn: (count) => count === 0 ? 'Noch keines gebaut.' : `+${count * 10}% globale Lagerkapazität`,
    },
    {
      id: 'transportschiffe',
      title: 'Transportschiff',
      description: 'Versorgt deine Planeten mit Materialien.',
      imagePath: 'assets/img/fleet/transportschiffe.png',
      cost: { eisen: 3000, silber: 1000, energie: 50 },
      effectFn: (count) => count === 0 ? 'Noch keines gebaut.' : `+${count * 200} Nahrung/h, +${count * 150} Eisen/h`,
    },
    {
      id: 'mining_ship',
      title: 'Mining Ship',
      description: 'Kann in den Asteroidengürtel geschickt werden, um Rohstoffe abzubauen.',
      imagePath: 'assets/img/fleet/mining-ship.png',
      cost: { eisen: 1000, silber: 200, energie: 20 },
      effectFn: (count) => count === 0 ? 'Noch keines gebaut.' : `${count} Schiffe für Missionen verfügbar`,
    },
  ];

  /** Defines the display metadata (name and CSS color variable) for each resource type. */
  private resourceMeta: Record<string, { name: string; colorVar: string }> = {
    eisen: { name: 'Eisen', colorVar: 'var(--color-eisen)' },
    silber: { name: 'Silber', colorVar: 'var(--color-silber)' },
    gold: { name: 'Gold', colorVar: 'var(--color-gold)' },
    xenonit: { name: 'Xenonit', colorVar: 'var(--color-xenonit)' },
    energie: { name: 'Energie', colorVar: 'var(--color-energie)' },
    credits: { name: 'Credits', colorVar: 'var(--color-credits)' },
    nahrung: { name: 'Nahrung', colorVar: 'var(--color-nahrung)' },
    personal: { name: 'Personal', colorVar: 'var(--color-personal)' },
  };

  /** Internal reference for the mission polling interval. */
  private intervalId: ReturnType<typeof setInterval> | null = null;

  /** Mission progress percentage (0–100). */
  missionProgress = signal(0);

  /** Human-readable remaining mission time. */
  missionTimeLeft = signal('');

  /** Reference to the active mission signal from the game state. */
  activeMission = this.gameState.activeMission;

  /** The randomly generated reward when the mission completes. */
  generatedReward = signal<Partial<GameResources> | null>(null);

  /** Starts polling the mission progress every 100ms. */
  ngOnInit(): void {
    this.intervalId = setInterval(() => this.updateMissionProgress(), 100);
  }

  /** Clears the mission progress polling interval. */
  ngOnDestroy(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  /**
   * Returns the number of owned ships of a given type.
   * @param id - The ship skill ID.
   * @returns The amount of ships owned by the player.
   */
  getShipCount(id: string): number {
    return this.gameState.skills()[id] || 0;
  }

  /**
   * Checks whether the player can afford a given cost.
   * @param cost - The resource cost to check.
   * @returns True if the player has enough resources.
   */
  canAfford(cost: Partial<GameResources>): boolean {
    return this.gameState.canAfford(cost);
  }

  /**
   * Starts building one unit of a ship type by deducting the cost.
   * @param ship - The ship definition to build.
   */
  async startShipBuild(ship: ShipDef): Promise<void> {
    const cost = this.getDiscountedCost(ship.cost);
    if (!this.canAfford(cost)) return;
    
    try {
      const durationMs = 60000 + (this.getShipCount(ship.id) * 10000);
      await this.gameState.startBuild(ship.id, cost, durationMs);
    } catch (e) {
      console.error('Failed to start building ship', e);
    }
  }

  /**
   * Completes the building process and increases the ship count.
   * @param ship - The ship definition.
   */
  async onShipBuildComplete(ship: ShipDef): Promise<void> {
    try {
      await this.gameState.completeBuild(ship.id);
    } catch (e) {
      console.error('Failed to complete ship build', e);
    }
  }

  getDiscountedCost(baseCost: Partial<GameResources>): Partial<GameResources> {
    const cost = calculateCost(baseCost, 1, 1, this.gameState.skills());
    const shipyardLvl = this.gameState.skills()['orbital_shipyard'] || 0;
    
    if (shipyardLvl > 0) {
      const discount = Math.min(0.75, shipyardLvl * 0.02); // 2% per level, max 75%
      for (const key of Object.keys(cost)) {
        (cost as any)[key] = Math.max(1, Math.floor((cost as any)[key] * (1 - discount)));
      }
    }
    
    return cost;
  }

  /**
   * Converts a cost object into a display-ready array with color variables.
   * @param cost - The resource cost to format.
   * @returns Array of objects containing a display name, amount, and CSS color variable.
   */
  getCostEntries(cost: Partial<GameResources>): { name: string; amount: number; colorVar: string }[] {
    return Object.entries(cost).map(([key, amount]) => ({
      name: this.resourceMeta[key].name,
      amount: amount as number,
      colorVar: this.resourceMeta[key].colorVar,
    }));
  }

  /** Total number of owned mining ships. */
  get miningShipCount(): number {
    return this.getShipCount('mining_ship');
  }

  /** Mining ships not currently deployed on a mission. */
  get availableMiningShips(): number {
    const m = this.activeMission();
    if (m && m.type === 'asteroid_mining') {
      return this.miningShipCount - m.shipCount;
    }
    return this.miningShipCount;
  }

  /** Starts an asteroid mining mission with all available mining ships. */
  async startMission(): Promise<void> {
    const available = this.availableMiningShips;
    if (available <= 0) return;
    await this.gameState.startMission('asteroid_mining', available, 60000);
    this.updateMissionProgress();
  }

  /** Updates the mission progress percentage and remaining time display. */
  updateMissionProgress(): void {
    const m = this.activeMission();
    if (!m) return this.resetMissionProgress();

    const elapsed = Date.now() - m.startTime;
    if (elapsed >= m.durationMs) {
      this.missionProgress.set(100);
      this.missionTimeLeft.set('Mission abgeschlossen!');
      
      // Generate random reward if not already generated
      if (!this.generatedReward()) {
        this.generatedReward.set(this.calculateRandomReward(m.shipCount));
      }
    } else {
      this.missionProgress.set((elapsed / m.durationMs) * 100);
      this.missionTimeLeft.set(this.formatTimeLeft(m.durationMs - elapsed));
      this.generatedReward.set(null);
    }
  }

  /**
   * Calculates a random reward based on ship count.
   * @param shipCount - The number of deployed mining ships.
   * @returns The generated reward object.
   */
  private calculateRandomReward(shipCount: number): Partial<GameResources> {
    const variance = () => 0.5 + Math.random(); // 0.5 to 1.5 multiplier
    return {
      eisen: Math.floor(shipCount * 500 * variance()),
      silber: Math.floor(shipCount * 200 * variance()),
      gold: Math.floor(shipCount * 50 * variance()),
    };
  }

  /** Resets the mission progress and time left signals to zero. */
  private resetMissionProgress(): void {
    this.missionProgress.set(0);
    this.missionTimeLeft.set('');
    this.generatedReward.set(null);
  }

  /**
   * Formats remaining milliseconds as a human-readable string.
   * @param remainingMs - Remaining time in milliseconds.
   * @returns The formatted string (e.g. "Noch 30 Sekunden").
   */
  private formatTimeLeft(remainingMs: number): string {
    const leftSec = Math.ceil(remainingMs / 1000);
    return `Noch ${leftSec} Sekunden`;
  }

  /**
   * Collects the mission reward and clears the active mission.
   * @returns A promise that resolves when the reward is collected.
   */
  async collectReward(): Promise<void> {
    const m = this.activeMission();
    const reward = this.generatedReward();
    if (!m || this.missionProgress() < 100 || !reward) return;
    
    try {
      await this.gameState.completeMission(reward);
      this.generatedReward.set(null);
    } catch (e) {
      console.error('Failed to collect reward', e);
    }
  }
}

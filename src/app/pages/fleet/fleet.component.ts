import { Component, inject, computed, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { GameStateService } from '../../services/game-state.service';
import { GameResources } from '../../services/game-state.types';

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
}

/**
 * Fleet management page with a shipyard for building ships
 * and an asteroid mining mission system.
 */
@Component({
  selector: 'app-fleet',
  standalone: true,
  imports: [CommonModule, DecimalPipe],
  templateUrl: './fleet.component.html',
  styleUrl: './fleet.component.scss',
})
export class FleetComponent implements OnInit, OnDestroy {
  /** Injected game state service for resource management. */
  gameState = inject(GameStateService);

  /** Currently selected image path for the lightbox overlay. */
  selectedImage: string | null = null;

  /**
   * Opens the image lightbox.
   * @param imagePath Path of the image to display.
   */
  openImage(imagePath: string | undefined): void {
    if (imagePath) {
      this.selectedImage = imagePath;
    }
  }

  /** Closes the image lightbox. */
  closeImage(): void {
    this.selectedImage = null;
  }

  /** Available ship types that can be built in the shipyard. */
  ships: ShipDef[] = [
    {
      id: 'kolonisierungsschiffe',
      title: 'Kolonisierungsschiff',
      description: 'Besiedelt ferne Planeten. Erhöht dauerhaft die Personal-Produktion (+10/h) und Kapazität (+1000).',
      imagePath: 'assets/img/fleet/kolonisierungsschiffe.png',
      cost: { eisen: 5000, nahrung: 1000, credits: 500, energie: 100 },
    },
    {
      id: 'logistikschiff',
      title: 'Logistikschiff',
      description: 'Erhöht die globale Lagerkapazität aller Rohstoffe um 10%.',
      imagePath: 'assets/img/fleet/logistikschiff.png',
      cost: { eisen: 2000, credits: 500, energie: 50 },
    },
    {
      id: 'transportschiffe',
      title: 'Transportschiff',
      description: 'Versorgt deine Planeten mit Materialien. Produziert passiv Nahrung (+200/h) und Eisen (+150/h).',
      imagePath: 'assets/img/fleet/transportschiffe.png',
      cost: { eisen: 3000, silber: 1000, energie: 50 },
    },
    {
      id: 'mining_ship',
      title: 'Mining Ship',
      description: 'Kann in den Asteroidengürtel geschickt werden, um Rohstoffe abzubauen.',
      imagePath: 'assets/img/fleet/mining-ship.png',
      cost: { eisen: 1000, silber: 200, energie: 20 },
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

  /** Computed mission reward based on the number of deployed ships. */
  missionReward = computed(() => {
    const m = this.activeMission();
    if (!m) return null;
    return { eisen: m.shipCount * 500, silber: m.shipCount * 200, gold: m.shipCount * 50 };
  });

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
   * Builds one unit of a ship type by upgrading the corresponding skill.
   * @param ship - The ship definition to build.
   * @returns A promise that resolves when the ship is built.
   */
  async buildShip(ship: ShipDef): Promise<void> {
    if (!this.canAfford(ship.cost)) return;
    try {
      await this.gameState.upgradeSkill(ship.id, ship.cost);
    } catch (e) {
      console.error('Failed to build ship', e);
    }
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
    } else {
      this.missionProgress.set((elapsed / m.durationMs) * 100);
      this.missionTimeLeft.set(this.formatTimeLeft(m.durationMs - elapsed));
    }
  }

  /** Resets the mission progress and time left signals to zero. */
  private resetMissionProgress(): void {
    this.missionProgress.set(0);
    this.missionTimeLeft.set('');
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
    if (!m || this.missionProgress() < 100) return;
    const reward = { eisen: m.shipCount * 500, silber: m.shipCount * 200, gold: m.shipCount * 50 };
    try {
      await this.gameState.completeMission(reward);
    } catch (e) {
      console.error('Failed to collect reward', e);
    }
  }
}

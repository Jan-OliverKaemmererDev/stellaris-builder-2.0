import { Component, inject, computed, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { GameStateService, GameResources } from '../../services/game-state.service';

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
  gameState = inject(GameStateService);

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
   */
  getShipCount(id: string): number {
    return this.gameState.skills()[id] || 0;
  }

  /**
   * Checks whether the player can afford a given cost.
   * @param cost - The resource cost to check.
   */
  canAfford(cost: Partial<GameResources>): boolean {
    return this.gameState.canAfford(cost);
  }

  /**
   * Builds one unit of a ship type by upgrading the corresponding skill.
   * @param ship - The ship definition to build.
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
   */
  getCostEntries(cost: Partial<GameResources>): { name: string; amount: number; colorVar: string }[] {
    const entries: { name: string; amount: number; colorVar: string }[] = [];
    if (cost.eisen) entries.push({ name: 'Eisen', amount: cost.eisen, colorVar: 'var(--color-eisen)' });
    if (cost.silber) entries.push({ name: 'Silber', amount: cost.silber, colorVar: 'var(--color-silber)' });
    if (cost.gold) entries.push({ name: 'Gold', amount: cost.gold, colorVar: 'var(--color-gold)' });
    if (cost.xenonit) entries.push({ name: 'Xenonit', amount: cost.xenonit, colorVar: 'var(--color-xenonit)' });
    if (cost.energie) entries.push({ name: 'Energie', amount: cost.energie, colorVar: 'var(--color-energie)' });
    if (cost.credits) entries.push({ name: 'Credits', amount: cost.credits, colorVar: 'var(--color-credits)' });
    if (cost.nahrung) entries.push({ name: 'Nahrung', amount: cost.nahrung, colorVar: 'var(--color-nahrung)' });
    if (cost.personal) entries.push({ name: 'Personal', amount: cost.personal, colorVar: 'var(--color-personal)' });
    return entries;
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
    if (!m) {
      this.missionProgress.set(0);
      this.missionTimeLeft.set('');
      return;
    }
    const elapsed = Date.now() - m.startTime;
    if (elapsed >= m.durationMs) {
      this.missionProgress.set(100);
      this.missionTimeLeft.set('Mission abgeschlossen!');
    } else {
      this.missionProgress.set((elapsed / m.durationMs) * 100);
      this.missionTimeLeft.set(this.formatTimeLeft(m.durationMs - elapsed));
    }
  }

  /**
   * Formats remaining milliseconds as a human-readable string.
   * @param remainingMs - Remaining time in milliseconds.
   */
  private formatTimeLeft(remainingMs: number): string {
    const leftSec = Math.ceil(remainingMs / 1000);
    return `Noch ${leftSec} Sekunden`;
  }

  /** Collects the mission reward and clears the active mission. */
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

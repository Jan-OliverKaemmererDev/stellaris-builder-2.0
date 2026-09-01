import { Injectable, inject, signal, OnDestroy } from '@angular/core';
import { GameStateService } from './game-state.service';
import { GameResources } from './game-state.types';
import * as MathUtils from './game-math.utils';

/**
 * Result data for an enemy raid on the player's empire.
 */
export interface EnemyAttackResult {
  /** Unique ID of the attack event. */
  id: string;
  /** Timestamp when the raid occurred. */
  timestamp: number;
  /** Whether the player successfully repelled the enemy. */
  victory: boolean;
  /** Combat rating of the attacking enemy fleet. */
  enemyPower: number;
  /** Player's own fleet combat strength. */
  playerFleetStrength: number;
  /** Planetary defense power contribution. */
  planetaryDefenseStrength: number;
  /** Percentage of resource losses mitigated by planetary defense (0-100). */
  damageReductionPercent: number;
  /** Resources plundered by the enemy (if defeated). */
  losses?: Partial<GameResources>;
  /** War loot captured by the player (if victorious). */
  loot?: Partial<GameResources>;
}

/**
 * Service that orchestrates periodic, random enemy attacks against the player.
 * Attacks only occur while online, when the enemy is active, and when the player owns battle ships.
 */
@Injectable({
  providedIn: 'root',
})
export class EnemyAttackService implements OnDestroy {
  private gameState = inject(GameStateService);

  /** Currently pending or active attack notification shown in the overlay. */
  currentAttack = signal<EnemyAttackResult | null>(null);

  /** Interval reference for periodic attack probability checks. */
  private checkInterval: ReturnType<typeof setInterval> | null = null;

  /** Minimum cooldown between enemy attacks in milliseconds (3 minutes). */
  private readonly MIN_COOLDOWN_MS = 180000;

  constructor() {
    this.startAttackLoop();
  }

  ngOnDestroy(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Starts periodic polling (every 20s) to determine if a random enemy raid triggers.
   */
  private startAttackLoop(): void {
    if (this.checkInterval) clearInterval(this.checkInterval);

    this.checkInterval = setInterval(() => {
      this.checkAndTriggerAttack();
    }, 20000);
  }

  /**
   * Checks conditions and rolls the probability for an attack event.
   */
  private checkAndTriggerAttack(): void {
    // 1. Never attack if tab is hidden/offline
    if (typeof document !== 'undefined' && document.hidden) return;

    // 2. An attack overlay is already active and unacknowledged
    if (this.currentAttack()) return;

    // 3. Enemy must be activated
    if (!this.gameState.enemyActivated()) return;

    // 4. Player must own at least one combat ship
    if (this.gameState.totalBattleShips() <= 0) return;

    // 5. Cooldown check (minimum 3 minutes)
    const lastAttack = this.gameState.lastEnemyAttack();
    const now = Date.now();
    if (lastAttack > 0 && now - lastAttack < this.MIN_COOLDOWN_MS) {
      return;
    }

    // 6. Probability roll (~8% every 20s -> triggers on average within 3 to 7 minutes)
    const roll = Math.random();
    if (roll < 0.08) {
      this.executeAttack();
    }
  }

  /**
   * Executes combat calculations for an enemy raid and notifies the player.
   */
  async executeAttack(): Promise<void> {
    const fleetStrength = this.gameState.fleetStrength();
    const defenseStrength = this.gameState.planetaryDefenseStrength();
    const totalDefense = fleetStrength + defenseStrength;

    // Enemy power scales around player fleet strength with variance
    const enemyMultiplier = 0.65 + Math.random() * 0.75; // 0.65x to 1.4x
    const enemyPower = Math.max(25, Math.floor(Math.max(fleetStrength, 50) * enemyMultiplier));

    const victory = totalDefense >= enemyPower;
    const reductionFactor = this.gameState.defenseDamageReduction();
    const damageReductionPercent = Math.round(reductionFactor * 100);

    let losses: Partial<GameResources> | undefined;
    let loot: Partial<GameResources> | undefined;

    if (victory) {
      // Small bonus victory reward
      const variance = () => 0.8 + Math.random() * 0.4;
      loot = {
        eisen: Math.floor(Math.max(50, enemyPower * 4 * variance())),
        silber: Math.floor(Math.max(20, enemyPower * 1.5 * variance())),
        gold: Math.floor(Math.max(5, enemyPower * 0.4 * variance())),
        credits: Math.floor(Math.max(30, enemyPower * 3 * variance())),
      };
      await this.gameState.applyEnemyAttackVictoryReward(loot);
    } else {
      // Fair resource loss: ~2-3% of current resources, mitigated by planetary defense
      const cur = this.gameState.resources();
      const lossMitigation = 1 - reductionFactor;

      const rawEisen = Math.floor(cur.eisen * (0.02 + Math.random() * 0.02));
      const rawSilber = Math.floor(cur.silber * (0.02 + Math.random() * 0.02));
      const rawGold = Math.floor(cur.gold * (0.015 + Math.random() * 0.015));
      const rawCredits = Math.floor(cur.credits * (0.02 + Math.random() * 0.02));

      losses = {
        eisen: Math.max(1, Math.floor(rawEisen * lossMitigation)),
        silber: Math.max(0, Math.floor(rawSilber * lossMitigation)),
        gold: Math.max(0, Math.floor(rawGold * lossMitigation)),
        credits: Math.max(1, Math.floor(rawCredits * lossMitigation)),
      };
      await this.gameState.applyEnemyAttackLosses(losses);
    }

    const attackResult: EnemyAttackResult = {
      id: 'attack_' + Date.now(),
      timestamp: Date.now(),
      victory,
      enemyPower,
      playerFleetStrength: fleetStrength,
      planetaryDefenseStrength: defenseStrength,
      damageReductionPercent,
      losses,
      loot,
    };

    this.currentAttack.set(attackResult);
  }

  /**
   * Dismisses the current attack report overlay.
   */
  dismissAttack(): void {
    this.currentAttack.set(null);
  }
}

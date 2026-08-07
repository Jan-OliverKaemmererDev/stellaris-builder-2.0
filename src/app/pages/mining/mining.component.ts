import { Component, inject } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { GameStateService } from '../../services/game-state.service';
import { GameResources } from '../../services/game-state.types';

/** A mine-specific upgrade that boosts production when the parent mine reaches a required level. */
export interface MineUpgrade {
  /** Unique upgrade skill ID. */
  id: string;
  /** Display title for the upgrade card. */
  title: string;
  /** Path to the upgrade illustration image. */
  imagePath: string;
  /** Minimum parent mine level required to unlock this upgrade. */
  requiredMineLevel: number;
  /** Base resource cost at level 0. */
  baseCost: Partial<GameResources>;
  /** Multiplicative cost scaling factor per level. */
  costMultiplier: number;
}

/** A mineable resource node with its own upgrade chain. */
export interface Mine {
  /** Unique mine skill ID. */
  id: string;
  /** Display title for the mine card. */
  title: string;
  /** Path to the mine illustration image. */
  imagePath: string;
  /** Base resource cost at level 0. */
  baseCost: Partial<GameResources>;
  /** Multiplicative cost scaling factor per level. */
  costMultiplier: number;
  /** Available production upgrades for this mine. */
  upgrades: MineUpgrade[];
  /** Prerequisite node that must reach a specific level to unlock this mine. */
  requiredNode?: { id: string; level: number };
}

/**
 * Mining page component displaying resource mines (Eisen, Silber, Gold)
 * with their respective upgrade chains for production bonuses.
 */
@Component({
  selector: 'app-mining',
  standalone: true,
  imports: [CommonModule, DecimalPipe],
  templateUrl: './mining.component.html',
  styleUrl: './mining.component.scss',
})
export class MiningComponent {
  /** Injected game state service for resource management. */
  gameState = inject(GameStateService);

  /** All available mines with their upgrade trees. */
  mines: Mine[] = [
    {
      id: 'eisenmine',
      title: 'Eisenmine',
      imagePath: 'assets/img/infrastructure/metallmine.png',
      baseCost: { eisen: 10, energie: 10 },
      costMultiplier: 1.5,
      upgrades: this.generateUpgrades('eisenmine'),
    },
    {
      id: 'silbermine',
      title: 'Silbermine',
      imagePath: 'assets/img/infrastructure/metallmine.png',
      baseCost: { eisen: 500, credits: 50, energie: 20 },
      costMultiplier: 1.6,
      requiredNode: { id: 'eisenmine', level: 10 },
      upgrades: this.generateUpgrades('silbermine'),
    },
    {
      id: 'goldmine',
      title: 'Goldmine',
      imagePath: 'assets/img/infrastructure/metallmine.png',
      baseCost: { eisen: 2000, silber: 100, energie: 50 },
      costMultiplier: 1.8,
      requiredNode: { id: 'silbermine', level: 10 },
      upgrades: this.generateUpgrades('goldmine'),
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

  /**
   * Creates the four standard production upgrades for a mine.
   * @param mineId - The parent mine's skill ID used to build upgrade IDs.
   * @returns Array of upgrades for the given mine.
   */
  generateUpgrades(mineId: string): MineUpgrade[] {
    return [
      { id: `${mineId}_roboter`, title: 'Roboter Arbeiter', imagePath: 'assets/img/infrastructure/upgrades/mining/roboter-arbeiter.png', requiredMineLevel: 5, baseCost: { credits: 100, energie: 50 }, costMultiplier: 1.4 },
      { id: `${mineId}_transport`, title: 'Transportlaster', imagePath: 'assets/img/infrastructure/upgrades/mining/transportlaster.png', requiredMineLevel: 15, baseCost: { credits: 500, eisen: 200, energie: 100 }, costMultiplier: 1.5 },
      { id: `${mineId}_ki`, title: 'KI Automation', imagePath: 'assets/img/infrastructure/upgrades/mining/ki-automation.png', requiredMineLevel: 30, baseCost: { credits: 2000, silber: 500, energie: 300 }, costMultiplier: 1.6 },
      { id: `${mineId}_zug`, title: 'Expresszug', imagePath: 'assets/img/infrastructure/upgrades/mining/hochgeschwindigkeitszug.png', requiredMineLevel: 50, baseCost: { credits: 10000, gold: 1000, energie: 1000 }, costMultiplier: 1.8 },
    ];
  }

  /**
   * Returns the current level of a skill.
   * @param id - The skill ID.
   * @returns The current level, defaulting to 0.
   */
  getSkillLevel(id: string): number {
    return this.gameState.getSkillLevel(id);
  }

  /**
   * Checks whether a mine's prerequisite is fulfilled.
   * @param mine - The mine to check.
   * @returns True if unlocked or no prerequisite exists.
   */
  isMineUnlocked(mine: Mine): boolean {
    if (!mine.requiredNode) return true;
    return this.getSkillLevel(mine.requiredNode.id) >= mine.requiredNode.level;
  }

  /**
   * Checks whether a mine upgrade is unlocked based on the parent mine's level.
   * @param mineId - The parent mine's skill ID.
   * @param upgrade - The upgrade to check.
   * @returns True if the parent mine meets the level requirement.
   */
  isUpgradeUnlocked(mineId: string, upgrade: MineUpgrade): boolean {
    return this.getSkillLevel(mineId) >= upgrade.requiredMineLevel;
  }

  /**
   * Calculates the current cost for an upgrade at the given level.
   * @param baseCost - The base resource cost.
   * @param multiplier - The cost scaling factor.
   * @param currentLevel - The current skill level.
   * @returns The calculated resource cost for the next level.
   */
  getCurrentCost(baseCost: Partial<GameResources>, multiplier: number, currentLevel: number): Partial<GameResources> {
    const cost: Partial<GameResources> = {};
    const mult = Math.pow(multiplier, currentLevel);
    for (const [key, val] of Object.entries(baseCost)) {
      if (val !== undefined) (cost as any)[key] = Math.floor(val * mult);
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

  /**
   * Checks whether the player can afford a given cost.
   * @param cost - The resource cost to check.
   * @returns True if affordable, false otherwise.
   */
  canAfford(cost: Partial<GameResources>): boolean {
    return this.gameState.canAfford(cost);
  }

  /**
   * Upgrades a skill by one level, deducting the required resources.
   * @param id - The skill ID to upgrade.
   * @param cost - The resource cost for this upgrade.
   * @returns A promise that resolves when the upgrade is processed.
   */
  async upgradeSkill(id: string, cost: Partial<GameResources>): Promise<void> {
    if (!this.canAfford(cost)) return;
    try {
      await this.gameState.upgradeSkill(id, cost);
    } catch (e) {
      console.error('Upgrade failed', e);
    }
  }
}

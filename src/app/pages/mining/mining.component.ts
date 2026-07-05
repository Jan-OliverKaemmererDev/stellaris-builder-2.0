import { Component, inject } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { GameStateService, GameResources } from '../../services/game-state.service';

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

  /**
   * Creates the four standard production upgrades for a mine.
   * @param mineId - The parent mine's skill ID used to build upgrade IDs.
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
   */
  getSkillLevel(id: string): number {
    return this.gameState.getSkillLevel(id);
  }

  /**
   * Checks whether a mine's prerequisite is fulfilled.
   * @param mine - The mine to check.
   */
  isMineUnlocked(mine: Mine): boolean {
    if (!mine.requiredNode) return true;
    return this.getSkillLevel(mine.requiredNode.id) >= mine.requiredNode.level;
  }

  /**
   * Checks whether a mine upgrade is unlocked based on the parent mine's level.
   * @param mineId - The parent mine's skill ID.
   * @param upgrade - The upgrade to check.
   */
  isUpgradeUnlocked(mineId: string, upgrade: MineUpgrade): boolean {
    return this.getSkillLevel(mineId) >= upgrade.requiredMineLevel;
  }

  /**
   * Calculates the current cost for an upgrade at the given level.
   * @param baseCost - The base resource cost.
   * @param multiplier - The cost scaling factor.
   * @param currentLevel - The current skill level.
   */
  getCurrentCost(baseCost: Partial<GameResources>, multiplier: number, currentLevel: number): Partial<GameResources> {
    const cost: Partial<GameResources> = {};
    const mult = Math.pow(multiplier, currentLevel);
    if (baseCost.eisen) cost.eisen = Math.floor(baseCost.eisen * mult);
    if (baseCost.silber) cost.silber = Math.floor(baseCost.silber * mult);
    if (baseCost.gold) cost.gold = Math.floor(baseCost.gold * mult);
    if (baseCost.xenonit) cost.xenonit = Math.floor(baseCost.xenonit * mult);
    if (baseCost.energie) cost.energie = Math.floor(baseCost.energie * mult);
    if (baseCost.credits) cost.credits = Math.floor(baseCost.credits * mult);
    if (baseCost.nahrung) cost.nahrung = Math.floor(baseCost.nahrung * mult);
    if (baseCost.personal) cost.personal = Math.floor(baseCost.personal * mult);
    return cost;
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

  /**
   * Checks whether the player can afford a given cost.
   * @param cost - The resource cost to check.
   */
  canAfford(cost: Partial<GameResources>): boolean {
    return this.gameState.canAfford(cost);
  }

  /**
   * Upgrades a skill by one level, deducting the required resources.
   * @param id - The skill ID to upgrade.
   * @param cost - The resource cost for this upgrade.
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

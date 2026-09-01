import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameStateService } from '../../services/game-state.service';
import { GameResources } from '../../services/game-state.types';
import { calcExponential, getMineBonus, calculateCost, formatNumber } from '../../services/game-math.utils';
import { LightboxComponent, LightboxData } from '../../components/lightbox/lightbox.component';
import { SkillNodeComponent, CostEntry } from '../../components/skill-node/skill-node.component';
import { NanoBotsOverlayComponent } from '../../components/nano-bots-overlay/nano-bots-overlay.component';

/** A mine-specific upgrade that boosts production when the parent mine reaches a required level. */
export interface MineUpgrade {
  /** Unique upgrade skill ID. */
  id: string;
  /** Display title for the upgrade card. */
  title: string;
  /** Path to the upgrade illustration image. */
  imagePath: string;
  /** Minimum predecessor level required to unlock this upgrade. */
  requiredLevel: number;
  /** Base resource cost at level 0. */
  baseCost: Partial<GameResources>;
  /** Multiplicative cost scaling factor per level. */
  costMultiplier: number;
  /** Short description of what this upgrade does. */
  description: string;
  /** Dynamically computes the effect text based on the current level. */
  effectFn: (level: number) => string;
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
  /** The resource type this mine produces (used for effect text). */
  resourceName: string;
  /** Base production rate per hour at level 1. */
  baseRate: number;
  /** Short description of what this mine does. */
  description: string;
  /** Dynamically computes the effect text based on the current level and skills. */
  effectFn: (level: number, skills: Record<string, number>) => string;
}

import { DragScrollDirective } from '../../directives/drag-scroll.directive';

/**
 * Mining page component displaying resource mines (Eisen, Silber, Gold)
 * with their respective upgrade chains for production bonuses.
 */
@Component({
  selector: 'app-mining',
  standalone: true,
  imports: [
    CommonModule,
    LightboxComponent,
    SkillNodeComponent,
    NanoBotsOverlayComponent,
    DragScrollDirective,
  ],
  templateUrl: './mining.component.html',
  styleUrl: './mining.component.scss',
})
export class MiningComponent {
  /** Injected game state service for resource management. */
  gameState = inject(GameStateService);

  /** Currently selected lightbox data, or null if closed. */
  selectedLightbox: LightboxData | null = null;

  /**
   * Opens the lightbox for a mine or upgrade.
   * @param item The mine or upgrade to display.
   */
  openMineLightbox(mine: Mine): void {
    this.selectedLightbox = {
      imagePath: mine.imagePath,
      title: mine.title,
      description: mine.description,
      effectText: mine.effectFn(this.getSkillLevel(mine.id), this.gameState.skills()),
    };
  }

  /**
   * Opens the lightbox for a mine upgrade.
   * @param upgrade The upgrade to display.
   */
  openUpgradeLightbox(upgrade: MineUpgrade): void {
    this.selectedLightbox = {
      imagePath: upgrade.imagePath,
      title: upgrade.title,
      description: upgrade.description,
      effectText: upgrade.effectFn(this.getSkillLevel(upgrade.id)),
    };
  }

  /** Closes the lightbox overlay. */
  closeLightbox(): void {
    this.selectedLightbox = null;
  }

  /** All available mines with their upgrade trees. All 3 mines are start buildings. */
  mines: Mine[] = [
    {
      id: 'eisenmine',
      title: 'Eisenmine',
      imagePath: 'assets/img/mining/metallmine.png',
      baseCost: { eisen: 20 },
      costMultiplier: 1.4,
      resourceName: 'Eisen',
      baseRate: 150,
      description: 'Baut Eisenerz in den Asteroiden ab.',
      effectFn: (lvl, skills) => `Produziert ${formatNumber(Math.floor(calcExponential(150, Math.max(1, lvl)) * getMineBonus('eisenmine', skills)))} Eisen/h`,
      upgrades: this.generateUpgrades('eisenmine', [5, 10, 15, 20]),
    },
    {
      id: 'silbermine',
      title: 'Silbermine',
      imagePath: 'assets/img/mining/metallmine.png',
      baseCost: { eisen: 400, credits: 50 },
      costMultiplier: 1.45,
      resourceName: 'Silber',
      baseRate: 80,
      description: 'Gewinnt wertvolles Silber aus tiefen Schächten.',
      effectFn: (lvl, skills) => `Produziert ${formatNumber(Math.floor(calcExponential(80, Math.max(1, lvl)) * getMineBonus('silbermine', skills)))} Silber/h`,
      upgrades: this.generateUpgrades('silbermine', [5, 10, 15, 20]),
    },
    {
      id: 'goldmine',
      title: 'Goldmine',
      imagePath: 'assets/img/mining/metallmine.png',
      baseCost: { eisen: 1500, silber: 100 },
      costMultiplier: 1.5,
      resourceName: 'Gold',
      baseRate: 30,
      description: 'Extrahiert seltenes Gold aus den tiefsten Minen.',
      effectFn: (lvl, skills) => `Produziert ${formatNumber(Math.floor(calcExponential(30, Math.max(1, lvl)) * getMineBonus('goldmine', skills)))} Gold/h`,
      upgrades: this.generateUpgrades('goldmine', [5, 10, 15, 20]),
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
   * Creates the four standard production upgrades for a mine with specific level requirements.
   * @param mineId - The parent mine's skill ID used to build upgrade IDs.
   * @param levels - Required parent mine levels for each upgrade step.
   * @returns Array of upgrades for the given mine.
   */
  generateUpgrades(mineId: string, levels: number[] = [5, 10, 15, 20]): MineUpgrade[] {
    return [
      { id: `${mineId}_roboter`, title: 'Roboter Arbeiter', imagePath: 'assets/img/mining/roboter-arbeiter.png', requiredLevel: levels[0], baseCost: { credits: 100 }, costMultiplier: 1.35, description: 'Automatisierte Roboter erhöhen die Abbaugeschwindigkeit.', effectFn: (lvl) => `+${Math.max(1, lvl) * 5}% Produktion` },
      { id: `${mineId}_transport`, title: 'Transportlaster', imagePath: 'assets/img/mining/transportlaster.png', requiredLevel: levels[1], baseCost: { credits: 500, eisen: 200 }, costMultiplier: 1.4, description: 'Schwere Transporter für schnelleren Materialtransport.', effectFn: (lvl) => `+${Math.max(1, lvl) * 5}% Produktion` },
      { id: `${mineId}_ki`, title: 'KI Automation', imagePath: 'assets/img/mining/ki-automation.png', requiredLevel: levels[2], baseCost: { credits: 2000, silber: 500 }, costMultiplier: 1.45, description: 'Künstliche Intelligenz optimiert den gesamten Abbau.', effectFn: (lvl) => `+${Math.max(1, lvl) * 5}% Produktion` },
      { id: `${mineId}_zug`, title: 'Expresszug', imagePath: 'assets/img/mining/hochgeschwindigkeitszug.png', requiredLevel: levels[3], baseCost: { credits: 10000, gold: 1000 }, costMultiplier: 1.5, description: 'Hochgeschwindigkeitszüge für den Materialtransport.', effectFn: (lvl) => `+${Math.max(1, lvl) * 5}% Produktion` },
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
   * Checks whether a mine upgrade is unlocked based on parent mine level.
   * @param mine - The parent mine.
   * @param index - The index of the upgrade in the array.
   * @returns True if the parent mine meets the level requirement.
   */
  isUpgradeUnlocked(mine: Mine, index: number): boolean {
    const upgrade = mine.upgrades[index];
    return this.getSkillLevel(mine.id) >= upgrade.requiredLevel;
  }

  /**
   * Returns the requirement text for a locked mine upgrade.
   */
  getUpgradeLockText(mine: Mine, index: number): string {
    const upgrade = mine.upgrades[index];
    return `${mine.title} Lvl ${upgrade.requiredLevel}`;
  }

  /**
   * Returns the requirement text for a locked mine.
   */
  getBuildingLockText(mine: Mine): string {
    if (!mine.requiredNode) return '';
    const reqMine = this.mines.find((m) => m.id === mine.requiredNode!.id);
    const title = reqMine ? reqMine.title : mine.requiredNode.id;
    return `${title} Lvl ${mine.requiredNode.level}`;
  }

  /**
   * Calculates the current cost for an upgrade at the given level.
   */
  getCurrentCost(baseCost: Partial<GameResources>, multiplier: number, currentLevel: number): Partial<GameResources> {
    return calculateCost(baseCost, multiplier, currentLevel, this.gameState.skills());
  }

  /**
   * Converts a cost object into a display-ready array with color variables.
   */
  getCostEntries(cost: Partial<GameResources>): CostEntry[] {
    return Object.entries(cost).map(([key, amount]) => ({
      name: this.resourceMeta[key].name,
      amount: amount as number,
      colorVar: this.resourceMeta[key].colorVar,
    }));
  }

  /**
   * Checks whether the player can afford a given cost.
   */
  canAfford(cost: Partial<GameResources>): boolean {
    return this.gameState.canAfford(cost);
  }

  /**
   * Upgrades a skill by one level, deducting the required resources.
   */
  async startBuild(skillId: string, cost: Partial<GameResources>, durationMs: number): Promise<void> {
    if (!this.canAfford(cost)) return;
    try {
      await this.gameState.startBuild(skillId, cost, durationMs);
    } catch (e) {
      console.error('Start build failed', e);
    }
  }

  async completeBuild(id: string): Promise<void> {
    try {
      await this.gameState.completeBuild(id);
    } catch (e) {
      console.error('Upgrade level failed', e);
    }
  }
}

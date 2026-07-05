import { Component, inject } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { GameStateService, GameResources } from '../../services/game-state.service';

/**
 * Represents a single upgrade step for a research technology.
 */
export interface ResearchUpgrade {
  /** Unique identifier for the upgrade. */
  id: string;
  /** Display title of the upgrade. */
  title: string;
  /** Path to the image asset for this upgrade. */
  imagePath: string;
  /** Required level of the parent technology to unlock this upgrade. */
  requiredLevel: number;
  /** Base cost of the upgrade at level 1. */
  baseCost: Partial<GameResources>;
  /** Multiplier for the cost per level. */
  costMultiplier: number;
}

/**
 * Represents a main research technology branch.
 */
export interface ResearchItem {
  /** Unique identifier for the technology. */
  id: string;
  /** Display title of the technology. */
  title: string;
  /** Path to the image asset for this technology. */
  imagePath: string;
  /** Base cost of the technology at level 1. */
  baseCost: Partial<GameResources>;
  /** Multiplier for the cost per level. */
  costMultiplier: number;
  /** List of sub-upgrades available for this technology. */
  upgrades: ResearchUpgrade[];
  /** Optional prerequisite technology and its required level. */
  requiredNode?: { id: string; level: number };
}

/**
 * The ResearchComponent handles the display and interaction for the technology tree,
 * allowing players to research and upgrade scientific advancements.
 */
@Component({
  selector: 'app-research',
  standalone: true,
  imports: [CommonModule, DecimalPipe],
  templateUrl: './research.component.html',
  styleUrl: './research.component.scss',
})
export class ResearchComponent {
  /** Injected game state service for resource management and skill levels. */
  gameState = inject(GameStateService);

  /** List of all research technologies and their respective upgrades. */
  items: ResearchItem[] = [
    {
      id: 'biolabor',
      title: 'Bio-Forschungslabor',
      imagePath: 'assets/img/tech/bio-forschungslabor.png',
      baseCost: { eisen: 200, nahrung: 100, energie: 100 },
      costMultiplier: 1.3,
      upgrades: [
        { id: 'bio_gen_sequenzierer', title: 'Gen-Sequenzierer', imagePath: 'assets/img/tech/bio-forschungslabor.png', requiredLevel: 5, baseCost: { credits: 200, nahrung: 150 }, costMultiplier: 1.4 },
        { id: 'bio_hydroponik', title: 'Hydroponik-Experimente', imagePath: 'assets/img/tech/bio-forschungslabor.png', requiredLevel: 15, baseCost: { credits: 800, nahrung: 500 }, costMultiplier: 1.5 },
        { id: 'bio_zell_regeneration', title: 'Zelluläre Regeneration', imagePath: 'assets/img/tech/bio-forschungslabor.png', requiredLevel: 30, baseCost: { credits: 3000, nahrung: 2000, energie: 500 }, costMultiplier: 1.7 },
        { id: 'bio_klon_vat', title: 'Klon-Vat-Technologie', imagePath: 'assets/img/tech/bio-forschungslabor.png', requiredLevel: 50, baseCost: { credits: 15000, nahrung: 8000, xenonit: 500 }, costMultiplier: 1.9 },
      ],
    },
    {
      id: 'ki_automatisierung',
      title: 'KI-Automatisierung',
      imagePath: 'assets/img/tech/ki-automatisierung.png',
      baseCost: { eisen: 1000, gold: 100, energie: 300 },
      costMultiplier: 1.5,
      requiredNode: { id: 'biolabor', level: 10 },
      upgrades: [
        { id: 'ki_neuronale_netze', title: 'Neuronale Netze', imagePath: 'assets/img/tech/ki-automatisierung.png', requiredLevel: 5, baseCost: { credits: 1000, silber: 300, energie: 500 }, costMultiplier: 1.5 },
        { id: 'ki_quanten_prozessoren', title: 'Quanten-Prozessoren', imagePath: 'assets/img/tech/ki-automatisierung.png', requiredLevel: 15, baseCost: { credits: 4000, gold: 500, energie: 1500 }, costMultiplier: 1.6 },
        { id: 'ki_selbstlernend', title: 'Selbstlernende Algorithmen', imagePath: 'assets/img/tech/ki-automatisierung.png', requiredLevel: 30, baseCost: { credits: 12000, gold: 2000, energie: 4000 }, costMultiplier: 1.8 },
        { id: 'ki_bewusstsein', title: 'Bewusstseins-Emulation', imagePath: 'assets/img/tech/ki-automatisierung.png', requiredLevel: 50, baseCost: { credits: 50000, xenonit: 1000, energie: 15000 }, costMultiplier: 2.0 },
      ],
    },
    {
      id: 'antriebstechnik',
      title: 'Antriebstechnik',
      imagePath: 'assets/img/tech/antriebstechnik.png',
      baseCost: { eisen: 2500, silber: 800, energie: 500 },
      costMultiplier: 1.6,
      requiredNode: { id: 'ki_automatisierung', level: 10 },
      upgrades: [
        { id: 'antrieb_ionen', title: 'Ionen-Triebwerke', imagePath: 'assets/img/tech/antriebstechnik.png', requiredLevel: 5, baseCost: { credits: 2000, eisen: 1000, energie: 1000 }, costMultiplier: 1.5 },
        { id: 'antrieb_plasma', title: 'Plasma-Beschleuniger', imagePath: 'assets/img/tech/antriebstechnik.png', requiredLevel: 15, baseCost: { credits: 8000, silber: 2000, energie: 3000 }, costMultiplier: 1.6 },
        { id: 'antrieb_hyperraum', title: 'Hyperraum-Kern', imagePath: 'assets/img/tech/antriebstechnik.png', requiredLevel: 30, baseCost: { credits: 25000, gold: 5000, energie: 8000 }, costMultiplier: 1.8 },
        { id: 'antrieb_sprungtor', title: 'Sprungtor-Matrix', imagePath: 'assets/img/tech/antriebstechnik.png', requiredLevel: 50, baseCost: { credits: 80000, xenonit: 5000, energie: 25000 }, costMultiplier: 2.1 },
      ],
    },
  ];

  /**
   * Retrieves the current level for a given skill or technology ID.
   * @param id The skill or technology identifier.
   * @returns The current level, defaulting to 0.
   */
  getSkillLevel(id: string): number {
    return this.gameState.getSkillLevel(id);
  }

  /**
   * Checks if a main technology is unlocked based on its prerequisite.
   * @param item The technology to check.
   * @returns True if unlocked or no prerequisite exists.
   */
  isUnlocked(item: ResearchItem): boolean {
    if (!item.requiredNode) return true;
    return this.getSkillLevel(item.requiredNode.id) >= item.requiredNode.level;
  }

  /**
   * Checks if an upgrade is unlocked based on its parent technology's level.
   * @param itemId The parent technology identifier.
   * @param upgrade The upgrade to check.
   * @returns True if the parent technology meets the level requirement.
   */
  isUpgradeUnlocked(itemId: string, upgrade: ResearchUpgrade): boolean {
    return this.getSkillLevel(itemId) >= upgrade.requiredLevel;
  }

  /**
   * Calculates the current cost for the next level of a technology or upgrade.
   * @param baseCost The base cost at level 1.
   * @param multiplier The cost scaling multiplier.
   * @param currentLevel The current level of the technology or upgrade.
   * @returns The calculated resource cost for the next level.
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
   * Transforms a Partial<GameResources> object into an array of displayable cost entries.
   * @param cost The calculated resource cost.
   * @returns Array of objects containing name, amount, and CSS color variable.
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
   * Determines if the player has enough resources to afford the given cost.
   * @param cost The required resource cost.
   * @returns True if affordable, false otherwise.
   */
  canAfford(cost: Partial<GameResources>): boolean {
    return this.gameState.canAfford(cost);
  }

  /**
   * Processes the purchase or upgrade action for a skill.
   * @param id The identifier of the technology or upgrade.
   * @param cost The cost of the transaction.
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


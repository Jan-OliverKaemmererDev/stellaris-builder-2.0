import { Component, inject } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { GameStateService, GameResources } from '../../services/game-state.service';

/**
 * Represents a single upgrade step for an energy building.
 */
export interface EnergyUpgrade {
  /** Unique identifier for the upgrade. */
  id: string;
  /** Display title of the upgrade. */
  title: string;
  /** Path to the image asset for this upgrade. */
  imagePath: string;
  /** Required level of the parent building to unlock this upgrade. */
  requiredLevel: number;
  /** Base cost of the upgrade at level 1. */
  baseCost: Partial<GameResources>;
  /** Multiplier for the cost per level. */
  costMultiplier: number;
}

/**
 * Represents a main energy production building.
 */
export interface EnergyItem {
  /** Unique identifier for the building. */
  id: string;
  /** Display title of the building. */
  title: string;
  /** Path to the image asset for this building. */
  imagePath: string;
  /** Base cost of the building at level 1. */
  baseCost: Partial<GameResources>;
  /** Multiplier for the cost per level. */
  costMultiplier: number;
  /** List of sub-upgrades available for this building. */
  upgrades: EnergyUpgrade[];
  /** Optional prerequisite building and its required level. */
  requiredNode?: { id: string; level: number };
}

/**
 * The EnergyComponent handles the display and interaction for the energy skill tree,
 * allowing players to construct and upgrade power generation facilities.
 */
@Component({
  selector: 'app-energy',
  standalone: true,
  imports: [CommonModule, DecimalPipe],
  templateUrl: './energy.component.html',
  styleUrl: './energy.component.scss',
})
export class EnergyComponent {
  /** Injected game state service for resource management and skill levels. */
  gameState = inject(GameStateService);

  /** List of all energy buildings and their respective upgrades. */
  items: EnergyItem[] = [
    {
      id: 'solarkraftwerk',
      title: 'Solarkraftwerk',
      imagePath: 'assets/img/infrastructure/solarkraftwerk.png',
      baseCost: { eisen: 15 },
      costMultiplier: 1.4,
      upgrades: [
        { id: 'solar_erweiterte_panele', title: 'Erweiterte Panele', imagePath: 'assets/img/infrastructure/upgrades/energy/solarkraftwerk/erweiterte-panele.png', requiredLevel: 5, baseCost: { credits: 100, eisen: 50 }, costMultiplier: 1.3 },
        { id: 'solar_thermische_speicher', title: 'Thermische Speicher', imagePath: 'assets/img/infrastructure/upgrades/energy/solarkraftwerk/thermische-speicher.png', requiredLevel: 15, baseCost: { credits: 300, silber: 100 }, costMultiplier: 1.4 },
        { id: 'solar_orbitalspiegel', title: 'Orbitalspiegel', imagePath: 'assets/img/infrastructure/upgrades/energy/solarkraftwerk/orbitalspiegel.png', requiredLevel: 30, baseCost: { credits: 1500, gold: 300 }, costMultiplier: 1.6 },
        { id: 'solar_dyson_schwarm', title: 'Dyson-Schwarm-Prototyp', imagePath: 'assets/img/infrastructure/upgrades/energy/solarkraftwerk/dyson-schwarm-prototyp.png', requiredLevel: 50, baseCost: { credits: 8000, xenonit: 200 }, costMultiplier: 1.8 },
      ],
    },
    {
      id: 'fusionsreaktor',
      title: 'Fusionsreaktor',
      imagePath: 'assets/img/tech/fusionsreaktoren.png',
      baseCost: { eisen: 900, silber: 200 },
      costMultiplier: 1.7,
      requiredNode: { id: 'solarkraftwerk', level: 10 },
      upgrades: [
        { id: 'fusion_plasma_eindaemmung', title: 'Plasma-Eindämmung', imagePath: 'assets/img/tech/fusionsreaktoren.png', requiredLevel: 5, baseCost: { credits: 500, eisen: 300, energie: 100 }, costMultiplier: 1.5 },
        { id: 'fusion_deuterium_anreicherung', title: 'Deuterium-Anreicherung', imagePath: 'assets/img/tech/fusionsreaktoren.png', requiredLevel: 15, baseCost: { credits: 1500, silber: 500, energie: 200 }, costMultiplier: 1.6 },
        { id: 'fusion_laser_katalysator', title: 'Laser-Katalysator', imagePath: 'assets/img/tech/fusionsreaktoren.png', requiredLevel: 30, baseCost: { credits: 5000, gold: 1000, energie: 500 }, costMultiplier: 1.7 },
        { id: 'fusion_kaltfusions_matrix', title: 'Kaltfusions-Matrix', imagePath: 'assets/img/tech/fusionsreaktoren.png', requiredLevel: 50, baseCost: { credits: 20000, xenonit: 800, energie: 1500 }, costMultiplier: 1.9 },
      ],
    },
    {
      id: 'antimaterie',
      title: 'Antimaterie-Reaktor',
      imagePath: 'assets/img/tech/fusionsreaktoren.png',
      baseCost: { eisen: 5000, xenonit: 500 },
      costMultiplier: 2.0,
      requiredNode: { id: 'fusionsreaktor', level: 10 },
      upgrades: [
        { id: 'antimaterie_positronen', title: 'Positronen-Sammler', imagePath: 'assets/img/tech/fusionsreaktoren.png', requiredLevel: 5, baseCost: { credits: 3000, eisen: 1000, energie: 500 }, costMultiplier: 1.6 },
        { id: 'antimaterie_magnetfelder', title: 'Magnetfelder', imagePath: 'assets/img/tech/fusionsreaktoren.png', requiredLevel: 15, baseCost: { credits: 8000, silber: 2000, energie: 1000 }, costMultiplier: 1.8 },
        { id: 'antimaterie_subraumkuehlung', title: 'Subraum-Kühlung', imagePath: 'assets/img/tech/fusionsreaktoren.png', requiredLevel: 30, baseCost: { credits: 25000, gold: 5000, energie: 3000 }, costMultiplier: 2.0 },
        { id: 'antimaterie_nullpunkt', title: 'Nullpunkt-Siphon', imagePath: 'assets/img/tech/fusionsreaktoren.png', requiredLevel: 50, baseCost: { credits: 100000, xenonit: 5000, energie: 10000 }, costMultiplier: 2.2 },
      ],
    },
  ];

  /**
   * Retrieves the current level for a given skill or building ID.
   * @param id The skill or building identifier.
   * @returns The current level, defaulting to 0.
   */
  getSkillLevel(id: string): number {
    return this.gameState.getSkillLevel(id);
  }

  /**
   * Checks if a main building is unlocked based on its prerequisite.
   * @param item The building to check.
   * @returns True if unlocked or no prerequisite exists.
   */
  isUnlocked(item: EnergyItem): boolean {
    if (!item.requiredNode) return true;
    return this.getSkillLevel(item.requiredNode.id) >= item.requiredNode.level;
  }

  /**
   * Checks if an upgrade is unlocked based on its parent building's level.
   * @param itemId The parent building identifier.
   * @param upgrade The upgrade to check.
   * @returns True if the parent building meets the level requirement.
   */
  isUpgradeUnlocked(itemId: string, upgrade: EnergyUpgrade): boolean {
    return this.getSkillLevel(itemId) >= upgrade.requiredLevel;
  }

  /**
   * Calculates the current cost for the next level of a building or upgrade.
   * @param baseCost The base cost at level 1.
   * @param multiplier The cost scaling multiplier.
   * @param currentLevel The current level of the building or upgrade.
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
   * @param id The identifier of the building or upgrade.
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

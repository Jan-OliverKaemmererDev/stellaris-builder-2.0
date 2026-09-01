import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameStateService } from '../../services/game-state.service';
import { GameResources } from '../../services/game-state.types';
import { calcExponential, calculateCost, formatNumber } from '../../services/game-math.utils';
import { LightboxComponent, LightboxData } from '../../components/lightbox/lightbox.component';
import { SkillNodeComponent, CostEntry } from '../../components/skill-node/skill-node.component';
import { NanoBotsOverlayComponent } from '../../components/nano-bots-overlay/nano-bots-overlay.component';

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
  /** Short description of what this upgrade does. */
  description: string;
  /** Dynamically computes the effect text based on the current level. */
  effectFn: (level: number) => string;
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
  /** Short description of what this building does. */
  description: string;
  /** Dynamically computes the effect text based on the current level. */
  effectFn: (level: number) => string;
}

import { DragScrollDirective } from '../../directives/drag-scroll.directive';

/**
 * The EnergyComponent handles the display and interaction for the energy skill tree,
 * allowing players to construct and upgrade power generation facilities.
 */
@Component({
  selector: 'app-energy',
  standalone: true,
  imports: [
    CommonModule,
    LightboxComponent,
    SkillNodeComponent,
    NanoBotsOverlayComponent,
    DragScrollDirective,
  ],
  templateUrl: './energy.component.html',
  styleUrl: './energy.component.scss',
})
export class EnergyComponent {
  /** Injected game state service for resource management and skill levels. */
  gameState = inject(GameStateService);

  /** Currently selected lightbox data, or null if closed. */
  selectedLightbox: LightboxData | null = null;

  /**
   * Opens the lightbox with information about a building or upgrade.
   * @param item The building or upgrade whose details should be shown.
   */
  openLightbox(item: EnergyItem | EnergyUpgrade): void {
    this.selectedLightbox = {
      imagePath: item.imagePath,
      title: item.title,
      description: item.description,
      effectText: item.effectFn(this.getSkillLevel(item.id)),
    };
  }

  /** Closes the lightbox overlay. */
  closeLightbox(): void {
    this.selectedLightbox = null;
  }

  /** List of all energy buildings and their respective upgrades. */
  items: EnergyItem[] = [
    {
      id: 'solarkraftwerk',
      title: 'Solarkraftwerk',
      imagePath: 'assets/img/energy/solarkraftwerk.png',
      baseCost: { eisen: 25 },
      costMultiplier: 1.4,
      description: 'Nutzt die Kraft der Sonne zur Stromerzeugung.',
      effectFn: (lvl) => `Erzeugt ${formatNumber(calcExponential(200, Math.max(1, lvl)))} Energie`,
      upgrades: [
        { id: 'solar_erweiterte_panele', title: 'Erweiterte Panele', imagePath: 'assets/img/energy/erweiterte-panele.png', requiredLevel: 5, baseCost: { credits: 100, eisen: 50 }, costMultiplier: 1.3, description: 'Verbesserte Solarzellen für höhere Energieausbeute.', effectFn: (lvl) => `+${Math.max(1, lvl) * 5}% Solarenergie` },
        { id: 'solar_thermische_speicher', title: 'Thermische Speicher', imagePath: 'assets/img/energy/thermische-speicher.png', requiredLevel: 10, baseCost: { credits: 300, silber: 100 }, costMultiplier: 1.35, description: 'Speichert überschüssige Wärme für den Nachtbetrieb.', effectFn: (lvl) => `+${Math.max(1, lvl) * 5}% Solarenergie` },
        { id: 'solar_orbitalspiegel', title: 'Orbitalspiegel', imagePath: 'assets/img/energy/orbitalspiegel.png', requiredLevel: 15, baseCost: { credits: 1500, gold: 300 }, costMultiplier: 1.4, description: 'Riesige Spiegel im Orbit bündeln Sonnenlicht auf die Panele.', effectFn: (lvl) => `+${Math.max(1, lvl) * 5}% Solarenergie` },
        { id: 'solar_dyson_schwarm', title: 'Dyson-Schwarm-Prototyp', imagePath: 'assets/img/energy/dyson-schwarm-prototyp.png', requiredLevel: 20, baseCost: { credits: 8000, xenonit: 200 }, costMultiplier: 1.5, description: 'Ein erster Prototyp einer Dyson-Sphäre umhüllt den Stern.', effectFn: (lvl) => `+${Math.max(1, lvl) * 5}% Solarenergie` },
      ],
    },
    {
      id: 'fusionsreaktor',
      title: 'Fusionsreaktor',
      imagePath: 'assets/img/energy/fusionsreaktoren.png',
      baseCost: { eisen: 900, silber: 200 },
      costMultiplier: 1.5,
      requiredNode: { id: 'solarkraftwerk', level: 5 },
      description: 'Verschmilzt Atomkerne für enorme Energiemengen.',
      effectFn: (lvl) => `Erzeugt ${formatNumber(calcExponential(800, Math.max(1, lvl)))} Energie`,
      upgrades: [
        { id: 'fusion_plasma_eindaemmung', title: 'Plasma-Eindämmung', imagePath: 'assets/img/energy/plasma-eindaemmung.png', requiredLevel: 5, baseCost: { credits: 500, eisen: 300 }, costMultiplier: 1.35, description: 'Magnetfelder halten das Fusionsplasma stabil.', effectFn: (lvl) => `+${Math.max(1, lvl) * 5}% Fusionsleistung` },
        { id: 'fusion_deuterium_anreicherung', title: 'Deuterium-Anreicherung', imagePath: 'assets/img/energy/deuterium-anreicherung.png', requiredLevel: 10, baseCost: { credits: 1500, silber: 500 }, costMultiplier: 1.4, description: 'Effizientere Aufbereitung des Fusionsbrennstoffs.', effectFn: (lvl) => `+${Math.max(1, lvl) * 5}% Fusionsleistung` },
        { id: 'fusion_laser_katalysator', title: 'Laser-Katalysator', imagePath: 'assets/img/energy/laser-katalysator.png', requiredLevel: 15, baseCost: { credits: 5000, gold: 1000 }, costMultiplier: 1.45, description: 'Laser zünden die Fusionsreaktion präziser und schneller.', effectFn: (lvl) => `+${Math.max(1, lvl) * 5}% Fusionsleistung` },
        { id: 'fusion_kaltfusions_matrix', title: 'Kaltfusions-Matrix', imagePath: 'assets/img/energy/kaltfusions-matrix.png', requiredLevel: 20, baseCost: { credits: 20000, xenonit: 800 }, costMultiplier: 1.5, description: 'Revolutionäre Fusion bei niedrigen Temperaturen.', effectFn: (lvl) => `+${Math.max(1, lvl) * 5}% Fusionsleistung` },
      ],
    },
    {
      id: 'antimaterie',
      title: 'Antimaterie-Reaktor',
      imagePath: 'assets/img/energy/antimaterie-reaktor.png',
      baseCost: { eisen: 5000, xenonit: 500 },
      costMultiplier: 1.6,
      requiredNode: { id: 'fusionsreaktor', level: 5 },
      description: 'Die ultimative Energiequelle durch Materie-Antimaterie-Annihilation.',
      effectFn: (lvl) => `Erzeugt ${formatNumber(calcExponential(3000, Math.max(1, lvl)))} Energie`,
      upgrades: [
        { id: 'antimaterie_positronen', title: 'Positronen-Sammler', imagePath: 'assets/img/energy/positronen-sammler.png', requiredLevel: 5, baseCost: { credits: 3000, eisen: 1000 }, costMultiplier: 1.4, description: 'Sammelt Positronen aus kosmischer Strahlung.', effectFn: (lvl) => `+${Math.max(1, lvl) * 5}% Antimaterieertrag` },
        { id: 'antimaterie_magnetfelder', title: 'Magnetfelder', imagePath: 'assets/img/energy/antimaterie-magnetfelder.png', requiredLevel: 10, baseCost: { credits: 8000, silber: 2000 }, costMultiplier: 1.45, description: 'Starke Magnetfelder für sichere Antimaterie-Eindämmung.', effectFn: (lvl) => `+${Math.max(1, lvl) * 5}% Antimaterieertrag` },
        { id: 'antimaterie_subraumkuehlung', title: 'Subraum-Kühlung', imagePath: 'assets/img/energy/subraumkuehlung.png', requiredLevel: 15, baseCost: { credits: 25000, gold: 5000 }, costMultiplier: 1.5, description: 'Kühlt den Reaktorkern durch Subraum-Technologie.', effectFn: (lvl) => `+${Math.max(1, lvl) * 5}% Antimaterieertrag` },
        { id: 'antimaterie_nullpunkt', title: 'Nullpunkt-Siphon', imagePath: 'assets/img/energy/nullpunkt-siphon.png', requiredLevel: 20, baseCost: { credits: 100000, xenonit: 5000 }, costMultiplier: 1.6, description: 'Zapft Energie direkt aus dem Quantenvakuum.', effectFn: (lvl) => `+${Math.max(1, lvl) * 5}% Antimaterieertrag` },
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
   * Checks if an upgrade is unlocked based on parent building level.
   * @param item The parent building.
   * @param index The index of the upgrade in the upgrades array.
   * @returns True if the parent building meets the required level.
   */
  isUpgradeUnlocked(item: EnergyItem, index: number): boolean {
    const upgrade = item.upgrades[index];
    return this.getSkillLevel(item.id) >= upgrade.requiredLevel;
  }

  /**
   * Returns the requirement text for a locked upgrade.
   */
  getUpgradeLockText(item: EnergyItem, index: number): string {
    const upgrade = item.upgrades[index];
    return `${item.title} Lvl ${upgrade.requiredLevel}`;
  }

  /**
   * Returns the requirement text for a locked main building.
   */
  getBuildingLockText(item: EnergyItem): string {
    if (!item.requiredNode) return '';
    const reqItem = this.items.find((i) => i.id === item.requiredNode!.id);
    const title = reqItem ? reqItem.title : item.requiredNode.id;
    return `${title} Lvl ${item.requiredNode.level}`;
  }

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
   * Calculates the current cost for the next level of a building or upgrade.
   * @param baseCost - The base cost at level 1.
   * @param multiplier - The cost scaling multiplier.
   * @param currentLevel - The current level of the building or upgrade.
   * @returns The calculated resource cost for the next level.
   */
  getCurrentCost(baseCost: Partial<GameResources>, multiplier: number, currentLevel: number): Partial<GameResources> {
    return calculateCost(baseCost, multiplier, currentLevel, this.gameState.skills());
  }

  /**
   * Transforms a resource cost object into an array of displayable cost entries.
   * @param cost - The calculated resource cost.
   * @returns Array of cost entries with a display name, amount, and color variable.
   */
  getCostEntries(cost: Partial<GameResources>): CostEntry[] {
    return Object.entries(cost).map(([key, amount]) => ({
      name: this.resourceMeta[key].name,
      amount: amount as number,
      colorVar: this.resourceMeta[key].colorVar,
    }));
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
   * Deducts the cost of the skill to start the building process.
   * @param cost The cost of the transaction.
   */
  async startBuild(skillId: string, cost: Partial<GameResources>, durationMs: number): Promise<void> {
    if (!this.canAfford(cost)) return;
    try {
      await this.gameState.startBuild(skillId, cost, durationMs);
    } catch (e) {
      console.error('Start build failed', e);
    }
  }

  /**
   * Completes the building process and increases the skill level.
   * @param id The identifier of the building or upgrade.
   */
  async completeBuild(id: string): Promise<void> {
    try {
      await this.gameState.completeBuild(id);
    } catch (e) {
      console.error('Upgrade level failed', e);
    }
  }
}

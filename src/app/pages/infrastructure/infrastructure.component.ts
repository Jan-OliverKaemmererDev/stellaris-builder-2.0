import { Component, inject } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { GameStateService, GameResources } from '../../services/game-state.service';

/** An infrastructure-specific upgrade that boosts production/utility when the parent building reaches a required level. */
export interface InfrastructureUpgrade {
  /** Unique upgrade skill ID. */
  id: string;
  /** Display title for the upgrade card. */
  title: string;
  /** Path to the upgrade illustration image. */
  imagePath: string;
  /** Minimum parent building level required to unlock this upgrade. */
  requiredBuildingLevel: number;
  /** Base resource cost at level 0. */
  baseCost: Partial<GameResources>;
  /** Multiplicative cost scaling factor per level. */
  costMultiplier: number;
}

/** An infrastructure building node with its own upgrade chain. */
export interface InfrastructureItem {
  /** Unique building skill ID. */
  id: string;
  /** Display title for the building card. */
  title: string;
  /** Path to the building illustration image. */
  imagePath: string;
  /** Base resource cost at level 0. */
  baseCost: Partial<GameResources>;
  /** Multiplicative cost scaling factor per level. */
  costMultiplier: number;
  /** Available upgrades for this building. */
  upgrades: InfrastructureUpgrade[];
  /** Prerequisite node that must reach a specific level to unlock this building. */
  requiredNode?: { id: string; level: number };
}

/**
 * Infrastructure page displaying the main buildings and their upgrades.
 */
@Component({
  selector: 'app-infrastructure',
  standalone: true,
  imports: [CommonModule, DecimalPipe],
  templateUrl: './infrastructure.component.html',
  styleUrl: './infrastructure.component.scss',
})
export class InfrastructureComponent {
  gameState = inject(GameStateService);

  /** All available infrastructure buildings with their upgrade trees. */
  buildings: InfrastructureItem[] = [
    {
      id: 'lager',
      title: 'Zentrallager',
      imagePath: 'assets/img/infrastructure/lager.png',
      baseCost: { eisen: 50, silber: 50, energie: 10 },
      costMultiplier: 1.4,
      upgrades: this.generateLagerUpgrades(),
    },
    {
      id: 'refinery',
      title: 'Raffinerie',
      imagePath: 'assets/img/infrastructure/refinery.png',
      baseCost: { eisen: 150, energie: 50 },
      costMultiplier: 1.4,
      requiredNode: { id: 'lager', level: 5 },
      upgrades: this.generateRefineryUpgrades(),
    },
    {
      id: 'orbital_shipyard',
      title: 'Orbitale Werft',
      imagePath: 'assets/img/infrastructure/orbital-shipyard.png',
      baseCost: { eisen: 1200, silber: 400, energie: 200 },
      costMultiplier: 1.5,
      requiredNode: { id: 'refinery', level: 10 },
      upgrades: this.generateShipyardUpgrades(),
    },
    {
      id: 'large_station',
      title: 'Große Raumstation',
      imagePath: 'assets/img/infrastructure/large-station.png',
      baseCost: { eisen: 8000, gold: 1000, energie: 500 },
      costMultiplier: 1.8,
      requiredNode: { id: 'orbital_shipyard', level: 10 },
      upgrades: this.generateStationUpgrades(),
    },
  ];

  generateLagerUpgrades(): InfrastructureUpgrade[] {
    return [
      { id: 'lager_erweiterte_ladebucht', title: 'Erweiterte Ladebucht', imagePath: 'assets/img/infrastructure/lager.png', requiredBuildingLevel: 5, baseCost: { credits: 150, eisen: 100, energie: 20 }, costMultiplier: 1.3 },
      { id: 'lager_automatisierte_logistik', title: 'Automatisierte Logistik', imagePath: 'assets/img/infrastructure/lager.png', requiredBuildingLevel: 15, baseCost: { credits: 500, silber: 200, energie: 100 }, costMultiplier: 1.4 },
      { id: 'lager_quantenspeicher', title: 'Quantenspeicher', imagePath: 'assets/img/infrastructure/lager.png', requiredBuildingLevel: 30, baseCost: { credits: 2500, gold: 500, energie: 300 }, costMultiplier: 1.6 },
      { id: 'lager_subraum_kompression', title: 'Subraum-Kompression', imagePath: 'assets/img/infrastructure/lager.png', requiredBuildingLevel: 50, baseCost: { credits: 12000, xenonit: 500, energie: 1500 }, costMultiplier: 1.8 },
    ];
  }

  generateRefineryUpgrades(): InfrastructureUpgrade[] {
    return [
      { id: 'refinery_thermalschmelze', title: 'Thermalschmelze', imagePath: 'assets/img/infrastructure/refinery.png', requiredBuildingLevel: 5, baseCost: { credits: 300, eisen: 200, energie: 100 }, costMultiplier: 1.4 },
      { id: 'refinery_katalytische_konverter', title: 'Katalytische Konverter', imagePath: 'assets/img/infrastructure/refinery.png', requiredBuildingLevel: 15, baseCost: { credits: 1000, silber: 400, energie: 300 }, costMultiplier: 1.5 },
      { id: 'refinery_plasma_extraktion', title: 'Plasma-Extraktion', imagePath: 'assets/img/infrastructure/refinery.png', requiredBuildingLevel: 30, baseCost: { credits: 4000, gold: 1000, energie: 800 }, costMultiplier: 1.7 },
      { id: 'refinery_antimaterie_anreicherung', title: 'Antimaterie-Anreicherung', imagePath: 'assets/img/infrastructure/refinery.png', requiredBuildingLevel: 50, baseCost: { credits: 20000, xenonit: 1000, energie: 3000 }, costMultiplier: 1.9 },
    ];
  }

  generateShipyardUpgrades(): InfrastructureUpgrade[] {
    return [
      { id: 'shipyard_montage_drohnen', title: 'Montage-Drohnen', imagePath: 'assets/img/infrastructure/orbital-shipyard.png', requiredBuildingLevel: 5, baseCost: { credits: 800, eisen: 500, energie: 200 }, costMultiplier: 1.4 },
      { id: 'shipyard_modulare_werftdocks', title: 'Modulare Werftdocks', imagePath: 'assets/img/infrastructure/orbital-shipyard.png', requiredBuildingLevel: 15, baseCost: { credits: 2500, silber: 800, energie: 500 }, costMultiplier: 1.5 },
      { id: 'shipyard_ki_konstruktion', title: 'KI-gestützte Konstruktion', imagePath: 'assets/img/infrastructure/orbital-shipyard.png', requiredBuildingLevel: 30, baseCost: { credits: 8000, gold: 2000, energie: 1500 }, costMultiplier: 1.7 },
      { id: 'shipyard_naniten_fabrikation', title: 'Naniten-Fabrikation', imagePath: 'assets/img/infrastructure/orbital-shipyard.png', requiredBuildingLevel: 50, baseCost: { credits: 30000, xenonit: 2000, energie: 5000 }, costMultiplier: 1.9 },
    ];
  }

  generateStationUpgrades(): InfrastructureUpgrade[] {
    return [
      { id: 'station_verstaerkte_huelle', title: 'Verstärkte Hülle', imagePath: 'assets/img/infrastructure/large-station.png', requiredBuildingLevel: 5, baseCost: { credits: 2000, eisen: 1500, energie: 500 }, costMultiplier: 1.5 },
      { id: 'station_hydroponische_gaerten', title: 'Hydroponische Gärten', imagePath: 'assets/img/infrastructure/large-station.png', requiredBuildingLevel: 15, baseCost: { credits: 5000, nahrung: 2000, energie: 1000 }, costMultiplier: 1.6 },
      { id: 'station_kommerz_hub', title: 'Kommerz-Hub', imagePath: 'assets/img/infrastructure/large-station.png', requiredBuildingLevel: 30, baseCost: { credits: 15000, gold: 5000, energie: 2500 }, costMultiplier: 1.8 },
      { id: 'station_orbitaler_verteidigungsring', title: 'Orbitaler Verteidigungsring', imagePath: 'assets/img/infrastructure/large-station.png', requiredBuildingLevel: 50, baseCost: { credits: 50000, xenonit: 5000, energie: 10000 }, costMultiplier: 2.0 },
    ];
  }

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
   * @param building The building to check.
   * @returns True if unlocked or no prerequisite exists.
   */
  isBuildingUnlocked(building: InfrastructureItem): boolean {
    if (!building.requiredNode) return true;
    return this.getSkillLevel(building.requiredNode.id) >= building.requiredNode.level;
  }

  /**
   * Checks if an upgrade is unlocked based on its parent building's level.
   * @param buildingId The parent building identifier.
   * @param upgrade The upgrade to check.
   * @returns True if the parent building meets the level requirement.
   */
  isUpgradeUnlocked(buildingId: string, upgrade: InfrastructureUpgrade): boolean {
    return this.getSkillLevel(buildingId) >= upgrade.requiredBuildingLevel;
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
// IDE Refresh

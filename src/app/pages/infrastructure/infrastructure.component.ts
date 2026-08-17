import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameStateService } from '../../services/game-state.service';
import { GameResources } from '../../services/game-state.types';
import { calcExponential, calculateCost, formatNumber } from '../../services/game-math.utils';
import { LightboxComponent, LightboxData } from '../../components/lightbox/lightbox.component';
import { SkillNodeComponent, CostEntry } from '../../components/skill-node/skill-node.component';
import { NanoBotsOverlayComponent } from '../../components/nano-bots-overlay/nano-bots-overlay.component';

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
  /** Short description of what this upgrade does. */
  description: string;
  /** Dynamically computes the effect text based on the current level. */
  effectFn: (level: number) => string;
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
  /** Short description of what this building does. */
  description: string;
  /** Dynamically computes the effect text based on the current level. */
  effectFn: (level: number) => string;
}

/**
 * Infrastructure page displaying the main buildings and their upgrades.
 */
@Component({
  selector: 'app-infrastructure',
  standalone: true,
  imports: [CommonModule, LightboxComponent, SkillNodeComponent, NanoBotsOverlayComponent],
  templateUrl: './infrastructure.component.html',
  styleUrl: './infrastructure.component.scss',
})
export class InfrastructureComponent {
  /** Injected game state service for resource management. */
  gameState = inject(GameStateService);

  /** Currently selected lightbox data, or null if closed. */
  selectedLightbox: LightboxData | null = null;

  /**
   * Opens the lightbox for a building or upgrade.
   * @param item The building or upgrade to display.
   */
  openLightbox(item: InfrastructureItem | InfrastructureUpgrade): void {
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

  /** All available infrastructure buildings with their upgrade trees. */
  buildings: InfrastructureItem[] = [
    {
      id: 'lager',
      title: 'Zentrallager',
      imagePath: 'assets/img/infrastructure/central-warehouse.png',
      baseCost: { eisen: 50, silber: 50, energie: 10 },
      costMultiplier: 1.4,
      description: 'Erweitert die Lagerkapazität aller Rohstoffe.',
      effectFn: (lvl) => `Lagermultiplikator: ×${Math.pow(1.5, Math.max(1, lvl)).toFixed(1)}`,
      upgrades: this.generateLagerUpgrades(),
    },
    {
      id: 'refinery',
      title: 'Raffinerie',
      imagePath: 'assets/img/infrastructure/refinery.png',
      baseCost: { eisen: 150, energie: 50 },
      costMultiplier: 1.4,
      requiredNode: { id: 'lager', level: 5 },
      description: 'Verarbeitet Rohstoffe zu wertvollem Xenonit.',
      effectFn: (lvl) => `Produziert ${formatNumber(calcExponential(10, Math.max(1, lvl)))} Xenonit/h`,
      upgrades: this.generateRefineryUpgrades(),
    },
    {
      id: 'orbital_shipyard',
      title: 'Orbitale Werft',
      imagePath: 'assets/img/infrastructure/orbital-shipyard.png',
      baseCost: { eisen: 1200, silber: 400, energie: 200 },
      costMultiplier: 1.5,
      requiredNode: { id: 'refinery', level: 10 },
      description: 'Ermöglicht den Bau fortschrittlicher Raumschiffe.',
      effectFn: (lvl) => `Produziert ${formatNumber(calcExponential(2, Math.max(1, lvl)))} Personal/h`,
      upgrades: this.generateShipyardUpgrades(),
    },
    {
      id: 'large_station',
      title: 'Große Raumstation',
      imagePath: 'assets/img/infrastructure/large-station.png',
      baseCost: { eisen: 8000, gold: 1000, energie: 500 },
      costMultiplier: 1.8,
      requiredNode: { id: 'orbital_shipyard', level: 10 },
      description: 'Eine massive Raumstation als Zentrum deines Imperiums.',
      effectFn: (lvl) => `Produziert ${formatNumber(calcExponential(5, Math.max(1, lvl)))} Personal/h`,
      upgrades: this.generateStationUpgrades(),
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
   * Generates upgrades available for the Zentrallager building.
   * @returns Array of upgrades.
   */
  generateLagerUpgrades(): InfrastructureUpgrade[] {
    return [
      { id: 'lager_erweiterte_ladebucht', title: 'Erweiterte Ladebucht', imagePath: 'assets/img/infrastructure/extended-loading-bay.png', requiredBuildingLevel: 5, baseCost: { credits: 150, eisen: 100, energie: 20 }, costMultiplier: 1.3, description: 'Größere Ladebuchten für schnelleren Warenumschlag.', effectFn: (lvl) => `+${Math.max(1, lvl) * 5}% Lagerkapazität` },
      { id: 'lager_automatisierte_logistik', title: 'Automatisierte Logistik', imagePath: 'assets/img/infrastructure/automated-logistics.png', requiredBuildingLevel: 15, baseCost: { credits: 500, silber: 200, energie: 100 }, costMultiplier: 1.4, description: 'Drohnen und KI optimieren die Lagerverwaltung.', effectFn: (lvl) => `+${Math.max(1, lvl) * 5}% Lagerkapazität` },
      { id: 'lager_quantenspeicher', title: 'Quantenspeicher', imagePath: 'assets/img/infrastructure/quantum-memory.png', requiredBuildingLevel: 30, baseCost: { credits: 2500, gold: 500, energie: 300 }, costMultiplier: 1.6, description: 'Speichert Materie in komprimierten Quantenzuständen.', effectFn: (lvl) => `+${Math.max(1, lvl) * 5}% Lagerkapazität` },
      { id: 'lager_subraum_kompression', title: 'Subraum-Kompression', imagePath: 'assets/img/infrastructure/subspace-compression.png', requiredBuildingLevel: 50, baseCost: { credits: 12000, xenonit: 500, energie: 1500 }, costMultiplier: 1.8, description: 'Lagert Rohstoffe in einer Subraum-Tasche.', effectFn: (lvl) => `+${Math.max(1, lvl) * 5}% Lagerkapazität` },
    ];
  }

  /**
   * Generates upgrades available for the Refinery building.
   * @returns Array of upgrades.
   */
  generateRefineryUpgrades(): InfrastructureUpgrade[] {
    return [
      { id: 'refinery_thermalschmelze', title: 'Thermalschmelze', imagePath: 'assets/img/infrastructure/refinery.png', requiredBuildingLevel: 5, baseCost: { credits: 300, eisen: 200, energie: 100 }, costMultiplier: 1.4, description: 'Schmilzt Erze bei extremen Temperaturen ein.', effectFn: (lvl) => `+${Math.max(1, lvl) * 5}% Raffinerieeffizienz` },
      { id: 'refinery_katalytische_konverter', title: 'Katalytische Konverter', imagePath: 'assets/img/infrastructure/refinery.png', requiredBuildingLevel: 15, baseCost: { credits: 1000, silber: 400, energie: 300 }, costMultiplier: 1.5, description: 'Katalysatoren beschleunigen chemische Reaktionen.', effectFn: (lvl) => `+${Math.max(1, lvl) * 5}% Raffinerieeffizienz` },
      { id: 'refinery_plasma_extraktion', title: 'Plasma-Extraktion', imagePath: 'assets/img/infrastructure/refinery.png', requiredBuildingLevel: 30, baseCost: { credits: 4000, gold: 1000, energie: 800 }, costMultiplier: 1.7, description: 'Extrahiert Xenonit mittels Plasmaströmen.', effectFn: (lvl) => `+${Math.max(1, lvl) * 5}% Raffinerieeffizienz` },
      { id: 'refinery_antimaterie_anreicherung', title: 'Antimaterie-Anreicherung', imagePath: 'assets/img/infrastructure/refinery.png', requiredBuildingLevel: 50, baseCost: { credits: 20000, xenonit: 1000, energie: 3000 }, costMultiplier: 1.9, description: 'Reichert Xenonit mit Antimaterie-Partikeln an.', effectFn: (lvl) => `+${Math.max(1, lvl) * 5}% Raffinerieeffizienz` },
    ];
  }

  /**
   * Generates upgrades available for the Shipyard building.
   * @returns Array of upgrades.
   */
  generateShipyardUpgrades(): InfrastructureUpgrade[] {
    return [
      { id: 'shipyard_montage_drohnen', title: 'Montage-Drohnen', imagePath: 'assets/img/infrastructure/orbital-shipyard.png', requiredBuildingLevel: 5, baseCost: { credits: 800, eisen: 500, energie: 200 }, costMultiplier: 1.4, description: 'Autonome Drohnen beschleunigen die Schiffsproduktion.', effectFn: (lvl) => `+${Math.max(1, lvl) * 5}% Werft-Effizienz` },
      { id: 'shipyard_modulare_werftdocks', title: 'Modulare Werftdocks', imagePath: 'assets/img/infrastructure/orbital-shipyard.png', requiredBuildingLevel: 15, baseCost: { credits: 2500, silber: 800, energie: 500 }, costMultiplier: 1.5, description: 'Modulare Docks für parallelen Schiffsbau.', effectFn: (lvl) => `+${Math.max(1, lvl) * 5}% Werft-Effizienz` },
      { id: 'shipyard_ki_konstruktion', title: 'KI-gestützte Konstruktion', imagePath: 'assets/img/infrastructure/orbital-shipyard.png', requiredBuildingLevel: 30, baseCost: { credits: 8000, gold: 2000, energie: 1500 }, costMultiplier: 1.7, description: 'KI plant und überwacht komplexe Schiffskonstruktionen.', effectFn: (lvl) => `+${Math.max(1, lvl) * 5}% Werft-Effizienz` },
      { id: 'shipyard_naniten_fabrikation', title: 'Naniten-Fabrikation', imagePath: 'assets/img/infrastructure/orbital-shipyard.png', requiredBuildingLevel: 50, baseCost: { credits: 30000, xenonit: 2000, energie: 5000 }, costMultiplier: 1.9, description: 'Naniten bauen Schiffe Atom für Atom zusammen.', effectFn: (lvl) => `+${Math.max(1, lvl) * 5}% Werft-Effizienz` },
    ];
  }

  /**
   * Generates upgrades available for the Station building.
   * @returns Array of upgrades.
   */
  generateStationUpgrades(): InfrastructureUpgrade[] {
    return [
      { id: 'station_verstaerkte_huelle', title: 'Verstärkte Hülle', imagePath: 'assets/img/infrastructure/large-station.png', requiredBuildingLevel: 5, baseCost: { credits: 2000, eisen: 1500, energie: 500 }, costMultiplier: 1.5, description: 'Verstärkte Panzerung schützt die Station vor Meteoriteneinschlägen.', effectFn: (lvl) => `+${Math.max(1, lvl) * 5}% Stationseffizienz` },
      { id: 'station_hydroponische_gaerten', title: 'Hydroponische Gärten', imagePath: 'assets/img/infrastructure/large-station.png', requiredBuildingLevel: 15, baseCost: { credits: 5000, nahrung: 2000, energie: 1000 }, costMultiplier: 1.6, description: 'Selbstversorgende Gärten für die Besatzung.', effectFn: (lvl) => `+${Math.max(1, lvl) * 5}% Stationseffizienz` },
      { id: 'station_kommerz_hub', title: 'Kommerz-Hub', imagePath: 'assets/img/infrastructure/large-station.png', requiredBuildingLevel: 30, baseCost: { credits: 15000, gold: 5000, energie: 2500 }, costMultiplier: 1.8, description: 'Ein Handelszentrum zieht Händler aus der ganzen Galaxie an.', effectFn: (lvl) => `+${Math.max(1, lvl) * 5}% Stationseffizienz` },
      { id: 'station_orbitaler_verteidigungsring', title: 'Orbitaler Verteidigungsring', imagePath: 'assets/img/infrastructure/large-station.png', requiredBuildingLevel: 50, baseCost: { credits: 50000, xenonit: 5000, energie: 10000 }, costMultiplier: 2.0, description: 'Ein Ring aus Waffenplattformen verteidigt die Station.', effectFn: (lvl) => `+${Math.max(1, lvl) * 5}% Stationseffizienz` },
    ];
  }

  getSkillLevel(id: string): number {
    return this.gameState.getSkillLevel(id);
  }

  isBuildingUnlocked(building: InfrastructureItem): boolean {
    if (!building.requiredNode) return true;
    return this.getSkillLevel(building.requiredNode.id) >= building.requiredNode.level;
  }

  isUpgradeUnlocked(buildingId: string, upgrade: InfrastructureUpgrade): boolean {
    return this.getSkillLevel(buildingId) >= upgrade.requiredBuildingLevel;
  }

  getCurrentCost(baseCost: Partial<GameResources>, multiplier: number, currentLevel: number): Partial<GameResources> {
    return calculateCost(baseCost, multiplier, currentLevel, this.gameState.skills());
  }

  getCostEntries(cost: Partial<GameResources>): CostEntry[] {
    return Object.entries(cost).map(([key, amount]) => ({
      name: this.resourceMeta[key].name,
      amount: amount as number,
      colorVar: this.resourceMeta[key].colorVar,
    }));
  }

  canAfford(cost: Partial<GameResources>): boolean {
    return this.gameState.canAfford(cost);
  }

  async upgradeSkill(id: string, cost: Partial<GameResources>): Promise<void> {
    if (!this.canAfford(cost)) return;
    try {
      await this.gameState.upgradeSkill(id, cost);
    } catch (e) {
      console.error('Upgrade failed', e);
    }
  }
}

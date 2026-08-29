import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameStateService } from '../../services/game-state.service';
import { GameResources } from '../../services/game-state.types';
import { calcExponential, calculateCost, formatNumber } from '../../services/game-math.utils';
import { LightboxComponent, LightboxData } from '../../components/lightbox/lightbox.component';
import { SkillNodeComponent, CostEntry } from '../../components/skill-node/skill-node.component';
import { NanoBotsOverlayComponent } from '../../components/nano-bots-overlay/nano-bots-overlay.component';

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
  /** Short description of what this upgrade does. */
  description: string;
  /** Dynamically computes the effect text based on the current level. */
  effectFn: (level: number) => string;
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
  /** Short description of what this technology does. */
  description: string;
  /** Dynamically computes the effect text based on the current level. */
  effectFn: (level: number) => string;
}

/**
 * The ResearchComponent handles the display and interaction for the technology tree,
 * allowing players to research and upgrade scientific advancements.
 */
import { DragScrollDirective } from '../../directives/drag-scroll.directive';

@Component({
  selector: 'app-research',
  standalone: true,
  imports: [
    CommonModule,
    LightboxComponent,
    SkillNodeComponent,
    NanoBotsOverlayComponent,
    DragScrollDirective,
  ],
  templateUrl: './research.component.html',
  styleUrl: './research.component.scss',
})
export class ResearchComponent {
  /** Injected game state service for resource management and skill levels. */
  gameState = inject(GameStateService);

  /** Currently selected lightbox data, or null if closed. */
  selectedLightbox: LightboxData | null = null;

  /**
   * Opens the lightbox for a research item or upgrade.
   */
  openLightbox(item: ResearchItem | ResearchUpgrade): void {
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

  /** List of all research technologies and their respective upgrades. */
  items: ResearchItem[] = [
    {
      id: 'biolabor',
      title: 'Bio-Forschungslabor',
      imagePath: 'assets/img/bio-forschungslabor.png',
      baseCost: { eisen: 200, nahrung: 100, energie: 100 },
      costMultiplier: 1.3,
      description: 'Erforscht biologische Technologien und optimiert die Nahrungsproduktion.',
      effectFn: (lvl) => `Produziert ${formatNumber(calcExponential(200, Math.max(1, lvl)))} Nahrung/h`,
      upgrades: [
        { id: 'bio_gen_sequenzierer', title: 'Gen-Sequenzierer', imagePath: 'assets/img/gen-sequenzierer.png', requiredLevel: 5, baseCost: { credits: 200, nahrung: 150 }, costMultiplier: 1.4, description: 'Analysiert und optimiert genetische Codes für bessere Erträge.', effectFn: (lvl) => `+${Math.max(1, lvl) * 5}% Forschungseffizienz` },
        { id: 'bio_hydroponik', title: 'Hydroponik-Experimente', imagePath: 'assets/img/hydroponik-experimente.png', requiredLevel: 10, baseCost: { credits: 800, nahrung: 500 }, costMultiplier: 1.5, description: 'Wasserkulturen für erdelosen Pflanzenanbau im All.', effectFn: (lvl) => `+${Math.max(1, lvl) * 5}% Forschungseffizienz` },
        { id: 'bio_zell_regeneration', title: 'Zelluläre Regeneration', imagePath: 'assets/img/zellulaere-regeneration.png', requiredLevel: 15, baseCost: { credits: 3000, nahrung: 2000, energie: 500 }, costMultiplier: 1.7, description: 'Regeneriert beschädigtes Gewebe auf zellulärer Ebene.', effectFn: (lvl) => `+${Math.max(1, lvl) * 5}% Forschungseffizienz` },
        { id: 'bio_klon_vat', title: 'Klon-Vat-Technologie', imagePath: 'assets/img/klon-vat-technologie.png', requiredLevel: 20, baseCost: { credits: 15000, nahrung: 8000, xenonit: 500 }, costMultiplier: 1.9, description: 'Klont Arbeitskräfte für maximale Produktivität.', effectFn: (lvl) => `+${Math.max(1, lvl) * 5}% Forschungseffizienz` },
      ],
    },
    {
      id: 'ki_automatisierung',
      title: 'KI-Automatisierung',
      imagePath: 'assets/img/ki-automatisierung.png',
      baseCost: { eisen: 1000, gold: 100, energie: 300 },
      costMultiplier: 1.5,

      description: 'Entwickelt künstliche Intelligenz zur Automatisierung aller Bereiche.',
      effectFn: (lvl) => `KI-Stufe ${Math.max(1, lvl)} – Globaler Effizienzbonus aktiv`,
      upgrades: [
        { id: 'ki_neuronale_netze', title: 'Neuronale Netze', imagePath: 'assets/img/neuronale-netze.png', requiredLevel: 8, baseCost: { credits: 1000, silber: 300, energie: 500 }, costMultiplier: 1.5, description: 'Tiefe neuronale Netze für komplexe Musterkennung.', effectFn: (lvl) => `+${Math.max(1, lvl) * 5}% KI-Effizienz` },
        { id: 'ki_quanten_prozessoren', title: 'Quanten-Prozessoren', imagePath: 'assets/img/quanten-prozessoren.png', requiredLevel: 12, baseCost: { credits: 4000, gold: 500, energie: 1500 }, costMultiplier: 1.6, description: 'Quantencomputer ermöglichen exponentiell schnellere Berechnungen.', effectFn: (lvl) => `+${Math.max(1, lvl) * 5}% KI-Effizienz` },
        { id: 'ki_selbstlernend', title: 'Selbstlernende Algorithmen', imagePath: 'assets/img/selbstlernende-algorithmen.png', requiredLevel: 18, baseCost: { credits: 12000, gold: 2000, energie: 4000 }, costMultiplier: 1.8, description: 'KI verbessert sich kontinuierlich selbst.', effectFn: (lvl) => `+${Math.max(1, lvl) * 5}% KI-Effizienz` },
        { id: 'ki_bewusstsein', title: 'Bewusstseins-Emulation', imagePath: 'assets/img/bewusstseins-emulation.png', requiredLevel: 25, baseCost: { credits: 50000, xenonit: 1000, energie: 15000 }, costMultiplier: 2.0, description: 'Eine wahrhaft bewusste KI leitet alle Operationen.', effectFn: (lvl) => `+${Math.max(1, lvl) * 5}% KI-Effizienz` },
      ],
    },
    {
      id: 'nano_bots',
      title: 'Nano-Bots',
      imagePath: 'assets/img/nano-bots.png',
      baseCost: { eisen: 1500, silber: 500, energie: 400 },
      costMultiplier: 1.5,

      description: 'Mikroskopische Bots reparieren und konstruieren autonom, wodurch die Kosten für Eisen und Silber sinken.',
      effectFn: (lvl) => `Reparatur & Bau -${Math.max(1, lvl)}% Eisen & Silber Kosten`,
      upgrades: [
        { id: 'nano_krabbler', title: 'Nano-Krabbler', imagePath: 'assets/img/nano-krabbler.png', requiredLevel: 10, baseCost: { credits: 1500, eisen: 500, energie: 600 }, costMultiplier: 1.5, description: 'Krabbler beschleunigen das Recycling und sparen Ressourcen.', effectFn: (lvl) => `Verbessert Nano-Bots Effizienz` },
        { id: 'nano_schweisser', title: 'Laser-Schweißer', imagePath: 'assets/img/laser-schweisser.png', requiredLevel: 15, baseCost: { credits: 5000, silber: 1000, energie: 2000 }, costMultiplier: 1.6, description: 'Präzisions-Laser reduzieren Materialverschnitt.', effectFn: (lvl) => `Verbessert Nano-Bots Effizienz` },
        { id: 'nano_reparatur', title: 'Autonome Reparatur', imagePath: 'assets/img/autonome-reparatur.png', requiredLevel: 20, baseCost: { credits: 15000, gold: 2000, energie: 5000 }, costMultiplier: 1.8, description: 'Ermöglicht automatische Strukturinstandsetzung.', effectFn: (lvl) => `Verbessert Nano-Bots Effizienz` },
        { id: 'nano_replikator', title: 'Nano-Replikator', imagePath: 'assets/img/nano-replikator.png', requiredLevel: 25, baseCost: { credits: 60000, xenonit: 2000, energie: 20000 }, costMultiplier: 2.0, description: 'Erlaubt den Bots sich bei Bedarf selbst zu reproduzieren.', effectFn: (lvl) => `Verbessert Nano-Bots Effizienz` },
      ],
    },
    {
      id: 'antriebstechnik',
      title: 'Antriebstechnik',
      imagePath: 'assets/img/antriebstechnik.png',
      baseCost: { eisen: 2500, silber: 800, energie: 500 },
      costMultiplier: 1.6,

      description: 'Erforscht neue Antriebstechnologien für schnellere Raumschiffe.',
      effectFn: (lvl) => `Antriebsstufe ${Math.max(1, lvl)} – Schiffsgeschwindigkeit erhöht`,
      upgrades: [
        { id: 'antrieb_ionen', title: 'Ionen-Triebwerke', imagePath: 'assets/img/ionen-triebwerke.png', requiredLevel: 10, baseCost: { credits: 2000, eisen: 1000, energie: 1000 }, costMultiplier: 1.5, description: 'Effiziente Ionentriebwerke für lange Reisen.', effectFn: (lvl) => `+${Math.max(1, lvl) * 5}% Antriebsleistung` },
        { id: 'antrieb_plasma', title: 'Plasma-Beschleuniger', imagePath: 'assets/img/plasma-beschleuniger.png', requiredLevel: 15, baseCost: { credits: 8000, silber: 2000, energie: 3000 }, costMultiplier: 1.6, description: 'Plasmastrahlen für enorme Schubkraft.', effectFn: (lvl) => `+${Math.max(1, lvl) * 5}% Antriebsleistung` },
        { id: 'antrieb_hyperraum', title: 'Hyperraum-Kern', imagePath: 'assets/img/hyperraum-kern.png', requiredLevel: 20, baseCost: { credits: 25000, gold: 5000, energie: 8000 }, costMultiplier: 1.8, description: 'Öffnet Tore in den Hyperraum für Überlichtgeschwindigkeit.', effectFn: (lvl) => `+${Math.max(1, lvl) * 5}% Antriebsleistung` },
        { id: 'antrieb_sprungtor', title: 'Sprungtor-Matrix', imagePath: 'assets/img/sprungtor-matrix.png', requiredLevel: 30, baseCost: { credits: 80000, xenonit: 5000, energie: 25000 }, costMultiplier: 2.1, description: 'Permanente Sprungtore verbinden entfernte Systeme.', effectFn: (lvl) => `+${Math.max(1, lvl) * 5}% Antriebsleistung` },
      ],
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

  getSkillLevel(id: string): number {
    return this.gameState.getSkillLevel(id);
  }

  isUnlocked(item: ResearchItem): boolean {
    if (!item.requiredNode) return true;
    return this.getSkillLevel(item.requiredNode.id) >= item.requiredNode.level;
  }

  isUpgradeUnlocked(item: ResearchItem, index: number): boolean {
    const upgrade = item.upgrades[index];
    if (index === 0) {
      return this.getSkillLevel(item.id) >= upgrade.requiredLevel;
    }
    const prevUpgrade = item.upgrades[index - 1];
    return this.getSkillLevel(prevUpgrade.id) >= upgrade.requiredLevel;
  }

  getUpgradeLockText(item: ResearchItem, index: number): string {
    const upgrade = item.upgrades[index];
    if (index === 0) {
      return `${item.title} Lvl ${upgrade.requiredLevel}`;
    }
    const prevUpgrade = item.upgrades[index - 1];
    return `${prevUpgrade.title} Lvl ${upgrade.requiredLevel}`;
  }

  getBuildingLockText(item: ResearchItem): string {
    if (!item.requiredNode) return '';
    const reqItem = this.items.find((i) => i.id === item.requiredNode!.id);
    const title = reqItem ? reqItem.title : item.requiredNode.id;
    return `${title} Lvl ${item.requiredNode.level}`;
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

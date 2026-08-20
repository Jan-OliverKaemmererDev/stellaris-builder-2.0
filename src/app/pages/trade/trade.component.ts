import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameStateService } from '../../services/game-state.service';
import { GameResources } from '../../services/game-state.types';
import { calcExponential, calculateCost, formatNumber } from '../../services/game-math.utils';
import { LightboxComponent, LightboxData } from '../../components/lightbox/lightbox.component';
import { SkillNodeComponent, CostEntry } from '../../components/skill-node/skill-node.component';
import { NanoBotsOverlayComponent } from '../../components/nano-bots-overlay/nano-bots-overlay.component';

/**
 * Represents a single upgrade step for a trade building.
 */
export interface TradeUpgrade {
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
 * Represents a main trade building.
 */
export interface TradeItem {
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
  /** List of upgrades available for this building. */
  upgrades: TradeUpgrade[];
  /** Optional prerequisite building and its required level. */
  requiredNode?: { id: string; level: number };
  /** Short description of what this building does. */
  description: string;
  /** Dynamically computes the effect text based on the current level. */
  effectFn: (level: number) => string;
}

/**
 * The TradeComponent handles the display and interaction for the trade skill tree,
 * allowing players to construct and upgrade trade-related buildings.
 */
import { DragScrollDirective } from '../../directives/drag-scroll.directive';

@Component({
  selector: 'app-trade',
  standalone: true,
  imports: [
    CommonModule,
    LightboxComponent,
    SkillNodeComponent,
    NanoBotsOverlayComponent,
    DragScrollDirective,
  ],
  templateUrl: './trade.component.html',
  styleUrl: './trade.component.scss',
})
export class TradeComponent {
  /** Injected game state service for resource management and skill levels. */
  gameState = inject(GameStateService);

  /** Currently selected lightbox data, or null if closed. */
  selectedLightbox: LightboxData | null = null;

  /**
   * Opens the lightbox for a trade building or upgrade.
   */
  openLightbox(item: TradeItem | TradeUpgrade): void {
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

  /** List of all trade buildings and their respective upgrades. */
  items: TradeItem[] = [
    {
      id: 'trading_post',
      title: 'Handelsposten',
      imagePath: 'assets/img/infrastructure/trading-post.png',
      baseCost: { eisen: 50, nahrung: 50, energie: 50 },
      costMultiplier: 1.2,
      description: 'Ein einfacher Handelsposten für den lokalen Warenaustausch.',
      effectFn: (lvl) => `Produziert ${formatNumber(calcExponential(100, Math.max(1, lvl)))} Credits/h`,
      upgrades: [
        { id: 'trade_lokale_gilden', title: 'Lokale Händlergilden', imagePath: 'assets/img/infrastructure/trading-post.png', requiredLevel: 5, baseCost: { credits: 100, nahrung: 50 }, costMultiplier: 1.3, description: 'Organisierte Gilden verbessern die Handelseffizienz.', effectFn: (lvl) => `+${Math.max(1, lvl) * 5}% Handelseffizienz` },
        { id: 'trade_frachtdrohnen', title: 'Frachtdrohnen', imagePath: 'assets/img/infrastructure/trading-post.png', requiredLevel: 10, baseCost: { credits: 400, eisen: 200 }, costMultiplier: 1.4, description: 'Autonome Drohnen liefern Waren schneller aus.', effectFn: (lvl) => `+${Math.max(1, lvl) * 5}% Handelseffizienz` },
        { id: 'trade_schwarzmarkt', title: 'Schwarzmarkt-Zugang', imagePath: 'assets/img/infrastructure/trading-post.png', requiredLevel: 15, baseCost: { credits: 1500, gold: 500 }, costMultiplier: 1.5, description: 'Zugang zu illegalen, aber lukrativen Handelsrouten.', effectFn: (lvl) => `+${Math.max(1, lvl) * 5}% Handelseffizienz` },
        { id: 'trade_planetarer_zoll', title: 'Planetarer Zoll', imagePath: 'assets/img/infrastructure/trading-post.png', requiredLevel: 20, baseCost: { credits: 5000, energie: 1000 }, costMultiplier: 1.7, description: 'Kontrollierter Zoll sichert Einnahmen bei jedem Handel.', effectFn: (lvl) => `+${Math.max(1, lvl) * 5}% Handelseffizienz` },
      ],
    },
    {
      id: 'interstellar_market',
      title: 'Interstellarer Markt',
      imagePath: 'assets/img/infrastructure/trading-post.png',
      baseCost: { eisen: 1500, gold: 200, energie: 200 },
      costMultiplier: 1.4,
      requiredNode: { id: 'trading_post', level: 10 },
      description: 'Vernetzt dein Imperium mit galaktischen Handelsnetzwerken.',
      effectFn: (lvl) => `Produziert ${formatNumber(calcExponential(400, Math.max(1, lvl)))} Credits/h`,
      upgrades: [
        { id: 'market_kartographierung', title: 'Routen-Kartographierung', imagePath: 'assets/img/infrastructure/trading-post.png', requiredLevel: 8, baseCost: { credits: 1000, energie: 500 }, costMultiplier: 1.4, description: 'Kartographierte Routen verkürzen Lieferzeiten.', effectFn: (lvl) => `+${Math.max(1, lvl) * 5}% Markt-Effizienz` },
        { id: 'market_subraum_komm', title: 'Subraum-Kommunikation', imagePath: 'assets/img/infrastructure/trading-post.png', requiredLevel: 12, baseCost: { credits: 3000, silber: 1000 }, costMultiplier: 1.5, description: 'Sofortige Kommunikation über Lichtjahre hinweg.', effectFn: (lvl) => `+${Math.max(1, lvl) * 5}% Markt-Effizienz` },
        { id: 'market_geleitschutz', title: 'Söldner-Geleitschutz', imagePath: 'assets/img/infrastructure/trading-post.png', requiredLevel: 18, baseCost: { credits: 10000, eisen: 5000 }, costMultiplier: 1.6, description: 'Bewaffneter Schutz für Handelskonvois.', effectFn: (lvl) => `+${Math.max(1, lvl) * 5}% Markt-Effizienz` },
        { id: 'market_banken', title: 'Interstellare Banken', imagePath: 'assets/img/infrastructure/trading-post.png', requiredLevel: 25, baseCost: { credits: 40000, gold: 8000 }, costMultiplier: 1.8, description: 'Banken ermöglichen galaktische Kredite und Investitionen.', effectFn: (lvl) => `+${Math.max(1, lvl) * 5}% Markt-Effizienz` },
      ],
    },
    {
      id: 'galactic_exchange',
      title: 'Galaktische Börse',
      imagePath: 'assets/img/infrastructure/trading-post.png',
      baseCost: { eisen: 5000, gold: 1500, xenonit: 1500, energie: 1000 },
      costMultiplier: 1.6,
      requiredNode: { id: 'interstellar_market', level: 15 },
      description: 'Das Finanzzentrum der Galaxie für maximale Handelsgewinne.',
      effectFn: (lvl) => `Produziert ${formatNumber(calcExponential(1500, Math.max(1, lvl)))} Credits/h`,
      upgrades: [
        { id: 'exchange_hft', title: 'Hochfrequenz-Trading', imagePath: 'assets/img/infrastructure/trading-post.png', requiredLevel: 10, baseCost: { credits: 5000, energie: 2000 }, costMultiplier: 1.5, description: 'Algorithmen handeln in Nanosekunden.', effectFn: (lvl) => `+${Math.max(1, lvl) * 5}% Börsen-Effizienz` },
        { id: 'exchange_megakonzern', title: 'Megakonzern-Partnerschaften', imagePath: 'assets/img/infrastructure/trading-post.png', requiredLevel: 15, baseCost: { credits: 20000, gold: 5000 }, costMultiplier: 1.6, description: 'Exklusive Partnerschaften mit galaktischen Megakonzernen.', effectFn: (lvl) => `+${Math.max(1, lvl) * 5}% Börsen-Effizienz` },
        { id: 'exchange_monopol', title: 'Monopol-Lizenzen', imagePath: 'assets/img/infrastructure/trading-post.png', requiredLevel: 22, baseCost: { credits: 80000, xenonit: 3000 }, costMultiplier: 1.8, description: 'Exklusive Handelsrechte für bestimmte Sektoren.', effectFn: (lvl) => `+${Math.max(1, lvl) * 5}% Börsen-Effizienz` },
        { id: 'exchange_waehrungsamt', title: 'Galaktisches Währungsamt', imagePath: 'assets/img/infrastructure/trading-post.png', requiredLevel: 30, baseCost: { credits: 250000, xenonit: 10000 }, costMultiplier: 2.0, description: 'Kontrolliere die galaktische Währung.', effectFn: (lvl) => `+${Math.max(1, lvl) * 5}% Börsen-Effizienz` },
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

  isUnlocked(item: TradeItem): boolean {
    if (!item.requiredNode) return true;
    return this.getSkillLevel(item.requiredNode.id) >= item.requiredNode.level;
  }

  isUpgradeUnlocked(item: TradeItem, index: number): boolean {
    const upgrade = item.upgrades[index];
    if (index === 0) {
      return this.getSkillLevel(item.id) >= upgrade.requiredLevel;
    }
    const prevUpgrade = item.upgrades[index - 1];
    return this.getSkillLevel(prevUpgrade.id) >= upgrade.requiredLevel;
  }

  getUpgradeLockText(item: TradeItem, index: number): string {
    const upgrade = item.upgrades[index];
    if (index === 0) {
      return `${item.title} Lvl ${upgrade.requiredLevel}`;
    }
    const prevUpgrade = item.upgrades[index - 1];
    return `${prevUpgrade.title} Lvl ${upgrade.requiredLevel}`;
  }

  getBuildingLockText(item: TradeItem): string {
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

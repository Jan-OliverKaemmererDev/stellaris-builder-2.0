import { Component, inject } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { GameStateService, GameResources } from '../../services/game-state.service';

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
}

/**
 * The TradeComponent handles the display and interaction for the trade skill tree,
 * allowing players to construct and upgrade trade-related buildings.
 */
@Component({
  selector: 'app-trade',
  standalone: true,
  imports: [CommonModule, DecimalPipe],
  templateUrl: './trade.component.html',
  styleUrl: './trade.component.scss',
})
export class TradeComponent {
  /** Injected game state service for resource management and skill levels. */
  gameState = inject(GameStateService);

  /** List of all trade buildings and their respective upgrades. */
  items: TradeItem[] = [
    {
      id: 'trading_post',
      title: 'Handelsposten',
      imagePath: 'assets/img/infrastructure/trading-post.png',
      baseCost: { eisen: 50, nahrung: 50, energie: 50 },
      costMultiplier: 1.2,
      upgrades: [
        { id: 'trade_lokale_gilden', title: 'Lokale Händlergilden', imagePath: 'assets/img/infrastructure/trading-post.png', requiredLevel: 5, baseCost: { credits: 100, nahrung: 50 }, costMultiplier: 1.3 },
        { id: 'trade_frachtdrohnen', title: 'Frachtdrohnen', imagePath: 'assets/img/infrastructure/trading-post.png', requiredLevel: 15, baseCost: { credits: 400, eisen: 200 }, costMultiplier: 1.4 },
        { id: 'trade_schwarzmarkt', title: 'Schwarzmarkt-Zugang', imagePath: 'assets/img/infrastructure/trading-post.png', requiredLevel: 30, baseCost: { credits: 1500, gold: 500 }, costMultiplier: 1.5 },
        { id: 'trade_planetarer_zoll', title: 'Planetarer Zoll', imagePath: 'assets/img/infrastructure/trading-post.png', requiredLevel: 50, baseCost: { credits: 5000, energie: 1000 }, costMultiplier: 1.7 },
      ],
    },
    {
      id: 'interstellar_market',
      title: 'Interstellarer Markt',
      imagePath: 'assets/img/infrastructure/trading-post.png',
      baseCost: { eisen: 1500, gold: 200, energie: 200 },
      costMultiplier: 1.4,
      requiredNode: { id: 'trading_post', level: 10 },
      upgrades: [
        { id: 'market_kartographierung', title: 'Routen-Kartographierung', imagePath: 'assets/img/infrastructure/trading-post.png', requiredLevel: 5, baseCost: { credits: 1000, energie: 500 }, costMultiplier: 1.4 },
        { id: 'market_subraum_komm', title: 'Subraum-Kommunikation', imagePath: 'assets/img/infrastructure/trading-post.png', requiredLevel: 15, baseCost: { credits: 3000, silber: 1000 }, costMultiplier: 1.5 },
        { id: 'market_geleitschutz', title: 'Söldner-Geleitschutz', imagePath: 'assets/img/infrastructure/trading-post.png', requiredLevel: 30, baseCost: { credits: 10000, eisen: 5000 }, costMultiplier: 1.6 },
        { id: 'market_banken', title: 'Interstellare Banken', imagePath: 'assets/img/infrastructure/trading-post.png', requiredLevel: 50, baseCost: { credits: 40000, gold: 8000 }, costMultiplier: 1.8 },
      ],
    },
    {
      id: 'galactic_exchange',
      title: 'Galaktische Börse',
      imagePath: 'assets/img/infrastructure/trading-post.png',
      baseCost: { eisen: 5000, gold: 1500, xenonit: 1500, energie: 1000 },
      costMultiplier: 1.6,
      requiredNode: { id: 'interstellar_market', level: 10 },
      upgrades: [
        { id: 'exchange_hft', title: 'Hochfrequenz-Trading', imagePath: 'assets/img/infrastructure/trading-post.png', requiredLevel: 5, baseCost: { credits: 5000, energie: 2000 }, costMultiplier: 1.5 },
        { id: 'exchange_megakonzern', title: 'Megakonzern-Partnerschaften', imagePath: 'assets/img/infrastructure/trading-post.png', requiredLevel: 15, baseCost: { credits: 20000, gold: 5000 }, costMultiplier: 1.6 },
        { id: 'exchange_monopol', title: 'Monopol-Lizenzen', imagePath: 'assets/img/infrastructure/trading-post.png', requiredLevel: 30, baseCost: { credits: 80000, xenonit: 3000 }, costMultiplier: 1.8 },
        { id: 'exchange_waehrungsamt', title: 'Galaktisches Währungsamt', imagePath: 'assets/img/infrastructure/trading-post.png', requiredLevel: 50, baseCost: { credits: 250000, xenonit: 10000 }, costMultiplier: 2.0 },
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
  isUnlocked(item: TradeItem): boolean {
    if (!item.requiredNode) return true;
    return this.getSkillLevel(item.requiredNode.id) >= item.requiredNode.level;
  }

  /**
   * Checks if an upgrade is unlocked based on its parent building's level.
   * @param itemId The parent building identifier.
   * @param upgrade The upgrade to check.
   * @returns True if the parent building meets the level requirement.
   */
  isUpgradeUnlocked(itemId: string, upgrade: TradeUpgrade): boolean {
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


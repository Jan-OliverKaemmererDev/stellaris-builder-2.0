import { Component, Input, inject } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { GameStateService, GameResources } from '../../services/game-state.service';

/**
 * Definition of a single skill node in the technology tree.
 */
export interface SkillNode {
  /** Unique skill identifier matching the Firestore skills record key. */
  id: string;
  /** Display title shown on the node card. */
  title: string;
  /** Path to the node's illustration image. */
  imagePath: string;
  /** Base resource cost at level 0; scales with `costMultiplier` per level. */
  baseCost: Partial<GameResources>;
  /** Multiplicative cost scaling factor per level (e.g., 1.2 = +20% per level). */
  costMultiplier: number;
  /** Optional maximum level cap for this skill. */
  maxLevel?: number;
  /** Prerequisite node that must reach a specific level before this node unlocks. */
  requiredNode?: { id: string; level: number };
}

/**
 * Reusable horizontal skill tree component.
 * Renders a chain of skill nodes with connecting lines, level display,
 * cost breakdown, and upgrade buttons.
 */
@Component({
  selector: 'app-skilltree',
  standalone: true,
  imports: [CommonModule, DecimalPipe],
  templateUrl: './skilltree.component.html',
  styleUrl: './skilltree.component.scss',
})
export class SkilltreeComponent {
  /** The list of skill nodes to display in the tree. */
  @Input() nodes: SkillNode[] = [];

  /** The display title shown above the skill tree scroll area. */
  @Input() title: string = 'Skilltree';

  /** Internal reference to the game state service. */
  private gameState = inject(GameStateService);

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
   * Retrieves the current level of a specific skill from the game state.
   * @param id - The unique identifier of the skill.
   * @returns The current level of the skill.
   */
  getSkillLevel(id: string): number {
    return this.gameState.getSkillLevel(id);
  }

  /**
   * Checks whether a node's prerequisite conditions are fulfilled.
   * @param node - The skill node to verify.
   * @returns True if the node is unlocked, false otherwise.
   */
  isUnlocked(node: SkillNode): boolean {
    if (!node.requiredNode) return true;
    return this.getSkillLevel(node.requiredNode.id) >= node.requiredNode.level;
  }

  /**
   * Calculates the current upgrade cost by applying the level multiplier to the base cost.
   * @param node - The skill node to calculate costs for.
   * @returns An object containing the computed resource costs.
   */
  getCurrentCost(node: SkillNode): Partial<GameResources> {
    const level = this.getSkillLevel(node.id);
    const multiplier = Math.pow(node.costMultiplier, level);
    const cost: Partial<GameResources> = {};
    const keys = Object.keys(node.baseCost) as (keyof GameResources)[];
    
    for (const key of keys) {
      if (node.baseCost[key] !== undefined) {
        cost[key] = Math.floor(node.baseCost[key]! * multiplier);
      }
    }
    return cost;
  }

  /**
   * Verifies whether the player has enough resources to afford the current upgrade cost.
   * @param node - The skill node to check.
   * @returns True if the player can afford the upgrade, false otherwise.
   */
  canAfford(node: SkillNode): boolean {
    return this.gameState.canAfford(this.getCurrentCost(node));
  }

  /**
   * Attempts to upgrade a skill node by one level.
   * @param node - The skill node to upgrade.
   * @returns A promise that resolves when the upgrade transaction completes.
   */
  async upgrade(node: SkillNode): Promise<void> {
    if (!this.isUnlocked(node) || !this.canAfford(node)) return;
    try {
      await this.gameState.upgradeSkill(node.id, this.getCurrentCost(node));
    } catch (e) {
      console.error('Upgrade failed', e);
    }
  }

  /**
   * Converts a cost object into a display-ready array of formatted entries.
   * @param node - The skill node whose costs should be formatted.
   * @returns Array of cost objects with a display name, amount, and color variable.
   */
  getCostEntries(node: SkillNode): { name: string; amount: number; colorVar: string }[] {
    const cost = this.getCurrentCost(node);
    return Object.entries(cost).map(([key, amount]) => ({
      name: this.resourceMeta[key].name,
      amount: amount as number,
      colorVar: this.resourceMeta[key].colorVar,
    }));
  }
}

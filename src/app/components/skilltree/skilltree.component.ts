import { Component, Input, inject } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { GameStateService, GameResources } from '../../services/game-state.service';

/** Definition of a single skill node in the technology tree. */
export interface SkillNode {
  /** Unique skill identifier matching the Firestore skills record key. */
  id: string;
  /** Display title shown on the node card. */
  title: string;
  /** Path to the node's illustration image. */
  imagePath: string;
  /** Base resource cost at level 0; scales with `costMultiplier` per level. */
  baseCost: Partial<GameResources>;
  /** Multiplicative cost scaling factor per level (e.g. 1.2 = +20%/level). */
  costMultiplier: number;
  /** Optional maximum level cap. */
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
  /** The skill nodes to display in the tree. */
  @Input() nodes: SkillNode[] = [];

  /** The tree's display title shown above the scroll area. */
  @Input() title: string = 'Skilltree';

  private gameState = inject(GameStateService);

  /**
   * Returns the current level of a skill.
   * @param id - The skill ID to look up.
   */
  getSkillLevel(id: string): number {
    return this.gameState.getSkillLevel(id);
  }

  /**
   * Checks whether a node's prerequisite is fulfilled.
   * @param node - The skill node to check.
   */
  isUnlocked(node: SkillNode): boolean {
    if (!node.requiredNode) return true;
    return this.getSkillLevel(node.requiredNode.id) >= node.requiredNode.level;
  }

  /**
   * Calculates the current upgrade cost by applying the cost multiplier to the base cost.
   * @param node - The skill node to calculate for.
   */
  getCurrentCost(node: SkillNode): Partial<GameResources> {
    const level = this.getSkillLevel(node.id);
    const multiplier = Math.pow(node.costMultiplier, level);
    const cost: Partial<GameResources> = {};
    if (node.baseCost.eisen) cost.eisen = Math.floor(node.baseCost.eisen * multiplier);
    if (node.baseCost.silber) cost.silber = Math.floor(node.baseCost.silber * multiplier);
    if (node.baseCost.gold) cost.gold = Math.floor(node.baseCost.gold * multiplier);
    if (node.baseCost.xenonit) cost.xenonit = Math.floor(node.baseCost.xenonit * multiplier);
    if (node.baseCost.energie) cost.energie = Math.floor(node.baseCost.energie * multiplier);
    if (node.baseCost.credits) cost.credits = Math.floor(node.baseCost.credits * multiplier);
    if (node.baseCost.nahrung) cost.nahrung = Math.floor(node.baseCost.nahrung * multiplier);
    if (node.baseCost.personal) cost.personal = Math.floor(node.baseCost.personal * multiplier);
    return cost;
  }

  /**
   * Checks whether the player can afford the current upgrade cost.
   * @param node - The skill node to check.
   */
  canAfford(node: SkillNode): boolean {
    return this.gameState.canAfford(this.getCurrentCost(node));
  }

  /**
   * Attempts to upgrade a skill node by one level.
   * @param node - The skill node to upgrade.
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
   * Converts a cost object into a display-ready array of entries with colors.
   * @param node - The skill node whose cost to format.
   */
  getCostEntries(node: SkillNode): { name: string; amount: number; colorVar: string }[] {
    const cost = this.getCurrentCost(node);
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
}

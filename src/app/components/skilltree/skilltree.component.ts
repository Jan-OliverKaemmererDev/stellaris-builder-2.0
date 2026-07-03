import { Component, Input, inject } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { GameStateService, GameResources } from '../../services/game-state.service';

export interface SkillNode {
  id: string;
  title: string;
  imagePath: string;
  baseCost: Partial<GameResources>;
  costMultiplier: number; // e.g. 1.2
  maxLevel?: number;
  requiredNode?: { id: string; level: number };
}

@Component({
  selector: 'app-skilltree',
  standalone: true,
  imports: [CommonModule, DecimalPipe],
  templateUrl: './skilltree.component.html',
  styleUrl: './skilltree.component.scss'
})
export class SkilltreeComponent {
  @Input() nodes: SkillNode[] = [];
  @Input() title: string = 'Skilltree';
  
  private gameState = inject(GameStateService);

  getSkillLevel(id: string): number {
    return this.gameState.getSkillLevel(id);
  }

  isUnlocked(node: SkillNode): boolean {
    if (!node.requiredNode) return true;
    return this.getSkillLevel(node.requiredNode.id) >= node.requiredNode.level;
  }

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

  canAfford(node: SkillNode): boolean {
    return this.gameState.canAfford(this.getCurrentCost(node));
  }

  async upgrade(node: SkillNode) {
    if (!this.isUnlocked(node) || !this.canAfford(node)) return;
    
    try {
      await this.gameState.upgradeSkill(node.id, this.getCurrentCost(node));
    } catch (e) {
      console.error('Upgrade failed', e);
    }
  }

  getCostEntries(node: SkillNode): { name: string; amount: number; colorVar: string }[] {
    const cost = this.getCurrentCost(node);
    const entries = [];
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

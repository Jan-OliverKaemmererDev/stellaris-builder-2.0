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
    if (node.baseCost.minerals) cost.minerals = Math.floor(node.baseCost.minerals * multiplier);
    if (node.baseCost.gas) cost.gas = Math.floor(node.baseCost.gas * multiplier);
    if (node.baseCost.crystals) cost.crystals = Math.floor(node.baseCost.crystals * multiplier);
    if (node.baseCost.food) cost.food = Math.floor(node.baseCost.food * multiplier);
    
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
    if (cost.minerals) entries.push({ name: 'Metall', amount: cost.minerals, colorVar: 'var(--color-minerals)' });
    if (cost.gas) entries.push({ name: 'Gas', amount: cost.gas, colorVar: 'var(--color-gas)' });
    if (cost.crystals) entries.push({ name: 'Kristalle', amount: cost.crystals, colorVar: 'var(--color-crystals)' });
    if (cost.food) entries.push({ name: 'Nahrung', amount: cost.food, colorVar: 'var(--color-food)' });
    return entries;
  }
}

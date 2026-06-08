import { Component } from '@angular/core';
import { SkilltreeComponent, SkillNode } from '../../components/skilltree/skilltree.component';

@Component({
  selector: 'app-mining',
  standalone: true,
  imports: [SkilltreeComponent],
  template: `<app-skilltree title="Rohstoffabbau" [nodes]="nodes"></app-skilltree>`
})
export class MiningComponent {
  nodes: SkillNode[] = [
    {
      id: 'metallmine',
      title: 'Metallmine',
      imagePath: 'assets/img/infrastructure/metallmine.png',
      baseCost: { minerals: 10 },
      costMultiplier: 1.5
    },
    {
      id: 'silbermine',
      title: 'Silbermine',
      imagePath: 'assets/img/infrastructure/metallmine.png', // Placeholder
      baseCost: { minerals: 500 },
      costMultiplier: 1.6,
      requiredNode: { id: 'metallmine', level: 10 }
    },
    {
      id: 'goldmine',
      title: 'Goldmine',
      imagePath: 'assets/img/infrastructure/metallmine.png', // Placeholder
      baseCost: { minerals: 2000, gas: 100 },
      costMultiplier: 1.8,
      requiredNode: { id: 'silbermine', level: 10 }
    }
  ];
}

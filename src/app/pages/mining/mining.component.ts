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
      id: 'eisenmine',
      title: 'Eisenmine',
      imagePath: 'assets/img/infrastructure/metallmine.png',
      baseCost: { eisen: 10, energie: 10 },
      costMultiplier: 1.5
    },
    {
      id: 'silbermine',
      title: 'Silbermine',
      imagePath: 'assets/img/infrastructure/metallmine.png', // Placeholder
      baseCost: { eisen: 500, credits: 50, energie: 20 },
      costMultiplier: 1.6,
      requiredNode: { id: 'eisenmine', level: 10 }
    },
    {
      id: 'goldmine',
      title: 'Goldmine',
      imagePath: 'assets/img/infrastructure/metallmine.png', // Placeholder
      baseCost: { eisen: 2000, silber: 100, energie: 50 },
      costMultiplier: 1.8,
      requiredNode: { id: 'silbermine', level: 10 }
    }
  ];
}

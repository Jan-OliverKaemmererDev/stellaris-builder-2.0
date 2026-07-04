import { Component } from '@angular/core';
import { SkilltreeComponent, SkillNode } from '../../components/skilltree/skilltree.component';

@Component({
  selector: 'app-research',
  standalone: true,
  imports: [SkilltreeComponent],
  template: `<app-skilltree title="Forschungszentrum" [nodes]="nodes"></app-skilltree>`
})
export class ResearchComponent {
  nodes: SkillNode[] = [
    {
      id: 'biolabor',
      title: 'Bio-Forschungslabor',
      imagePath: 'assets/img/tech/bio-forschungslabor.png',
      baseCost: { eisen: 200, nahrung: 100, energie: 100 },
      costMultiplier: 1.3
    },
    {
      id: 'ki_automatisierung',
      title: 'KI-Automatisierung',
      imagePath: 'assets/img/tech/ki-automatisierung.png',
      baseCost: { eisen: 1000, gold: 100, energie: 300 },
      costMultiplier: 1.5,
      requiredNode: { id: 'biolabor', level: 10 }
    },
    {
      id: 'antriebstechnik',
      title: 'Antriebstechnik',
      imagePath: 'assets/img/tech/antriebstechnik.png',
      baseCost: { eisen: 2500, silber: 800, energie: 500 },
      costMultiplier: 1.6,
      requiredNode: { id: 'ki_automatisierung', level: 10 }
    }
  ];
}

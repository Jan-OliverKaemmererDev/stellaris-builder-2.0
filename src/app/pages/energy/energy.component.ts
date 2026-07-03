import { Component } from '@angular/core';
import { SkilltreeComponent, SkillNode } from '../../components/skilltree/skilltree.component';

@Component({
  selector: 'app-energy',
  standalone: true,
  imports: [SkilltreeComponent],
  template: `<app-skilltree title="Energie" [nodes]="nodes"></app-skilltree>`
})
export class EnergyComponent {
  nodes: SkillNode[] = [
    {
      id: 'solarkraftwerk',
      title: 'Solarkraftwerk',
      imagePath: 'assets/img/infrastructure/solarkraftwerk.png',
      baseCost: { eisen: 15 },
      costMultiplier: 1.4
    },
    {
      id: 'fusionsreaktor',
      title: 'Fusionsreaktor',
      imagePath: 'assets/img/tech/fusionsreaktoren.png',
      baseCost: { eisen: 900, silber: 200 },
      costMultiplier: 1.7,
      requiredNode: { id: 'solarkraftwerk', level: 10 }
    },
    {
      id: 'antimaterie',
      title: 'Antimaterie-Reaktor',
      imagePath: 'assets/img/tech/fusionsreaktoren.png', // Placeholder
      baseCost: { eisen: 5000, xenonit: 500 },
      costMultiplier: 2.0,
      requiredNode: { id: 'fusionsreaktor', level: 10 }
    }
  ];
}

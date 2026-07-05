import { Component } from '@angular/core';
import { SkilltreeComponent, SkillNode } from '../../components/skilltree/skilltree.component';

/**
 * Energy page displaying the power plant skill tree.
 * Includes Solar, Fusion, and Antimatter reactor upgrades.
 */
@Component({
  selector: 'app-energy',
  standalone: true,
  imports: [SkilltreeComponent],
  template: `<app-skilltree title="Energie" [nodes]="nodes"></app-skilltree>`,
})
export class EnergyComponent {
  /** Power plant skill nodes ordered by unlock progression. */
  nodes: SkillNode[] = [
    {
      id: 'solarkraftwerk',
      title: 'Solarkraftwerk',
      imagePath: 'assets/img/infrastructure/solarkraftwerk.png',
      baseCost: { eisen: 15 },
      costMultiplier: 1.4,
    },
    {
      id: 'fusionsreaktor',
      title: 'Fusionsreaktor',
      imagePath: 'assets/img/tech/fusionsreaktoren.png',
      baseCost: { eisen: 900, silber: 200 },
      costMultiplier: 1.7,
      requiredNode: { id: 'solarkraftwerk', level: 10 },
    },
    {
      id: 'antimaterie',
      title: 'Antimaterie-Reaktor',
      imagePath: 'assets/img/tech/fusionsreaktoren.png',
      baseCost: { eisen: 5000, xenonit: 500 },
      costMultiplier: 2.0,
      requiredNode: { id: 'fusionsreaktor', level: 10 },
    },
  ];
}

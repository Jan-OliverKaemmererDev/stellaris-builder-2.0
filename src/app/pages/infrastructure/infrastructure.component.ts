import { Component } from '@angular/core';
import { SkilltreeComponent, SkillNode } from '../../components/skilltree/skilltree.component';

@Component({
  selector: 'app-infrastructure',
  standalone: true,
  imports: [SkilltreeComponent],
  template: `<app-skilltree title="Infrastruktur" [nodes]="nodes"></app-skilltree>`
})
export class InfrastructureComponent {
  nodes: SkillNode[] = [
    {
      id: 'lager',
      title: 'Zentrallager',
      imagePath: 'assets/img/infrastructure/lager.png', // Placeholder
      baseCost: { eisen: 50, silber: 50 },
      costMultiplier: 1.4
    },
    {
      id: 'refinery',
      title: 'Raffinerie',
      imagePath: 'assets/img/infrastructure/refinery.png',
      baseCost: { eisen: 150 },
      costMultiplier: 1.4,
      requiredNode: { id: 'lager', level: 5 }
    },
    {
      id: 'orbital_shipyard',
      title: 'Orbitale Werft',
      imagePath: 'assets/img/infrastructure/orbital-shipyard.png',
      baseCost: { eisen: 1200, silber: 400 },
      costMultiplier: 1.5,
      requiredNode: { id: 'refinery', level: 10 }
    },
    {
      id: 'large_station',
      title: 'Große Raumstation',
      imagePath: 'assets/img/infrastructure/large-station.png',
      baseCost: { eisen: 8000, gold: 1000 },
      costMultiplier: 1.8,
      requiredNode: { id: 'orbital_shipyard', level: 10 }
    }
  ];
}

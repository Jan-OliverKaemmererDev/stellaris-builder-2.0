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
      id: 'refinery',
      title: 'Raffinerie',
      imagePath: 'assets/img/infrastructure/refinery.png',
      baseCost: { minerals: 150 },
      costMultiplier: 1.4
    },
    {
      id: 'orbital_shipyard',
      title: 'Orbitale Werft',
      imagePath: 'assets/img/infrastructure/orbital-shipyard.png',
      baseCost: { minerals: 1200, gas: 400 },
      costMultiplier: 1.5,
      requiredNode: { id: 'refinery', level: 10 }
    },
    {
      id: 'large_station',
      title: 'Große Raumstation',
      imagePath: 'assets/img/infrastructure/large-station.png',
      baseCost: { minerals: 8000, crystals: 1000 },
      costMultiplier: 1.8,
      requiredNode: { id: 'orbital_shipyard', level: 10 }
    }
  ];
}

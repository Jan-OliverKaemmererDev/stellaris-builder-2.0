import { Component } from '@angular/core';
import { SkilltreeComponent, SkillNode } from '../../components/skilltree/skilltree.component';

@Component({
  selector: 'app-trade',
  standalone: true,
  imports: [SkilltreeComponent],
  template: `<app-skilltree title="Handel & Wirtschaft" [nodes]="nodes"></app-skilltree>`
})
export class TradeComponent {
  nodes: SkillNode[] = [
    {
      id: 'trading_post',
      title: 'Handelsposten',
      imagePath: 'assets/img/infrastructure/trading-post.png',
      baseCost: { minerals: 50, food: 50 },
      costMultiplier: 1.2
    },
    {
      id: 'interstellar_market',
      title: 'Interstellarer Markt',
      imagePath: 'assets/img/infrastructure/trading-post.png', // Placeholder
      baseCost: { minerals: 1500, crystals: 200 },
      costMultiplier: 1.4,
      requiredNode: { id: 'trading_post', level: 10 }
    },
    {
      id: 'galactic_exchange',
      title: 'Galaktische Börse',
      imagePath: 'assets/img/infrastructure/trading-post.png', // Placeholder
      baseCost: { minerals: 5000, crystals: 1500, gas: 1500 },
      costMultiplier: 1.6,
      requiredNode: { id: 'interstellar_market', level: 10 }
    }
  ];
}

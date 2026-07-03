import { Component, inject, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { GameStateService, GameResources } from '../../services/game-state.service';

export interface ShipDef {
  id: string;
  title: string;
  description: string;
  imagePath: string;
  cost: Partial<GameResources>;
}

@Component({
  selector: 'app-fleet',
  standalone: true,
  imports: [CommonModule, DecimalPipe],
  templateUrl: './fleet.component.html',
  styleUrl: './fleet.component.scss'
})
export class FleetComponent implements OnInit, OnDestroy {
  gameState = inject(GameStateService);

  ships: ShipDef[] = [
    {
      id: 'kolonisierungsschiffe',
      title: 'Kolonisierungsschiff',
      description: 'Besiedelt ferne Planeten. Erhöht dauerhaft die Personal-Produktion (+10/h) und Kapazität (+1000).',
      imagePath: 'assets/img/fleet/kolonisierungsschiffe.png',
      cost: { eisen: 5000, nahrung: 1000, credits: 500 }
    },
    {
      id: 'logistikschiff',
      title: 'Logistikschiff',
      description: 'Erhöht die globale Lagerkapazität aller Rohstoffe um 10%.',
      imagePath: 'assets/img/fleet/logistikschiff.png',
      cost: { eisen: 2000, credits: 500 }
    },
    {
      id: 'transportschiffe',
      title: 'Transportschiff',
      description: 'Versorgt deine Planeten mit Materialien. Produziert passiv Nahrung (+200/h) und Eisen (+150/h).',
      imagePath: 'assets/img/fleet/transportschiffe.png',
      cost: { eisen: 3000, silber: 1000 }
    },
    {
      id: 'mining_ship',
      title: 'Mining Ship',
      description: 'Kann in den Asteroidengürtel geschickt werden, um Rohstoffe abzubauen.',
      imagePath: 'assets/img/fleet/mining-ship.png',
      cost: { eisen: 1000, silber: 200 }
    }
  ];

  private intervalId: any;
  missionProgress = 0; // 0 to 100
  missionTimeLeft = '';

  activeMission = this.gameState.activeMission;
  
  ngOnInit() {
    this.intervalId = setInterval(() => this.updateMissionProgress(), 100);
  }

  ngOnDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
  }

  getShipCount(id: string): number {
    return this.gameState.skills()[id] || 0;
  }

  canAfford(cost: Partial<GameResources>): boolean {
    return this.gameState.canAfford(cost);
  }

  async buildShip(ship: ShipDef) {
    if (!this.canAfford(ship.cost)) return;
    try {
      await this.gameState.upgradeSkill(ship.id, ship.cost);
    } catch(e) {
      console.error('Failed to build ship', e);
    }
  }

  getCostEntries(cost: Partial<GameResources>) {
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

  // --- Mission Logic ---
  
  get miningShipCount(): number {
    return this.getShipCount('mining_ship');
  }

  get availableMiningShips(): number {
    const m = this.activeMission();
    if (m && m.type === 'asteroid_mining') {
      return this.miningShipCount - m.shipCount;
    }
    return this.miningShipCount;
  }

  async startMission() {
    const available = this.availableMiningShips;
    if (available <= 0) return;
    
    // Mission takes 1 Minute
    await this.gameState.startMission('asteroid_mining', available, 60000);
    this.updateMissionProgress();
  }

  updateMissionProgress() {
    const m = this.activeMission();
    if (!m) {
      this.missionProgress = 0;
      this.missionTimeLeft = '';
      return;
    }

    const now = Date.now();
    const elapsed = now - m.startTime;
    
    if (elapsed >= m.durationMs) {
      this.missionProgress = 100;
      this.missionTimeLeft = 'Mission abgeschlossen!';
    } else {
      this.missionProgress = (elapsed / m.durationMs) * 100;
      const leftSec = Math.ceil((m.durationMs - elapsed) / 1000);
      this.missionTimeLeft = `Noch ${leftSec} Sekunden`;
    }
  }

  async collectReward() {
    const m = this.activeMission();
    if (!m || this.missionProgress < 100) return;

    // Reward per ship: 500 Eisen, 200 Silber, 50 Gold
    const reward = {
      eisen: m.shipCount * 500,
      silber: m.shipCount * 200,
      gold: m.shipCount * 50
    };

    try {
      await this.gameState.completeMission(reward);
    } catch (e) {
      console.error('Failed to collect reward', e);
    }
  }
}

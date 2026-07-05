import { Routes } from '@angular/router';
import { LandingPageComponent } from './landing-page/landing-page.component';
import { LegalNotice } from './legal-notice/legal-notice';
import { PrivacyPolicy } from './privacy-policy/privacy-policy';
import { GameLayout } from './game-layout/game-layout';
import { Bridge } from './bridge/bridge';
import { PlaceholderPage } from './placeholder-page/placeholder-page';
import { FleetComponent } from './pages/fleet/fleet.component';
import { authGuard } from './guards/auth.guard';
import { MiningComponent } from './pages/mining/mining.component';
import { EnergyComponent } from './pages/energy/energy.component';
import { ResearchComponent } from './pages/research/research.component';
import { InfrastructureComponent } from './pages/infrastructure/infrastructure.component';
import { TradeComponent } from './pages/trade/trade.component';

/**
 * Top-level route configuration for the application.
 * Public routes (landing, legal pages) are accessible without auth.
 * Game routes under `/bridge` are guarded by {@link authGuard}.
 */
export const routes: Routes = [
  { path: '', component: LandingPageComponent },
  { path: 'legal-notice', component: LegalNotice },
  { path: 'privacy-policy', component: PrivacyPolicy },
  {
    path: 'bridge',
    component: GameLayout,
    canActivate: [authGuard],
    children: [
      { path: '', component: Bridge },
      { path: 'mining', component: MiningComponent },
      { path: 'energy', component: EnergyComponent },
      { path: 'research', component: ResearchComponent },
      { path: 'infrastructure', component: InfrastructureComponent },
      { path: 'trade', component: TradeComponent },
      { path: 'fleet', component: FleetComponent, data: { title: 'Flotte', icon: '🚀' } },
    ],
  },
];

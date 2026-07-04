import { Injectable, inject, signal, computed } from '@angular/core';
import { Auth, user } from '@angular/fire/auth';
import { Firestore, doc, onSnapshot, setDoc, updateDoc } from '@angular/fire/firestore';
import { Subscription } from 'rxjs';

export interface GameResources {
  eisen: number;
  silber: number;
  gold: number;
  xenonit: number;
  energie: number;
  credits: number;
  nahrung: number;
  personal: number;
}

export interface MissionState {
  type: string;
  startTime: number;
  durationMs: number;
  shipCount: number;
}

export interface GameState {
  resources: GameResources;
  skills: Record<string, number>;
  activeMission?: MissionState | null;
  lastUpdate?: number;
}



const DEFAULT_STATE: GameState = {
  resources: {
    eisen: 1000,
    silber: 500,
    gold: 100,
    xenonit: 0,
    energie: 2000,
    credits: 1000,
    nahrung: 2000,
    personal: 100
  },
  skills: {}
};

@Injectable({
  providedIn: 'root'
})
export class GameStateService {
  private auth = inject(Auth);
  private firestore = inject(Firestore);

  // Signals for components to consume
  resources = signal<GameResources>(DEFAULT_STATE.resources);
  skills = signal<Record<string, number>>(DEFAULT_STATE.skills);
  activeMission = signal<MissionState | null>(null);
  offlineEarnings = signal<GameResources | null>(null);

  // --- Energy Management ---
  // Base energy upkeeps per level for buildings, or per ship for ships
  private readonly ENERGY_UPKEEP: Record<string, number> = {
    'eisenmine': 10,
    'silbermine': 20,
    'goldmine': 50,
    'lager': 10,
    'refinery': 50,
    'orbital_shipyard': 200,
    'large_station': 500,
    'biolabor': 100,
    'ki_automatisierung': 300,
    'antriebstechnik': 500,
    'trading_post': 50,
    'interstellar_market': 200,
    'galactic_exchange': 1000,
    // Ships
    'kolonisierungsschiffe': 100,
    'logistikschiff': 50,
    'transportschiffe': 50,
    'mining_ship': 20
  };

  energyProduced = computed<number>(() => {
    const s = this.skills();
    // Kraftwerke produzieren Energie exponentiell wie Baukosten, z.B. *1.5 pro Level
    const calc = (base: number, level: number) => level === 0 ? 0 : Math.floor(base * Math.pow(1.5, level - 1));
    return calc(200, s['solarkraftwerk'] || 0) + 
           calc(800, s['fusionsreaktor'] || 0) + 
           calc(3000, s['antimaterie'] || 0);
  });

  energyConsumed = computed<number>(() => {
    const s = this.skills();
    let total = 0;
    
    // Sum of all upkeeps for buildings (cumulative over levels)
    // Formula: sum of base * 1.5^(i-1) for i=1 to level
    const calcCumulative = (base: number, level: number) => {
      let sum = 0;
      for (let i = 1; i <= level; i++) {
        sum += Math.floor(base * Math.pow(1.5, i - 1));
      }
      return sum;
    };

    // Calculate for all skills
    for (const [skillId, level] of Object.entries(s)) {
      if (this.ENERGY_UPKEEP[skillId]) {
        // Ships are flat cost per ship, buildings are cumulative
        const isShip = ['kolonisierungsschiffe', 'logistikschiff', 'transportschiffe', 'mining_ship'].includes(skillId);
        if (isShip) {
          total += this.ENERGY_UPKEEP[skillId] * level;
        } else {
          total += calcCumulative(this.ENERGY_UPKEEP[skillId], level);
        }
      }
    }
    return total;
  });

  availableEnergy = computed<number>(() => {
    return this.energyProduced() - this.energyConsumed();
  });

  productionRates = computed<GameResources>(() => {
    const s = this.skills();
    const calc = (base: number, level: number) => level === 0 ? 0 : Math.floor(base * Math.pow(1.5, level - 1));
    const getMineBonus = (mineId: string) => {
      const roboter = s[`${mineId}_roboter`] || 0;
      const transport = s[`${mineId}_transport`] || 0;
      const ki = s[`${mineId}_ki`] || 0;
      const zug = s[`${mineId}_zug`] || 0;
      return 1 + ((roboter + transport + ki + zug) * 0.05);
    };
    
    const transports = s['transportschiffe'] || 0;
    const kolonie = s['kolonisierungsschiffe'] || 0;
    
    return {
      eisen: Math.floor(calc(150, s['eisenmine'] || 0) * getMineBonus('eisenmine')) + (transports * 150),
      silber: Math.floor(calc(80, s['silbermine'] || 0) * getMineBonus('silbermine')),
      gold: Math.floor(calc(30, s['goldmine'] || 0) * getMineBonus('goldmine')),
      xenonit: calc(10, s['refinery'] || 0),
      energie: 0, // Energie is now a capacity, not a produced resource
      credits: calc(100, s['trading_post'] || 0) + calc(400, s['interstellar_market'] || 0) + calc(1500, s['galactic_exchange'] || 0),
      nahrung: calc(200, s['biolabor'] || 0) + (transports * 200),
      personal: calc(5, s['large_station'] || 0) + calc(2, s['orbital_shipyard'] || 0) + (kolonie * 10)
    };
  });

  maxStorage = computed<GameResources>(() => {
    const s = this.skills();
    const lagerLevel = s['lager'] || 0;
    const logistik = s['logistikschiff'] || 0;
    const kolonie = s['kolonisierungsschiffe'] || 0;
    
    // Logistikschiffe erhöhen die globale Lagerkapazität um 10% pro Schiff (1.1^x)
    const multiplier = Math.pow(1.5, lagerLevel) * Math.pow(1.1, logistik);
    
    return {
      eisen: Math.floor(10000 * multiplier),
      silber: Math.floor(5000 * multiplier),
      gold: Math.floor(3000 * multiplier),
      xenonit: Math.floor(1000 * multiplier),
      energie: 0, // Capacity doesn't have storage
      credits: Math.floor(50000 * multiplier),
      nahrung: Math.floor(12000 * multiplier),
      personal: Math.floor(5000 * multiplier) + (kolonie * 1000)
    };
  });
  
  private userSub: Subscription | null = null;
  private stateSub: (() => void) | null = null;
  private gameLoopInterval: any;
  private lastTick: number = 0;
  private isInitialized = false;

  constructor() {
    // Listen to auth state changes
    this.userSub = user(this.auth).subscribe(currentUser => {
      if (currentUser) {
        this.loadGameState(currentUser.uid);
        this.startGameLoop();
      } else {
        this.clearState();
      }
    });
  }

  private loadGameState(uid: string) {
    if (this.stateSub) {
      this.stateSub();
    }

    const stateRef = doc(this.firestore, `users/${uid}/game/state`);
    
    this.stateSub = onSnapshot(stateRef, async (docSnap) => {
      const now = Date.now();
      
      if (!docSnap.exists()) {
        // Initialize default state in Firestore if it doesn't exist
        const initialState = { ...DEFAULT_STATE, lastUpdate: now };
        await setDoc(stateRef, initialState);
        this.resources.set(initialState.resources);
        this.skills.set(initialState.skills);
        this.isInitialized = true;
      } else {
        let state = docSnap.data() as GameState;
        
        // Calculate offline progress only once per session when initialized
        if (!this.isInitialized && state.lastUpdate) {
          const offlineHours = (now - state.lastUpdate) / (1000 * 60 * 60);
          
          if (offlineHours > 0.01) { // Only care if more than 36 seconds offline
            const s = state.skills || {};
            const calc = (base: number, level: number) => level === 0 ? 0 : Math.floor(base * Math.pow(1.5, level - 1));
            const getMineBonus = (mineId: string) => {
              const roboter = s[`${mineId}_roboter`] || 0;
              const transport = s[`${mineId}_transport`] || 0;
              const ki = s[`${mineId}_ki`] || 0;
              const zug = s[`${mineId}_zug`] || 0;
              return 1 + ((roboter + transport + ki + zug) * 0.05);
            };
            const transports = s['transportschiffe'] || 0;
            const kolonie = s['kolonisierungsschiffe'] || 0;
            const rates = {
              eisen: Math.floor(calc(150, s['eisenmine'] || 0) * getMineBonus('eisenmine')) + (transports * 150),
              silber: Math.floor(calc(80, s['silbermine'] || 0) * getMineBonus('silbermine')),
              gold: Math.floor(calc(30, s['goldmine'] || 0) * getMineBonus('goldmine')),
              xenonit: calc(10, s['refinery'] || 0),
              energie: 0, // No offline energy generation
              credits: calc(100, s['trading_post'] || 0) + calc(400, s['interstellar_market'] || 0) + calc(1500, s['galactic_exchange'] || 0),
              nahrung: calc(200, s['biolabor'] || 0) + (transports * 200),
              personal: calc(5, s['large_station'] || 0) + calc(2, s['orbital_shipyard'] || 0) + (kolonie * 10)
            };

            const generated = {
              eisen: Math.floor(rates.eisen * offlineHours),
              silber: Math.floor(rates.silber * offlineHours),
              gold: Math.floor(rates.gold * offlineHours),
              xenonit: Math.floor(rates.xenonit * offlineHours),
              energie: 0,
              credits: Math.floor(rates.credits * offlineHours),
              nahrung: Math.floor(rates.nahrung * offlineHours),
              personal: Math.floor(rates.personal * offlineHours)
            };
            
            // Only show dialog if actually generated something
            if (generated.eisen > 0 || generated.silber > 0 || generated.gold > 0 || generated.xenonit > 0 || generated.credits > 0 || generated.nahrung > 0 || generated.personal > 0) {
              this.offlineEarnings.set(generated);
              
              state = {
                ...state,
                resources: {
                  eisen: Math.min((state.resources?.eisen || 0) + generated.eisen, Math.floor(10000 * Math.pow(1.5, s['lager'] || 0) * Math.pow(1.1, s['logistikschiff'] || 0))),
                  silber: Math.min((state.resources?.silber || 0) + generated.silber, Math.floor(5000 * Math.pow(1.5, s['lager'] || 0) * Math.pow(1.1, s['logistikschiff'] || 0))),
                  gold: Math.min((state.resources?.gold || 0) + generated.gold, Math.floor(3000 * Math.pow(1.5, s['lager'] || 0) * Math.pow(1.1, s['logistikschiff'] || 0))),
                  xenonit: Math.min((state.resources?.xenonit || 0) + generated.xenonit, Math.floor(1000 * Math.pow(1.5, s['lager'] || 0) * Math.pow(1.1, s['logistikschiff'] || 0))),
                  energie: state.resources?.energie || 0, // Unchanged
                  credits: Math.min((state.resources?.credits || 0) + generated.credits, Math.floor(50000 * Math.pow(1.5, s['lager'] || 0) * Math.pow(1.1, s['logistikschiff'] || 0))),
                  nahrung: Math.min((state.resources?.nahrung || 0) + generated.nahrung, Math.floor(12000 * Math.pow(1.5, s['lager'] || 0) * Math.pow(1.1, s['logistikschiff'] || 0))),
                  personal: Math.min((state.resources?.personal || 0) + generated.personal, Math.floor(5000 * Math.pow(1.5, s['lager'] || 0) * Math.pow(1.1, s['logistikschiff'] || 0)) + ((s['kolonisierungsschiffe'] || 0) * 1000)),
                },
                lastUpdate: now
              };
              
              // Update firestore with calculated offline progress
              await updateDoc(stateRef, {
                resources: state.resources,
                lastUpdate: now
              });
            }
          }
          this.isInitialized = true;
        }
        
        this.resources.set(state.resources || DEFAULT_STATE.resources);
        this.skills.set(state.skills || {});
        this.activeMission.set(state.activeMission || null);
      }
    });
  }

  private clearState() {
    if (this.stateSub) {
      this.stateSub();
      this.stateSub = null;
    }
    if (this.gameLoopInterval) {
      clearInterval(this.gameLoopInterval);
      this.gameLoopInterval = null;
    }
    this.isInitialized = false;
    this.resources.set(DEFAULT_STATE.resources);
    this.skills.set({});
    this.activeMission.set(null);
    this.offlineEarnings.set(null);
  }

  private startGameLoop() {
    if (this.gameLoopInterval) {
      clearInterval(this.gameLoopInterval);
    }
    
    this.lastTick = Date.now();
    let secondsSinceLastSave = 0;
    
    this.gameLoopInterval = setInterval(async () => {
      if (!this.isInitialized) return;
      
      const now = Date.now();
      const deltaMs = now - this.lastTick;
      this.lastTick = now;
      
      const rates = this.productionRates();
      const current = this.resources();
      const max = this.maxStorage();
      
      // Calculate produced amounts for this tick (deltaMs / 3,600,000 converts ms to hours)
      const deltaHours = deltaMs / 3600000;
      
      const newRes = {
        eisen: Math.min(current.eisen + (rates.eisen * deltaHours), max.eisen),
        silber: Math.min(current.silber + (rates.silber * deltaHours), max.silber),
        gold: Math.min(current.gold + (rates.gold * deltaHours), max.gold),
        xenonit: Math.min(current.xenonit + (rates.xenonit * deltaHours), max.xenonit),
        energie: current.energie, // Capacity doesn't accumulate
        credits: Math.min(current.credits + (rates.credits * deltaHours), max.credits),
        nahrung: Math.min(current.nahrung + (rates.nahrung * deltaHours), max.nahrung),
        personal: Math.min(current.personal + (rates.personal * deltaHours), max.personal)
      };
      
      this.resources.set(newRes);
      
      // Save every 30 seconds
      secondsSinceLastSave += (deltaMs / 1000);
      if (secondsSinceLastSave >= 30) {
        secondsSinceLastSave = 0;
        const currentUser = this.auth.currentUser;
        if (currentUser) {
          const stateRef = doc(this.firestore, `users/${currentUser.uid}/game/state`);
          await updateDoc(stateRef, {
            resources: newRes,
            lastUpdate: Date.now()
          });
        }
      }
    }, 1000);
  }

  clearOfflineEarnings() {
    this.offlineEarnings.set(null);
  }

  // Cost parameter: mapping resource name to amount needed
  canAfford(cost: Partial<GameResources>): boolean {
    const current = this.resources();
    if (cost.eisen && current.eisen < cost.eisen) return false;
    if (cost.silber && current.silber < cost.silber) return false;
    if (cost.gold && current.gold < cost.gold) return false;
    if (cost.xenonit && current.xenonit < cost.xenonit) return false;
    if (cost.energie && this.availableEnergy() < cost.energie) return false; // Evaluate against available energy
    if (cost.credits && current.credits < cost.credits) return false;
    if (cost.nahrung && current.nahrung < cost.nahrung) return false;
    if (cost.personal && current.personal < cost.personal) return false;
    return true;
  }

  async upgradeSkill(skillId: string, cost: Partial<GameResources>) {
    if (!this.canAfford(cost)) {
      throw new Error('Not enough resources');
    }

    const currentUser = this.auth.currentUser;
    if (!currentUser) throw new Error('Not authenticated');

    const currentRes = this.resources();
    const newRes = {
      eisen: currentRes.eisen - (cost.eisen || 0),
      silber: currentRes.silber - (cost.silber || 0),
      gold: currentRes.gold - (cost.gold || 0),
      xenonit: currentRes.xenonit - (cost.xenonit || 0),
      energie: currentRes.energie, // Energy is not "spent", it's upkeep!
      credits: currentRes.credits - (cost.credits || 0),
      nahrung: currentRes.nahrung - (cost.nahrung || 0),
      personal: currentRes.personal - (cost.personal || 0),
    };

    const currentSkills = this.skills();
    const currentLevel = currentSkills[skillId] || 0;
    const newSkills = {
      ...currentSkills,
      [skillId]: currentLevel + 1
    };

    const stateRef = doc(this.firestore, `users/${currentUser.uid}/game/state`);
    
    // Optimistic update locally
    this.resources.set(newRes);
    this.skills.set(newSkills);

    // Update Firestore
    await updateDoc(stateRef, {
      resources: newRes,
      [`skills.${skillId}`]: currentLevel + 1
    });
  }

  getSkillLevel(skillId: string): number {
    return this.skills()[skillId] || 0;
  }

  // --- Missions API ---
  async startMission(type: string, shipCount: number, durationMs: number) {
    const currentUser = this.auth.currentUser;
    if (!currentUser) throw new Error('Not authenticated');

    const newMission: MissionState = {
      type,
      startTime: Date.now(),
      durationMs,
      shipCount
    };

    const stateRef = doc(this.firestore, `users/${currentUser.uid}/game/state`);
    this.activeMission.set(newMission);

    await updateDoc(stateRef, {
      activeMission: newMission
    });
  }

  async completeMission(reward: Partial<GameResources>) {
    const currentUser = this.auth.currentUser;
    if (!currentUser) throw new Error('Not authenticated');

    const currentRes = this.resources();
    const max = this.maxStorage();
    
    const newRes = {
      eisen: Math.min(currentRes.eisen + (reward.eisen || 0), max.eisen),
      silber: Math.min(currentRes.silber + (reward.silber || 0), max.silber),
      gold: Math.min(currentRes.gold + (reward.gold || 0), max.gold),
      xenonit: Math.min(currentRes.xenonit + (reward.xenonit || 0), max.xenonit),
      energie: Math.min(currentRes.energie + (reward.energie || 0), max.energie),
      credits: Math.min(currentRes.credits + (reward.credits || 0), max.credits),
      nahrung: Math.min(currentRes.nahrung + (reward.nahrung || 0), max.nahrung),
      personal: Math.min(currentRes.personal + (reward.personal || 0), max.personal),
    };

    const stateRef = doc(this.firestore, `users/${currentUser.uid}/game/state`);
    
    this.resources.set(newRes);
    this.activeMission.set(null);

    await updateDoc(stateRef, {
      resources: newRes,
      activeMission: null
    });
  }

  // --- Trading API ---
  getSellRate(resourceId: string): number {
    const baseRates: Record<string, number> = {
      eisen: 1,
      silber: 5,
      gold: 20,
      xenonit: 100
    };
    const base = baseRates[resourceId] || 0;
    const skills = this.skills();
    const tradePost = skills['trading_post'] || 0;
    const interMarket = skills['interstellar_market'] || 0;
    const galExchange = skills['galactic_exchange'] || 0;
    
    const multiplier = 1 + (tradePost * 0.05) + (interMarket * 0.1) + (galExchange * 0.2);
    return Math.floor(base * multiplier);
  }

  getBuyRate(resourceId: string): number {
    const baseRates: Record<string, number> = {
      eisen: 2,
      silber: 10,
      gold: 40,
      xenonit: 200,
      nahrung: 5,
      personal: 50
    };
    const base = baseRates[resourceId] || 0;
    const skills = this.skills();
    const interMarket = skills['interstellar_market'] || 0;
    const galExchange = skills['galactic_exchange'] || 0;
    
    const discount = Math.min(0.5, (interMarket * 0.02) + (galExchange * 0.05));
    const multiplier = 1 - discount;
    return Math.max(1, Math.floor(base * multiplier));
  }

  async sellResource(resourceId: keyof GameResources, amount: number) {
    const currentUser = this.auth.currentUser;
    if (!currentUser) return;

    const currentRes = this.resources();
    if ((currentRes[resourceId] || 0) < amount) return;

    const creditsEarned = this.getSellRate(resourceId) * amount;
    const max = this.maxStorage();
    
    const newRes = {
      ...currentRes,
      [resourceId]: currentRes[resourceId] - amount,
      credits: Math.min(currentRes.credits + creditsEarned, max.credits)
    };

    const stateRef = doc(this.firestore, `users/${currentUser.uid}/game/state`);
    this.resources.set(newRes);
    await updateDoc(stateRef, { resources: newRes });
  }

  async buyResource(resourceId: keyof GameResources, amount: number) {
    const currentUser = this.auth.currentUser;
    if (!currentUser) return;

    const cost = this.getBuyRate(resourceId) * amount;
    const currentRes = this.resources();
    
    if (currentRes.credits < cost) return;

    const max = this.maxStorage();
    const currentAmount = currentRes[resourceId] || 0;
    const maxAmount = (max as any)[resourceId] || currentAmount + amount;
    
    const newRes = {
      ...currentRes,
      credits: currentRes.credits - cost,
      [resourceId]: Math.min(currentAmount + amount, maxAmount)
    };

    const stateRef = doc(this.firestore, `users/${currentUser.uid}/game/state`);
    this.resources.set(newRes);
    await updateDoc(stateRef, { resources: newRes });
  }
}

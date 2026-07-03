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

  productionRates = computed<GameResources>(() => {
    const s = this.skills();
    const calc = (base: number, level: number) => level === 0 ? 0 : Math.floor(base * Math.pow(1.5, level - 1));
    const transports = s['transportschiffe'] || 0;
    const kolonie = s['kolonisierungsschiffe'] || 0;
    
    return {
      eisen: calc(150, s['eisenmine'] || 0) + (transports * 150),
      silber: calc(80, s['silbermine'] || 0),
      gold: calc(30, s['goldmine'] || 0),
      xenonit: calc(10, s['refinery'] || 0),
      energie: calc(200, s['solarkraftwerk'] || 0) + calc(800, s['fusionsreaktor'] || 0) + calc(3000, s['antimaterie'] || 0),
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
      energie: Math.floor(20000 * multiplier),
      credits: Math.floor(50000 * multiplier),
      nahrung: Math.floor(12000 * multiplier),
      personal: Math.floor(5000 * multiplier) + (kolonie * 1000)
    };
  });
  
  private userSub: Subscription | null = null;
  private stateSub: (() => void) | null = null;
  private saveInterval: any;
  private isInitialized = false;

  constructor() {
    // Listen to auth state changes
    this.userSub = user(this.auth).subscribe(currentUser => {
      if (currentUser) {
        this.loadGameState(currentUser.uid);
        this.startSaveInterval();
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
            const transports = s['transportschiffe'] || 0;
            const kolonie = s['kolonisierungsschiffe'] || 0;
            const rates = {
              eisen: calc(150, s['eisenmine'] || 0) + (transports * 150),
              silber: calc(80, s['silbermine'] || 0),
              gold: calc(30, s['goldmine'] || 0),
              xenonit: calc(10, s['refinery'] || 0),
              energie: calc(200, s['solarkraftwerk'] || 0) + calc(800, s['fusionsreaktor'] || 0) + calc(3000, s['antimaterie'] || 0),
              credits: calc(100, s['trading_post'] || 0) + calc(400, s['interstellar_market'] || 0) + calc(1500, s['galactic_exchange'] || 0),
              nahrung: calc(200, s['biolabor'] || 0) + (transports * 200),
              personal: calc(5, s['large_station'] || 0) + calc(2, s['orbital_shipyard'] || 0) + (kolonie * 10)
            };

            const generated = {
              eisen: Math.floor(rates.eisen * offlineHours),
              silber: Math.floor(rates.silber * offlineHours),
              gold: Math.floor(rates.gold * offlineHours),
              xenonit: Math.floor(rates.xenonit * offlineHours),
              energie: Math.floor(rates.energie * offlineHours),
              credits: Math.floor(rates.credits * offlineHours),
              nahrung: Math.floor(rates.nahrung * offlineHours),
              personal: Math.floor(rates.personal * offlineHours)
            };
            
            // Only show dialog if actually generated something
            if (generated.eisen > 0 || generated.silber > 0 || generated.gold > 0 || generated.xenonit > 0 || generated.energie > 0 || generated.credits > 0 || generated.nahrung > 0 || generated.personal > 0) {
              this.offlineEarnings.set(generated);
              
              state = {
                ...state,
                resources: {
                  eisen: Math.min((state.resources?.eisen || 0) + generated.eisen, Math.floor(10000 * Math.pow(1.5, s['lager'] || 0) * Math.pow(1.1, s['logistikschiff'] || 0))),
                  silber: Math.min((state.resources?.silber || 0) + generated.silber, Math.floor(5000 * Math.pow(1.5, s['lager'] || 0) * Math.pow(1.1, s['logistikschiff'] || 0))),
                  gold: Math.min((state.resources?.gold || 0) + generated.gold, Math.floor(3000 * Math.pow(1.5, s['lager'] || 0) * Math.pow(1.1, s['logistikschiff'] || 0))),
                  xenonit: Math.min((state.resources?.xenonit || 0) + generated.xenonit, Math.floor(1000 * Math.pow(1.5, s['lager'] || 0) * Math.pow(1.1, s['logistikschiff'] || 0))),
                  energie: Math.min((state.resources?.energie || 0) + generated.energie, Math.floor(20000 * Math.pow(1.5, s['lager'] || 0) * Math.pow(1.1, s['logistikschiff'] || 0))),
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
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
      this.saveInterval = null;
    }
    this.isInitialized = false;
    this.resources.set(DEFAULT_STATE.resources);
    this.skills.set({});
    this.activeMission.set(null);
    this.offlineEarnings.set(null);
  }

  private startSaveInterval() {
    // Keep lastUpdate fresh every 30 seconds
    if (this.saveInterval) {
      clearInterval(this.saveInterval);
    }
    this.saveInterval = setInterval(async () => {
      const currentUser = this.auth.currentUser;
      if (currentUser && this.isInitialized) {
        const stateRef = doc(this.firestore, `users/${currentUser.uid}/game/state`);
        await updateDoc(stateRef, {
          lastUpdate: Date.now()
        });
      }
    }, 30000);
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
    if (cost.energie && current.energie < cost.energie) return false;
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
      energie: currentRes.energie - (cost.energie || 0),
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
}

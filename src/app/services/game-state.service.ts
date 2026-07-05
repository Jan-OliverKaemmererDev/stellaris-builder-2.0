import { Injectable, inject, signal, computed } from '@angular/core';
import { Auth, user } from '@angular/fire/auth';
import { Firestore, doc, onSnapshot, setDoc, updateDoc } from '@angular/fire/firestore';
import { Subscription } from 'rxjs';

/** All trackable game resources in the player's empire. */
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

/** Represents a running fleet mission with timing data. */
export interface MissionState {
  type: string;
  startTime: number;
  durationMs: number;
  shipCount: number;
}

/** Full persisted game state stored in Firestore per user. */
export interface GameState {
  resources: GameResources;
  skills: Record<string, number>;
  activeMission?: MissionState | null;
  lastUpdate?: number;
}

/** Default resource values for a fresh game. */
const DEFAULT_STATE: GameState = {
  resources: {
    eisen: 1000,
    silber: 500,
    gold: 100,
    xenonit: 0,
    energie: 2000,
    credits: 1000,
    nahrung: 2000,
    personal: 100,
  },
  skills: {},
};

/** IDs that are treated as ships with flat energy cost per unit. */
const SHIP_IDS = ['kolonisierungsschiffe', 'logistikschiff', 'transportschiffe', 'mining_ship'];

/**
 * Central service that manages the entire game state lifecycle:
 * resource production, skill upgrades, energy balance, trading,
 * fleet missions, offline progress, and Firestore persistence.
 */
@Injectable({
  providedIn: 'root',
})
export class GameStateService {
  private auth = inject(Auth);
  private firestore = inject(Firestore);

  /** Current resource amounts as a reactive signal. */
  resources = signal<GameResources>(DEFAULT_STATE.resources);

  /** Current skill/building levels keyed by skill ID. */
  skills = signal<Record<string, number>>(DEFAULT_STATE.skills);

  /** Currently running mission, or `null` if idle. */
  activeMission = signal<MissionState | null>(null);

  /** Resources earned while offline, shown in the welcome-back dialog. */
  offlineEarnings = signal<GameResources | null>(null);

  /** Base energy upkeep per level (buildings) or per unit (ships). */
  private readonly ENERGY_UPKEEP: Record<string, number> = {
    eisenmine: 10,
    silbermine: 20,
    goldmine: 50,
    lager: 10,
    refinery: 50,
    orbital_shipyard: 200,
    large_station: 500,
    biolabor: 100,
    ki_automatisierung: 300,
    antriebstechnik: 500,
    trading_post: 50,
    interstellar_market: 200,
    galactic_exchange: 1000,
    kolonisierungsschiffe: 100,
    logistikschiff: 50,
    transportschiffe: 50,
    mining_ship: 20,
  };

  /** Total energy capacity produced by all power plants. */
  energyProduced = computed<number>(() => {
    const s = this.skills();
    return (
      this.calcExponential(200, s['solarkraftwerk'] || 0) +
      this.calcExponential(800, s['fusionsreaktor'] || 0) +
      this.calcExponential(3000, s['antimaterie'] || 0)
    );
  });

  /** Total energy consumed by all buildings and ships. */
  energyConsumed = computed<number>(() => {
    const s = this.skills();
    let total = 0;
    for (const [skillId, level] of Object.entries(s)) {
      if (!this.ENERGY_UPKEEP[skillId]) continue;
      total += SHIP_IDS.includes(skillId)
        ? this.ENERGY_UPKEEP[skillId] * level
        : this.calcCumulativeUpkeep(this.ENERGY_UPKEEP[skillId], level);
    }
    return total;
  });

  /** Remaining energy capacity (produced minus consumed). */
  availableEnergy = computed<number>(() => {
    return this.energyProduced() - this.energyConsumed();
  });

  /** Hourly production rates for each resource based on current skills. */
  productionRates = computed<GameResources>(() => {
    return this.buildResourceRates(this.skills());
  });

  /** Maximum storage capacity for each resource. */
  maxStorage = computed<GameResources>(() => {
    return this.buildMaxStorage(this.skills());
  });

  private userSub: Subscription | null = null;
  private stateSub: (() => void) | null = null;
  private gameLoopInterval: ReturnType<typeof setInterval> | null = null;
  private lastTick: number = 0;
  private isInitialized = false;

  constructor() {
    this.userSub = user(this.auth).subscribe((currentUser) => {
      if (currentUser) {
        this.loadGameState(currentUser.uid);
        this.startGameLoop();
      } else {
        this.clearState();
      }
    });
  }

  /**
   * Calculates an exponential value: `base * 1.5^(level-1)`.
   * Returns `0` for level `0`.
   * @param base - The base value at level 1.
   * @param level - The current level.
   */
  private calcExponential(base: number, level: number): number {
    return level === 0 ? 0 : Math.floor(base * Math.pow(1.5, level - 1));
  }

  /**
   * Calculates cumulative upkeep as the sum of exponential costs from level 1 to `level`.
   * @param base - The base upkeep at level 1.
   * @param level - The current level.
   */
  private calcCumulativeUpkeep(base: number, level: number): number {
    let sum = 0;
    for (let i = 1; i <= level; i++) {
      sum += Math.floor(base * Math.pow(1.5, i - 1));
    }
    return sum;
  }

  /**
   * Calculates the production bonus multiplier for a mine based on its upgrades.
   * @param mineId - The base mine skill ID.
   * @param s - The current skills record.
   */
  private getMineBonus(mineId: string, s: Record<string, number>): number {
    const roboter = s[`${mineId}_roboter`] || 0;
    const transport = s[`${mineId}_transport`] || 0;
    const ki = s[`${mineId}_ki`] || 0;
    const zug = s[`${mineId}_zug`] || 0;
    return 1 + (roboter + transport + ki + zug) * 0.05;
  }

  /**
   * Builds the full resource production rates per hour from skill levels.
   * @param s - The current skills record.
   */
  private buildResourceRates(s: Record<string, number>): GameResources {
    const transports = s['transportschiffe'] || 0;
    const kolonie = s['kolonisierungsschiffe'] || 0;
    return {
      eisen: Math.floor(this.calcExponential(150, s['eisenmine'] || 0) * this.getMineBonus('eisenmine', s)) + transports * 150,
      silber: Math.floor(this.calcExponential(80, s['silbermine'] || 0) * this.getMineBonus('silbermine', s)),
      gold: Math.floor(this.calcExponential(30, s['goldmine'] || 0) * this.getMineBonus('goldmine', s)),
      xenonit: this.calcExponential(10, s['refinery'] || 0),
      energie: 0,
      credits: this.calcExponential(100, s['trading_post'] || 0) + this.calcExponential(400, s['interstellar_market'] || 0) + this.calcExponential(1500, s['galactic_exchange'] || 0),
      nahrung: this.calcExponential(200, s['biolabor'] || 0) + transports * 200,
      personal: this.calcExponential(5, s['large_station'] || 0) + this.calcExponential(2, s['orbital_shipyard'] || 0) + kolonie * 10,
    };
  }

  /**
   * Builds the maximum storage capacity for all resources.
   * @param s - The current skills record.
   */
  private buildMaxStorage(s: Record<string, number>): GameResources {
    const lagerLevel = s['lager'] || 0;
    const logistik = s['logistikschiff'] || 0;
    const kolonie = s['kolonisierungsschiffe'] || 0;
    const multiplier = Math.pow(1.5, lagerLevel) * Math.pow(1.1, logistik);
    return {
      eisen: Math.floor(10000 * multiplier),
      silber: Math.floor(5000 * multiplier),
      gold: Math.floor(3000 * multiplier),
      xenonit: Math.floor(1000 * multiplier),
      energie: 0,
      credits: Math.floor(50000 * multiplier),
      nahrung: Math.floor(12000 * multiplier),
      personal: Math.floor(5000 * multiplier) + kolonie * 1000,
    };
  }

  /**
   * Subscribes to the Firestore game state document for the given user
   * and handles initialization, offline progress, and live updates.
   * @param uid - The authenticated user's UID.
   */
  private loadGameState(uid: string): void {
    if (this.stateSub) {
      this.stateSub();
    }
    const stateRef = doc(this.firestore, `users/${uid}/game/state`);
    this.stateSub = onSnapshot(stateRef, async (docSnap) => {
      if (!docSnap.exists()) {
        await this.initializeDefaultState(stateRef);
      } else {
        await this.handleExistingState(docSnap.data() as GameState, stateRef);
      }
    });
  }

  /**
   * Creates a fresh game state document in Firestore and applies it locally.
   * @param stateRef - Firestore document reference.
   */
  private async initializeDefaultState(stateRef: ReturnType<typeof doc>): Promise<void> {
    const now = Date.now();
    const initialState = { ...DEFAULT_STATE, lastUpdate: now };
    await setDoc(stateRef, initialState);
    this.resources.set(initialState.resources);
    this.skills.set(initialState.skills);
    this.isInitialized = true;
  }

  /**
   * Processes an existing Firestore snapshot: calculates offline progress
   * on first load, then applies the state to local signals.
   * @param state - The raw game state from Firestore.
   * @param stateRef - Firestore document reference for writes.
   */
  private async handleExistingState(state: GameState, stateRef: ReturnType<typeof doc>): Promise<void> {
    if (!this.isInitialized && state.lastUpdate) {
      const now = Date.now();
      const offlineHours = (now - state.lastUpdate) / (1000 * 60 * 60);
      if (offlineHours > 0.01) {
        state = await this.processOfflineProgress(state, offlineHours, now, stateRef);
      }
      this.isInitialized = true;
    }
    this.resources.set(state.resources || DEFAULT_STATE.resources);
    this.skills.set(state.skills || {});
    this.activeMission.set(state.activeMission || null);
  }

  /**
   * Calculates and applies offline resource generation, updating Firestore if significant.
   * @param state - The persisted game state.
   * @param offlineHours - Hours elapsed since last update.
   * @param now - Current timestamp.
   * @param stateRef - Firestore document reference.
   * @returns The potentially updated game state.
   */
  private async processOfflineProgress(
    state: GameState,
    offlineHours: number,
    now: number,
    stateRef: ReturnType<typeof doc>,
  ): Promise<GameState> {
    const s = state.skills || {};
    const rates = this.buildResourceRates(s);
    const generated = this.calculateOfflineGenerated(rates, offlineHours);

    if (!this.hasSignificantEarnings(generated)) {
      return state;
    }

    this.offlineEarnings.set(generated);
    const max = this.buildMaxStorage(s);
    const updatedResources = this.applyOfflineEarnings(state.resources, generated, max);
    const updatedState = { ...state, resources: updatedResources, lastUpdate: now };

    await updateDoc(stateRef, { resources: updatedResources, lastUpdate: now });
    return updatedState;
  }

  /**
   * Multiplies hourly rates by elapsed hours to get total offline production.
   * @param rates - Hourly production rates.
   * @param offlineHours - Hours elapsed.
   */
  private calculateOfflineGenerated(rates: GameResources, offlineHours: number): GameResources {
    return {
      eisen: Math.floor(rates.eisen * offlineHours),
      silber: Math.floor(rates.silber * offlineHours),
      gold: Math.floor(rates.gold * offlineHours),
      xenonit: Math.floor(rates.xenonit * offlineHours),
      energie: 0,
      credits: Math.floor(rates.credits * offlineHours),
      nahrung: Math.floor(rates.nahrung * offlineHours),
      personal: Math.floor(rates.personal * offlineHours),
    };
  }

  /**
   * Checks whether any resource was produced during offline time.
   * @param generated - The generated resource amounts.
   */
  private hasSignificantEarnings(generated: GameResources): boolean {
    return (
      generated.eisen > 0 ||
      generated.silber > 0 ||
      generated.gold > 0 ||
      generated.xenonit > 0 ||
      generated.credits > 0 ||
      generated.nahrung > 0 ||
      generated.personal > 0
    );
  }

  /**
   * Adds offline earnings to the current resources, respecting storage caps.
   * @param current - The persisted resource amounts.
   * @param generated - The offline-generated amounts.
   * @param max - The maximum storage capacities.
   */
  private applyOfflineEarnings(current: GameResources, generated: GameResources, max: GameResources): GameResources {
    return {
      eisen: Math.min((current.eisen || 0) + generated.eisen, max.eisen),
      silber: Math.min((current.silber || 0) + generated.silber, max.silber),
      gold: Math.min((current.gold || 0) + generated.gold, max.gold),
      xenonit: Math.min((current.xenonit || 0) + generated.xenonit, max.xenonit),
      energie: current.energie || 0,
      credits: Math.min((current.credits || 0) + generated.credits, max.credits),
      nahrung: Math.min((current.nahrung || 0) + generated.nahrung, max.nahrung),
      personal: Math.min((current.personal || 0) + generated.personal, max.personal),
    };
  }

  /** Unsubscribes from all listeners, stops the game loop, and resets signals. */
  private clearState(): void {
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

  /** Starts the 1-second game loop that updates resources and auto-saves. */
  private startGameLoop(): void {
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

      const newRes = this.calculateTickResources(deltaMs);
      this.resources.set(newRes);

      secondsSinceLastSave += deltaMs / 1000;
      secondsSinceLastSave = await this.saveIfNeeded(secondsSinceLastSave, newRes);
    }, 1000);
  }

  /**
   * Calculates new resource values for one game tick.
   * @param deltaMs - Milliseconds elapsed since the last tick.
   */
  private calculateTickResources(deltaMs: number): GameResources {
    const rates = this.productionRates();
    const current = this.resources();
    const max = this.maxStorage();
    const deltaHours = deltaMs / 3600000;
    return {
      eisen: Math.min(current.eisen + rates.eisen * deltaHours, max.eisen),
      silber: Math.min(current.silber + rates.silber * deltaHours, max.silber),
      gold: Math.min(current.gold + rates.gold * deltaHours, max.gold),
      xenonit: Math.min(current.xenonit + rates.xenonit * deltaHours, max.xenonit),
      energie: current.energie,
      credits: Math.min(current.credits + rates.credits * deltaHours, max.credits),
      nahrung: Math.min(current.nahrung + rates.nahrung * deltaHours, max.nahrung),
      personal: Math.min(current.personal + rates.personal * deltaHours, max.personal),
    };
  }

  /**
   * Saves the current resources to Firestore every 30 seconds.
   * @param elapsed - Seconds since last save.
   * @param resources - Current resource state to persist.
   * @returns Reset or accumulated elapsed seconds.
   */
  private async saveIfNeeded(elapsed: number, resources: GameResources): Promise<number> {
    if (elapsed < 30) return elapsed;
    const currentUser = this.auth.currentUser;
    if (currentUser) {
      const stateRef = doc(this.firestore, `users/${currentUser.uid}/game/state`);
      await updateDoc(stateRef, { resources, lastUpdate: Date.now() });
    }
    return 0;
  }

  /** Clears the offline earnings signal so the dialog can be dismissed. */
  clearOfflineEarnings(): void {
    this.offlineEarnings.set(null);
  }

  /**
   * Checks whether the player can afford a given cost.
   * Energy is checked against available capacity, not stored amount.
   * @param cost - Partial resource cost to check.
   */
  canAfford(cost: Partial<GameResources>): boolean {
    const current = this.resources();
    if (cost.eisen && current.eisen < cost.eisen) return false;
    if (cost.silber && current.silber < cost.silber) return false;
    if (cost.gold && current.gold < cost.gold) return false;
    if (cost.xenonit && current.xenonit < cost.xenonit) return false;
    if (cost.energie && this.availableEnergy() < cost.energie) return false;
    if (cost.credits && current.credits < cost.credits) return false;
    if (cost.nahrung && current.nahrung < cost.nahrung) return false;
    if (cost.personal && current.personal < cost.personal) return false;
    return true;
  }

  /**
   * Deducts resources from the current state and returns the new values.
   * Energy is exempt from deduction (it is an upkeep cost, not consumed).
   * @param cost - The resource cost to deduct.
   */
  private deductResources(cost: Partial<GameResources>): GameResources {
    const current = this.resources();
    return {
      eisen: current.eisen - (cost.eisen || 0),
      silber: current.silber - (cost.silber || 0),
      gold: current.gold - (cost.gold || 0),
      xenonit: current.xenonit - (cost.xenonit || 0),
      energie: current.energie,
      credits: current.credits - (cost.credits || 0),
      nahrung: current.nahrung - (cost.nahrung || 0),
      personal: current.personal - (cost.personal || 0),
    };
  }

  /**
   * Upgrades a skill by one level, deducting the required resources.
   * Performs an optimistic local update before persisting to Firestore.
   * @param skillId - The skill to upgrade.
   * @param cost - The resources required for this upgrade.
   * @throws Error if the player cannot afford the cost or is not authenticated.
   */
  async upgradeSkill(skillId: string, cost: Partial<GameResources>): Promise<void> {
    if (!this.canAfford(cost)) {
      throw new Error('Not enough resources');
    }
    const currentUser = this.auth.currentUser;
    if (!currentUser) throw new Error('Not authenticated');

    const newRes = this.deductResources(cost);
    const currentLevel = this.skills()[skillId] || 0;
    const newSkills = { ...this.skills(), [skillId]: currentLevel + 1 };

    this.resources.set(newRes);
    this.skills.set(newSkills);

    const stateRef = doc(this.firestore, `users/${currentUser.uid}/game/state`);
    await updateDoc(stateRef, { resources: newRes, [`skills.${skillId}`]: currentLevel + 1 });
  }

  /**
   * Returns the current level of a skill.
   * @param skillId - The skill ID to look up.
   */
  getSkillLevel(skillId: string): number {
    return this.skills()[skillId] || 0;
  }

  /**
   * Starts a fleet mission with the given parameters.
   * @param type - The mission type identifier.
   * @param shipCount - Number of ships to deploy.
   * @param durationMs - Mission duration in milliseconds.
   * @throws Error if the player is not authenticated.
   */
  async startMission(type: string, shipCount: number, durationMs: number): Promise<void> {
    const currentUser = this.auth.currentUser;
    if (!currentUser) throw new Error('Not authenticated');

    const newMission: MissionState = { type, startTime: Date.now(), durationMs, shipCount };
    const stateRef = doc(this.firestore, `users/${currentUser.uid}/game/state`);
    this.activeMission.set(newMission);
    await updateDoc(stateRef, { activeMission: newMission });
  }

  /**
   * Adds reward resources to the current state (capped by storage)
   * and returns the resulting resource values.
   * @param reward - The mission reward amounts.
   */
  private addRewardCapped(reward: Partial<GameResources>): GameResources {
    const current = this.resources();
    const max = this.maxStorage();
    return {
      eisen: Math.min(current.eisen + (reward.eisen || 0), max.eisen),
      silber: Math.min(current.silber + (reward.silber || 0), max.silber),
      gold: Math.min(current.gold + (reward.gold || 0), max.gold),
      xenonit: Math.min(current.xenonit + (reward.xenonit || 0), max.xenonit),
      energie: Math.min(current.energie + (reward.energie || 0), max.energie),
      credits: Math.min(current.credits + (reward.credits || 0), max.credits),
      nahrung: Math.min(current.nahrung + (reward.nahrung || 0), max.nahrung),
      personal: Math.min(current.personal + (reward.personal || 0), max.personal),
    };
  }

  /**
   * Completes the active mission, awards resources, and clears the mission state.
   * @param reward - The resource reward for completing the mission.
   * @throws Error if the player is not authenticated.
   */
  async completeMission(reward: Partial<GameResources>): Promise<void> {
    const currentUser = this.auth.currentUser;
    if (!currentUser) throw new Error('Not authenticated');

    const newRes = this.addRewardCapped(reward);
    const stateRef = doc(this.firestore, `users/${currentUser.uid}/game/state`);
    this.resources.set(newRes);
    this.activeMission.set(null);
    await updateDoc(stateRef, { resources: newRes, activeMission: null });
  }

  /**
   * Returns the credit value per unit when selling a resource.
   * Trade buildings increase the sell rate.
   * @param resourceId - The resource to sell.
   */
  getSellRate(resourceId: string): number {
    const baseRates: Record<string, number> = { eisen: 1, silber: 5, gold: 20, xenonit: 100 };
    const base = baseRates[resourceId] || 0;
    const s = this.skills();
    const multiplier = 1 + (s['trading_post'] || 0) * 0.05 + (s['interstellar_market'] || 0) * 0.1 + (s['galactic_exchange'] || 0) * 0.2;
    return Math.floor(base * multiplier);
  }

  /**
   * Returns the credit cost per unit when buying a resource.
   * Trade buildings reduce the buy rate.
   * @param resourceId - The resource to buy.
   */
  getBuyRate(resourceId: string): number {
    const baseRates: Record<string, number> = { eisen: 2, silber: 10, gold: 40, xenonit: 200, nahrung: 5, personal: 50 };
    const base = baseRates[resourceId] || 0;
    const s = this.skills();
    const discount = Math.min(0.5, (s['interstellar_market'] || 0) * 0.02 + (s['galactic_exchange'] || 0) * 0.05);
    return Math.max(1, Math.floor(base * (1 - discount)));
  }

  /**
   * Sells a specified amount of a resource for credits.
   * @param resourceId - The resource to sell.
   * @param amount - Number of units to sell.
   */
  async sellResource(resourceId: keyof GameResources, amount: number): Promise<void> {
    const currentUser = this.auth.currentUser;
    if (!currentUser) return;
    const currentRes = this.resources();
    if ((currentRes[resourceId] || 0) < amount) return;

    const creditsEarned = this.getSellRate(resourceId) * amount;
    const max = this.maxStorage();
    const newRes = { ...currentRes, [resourceId]: currentRes[resourceId] - amount, credits: Math.min(currentRes.credits + creditsEarned, max.credits) };

    const stateRef = doc(this.firestore, `users/${currentUser.uid}/game/state`);
    this.resources.set(newRes);
    await updateDoc(stateRef, { resources: newRes });
  }

  /**
   * Buys a specified amount of a resource using credits.
   * @param resourceId - The resource to buy.
   * @param amount - Number of units to buy.
   */
  async buyResource(resourceId: keyof GameResources, amount: number): Promise<void> {
    const currentUser = this.auth.currentUser;
    if (!currentUser) return;
    const cost = this.getBuyRate(resourceId) * amount;
    const currentRes = this.resources();
    if (currentRes.credits < cost) return;

    const max = this.maxStorage();
    const currentAmount = currentRes[resourceId] || 0;
    const maxAmount = (max as unknown as Record<string, number>)[resourceId] || currentAmount + amount;
    const newRes = { ...currentRes, credits: currentRes.credits - cost, [resourceId]: Math.min(currentAmount + amount, maxAmount) };

    const stateRef = doc(this.firestore, `users/${currentUser.uid}/game/state`);
    this.resources.set(newRes);
    await updateDoc(stateRef, { resources: newRes });
  }
}

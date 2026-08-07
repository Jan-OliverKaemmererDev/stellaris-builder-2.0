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
    eisenmine: 10, silbermine: 20, goldmine: 50, lager: 10, refinery: 50,
    orbital_shipyard: 200, large_station: 500, biolabor: 100,
    ki_automatisierung: 300, antriebstechnik: 500, trading_post: 50,
    interstellar_market: 200, galactic_exchange: 1000,
    kolonisierungsschiffe: 100, logistikschiff: 50, transportschiffe: 50, mining_ship: 20,
  };

  /** Total energy capacity produced by all power plants. */
  energyProduced = computed<number>(() => {
    const s = this.skills();
    return this.calcExponential(200, s['solarkraftwerk'] || 0) +
           this.calcExponential(800, s['fusionsreaktor'] || 0) +
           this.calcExponential(3000, s['antimaterie'] || 0);
  });

  /** Total energy consumed by all buildings and ships. */
  energyConsumed = computed<number>(() => {
    return Object.entries(this.skills()).reduce((total, [id, level]) => {
      if (!this.ENERGY_UPKEEP[id]) return total;
      return total + (SHIP_IDS.includes(id) ? this.ENERGY_UPKEEP[id] * level : this.calcCumulativeUpkeep(this.ENERGY_UPKEEP[id], level));
    }, 0);
  });

  /** Remaining energy capacity (produced minus consumed). */
  availableEnergy = computed<number>(() => this.energyProduced() - this.energyConsumed());

  /** Hourly production rates for each resource based on current skills. */
  productionRates = computed<GameResources>(() => this.buildResourceRates(this.skills()));

  /** Maximum storage capacity for each resource. */
  maxStorage = computed<GameResources>(() => this.buildMaxStorage(this.skills()));

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
   * @param base - The base value at level 1.
   * @param level - The current level.
   * @returns Calculated value, or 0 if level is 0.
   */
  private calcExponential(base: number, level: number): number {
    return level === 0 ? 0 : Math.floor(base * Math.pow(1.5, level - 1));
  }

  /**
   * Calculates cumulative upkeep as the sum of exponential costs from level 1 to `level`.
   * @param base - The base upkeep at level 1.
   * @param level - The current level.
   * @returns Sum of all upkeep costs up to the given level.
   */
  private calcCumulativeUpkeep(base: number, level: number): number {
    let sum = 0;
    for (let i = 1; i <= level; i++) sum += Math.floor(base * Math.pow(1.5, i - 1));
    return sum;
  }

  /**
   * Calculates the production bonus multiplier for a mine based on its upgrades.
   * @param mineId - The base mine skill ID.
   * @param s - The current skills record.
   * @returns Multiplier starting at 1.
   */
  private getMineBonus(mineId: string, s: Record<string, number>): number {
    const sum = (s[`${mineId}_roboter`] || 0) + (s[`${mineId}_transport`] || 0) + (s[`${mineId}_ki`] || 0) + (s[`${mineId}_zug`] || 0);
    return 1 + sum * 0.05;
  }

  /**
   * Builds the full resource production rates per hour from skill levels.
   * @param s - The current skills record.
   * @returns GameResources object containing hourly rates.
   */
  private buildResourceRates(s: Record<string, number>): GameResources {
    return {
      eisen: Math.floor(this.calcExponential(150, s['eisenmine'] || 0) * this.getMineBonus('eisenmine', s)) + (s['transportschiffe'] || 0) * 150,
      silber: Math.floor(this.calcExponential(80, s['silbermine'] || 0) * this.getMineBonus('silbermine', s)),
      gold: Math.floor(this.calcExponential(30, s['goldmine'] || 0) * this.getMineBonus('goldmine', s)),
      xenonit: this.calcExponential(10, s['refinery'] || 0),
      energie: 0,
      credits: this.calcExponential(100, s['trading_post'] || 0) + this.calcExponential(400, s['interstellar_market'] || 0) + this.calcExponential(1500, s['galactic_exchange'] || 0),
      nahrung: this.calcExponential(200, s['biolabor'] || 0) + (s['transportschiffe'] || 0) * 200,
      personal: this.calcExponential(5, s['large_station'] || 0) + this.calcExponential(2, s['orbital_shipyard'] || 0) + (s['kolonisierungsschiffe'] || 0) * 10,
    };
  }

  /**
   * Builds the maximum storage capacity for all resources.
   * @param s - The current skills record.
   * @returns GameResources object containing maximum limits.
   */
  private buildMaxStorage(s: Record<string, number>): GameResources {
    const mult = Math.pow(1.5, s['lager'] || 0) * Math.pow(1.1, s['logistikschiff'] || 0);
    const kol = (s['kolonisierungsschiffe'] || 0) * 1000;
    return {
      eisen: Math.floor(10000 * mult), silber: Math.floor(5000 * mult),
      gold: Math.floor(3000 * mult), xenonit: Math.floor(1000 * mult), energie: 0,
      credits: Math.floor(50000 * mult), nahrung: Math.floor(12000 * mult),
      personal: Math.floor(5000 * mult) + kol,
    };
  }

  /**
   * Subscribes to the Firestore game state document for the given user.
   * @param uid - The authenticated user's UID.
   */
  private loadGameState(uid: string): void {
    if (this.stateSub) this.stateSub();
    const stateRef = doc(this.firestore, `users/${uid}/game/state`);
    this.stateSub = onSnapshot(stateRef, async (docSnap) => {
      if (!docSnap.exists()) await this.initializeDefaultState(stateRef);
      else await this.handleExistingState(docSnap.data() as GameState, stateRef);
    });
  }

  /**
   * Creates a fresh game state document in Firestore and applies it locally.
   * @param stateRef - Firestore document reference.
   * @returns Promise that resolves when initialized.
   */
  private async initializeDefaultState(stateRef: ReturnType<typeof doc>): Promise<void> {
    const initialState = { ...DEFAULT_STATE, lastUpdate: Date.now() };
    await setDoc(stateRef, initialState);
    this.resources.set(initialState.resources);
    this.skills.set(initialState.skills);
    this.isInitialized = true;
  }

  /**
   * Processes an existing Firestore snapshot and applies state.
   * @param state - The raw game state from Firestore.
   * @param stateRef - Firestore document reference for writes.
   * @returns Promise that resolves when handled.
   */
  private async handleExistingState(state: GameState, stateRef: ReturnType<typeof doc>): Promise<void> {
    if (!this.isInitialized && state.lastUpdate) {
      const offlineHours = (Date.now() - state.lastUpdate) / (1000 * 60 * 60);
      if (offlineHours > 0.01) state = await this.processOfflineProgress(state, offlineHours, Date.now(), stateRef);
      this.isInitialized = true;
    }
    this.resources.set(state.resources || DEFAULT_STATE.resources);
    this.skills.set(state.skills || {});
    this.activeMission.set(state.activeMission || null);
  }

  /**
   * Calculates and applies offline resource generation, updating Firestore if significant.
   * @param state - The persisted game state.
   * @param hours - Hours elapsed since last update.
   * @param now - Current timestamp.
   * @param ref - Firestore document reference.
   * @returns The potentially updated game state.
   */
  private async processOfflineProgress(state: GameState, hours: number, now: number, ref: ReturnType<typeof doc>): Promise<GameState> {
    const s = state.skills || {};
    const generated = this.calculateOfflineGenerated(this.buildResourceRates(s), hours);
    if (!this.hasSignificantEarnings(generated)) return state;

    this.offlineEarnings.set(generated);
    const updated = this.applyOfflineEarnings(state.resources, generated, this.buildMaxStorage(s));
    await updateDoc(ref, { resources: updated, lastUpdate: now });
    return { ...state, resources: updated, lastUpdate: now };
  }

  /**
   * Multiplies hourly rates by elapsed hours to get total offline production.
   * @param rates - Hourly production rates.
   * @param offlineHours - Hours elapsed.
   * @returns Generated offline resources.
   */
  private calculateOfflineGenerated(rates: GameResources, offlineHours: number): GameResources {
    return {
      eisen: Math.floor(rates.eisen * offlineHours), silber: Math.floor(rates.silber * offlineHours),
      gold: Math.floor(rates.gold * offlineHours), xenonit: Math.floor(rates.xenonit * offlineHours),
      energie: 0, credits: Math.floor(rates.credits * offlineHours),
      nahrung: Math.floor(rates.nahrung * offlineHours), personal: Math.floor(rates.personal * offlineHours),
    };
  }

  /**
   * Checks whether any resource was produced during offline time.
   * @param g - The generated resource amounts.
   * @returns True if earnings are significant.
   */
  private hasSignificantEarnings(g: GameResources): boolean {
    return g.eisen > 0 || g.silber > 0 || g.gold > 0 || g.xenonit > 0 || g.credits > 0 || g.nahrung > 0 || g.personal > 0;
  }

  /**
   * Adds offline earnings to the current resources, respecting storage caps.
   * @param current - The persisted resource amounts.
   * @param gen - The offline-generated amounts.
   * @param max - The maximum storage capacities.
   * @returns Updated resource amounts.
   */
  private applyOfflineEarnings(current: GameResources, gen: GameResources, max: GameResources): GameResources {
    return {
      eisen: Math.min((current.eisen || 0) + gen.eisen, max.eisen), silber: Math.min((current.silber || 0) + gen.silber, max.silber),
      gold: Math.min((current.gold || 0) + gen.gold, max.gold), xenonit: Math.min((current.xenonit || 0) + gen.xenonit, max.xenonit),
      energie: current.energie || 0, credits: Math.min((current.credits || 0) + gen.credits, max.credits),
      nahrung: Math.min((current.nahrung || 0) + gen.nahrung, max.nahrung), personal: Math.min((current.personal || 0) + gen.personal, max.personal),
    };
  }

  /** Unsubscribes from all listeners, stops the game loop, and resets signals. */
  private clearState(): void {
    if (this.stateSub) { this.stateSub(); this.stateSub = null; }
    if (this.gameLoopInterval) { clearInterval(this.gameLoopInterval); this.gameLoopInterval = null; }
    this.isInitialized = false;
    this.resources.set(DEFAULT_STATE.resources);
    this.skills.set({});
    this.activeMission.set(null);
    this.offlineEarnings.set(null);
  }

  /** Starts the 1-second game loop that updates resources and auto-saves. */
  private startGameLoop(): void {
    if (this.gameLoopInterval) clearInterval(this.gameLoopInterval);
    this.lastTick = Date.now();
    let secondsSinceLastSave = 0;

    this.gameLoopInterval = setInterval(async () => {
      if (!this.isInitialized) return;
      const now = Date.now();
      const deltaMs = now - this.lastTick;
      this.lastTick = now;
      secondsSinceLastSave = await this.executeTick(deltaMs, secondsSinceLastSave);
    }, 1000);
  }

  /**
   * Executes a single game tick calculation.
   * @param deltaMs - Milliseconds elapsed since last tick.
   * @param secs - Seconds since last save.
   * @returns Updated seconds since last save.
   */
  private async executeTick(deltaMs: number, secs: number): Promise<number> {
    const newRes = this.calculateTickResources(deltaMs);
    this.resources.set(newRes);
    return await this.saveIfNeeded(secs + (deltaMs / 1000), newRes);
  }

  /**
   * Calculates new resource values for one game tick.
   * @param deltaMs - Milliseconds elapsed since the last tick.
   * @returns The updated resource state.
   */
  private calculateTickResources(deltaMs: number): GameResources {
    const [rates, cur, max, h] = [this.productionRates(), this.resources(), this.maxStorage(), deltaMs / 3600000];
    return {
      eisen: Math.min(cur.eisen + rates.eisen * h, max.eisen), silber: Math.min(cur.silber + rates.silber * h, max.silber),
      gold: Math.min(cur.gold + rates.gold * h, max.gold), xenonit: Math.min(cur.xenonit + rates.xenonit * h, max.xenonit),
      energie: cur.energie, credits: Math.min(cur.credits + rates.credits * h, max.credits),
      nahrung: Math.min(cur.nahrung + rates.nahrung * h, max.nahrung), personal: Math.min(cur.personal + rates.personal * h, max.personal),
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
   * @param cost - Partial resource cost to check.
   * @returns True if affordable.
   */
  canAfford(cost: Partial<GameResources>): boolean {
    const cur = this.resources();
    const hasEnough = (val: number | undefined, have: number) => !val || have >= val;
    return hasEnough(cost.eisen, cur.eisen) && hasEnough(cost.silber, cur.silber) && hasEnough(cost.gold, cur.gold) &&
           hasEnough(cost.xenonit, cur.xenonit) && hasEnough(cost.energie, this.availableEnergy()) &&
           hasEnough(cost.credits, cur.credits) && hasEnough(cost.nahrung, cur.nahrung) && hasEnough(cost.personal, cur.personal);
  }

  /**
   * Deducts resources from the current state and returns the new values.
   * @param cost - The resource cost to deduct.
   * @returns The updated resource amounts.
   */
  private deductResources(cost: Partial<GameResources>): GameResources {
    const cur = this.resources();
    return {
      eisen: cur.eisen - (cost.eisen || 0), silber: cur.silber - (cost.silber || 0),
      gold: cur.gold - (cost.gold || 0), xenonit: cur.xenonit - (cost.xenonit || 0),
      energie: cur.energie, credits: cur.credits - (cost.credits || 0),
      nahrung: cur.nahrung - (cost.nahrung || 0), personal: cur.personal - (cost.personal || 0),
    };
  }

  /**
   * Upgrades a skill by one level, deducting the required resources.
   * @param skillId - The skill to upgrade.
   * @param cost - The resources required for this upgrade.
   * @throws Error if the player cannot afford the cost or is not authenticated.
   */
  async upgradeSkill(skillId: string, cost: Partial<GameResources>): Promise<void> {
    const user = this.auth.currentUser;
    if (!this.canAfford(cost) || !user) throw new Error('Cannot upgrade');

    const newRes = this.deductResources(cost);
    const newLevel = (this.skills()[skillId] || 0) + 1;
    this.resources.set(newRes);
    this.skills.set({ ...this.skills(), [skillId]: newLevel });

    const stateRef = doc(this.firestore, `users/${user.uid}/game/state`);
    await updateDoc(stateRef, { resources: newRes, [`skills.${skillId}`]: newLevel });
  }

  /**
   * Returns the current level of a skill.
   * @param skillId - The skill ID to look up.
   * @returns The current skill level.
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
    const user = this.auth.currentUser;
    if (!user) throw new Error('Not authenticated');

    const newMission: MissionState = { type, startTime: Date.now(), durationMs, shipCount };
    this.activeMission.set(newMission);
    await updateDoc(doc(this.firestore, `users/${user.uid}/game/state`), { activeMission: newMission });
  }

  /**
   * Adds reward resources to the current state (capped by storage).
   * @param reward - The mission reward amounts.
   * @returns The updated resource state.
   */
  private addRewardCapped(reward: Partial<GameResources>): GameResources {
    const cur = this.resources();
    const max = this.maxStorage();
    return {
      eisen: Math.min(cur.eisen + (reward.eisen || 0), max.eisen), silber: Math.min(cur.silber + (reward.silber || 0), max.silber),
      gold: Math.min(cur.gold + (reward.gold || 0), max.gold), xenonit: Math.min(cur.xenonit + (reward.xenonit || 0), max.xenonit),
      energie: Math.min(cur.energie + (reward.energie || 0), max.energie), credits: Math.min(cur.credits + (reward.credits || 0), max.credits),
      nahrung: Math.min(cur.nahrung + (reward.nahrung || 0), max.nahrung), personal: Math.min(cur.personal + (reward.personal || 0), max.personal),
    };
  }

  /**
   * Completes the active mission, awards resources, and clears the mission state.
   * @param reward - The resource reward for completing the mission.
   * @throws Error if the player is not authenticated.
   */
  async completeMission(reward: Partial<GameResources>): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('Not authenticated');

    const newRes = this.addRewardCapped(reward);
    this.resources.set(newRes);
    this.activeMission.set(null);
    await updateDoc(doc(this.firestore, `users/${user.uid}/game/state`), { resources: newRes, activeMission: null });
  }

  /**
   * Returns the credit value per unit when selling a resource.
   * @param resourceId - The resource to sell.
   * @returns The sell rate.
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
   * @param resourceId - The resource to buy.
   * @returns The buy rate.
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
   * @param resId - The resource to sell.
   * @param amount - Number of units to sell.
   * @returns Promise resolving on completion.
   */
  async sellResource(resId: keyof GameResources, amount: number): Promise<void> {
    const user = this.auth.currentUser;
    const cur = this.resources();
    if (!user || (cur[resId] || 0) < amount) return;

    const earned = this.getSellRate(resId) * amount;
    const newRes = { ...cur, [resId]: cur[resId] - amount, credits: Math.min(cur.credits + earned, this.maxStorage().credits) };

    this.resources.set(newRes);
    await updateDoc(doc(this.firestore, `users/${user.uid}/game/state`), { resources: newRes });
  }

  /**
   * Buys a specified amount of a resource using credits.
   * @param resId - The resource to buy.
   * @param amount - Number of units to buy.
   * @returns Promise resolving on completion.
   */
  async buyResource(resId: keyof GameResources, amount: number): Promise<void> {
    const user = this.auth.currentUser;
    const cur = this.resources();
    const cost = this.getBuyRate(resId) * amount;
    if (!user || cur.credits < cost) return;

    const maxAmt = (this.maxStorage() as unknown as Record<string, number>)[resId] || (cur[resId] || 0) + amount;
    const newRes = { ...cur, credits: cur.credits - cost, [resId]: Math.min((cur[resId] || 0) + amount, maxAmt) };

    this.resources.set(newRes);
    await updateDoc(doc(this.firestore, `users/${user.uid}/game/state`), { resources: newRes });
  }
}

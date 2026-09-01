import { Injectable, inject, signal, computed } from '@angular/core';
import { Auth, user } from '@angular/fire/auth';
import { Firestore, doc, onSnapshot, setDoc, updateDoc } from '@angular/fire/firestore';
import { Subscription } from 'rxjs';
import { GameResources, MissionState, GameState, DEFAULT_STATE, SHIP_IDS, ENERGY_UPKEEP, ActiveBuild } from './game-state.types';
import * as MathUtils from './game-math.utils';

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

  /** Currently active building processes. */
  activeBuilds = signal<Record<string, ActiveBuild>>({});

  /** Currently running mission, or `null` if idle. */
  activeMission = signal<MissionState | null>(null);

  /** Currently running battle mission, or `null` if idle. */
  activeBattle = signal<MissionState | null>(null);

  /** Whether the enemy faction is activated and actively raiding. */
  enemyActivated = signal<boolean>(false);

  /** Timestamp of the last enemy attack attempt. */
  lastEnemyAttack = signal<number>(0);

  /** Resources earned while offline, shown in the welcome-back dialog. */
  offlineEarnings = signal<GameResources | null>(null);

  /** Total energy capacity produced by all power plants. */
  energyProduced = computed<number>(() => {
    return MathUtils.calcTotalEnergyProduced(this.skills());
  });

  /** Total energy consumed by all buildings and ships. */
  energyConsumed = computed<number>(() => {
    return MathUtils.calcTotalEnergyConsumed(this.skills());
  });

  /** Remaining energy capacity (produced minus consumed). */
  availableEnergy = computed<number>(() => this.energyProduced() - this.energyConsumed());

  /** Hourly production rates for each resource based on current skills and energy state. */
  productionRates = computed<GameResources>(() => MathUtils.buildResourceRates(this.skills(), this.availableEnergy()));

  /** Maximum storage capacity for each resource. */
  maxStorage = computed<GameResources>(() => MathUtils.buildMaxStorage(this.skills()));

  /** Total number of battle ships owned. */
  totalBattleShips = computed<number>(() => MathUtils.calcTotalBattleShips(this.skills()));

  /** Total offensive fleet combat power. */
  fleetStrength = computed<number>(() => MathUtils.calcPlayerFleetStrength(this.skills()));

  /** Total defensive power of Planetary Defense and its sub-upgrades. */
  planetaryDefenseStrength = computed<number>(() => MathUtils.calcPlanetaryDefenseStrength(this.skills()));

  /** Percentage of resource losses mitigated by Planetary Defense during attacks (0 to 0.85). */
  defenseDamageReduction = computed<number>(() => MathUtils.calcDefenseDamageReduction(this.skills()));

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
   * Subscribes to the Firestore game state document for the given user.
   * Prevents premature resets during cache misses by waiting for server sync.
   * @param uid - The authenticated user's UID.
   */
  private loadGameState(uid: string): void {
    if (this.stateSub) this.stateSub();
    const stateRef = doc(this.firestore, `users/${uid}/game/state`);
    this.stateSub = onSnapshot(
      stateRef,
      async (docSnap) => {
        // If snapshot is from cache and document does not exist, wait for server sync to avoid hard resets
        if (docSnap.metadata.fromCache && !docSnap.exists()) {
          console.warn('Game state not found in local cache, waiting for server sync...');
          return;
        }

        if (!docSnap.exists()) {
          await this.initializeDefaultState(stateRef);
        } else {
          const data = docSnap.data() as GameState;
          if (data) {
            await this.handleExistingState(data, stateRef);
          }
        }
      },
      (error) => {
        console.error('Error in game state snapshot listener:', error);
      }
    );
  }

  /**
   * Creates a fresh game state document in Firestore and applies it locally.
   * Uses merge to prevent overwriting existing partial data.
   * @param stateRef - Firestore document reference.
   * @returns Promise that resolves when initialized.
   */
  private async initializeDefaultState(stateRef: ReturnType<typeof doc>): Promise<void> {
    const initialState = { ...DEFAULT_STATE, lastUpdate: Date.now() };
    await setDoc(stateRef, initialState, { merge: true });
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
    if (!state) return;
    if (!this.isInitialized && state.lastUpdate) {
      const offlineHours = (Date.now() - state.lastUpdate) / (1000 * 60 * 60);
      if (offlineHours > 0.01) state = await this.processOfflineProgress(state, offlineHours, Date.now(), stateRef);
      this.isInitialized = true;
    }
    this.resources.set(state.resources || DEFAULT_STATE.resources);
    this.skills.set(state.skills || {});
    this.activeMission.set(state.activeMission || null);
    this.activeBattle.set(state.activeBattle || null);
    this.enemyActivated.set(state.enemyActivated ?? false);
    this.lastEnemyAttack.set(state.lastEnemyAttack || 0);
    
    // Check for offline completed builds and update state if needed
    let builds = { ...(state.activeBuilds || {}) };
    let skillsObj = { ...(state.skills || {}) };
    let changed = false;
    const now = Date.now();
    for (const [id, build] of Object.entries(builds)) {
      if (build.finishTime <= now) {
        skillsObj[id] = (skillsObj[id] || 0) + 1;
        delete builds[id];
        changed = true;
      }
    }
    
    this.activeBuilds.set(builds);
    if (changed) {
      this.skills.set(skillsObj);
      await updateDoc(stateRef, { skills: skillsObj, activeBuilds: builds });
    }
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
    const generated = MathUtils.calculateOfflineGenerated(MathUtils.buildResourceRates(s), hours);
    if (!MathUtils.hasSignificantEarnings(generated)) return state;

    this.offlineEarnings.set(generated);
    const updated = MathUtils.applyOfflineEarnings(state.resources, generated, MathUtils.buildMaxStorage(s));
    await updateDoc(ref, { resources: updated, lastUpdate: now });
    return { ...state, resources: updated, lastUpdate: now };
  }

  /** Unsubscribes from all listeners, stops the game loop, and resets signals. */
  private clearState(): void {
    if (this.stateSub) { this.stateSub(); this.stateSub = null; }
    if (this.gameLoopInterval) { clearInterval(this.gameLoopInterval); this.gameLoopInterval = null; }
    this.isInitialized = false;
    this.resources.set(DEFAULT_STATE.resources);
    this.skills.set({});
    this.activeMission.set(null);
    this.activeBattle.set(null);
    this.enemyActivated.set(false);
    this.lastEnemyAttack.set(0);
    this.activeBuilds.set({});
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
    const newRes = MathUtils.calculateTickResources(this.productionRates(), this.resources(), this.maxStorage(), deltaMs);
    this.resources.set(newRes);
    return await this.saveIfNeeded(secs + (deltaMs / 1000), newRes);
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
   * Starts a building/upgrade process, deducting resources and setting a timer.
   * @param skillId - The skill to upgrade.
   * @param cost - The resources to deduct.
   * @param durationMs - The duration of the build.
   */
  async startBuild(skillId: string, cost: Partial<GameResources>, durationMs: number): Promise<void> {
    const user = this.auth.currentUser;
    if (!this.canAfford(cost) || !user) throw new Error('Cannot afford');

    const newRes = MathUtils.deductResources(this.resources(), cost);
    this.resources.set(newRes);

    const build: ActiveBuild = { finishTime: Date.now() + durationMs, totalDurationMs: durationMs };
    const newBuilds = { ...this.activeBuilds(), [skillId]: build };
    this.activeBuilds.set(newBuilds);

    const stateRef = doc(this.firestore, `users/${user.uid}/game/state`);
    await updateDoc(stateRef, { resources: newRes, activeBuilds: newBuilds });
  }

  /**
   * Completes a building process, upgrades the skill, and removes the active build.
   * @param skillId - The skill that finished building.
   */
  async completeBuild(skillId: string): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('Not authenticated');

    const newLevel = (this.skills()[skillId] || 0) + 1;
    this.skills.set({ ...this.skills(), [skillId]: newLevel });

    const newBuilds = { ...this.activeBuilds() };
    delete newBuilds[skillId];
    this.activeBuilds.set(newBuilds);

    const stateRef = doc(this.firestore, `users/${user.uid}/game/state`);
    await updateDoc(stateRef, { [`skills.${skillId}`]: newLevel, activeBuilds: newBuilds });
  }

  /**
   * Deducts the given cost from the player's resources immediately.
   * @param cost - The resources to deduct.
   * @throws Error if the player cannot afford the cost or is not authenticated.
   */
  async deductCost(cost: Partial<GameResources>): Promise<void> {
    const user = this.auth.currentUser;
    if (!this.canAfford(cost) || !user) throw new Error('Cannot afford');

    const newRes = MathUtils.deductResources(this.resources(), cost);
    this.resources.set(newRes);

    const stateRef = doc(this.firestore, `users/${user.uid}/game/state`);
    await updateDoc(stateRef, { resources: newRes });
  }

  /**
   * Upgrades a skill by one level without deducting cost (should be called after deductCost).
   * @param skillId - The skill to upgrade.
   * @throws Error if the player is not authenticated.
   */
  async upgradeSkillLevel(skillId: string): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('Not authenticated');

    const newLevel = (this.skills()[skillId] || 0) + 1;
    this.skills.set({ ...this.skills(), [skillId]: newLevel });

    const stateRef = doc(this.firestore, `users/${user.uid}/game/state`);
    await updateDoc(stateRef, { [`skills.${skillId}`]: newLevel });
  }

  /**
   * Upgrades a skill by one level, deducting the required resources immediately.
   * Legacy method for immediate upgrades without progress bar.
   * @param skillId - The skill to upgrade.
   * @param cost - The resources required for this upgrade.
   * @throws Error if the player cannot afford the cost or is not authenticated.
   */
  async upgradeSkill(skillId: string, cost: Partial<GameResources>): Promise<void> {
    await this.deductCost(cost);
    await this.upgradeSkillLevel(skillId);
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
   * Completes the active mission, awards resources, and clears the mission state.
   * @param reward - The resource reward for completing the mission.
   * @throws Error if the player is not authenticated.
   */
  async completeMission(reward: Partial<GameResources>): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('Not authenticated');

    const newRes = MathUtils.addRewardCapped(this.resources(), reward, this.maxStorage());
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
    return MathUtils.getSellRate(resourceId, this.skills());
  }

  /**
   * Returns the credit cost per unit when buying a resource.
   * @param resourceId - The resource to buy.
   * @returns The buy rate.
   */
  getBuyRate(resourceId: string): number {
    return MathUtils.getBuyRate(resourceId, this.skills());
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

  /**
   * Starts a battle offensive mission with deployed battle ships.
   * @param shipCount - Number of battle ships sent into combat.
   * @param durationMs - Duration of the attack mission.
   */
  async startBattle(shipCount: number, durationMs: number): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('Not authenticated');

    const newBattle: MissionState = { type: 'fleet_battle', startTime: Date.now(), durationMs, shipCount };
    this.activeBattle.set(newBattle);
    await updateDoc(doc(this.firestore, `users/${user.uid}/game/state`), { activeBattle: newBattle });
  }

  /**
   * Completes the battle mission, awards war booty, and activates the enemy faction.
   * @param reward - War booty resource reward.
   */
  async completeBattle(reward: Partial<GameResources>): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('Not authenticated');

    const newRes = MathUtils.addRewardCapped(this.resources(), reward, this.maxStorage());
    this.resources.set(newRes);
    this.activeBattle.set(null);
    this.enemyActivated.set(true);
    await updateDoc(doc(this.firestore, `users/${user.uid}/game/state`), {
      resources: newRes,
      activeBattle: null,
      enemyActivated: true,
    });
  }

  /**
   * Fulfills enemy diplomatic demands, stopping enemy attacks.
   * @param demands - Demanded resources from enemy faction.
   */
  async payDiplomacyDemands(demands: Partial<GameResources>): Promise<void> {
    const user = this.auth.currentUser;
    if (!user || !this.canAfford(demands)) throw new Error('Cannot afford diplomacy tribute');

    const newRes = MathUtils.deductResources(this.resources(), demands);
    this.resources.set(newRes);
    this.enemyActivated.set(false);
    await updateDoc(doc(this.firestore, `users/${user.uid}/game/state`), {
      resources: newRes,
      enemyActivated: false,
    });
  }

  /**
   * Deactivates the enemy faction.
   */
  async deactivateEnemy(): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) return;
    this.enemyActivated.set(false);
    await updateDoc(doc(this.firestore, `users/${user.uid}/game/state`), { enemyActivated: false });
  }

  /**
   * Applies resource losses from an enemy raid defeat and updates the attack timestamp.
   * @param losses - Deducted resources.
   */
  async applyEnemyAttackLosses(losses: Partial<GameResources>): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) return;

    const newRes = MathUtils.deductResources(this.resources(), losses);
    const now = Date.now();
    this.resources.set(newRes);
    this.lastEnemyAttack.set(now);
    await updateDoc(doc(this.firestore, `users/${user.uid}/game/state`), {
      resources: newRes,
      lastEnemyAttack: now,
    });
  }

  /**
   * Awards bonus loot from a successfully repelled enemy attack and updates the attack timestamp.
   * @param reward - Bonus loot.
   */
  async applyEnemyAttackVictoryReward(reward: Partial<GameResources>): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) return;

    const newRes = MathUtils.addRewardCapped(this.resources(), reward, this.maxStorage());
    const now = Date.now();
    this.resources.set(newRes);
    this.lastEnemyAttack.set(now);
    await updateDoc(doc(this.firestore, `users/${user.uid}/game/state`), {
      resources: newRes,
      lastEnemyAttack: now,
    });
  }
}


import { GameResources } from './game-state.types';

/**
 * Calculates an exponential value using the formula: `base * 1.5^(level-1)`.
 * Used for building production and capacity limits.
 * @param base - The base value at level 1.
 * @param level - The current level of the building or skill.
 * @returns The calculated exponential value, or 0 if the level is 0.
 */
export function calcExponential(base: number, level: number): number {
  return level === 0 ? 0 : Math.floor(base * Math.pow(1.5, level - 1));
}

/**
 * Calculates cumulative upkeep as the sum of exponential costs from level 1 up to the current `level`.
 * @param base - The base upkeep cost at level 1.
 * @param level - The current level of the building.
 * @returns The total sum of upkeep costs across all levels.
 */
export function calcCumulativeUpkeep(base: number, level: number): number {
  let sum = 0;
  for (let i = 1; i <= level; i++) sum += Math.floor(base * Math.pow(1.5, i - 1));
  return sum;
}

/**
 * Calculates the production bonus multiplier for a mine based on its specific technology upgrades.
 * @param mineId - The base skill ID of the mine (e.g., 'eisenmine').
 * @param s - A record containing the current skill levels of the player.
 * @returns The calculated multiplier starting at 1 (e.g., 1.15 for a 15% bonus).
 */
export function getMineBonus(mineId: string, s: Record<string, number>): number {
  const sum = (s[`${mineId}_roboter`] || 0) + (s[`${mineId}_transport`] || 0) + (s[`${mineId}_ki`] || 0) + (s[`${mineId}_zug`] || 0);
  return 1 + sum * 0.05;
}

/**
 * Builds the full resource production rates per hour based on current skill and building levels.
 * @param s - A record containing the current skill levels of the player.
 * @returns A `GameResources` object containing the hourly production rates.
 */
export function buildResourceRates(s: Record<string, number>): GameResources {
  return {
    eisen: Math.floor(calcExponential(150, s['eisenmine'] || 0) * getMineBonus('eisenmine', s)) + (s['transportschiffe'] || 0) * 150,
    silber: Math.floor(calcExponential(80, s['silbermine'] || 0) * getMineBonus('silbermine', s)),
    gold: Math.floor(calcExponential(30, s['goldmine'] || 0) * getMineBonus('goldmine', s)),
    xenonit: calcExponential(10, s['refinery'] || 0),
    energie: 0,
    credits: calcExponential(100, s['trading_post'] || 0) + calcExponential(400, s['interstellar_market'] || 0) + calcExponential(1500, s['galactic_exchange'] || 0),
    nahrung: calcExponential(200, s['biolabor'] || 0) + (s['transportschiffe'] || 0) * 200,
    personal: calcExponential(5, s['large_station'] || 0) + calcExponential(2, s['orbital_shipyard'] || 0) + (s['kolonisierungsschiffe'] || 0) * 10,
  };
}

/**
 * Builds the maximum storage capacity for all resources based on storage buildings and logistics.
 * @param s - A record containing the current skill levels of the player.
 * @returns A `GameResources` object containing the maximum limits for each resource.
 */
export function buildMaxStorage(s: Record<string, number>): GameResources {
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
 * Multiplies hourly rates by the elapsed offline hours to determine total offline production.
 * @param rates - The hourly production rates.
 * @param offlineHours - The number of hours the player was offline.
 * @returns A `GameResources` object containing the resources generated while offline.
 */
export function calculateOfflineGenerated(rates: GameResources, offlineHours: number): GameResources {
  return {
    eisen: Math.floor(rates.eisen * offlineHours), silber: Math.floor(rates.silber * offlineHours),
    gold: Math.floor(rates.gold * offlineHours), xenonit: Math.floor(rates.xenonit * offlineHours),
    energie: 0, credits: Math.floor(rates.credits * offlineHours),
    nahrung: Math.floor(rates.nahrung * offlineHours), personal: Math.floor(rates.personal * offlineHours),
  };
}

/**
 * Checks whether any resource was produced in a significant amount during offline time.
 * @param g - The generated resource amounts.
 * @returns `true` if at least one resource was generated, `false` otherwise.
 */
export function hasSignificantEarnings(g: GameResources): boolean {
  return g.eisen > 0 || g.silber > 0 || g.gold > 0 || g.xenonit > 0 || g.credits > 0 || g.nahrung > 0 || g.personal > 0;
}

/**
 * Adds offline earnings to the current resources while respecting the maximum storage caps.
 * @param current - The current resource amounts before offline earnings are added.
 * @param gen - The offline-generated resource amounts.
 * @param max - The maximum storage capacities for each resource.
 * @returns A `GameResources` object representing the updated resources.
 */
export function applyOfflineEarnings(current: GameResources, gen: GameResources, max: GameResources): GameResources {
  return {
    eisen: Math.min((current.eisen || 0) + gen.eisen, max.eisen), silber: Math.min((current.silber || 0) + gen.silber, max.silber),
    gold: Math.min((current.gold || 0) + gen.gold, max.gold), xenonit: Math.min((current.xenonit || 0) + gen.xenonit, max.xenonit),
    energie: current.energie || 0, credits: Math.min((current.credits || 0) + gen.credits, max.credits),
    nahrung: Math.min((current.nahrung || 0) + gen.nahrung, max.nahrung), personal: Math.min((current.personal || 0) + gen.personal, max.personal),
  };
}

/**
 * Calculates new resource values for a single game tick based on elapsed time.
 * @param rates - The hourly production rates.
 * @param cur - The current resource amounts.
 * @param max - The maximum storage capacities for each resource.
 * @param deltaMs - The milliseconds elapsed since the last game tick.
 * @returns A `GameResources` object representing the resources after the tick.
 */
export function calculateTickResources(rates: GameResources, cur: GameResources, max: GameResources, deltaMs: number): GameResources {
  const h = deltaMs / 3600000;
  return {
    eisen: Math.min(cur.eisen + rates.eisen * h, max.eisen), silber: Math.min(cur.silber + rates.silber * h, max.silber),
    gold: Math.min(cur.gold + rates.gold * h, max.gold), xenonit: Math.min(cur.xenonit + rates.xenonit * h, max.xenonit),
    energie: cur.energie, credits: Math.min(cur.credits + rates.credits * h, max.credits),
    nahrung: Math.min(cur.nahrung + rates.nahrung * h, max.nahrung), personal: Math.min(cur.personal + rates.personal * h, max.personal),
  };
}

/**
 * Deducts a specified resource cost from the current state and returns the new values.
 * @param cur - The current resource amounts.
 * @param cost - The partial resource cost to deduct.
 * @returns A `GameResources` object representing the resources after deduction.
 */
export function deductResources(cur: GameResources, cost: Partial<GameResources>): GameResources {
  return {
    eisen: cur.eisen - (cost.eisen || 0), silber: cur.silber - (cost.silber || 0),
    gold: cur.gold - (cost.gold || 0), xenonit: cur.xenonit - (cost.xenonit || 0),
    energie: cur.energie, credits: cur.credits - (cost.credits || 0),
    nahrung: cur.nahrung - (cost.nahrung || 0), personal: cur.personal - (cost.personal || 0),
  };
}

/**
 * Adds reward resources from a mission to the current state, capped by maximum storage.
 * @param cur - The current resource amounts.
 * @param reward - The partial resource reward amounts to add.
 * @param max - The maximum storage capacities for each resource.
 * @returns A `GameResources` object representing the resources after adding the reward.
 */
export function addRewardCapped(cur: GameResources, reward: Partial<GameResources>, max: GameResources): GameResources {
  return {
    eisen: Math.min(cur.eisen + (reward.eisen || 0), max.eisen), silber: Math.min(cur.silber + (reward.silber || 0), max.silber),
    gold: Math.min(cur.gold + (reward.gold || 0), max.gold), xenonit: Math.min(cur.xenonit + (reward.xenonit || 0), max.xenonit),
    energie: Math.min(cur.energie + (reward.energie || 0), max.energie), credits: Math.min(cur.credits + (reward.credits || 0), max.credits),
    nahrung: Math.min(cur.nahrung + (reward.nahrung || 0), max.nahrung), personal: Math.min(cur.personal + (reward.personal || 0), max.personal),
  };
}

/**
 * Returns the credit value per unit when selling a specific resource on the market.
 * @param resourceId - The string identifier of the resource.
 * @param s - A record containing the current skill levels of the player.
 * @returns The calculated sell rate in credits.
 */
export function getSellRate(resourceId: string, s: Record<string, number>): number {
  const baseRates: Record<string, number> = { eisen: 1, silber: 5, gold: 20, xenonit: 100 };
  const base = baseRates[resourceId] || 0;
  const multiplier = 1 + (s['trading_post'] || 0) * 0.05 + (s['interstellar_market'] || 0) * 0.1 + (s['galactic_exchange'] || 0) * 0.2;
  return Math.floor(base * multiplier);
}

/**
 * Returns the credit cost per unit when buying a specific resource on the market.
 * @param resourceId - The string identifier of the resource.
 * @param s - A record containing the current skill levels of the player.
 * @returns The calculated buy rate in credits.
 */
export function getBuyRate(resourceId: string, s: Record<string, number>): number {
  const baseRates: Record<string, number> = { eisen: 2, silber: 10, gold: 40, xenonit: 200, nahrung: 5, personal: 50 };
  const base = baseRates[resourceId] || 0;
  const discount = Math.min(0.5, (s['interstellar_market'] || 0) * 0.02 + (s['galactic_exchange'] || 0) * 0.05);
  return Math.max(1, Math.floor(base * (1 - discount)));
}

import { GameResources, ENERGY_UPKEEP, SHIP_IDS } from './game-state.types';

/**
 * Formats a number into a compact, human-readable string using K, M, B suffixes.
 * Numbers below 1000 are returned as-is (whole integers).
 * Examples: 100000 → "100K", 1230500 → "1.23M", 999 → "999".
 * @param value - The numeric value to format.
 * @returns A compact string representation of the number.
 */
export function formatNumber(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';

  if (abs >= 1_000_000_000) {
    return sign + parseFloat((abs / 1_000_000_000).toFixed(2)) + 'B';
  }
  if (abs >= 1_000_000) {
    return sign + parseFloat((abs / 1_000_000).toFixed(2)) + 'M';
  }
  if (abs >= 1_000) {
    return sign + parseFloat((abs / 1_000).toFixed(2)) + 'K';
  }
  return sign + Math.floor(abs).toString();
}

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
 * Calculates total energy produced by all power plants including their sub-upgrades.
 * @param s - A record containing the current skill levels of the player.
 * @returns Total energy production capacity.
 */
export function calcTotalEnergyProduced(s: Record<string, number>): number {
  const solarBonus = 1 + ((s['solar_erweiterte_panele'] || 0) + (s['solar_thermische_speicher'] || 0) + (s['solar_orbitalspiegel'] || 0) + (s['solar_dyson_schwarm'] || 0)) * 0.05;
  const fusionBonus = 1 + ((s['fusion_plasma_eindaemmung'] || 0) + (s['fusion_deuterium_anreicherung'] || 0) + (s['fusion_laser_katalysator'] || 0) + (s['fusion_kaltfusions_matrix'] || 0)) * 0.05;
  const antimaterieBonus = 1 + ((s['antimaterie_positronen'] || 0) + (s['antimaterie_magnetfelder'] || 0) + (s['antimaterie_subraumkuehlung'] || 0) + (s['antimaterie_nullpunkt'] || 0)) * 0.05;

  return Math.floor(calcExponential(200, s['solarkraftwerk'] || 0) * solarBonus) +
         Math.floor(calcExponential(800, s['fusionsreaktor'] || 0) * fusionBonus) +
         Math.floor(calcExponential(3000, s['antimaterie'] || 0) * antimaterieBonus);
}

/**
 * Calculates total energy consumed by all active buildings and ships.
 * @param s - A record containing the current skill levels of the player.
 * @returns Total energy consumption.
 */
export function calcTotalEnergyConsumed(s: Record<string, number>): number {
  return Object.entries(s).reduce((total, [id, level]) => {
    if (!ENERGY_UPKEEP[id]) return total;
    return total + (SHIP_IDS.includes(id) ? ENERGY_UPKEEP[id] * level : calcCumulativeUpkeep(ENERGY_UPKEEP[id], level));
  }, 0);
}

/**
 * Calculates available energy (produced minus consumed).
 * @param s - A record containing the current skill levels of the player.
 * @returns Remaining energy capacity.
 */
export function calcAvailableEnergy(s: Record<string, number>): number {
  return calcTotalEnergyProduced(s) - calcTotalEnergyConsumed(s);
}

/**
 * Builds the full resource production rates per hour based on current skill and building levels.
 * When energy is depleted (availableEnergy <= 0), mines shut down and produce 0.
 * @param s - A record containing the current skill levels of the player.
 * @param availableEnergy - Optional precomputed available energy value.
 * @returns A `GameResources` object containing the hourly production rates.
 */
export function buildResourceRates(s: Record<string, number>, availableEnergy?: number): GameResources {
  const hasPower = (availableEnergy !== undefined ? availableEnergy : calcAvailableEnergy(s)) > 0;

  const kiGlobalBonus = 1 + ((s['ki_automatisierung'] || 0) * 0.02) +
    ((s['ki_neuronale_netze'] || 0) + (s['ki_quanten_prozessoren'] || 0) + (s['ki_selbstlernend'] || 0) + (s['ki_bewusstsein'] || 0)) * 0.01;

  const refineryBonus = 1 + ((s['refinery_thermalschmelze'] || 0) + (s['refinery_katalytische_konverter'] || 0) + (s['refinery_plasma_extraktion'] || 0) + (s['refinery_antimaterie_anreicherung'] || 0)) * 0.05;

  const tradePostBonus = 1 + ((s['trade_lokale_gilden'] || 0) + (s['trade_frachtdrohnen'] || 0) + (s['trade_schwarzmarkt'] || 0) + (s['trade_planetarer_zoll'] || 0)) * 0.05;
  const marketBonus = 1 + ((s['market_kartographierung'] || 0) + (s['market_subraum_komm'] || 0) + (s['market_geleitschutz'] || 0) + (s['market_banken'] || 0)) * 0.05;
  const exchangeBonus = 1 + ((s['exchange_hft'] || 0) + (s['exchange_megakonzern'] || 0) + (s['exchange_monopol'] || 0) + (s['exchange_waehrungsamt'] || 0)) * 0.05;

  const bioBonus = 1 + ((s['bio_gen_sequenzierer'] || 0) + (s['bio_hydroponik'] || 0) + (s['bio_zell_regeneration'] || 0) + (s['bio_klon_vat'] || 0)) * 0.05;

  const stationBonus = 1 + ((s['station_verstaerkte_huelle'] || 0) + (s['station_hydroponische_gaerten'] || 0) + (s['station_kommerz_hub'] || 0) + (s['station_orbitaler_verteidigungsring'] || 0)) * 0.05;

  // Mines produce only if empire has positive available energy
  const eisenHourly = hasPower ? Math.floor((calcExponential(150, s['eisenmine'] || 0) * getMineBonus('eisenmine', s) + (s['transportschiffe'] || 0) * 150) * kiGlobalBonus) : 0;
  const silberHourly = hasPower ? Math.floor((calcExponential(80, s['silbermine'] || 0) * getMineBonus('silbermine', s)) * kiGlobalBonus) : 0;
  const goldHourly = hasPower ? Math.floor((calcExponential(30, s['goldmine'] || 0) * getMineBonus('goldmine', s)) * kiGlobalBonus) : 0;
  const xenonitHourly = hasPower ? Math.floor(calcExponential(10, s['refinery'] || 0) * refineryBonus * kiGlobalBonus) : 0;

  const creditsHourly = Math.floor(
    (calcExponential(100, s['trading_post'] || 0) * tradePostBonus +
     calcExponential(400, s['interstellar_market'] || 0) * marketBonus +
     calcExponential(1500, s['galactic_exchange'] || 0) * exchangeBonus) * kiGlobalBonus
  );

  const nahrungHourly = Math.floor(
    (calcExponential(200, s['biolabor'] || 0) * bioBonus + (s['transportschiffe'] || 0) * 200) * kiGlobalBonus
  );

  const personalHourly = Math.floor(
    (calcExponential(5, s['large_station'] || 0) * stationBonus + (s['kolonisierungsschiffe'] || 0) * 10) * kiGlobalBonus
  );

  return {
    eisen: eisenHourly,
    silber: silberHourly,
    gold: goldHourly,
    xenonit: xenonitHourly,
    energie: 0,
    credits: creditsHourly,
    nahrung: nahrungHourly,
    personal: personalHourly,
  };
}

/**
 * Builds the maximum storage capacity for all resources based on storage buildings and logistics.
 * @param s - A record containing the current skill levels of the player.
 * @returns A `GameResources` object containing the maximum limits for each resource.
 */
export function buildMaxStorage(s: Record<string, number>): GameResources {
  const lagerSubBonus = 1 + ((s['lager_erweiterte_ladebucht'] || 0) + (s['lager_automatisierte_logistik'] || 0) + (s['lager_quantenspeicher'] || 0) + (s['lager_subraum_kompression'] || 0)) * 0.05;
  const mult = Math.pow(1.5, s['lager'] || 0) * lagerSubBonus * Math.pow(1.1, s['logistikschiff'] || 0);
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

/**
 * Calculates the current cost for an upgrade at the given level, applying global discounts.
 * Nano-Bots reduce the cost of Eisen and Silber by 1% per level (up to 50%).
 * @param baseCost - The base resource cost at level 1.
 * @param multiplier - The multiplicative cost scaling factor per level.
 * @param currentLevel - The current level of the skill/building.
 * @param skills - A record containing the current skill levels of the player.
 * @returns A `GameResources` object representing the discounted cost.
 */
export function calculateCost(
  baseCost: Partial<GameResources>,
  multiplier: number,
  currentLevel: number,
  skills: Record<string, number>
): Partial<GameResources> {
  const cost: Partial<GameResources> = {};
  const mult = Math.pow(multiplier, currentLevel);
  
  const nanoLvl = skills['nano_bots'] || 0;
  const nanoSubBonus = ((skills['nano_krabbler'] || 0) + (skills['nano_schweisser'] || 0) + (skills['nano_reparatur'] || 0) + (skills['nano_replikator'] || 0)) * 0.005;
  const discount = Math.min(0.5, nanoLvl * 0.01 + nanoSubBonus);

  for (const [key, val] of Object.entries(baseCost)) {
    if (val !== undefined) {
      let finalVal = val * mult;
      if (key === 'eisen' || key === 'silber' || key === 'gold') {
        finalVal = finalVal * (1 - discount);
      }
      (cost as any)[key] = Math.floor(finalVal);
    }
  }
  return cost;
}

/**
 * Calculates the total number of battle ships owned by the player.
 * @param s - Skills map.
 * @returns Total count of all combat ships.
 */
export function calcTotalBattleShips(s: Record<string, number>): number {
  return (s['leichter_jaeger'] || 0) + (s['schwerer_jaeger'] || 0) + (s['zerstoerer'] || 0) + (s['kreuzer'] || 0);
}

/**
 * Calculates the total offensive attack strength of all owned battle ships.
 * @param s - Skills map.
 * @returns Combined fleet combat strength.
 */
export function calcPlayerFleetStrength(s: Record<string, number>): number {
  return (
    (s['leichter_jaeger'] || 0) * 10 +
    (s['schwerer_jaeger'] || 0) * 35 +
    (s['zerstoerer'] || 0) * 150 +
    (s['kreuzer'] || 0) * 600
  );
}

/**
 * Calculates the total defensive power of Planetary Defense and its sub-upgrades.
 * @param s - Skills map.
 * @returns Combined planetary defense rating.
 */
export function calcPlanetaryDefenseStrength(s: Record<string, number>): number {
  const baseDefense = (s['planetary_defense'] || 0) * 100;
  const subBonus =
    1 +
    ((s['defense_railguns'] || 0) +
      (s['defense_plasmakanonen'] || 0) +
      (s['defense_schildgeneratoren'] || 0) +
      (s['defense_tachyonen_lanzen'] || 0)) *
      0.05;
  return Math.floor(baseDefense * subBonus);
}

/**
 * Calculates the percentage of resource losses mitigated by Planetary Defense during a defeat.
 * @param s - Skills map.
 * @returns Fraction between 0 and 0.85 (e.g., 0.60 = 60% damage reduction).
 */
export function calcDefenseDamageReduction(s: Record<string, number>): number {
  const pdLvl = s['planetary_defense'] || 0;
  if (pdLvl <= 0) return 0;
  const baseRed = pdLvl * 0.05;
  const subRed =
    ((s['defense_railguns'] || 0) +
      (s['defense_plasmakanonen'] || 0) +
      (s['defense_schildgeneratoren'] || 0) +
      (s['defense_tachyonen_lanzen'] || 0)) *
    0.025;
  return Math.min(0.85, baseRed + subRed);
}

/**
 * Generates war booty rewards for a successful fleet offensive based on fleet strength.
 * @param fleetStrength - Combined combat power of deployed ships.
 * @returns Loot reward object.
 */
export function calcBattleBooty(fleetStrength: number): Partial<GameResources> {
  const variance = () => 0.8 + Math.random() * 0.4; // 0.8 to 1.2
  return {
    eisen: Math.floor(Math.max(200, fleetStrength * 15 * variance())),
    silber: Math.floor(Math.max(80, fleetStrength * 6 * variance())),
    gold: Math.floor(Math.max(20, fleetStrength * 1.5 * variance())),
    xenonit: fleetStrength >= 100 ? Math.floor(fleetStrength * 0.25 * variance()) : 0,
    credits: Math.floor(Math.max(100, fleetStrength * 10 * variance())),
  };
}

/**
 * Calculates fair and reasonable diplomacy tribute demands to broker peace with the enemy.
 * @param s - Skills map.
 * @param current - Current resources.
 * @param maxStorage - Maximum resource limits.
 * @returns Demanded resources.
 */
export function calcDiplomacyDemands(
  s: Record<string, number>,
  current: GameResources,
  maxStorage: GameResources
): Partial<GameResources> {
  const fleetStrength = Math.max(10, calcPlayerFleetStrength(s));
  const baseTributeMultiplier = Math.min(3, 1 + fleetStrength / 500);

  const reqCredits = Math.min(
    Math.floor(maxStorage.credits * 0.12),
    Math.max(300, Math.floor((current.credits * 0.06 + 300) * baseTributeMultiplier))
  );
  const reqEisen = Math.min(
    Math.floor(maxStorage.eisen * 0.12),
    Math.max(500, Math.floor((current.eisen * 0.06 + 500) * baseTributeMultiplier))
  );
  const reqSilber = Math.min(
    Math.floor(maxStorage.silber * 0.08),
    Math.max(150, Math.floor((current.silber * 0.04 + 150) * baseTributeMultiplier))
  );

  return {
    credits: reqCredits,
    eisen: reqEisen,
    silber: reqSilber,
  };
}


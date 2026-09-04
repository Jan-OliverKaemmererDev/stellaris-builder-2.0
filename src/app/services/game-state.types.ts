/** 
 * Represents all trackable game resources in the player's empire.
 * This structure is used across the game to manage costs, rewards, and storage.
 */
export interface GameResources {
  /** The amount of iron (Eisen) available. */
  eisen: number;
  /** The amount of silver (Silber) available. */
  silber: number;
  /** The amount of gold (Gold) available. */
  gold: number;
  /** The amount of xenonite (Xenonit) available. */
  xenonit: number;
  /** The amount of energy (Energie) available. Energy acts as a capacity constraint. */
  energie: number;
  /** The amount of credits available for trading. */
  credits: number;
  /** The amount of food (Nahrung) available. */
  nahrung: number;
  /** The amount of personnel (Personal) available. */
  personal: number;
}

/** 
 * Represents a running fleet mission with its timing data.
 * Used to track ongoing expeditions, attacks, or colonizations.
 */
export interface MissionState {
  /** The string identifier for the mission type. */
  type: string;
  /** The Unix timestamp in milliseconds when the mission was started. */
  startTime: number;
  /** The total duration of the mission in milliseconds. */
  durationMs: number;
  /** The number of ships assigned to this mission. */
  shipCount: number;
}

/** 
 * Represents an ongoing build or upgrade process.
 */
export interface ActiveBuild {
  /** The timestamp when the build finishes. */
  finishTime: number;
  /** The total duration of the build in milliseconds. */
  totalDurationMs: number;
}

/** 
 * Represents the full, persisted game state stored in Firestore per user.
 * It contains resources, building levels, active missions, and timestamp info.
 */
export interface GameState {
  /** The current state of all resources. */
  resources: GameResources;
  /** A dictionary of all unlocked skills and building levels. Keys are skill IDs, values are levels. */
  skills: Record<string, number>;
  /** A dictionary of all currently active builds. Keys are skill IDs. */
  activeBuilds?: Record<string, ActiveBuild>;
  /** The currently running mission, or `null` if the fleet is idle. */
  activeMission?: MissionState | null;
  /** Whether the user has seen the rules page on their first login. */
  hasSeenRules?: boolean;
  /** Whether the enemy faction has been activated after player's first battle attack. */
  enemyActivated?: boolean;
  /** The currently running battle operation, or `null` if idle. */
  activeBattle?: MissionState | null;
  /** Timestamp in ms of the last enemy attack. */
  lastEnemyAttack?: number;
  /** The Unix timestamp of the last state update, used for offline progress calculation. */
  lastUpdate?: number;
}

/** 
 * Default resource values and empty skills for a fresh game start.
 * Used when initializing a new user in Firestore.
 */
export const DEFAULT_STATE: GameState = {
  resources: {
    eisen: 1500,
    silber: 500,
    gold: 100,
    xenonit: 0,
    energie: 0,
    credits: 1500,
    nahrung: 2000,
    personal: 100,
  },
  skills: {},
  hasSeenRules: false,
  enemyActivated: false,
};

/** 
 * A list of string IDs that represent ships rather than static buildings.
 * Ships consume a flat amount of energy per unit rather than exponential upkeep.
 */
export const SHIP_IDS = ['kolonisierungsschiffe', 'logistikschiff', 'transportschiffe', 'mining_ship', 'leichter_jaeger', 'schwerer_jaeger', 'zerstoerer', 'kreuzer'];

/** Battleship IDs with their base attack strength per unit. */
export const BATTLE_SHIP_STATS: Record<string, { attackStrength: number; name: string }> = {
  leichter_jaeger: { attackStrength: 10, name: 'Leichter Jäger' },
  schwerer_jaeger: { attackStrength: 35, name: 'Schwerer Jäger' },
  zerstoerer: { attackStrength: 150, name: 'Zerstörer' },
  kreuzer: { attackStrength: 600, name: 'Kreuzer' },
};

/** 
 * The base energy upkeep cost per level for buildings or per unit for ships.
 * Used to calculate the total energy consumption of the empire.
 */
export const ENERGY_UPKEEP: Record<string, number> = {
  eisenmine: 10, silbermine: 20, goldmine: 50, lager: 10, refinery: 50,
  orbital_shipyard: 200, planetary_defense: 300, large_station: 500, biolabor: 100,
  nano_bots: 250, ki_automatisierung: 300, antriebstechnik: 500, trading_post: 50,
  interstellar_market: 200, galactic_exchange: 1000,
  kolonisierungsschiffe: 100, logistikschiff: 50, transportschiffe: 50, mining_ship: 20,
  leichter_jaeger: 10, schwerer_jaeger: 30, zerstoerer: 100, kreuzer: 300,
};

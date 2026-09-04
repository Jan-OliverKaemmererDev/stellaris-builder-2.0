import { describe, it, expect } from 'vitest';
import { ENERGY_UPKEEP } from './game-state.types';
import {
  calcNextLevelEnergyDelta,
  calcBuildingEnergyUpkeep,
  calcTotalEnergyConsumed,
  calcAvailableEnergy,
  calcTotalEnergyProduced
} from './game-math.utils';

describe('Energy System & Upkeep Balancing', () => {
  it('should include planetary_defense and nano_bots in ENERGY_UPKEEP', () => {
    expect(ENERGY_UPKEEP['planetary_defense']).toBe(300);
    expect(ENERGY_UPKEEP['nano_bots']).toBe(250);
  });

  it('should calculate the correct next level energy delta for buildings', () => {
    // Level 0 -> Level 1
    expect(calcNextLevelEnergyDelta('planetary_defense', 0)).toBe(300);
    // Level 1 -> Level 2: 300 * 1.5 = 450
    expect(calcNextLevelEnergyDelta('planetary_defense', 1)).toBe(450);
    // Level 2 -> Level 3: 300 * 2.25 = 675
    expect(calcNextLevelEnergyDelta('planetary_defense', 2)).toBe(675);

    // Nano-Bots
    expect(calcNextLevelEnergyDelta('nano_bots', 0)).toBe(250);
    expect(calcNextLevelEnergyDelta('nano_bots', 1)).toBe(375);

    // Non-existent building
    expect(calcNextLevelEnergyDelta('non_existent_building', 0)).toBe(0);
  });

  it('should calculate cumulative upkeep for buildings', () => {
    expect(calcBuildingEnergyUpkeep('planetary_defense', 0)).toBe(0);
    expect(calcBuildingEnergyUpkeep('planetary_defense', 1)).toBe(300);
    expect(calcBuildingEnergyUpkeep('planetary_defense', 2)).toBe(750); // 300 + 450
    expect(calcBuildingEnergyUpkeep('planetary_defense', 3)).toBe(1425); // 750 + 675
  });

  it('should correctly include ships and buildings in total energy consumed', () => {
    const skills = {
      planetary_defense: 1, // 300
      nano_bots: 1,         // 250
      leichter_jaeger: 5,   // 5 * 10 = 50
      kreuzer: 2,           // 2 * 300 = 600
    };
    const totalConsumed = calcTotalEnergyConsumed(skills);
    expect(totalConsumed).toBe(300 + 250 + 50 + 600); // 1200
  });

  it('should calculate available energy and detect deficits', () => {
    const skills = {
      solarkraftwerk: 1,    // Produces 200
      planetary_defense: 1, // Consumes 300
    };
    const produced = calcTotalEnergyProduced(skills);
    const consumed = calcTotalEnergyConsumed(skills);
    const available = calcAvailableEnergy(skills);

    expect(produced).toBe(200);
    expect(consumed).toBe(300);
    expect(available).toBe(-100); // Deficit!
  });
});

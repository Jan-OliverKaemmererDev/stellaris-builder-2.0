import { describe, it, expect } from 'vitest';
import { ENERGY_UPKEEP } from './game-state.types';
import {
  calcNextLevelEnergyDelta,
  calcBuildingEnergyUpkeep,
  calcTotalEnergyConsumed,
  calcAvailableEnergy,
  calcTotalEnergyProduced,
  buildResourceRates,
  calcPlayerFleetStrength,
  calcPlanetaryDefenseStrength
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
      leichter_jaeger: 5,   // 5 * 30 = 150
      kreuzer: 2,           // 2 * 1200 = 2400
    };
    const totalConsumed = calcTotalEnergyConsumed(skills);
    expect(totalConsumed).toBe(300 + 250 + 150 + 2400); // 3100
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

  it('should ignore disabled buildings and ships in calcTotalEnergyConsumed and free energy', () => {
    const skills = {
      solarkraftwerk: 1,    // Produces 200
      planetary_defense: 1, // Consumes 300
      kreuzer: 2,           // Consumes 2 * 1200 = 2400
    };

    // Before deactivating: total consumed = 2700, available = 200 - 2700 = -2500
    expect(calcTotalEnergyConsumed(skills)).toBe(2700);
    expect(calcAvailableEnergy(skills)).toBe(-2500);

    // Deactivate kreuzer
    const disabledKreuzer = { kreuzer: true };
    expect(calcTotalEnergyConsumed(skills, disabledKreuzer)).toBe(300);
    expect(calcAvailableEnergy(skills, disabledKreuzer)).toBe(-100);

    // Deactivate both kreuzer and planetary_defense -> 0 consumed, all 200 available
    const disabledBoth = { kreuzer: true, planetary_defense: true };
    expect(calcTotalEnergyConsumed(skills, disabledBoth)).toBe(0);
    expect(calcAvailableEnergy(skills, disabledBoth)).toBe(200);
  });

  it('should pause production and combat strength for deactivated entities', () => {
    const skills = {
      solarkraftwerk: 10,
      eisenmine: 5,
      silbermine: 3,
      kreuzer: 4,
      planetary_defense: 2,
    };

    // When all active and hasPower = true (availableEnergy = 500)
    const activeRates = buildResourceRates(skills, 500, {});
    expect(activeRates.eisen).toBeGreaterThan(0);
    expect(activeRates.silber).toBeGreaterThan(0);

    const activeFleetStrength = calcPlayerFleetStrength(skills, {});
    expect(activeFleetStrength).toBe(4 * 600); // 2400

    const activeDefStrength = calcPlanetaryDefenseStrength(skills, {});
    expect(activeDefStrength).toBeGreaterThan(0);

    // Deactivate eisenmine, kreuzer, and planetary_defense
    const disabled = { eisenmine: true, kreuzer: true, planetary_defense: true };
    const pausedRates = buildResourceRates(skills, 500, disabled);
    expect(pausedRates.eisen).toBe(0); // Eisenmine produces 0
    expect(pausedRates.silber).toBeGreaterThan(0); // Silbermine still active!

    const pausedFleetStrength = calcPlayerFleetStrength(skills, disabled);
    expect(pausedFleetStrength).toBe(0); // Kreuzer deactivated -> 0 strength

    const pausedDefStrength = calcPlanetaryDefenseStrength(skills, disabled);
    expect(pausedDefStrength).toBe(0); // Planetary defense deactivated -> 0 defense
  });
});



import { describe, expect, it } from 'vitest';
import {
  differsFromPreset,
  overrideCount,
  overriddenFields,
  presetDefaultsFor,
  resetP11d,
  resetRunningField,
  resetScenarioToPreset,
  resetVehicleField,
} from './overrides';
import { makeScenario } from './defaults';
import type { Scenario } from '../model/types';

function modelY(): Scenario {
  return makeScenario('tesla-model-y-premium-awd', 'My Model Y', 0);
}

describe('differsFromPreset', () => {
  it('tolerates floating point noise', () => {
    expect(differsFromPreset(3.6, 3.6 + 1e-12)).toBe(false);
    expect(differsFromPreset(3.6, 3.7)).toBe(true);
  });

  it('compares non-numbers exactly', () => {
    expect(differsFromPreset('petrol', 'petrol')).toBe(false);
    expect(differsFromPreset('petrol', 'diesel')).toBe(true);
    expect(differsFromPreset(true, false)).toBe(true);
  });
});

describe('override tracking', () => {
  it('reports nothing changed on a freshly applied preset', () => {
    expect(overrideCount(modelY())).toBe(0);
  });

  it('notices an edited vehicle field', () => {
    const s = modelY();
    s.vehicle.miPerKWh = 3.1;
    const changed = overriddenFields(s);
    expect(changed).toHaveLength(1);
    expect(changed[0].key).toBe('miPerKWh');
    expect(changed[0].presetValue).toBe(3.6);
    expect(changed[0].currentValue).toBe(3.1);
  });

  it('notices an edited running cost', () => {
    const s = modelY();
    s.running.insuranceGBP = 1450;
    expect(overriddenFields(s).map((f) => f.key)).toEqual(['insuranceGBP']);
  });

  it('notices an edited P11D', () => {
    const s = modelY();
    s.ownership.p11dGBP = 54500;
    expect(overriddenFields(s).map((f) => f.key)).toEqual(['p11dGBP']);
  });

  it('counts several changes across sections', () => {
    const s = modelY();
    s.vehicle.miPerKWh = 3.1;
    s.vehicle.purchasePriceGBP = 47000;
    s.running.insuranceGBP = 1450;
    expect(overrideCount(s)).toBe(3);
  });

  it('stops counting a field edited back to the preset value', () => {
    const s = modelY();
    const original = s.vehicle.miPerKWh;
    s.vehicle.miPerKWh = 3.1;
    expect(overrideCount(s)).toBe(1);
    s.vehicle.miPerKWh = original;
    expect(overrideCount(s)).toBe(0);
  });

  it('ignores fields that never came from a preset', () => {
    const s = modelY();
    s.charging.realWorldPenaltyPct = 20;
    s.ownership.model = 'salary-sacrifice';
    s.label = 'Something else';
    s.running.congestionChargeDaysPerYear = 40;
    expect(overrideCount(s)).toBe(0);
  });

  it('treats a car with no preset as fully custom', () => {
    const s = modelY();
    s.vehicle.presetId = null;
    expect(presetDefaultsFor(s)).toBeNull();
    expect(overrideCount(s)).toBe(0);
  });

  it('survives a preset id that no longer exists', () => {
    const s = modelY();
    s.vehicle.presetId = 'a-car-that-was-removed';
    expect(presetDefaultsFor(s)).toBeNull();
    expect(overrideCount(s)).toBe(0);
  });
});

describe('reverting', () => {
  it('puts a single vehicle field back', () => {
    const s = modelY();
    s.vehicle.miPerKWh = 3.1;
    s.vehicle.listPriceGBP = 60000;
    const reverted = resetVehicleField(s, 'miPerKWh');
    expect(reverted.vehicle.miPerKWh).toBe(3.6);
    // The other edit is untouched.
    expect(reverted.vehicle.listPriceGBP).toBe(60000);
  });

  it('puts a single running cost back', () => {
    const s = modelY();
    const original = s.running.insuranceGBP;
    s.running.insuranceGBP = 1450;
    expect(resetRunningField(s, 'insuranceGBP').running.insuranceGBP).toBe(original);
  });

  it('puts the P11D back', () => {
    const s = modelY();
    s.ownership.p11dGBP = 54500;
    expect(resetP11d(s).ownership.p11dGBP).toBe(s.vehicle.listPriceGBP);
  });

  it('resets everything at once', () => {
    const s = modelY();
    s.vehicle.miPerKWh = 3.1;
    s.vehicle.mpg = 99;
    s.running.insuranceGBP = 1450;
    s.ownership.p11dGBP = 54500;
    expect(overrideCount(resetScenarioToPreset(s))).toBe(0);
  });

  it('keeps what belongs to the driver rather than the preset', () => {
    const s = modelY();
    s.label = 'The good one';
    s.charging.realWorldPenaltyPct = 22;
    s.ownership.model = 'salary-sacrifice';
    s.ownership.monthlyPaymentGBP = 650;
    s.running.congestionChargeDaysPerYear = 40;
    s.vehicle.miPerKWh = 3.1;

    const reverted = resetScenarioToPreset(s);

    expect(reverted.vehicle.miPerKWh).toBe(3.6);
    expect(reverted.label).toBe('The good one');
    expect(reverted.charging.realWorldPenaltyPct).toBe(22);
    expect(reverted.ownership.model).toBe('salary-sacrifice');
    expect(reverted.ownership.monthlyPaymentGBP).toBe(650);
    expect(reverted.running.congestionChargeDaysPerYear).toBe(40);
  });

  it('does nothing to a custom car', () => {
    const s = modelY();
    s.vehicle.presetId = null;
    s.vehicle.miPerKWh = 3.1;
    expect(resetScenarioToPreset(s).vehicle.miPerKWh).toBe(3.1);
  });
});

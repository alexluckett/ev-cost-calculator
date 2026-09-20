/**
 * Preset-versus-override tracking.
 *
 * A preset is only a way of filling in defaults. Once a value is on the card
 * it belongs to the user, who may change any of it — the library figures for
 * real-world efficiency and insurance are estimates, and the driver's own
 * numbers are better.
 *
 * Rather than storing a parallel "has this been touched" flag for every field
 * — which would have to be migrated, encoded in the URL and kept in step —
 * override state is *derived* by comparing the scenario against what its
 * preset would have produced. That cannot drift out of sync, and it means an
 * edit that happens to restore the preset value correctly stops counting as
 * an override.
 */

import { PRESETS_BY_ID } from '../data/vehicles';
import { defaultRunningCosts, specFromPreset } from './defaults';
import type { RunningCostInputs, Scenario, VehicleSpec } from '../model/types';

/** Vehicle fields that come from a preset and may be overridden. */
export const TRACKED_VEHICLE_FIELDS = [
  'fuelType',
  'usableBatteryKWh',
  'miPerKWh',
  'maxDcChargeKW',
  'liquidFuel',
  'mpg',
  'tankLitres',
  'co2gPerKm',
  'phevElectricRangeMi',
  'phevElectricMilesPct',
  'firstRegisteredYear',
  'dieselRde2',
  'listPriceGBP',
  'purchasePriceGBP',
] as const;

export type TrackedVehicleField = (typeof TRACKED_VEHICLE_FIELDS)[number];

/** Running costs that come from a preset and may be overridden. */
export const TRACKED_RUNNING_FIELDS = [
  'insuranceGBP',
  'servicingGBP',
  'tyresPencePerMile',
  'motGBP',
  'breakdownCoverGBP',
] as const;

export type TrackedRunningField = (typeof TRACKED_RUNNING_FIELDS)[number];

export interface PresetDefaults {
  vehicle: VehicleSpec;
  running: RunningCostInputs;
  /** What the preset would put in the P11D box. */
  p11dGBP: number;
}

/** The values this scenario's preset would fill in, or null for a custom car. */
export function presetDefaultsFor(scenario: Scenario): PresetDefaults | null {
  const id = scenario.vehicle.presetId;
  if (!id) return null;
  const preset = PRESETS_BY_ID[id];
  if (!preset) return null;
  const vehicle = specFromPreset(preset);
  return { vehicle, running: defaultRunningCosts(preset), p11dGBP: vehicle.listPriceGBP };
}

/**
 * Compares a current value against its preset default. Numbers use a small
 * tolerance so that re-typing the same figure, or a rounding round-trip
 * through the URL, is not mistaken for an override.
 */
export function differsFromPreset(current: unknown, preset: unknown): boolean {
  if (typeof current === 'number' && typeof preset === 'number') {
    if (!Number.isFinite(current) || !Number.isFinite(preset)) return current !== preset;
    return Math.abs(current - preset) > 1e-6;
  }
  return current !== preset;
}

export interface OverriddenField {
  key: string;
  presetValue: unknown;
  currentValue: unknown;
}

/** Every tracked field whose value no longer matches the preset. */
export function overriddenFields(scenario: Scenario): OverriddenField[] {
  const defaults = presetDefaultsFor(scenario);
  if (!defaults) return [];

  const out: OverriddenField[] = [];

  for (const key of TRACKED_VEHICLE_FIELDS) {
    const current = scenario.vehicle[key];
    const presetValue = defaults.vehicle[key];
    if (differsFromPreset(current, presetValue)) out.push({ key, presetValue, currentValue: current });
  }

  for (const key of TRACKED_RUNNING_FIELDS) {
    const current = scenario.running[key];
    const presetValue = defaults.running[key];
    if (differsFromPreset(current, presetValue)) out.push({ key, presetValue, currentValue: current });
  }

  if (differsFromPreset(scenario.ownership.p11dGBP, defaults.p11dGBP)) {
    out.push({ key: 'p11dGBP', presetValue: defaults.p11dGBP, currentValue: scenario.ownership.p11dGBP });
  }

  return out;
}

export function overrideCount(scenario: Scenario): number {
  return overriddenFields(scenario).length;
}

// ---------------------------------------------------------------------------
// Reverting
// ---------------------------------------------------------------------------

export function resetVehicleField(scenario: Scenario, key: TrackedVehicleField): Scenario {
  const defaults = presetDefaultsFor(scenario);
  if (!defaults) return scenario;
  return { ...scenario, vehicle: { ...scenario.vehicle, [key]: defaults.vehicle[key] } };
}

export function resetRunningField(scenario: Scenario, key: TrackedRunningField): Scenario {
  const defaults = presetDefaultsFor(scenario);
  if (!defaults) return scenario;
  return { ...scenario, running: { ...scenario.running, [key]: defaults.running[key] } };
}

export function resetP11d(scenario: Scenario): Scenario {
  const defaults = presetDefaultsFor(scenario);
  if (!defaults) return scenario;
  return { ...scenario, ownership: { ...scenario.ownership, p11dGBP: defaults.p11dGBP } };
}

/**
 * Puts every tracked field back to the preset. The driver's own label, their
 * charging mix and how the car is paid for are theirs, not the preset's, so
 * they survive.
 */
export function resetScenarioToPreset(scenario: Scenario): Scenario {
  const defaults = presetDefaultsFor(scenario);
  if (!defaults) return scenario;
  return {
    ...scenario,
    vehicle: { ...defaults.vehicle },
    running: {
      ...scenario.running,
      insuranceGBP: defaults.running.insuranceGBP,
      servicingGBP: defaults.running.servicingGBP,
      tyresPencePerMile: defaults.running.tyresPencePerMile,
      motGBP: defaults.running.motGBP,
      breakdownCoverGBP: defaults.running.breakdownCoverGBP,
    },
    ownership: { ...scenario.ownership, p11dGBP: defaults.p11dGBP },
  };
}

/**
 * Default state, and the rules for turning a library preset into an editable
 * scenario. Autofill is a starting point: everything it writes can be changed.
 */

import { DEFAULT_TAX_YEAR } from '../data/tax';
import { PRESETS_BY_ID, presetLabel } from '../data/vehicles';
import type { AppState, Scenario, VehiclePreset, VehicleSpec } from '../model/types';

/** Distinguishable in both themes and for the common forms of colour blindness. */
export const SCENARIO_COLOURS = ['#2f6fed', '#e2683a', '#0f9d76', '#8a5cf6'];

export const MAX_SCENARIOS = 4;

const CURRENT_YEAR = new Date().getFullYear();

export function specFromPreset(preset: VehiclePreset): VehicleSpec {
  const isElectric = preset.fuelType === 'bev' || preset.fuelType === 'phev';
  return {
    presetId: preset.id,
    name: presetLabel(preset),
    fuelType: preset.fuelType,
    usableBatteryKWh: preset.usableBatteryKWh ?? 0,
    // Prefer the real-world figure: it is the one that predicts your bill.
    miPerKWh: preset.realWorldMiPerKWh ?? (isElectric ? 3.5 : 0),
    liquidFuel: preset.liquidFuel ?? 'petrol',
    mpg: preset.realWorldMpg ?? preset.officialMpg ?? 0,
    co2gPerKm: preset.co2gPerKm,
    phevElectricRangeMi: preset.phevElectricRangeMi ?? 0,
    // Realistic for someone who does plug in nightly, but not obsessively.
    phevElectricMilesPct: preset.fuelType === 'phev' ? 55 : 0,
    firstRegisteredYear: preset.firstRegisteredYear,
    dieselRde2: preset.dieselRde2 ?? preset.firstRegisteredYear >= 2021,
    listPriceGBP: preset.listPriceGBP,
  };
}

export function blankVehicleSpec(): VehicleSpec {
  return {
    presetId: null,
    name: 'Custom vehicle',
    fuelType: 'petrol',
    usableBatteryKWh: 0,
    miPerKWh: 0,
    liquidFuel: 'petrol',
    mpg: 0,
    co2gPerKm: 0,
    phevElectricRangeMi: 0,
    phevElectricMilesPct: 0,
    firstRegisteredYear: CURRENT_YEAR,
    dieselRde2: true,
    listPriceGBP: 0,
  };
}

let counter = 0;

function newScenario(vehicle: VehicleSpec, label: string, colourIndex: number, preset?: VehiclePreset): Scenario {
  counter += 1;
  return {
    id: `s${Date.now().toString(36)}${counter}`,
    label,
    colour: SCENARIO_COLOURS[colourIndex % SCENARIO_COLOURS.length],
    vehicle,
    // Mostly at home, with the occasional rapid stop on a long run.
    homeChargingPct: 90,
    ownership: {
      model: 'personal',
      p11dGBP: vehicle.listPriceGBP,
      monthlySacrificeGBP: 0,
      bundledRunningCosts: true,
      employerPaysEnergy: false,
    },
    running: {
      insuranceGBP: preset?.typicalInsuranceGBP ?? 0,
      servicingGBP: preset?.typicalServicingGBP ?? 0,
      // Electric cars are heavier and torquier, so tyres go faster — but they
      // barely touch their brakes, which is why servicing above is lower.
      tyresPencePerMile: preset ? (preset.fuelType === 'bev' ? 2.6 : 1.9) : 0,
    },
  };
}

export function makeScenario(presetId: string, label?: string, colourIndex = 0): Scenario {
  const preset = PRESETS_BY_ID[presetId];
  if (!preset) throw new Error(`Unknown vehicle preset: ${presetId}`);
  const vehicle = specFromPreset(preset);
  return newScenario(vehicle, label ?? vehicle.name, colourIndex, preset);
}

export function makeCustomScenario(label = 'My car', colourIndex = 0): Scenario {
  return newScenario(blankVehicleSpec(), label, colourIndex);
}

/**
 * The app opens empty. Nothing here describes the driver — no cars, no
 * mileage, no tariff. Only neutral settings (the tax year, the comparison
 * horizon) carry a value, because those are configuration rather than
 * assertions about the user.
 */
export function defaultState(): AppState {
  return {
    annualMiles: 0,
    termYears: 3,
    taxYear: DEFAULT_TAX_YEAR,
    grossSalaryGBP: 0,
    prices: { homePPerKWh: 0, publicRapidPPerKWh: 0, petrolPPerLitre: 0, dieselPPerLitre: 0 },
    scenarios: [],
  };
}

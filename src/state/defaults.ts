/**
 * Default state, and the rules for turning a library preset into an editable
 * scenario. Autofill is a starting point: everything it writes can be changed.
 */

import { DEFAULT_ASSUMPTIONS } from '../data/assumptions';
import { DEFAULT_TAX_YEAR } from '../data/tax';
import { PRESETS_BY_ID, presetLabel } from '../data/vehicles';
import type {
  AppState,
  ChargingInputs,
  EnergyPrices,
  OwnershipInputs,
  RunningCostInputs,
  Scenario,
  VehiclePreset,
  VehicleSpec,
} from '../model/types';

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
    miPerKWh: preset.realWorldMiPerKWh ?? preset.officialMiPerKWh ?? (isElectric ? 3.5 : 0),
    maxDcChargeKW: preset.maxDcChargeKW ?? 0,
    liquidFuel: preset.liquidFuel ?? 'petrol',
    mpg: preset.realWorldMpg ?? preset.officialMpg ?? 0,
    tankLitres: preset.tankLitres ?? 0,
    co2gPerKm: preset.co2gPerKm,
    phevElectricRangeMi: preset.phevElectricRangeMi ?? 0,
    // A realistic default for a plug-in hybrid driven by someone who does
    // plug it in every night, but not obsessively.
    phevElectricMilesPct: preset.fuelType === 'phev' ? 55 : 0,
    firstRegisteredYear: preset.firstRegisteredYear,
    dieselRde2: preset.dieselRde2 ?? preset.firstRegisteredYear >= 2021,
    listPriceGBP: preset.listPriceGBP,
    purchasePriceGBP: preset.usedValueGBP ?? preset.listPriceGBP,
  };
}

export function defaultCharging(): ChargingInputs {
  return {
    // Mostly overnight at home, with the occasional rapid stop on a long run.
    mix: { homeOffPeak: 80, homePeak: 10, workplace: 0, publicRapid: 8, publicSlow: 2 },
    rapidEntryMode: 'percent',
    rapidSessionsPerMonth: 1,
    rapidSessionKWh: 45,
    realWorldPenaltyPct: 0,
  };
}

export function defaultOwnership(spec: VehicleSpec): OwnershipInputs {
  return {
    model: 'personal-cash',
    depositGBP: 0,
    monthlyPaymentGBP: 0,
    termMonths: 36,
    bundledRunningCosts: true,
    p11dGBP: spec.listPriceGBP,
    capitalContributionGBP: 0,
    employerPaysPrivateFuel: false,
    claimsAdvisoryRate: false,
    claimsAmap: false,
    includeDepreciation: false,
    residualValuePct: 45,
  };
}

export function defaultRunningCosts(preset: VehiclePreset): RunningCostInputs {
  const age = CURRENT_YEAR - preset.firstRegisteredYear;
  const isElectric = preset.fuelType === 'bev';
  return {
    insuranceGBP: preset.typicalInsuranceGBP,
    servicingGBP: preset.typicalServicingGBP,
    // EVs are heavier and torquier, so tyres go faster; they have no exhaust,
    // clutch or oil changes, which is why servicing above is lower.
    tyresPencePerMile: isElectric ? 2.6 : 1.9,
    motGBP: age >= 3 ? 55 : 0,
    breakdownCoverGBP: 60,
    vedOverrideGBP: null,
    congestionChargeDaysPerYear: 0,
    otherAnnualGBP: 0,
  };
}

let scenarioCounter = 0;

export function makeScenario(presetId: string, label?: string, colourIndex = 0): Scenario {
  const preset = PRESETS_BY_ID[presetId];
  if (!preset) throw new Error(`Unknown vehicle preset: ${presetId}`);
  const vehicle = specFromPreset(preset);
  scenarioCounter += 1;
  return {
    id: `s${Date.now().toString(36)}${scenarioCounter}`,
    label: label ?? vehicle.name,
    colour: SCENARIO_COLOURS[colourIndex % SCENARIO_COLOURS.length],
    vehicle,
    charging: defaultCharging(),
    ownership: defaultOwnership(vehicle),
    running: defaultRunningCosts(preset),
  };
}

/** A vehicle with nothing filled in, for someone building a car by hand. */
export function blankVehicleSpec(): VehicleSpec {
  return {
    presetId: null,
    name: 'Custom vehicle',
    fuelType: 'petrol',
    usableBatteryKWh: 0,
    miPerKWh: 0,
    maxDcChargeKW: 0,
    liquidFuel: 'petrol',
    mpg: 0,
    tankLitres: 0,
    co2gPerKm: 0,
    phevElectricRangeMi: 0,
    phevElectricMilesPct: 0,
    firstRegisteredYear: CURRENT_YEAR,
    dieselRde2: true,
    listPriceGBP: 0,
    purchasePriceGBP: 0,
  };
}

export function makeCustomScenario(label: string, colourIndex = 0): Scenario {
  const vehicle = blankVehicleSpec();
  scenarioCounter += 1;
  return {
    id: `s${Date.now().toString(36)}${scenarioCounter}`,
    label,
    colour: SCENARIO_COLOURS[colourIndex % SCENARIO_COLOURS.length],
    vehicle,
    charging: defaultCharging(),
    ownership: defaultOwnership(vehicle),
    running: {
      insuranceGBP: 0,
      servicingGBP: 0,
      tyresPencePerMile: 0,
      motGBP: 0,
      breakdownCoverGBP: 0,
      vedOverrideGBP: null,
      congestionChargeDaysPerYear: 0,
      otherAnnualGBP: 0,
    },
  };
}

/**
 * Energy prices start unset rather than at a plausible-looking national
 * average. A default price is a claim about the user's tariff that the app is
 * in no position to make, and a wrong one quietly changes the answer.
 */
export function blankPrices(): EnergyPrices {
  return {
    homeOffPeakPPerKWh: 0,
    homePeakPPerKWh: 0,
    workplacePPerKWh: 0,
    publicRapidPPerKWh: 0,
    publicSlowPPerKWh: 0,
    petrolPPerLitre: 0,
    dieselPPerLitre: 0,
  };
}

/**
 * The app opens empty. Nothing here describes the driver — no cars, no
 * mileage, no salary, no tariff. Only genuinely neutral settings (the tax
 * year, the comparison horizon, the laws of physics) carry a value, because
 * those are app configuration rather than assertions about the user.
 */
export function defaultState(): AppState {
  return {
    usage: { annualMiles: 0, businessMilesPct: 0, termYears: 3 },
    prices: blankPrices(),
    tax: {
      region: 'uk',
      grossSalaryGBP: 0,
      taxYear: DEFAULT_TAX_YEAR,
      showEmployerView: false,
      corporationTaxRatePct: 25,
    },
    assumptions: { ...DEFAULT_ASSUMPTIONS },
    scenarios: [],
    baselineId: '',
    includeCapitalCosts: false,
  };
}

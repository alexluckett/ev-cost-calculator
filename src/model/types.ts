/**
 * Domain types.
 *
 * Money is in pounds unless the name says otherwise (`pPerKWh`, `pPerLitre`,
 * `PencePerMile`). Distance is miles, energy kWh, volume litres — the units a
 * UK driver reads off a pump, a charger and a dashboard.
 */

export type FuelType = 'bev' | 'phev' | 'hybrid' | 'petrol' | 'diesel';

export type LiquidFuel = 'petrol' | 'diesel';

/** How the driver pays for the car, which decides which tax rules apply. */
export type OwnershipModel = 'personal' | 'company-car' | 'salary-sacrifice';

export interface VehiclePreset {
  id: string;
  make: string;
  model: string;
  variant: string;
  years: string;
  fuelType: FuelType;
  segment: string;

  // Electric drivetrain (bev, phev)
  usableBatteryKWh?: number;
  /** Indicative all-year real-world efficiency, miles per kWh at the battery. */
  realWorldMiPerKWh?: number;
  wltpRangeMi?: number;

  // Combustion drivetrain (phev, hybrid, petrol, diesel)
  liquidFuel?: LiquidFuel;
  /** Indicative real-world consumption, imperial mpg. For a PHEV this is the
   *  figure with a flat battery, which is the only honest one to model with. */
  realWorldMpg?: number;
  officialMpg?: number;

  co2gPerKm: number;
  /** Electric-only range in miles — decides the PHEV company car tax band. */
  phevElectricRangeMi?: number;

  listPriceGBP: number;
  typicalInsuranceGBP: number;
  typicalServicingGBP: number;
  firstRegisteredYear: number;
  dieselRde2?: boolean;
  notes?: string;
}

/** An editable copy of a preset. Every autofilled number can be overridden. */
export interface VehicleSpec {
  presetId: string | null;
  name: string;
  fuelType: FuelType;
  usableBatteryKWh: number;
  miPerKWh: number;
  liquidFuel: LiquidFuel;
  mpg: number;
  co2gPerKm: number;
  phevElectricRangeMi: number;
  /** Share of PHEV miles driven on battery, 0–100. */
  phevElectricMilesPct: number;
  firstRegisteredYear: number;
  dieselRde2: boolean;
  listPriceGBP: number;
}

export interface OwnershipInputs {
  model: OwnershipModel;
  /** P11D value — list price with options, which company car tax is charged on. */
  p11dGBP: number;
  /** Monthly gross salary given up, for a sacrifice scheme. */
  monthlySacrificeGBP: number;
  /** Most schemes bundle insurance, servicing, tyres and road tax. */
  bundledRunningCosts: boolean;
  /** Employer pays for all fuel or charging, private mileage included. */
  employerPaysEnergy: boolean;
}

export interface RunningCostInputs {
  insuranceGBP: number;
  servicingGBP: number;
  /** Tyres, brakes and wipers — the consumables that scale with distance. */
  tyresPencePerMile: number;
}

export interface Scenario {
  id: string;
  label: string;
  colour: string;
  vehicle: VehicleSpec;
  /** Share of charging done at home, 0–100. The rest is public rapid DC. */
  homeChargingPct: number;
  ownership: OwnershipInputs;
  running: RunningCostInputs;
}

export interface EnergyPrices {
  homePPerKWh: number;
  publicRapidPPerKWh: number;
  petrolPPerLitre: number;
  dieselPPerLitre: number;
}

export interface AppState {
  annualMiles: number;
  /** Comparison horizon in years. */
  termYears: number;
  /** Tax year key into the company car tax schedule, e.g. '2026/27'. */
  taxYear: string;
  grossSalaryGBP: number;
  prices: EnergyPrices;
  scenarios: Scenario[];
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

export interface EnergyResult {
  /** Energy stored in the battery over a year, kWh. */
  annualBatteryKWh: number;
  /** Energy bought at the meter over a year, kWh — higher, after losses. */
  annualGridKWh: number;
  annualLitres: number;
  costGBP: number;
  pencePerMile: number;
  /** Blended cost of a kWh at the meter, pence. */
  blendedPPerKWh: number;
}

export interface CostLine {
  key: string;
  label: string;
  annualGBP: number;
  detail?: string;
}

export interface ScenarioResult {
  scenarioId: string;
  label: string;
  colour: string;
  energy: EnergyResult;
  lines: CostLine[];
  /** Company car tax percentage, 0 for a personally owned car. */
  bikPercent: number;
  annualEnergyGBP: number;
  annualTotalGBP: number;
  monthlyTotalGBP: number;
  termTotalGBP: number;
  costPerMilePence: number;
  warnings: string[];
}

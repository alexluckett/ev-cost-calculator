/**
 * Domain types for the cost model.
 *
 * Money is held in pounds unless a name says otherwise (`...Pence`, `pPerKWh`,
 * `pPerLitre`). Distance is miles, energy kWh, volume litres — the units a UK
 * driver reads off a pump, a charger and a dashboard.
 */

export type FuelType = 'bev' | 'phev' | 'hybrid' | 'petrol' | 'diesel';

export type LiquidFuel = 'petrol' | 'diesel';

/** How the driver pays for the car, which decides which tax rules apply. */
export type OwnershipModel =
  /** Owned outright, personally. Depreciation is the cost of capital. */
  | 'personal-cash'
  /** Personal contract hire / PCP / HP — a monthly payment and a deposit. */
  | 'personal-finance'
  /** Provided by an employer; the driver pays income tax on the benefit. */
  | 'company-car'
  /** Gross salary is sacrificed for the car; saves tax and NI, incurs BiK. */
  | 'salary-sacrifice';

export type TaxRegion = 'uk' | 'scotland';

/** The five places a UK driver realistically buys electricity. */
export type ChargingSourceId =
  | 'homeOffPeak'
  | 'homePeak'
  | 'workplace'
  | 'publicRapid'
  | 'publicSlow';

export const CHARGING_SOURCE_IDS: ChargingSourceId[] = [
  'homeOffPeak',
  'homePeak',
  'workplace',
  'publicRapid',
  'publicSlow',
];

export const CHARGING_SOURCE_LABELS: Record<ChargingSourceId, string> = {
  homeOffPeak: 'Home (off-peak)',
  homePeak: 'Home (peak)',
  workplace: 'Workplace',
  publicRapid: 'Public rapid DC / Supercharger',
  publicSlow: 'Public slow / destination AC',
};

/** Sources that deliver DC and therefore skip the on-board charger's losses. */
export const DC_SOURCES: ReadonlySet<ChargingSourceId> = new Set(['publicRapid']);

// ---------------------------------------------------------------------------
// Vehicle
// ---------------------------------------------------------------------------

export interface VehiclePreset {
  id: string;
  make: string;
  model: string;
  variant: string;
  years: string;
  fuelType: FuelType;
  /** Body style, used only for grouping and search. */
  segment: string;

  // Electric drivetrain (bev, phev)
  /** Usable battery capacity in kWh — the number that actually stores energy. */
  usableBatteryKWh?: number;
  /** Official (WLTP-derived) efficiency, miles per kWh at the battery. */
  officialMiPerKWh?: number;
  /** Indicative all-year real-world efficiency, miles per kWh at the battery. */
  realWorldMiPerKWh?: number;
  wltpRangeMi?: number;
  maxDcChargeKW?: number;

  // Combustion drivetrain (phev, hybrid, petrol, diesel)
  liquidFuel?: LiquidFuel;
  /** Official combined consumption, imperial mpg. */
  officialMpg?: number;
  /** Indicative real-world consumption, imperial mpg. For a PHEV this is the
   *  figure with a flat battery, which is the only honest one to model with. */
  realWorldMpg?: number;
  tankLitres?: number;

  /** Official combined CO2, g/km. Drives the BiK band for non-zero-emission cars. */
  co2gPerKm: number;
  /** Electric-only range in miles — decides the PHEV BiK band. */
  phevElectricRangeMi?: number;

  /** Indicative list price when new, used as the P11D basis and for depreciation. */
  listPriceGBP: number;
  /** Indicative current market value, for the "keep my old car" comparison. */
  usedValueGBP?: number;

  typicalInsuranceGBP: number;
  typicalServicingGBP: number;
  /** Year the variant reached the UK market — used as the registration year default. */
  firstRegisteredYear: number;
  /** Diesels meeting RDE2 avoid the 4% BiK surcharge. */
  dieselRde2?: boolean;
  /** True for cars whose list price triggers the VED Expensive Car Supplement. */
  notes?: string;
}

/** An editable copy of a preset. Every autofilled number can be overridden. */
export interface VehicleSpec {
  presetId: string | null;
  name: string;
  fuelType: FuelType;

  usableBatteryKWh: number;
  miPerKWh: number;
  maxDcChargeKW: number;

  liquidFuel: LiquidFuel;
  mpg: number;
  tankLitres: number;

  co2gPerKm: number;
  phevElectricRangeMi: number;
  /** Share of PHEV miles driven on battery, 0–100. */
  phevElectricMilesPct: number;
  /** Year of first registration — decides which VED regime applies. */
  firstRegisteredYear: number;
  /** Diesels meeting RDE2 avoid the 4% BiK surcharge. True for most since 2021. */
  dieselRde2: boolean;

  listPriceGBP: number;
  purchasePriceGBP: number;
}

// ---------------------------------------------------------------------------
// Charging
// ---------------------------------------------------------------------------

export type RapidEntryMode = 'percent' | 'sessions';

export interface ChargingInputs {
  /** Share of total charging energy taken from each source, 0–100, summing to 100. */
  mix: Record<ChargingSourceId, number>;
  rapidEntryMode: RapidEntryMode;
  /** Used when rapidEntryMode is 'sessions'. */
  rapidSessionsPerMonth: number;
  /** kWh added per rapid session. */
  rapidSessionKWh: number;
  /** Extra consumption over the official figure, as a percentage. 0 = as official. */
  realWorldPenaltyPct: number;
}

// ---------------------------------------------------------------------------
// Ownership, tax and running costs
// ---------------------------------------------------------------------------

export interface OwnershipInputs {
  model: OwnershipModel;

  // personal-finance / salary-sacrifice / company-car lease
  depositGBP: number;
  monthlyPaymentGBP: number;
  /** Contract length in months. */
  termMonths: number;
  /** Salary sacrifice and many leases bundle insurance, servicing and tyres. */
  bundledRunningCosts: boolean;

  // company-car / salary-sacrifice
  /** P11D value — list price including options and delivery, excluding VED and first registration fee. */
  p11dGBP: number;
  /** One-off capital contribution by the employee, which reduces the BiK basis. */
  capitalContributionGBP: number;
  /**
   * Employer pays for all fuel or charging, including private mileage. For an
   * ICE car this triggers the car fuel benefit charge; for an EV it does not,
   * because electricity is not a "fuel" for benefit purposes.
   */
  employerPaysPrivateFuel: boolean;
  /** Employer reimburses business miles at the advisory rate. */
  claimsAdvisoryRate: boolean;

  // personal ownership
  /** Claims tax-free AMAP mileage allowance for business miles. */
  claimsAmap: boolean;

  // depreciation (personal ownership)
  includeDepreciation: boolean;
  /** Value remaining at the end of the comparison term, as a percentage of purchase price. */
  residualValuePct: number;
}

export interface RunningCostInputs {
  insuranceGBP: number;
  servicingGBP: number;
  /** Tyres, wipers, brakes — the consumables that scale with distance. */
  tyresPencePerMile: number;
  motGBP: number;
  breakdownCoverGBP: number;
  /** Road tax override; when null the VED table decides. */
  vedOverrideGBP: number | null;
  congestionChargeDaysPerYear: number;
  otherAnnualGBP: number;
}

export interface Scenario {
  id: string;
  label: string;
  colour: string;
  vehicle: VehicleSpec;
  charging: ChargingInputs;
  ownership: OwnershipInputs;
  running: RunningCostInputs;
}

// ---------------------------------------------------------------------------
// Shared inputs — things that belong to the driver, not to a car
// ---------------------------------------------------------------------------

export interface EnergyPrices {
  homeOffPeakPPerKWh: number;
  homePeakPPerKWh: number;
  workplacePPerKWh: number;
  publicRapidPPerKWh: number;
  publicSlowPPerKWh: number;
  petrolPPerLitre: number;
  dieselPPerLitre: number;
}

export interface UsageInputs {
  annualMiles: number;
  /** Share of annual miles driven on business, 0–100. */
  businessMilesPct: number;
  /** Comparison horizon in years. */
  termYears: number;
}

export interface TaxProfile {
  region: TaxRegion;
  grossSalaryGBP: number;
  /** Tax year key into the BiK schedule, e.g. '2026/27'. */
  taxYear: string;
  /** Employer-side view: show what the company pays. */
  showEmployerView: boolean;
  corporationTaxRatePct: number;
}

export interface Assumptions {
  /** Grid-to-battery efficiency for AC charging, as a percentage. */
  acChargingEfficiencyPct: number;
  /** Grid-to-battery efficiency for DC rapid charging, as a percentage. */
  dcChargingEfficiencyPct: number;
  /** Annual real increase applied to energy prices over the term, as a percentage. */
  energyInflationPct: number;
  /** Carbon intensity of grid electricity, gCO2e per kWh. */
  gridCarbonIntensityGPerKWh: number;
  /** Well-to-wheel CO2 per litre of fuel, kg. */
  petrolKgCO2PerLitre: number;
  dieselKgCO2PerLitre: number;
  /** Optional per-mile road charge for EVs (announced for April 2028). */
  evRoadChargePencePerMile: number;
  phevRoadChargePencePerMile: number;
  applyEvRoadCharge: boolean;
}

export interface AppState {
  usage: UsageInputs;
  prices: EnergyPrices;
  tax: TaxProfile;
  assumptions: Assumptions;
  scenarios: Scenario[];
  /** Scenario id that others are compared against. */
  baselineId: string;
  /** Whether capital costs (depreciation/finance) are included in headline totals. */
  includeCapitalCosts: boolean;
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

export interface EnergyBreakdownRow {
  source: ChargingSourceId;
  sharePct: number;
  batteryKWh: number;
  gridKWh: number;
  pPerKWh: number;
  costGBP: number;
}

export interface EnergyResult {
  /** Energy stored in the battery over a year, kWh. */
  annualBatteryKWh: number;
  /** Energy bought at the meter over a year, kWh. Higher than the above. */
  annualGridKWh: number;
  annualLitres: number;
  electricityCostGBP: number;
  liquidFuelCostGBP: number;
  totalCostGBP: number;
  pencePerMile: number;
  /** Blended cost of a kWh at the meter, pence. */
  blendedPPerKWh: number;
  rows: EnergyBreakdownRow[];
  /** Miles driven on electricity (all of them, for a BEV). */
  electricMiles: number;
  liquidMiles: number;
  /** Full-tank / full-charge cost and range, for the "what does a fill-up cost" panel. */
  fullChargeCostGBP: number;
  fullChargeRangeMi: number;
  fullTankCostGBP: number;
  fullTankRangeMi: number;
}

export interface CostLine {
  key: string;
  label: string;
  annualGBP: number;
  /** Category used for the stacked chart. */
  group: 'energy' | 'tax' | 'fixed' | 'capital' | 'reimbursement';
  detail?: string;
}

export interface TaxResult {
  bikPercent: number;
  bikValueGBP: number;
  bikTaxGBP: number;
  fuelBenefitTaxGBP: number;
  salarySacrificeGrossGBP: number;
  salarySacrificeNetGBP: number;
  marginalRatePct: number;
  employerClass1aGBP: number;
  employerNetCostGBP: number;
}

export interface ScenarioResult {
  scenarioId: string;
  label: string;
  colour: string;
  energy: EnergyResult;
  tax: TaxResult;
  lines: CostLine[];
  annualEnergyGBP: number;
  annualTotalGBP: number;
  monthlyTotalGBP: number;
  termTotalGBP: number;
  costPerMilePence: number;
  annualCO2Kg: number;
  warnings: string[];
}

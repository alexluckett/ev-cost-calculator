/**
 * UK personal tax, Benefit in Kind and VED.
 *
 * The marginal rate is derived rather than picked from a dropdown, so the
 * personal-allowance taper between £100,000 and £125,140 — an effective 60%
 * band, and the reason salary sacrifice is so attractive there — falls out
 * automatically, as do the Scottish bands.
 */

import {
  ADVISORY_ELECTRIC_RATE_PENCE,
  ADVISORY_FUEL_RATE_PENCE,
  AMAP_ABOVE_10K_PENCE,
  AMAP_FIRST_10K_PENCE,
  AMAP_THRESHOLD_MILES,
  BAND_51_54,
  BASE_AT_55,
  BIK_MAX_PCT,
  CAR_FUEL_BENEFIT_MULTIPLIER,
  CLASS_1A_RATE_PCT,
  DIESEL_SURCHARGE_PCT,
  NI_MAIN_RATE_PCT,
  NI_PRIMARY_THRESHOLD,
  NI_UPPER_EARNINGS_LIMIT,
  NI_UPPER_RATE_PCT,
  PA_TAPER_THRESHOLD,
  PERSONAL_ALLOWANCE,
  PHEV_BIK_BANDS,
  RUK_BANDS,
  SCOTLAND_BANDS,
  VED,
  ZERO_EMISSION_BIK_PCT,
  type TaxYear,
} from '../data/tax';
import type { TaxRegion, VehicleSpec } from './types';

// ---------------------------------------------------------------------------
// Income tax and National Insurance
// ---------------------------------------------------------------------------

export function personalAllowanceFor(grossSalary: number): number {
  if (grossSalary <= PA_TAPER_THRESHOLD) return PERSONAL_ALLOWANCE;
  const taper = (grossSalary - PA_TAPER_THRESHOLD) / 2;
  return Math.max(0, PERSONAL_ALLOWANCE - taper);
}

export function incomeTaxFor(grossSalary: number, region: TaxRegion): number {
  const salary = Math.max(0, grossSalary);
  const taxable = Math.max(0, salary - personalAllowanceFor(salary));
  const bands = region === 'scotland' ? SCOTLAND_BANDS : RUK_BANDS;

  let tax = 0;
  let previousCeiling = 0;
  for (const band of bands) {
    if (taxable <= previousCeiling) break;
    const slice = Math.min(taxable, band.upTo) - previousCeiling;
    tax += (slice * band.ratePct) / 100;
    previousCeiling = band.upTo;
  }
  return tax;
}

export function employeeNiFor(grossSalary: number): number {
  const salary = Math.max(0, grossSalary);
  const main = Math.max(0, Math.min(salary, NI_UPPER_EARNINGS_LIMIT) - NI_PRIMARY_THRESHOLD);
  const upper = Math.max(0, salary - NI_UPPER_EARNINGS_LIMIT);
  return (main * NI_MAIN_RATE_PCT) / 100 + (upper * NI_UPPER_RATE_PCT) / 100;
}

export function takeHomeFor(grossSalary: number, region: TaxRegion): number {
  return grossSalary - incomeTaxFor(grossSalary, region) - employeeNiFor(grossSalary);
}

/**
 * Combined marginal rate of income tax and employee NI, measured empirically
 * over a small slice of income so band edges and the taper are handled exactly.
 */
export function marginalRatePct(grossSalary: number, region: TaxRegion): number {
  const step = 100;
  const base = incomeTaxFor(grossSalary, region) + employeeNiFor(grossSalary);
  const raised = incomeTaxFor(grossSalary + step, region) + employeeNiFor(grossSalary + step);
  return ((raised - base) / step) * 100;
}

/** Tax and NI saved by giving up `sacrifice` of gross salary. */
export function salarySacrificeSaving(
  grossSalary: number,
  sacrifice: number,
  region: TaxRegion,
): { taxSaved: number; niSaved: number; totalSaved: number; effectiveRatePct: number } {
  const amount = Math.max(0, Math.min(sacrifice, Math.max(0, grossSalary)));
  const taxSaved = incomeTaxFor(grossSalary, region) - incomeTaxFor(grossSalary - amount, region);
  const niSaved = employeeNiFor(grossSalary) - employeeNiFor(grossSalary - amount);
  const totalSaved = taxSaved + niSaved;
  return {
    taxSaved,
    niSaved,
    totalSaved,
    effectiveRatePct: amount > 0 ? (totalSaved / amount) * 100 : 0,
  };
}

// ---------------------------------------------------------------------------
// Benefit in Kind
// ---------------------------------------------------------------------------

export function bikPercentFor(vehicle: VehicleSpec, taxYear: TaxYear): number {
  const cap = BIK_MAX_PCT[taxYear];

  if (vehicle.fuelType === 'bev') return ZERO_EMISSION_BIK_PCT[taxYear];

  const co2 = Math.max(0, Math.round(vehicle.co2gPerKm));
  let pct: number;

  if (co2 <= 50) {
    const band =
      PHEV_BIK_BANDS.find((b) => vehicle.phevElectricRangeMi >= b.minElectricRangeMi) ??
      PHEV_BIK_BANDS[PHEV_BIK_BANDS.length - 1];
    pct = band.pct[taxYear];
  } else if (co2 <= 54) {
    pct = BAND_51_54[taxYear];
  } else {
    // From 55 g/km the percentage rises by one point every 5 g/km.
    pct = BASE_AT_55[taxYear] + Math.floor((co2 - 55) / 5);
  }

  if (vehicle.fuelType === 'diesel' && !vehicle.dieselRde2) {
    pct += DIESEL_SURCHARGE_PCT;
  }
  return Math.min(cap, pct);
}

export function bikTaxFor(
  vehicle: VehicleSpec,
  p11dGBP: number,
  capitalContributionGBP: number,
  taxYear: TaxYear,
  grossSalary: number,
  region: TaxRegion,
): { bikPercent: number; bikValueGBP: number; bikTaxGBP: number } {
  const bikPercent = bikPercentFor(vehicle, taxYear);
  // A capital contribution reduces the price on which the benefit is charged,
  // capped at £5,000 by statute.
  const contribution = Math.min(5000, Math.max(0, capitalContributionGBP));
  const basis = Math.max(0, p11dGBP - contribution);
  const bikValueGBP = (basis * bikPercent) / 100;

  // The benefit sits on top of salary, so it is taxed at the marginal rate the
  // driver reaches once it is added — computed exactly rather than assumed.
  const bikTaxGBP =
    incomeTaxFor(grossSalary + bikValueGBP, region) - incomeTaxFor(grossSalary, region);

  return { bikPercent, bikValueGBP, bikTaxGBP };
}

/**
 * Car fuel benefit charge, payable when an employer funds private mileage in a
 * combustion company car. There is no equivalent charge for electricity.
 */
export function fuelBenefitTaxFor(
  vehicle: VehicleSpec,
  bikPercent: number,
  taxYear: TaxYear,
  grossSalary: number,
  region: TaxRegion,
): number {
  if (vehicle.fuelType === 'bev') return 0;
  void taxYear;
  const benefit = (CAR_FUEL_BENEFIT_MULTIPLIER * bikPercent) / 100;
  return incomeTaxFor(grossSalary + benefit, region) - incomeTaxFor(grossSalary, region);
}

export function class1aFor(bikValueGBP: number): number {
  return (bikValueGBP * CLASS_1A_RATE_PCT) / 100;
}

// ---------------------------------------------------------------------------
// Mileage reimbursement
// ---------------------------------------------------------------------------

/** Tax-free mileage allowance for business miles in a personally-owned car. */
export function amapPaymentFor(businessMiles: number): number {
  const miles = Math.max(0, businessMiles);
  const first = Math.min(miles, AMAP_THRESHOLD_MILES);
  const rest = Math.max(0, miles - AMAP_THRESHOLD_MILES);
  return (first * AMAP_FIRST_10K_PENCE + rest * AMAP_ABOVE_10K_PENCE) / 100;
}

export function advisoryElectricPaymentFor(businessMiles: number): number {
  return (Math.max(0, businessMiles) * ADVISORY_ELECTRIC_RATE_PENCE) / 100;
}

export function advisoryFuelPaymentFor(businessMiles: number): number {
  return (Math.max(0, businessMiles) * ADVISORY_FUEL_RATE_PENCE) / 100;
}

// ---------------------------------------------------------------------------
// Vehicle Excise Duty
// ---------------------------------------------------------------------------

/** Bands for cars first registered between March 2001 and March 2017. */
const LEGACY_VED_BANDS: { upToCo2: number; annualGBP: number }[] = [
  { upToCo2: 100, annualGBP: 20 },
  { upToCo2: 110, annualGBP: 20 },
  { upToCo2: 120, annualGBP: 35 },
  { upToCo2: 130, annualGBP: 165 },
  { upToCo2: 140, annualGBP: 195 },
  { upToCo2: 150, annualGBP: 215 },
  { upToCo2: 165, annualGBP: 265 },
  { upToCo2: 175, annualGBP: 315 },
  { upToCo2: 185, annualGBP: 345 },
  { upToCo2: 200, annualGBP: 395 },
  { upToCo2: 225, annualGBP: 430 },
  { upToCo2: 255, annualGBP: 735 },
  { upToCo2: Infinity, annualGBP: 760 },
];

export interface VedBreakdown {
  annualGBP: number;
  standardGBP: number;
  supplementGBP: number;
  supplementApplies: boolean;
  explanation: string;
}

/**
 * Average annual VED across the comparison term.
 *
 * The first-year "showroom tax" is deliberately excluded: it is part of a new
 * car's on-the-road price rather than a running cost, and for a lease or
 * company car the driver never sees it.
 */
export function vedFor(
  vehicle: VehicleSpec,
  currentYear: number,
  termYears: number,
): VedBreakdown {
  if (vehicle.firstRegisteredYear < 2017) {
    const band =
      LEGACY_VED_BANDS.find((b) => vehicle.co2gPerKm <= b.upToCo2) ??
      LEGACY_VED_BANDS[LEGACY_VED_BANDS.length - 1];
    const annual = vehicle.fuelType === 'bev' ? VED.standardGBP : band.annualGBP;
    return {
      annualGBP: annual,
      standardGBP: annual,
      supplementGBP: 0,
      supplementApplies: false,
      explanation:
        vehicle.fuelType === 'bev'
          ? 'Registered before April 2017. Electric cars have paid the standard rate since April 2025.'
          : `Registered before April 2017, so taxed on the legacy CO2 bands at ${vehicle.co2gPerKm} g/km.`,
    };
  }

  const overThreshold = vehicle.listPriceGBP > VED.expensiveCarThresholdGBP;
  // The supplement runs with licences 2 to 6, i.e. ages 1 to 5 inclusive.
  let supplementYears = 0;
  const years = Math.max(1, Math.round(termYears));
  for (let i = 0; i < years; i += 1) {
    const age = currentYear + i - vehicle.firstRegisteredYear;
    if (overThreshold && age >= 1 && age <= VED.expensiveCarSupplementYears) supplementYears += 1;
  }
  const supplementGBP = (supplementYears / years) * VED.expensiveCarSupplementGBP;

  return {
    annualGBP: VED.standardGBP + supplementGBP,
    standardGBP: VED.standardGBP,
    supplementGBP,
    supplementApplies: supplementGBP > 0,
    explanation: overThreshold
      ? `List price over £${VED.expensiveCarThresholdGBP.toLocaleString('en-GB')}, so the £${VED.expensiveCarSupplementGBP} Expensive Car Supplement applies for five years from the second licence — averaged over your ${years}-year term.`
      : 'Standard rate. List price is below the Expensive Car Supplement threshold.',
  };
}

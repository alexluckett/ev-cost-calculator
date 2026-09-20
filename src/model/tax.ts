/**
 * UK personal tax, company car tax and road tax.
 *
 * The marginal rate is derived rather than picked from a dropdown, so the
 * personal-allowance taper between £100,000 and £125,140 — an effective 60%
 * band, and the reason salary sacrifice is worth so much there — falls out
 * automatically.
 */

import {
  BAND_51_54,
  BASE_AT_55,
  BIK_MAX_PCT,
  CAR_FUEL_BENEFIT_MULTIPLIER,
  DIESEL_SURCHARGE_PCT,
  LEGACY_VED_BANDS,
  NI_MAIN_RATE_PCT,
  NI_PRIMARY_THRESHOLD,
  NI_UPPER_EARNINGS_LIMIT,
  NI_UPPER_RATE_PCT,
  PA_TAPER_THRESHOLD,
  PERSONAL_ALLOWANCE,
  PHEV_BIK_BANDS,
  TAX_BANDS,
  VED,
  ZERO_EMISSION_BIK_PCT,
  type TaxYear,
} from '../data/tax';
import type { VehicleSpec } from './types';

export function personalAllowanceFor(grossSalary: number): number {
  if (grossSalary <= PA_TAPER_THRESHOLD) return PERSONAL_ALLOWANCE;
  return Math.max(0, PERSONAL_ALLOWANCE - (grossSalary - PA_TAPER_THRESHOLD) / 2);
}

export function incomeTaxFor(grossSalary: number): number {
  const salary = Math.max(0, grossSalary);
  const taxable = Math.max(0, salary - personalAllowanceFor(salary));

  let tax = 0;
  let previousCeiling = 0;
  for (const band of TAX_BANDS) {
    if (taxable <= previousCeiling) break;
    tax += ((Math.min(taxable, band.upTo) - previousCeiling) * band.ratePct) / 100;
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

/**
 * Combined marginal rate of income tax and employee NI, measured over a small
 * slice of income so band edges and the taper are handled exactly.
 */
export function marginalRatePct(grossSalary: number): number {
  const step = 100;
  const base = incomeTaxFor(grossSalary) + employeeNiFor(grossSalary);
  const raised = incomeTaxFor(grossSalary + step) + employeeNiFor(grossSalary + step);
  return ((raised - base) / step) * 100;
}

/** Tax and NI saved by giving up `sacrifice` of gross salary. */
export function salarySacrificeSaving(grossSalary: number, sacrifice: number): number {
  const amount = Math.max(0, Math.min(sacrifice, Math.max(0, grossSalary)));
  return (
    incomeTaxFor(grossSalary) -
    incomeTaxFor(grossSalary - amount) +
    employeeNiFor(grossSalary) -
    employeeNiFor(grossSalary - amount)
  );
}

// --- Company car tax -------------------------------------------------------

export function bikPercentFor(vehicle: VehicleSpec, taxYear: TaxYear): number {
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

  if (vehicle.fuelType === 'diesel' && !vehicle.dieselRde2) pct += DIESEL_SURCHARGE_PCT;
  return Math.min(BIK_MAX_PCT[taxYear], pct);
}

/** Tax on a benefit, charged on top of salary at the rate it then reaches. */
export function taxOnBenefit(benefitGBP: number, grossSalary: number): number {
  return incomeTaxFor(grossSalary + benefitGBP) - incomeTaxFor(grossSalary);
}

/**
 * Car fuel benefit charge, payable when an employer funds private mileage in a
 * combustion company car. There is no equivalent charge for electricity, which
 * is what makes employer-paid charging such a good perk on an electric car.
 */
export function fuelBenefitFor(vehicle: VehicleSpec, bikPercent: number): number {
  if (vehicle.fuelType === 'bev') return 0;
  return (CAR_FUEL_BENEFIT_MULTIPLIER * bikPercent) / 100;
}

// --- Road tax --------------------------------------------------------------

export interface VedBreakdown {
  annualGBP: number;
  explanation: string;
  supplementGBP: number;
}

/**
 * Average annual road tax across the comparison term. The first-year
 * "showroom tax" is excluded deliberately: it is part of a new car's
 * on-the-road price rather than a running cost.
 */
export function vedFor(vehicle: VehicleSpec, currentYear: number, termYears: number): VedBreakdown {
  if (vehicle.firstRegisteredYear < 2017) {
    const band =
      LEGACY_VED_BANDS.find((b) => vehicle.co2gPerKm <= b.upToCo2) ??
      LEGACY_VED_BANDS[LEGACY_VED_BANDS.length - 1];
    const annual = vehicle.fuelType === 'bev' ? VED.standardGBP : band.annualGBP;
    return {
      annualGBP: annual,
      supplementGBP: 0,
      explanation:
        vehicle.fuelType === 'bev'
          ? 'Registered before April 2017. Electric cars have paid the standard rate since April 2025.'
          : `Registered before April 2017, so taxed on the legacy CO2 bands: band ${band.band} at ${vehicle.co2gPerKm} g/km.`,
    };
  }

  const threshold =
    vehicle.fuelType === 'bev'
      ? VED.expensiveCarThresholdZeroEmissionGBP
      : VED.expensiveCarThresholdGBP;
  const overThreshold = vehicle.listPriceGBP > threshold;

  const years = Math.max(1, Math.round(termYears));
  let supplementYears = 0;
  for (let i = 0; i < years; i += 1) {
    const age = currentYear + i - vehicle.firstRegisteredYear;
    if (overThreshold && age >= 1 && age <= VED.expensiveCarSupplementYears) supplementYears += 1;
  }
  const supplementGBP = (supplementYears / years) * VED.expensiveCarSupplementGBP;

  return {
    annualGBP: VED.standardGBP + supplementGBP,
    supplementGBP,
    explanation: overThreshold
      ? `List price over £${threshold.toLocaleString('en-GB')}, so the £${VED.expensiveCarSupplementGBP} Expensive Car Supplement applies for five years from the second licence — averaged over your ${years}-year term.`
      : `Standard rate. Below the £${threshold.toLocaleString('en-GB')} Expensive Car Supplement threshold.`,
  };
}

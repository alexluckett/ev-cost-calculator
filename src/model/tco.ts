/**
 * Assembles a scenario into an itemised annual cost, then into a term total.
 *
 * The guiding rule is that every line is a cost *the driver actually bears*
 * under that ownership model. A leased or salary-sacrificed car doesn't pay
 * VED or insurance separately when they are bundled into the contract, a
 * company-car driver's cost of having the car is the tax on the benefit, and a
 * cash buyer's biggest cost is depreciation they never write a cheque for.
 */

import { CORPORATION_TAX_MAIN_RATE_PCT, type TaxYear } from '../data/tax';
import { computeEnergy, energyInflationFactor } from './energy';
import {
  advisoryElectricPaymentFor,
  advisoryFuelPaymentFor,
  amapPaymentFor,
  bikTaxFor,
  class1aFor,
  fuelBenefitTaxFor,
  marginalRatePct,
  salarySacrificeSaving,
  vedFor,
} from './tax';
import type {
  Assumptions,
  CostLine,
  EnergyPrices,
  Scenario,
  ScenarioResult,
  TaxProfile,
  TaxResult,
  UsageInputs,
} from './types';

const CURRENT_YEAR = new Date().getFullYear();

function isCompanyProvided(model: Scenario['ownership']['model']): boolean {
  return model === 'company-car' || model === 'salary-sacrifice';
}

export function computeScenario(
  scenario: Scenario,
  usage: UsageInputs,
  prices: EnergyPrices,
  tax: TaxProfile,
  assumptions: Assumptions,
  includeCapitalCosts: boolean,
): ScenarioResult {
  const { vehicle, ownership, running, charging } = scenario;
  const warnings: string[] = [];
  const energy = computeEnergy(scenario, usage, prices, assumptions);
  const lines: CostLine[] = [];

  const businessMiles = (usage.annualMiles * Math.min(100, Math.max(0, usage.businessMilesPct))) / 100;
  const companyProvided = isCompanyProvided(ownership.model);
  const taxYear = tax.taxYear as TaxYear;

  // -- Energy -------------------------------------------------------------
  // If the employer funds all fuel or charging, the driver pays nothing at the
  // pump but may pick up a fuel benefit charge instead (combustion cars only).
  const driverPaysEnergy = !(companyProvided && ownership.employerPaysPrivateFuel);
  const energyCost = driverPaysEnergy ? energy.totalCostGBP : 0;
  if (energyCost > 0) {
    lines.push({
      key: 'energy',
      label: vehicle.fuelType === 'bev' ? 'Electricity' : 'Fuel and electricity',
      annualGBP: energyCost,
      group: 'energy',
      detail: `${energy.pencePerMile.toFixed(2)}p per mile`,
    });
  }

  // -- Benefit in Kind ----------------------------------------------------
  let taxResult: TaxResult = {
    bikPercent: 0,
    bikValueGBP: 0,
    bikTaxGBP: 0,
    fuelBenefitTaxGBP: 0,
    salarySacrificeGrossGBP: 0,
    salarySacrificeNetGBP: 0,
    marginalRatePct: marginalRatePct(tax.grossSalaryGBP, tax.region),
    employerClass1aGBP: 0,
    employerNetCostGBP: 0,
  };

  if (companyProvided) {
    const { bikPercent, bikValueGBP, bikTaxGBP } = bikTaxFor(
      vehicle,
      ownership.p11dGBP,
      ownership.capitalContributionGBP,
      taxYear,
      tax.grossSalaryGBP,
      tax.region,
    );
    const fuelBenefitTaxGBP = ownership.employerPaysPrivateFuel
      ? fuelBenefitTaxFor(vehicle, bikPercent, taxYear, tax.grossSalaryGBP, tax.region)
      : 0;

    taxResult = { ...taxResult, bikPercent, bikValueGBP, bikTaxGBP, fuelBenefitTaxGBP };

    lines.push({
      key: 'bik',
      label: 'Benefit in Kind tax',
      annualGBP: bikTaxGBP,
      group: 'tax',
      detail: `${bikPercent}% of £${Math.round(ownership.p11dGBP).toLocaleString('en-GB')} P11D = £${Math.round(bikValueGBP).toLocaleString('en-GB')} taxable benefit`,
    });
    if (fuelBenefitTaxGBP > 0) {
      lines.push({
        key: 'fuel-benefit',
        label: 'Car fuel benefit charge',
        annualGBP: fuelBenefitTaxGBP,
        group: 'tax',
        detail: 'Employer pays for private fuel, so the fixed fuel benefit applies',
      });
    }
  }

  // -- Paying for the car itself -----------------------------------------
  const annualLease = ownership.monthlyPaymentGBP * 12;
  const depositAnnualised =
    ownership.termMonths > 0 ? ownership.depositGBP / (ownership.termMonths / 12) : 0;

  if (ownership.model === 'salary-sacrifice') {
    const grossAnnual = annualLease;
    const saving = salarySacrificeSaving(tax.grossSalaryGBP, grossAnnual, tax.region);
    const netAnnual = grossAnnual - saving.totalSaved;
    taxResult.salarySacrificeGrossGBP = grossAnnual;
    taxResult.salarySacrificeNetGBP = netAnnual;
    if (includeCapitalCosts) {
      lines.push({
        key: 'sacrifice',
        label: 'Salary sacrifice (after tax and NI relief)',
        annualGBP: netAnnual,
        group: 'capital',
        detail: `£${Math.round(grossAnnual).toLocaleString('en-GB')} gross, ${saving.effectiveRatePct.toFixed(0)}% relief`,
      });
    }
    if (grossAnnual > tax.grossSalaryGBP * 0.4) {
      warnings.push(
        'The sacrifice is a large share of salary. Schemes cannot take pay below the National Minimum Wage.',
      );
    }
  } else if (ownership.model === 'personal-finance') {
    if (includeCapitalCosts) {
      lines.push({
        key: 'finance',
        label: 'Finance or lease payments',
        annualGBP: annualLease + depositAnnualised,
        group: 'capital',
        detail: `£${Math.round(ownership.monthlyPaymentGBP).toLocaleString('en-GB')}/month${ownership.depositGBP > 0 ? ` plus £${Math.round(ownership.depositGBP).toLocaleString('en-GB')} deposit spread over ${ownership.termMonths} months` : ''}`,
      });
    }
  } else if (ownership.model === 'personal-cash' && ownership.includeDepreciation && includeCapitalCosts) {
    const residual = (ownership.residualValuePct / 100) * vehicle.purchasePriceGBP;
    const annualDepreciation = Math.max(0, vehicle.purchasePriceGBP - residual) / Math.max(1, usage.termYears);
    lines.push({
      key: 'depreciation',
      label: 'Depreciation',
      annualGBP: annualDepreciation,
      group: 'capital',
      detail: `£${Math.round(vehicle.purchasePriceGBP).toLocaleString('en-GB')} down to ${ownership.residualValuePct}% over ${usage.termYears} years`,
    });
  }

  // -- Standing running costs --------------------------------------------
  const bundled = companyProvided && ownership.bundledRunningCosts;
  const ved = vedFor(vehicle, CURRENT_YEAR, usage.termYears);
  const vedAnnual = running.vedOverrideGBP ?? ved.annualGBP;

  if (!bundled) {
    if (vedAnnual > 0) {
      lines.push({ key: 'ved', label: 'Vehicle Excise Duty', annualGBP: vedAnnual, group: 'fixed', detail: ved.explanation });
    }
    if (running.insuranceGBP > 0) {
      lines.push({ key: 'insurance', label: 'Insurance', annualGBP: running.insuranceGBP, group: 'fixed' });
    }
    if (running.servicingGBP > 0) {
      lines.push({ key: 'servicing', label: 'Servicing and maintenance', annualGBP: running.servicingGBP, group: 'fixed' });
    }
    if (running.tyresPencePerMile > 0) {
      lines.push({
        key: 'tyres',
        label: 'Tyres and consumables',
        annualGBP: (running.tyresPencePerMile * usage.annualMiles) / 100,
        group: 'fixed',
        detail: `${running.tyresPencePerMile}p per mile`,
      });
    }
    if (running.motGBP > 0) {
      lines.push({ key: 'mot', label: 'MOT', annualGBP: running.motGBP, group: 'fixed' });
    }
    if (running.breakdownCoverGBP > 0) {
      lines.push({ key: 'breakdown', label: 'Breakdown cover', annualGBP: running.breakdownCoverGBP, group: 'fixed' });
    }
  } else {
    lines.push({
      key: 'bundled',
      label: 'Insurance, servicing, tyres and VED',
      annualGBP: 0,
      group: 'fixed',
      detail: 'Included in the contract',
    });
  }

  if (running.congestionChargeDaysPerYear > 0) {
    // The London Congestion Charge is £15 a day; electric cars lost their full
    // exemption at the end of 2025 and now get a percentage discount instead.
    const dailyCharge = 15;
    const discount = vehicle.fuelType === 'bev' ? 0.25 : 0;
    lines.push({
      key: 'congestion',
      label: 'Congestion and clean air zone charges',
      annualGBP: running.congestionChargeDaysPerYear * dailyCharge * (1 - discount),
      group: 'fixed',
      detail: discount > 0 ? 'Electric cars receive a discount rather than an exemption' : undefined,
    });
  }

  if (running.otherAnnualGBP !== 0) {
    lines.push({ key: 'other', label: 'Other annual costs', annualGBP: running.otherAnnualGBP, group: 'fixed' });
  }

  // -- Announced per-mile road charge ------------------------------------
  if (assumptions.applyEvRoadCharge) {
    const rate =
      vehicle.fuelType === 'bev'
        ? assumptions.evRoadChargePencePerMile
        : vehicle.fuelType === 'phev'
          ? assumptions.phevRoadChargePencePerMile
          : 0;
    if (rate > 0) {
      lines.push({
        key: 'road-charge',
        label: 'Per-mile road charge',
        annualGBP: (rate * usage.annualMiles) / 100,
        group: 'tax',
        detail: `${rate}p per mile, announced to start April 2028`,
      });
    }
  }

  // -- Mileage reimbursement (income, so negative) ------------------------
  if (businessMiles > 0) {
    if (!companyProvided && ownership.claimsAmap) {
      lines.push({
        key: 'amap',
        label: 'Business mileage claimed (AMAP)',
        annualGBP: -amapPaymentFor(businessMiles),
        group: 'reimbursement',
        detail: `${Math.round(businessMiles).toLocaleString('en-GB')} business miles at 45p then 25p`,
      });
    } else if (companyProvided && ownership.claimsAdvisoryRate && driverPaysEnergy) {
      // HMRC's electric rate depends on where the car was charged, so use the
      // driver's own home-versus-public split rather than a single rate.
      const homeKWh = energy.rows
        .filter((r) => r.source === 'homeOffPeak' || r.source === 'homePeak')
        .reduce((sum, r) => sum + r.gridKWh, 0);
      const publicKWh = energy.rows
        .filter((r) => r.source === 'publicRapid' || r.source === 'publicSlow')
        .reduce((sum, r) => sum + r.gridKWh, 0);
      const homeSharePct = homeKWh + publicKWh > 0 ? (homeKWh / (homeKWh + publicKWh)) * 100 : 100;

      const payment =
        vehicle.fuelType === 'bev'
          ? advisoryElectricPaymentFor(businessMiles, homeSharePct)
          : advisoryFuelPaymentFor(businessMiles);
      lines.push({
        key: 'aer',
        label: 'Business mileage reimbursed',
        annualGBP: -payment,
        group: 'reimbursement',
        detail:
          vehicle.fuelType === 'bev'
            ? `${Math.round(businessMiles).toLocaleString('en-GB')} miles at the Advisory Electric Rate, blended ${Math.round(homeSharePct)}% home / ${100 - Math.round(homeSharePct)}% public`
            : `${Math.round(businessMiles).toLocaleString('en-GB')} miles at an indicative advisory fuel rate`,
      });
    }
  }

  // -- Employer view ------------------------------------------------------
  if (companyProvided) {
    const corp = Math.min(100, Math.max(0, tax.corporationTaxRatePct ?? CORPORATION_TAX_MAIN_RATE_PCT)) / 100;
    const class1a = class1aFor(taxResult.bikValueGBP);
    taxResult.employerClass1aGBP = class1a;
    if (ownership.model === 'company-car') {
      taxResult.employerNetCostGBP = (annualLease + class1a) * (1 - corp);
    } else {
      // Under salary sacrifice the lease is funded from gross pay, so the
      // employer's position is the NI saved on the sacrifice less Class 1A.
      const employerNiSaved = (taxResult.salarySacrificeGrossGBP * 15) / 100;
      taxResult.employerNetCostGBP = (class1a - employerNiSaved) * (1 - corp);
    }
  }

  // -- Totals -------------------------------------------------------------
  const annualTotalGBP = lines.reduce((sum, l) => sum + l.annualGBP, 0);
  const inflation = energyInflationFactor(usage.termYears, assumptions.energyInflationPct);
  const nonEnergyAnnual = annualTotalGBP - energyCost;
  const termTotalGBP = nonEnergyAnnual * usage.termYears + energyCost * usage.termYears * inflation;

  const annualCO2Kg =
    (energy.annualGridKWh * assumptions.gridCarbonIntensityGPerKWh) / 1000 +
    energy.annualLitres *
      (vehicle.liquidFuel === 'diesel' ? assumptions.dieselKgCO2PerLitre : assumptions.petrolKgCO2PerLitre);

  if (charging.rapidEntryMode === 'sessions' && energy.annualBatteryKWh > 0) {
    const rapidShare = energy.rows.find((r) => r.source === 'publicRapid')?.sharePct ?? 0;
    if (rapidShare >= 99.9) {
      warnings.push('Those rapid sessions account for all of the car’s annual energy — there is nothing left to charge at home.');
    }
  }
  if (ved.supplementApplies && running.vedOverrideGBP === null) {
    warnings.push(
      `The Expensive Car Supplement applies to this car: an extra £${Math.round(ved.supplementGBP)} a year averaged over the term.`,
    );
  }

  return {
    scenarioId: scenario.id,
    label: scenario.label,
    colour: scenario.colour,
    energy,
    tax: taxResult,
    lines,
    annualEnergyGBP: energyCost,
    annualTotalGBP,
    monthlyTotalGBP: annualTotalGBP / 12,
    termTotalGBP,
    costPerMilePence: usage.annualMiles > 0 ? (annualTotalGBP * 100) / usage.annualMiles : 0,
    annualCO2Kg,
    warnings,
  };
}

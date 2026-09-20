/**
 * Assembles a scenario into an itemised annual cost.
 *
 * The rule throughout is that every line is a cost the driver actually bears
 * under that ownership model: a company car driver's cost of having the car is
 * the tax on the benefit, not its price, and a bundled contract means no
 * separate insurance or road tax bill.
 */

import type { TaxYear } from '../data/tax';
import { computeEnergy } from './energy';
import { bikPercentFor, fuelBenefitFor, salarySacrificeSaving, taxOnBenefit, vedFor } from './tax';
import type { AppState, CostLine, Scenario, ScenarioResult } from './types';

const CURRENT_YEAR = new Date().getFullYear();

export function computeScenario(scenario: Scenario, state: AppState): ScenarioResult {
  const { vehicle, ownership, running } = scenario;
  const { annualMiles, termYears, grossSalaryGBP } = state;
  const companyProvided = ownership.model !== 'personal';
  const lines: CostLine[] = [];
  const warnings: string[] = [];

  const energy = computeEnergy(scenario, annualMiles, state.prices);

  // --- Energy ---
  // If the employer funds everything, the driver never sees a bill — and for
  // an electric car there is no benefit charge to replace it, because
  // electricity is not a "fuel" for benefit purposes.
  const driverPaysEnergy = !(companyProvided && ownership.employerPaysEnergy);
  const annualEnergyGBP = driverPaysEnergy ? energy.costGBP : 0;
  if (annualEnergyGBP > 0) {
    lines.push({
      key: 'energy',
      label: vehicle.fuelType === 'bev' ? 'Electricity' : 'Fuel and electricity',
      annualGBP: annualEnergyGBP,
      detail: `${energy.pencePerMile.toFixed(1)}p per mile, including charging losses`,
    });
  }

  // --- Company car tax ---
  let bikPercent = 0;
  if (companyProvided) {
    bikPercent = bikPercentFor(vehicle, state.taxYear as TaxYear);
    const bikValue = (Math.max(0, ownership.p11dGBP) * bikPercent) / 100;
    lines.push({
      key: 'bik',
      label: 'Company car tax',
      annualGBP: taxOnBenefit(bikValue, grossSalaryGBP),
      detail: `${bikPercent}% of £${Math.round(ownership.p11dGBP).toLocaleString('en-GB')} = £${Math.round(bikValue).toLocaleString('en-GB')} taxable benefit`,
    });

    if (ownership.employerPaysEnergy) {
      const fuelBenefit = fuelBenefitFor(vehicle, bikPercent);
      if (fuelBenefit > 0) {
        lines.push({
          key: 'fuel-benefit',
          label: 'Car fuel benefit charge',
          annualGBP: taxOnBenefit(fuelBenefit, grossSalaryGBP),
          detail: 'A fixed charge for employer-paid private fuel, however little you use',
        });
      }
    }
  }

  // --- Salary sacrifice ---
  if (ownership.model === 'salary-sacrifice') {
    const gross = Math.max(0, ownership.monthlySacrificeGBP) * 12;
    const saved = salarySacrificeSaving(grossSalaryGBP, gross);
    lines.push({
      key: 'sacrifice',
      label: 'Salary sacrifice, after tax relief',
      annualGBP: gross - saved,
      detail: `£${Math.round(gross).toLocaleString('en-GB')} gross, ${gross > 0 ? Math.round((saved / gross) * 100) : 0}% relief`,
    });
    if (gross > grossSalaryGBP * 0.4) {
      warnings.push('That is a large share of salary. Schemes cannot take pay below the minimum wage.');
    }
  }

  // --- Standing costs ---
  const ved = vedFor(vehicle, CURRENT_YEAR, termYears);
  if (companyProvided && ownership.bundledRunningCosts) {
    lines.push({
      key: 'bundled',
      label: 'Insurance, servicing, tyres and road tax',
      annualGBP: 0,
      detail: 'Included in the contract',
    });
  } else {
    lines.push({ key: 'ved', label: 'Road tax', annualGBP: ved.annualGBP, detail: ved.explanation });
    if (running.insuranceGBP > 0) {
      lines.push({ key: 'insurance', label: 'Insurance', annualGBP: running.insuranceGBP });
    }
    if (running.servicingGBP > 0) {
      lines.push({ key: 'servicing', label: 'Servicing', annualGBP: running.servicingGBP });
    }
    if (running.tyresPencePerMile > 0) {
      lines.push({
        key: 'tyres',
        label: 'Tyres and consumables',
        annualGBP: (running.tyresPencePerMile * annualMiles) / 100,
        detail: `${running.tyresPencePerMile}p per mile`,
      });
    }
    if (ved.supplementGBP > 0) {
      warnings.push(
        `The Expensive Car Supplement applies: an extra £${Math.round(ved.supplementGBP)} a year averaged over the term.`,
      );
    }
  }

  const annualTotalGBP = lines.reduce((sum, l) => sum + l.annualGBP, 0);

  return {
    scenarioId: scenario.id,
    label: scenario.label,
    colour: scenario.colour,
    energy,
    lines,
    bikPercent,
    annualEnergyGBP,
    annualTotalGBP,
    monthlyTotalGBP: annualTotalGBP / 12,
    termTotalGBP: annualTotalGBP * termYears,
    costPerMilePence: annualMiles > 0 ? (annualTotalGBP * 100) / annualMiles : 0,
    warnings,
  };
}

export function computeAll(state: AppState): ScenarioResult[] {
  return state.scenarios.map((s) => computeScenario(s, state));
}

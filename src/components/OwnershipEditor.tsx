import { money, percent } from '../lib/format';
import type { OwnershipInputs, OwnershipModel, ScenarioResult, TaxProfile, VehicleSpec } from '../model/types';
import { Field, NumberInput, Select, Toggle } from './ui';

const MODEL_OPTIONS: { value: OwnershipModel; label: string }[] = [
  { value: 'personal-cash', label: 'Personal — owned outright' },
  { value: 'personal-finance', label: 'Personal — finance or lease' },
  { value: 'company-car', label: 'Company car (BiK)' },
  { value: 'salary-sacrifice', label: 'Salary sacrifice (BiK)' },
];

const MODEL_EXPLAINERS: Record<OwnershipModel, string> = {
  'personal-cash':
    'You bought it with your own money. The real cost of the car is what it loses in value, which is why depreciation is offered below.',
  'personal-finance':
    'You pay a monthly figure out of taxed income. The deposit is spread across the contract.',
  'company-car':
    'The company pays for the car; you pay income tax on the benefit. Your cost of having the car is that tax, not its price.',
  'salary-sacrifice':
    'You give up gross salary, so you save income tax and National Insurance on every pound sacrificed — and pay BiK on the car. This is usually the cheapest way to run a new EV if your employer offers it.',
};

export function OwnershipEditor({
  ownership,
  vehicle,
  tax,
  result,
  onChange,
}: {
  ownership: OwnershipInputs;
  vehicle: VehicleSpec;
  tax: TaxProfile;
  result: ScenarioResult;
  onChange: (next: OwnershipInputs) => void;
}) {
  const isCompany = ownership.model === 'company-car' || ownership.model === 'salary-sacrifice';
  const set = <K extends keyof OwnershipInputs>(key: K, value: OwnershipInputs[K]) =>
    onChange({ ...ownership, [key]: value });

  return (
    <div className="ownership-editor">
      <Field label="How is this car paid for?">
        <Select value={ownership.model} onChange={(model) => set('model', model)} options={MODEL_OPTIONS} />
      </Field>
      <p className="explainer">{MODEL_EXPLAINERS[ownership.model]}</p>

      {ownership.model === 'personal-cash' ? (
        <>
          <div className="grid-2">
            <Field label="What you paid for it" hint="Used as the basis for depreciation.">
              <NumberInput
                value={vehicle.purchasePriceGBP}
                min={0}
                step={500}
                prefix="£"
                disabled
                onChange={() => undefined}
              />
            </Field>
            <Field label="Value left at the end of the term" hint="As a percentage of what you paid. A three-year-old car is typically worth 45–60% of its new price; an old car close to the bottom of its curve loses very little.">
              <NumberInput
                value={ownership.residualValuePct}
                min={0}
                max={100}
                step={1}
                suffix="%"
                onChange={(v) => set('residualValuePct', v)}
              />
            </Field>
          </div>
          <Toggle
            checked={ownership.includeDepreciation}
            onChange={(v) => set('includeDepreciation', v)}
            label="Include depreciation"
            hint="Depreciation is usually the largest cost of owning a newish car, and the one nobody budgets for. Set the purchase price on the vehicle tab."
          />
        </>
      ) : null}

      {ownership.model === 'personal-finance' ? (
        <div className="grid-3">
          <Field label="Monthly payment">
            <NumberInput value={ownership.monthlyPaymentGBP} min={0} step={10} prefix="£" onChange={(v) => set('monthlyPaymentGBP', v)} />
          </Field>
          <Field label="Deposit">
            <NumberInput value={ownership.depositGBP} min={0} step={100} prefix="£" onChange={(v) => set('depositGBP', v)} />
          </Field>
          <Field label="Contract length">
            <NumberInput value={ownership.termMonths} min={1} max={120} step={1} suffix="months" onChange={(v) => set('termMonths', v)} />
          </Field>
        </div>
      ) : null}

      {isCompany ? (
        <>
          <div className="grid-2">
            <Field label="P11D value" hint="List price including options and delivery, excluding first registration fee and road tax. This is what BiK is charged on.">
              <NumberInput value={ownership.p11dGBP} min={0} step={500} prefix="£" onChange={(v) => set('p11dGBP', v)} />
            </Field>
            <Field label="Capital contribution" hint="A one-off payment towards the car reduces the value BiK is charged on, capped at £5,000 by statute.">
              <NumberInput value={ownership.capitalContributionGBP} min={0} max={5000} step={250} prefix="£" onChange={(v) => set('capitalContributionGBP', v)} />
            </Field>
          </div>

          {ownership.model === 'salary-sacrifice' ? (
            <Field label="Monthly gross sacrifice" hint="The figure taken off your gross pay, before tax. The scheme quote is normally given this way.">
              <NumberInput value={ownership.monthlyPaymentGBP} min={0} step={10} prefix="£" onChange={(v) => set('monthlyPaymentGBP', v)} />
            </Field>
          ) : (
            <Field label="Monthly cost to the company" hint="Only used for the employer view — it does not affect what you pay.">
              <NumberInput value={ownership.monthlyPaymentGBP} min={0} step={10} prefix="£" onChange={(v) => set('monthlyPaymentGBP', v)} />
            </Field>
          )}

          <div className="bik-summary">
            <div>
              <span className="bik-label">BiK rate {tax.taxYear}</span>
              <span className="bik-value">{percent(result.tax.bikPercent)}</span>
            </div>
            <div>
              <span className="bik-label">Taxable benefit</span>
              <span className="bik-value">{money(result.tax.bikValueGBP)}</span>
            </div>
            <div>
              <span className="bik-label">Tax you pay on it</span>
              <span className="bik-value">{money(result.tax.bikTaxGBP)}/yr</span>
            </div>
            {ownership.model === 'salary-sacrifice' ? (
              <div>
                <span className="bik-label">Sacrifice after relief</span>
                <span className="bik-value">{money(result.tax.salarySacrificeNetGBP)}/yr</span>
              </div>
            ) : null}
          </div>

          <Toggle
            checked={ownership.bundledRunningCosts}
            onChange={(v) => set('bundledRunningCosts', v)}
            label="Insurance, servicing, tyres and road tax are included in the contract"
            hint="Almost all salary sacrifice schemes bundle these. Untick it if you pay them yourself."
          />
          <Toggle
            checked={ownership.employerPaysPrivateFuel}
            onChange={(v) => set('employerPaysPrivateFuel', v)}
            label="Employer pays for all fuel or charging, including private miles"
            hint={
              vehicle.fuelType === 'bev'
                ? 'For an electric car this is a genuinely free perk — electricity is not treated as fuel for benefit purposes, so there is no charge to pay.'
                : 'For a combustion car this triggers the car fuel benefit charge, which is a fixed sum regardless of how much fuel you actually use. It rarely pays unless your private mileage is very high.'
            }
          />
          <Toggle
            checked={ownership.claimsAdvisoryRate}
            onChange={(v) => set('claimsAdvisoryRate', v)}
            label="Employer reimburses business miles at the advisory rate"
            disabled={ownership.employerPaysPrivateFuel}
          />
        </>
      ) : (
        <Toggle
          checked={ownership.claimsAmap}
          onChange={(v) => set('claimsAmap', v)}
          label="I claim business mileage at the approved rates (45p / 25p)"
          hint="Tax-free mileage allowance for using your own car on business. Set your business mileage share in the driving panel."
        />
      )}
    </div>
  );
}

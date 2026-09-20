import { PUBLIC_NETWORK_PRESETS, TARIFF_PRESETS } from '../data/assumptions';
import {
  ADVISORY_ELECTRIC_RATE_HOME_PENCE,
  ADVISORY_ELECTRIC_RATE_PUBLIC_PENCE,
  TAX_YEARS,
  VED,
} from '../data/tax';
import { money, percent } from '../lib/format';
import { marginalRatePct } from '../model/tax';
import { businessMileageMatters } from '../state/readiness';
import type { AppState } from '../model/types';
import { Field, NumberInput, Select, Toggle } from './ui';

export function DrivingPanel({
  state,
  onPatch,
}: {
  state: AppState;
  onPatch: (patch: Partial<AppState>) => void;
}) {
  const { usage, tax } = state;
  const rate = marginalRatePct(tax.grossSalaryGBP, tax.region);
  const businessMatters = businessMileageMatters(state);
  const hasCars = state.scenarios.length > 0;

  return (
    <div className="panel-grid">
      <Field label="Annual mileage" hint="The single biggest driver of running cost. Your MOT history has your real figure if you are not sure.">
        <NumberInput value={usage.annualMiles} min={0} max={200000} step={500} suffix="miles" onChange={(annualMiles) => onPatch({ usage: { ...usage, annualMiles } })} />
      </Field>

      <Field label="Comparison term" hint="How far ahead to look. Costs that only apply in early years, such as the Expensive Car Supplement, are averaged across it.">
        <NumberInput value={usage.termYears} min={1} max={15} step={1} suffix="years" onChange={(termYears) => onPatch({ usage: { ...usage, termYears } })} />
      </Field>

      <Field
        label="Business mileage"
        hint="Share of your miles driven on business, used only to work out a mileage claim. It is not a way to tell the calculator who pays for your energy — that is set per car, under Ownership and tax."
      >
        <NumberInput value={usage.businessMilesPct} min={0} max={100} step={5} suffix="%" onChange={(businessMilesPct) => onPatch({ usage: { ...usage, businessMilesPct } })} />
        {hasCars && !businessMatters ? (
          <p className="field-inert-note">
            Changing this makes no difference right now — no car here claims mileage back. If your employer pays
            for your charging, that is the “employer pays for all fuel or charging” tick on the car itself.
          </p>
        ) : null}
      </Field>

      <Field label="Where you pay tax">
        <Select
          value={tax.region}
          onChange={(region) => onPatch({ tax: { ...tax, region } })}
          options={[
            { value: 'uk', label: 'England, Wales or Northern Ireland' },
            { value: 'scotland', label: 'Scotland' },
          ]}
        />
      </Field>

      <Field label="Gross salary" hint="Used to work out your marginal rate exactly, including the 60% band between £100,000 and £125,140 where salary sacrifice is worth the most.">
        <NumberInput value={tax.grossSalaryGBP} min={0} step={1000} prefix="£" onChange={(grossSalaryGBP) => onPatch({ tax: { ...tax, grossSalaryGBP } })} />
      </Field>

      <Field label="Tax year">
        <Select
          value={tax.taxYear}
          onChange={(taxYear) => onPatch({ tax: { ...tax, taxYear } })}
          options={TAX_YEARS.map((y) => ({ value: y, label: y }))}
        />
      </Field>

      <div className="marginal-callout">
        <span className="mc-label">Your marginal rate</span>
        <span className="mc-value">{percent(rate, 0)}</span>
        <span className="mc-sub">
          Income tax and National Insurance on the next pound you earn. Salary sacrifice gives relief at this rate.
        </span>
      </div>
    </div>
  );
}

export function EnergyPricesPanel({
  state,
  onPatch,
}: {
  state: AppState;
  onPatch: (patch: Partial<AppState>) => void;
}) {
  const { prices } = state;
  const set = (patch: Partial<typeof prices>) => onPatch({ prices: { ...prices, ...patch } });

  return (
    <>
      <div className="preset-row">
        <span className="preset-row-label">Start from a tariff</span>
        <div className="preset-chips">
          {TARIFF_PRESETS.map((t) => (
            <button
              key={t.id}
              type="button"
              className="chip"
              title={`${t.description} Cheap window: ${t.offPeakWindow}.`}
              onClick={() => set({ homeOffPeakPPerKWh: t.offPeakPPerKWh, homePeakPPerKWh: t.peakPPerKWh })}
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>

      <div className="preset-row">
        <span className="preset-row-label">Public charging</span>
        <div className="preset-chips">
          {PUBLIC_NETWORK_PRESETS.map((n) => (
            <button
              key={n.id}
              type="button"
              className="chip"
              title={n.note}
              onClick={() => set({ publicRapidPPerKWh: n.rapidPPerKWh, publicSlowPPerKWh: n.slowPPerKWh })}
            >
              {n.name}
            </button>
          ))}
        </div>
      </div>

      <div className="panel-grid">
        <Field label="Home off-peak" hint="Your cheap overnight unit rate. This is where an EV makes its money.">
          <NumberInput value={prices.homeOffPeakPPerKWh} min={0} max={100} step={0.5} suffix="p/kWh" onChange={(v) => set({ homeOffPeakPPerKWh: v })} />
        </Field>
        <Field label="Home peak" hint="Your day rate, for charging that misses the cheap window.">
          <NumberInput value={prices.homePeakPPerKWh} min={0} max={100} step={0.5} suffix="p/kWh" onChange={(v) => set({ homePeakPPerKWh: v })} />
        </Field>
        <Field label="Workplace" hint="Often free, in which case leave it at zero.">
          <NumberInput value={prices.workplacePPerKWh} min={0} max={100} step={0.5} suffix="p/kWh" onChange={(v) => set({ workplacePPerKWh: v })} />
        </Field>
        <Field label="Public rapid DC" hint="Superchargers and motorway rapids. Between 40p and 85p depending on network, membership and time of day.">
          <NumberInput value={prices.publicRapidPPerKWh} min={0} max={150} step={1} suffix="p/kWh" onChange={(v) => set({ publicRapidPPerKWh: v })} />
        </Field>
        <Field label="Public slow AC" hint="Destination and on-street charging while parked.">
          <NumberInput value={prices.publicSlowPPerKWh} min={0} max={150} step={1} suffix="p/kWh" onChange={(v) => set({ publicSlowPPerKWh: v })} />
        </Field>
        <Field label="Petrol">
          <NumberInput value={prices.petrolPPerLitre} min={50} max={300} step={1} suffix="p/litre" onChange={(v) => set({ petrolPPerLitre: v })} />
        </Field>
        <Field label="Diesel">
          <NumberInput value={prices.dieselPPerLitre} min={50} max={300} step={1} suffix="p/litre" onChange={(v) => set({ dieselPPerLitre: v })} />
        </Field>
        <Field label="Annual energy price rise" hint="Applied to both electricity and fuel across the term. Leave at zero to compare at today's prices.">
          <NumberInput value={state.assumptions.energyInflationPct} min={-10} max={25} step={0.5} suffix="%/yr" onChange={(v) => onPatch({ assumptions: { ...state.assumptions, energyInflationPct: v } })} />
        </Field>
      </div>
    </>
  );
}

export function AssumptionsPanel({
  state,
  onPatch,
}: {
  state: AppState;
  onPatch: (patch: Partial<AppState>) => void;
}) {
  const { assumptions, tax } = state;
  const set = (patch: Partial<typeof assumptions>) => onPatch({ assumptions: { ...assumptions, ...patch } });

  return (
    <div className="assumptions">
      <div className="panel-grid">
        <Field label="AC charging efficiency" hint="Share of grid energy that reaches the battery on a home charger. Typically 85–92%. Set it to 100 if your mi/kWh figure is already measured from the wall.">
          <NumberInput value={assumptions.acChargingEfficiencyPct} min={50} max={100} step={1} suffix="%" onChange={(v) => set({ acChargingEfficiencyPct: v })} />
        </Field>
        <Field label="DC charging efficiency" hint="Rapid charging skips the on-board charger, so it loses less — usually 93–96%.">
          <NumberInput value={assumptions.dcChargingEfficiencyPct} min={50} max={100} step={1} suffix="%" onChange={(v) => set({ dcChargingEfficiencyPct: v })} />
        </Field>
        <Field label="Grid carbon intensity" hint="UK average. Overnight charging on a windy night is far below this.">
          <NumberInput value={assumptions.gridCarbonIntensityGPerKWh} min={0} max={500} step={5} suffix="g/kWh" onChange={(v) => set({ gridCarbonIntensityGPerKWh: v })} />
        </Field>
        <Field label="Corporation tax rate" hint="Used only for the employer view.">
          <NumberInput value={tax.corporationTaxRatePct} min={0} max={50} step={1} suffix="%" onChange={(v) => onPatch({ tax: { ...tax, corporationTaxRatePct: v } })} />
        </Field>
      </div>

      <div className="assumption-block">
        <Toggle
          checked={assumptions.applyEvRoadCharge}
          onChange={(v) => set({ applyEvRoadCharge: v })}
          label="Include the announced per-mile road charge for plug-in cars"
          hint="A per-mile charge on electric and plug-in hybrid cars has been announced to start in April 2028. It is off by default because it is not yet in force."
        />
        {assumptions.applyEvRoadCharge ? (
          <div className="grid-2">
            <Field label="Electric cars">
              <NumberInput value={assumptions.evRoadChargePencePerMile} min={0} max={20} step={0.5} suffix="p/mi" onChange={(v) => set({ evRoadChargePencePerMile: v })} />
            </Field>
            <Field label="Plug-in hybrids">
              <NumberInput value={assumptions.phevRoadChargePencePerMile} min={0} max={20} step={0.5} suffix="p/mi" onChange={(v) => set({ phevRoadChargePencePerMile: v })} />
            </Field>
          </div>
        ) : null}
      </div>

      <Toggle
        checked={state.includeCapitalCosts}
        onChange={(v) => onPatch({ includeCapitalCosts: v })}
        label="Include the cost of the car itself"
        hint="Adds depreciation, finance payments and salary sacrifice to the totals. Company car tax is always shown, because that is a tax on having the car rather than the price of it."
      />

      <div className="tax-notes">
        <h4>Where these figures come from</h4>
        <ul>
          <li>
            <strong>Company car tax</strong> — zero-emission cars are charged at 3% of P11D in 2025/26, rising by a
            point a year to 9% in 2029/30. Cars over 50 g/km step up by one point every 5 g/km, and plug-in hybrids
            are banded on electric range.
          </li>
          <li>
            <strong>Income tax and NI</strong> — a £12,570 personal allowance tapering away above £100,000, employee
            NI at 8% then 2%, and the Scottish bands where they apply.
          </li>
          <li>
            <strong>Road tax</strong> — {money(VED.standardGBP)} standard rate, plus a{' '}
            {money(VED.expensiveCarSupplementGBP)} Expensive Car Supplement for five years on cars listed above{' '}
            {money(VED.expensiveCarThresholdGBP)} — or above{' '}
            {money(VED.expensiveCarThresholdZeroEmissionGBP)} for zero-emission cars, which have had their own higher
            threshold since April 2026. Cars registered before April 2017 use the legacy CO2 bands.
          </li>
          <li>
            <strong>Mileage</strong> — 45p then 25p approved rates for your own car. For a company EV the Advisory
            Electric Rate is {ADVISORY_ELECTRIC_RATE_HOME_PENCE}p a mile for home charging and{' '}
            {ADVISORY_ELECTRIC_RATE_PUBLIC_PENCE}p for public charging, blended here using your charging mix.
          </li>
        </ul>
        <p className="caveat">
          Tax and duty figures were checked against published rates for 2026/27; later years follow the published
          schedule. Rates change every April — check anything you are relying on, and override it here if it has
          moved.
        </p>
        <p className="caveat">
          <strong>Vehicle library figures are estimates, not measurements.</strong> Battery capacities, ranges and
          list prices are close to the published specifications, but the real-world mi/kWh and mpg figures — and the
          typical insurance and servicing costs — are indicative rather than sourced from any dataset. They are
          starting points. Your own trip computer and your own renewal quote beat every one of them, so replace them
          where you can.
        </p>
      </div>
    </div>
  );
}

import { PRESETS_BY_ID } from '../data/vehicles';
import { money, number, pence } from '../lib/format';
import {
  type TrackedRunningField,
  type TrackedVehicleField,
  differsFromPreset,
  overrideCount,
  presetDefaultsFor,
  resetP11d,
  resetRunningField,
  resetScenarioToPreset,
  resetVehicleField,
} from '../state/overrides';
import type { EnergyPrices, Scenario, ScenarioResult, TaxProfile, VehicleSpec } from '../model/types';
import { ChargingEditor } from './ChargingEditor';
import { OwnershipEditor } from './OwnershipEditor';
import { VehiclePicker } from './VehiclePicker';
import { Button, Disclosure, Field, NumberInput, type OverrideState, Pill, Select, Toggle } from './ui';

const FUEL_OPTIONS = [
  { value: 'bev', label: 'Electric' },
  { value: 'phev', label: 'Plug-in hybrid' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'petrol', label: 'Petrol' },
  { value: 'diesel', label: 'Diesel' },
] as const;

export function VehicleCard({
  scenario,
  result,
  prices,
  tax,
  isBaseline,
  canRemove,
  canDuplicate,
  onChange,
  onPreset,
  onRemove,
  onDuplicate,
  onMakeBaseline,
}: {
  scenario: Scenario;
  result: ScenarioResult;
  prices: EnergyPrices;
  tax: TaxProfile;
  isBaseline: boolean;
  canRemove: boolean;
  canDuplicate: boolean;
  onChange: (updater: (s: Scenario) => Scenario) => void;
  onPreset: (presetId: string) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  onMakeBaseline: () => void;
}) {
  const { vehicle } = scenario;
  const electric = vehicle.fuelType === 'bev' || vehicle.fuelType === 'phev';
  const burnsFuel = vehicle.fuelType !== 'bev';
  const preset = vehicle.presetId ? PRESETS_BY_ID[vehicle.presetId] : undefined;

  // Edited values stay attached to the preset so the picker still shows what
  // the car is based on, and so a changed field can be put back. A preset is
  // only a source of defaults.
  const setVehicle = <K extends keyof VehicleSpec>(key: K, value: VehicleSpec[K]) =>
    onChange((s) => ({ ...s, vehicle: { ...s.vehicle, [key]: value } }));

  const presetDefaults = presetDefaultsFor(scenario);
  const changedCount = overrideCount(scenario);

  /** Marker for a vehicle field the user has moved away from the preset. */
  const vehicleOverride = (
    key: TrackedVehicleField,
    format: (v: never) => string,
  ): OverrideState | null => {
    if (!presetDefaults) return null;
    const presetValue = presetDefaults.vehicle[key];
    if (!differsFromPreset(vehicle[key], presetValue)) return null;
    return {
      presetValue: format(presetValue as never),
      onReset: () => onChange((s) => resetVehicleField(s, key)),
    };
  };

  const runningOverride = (
    key: TrackedRunningField,
    format: (v: number) => string,
  ): OverrideState | null => {
    if (!presetDefaults) return null;
    const presetValue = presetDefaults.running[key];
    if (!differsFromPreset(scenario.running[key], presetValue)) return null;
    return {
      presetValue: format(presetValue as number),
      onReset: () => onChange((s) => resetRunningField(s, key)),
    };
  };

  return (
    <article className="vehicle-card" style={{ borderTopColor: scenario.colour }}>
      <header className="vehicle-card-head">
        <input
          className="vehicle-label"
          value={scenario.label}
          aria-label="Name for this comparison"
          onChange={(e) => onChange((s) => ({ ...s, label: e.target.value }))}
        />
        <div className="vehicle-card-actions">
          {isBaseline ? (
            <Pill tone="good">Baseline</Pill>
          ) : (
            <Button variant="ghost" onClick={onMakeBaseline} title="Compare everything else against this car">
              Set as baseline
            </Button>
          )}
          <Button variant="ghost" onClick={onDuplicate} disabled={!canDuplicate} title="Duplicate this scenario">
            Duplicate
          </Button>
          <Button variant="ghost" onClick={onRemove} disabled={!canRemove} title="Remove this scenario">
            Remove
          </Button>
        </div>
      </header>

      <VehiclePicker value={vehicle.presetId} onSelect={onPreset} />

      {preset?.notes ? <p className="preset-note">{preset.notes}</p> : null}

      <div className="vehicle-headline">
        <div>
          <span className="vh-label">Energy</span>
          <span className="vh-value">{pence(result.energy.pencePerMile, 1)}/mi</span>
        </div>
        <div>
          <span className="vh-label">A year</span>
          <span className="vh-value">{money(result.annualEnergyGBP)}</span>
        </div>
        <div>
          <span className="vh-label">All in</span>
          <span className="vh-value">{money(result.annualTotalGBP)}/yr</span>
        </div>
      </div>

      <Disclosure
        title="Vehicle specification"
        badge={!preset ? 'Custom' : changedCount > 0 ? `${changedCount} changed` : 'Preset defaults'}
      >
        {preset ? (
          <div className="preset-source">
            <span>
              Defaults filled in from <strong>{preset.make} {preset.model} {preset.variant}</strong>. Every figure
              below is a starting point — change anything you know better.
            </span>
            {changedCount > 0 ? (
              <Button variant="ghost" onClick={() => onChange(resetScenarioToPreset)}>
                Reset all to preset
              </Button>
            ) : null}
          </div>
        ) : null}
        <div className="grid-2">
          <Field label="Drivetrain" override={vehicleOverride('fuelType', (v: string) => v)}>
            <Select
              value={vehicle.fuelType}
              options={FUEL_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
              onChange={(fuelType) => setVehicle('fuelType', fuelType)}
            />
          </Field>
          <Field
            label="First registered"
            hint="Decides which road tax regime applies — cars from April 2017 pay a flat standard rate, older ones are taxed on CO2 bands."
            override={vehicleOverride('firstRegisteredYear', (v: number) => String(v))}
          >
            <NumberInput
              value={vehicle.firstRegisteredYear}
              min={1990}
              max={new Date().getFullYear() + 1}
              step={1}
              onChange={(v) => setVehicle('firstRegisteredYear', v)}
            />
          </Field>
        </div>

        {electric ? (
          <div className="grid-3">
            <Field
              label="Usable battery"
              hint="Usable capacity, not the gross figure on the brochure. It sets what a full charge costs and how far it goes."
              override={vehicleOverride('usableBatteryKWh', (v: number) => `${v} kWh`)}
            >
              <NumberInput value={vehicle.usableBatteryKWh} min={0} step={0.5} suffix="kWh" onChange={(v) => setVehicle('usableBatteryKWh', v)} />
            </Field>
            <Field
              label="Efficiency"
              hint="Miles per kWh measured at the battery. Your car's trip computer shows this. It is the single most important number for an EV's running cost, and the library figure is only an estimate — use your own."
              override={vehicleOverride('miPerKWh', (v: number) => `${v} mi/kWh`)}
            >
              <NumberInput value={vehicle.miPerKWh} min={0.5} max={10} step={0.1} suffix="mi/kWh" onChange={(v) => setVehicle('miPerKWh', v)} />
            </Field>
            <Field label="Peak DC charging" override={vehicleOverride('maxDcChargeKW', (v: number) => `${v} kW`)}>
              <NumberInput value={vehicle.maxDcChargeKW} min={0} step={5} suffix="kW" onChange={(v) => setVehicle('maxDcChargeKW', v)} />
            </Field>
          </div>
        ) : null}

        {burnsFuel ? (
          <div className="grid-3">
            <Field label="Fuel" override={vehicleOverride('liquidFuel', (v: string) => v)}>
              <Select
                value={vehicle.liquidFuel}
                options={[
                  { value: 'petrol', label: 'Petrol' },
                  { value: 'diesel', label: 'Diesel' },
                ]}
                onChange={(liquidFuel) => setVehicle('liquidFuel', liquidFuel)}
              />
            </Field>
            <Field
              label="Real-world consumption"
              hint="What you actually get, not the official combined figure. Most cars fall 10–20% short of their WLTP number, and the library figure is an estimate — your own brim-to-brim average is better."
              override={vehicleOverride('mpg', (v: number) => `${v} mpg`)}
            >
              <NumberInput value={vehicle.mpg} min={1} max={200} step={0.5} suffix="mpg" onChange={(v) => setVehicle('mpg', v)} />
            </Field>
            <Field label="Tank capacity" override={vehicleOverride('tankLitres', (v: number) => `${v} L`)}>
              <NumberInput value={vehicle.tankLitres} min={0} step={1} suffix="L" onChange={(v) => setVehicle('tankLitres', v)} />
            </Field>
          </div>
        ) : null}

        {vehicle.fuelType === 'phev' ? (
          <div className="grid-2">
            <Field
              label="Electric-only range"
              hint="Sets the company car tax band — crossing 70 or 130 miles is worth several percentage points."
              override={vehicleOverride('phevElectricRangeMi', (v: number) => `${v} mi`)}
            >
              <NumberInput value={vehicle.phevElectricRangeMi} min={0} step={1} suffix="mi" onChange={(v) => setVehicle('phevElectricRangeMi', v)} />
            </Field>
            <Field
              label="Share of miles on electricity"
              hint="The number that decides whether a plug-in hybrid is brilliant or pointless. Short commutes plugged in nightly can reach 70–80%; a company car never plugged in is 0%."
              override={vehicleOverride('phevElectricMilesPct', (v: number) => `${v}%`)}
            >
              <NumberInput value={vehicle.phevElectricMilesPct} min={0} max={100} step={5} suffix="%" onChange={(v) => setVehicle('phevElectricMilesPct', v)} />
            </Field>
          </div>
        ) : null}

        <div className="grid-3">
          <Field
            label="CO2 emissions"
            hint="Official combined figure. Drives the company car tax band and the road tax band for older cars."
            override={vehicleOverride('co2gPerKm', (v: number) => `${v} g/km`)}
          >
            <NumberInput value={vehicle.co2gPerKm} min={0} step={1} suffix="g/km" onChange={(v) => setVehicle('co2gPerKm', v)} />
          </Field>
          <Field
            label="List price when new"
            hint="Used for the road tax Expensive Car Supplement threshold — £50,000 for electric cars, £40,000 for everything else."
            override={vehicleOverride('listPriceGBP', (v: number) => money(v))}
          >
            <NumberInput value={vehicle.listPriceGBP} min={0} step={500} prefix="£" onChange={(v) => setVehicle('listPriceGBP', v)} />
          </Field>
          <Field
            label="What you paid"
            hint="Used for depreciation when you own the car outright. The preset is an indicative market value — put in what you actually paid."
            override={vehicleOverride('purchasePriceGBP', (v: number) => money(v))}
          >
            <NumberInput value={vehicle.purchasePriceGBP} min={0} step={500} prefix="£" onChange={(v) => setVehicle('purchasePriceGBP', v)} />
          </Field>
        </div>

        {vehicle.fuelType === 'diesel' ? (
          <Toggle
            checked={vehicle.dieselRde2}
            onChange={(v) => setVehicle('dieselRde2', v)}
            label="Meets the RDE2 emissions standard"
            hint="Diesels that do not meet RDE2 carry a 4% company car tax surcharge. Most registered from 2021 onwards do meet it."
          />
        ) : null}

        <div className="fillup">
          {electric ? (
            <span>
              A full charge: <strong>{money(result.energy.fullChargeCostGBP, 2)}</strong> for about{' '}
              <strong>{number(result.energy.fullChargeRangeMi)} miles</strong>
            </span>
          ) : null}
          {burnsFuel && vehicle.tankLitres > 0 ? (
            <span>
              A full tank: <strong>{money(result.energy.fullTankCostGBP, 2)}</strong> for about{' '}
              <strong>{number(result.energy.fullTankRangeMi)} miles</strong>
            </span>
          ) : null}
        </div>
      </Disclosure>

      {electric ? (
        <Disclosure title="Charging mix" badge={`${Math.round(result.energy.rows.find((r) => r.source === 'publicRapid')?.sharePct ?? 0)}% rapid`}>
          <ChargingEditor
            charging={scenario.charging}
            energy={result.energy}
            prices={prices}
            onChange={(charging) => onChange((s) => ({ ...s, charging }))}
          />
        </Disclosure>
      ) : null}

      <Disclosure title="Ownership and tax" badge={ownershipBadge(scenario)}>
        <OwnershipEditor
          ownership={scenario.ownership}
          vehicle={vehicle}
          tax={tax}
          result={result}
          presetP11dGBP={presetDefaults?.p11dGBP ?? null}
          onResetP11d={() => onChange(resetP11d)}
          onChangeVehicle={setVehicle}
          purchasePriceOverride={vehicleOverride('purchasePriceGBP', (v: number) => money(v))}
          onChange={(ownership) => onChange((s) => ({ ...s, ownership }))}
        />
      </Disclosure>

      <Disclosure title="Standing costs">
        <div className="grid-2">
          <Field
            label="Insurance"
            hint="The library figure is a rough guess that cannot know your age, postcode or history. Put your actual renewal quote in — it is one of the biggest differences between two cars."
            override={runningOverride('insuranceGBP', (v) => `${money(v)}/yr`)}
          >
            <NumberInput value={scenario.running.insuranceGBP} min={0} step={25} prefix="£" suffix="/yr" onChange={(v) => onChange((s) => ({ ...s, running: { ...s.running, insuranceGBP: v } }))} />
          </Field>
          <Field
            label="Servicing and maintenance"
            hint="Electric cars have no oil, spark plugs, cambelt, clutch or exhaust, so this is typically a third to a half of a comparable combustion car."
            override={runningOverride('servicingGBP', (v) => `${money(v)}/yr`)}
          >
            <NumberInput value={scenario.running.servicingGBP} min={0} step={25} prefix="£" suffix="/yr" onChange={(v) => onChange((s) => ({ ...s, running: { ...s.running, servicingGBP: v } }))} />
          </Field>
          <Field
            label="Tyres and consumables"
            hint="Scales with mileage. Electric cars are heavier and more torquey, so they get through tyres faster — but they barely use their brakes."
            override={runningOverride('tyresPencePerMile', (v) => `${v}p/mi`)}
          >
            <NumberInput value={scenario.running.tyresPencePerMile} min={0} step={0.1} suffix="p/mi" onChange={(v) => onChange((s) => ({ ...s, running: { ...s.running, tyresPencePerMile: v } }))} />
          </Field>
          <Field
            label="MOT"
            hint="Zero for a car under three years old, which does not need one yet."
            override={runningOverride('motGBP', (v) => `${money(v)}/yr`)}
          >
            <NumberInput value={scenario.running.motGBP} min={0} step={5} prefix="£" suffix="/yr" onChange={(v) => onChange((s) => ({ ...s, running: { ...s.running, motGBP: v } }))} />
          </Field>
          <Field label="Breakdown cover" override={runningOverride('breakdownCoverGBP', (v) => `${money(v)}/yr`)}>
            <NumberInput value={scenario.running.breakdownCoverGBP} min={0} step={10} prefix="£" suffix="/yr" onChange={(v) => onChange((s) => ({ ...s, running: { ...s.running, breakdownCoverGBP: v } }))} />
          </Field>
          <Field label="Congestion / clean air zone" hint="Days a year you drive into a charging zone. London's charge is £15 a day; electric cars now get a discount rather than an exemption.">
            <NumberInput value={scenario.running.congestionChargeDaysPerYear} min={0} step={1} suffix="days" onChange={(v) => onChange((s) => ({ ...s, running: { ...s.running, congestionChargeDaysPerYear: v } }))} />
          </Field>
          <Field label="Anything else">
            <NumberInput value={scenario.running.otherAnnualGBP} step={25} prefix="£" suffix="/yr" onChange={(v) => onChange((s) => ({ ...s, running: { ...s.running, otherAnnualGBP: v } }))} />
          </Field>
          <Field label="Road tax" hint="Left blank the calculator works it out, including the Expensive Car Supplement for cars over £40,000. Enter a figure to override it.">
            <div className="ved-override">
              <NumberInput
                value={scenario.running.vedOverrideGBP ?? vedShown(result)}
                min={0}
                step={5}
                prefix="£"
                suffix="/yr"
                disabled={scenario.running.vedOverrideGBP === null}
                onChange={(v) => onChange((s) => ({ ...s, running: { ...s.running, vedOverrideGBP: v } }))}
              />
              <Toggle
                checked={scenario.running.vedOverrideGBP !== null}
                onChange={(on) => onChange((s) => ({ ...s, running: { ...s.running, vedOverrideGBP: on ? vedShown(result) : null } }))}
                label="Override"
              />
            </div>
          </Field>
        </div>
      </Disclosure>

      {result.warnings.length > 0 ? (
        <ul className="warnings">
          {result.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

function vedShown(result: ScenarioResult): number {
  return Math.round(result.lines.find((l) => l.key === 'ved')?.annualGBP ?? 0);
}

function ownershipBadge(scenario: Scenario): string {
  switch (scenario.ownership.model) {
    case 'personal-cash':
      return 'Owned';
    case 'personal-finance':
      return 'Financed';
    case 'company-car':
      return 'Company car';
    case 'salary-sacrifice':
      return 'Salary sacrifice';
  }
}

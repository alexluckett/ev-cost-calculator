import { PRESETS_BY_ID } from '../data/vehicles';
import { money, pence, percent } from '../lib/format';
import type { OwnershipModel, Scenario, ScenarioResult, VehicleSpec } from '../model/types';
import { VehiclePicker } from './VehiclePicker';
import { Button, Disclosure, Field, NumberInput, Select, Toggle } from './ui';

const FUEL_OPTIONS = [
  { value: 'bev', label: 'Electric' },
  { value: 'phev', label: 'Plug-in hybrid' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'petrol', label: 'Petrol' },
  { value: 'diesel', label: 'Diesel' },
] as const;

const OWNERSHIP_OPTIONS: { value: OwnershipModel; label: string }[] = [
  { value: 'personal', label: 'Mine — I pay for it' },
  { value: 'company-car', label: 'Company car' },
  { value: 'salary-sacrifice', label: 'Salary sacrifice' },
];

export function VehicleCard({
  scenario,
  result,
  taxYear,
  canRemove,
  onChange,
  onPreset,
  onRemove,
}: {
  scenario: Scenario;
  result: ScenarioResult;
  taxYear: string;
  canRemove: boolean;
  onChange: (updater: (s: Scenario) => Scenario) => void;
  onPreset: (presetId: string) => void;
  onRemove: () => void;
}) {
  const { vehicle, ownership } = scenario;
  const electric = vehicle.fuelType === 'bev' || vehicle.fuelType === 'phev';
  const burnsFuel = vehicle.fuelType !== 'bev';
  const companyProvided = ownership.model !== 'personal';
  const preset = vehicle.presetId ? PRESETS_BY_ID[vehicle.presetId] : undefined;

  const setVehicle = <K extends keyof VehicleSpec>(key: K, value: VehicleSpec[K]) =>
    onChange((s) => ({ ...s, vehicle: { ...s.vehicle, [key]: value } }));
  const setOwnership = <K extends keyof Scenario['ownership']>(key: K, value: Scenario['ownership'][K]) =>
    onChange((s) => ({ ...s, ownership: { ...s.ownership, [key]: value } }));
  const setRunning = <K extends keyof Scenario['running']>(key: K, value: Scenario['running'][K]) =>
    onChange((s) => ({ ...s, running: { ...s.running, [key]: value } }));

  return (
    <article className="vehicle-card" style={{ borderTopColor: scenario.colour }}>
      <header className="vehicle-card-head">
        <input
          className="vehicle-label"
          value={scenario.label}
          aria-label="Name for this car"
          onChange={(e) => onChange((s) => ({ ...s, label: e.target.value }))}
        />
        <Button variant="ghost" onClick={onRemove} disabled={!canRemove}>
          Remove
        </Button>
      </header>

      {/* A freshly added card has nothing in it, so the list opens itself. */}
      <VehiclePicker
        value={vehicle.presetId}
        onSelect={onPreset}
        startOpen={!vehicle.presetId && vehicle.mpg === 0 && vehicle.miPerKWh === 0}
      />

      {preset?.notes ? <p className="preset-note">{preset.notes}</p> : null}

      <div className="vehicle-headline">
        <div>
          <span className="vh-label">Energy</span>
          <span className="vh-value">{pence(result.energy.pencePerMile, 1)}/mi</span>
        </div>
        <div>
          <span className="vh-label">All in</span>
          <span className="vh-value">{money(result.annualTotalGBP)}/yr</span>
        </div>
      </div>

      {electric ? (
        <Field
          label={`Charged at home: ${Math.round(scenario.homeChargingPct)}%`}
          hint="The rest is public rapid charging, which typically costs several times as much. Charging losses are included in the figures either way."
        >
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={Math.round(scenario.homeChargingPct)}
            aria-label="Share charged at home"
            onChange={(e) => onChange((s) => ({ ...s, homeChargingPct: Number(e.target.value) }))}
          />
          <p className="mix-detail">
            {Math.round(100 - scenario.homeChargingPct)}% on public rapid ·{' '}
            {pence(result.energy.blendedPPerKWh, 1)}/kWh blended
          </p>
        </Field>
      ) : null}

      <Disclosure title="Specification" badge={preset ? 'Autofilled' : 'Custom'}>
        <p className="explainer">
          These are indicative real-world figures, not manufacturer claims. Your own trip computer and your own
          renewal quote beat anything in the library — change whatever you know better.
        </p>

        <div className="grid-2">
          <Field label="Drivetrain">
            <Select
              value={vehicle.fuelType}
              options={FUEL_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
              onChange={(fuelType) => setVehicle('fuelType', fuelType)}
            />
          </Field>
          <Field label="First registered" hint="Decides which road tax regime applies. Cars from April 2017 pay a flat standard rate; older ones are taxed on CO2 bands.">
            <NumberInput
              value={vehicle.firstRegisteredYear}
              min={1990}
              max={new Date().getFullYear() + 1}
              onChange={(v) => setVehicle('firstRegisteredYear', v)}
            />
          </Field>

          {electric ? (
            <>
              <Field label="Battery" hint="Usable capacity, not the gross figure on the brochure.">
                <NumberInput value={vehicle.usableBatteryKWh} min={0} step={0.5} suffix="kWh" onChange={(v) => setVehicle('usableBatteryKWh', v)} />
              </Field>
              <Field label="Efficiency" hint="Miles per kWh at the battery — the single most important number for an EV's running cost. Your trip computer shows it.">
                <NumberInput value={vehicle.miPerKWh} min={0.5} max={10} step={0.1} suffix="mi/kWh" onChange={(v) => setVehicle('miPerKWh', v)} />
              </Field>
            </>
          ) : null}

          {burnsFuel ? (
            <>
              <Field label="Fuel">
                <Select
                  value={vehicle.liquidFuel}
                  options={[
                    { value: 'petrol', label: 'Petrol' },
                    { value: 'diesel', label: 'Diesel' },
                  ]}
                  onChange={(liquidFuel) => setVehicle('liquidFuel', liquidFuel)}
                />
              </Field>
              <Field label="Real-world mpg" hint="What you actually get, not the official combined figure. Most cars fall 10–20% short of it.">
                <NumberInput value={vehicle.mpg} min={1} max={200} step={0.5} suffix="mpg" onChange={(v) => setVehicle('mpg', v)} />
              </Field>
            </>
          ) : null}

          {vehicle.fuelType === 'phev' ? (
            <>
              <Field label="Electric-only range" hint="Sets the company car tax band — crossing 70 or 130 miles is worth several percentage points.">
                <NumberInput value={vehicle.phevElectricRangeMi} min={0} suffix="mi" onChange={(v) => setVehicle('phevElectricRangeMi', v)} />
              </Field>
              <Field label="Miles on electricity" hint="The number that decides whether a plug-in hybrid is brilliant or pointless.">
                <NumberInput value={vehicle.phevElectricMilesPct} min={0} max={100} step={5} suffix="%" onChange={(v) => setVehicle('phevElectricMilesPct', v)} />
              </Field>
            </>
          ) : null}

          <Field label="CO2" hint="Official combined figure. Drives the company car tax band, and road tax for pre-2017 cars.">
            <NumberInput value={vehicle.co2gPerKm} min={0} suffix="g/km" onChange={(v) => setVehicle('co2gPerKm', v)} />
          </Field>
          <Field label="List price when new" hint="Sets the road tax Expensive Car Supplement threshold — £50,000 for electric cars, £40,000 for everything else.">
            <NumberInput value={vehicle.listPriceGBP} min={0} step={500} prefix="£" onChange={(v) => setVehicle('listPriceGBP', v)} />
          </Field>
        </div>

        {vehicle.fuelType === 'diesel' ? (
          <Toggle
            checked={vehicle.dieselRde2}
            onChange={(v) => setVehicle('dieselRde2', v)}
            label="Meets the RDE2 emissions standard"
            hint="Diesels that do not carry a 4% company car tax surcharge. Most registered from 2021 do meet it."
          />
        ) : null}
      </Disclosure>

      <Disclosure title="Who pays for it" badge={OWNERSHIP_OPTIONS.find((o) => o.value === ownership.model)?.label}>
        <Field label="How is this car paid for?">
          <Select value={ownership.model} options={OWNERSHIP_OPTIONS} onChange={(model) => setOwnership('model', model)} />
        </Field>

        {companyProvided ? (
          <>
            <div className="grid-2">
              <Field label="P11D value" hint="List price including options — what company car tax is charged on.">
                <NumberInput value={ownership.p11dGBP} min={0} step={500} prefix="£" onChange={(v) => setOwnership('p11dGBP', v)} />
              </Field>
              {ownership.model === 'salary-sacrifice' ? (
                <Field label="Monthly gross sacrifice" hint="The figure taken off your gross pay, before tax — how scheme quotes are normally given.">
                  <NumberInput value={ownership.monthlySacrificeGBP} min={0} step={10} prefix="£" onChange={(v) => setOwnership('monthlySacrificeGBP', v)} />
                </Field>
              ) : null}
            </div>

            <p className="explainer">
              Company car tax for {taxYear}: <strong>{percent(result.bikPercent)}</strong> of P11D.
            </p>

            <Toggle
              checked={ownership.bundledRunningCosts}
              onChange={(v) => setOwnership('bundledRunningCosts', v)}
              label="Insurance, servicing, tyres and road tax are in the contract"
            />
            <Toggle
              checked={ownership.employerPaysEnergy}
              onChange={(v) => setOwnership('employerPaysEnergy', v)}
              label="Employer pays for all fuel or charging, private miles included"
              hint={
                vehicle.fuelType === 'bev'
                  ? 'On an electric car this is genuinely free: electricity is not a fuel for benefit purposes, so there is nothing to pay tax on.'
                  : 'On a combustion car this triggers the car fuel benefit charge — a fixed sum however little fuel you actually use.'
              }
            />
          </>
        ) : null}
      </Disclosure>

      {!(companyProvided && ownership.bundledRunningCosts) ? (
        <Disclosure title="Standing costs">
          <div className="grid-2">
            <Field label="Insurance" hint="The library figure cannot know your age, postcode or history. Use your actual renewal quote.">
              <NumberInput value={scenario.running.insuranceGBP} min={0} step={25} prefix="£" suffix="/yr" onChange={(v) => setRunning('insuranceGBP', v)} />
            </Field>
            <Field label="Servicing" hint="Electric cars have no oil, plugs, cambelt, clutch or exhaust, so this is typically a third to a half of a comparable combustion car.">
              <NumberInput value={scenario.running.servicingGBP} min={0} step={25} prefix="£" suffix="/yr" onChange={(v) => setRunning('servicingGBP', v)} />
            </Field>
            <Field label="Tyres and consumables" hint="Scales with mileage.">
              <NumberInput value={scenario.running.tyresPencePerMile} min={0} step={0.1} suffix="p/mi" onChange={(v) => setRunning('tyresPencePerMile', v)} />
            </Field>
          </div>
        </Disclosure>
      ) : null}

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

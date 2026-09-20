import { useEffect, useMemo, useRef, useState } from 'react';
import { AssumptionsPanel, DrivingPanel, EnergyPricesPanel } from './components/GlobalInputs';
import {
  BreakEvenSection,
  BreakdownSection,
  DetailTable,
  EmployerView,
  EnergyDetail,
  GroupSummary,
  HeadlineCards,
  SensitivitySection,
} from './components/Results';
import { EmptyState, MissingInputsNotice } from './components/EmptyState';
import { VehicleCard } from './components/VehicleCard';
import { Button, Disclosure, Section } from './components/ui';
import { copyShareLink, exportCsv, exportJson, importJson } from './lib/export';
import { money, moneyDelta } from './lib/format';
import { computeAll, type BreakEvenAxis } from './model/compare';
import { shareUrlFor } from './state/codec';
import { MAX_SCENARIOS } from './state/defaults';
import { missingInputs } from './state/readiness';
import { useAppState } from './state/store';

type Theme = 'system' | 'light' | 'dark';

export default function App() {
  const [state, actions] = useAppState();
  const [axis, setAxis] = useState<BreakEvenAxis>('annualMiles');
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('ev-theme') as Theme) ?? 'system');
  const [toast, setToast] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const results = useMemo(() => computeAll(state), [state]);
  const missing = useMemo(() => missingInputs(state), [state]);
  const ready = missing.length === 0;
  const hasCars = state.scenarios.length > 0;
  const baseline = results.find((r) => r.scenarioId === state.baselineId) ?? results[0];
  const cheapest = ready
    ? results.reduce((best, r) => (r.annualTotalGBP < best.annualTotalGBP ? r : best), results[0])
    : undefined;

  useEffect(() => {
    document.documentElement.dataset.theme = theme === 'system' ? '' : theme;
    localStorage.setItem('ev-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!toast) return;
    const handle = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(handle);
  }, [toast]);

  const drivingSection = (
    <Section title="Your driving" subtitle="These apply to every car in the comparison.">
      <DrivingPanel state={state} onPatch={actions.patch} />
    </Section>
  );

  const pricesSection = (
    <Section
      title="What energy costs you"
      subtitle="Your rates, not a national average. Pick a tariff to start from, then adjust."
    >
      <EnergyPricesPanel state={state} onPatch={actions.patch} />
    </Section>
  );

  const carsSection = (
    <Section
      title="The cars"
      subtitle={
        hasCars
          ? 'Choose from the library to autofill the specification, then change anything you know better.'
          : undefined
      }
      actions={
        hasCars ? (
          <Button
            variant="primary"
            onClick={() => actions.addScenario()}
            disabled={state.scenarios.length >= MAX_SCENARIOS}
          >
            Add a car
          </Button>
        ) : null
      }
    >
      {!hasCars ? (
        <EmptyState onAddPreset={(id) => actions.addScenario(id)} onAddCustom={() => actions.addScenario()} />
      ) : null}
      <div className="vehicle-grid">
        {state.scenarios.map((scenario) => {
          const result = results.find((r) => r.scenarioId === scenario.id);
          if (!result) return null;
          return (
            <VehicleCard
              key={scenario.id}
              scenario={scenario}
              result={result}
              prices={state.prices}
              tax={state.tax}
              isBaseline={scenario.id === state.baselineId}
              // Removing the last car is allowed: an empty comparison is a
              // legitimate state, and the app opens in it.
              canRemove
              canDuplicate={state.scenarios.length < MAX_SCENARIOS}
              onChange={(updater) => actions.updateScenario(scenario.id, updater)}
              onPreset={(presetId) => actions.applyPreset(scenario.id, presetId)}
              onRemove={() => actions.removeScenario(scenario.id)}
              onDuplicate={() => actions.duplicateScenario(scenario.id)}
              onMakeBaseline={() => actions.setBaseline(scenario.id)}
            />
          );
        })}
      </div>
    </Section>
  );

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            ⚡
          </span>
          <div>
            <h1>EV Cost Calculator</h1>
            <p>What your car actually costs to run, and what a different one would.</p>
          </div>
        </div>

        <div className="header-actions">
          <Button
            onClick={async () => {
              const ok = await copyShareLink(shareUrlFor(state));
              setToast(ok ? 'Link copied — it carries this whole comparison.' : 'Could not copy. The address bar has the link.');
            }}
          >
            Copy link
          </Button>
          <Button onClick={() => exportCsv(state, results)}>CSV</Button>
          <Button onClick={() => exportJson(state)}>Save</Button>
          <Button onClick={() => fileInput.current?.click()}>Load</Button>
          <Button
            variant="ghost"
            onClick={() => {
              if (window.confirm('Reset everything back to the defaults?')) actions.reset();
            }}
          >
            Reset
          </Button>
          <select
            className="select theme-select"
            aria-label="Colour theme"
            value={theme}
            onChange={(e) => setTheme(e.target.value as Theme)}
          >
            <option value="system">Match system</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
          <input
            ref={fileInput}
            type="file"
            accept="application/json"
            hidden
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                actions.replace((await importJson(file)) as never);
                setToast('Comparison loaded.');
              } catch {
                setToast('That file could not be read.');
              }
              e.target.value = '';
            }}
          />
        </div>
      </header>

      {cheapest && baseline ? (
        <p className="verdict">
          Over {state.usage.termYears} {state.usage.termYears === 1 ? 'year' : 'years'} at{' '}
          {state.usage.annualMiles.toLocaleString('en-GB')} miles a year,{' '}
          <strong>{cheapest.label}</strong> is the cheapest at <strong>{money(cheapest.annualTotalGBP)}</strong> a
          year
          {cheapest.scenarioId !== baseline.scenarioId ? (
            <>
              {' '}
              — {moneyDelta(cheapest.annualTotalGBP - baseline.annualTotalGBP)} against {baseline.label}
            </>
          ) : null}
          .
        </p>
      ) : (
        <p className="verdict verdict-empty">
          Nothing is filled in for you. Add the car you drive, say how far you drive it and what you pay for
          energy, and the comparison appears below.
        </p>
      )}

      <main>
        {/* With nothing filled in, the one thing worth doing comes first;
            once there are cars, the shared inputs read better at the top. */}
        {hasCars ? (
          <>
            {drivingSection}
            {pricesSection}
            {carsSection}
          </>
        ) : (
          <>
            {carsSection}
            {drivingSection}
            {pricesSection}
          </>
        )}

        {ready && baseline ? (
          <>
            <Section title="The answer" subtitle={`Everything compared against ${baseline.label}.`} id="results">
              <HeadlineCards state={state} results={results} />
            </Section>

            <Section title="Where the money goes" subtitle="Annual cost split by category.">
              <BreakdownSection results={results} />
              <GroupSummary results={results} />
              <Disclosure title="Every line, itemised" defaultOpen>
                <DetailTable results={results} />
              </Disclosure>
              <Disclosure title="Energy in detail">
                <EnergyDetail results={results} />
              </Disclosure>
            </Section>

            <Section title="What would have to change" subtitle="The prices and mileages at which the answer flips.">
              <BreakEvenSection state={state} results={results} />
            </Section>

            <Section
              title="How sensitive is this?"
              subtitle="One number with hidden assumptions is a trap. Move one and watch."
            >
              <SensitivitySection state={state} axis={axis} onAxisChange={setAxis} />
            </Section>

            <Section
              title="Company view"
              subtitle="What a company car or salary sacrifice arrangement costs the business."
            >
              <EmployerView results={results} />
            </Section>
          </>
        ) : (
          <Section title="The answer" id="results">
            <MissingInputsNotice missing={missing} />
          </Section>
        )}

        <Section title="Assumptions" subtitle="Every constant the calculator uses, and how to change it.">
          <AssumptionsPanel state={state} onPatch={actions.patch} />
        </Section>
      </main>

      <footer className="app-footer">
        <p>
          Everything runs in your browser. Nothing is uploaded, there is no account, and your comparison is saved
          locally and encoded in the address bar so you can bookmark or share it.
        </p>
        <p className="caveat">
          This is a calculator, not financial or tax advice. Tax rates change every April and vehicle efficiency
          varies with how and where you drive — check the assumptions before making an expensive decision on them.
        </p>
      </footer>

      {toast ? (
        <div className="toast" role="status">
          {toast}
        </div>
      ) : null}
    </div>
  );
}

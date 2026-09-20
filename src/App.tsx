import { useEffect, useMemo, useState } from 'react';
import { EmptyState, MissingInputsNotice } from './components/EmptyState';
import { GlobalInputs } from './components/GlobalInputs';
import { DetailTable, HeadlineCards } from './components/Results';
import { VehicleCard } from './components/VehicleCard';
import { Button, Section } from './components/ui';
import { money } from './lib/format';
import { computeAll } from './model/tco';
import { shareUrlFor } from './state/codec';
import { MAX_SCENARIOS } from './state/defaults';
import { missingInputs } from './state/readiness';
import { useAppState } from './state/store';

type Theme = 'system' | 'light' | 'dark';

export default function App() {
  const [state, actions] = useAppState();
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem('ev-theme') as Theme) ?? 'system');
  const [toast, setToast] = useState<string | null>(null);

  const results = useMemo(() => computeAll(state), [state]);
  const missing = useMemo(() => missingInputs(state), [state]);
  const ready = missing.length === 0;
  const hasCars = state.scenarios.length > 0;
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

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">⚡</span>
          <div>
            <h1>EV Cost Calculator</h1>
            <p>What your car actually costs to run, and what a different one would.</p>
          </div>
        </div>

        <div className="header-actions">
          <Button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(shareUrlFor(state));
                setToast('Link copied — it carries this whole comparison.');
              } catch {
                setToast('Could not copy. The address bar has the link.');
              }
            }}
          >
            Copy link
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              if (window.confirm('Clear everything and start again?')) actions.reset();
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
        </div>
      </header>

      {cheapest ? (
        <p className="verdict">
          Over {state.termYears} {state.termYears === 1 ? 'year' : 'years'} at{' '}
          {state.annualMiles.toLocaleString('en-GB')} miles a year, <strong>{cheapest.label}</strong> is the
          cheapest at <strong>{money(cheapest.annualTotalGBP)}</strong> a year.
        </p>
      ) : (
        <p className="verdict verdict-empty">
          Add the car you drive, say how far you drive it and what you pay for energy, and the comparison appears
          below.
        </p>
      )}

      <main>
        <Section
          title="The cars"
          actions={
            hasCars ? (
              <Button variant="primary" onClick={() => actions.addScenario()} disabled={state.scenarios.length >= MAX_SCENARIOS}>
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
                  taxYear={state.taxYear}
                  canRemove
                  onChange={(updater) => actions.updateScenario(scenario.id, updater)}
                  onPreset={(presetId) => actions.applyPreset(scenario.id, presetId)}
                  onRemove={() => actions.removeScenario(scenario.id)}
                />
              );
            })}
          </div>
        </Section>

        <Section title="Your driving and your prices">
          <GlobalInputs state={state} onPatch={actions.patch} />
        </Section>

        <Section title="The answer">
          {ready ? (
            <>
              <HeadlineCards state={state} results={results} />
              <DetailTable results={results} />
            </>
          ) : (
            <MissingInputsNotice missing={missing} />
          )}
        </Section>
      </main>

      <footer className="app-footer">
        <p>
          Everything runs in your browser. Nothing is uploaded, there is no account, and your comparison is saved
          locally and encoded in the address bar so you can bookmark or share it.
        </p>
        <p className="caveat">
          A calculator, not tax advice. Tax figures were checked against published 2026/27 rates and change every
          April; vehicle figures are indicative real-world estimates, not measurements.
        </p>
      </footer>

      {toast ? <div className="toast" role="status">{toast}</div> : null}
    </div>
  );
}

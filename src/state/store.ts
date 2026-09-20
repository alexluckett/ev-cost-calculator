/**
 * State container.
 *
 * Everything lives in the browser — localStorage for "pick up where I left
 * off", and the URL hash for sharing a comparison with someone else. There is
 * no server, so there is nothing to sign in to and nothing to lose.
 */

import { useEffect, useMemo, useState } from 'react';
import { encodeState, hydrate, stateFromLocation } from './codec';
import { MAX_SCENARIOS, SCENARIO_COLOURS, defaultRunningCosts, defaultState, makeScenario, specFromPreset } from './defaults';
import { PRESETS_BY_ID } from '../data/vehicles';
import type { AppState, Scenario } from '../model/types';

const STORAGE_KEY = 'ev-cost-calculator:v1';

function loadInitialState(): AppState {
  const fromUrl = stateFromLocation();
  if (fromUrl) return fromUrl;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return hydrate(JSON.parse(stored));
  } catch {
    // A corrupt or unreadable store is not worth failing over.
  }
  return defaultState();
}

export interface StoreActions {
  patch: (patch: Partial<AppState>) => void;
  updateScenario: (id: string, updater: (s: Scenario) => Scenario) => void;
  applyPreset: (id: string, presetId: string) => void;
  addScenario: () => void;
  removeScenario: (id: string) => void;
  duplicateScenario: (id: string) => void;
  setBaseline: (id: string) => void;
  reset: () => void;
  replace: (state: AppState) => void;
}

export function useAppState(): [AppState, StoreActions] {
  const [state, setState] = useState<AppState>(loadInitialState);

  // Persist locally, and keep the address bar in step so a copy of the URL is
  // always a copy of what is on screen.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Private browsing, quota, or storage disabled — carry on regardless.
    }
    const handle = window.setTimeout(() => {
      const encoded = encodeState(state);
      window.history.replaceState(null, '', `#c=${encoded}`);
    }, 400);
    return () => window.clearTimeout(handle);
  }, [state]);

  const actions = useMemo<StoreActions>(() => {
    const updateScenario = (id: string, updater: (s: Scenario) => Scenario) =>
      setState((prev) => ({
        ...prev,
        scenarios: prev.scenarios.map((s) => (s.id === id ? updater(s) : s)),
      }));

    return {
      patch: (patch) => setState((prev) => ({ ...prev, ...patch })),
      updateScenario,
      applyPreset: (id, presetId) => {
        const preset = PRESETS_BY_ID[presetId];
        if (!preset) return;
        updateScenario(id, (s) => {
          const vehicle = specFromPreset(preset);
          return {
            ...s,
            // Keep a label the user has personalised; replace an auto one.
            label: s.label === s.vehicle.name ? vehicle.name : s.label,
            vehicle,
            running: defaultRunningCosts(preset),
            ownership: { ...s.ownership, p11dGBP: vehicle.listPriceGBP },
          };
        });
      },
      addScenario: () =>
        setState((prev) => {
          if (prev.scenarios.length >= MAX_SCENARIOS) return prev;
          const used = new Set(prev.scenarios.map((s) => s.colour));
          const colourIndex = SCENARIO_COLOURS.findIndex((c) => !used.has(c));
          return {
            ...prev,
            scenarios: [
              ...prev.scenarios,
              makeScenario('vw-golf-15tsi', undefined, colourIndex < 0 ? prev.scenarios.length : colourIndex),
            ],
          };
        }),
      removeScenario: (id) =>
        setState((prev) => {
          if (prev.scenarios.length <= 1) return prev;
          const scenarios = prev.scenarios.filter((s) => s.id !== id);
          return {
            ...prev,
            scenarios,
            baselineId: prev.baselineId === id ? scenarios[0].id : prev.baselineId,
          };
        }),
      duplicateScenario: (id) =>
        setState((prev) => {
          if (prev.scenarios.length >= MAX_SCENARIOS) return prev;
          const source = prev.scenarios.find((s) => s.id === id);
          if (!source) return prev;
          const used = new Set(prev.scenarios.map((s) => s.colour));
          const colour = SCENARIO_COLOURS.find((c) => !used.has(c)) ?? source.colour;
          const copy: Scenario = {
            ...structuredClone(source),
            id: `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`,
            label: `${source.label} (copy)`,
            colour,
          };
          return { ...prev, scenarios: [...prev.scenarios, copy] };
        }),
      setBaseline: (id) => setState((prev) => ({ ...prev, baselineId: id })),
      reset: () => setState(defaultState()),
      replace: (next) => setState(hydrate(next)),
    };
  }, []);

  // Someone pasting a shared link into the address bar of an open tab.
  useEffect(() => {
    const onHashChange = () => {
      const fromUrl = stateFromLocation();
      if (fromUrl) setState(fromUrl);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return [state, actions];
}

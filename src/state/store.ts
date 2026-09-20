/**
 * State container.
 *
 * Everything lives in the browser — localStorage for "pick up where I left
 * off", and the URL hash for sharing. There is no server, so there is nothing
 * to sign in to and nothing to lose.
 */

import { useEffect, useMemo, useState } from 'react';
import { PRESETS_BY_ID } from '../data/vehicles';
import { encodeState, hydrate, stateFromLocation } from './codec';
import { MAX_SCENARIOS, SCENARIO_COLOURS, defaultState, makeCustomScenario, makeScenario, specFromPreset } from './defaults';
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
  addScenario: (presetId?: string) => void;
  removeScenario: (id: string) => void;
  reset: () => void;
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
      window.history.replaceState(null, '', `#c=${encodeState(state)}`);
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
            // Keep a label the user has personalised; replace a placeholder
            // one, including the name a blank card was created with.
            label: !s.vehicle.presetId || s.label === s.vehicle.name ? vehicle.name : s.label,
            vehicle,
            ownership: { ...s.ownership, p11dGBP: vehicle.listPriceGBP },
            running: {
              insuranceGBP: preset.typicalInsuranceGBP,
              servicingGBP: preset.typicalServicingGBP,
              tyresPencePerMile: preset.fuelType === 'bev' ? 2.6 : 1.9,
            },
          };
        });
      },
      addScenario: (presetId) =>
        setState((prev) => {
          if (prev.scenarios.length >= MAX_SCENARIOS) return prev;
          const used = new Set(prev.scenarios.map((s) => s.colour));
          const found = SCENARIO_COLOURS.findIndex((c) => !used.has(c));
          const colourIndex = found < 0 ? prev.scenarios.length : found;
          return {
            ...prev,
            scenarios: [
              ...prev.scenarios,
              presetId ? makeScenario(presetId, undefined, colourIndex) : makeCustomScenario('My car', colourIndex),
            ],
          };
        }),
      removeScenario: (id) =>
        setState((prev) => ({ ...prev, scenarios: prev.scenarios.filter((s) => s.id !== id) })),
      reset: () => setState(defaultState()),
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

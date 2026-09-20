import { useState } from 'react';
import { VEHICLE_PRESETS } from '../data/vehicles';
import type { MissingInput } from '../state/readiness';
import { VehiclePicker } from './VehiclePicker';
import { Button } from './ui';

/**
 * The opening screen. The app knows nothing about the driver yet and does not
 * pretend otherwise — there is no example comparison to clear away, just the
 * one thing worth doing first.
 */
export function EmptyState({
  onAddPreset,
  onAddCustom,
}: {
  onAddPreset: (presetId: string) => void;
  onAddCustom: () => void;
}) {
  const [picking, setPicking] = useState(false);

  return (
    <div className="empty-state">
      <h3>Start with the car you drive now</h3>
      <p>
        Pick it from the library and its specification fills itself in — battery or tank size, real-world
        efficiency, emissions and typical running costs. Every figure stays editable, so replace anything you
        know better. Then add whatever you are comparing it against.
      </p>

      {picking ? (
        <div className="empty-picker">
          <VehiclePicker value={null} onSelect={(id) => { onAddPreset(id); setPicking(false); }} startOpen />
          <Button variant="ghost" onClick={() => setPicking(false)}>
            Cancel
          </Button>
        </div>
      ) : (
        <div className="empty-actions">
          <Button variant="primary" onClick={() => setPicking(true)}>
            Choose from {VEHICLE_PRESETS.length} cars
          </Button>
          <Button onClick={onAddCustom}>Enter one by hand</Button>
        </div>
      )}
    </div>
  );
}

/** Tells the driver exactly what is still needed before there is an answer. */
export function MissingInputsNotice({ missing }: { missing: MissingInput[] }) {
  return (
    <div className="missing-notice">
      <h3>A few things still to fill in</h3>
      <p>
        Nothing here is guessed for you, so the numbers below stay hidden until they would mean something.
      </p>
      <ul>
        {missing.map((m) => (
          <li key={m.id}>{m.label}</li>
        ))}
      </ul>
    </div>
  );
}

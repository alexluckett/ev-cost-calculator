import { useMemo, useRef, useState } from 'react';
import { VEHICLE_PRESETS, presetLabel, searchPresets } from '../data/vehicles';
import type { FuelType, VehiclePreset } from '../model/types';

const FUEL_LABELS: Record<FuelType, string> = {
  bev: 'Electric',
  phev: 'Plug-in hybrid',
  hybrid: 'Hybrid',
  petrol: 'Petrol',
  diesel: 'Diesel',
};

const FUEL_ORDER: FuelType[] = ['bev', 'phev', 'hybrid', 'petrol', 'diesel'];

function summarise(p: VehiclePreset): string {
  if (p.fuelType === 'bev') {
    return `${p.usableBatteryKWh} kWh · ${p.realWorldMiPerKWh} mi/kWh real-world · ${p.wltpRangeMi} mi WLTP`;
  }
  if (p.fuelType === 'phev') {
    return `${p.usableBatteryKWh} kWh · ${p.phevElectricRangeMi} electric miles · ${p.realWorldMpg} mpg on petrol`;
  }
  return `${p.realWorldMpg} mpg real-world · ${p.tankLitres} L tank · ${p.co2gPerKm} g/km`;
}

export function VehiclePicker({
  value,
  onSelect,
}: {
  value: string | null;
  onSelect: (presetId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [fuelFilter, setFuelFilter] = useState<FuelType | 'all'>('all');
  const containerRef = useRef<HTMLDivElement>(null);

  const current = value ? VEHICLE_PRESETS.find((p) => p.id === value) : undefined;

  const grouped = useMemo(() => {
    const matches = searchPresets(query).filter((p) => fuelFilter === 'all' || p.fuelType === fuelFilter);
    return FUEL_ORDER.map((fuel) => ({
      fuel,
      items: matches.filter((p) => p.fuelType === fuel),
    })).filter((g) => g.items.length > 0);
  }, [query, fuelFilter]);

  return (
    <div
      className="picker"
      ref={containerRef}
      onBlur={(e) => {
        if (!containerRef.current?.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      <button type="button" className="picker-trigger" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="picker-current">
          {current ? presetLabel(current) : 'Custom vehicle'}
          {current ? <small>{summarise(current)}</small> : <small>Not from the library</small>}
        </span>
        <span aria-hidden="true">▾</span>
      </button>

      {open ? (
        <div className="picker-panel">
          <input
            className="picker-search"
            autoFocus
            placeholder="Search make, model or variant…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="picker-filters">
            <button
              type="button"
              className={`chip${fuelFilter === 'all' ? ' is-active' : ''}`}
              onClick={() => setFuelFilter('all')}
            >
              All
            </button>
            {FUEL_ORDER.map((f) => (
              <button
                key={f}
                type="button"
                className={`chip${fuelFilter === f ? ' is-active' : ''}`}
                onClick={() => setFuelFilter(f)}
              >
                {FUEL_LABELS[f]}
              </button>
            ))}
          </div>

          <div className="picker-list">
            {grouped.length === 0 ? <p className="picker-empty">Nothing matches that search.</p> : null}
            {grouped.map((group) => (
              <div key={group.fuel}>
                <p className="picker-group">{FUEL_LABELS[group.fuel]}</p>
                {group.items.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className={`picker-item${p.id === value ? ' is-selected' : ''}`}
                    onClick={() => {
                      onSelect(p.id);
                      setOpen(false);
                      setQuery('');
                    }}
                  >
                    <span className="picker-item-name">
                      {presetLabel(p)} <small>{p.years}</small>
                    </span>
                    <span className="picker-item-meta">{summarise(p)}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

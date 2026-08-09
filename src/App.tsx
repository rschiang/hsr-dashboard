import { useCallback, useEffect, useMemo, useState } from 'react';
import './App.css';
import type { HistoryArtifact, PackageMetrics, SegmentsArtifact, Snapshot } from './data/types';
import { deriveStatuses } from './lib/status';
import { SourceLink } from './components/Citation';
import { Legend } from './components/Legend';
import { StripChart, type AxisMode } from './components/StripChart';
import { TimeScrubber } from './components/TimeScrubber';
import { AlignmentMap, type SegmentFeatureCollection } from './components/AlignmentMap';

type LoadedData = {
  segments: SegmentsArtifact;
  history: HistoryArtifact;
  geojson: SegmentFeatureCollection;
};

type NumericPackageMetric = Exclude<keyof PackageMetrics, 'sourceId'>;

const PACKAGE_BAND_METRICS: ReadonlyArray<{
  label: string;
  value: NumericPackageMetric;
  total: NumericPackageMetric;
}> = [
  { label: 'Structures complete', value: 'structuresComplete', total: 'structuresTotal' },
  { label: 'Guideway complete (mi)', value: 'guidewayMilesComplete', total: 'guidewayMilesTotal' },
  { label: 'ROW parcels delivered', value: 'parcelsDelivered', total: 'parcelsTotal' },
  { label: 'Utilities relocated', value: 'utilitiesRelocated', total: 'utilitiesTotal' },
];

function App() {
  const [data, setData] = useState<LoadedData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [date, setDate] = useState('');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [axisMode, setAxisMode] = useState<AxisMode>('distance');

  useEffect(() => {
    const base = import.meta.env.BASE_URL;
    Promise.all([
      fetch(`${base}data/segments.json`).then((response) => {
        if (!response.ok) throw new Error(`segments.json: ${response.status}`);
        return response.json() as Promise<SegmentsArtifact>;
      }),
      fetch(`${base}data/history.json`).then((response) => {
        if (!response.ok) throw new Error(`history.json: ${response.status}`);
        return response.json() as Promise<HistoryArtifact>;
      }),
      fetch(`${base}data/segments.geojson`).then((response) => {
        if (!response.ok) throw new Error(`segments.geojson: ${response.status}`);
        return response.json() as Promise<SegmentFeatureCollection>;
      }),
    ])
      .then(([segments, history, geojson]) => {
        setData({ segments, history, geojson });
        const latest = [...new Set(history.snapshots.map((snapshot) => snapshot.date))].sort().at(-1);
        setDate(latest ?? segments.generatedAt.slice(0, 10));
      })
      .catch((error) => setLoadError(String(error)));
  }, []);

  const dates = useMemo(
    () => data ? [...new Set(data.history.snapshots.map((snapshot) => snapshot.date))].sort() : [],
    [data],
  );
  const derived = useMemo(
    () => data && date ? deriveStatuses(data.history.snapshots, data.segments.segments, date) : { statuses: {}, tier: 1 as const },
    [data, date],
  );
  const activeSnapshot = useMemo(() => {
    if (!data || !date) return undefined;
    const eligible = data.history.snapshots.filter((snapshot) => snapshot.date <= date && snapshot.perSegment);
    return eligible.filter((snapshot) => snapshot.tier === 3).at(-1)
      ?? eligible.filter((snapshot) => snapshot.tier === 1).at(-1);
  }, [data, date]);
  const aggregateSnapshot = useMemo(() => {
    if (!data || !date) return undefined;
    return data.history.snapshots.filter((snapshot) => snapshot.tier === 2 && snapshot.date <= date).at(-1);
  }, [data, date]);

  const handleHover = useCallback((id: string | null) => setHoveredId(id), []);
  const handleSelect = useCallback((id: string | null) => setSelectedId(id), []);

  if (loadError) {
    return <main className="load-state"><p className="eyebrow">Data load failed</p><h1>Dashboard unavailable</h1><code>{loadError}</code></main>;
  }
  if (!data || !date) {
    return <main className="load-state"><p className="eyebrow">Loading committed CAHSRA data</p><h1>Merced–Bakersfield progress</h1></main>;
  }

  const completionFor = (id: string): number | null => activeSnapshot?.perSegment?.[id]?.completion
    ?? data.segments.segments.find((segment) => segment.id === id)?.completion
    ?? null;
  const equivalentMiles = data.segments.segments
    .filter((segment) => segment.kind === 'guideway' && segment.cp !== 'M2M' && segment.cp !== 'LGA')
    .reduce((sum, segment) => sum + (segment.iosMileEnd - segment.iosMileStart) * (completionFor(segment.id) ?? 0), 0);
  const weightedPercent = data.segments.segments.reduce(
    (sum, segment) => sum + segment.weightShare * (completionFor(segment.id) ?? 0),
    0,
  ) * 100;
  const allStructures = data.segments.segments.flatMap((segment) => segment.structures);
  const structuresComplete = allStructures.filter((structure) => structure.status === 'Completed').length;

  return (
    <main className="app-shell">
      <div className="dashboard-column">
        <header className="summary-header">
          <div className="title-block">
            <p className="eyebrow">California High-Speed Rail · Initial Operating Segment</p>
            <h1>Merced <span>→</span> Bakersfield</h1>
            <p>171-mile operating span; alignment continues to Oswell Street at iosMile 175. <SourceLink sourceId="ts1_alignment" /></p>
          </div>
          <div className="headline-metrics">
            <div>
              <span>Earthwork-equivalent</span>
              <strong>{equivalentMiles.toFixed(1)} <small>/ 119 mi</small> <SourceLink sourceId="arcgis_progress" /></strong>
            </div>
            <div>
              <span>Difficulty-weighted</span>
              <strong>{weightedPercent.toFixed(1)}% <SourceLink sourceId="business_plan_2026" /></strong>
            </div>
            <div title="Current observed structure-point layer; not rewound when no CVSR PDF snapshot is loaded">
              <span>Structures observed</span>
              <strong>{structuresComplete} <small>/ {allStructures.length}</small> <SourceLink sourceId="arcgis_structures" /></strong>
            </div>
          </div>
        </header>

        <PackageBands snapshot={aggregateSnapshot} />

        <StripChart
          segments={data.segments.segments}
          statuses={derived.statuses}
          hoveredId={hoveredId}
          selectedId={selectedId}
          onHover={handleHover}
          onSelect={handleSelect}
          axisMode={axisMode}
          onAxisModeChange={setAxisMode}
        />

        <TimeScrubber dates={dates} date={date} onDateChange={setDate} tier={derived.tier} />

        <AlignmentMap
          data={data.geojson}
          statuses={derived.statuses}
          hoveredId={hoveredId}
          selectedId={selectedId}
          onHover={handleHover}
          onSelect={handleSelect}
        />
      </div>
      <Legend />
    </main>
  );
}

function PackageBands({ snapshot }: { snapshot: Snapshot | undefined }) {
  const packages = ['CP1', 'CP2-3', 'CP4'] as const;
  return (
    <section className="package-bands" aria-label="Construction-package aggregate status">
      {PACKAGE_BAND_METRICS.map((metric) => (
        <div className="package-band" key={metric.value}>
          <span className="band-title">{metric.label} <SourceLink sourceId="cvsr" /></span>
          {packages.map((cp) => {
            const packageMetric = snapshot?.perPackage?.[cp];
            const value = packageMetric?.[metric.value];
            const total = packageMetric?.[metric.total];
            return (
              <span className="band-value" key={cp}>
                <b>{cp}</b> {value === undefined || total === undefined ? 'Not reported in this snapshot' : `${value.toLocaleString()} / ${total.toLocaleString()}`}
                {value !== undefined && <SourceLink sourceId="cvsr" />}
              </span>
            );
          })}
        </div>
      ))}
    </section>
  );
}

export default App;

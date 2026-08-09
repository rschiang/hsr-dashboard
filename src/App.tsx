import { useCallback, useEffect, useMemo, useState } from 'react';
import './App.css';
import type {
  CvsrGap,
  CvsrGapCause,
  HistoryArtifact,
  PackageMetrics,
  SegmentsArtifact,
  Snapshot,
} from './data/types';
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
    () => data && date
      ? deriveStatuses(data.history.snapshots, data.segments.segments, date)
      : { statuses: {}, evidence: {}, provenance: 'scheduled' as const, tier: 1 as const },
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
    return data.history.snapshots.find((snapshot) => snapshot.tier === 2 && snapshot.date === date);
  }, [data, date]);
  const selectedCvsrGaps = useMemo(
    () => data?.history.cvsrInventory.gaps.filter((gap) => gap.month === date.slice(0, 7)) ?? [],
    [data, date],
  );

  const handleHover = useCallback((id: string | null) => setHoveredId(id), []);
  const handleSelect = useCallback((id: string | null) => setSelectedId(id), []);

  if (loadError) {
    return <main className="load-state"><p className="eyebrow">Data load failed</p><h1>Dashboard unavailable</h1><code>{loadError}</code></main>;
  }
  if (!data || !date) {
    return <main className="load-state"><p className="eyebrow">Loading committed CAHSRA data</p><h1>Merced–Bakersfield progress</h1></main>;
  }

  const completionFor = (id: string): number | null => {
    if (activeSnapshot?.perSegment !== undefined && Object.hasOwn(activeSnapshot.perSegment, id)) {
      return activeSnapshot.perSegment[id].completion;
    }
    return data.segments.segments.find((segment) => segment.id === id)?.completion ?? null;
  };
  const equivalentMiles = data.segments.segments
    .filter((segment) => segment.kind === 'guideway' && segment.cp !== 'M2M' && segment.cp !== 'LGA')
    .reduce((sum, segment) => sum + (segment.iosMileEnd - segment.iosMileStart) * (completionFor(segment.id) ?? 0), 0);
  const weightedPercent = data.segments.segments.reduce((sum, segment) => {
    const numericCompletion = completionFor(segment.id);
    const modelledCompletion = numericCompletion
      ?? (segment.kind === 'structure' && derived.statuses[segment.id] === 'structure_complete' ? 1 : 0);
    return sum + segment.weightShare * modelledCompletion;
  }, 0) * 100;
  const aggregatePackages = Object.values(aggregateSnapshot?.perPackage ?? {});
  const structuresComplete = aggregatePackages.reduce(
    (sum, metrics) => sum + metrics.structuresComplete,
    0,
  );
  const structuresTotal = aggregatePackages.reduce(
    (sum, metrics) => sum + metrics.structuresTotal,
    0,
  );
  const structureMonth = aggregateSnapshot?.dataMonth;

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
              <span>Modelled difficulty progress</span>
              <strong title="Numeric earthwork completion plus full structure weight only after direct evidence resolves to Structure complete">
                {weightedPercent.toFixed(1)}% <SourceLink sourceId="business_plan_2026" />
              </strong>
            </div>
            <div title="CVSR package aggregates at the displayed report month; values are never carried forward across missing reports">
              <span>Structures observed</span>
              <strong>{structureMonth ? structuresComplete : '—'} <small>/ {structureMonth ? structuresTotal : '—'}</small> <SourceLink sourceId="cvsr" /></strong>
            </div>
          </div>
        </header>

        <PackageBands snapshot={aggregateSnapshot} gaps={selectedCvsrGaps} />

        <StripChart
          segments={data.segments.segments}
          statuses={derived.statuses}
          hoveredId={hoveredId}
          selectedId={selectedId}
          onHover={handleHover}
          onSelect={handleSelect}
          axisMode={axisMode}
          onAxisModeChange={setAxisMode}
          date={date}
          evidence={derived.evidence}
        />

        <TimeScrubber
          dates={dates}
          date={date}
          onDateChange={setDate}
          provenance={derived.provenance}
          reportGap={selectedCvsrGaps.find((gap) => gap.metric === 'snapshot')}
        />

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

const GAP_LABELS: Record<CvsrGapCause, string> = {
  report_not_downloaded: 'Report not downloaded',
  report_not_located: 'No valid report located',
  source_not_reported: 'Not published in this report',
  parser_failure: 'Parser failed — report available',
};

function ReportLink({ gap }: { gap: CvsrGap }) {
  if (!gap.reportUrl) return <SourceLink sourceId="cvsr" />;
  return (
    <sup className="source-link">
      <a href={gap.reportUrl} target="_blank" rel="noreferrer" title={gap.detail}>report</a>
    </sup>
  );
}

function PackageBands({ snapshot, gaps }: { snapshot: Snapshot | undefined; gaps: CvsrGap[] }) {
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
            const metricName = metric.value.startsWith('utilities') ? 'utilities' : metric.value.startsWith('parcels') ? 'parcels' : undefined;
            const gap = gaps.find(
              (candidate) => (
                candidate.metric === 'snapshot'
                || candidate.metric === metricName
              ) && candidate.packages.includes(cp),
            );
            return (
              <span className={`band-value${gap ? ' missing' : ''}`} key={cp} title={gap?.detail}>
                <b>{cp}</b>{' '}
                {value === undefined || total === undefined
                  ? <>{gap ? GAP_LABELS[gap.cause] : 'No report for selected month'} {gap && <ReportLink gap={gap} />}</>
                  : <>{value.toLocaleString()} / {total.toLocaleString()} {snapshot?.reportUrl
                    ? <sup className="source-link"><a href={snapshot.reportUrl} target="_blank" rel="noreferrer">report</a></sup>
                    : <SourceLink sourceId="cvsr" />}</>}
              </span>
            );
          })}
        </div>
      ))}
    </section>
  );
}

export default App;

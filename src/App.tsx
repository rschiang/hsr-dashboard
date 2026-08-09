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

type CvsrGapGroup = CvsrGap & { endMonth: string };

function nextMonth(month: string): string {
  const date = new Date(`${month}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + 1);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function groupCvsrGaps(gaps: CvsrGap[]): CvsrGapGroup[] {
  const keyFor = (gap: CvsrGap) => [
    gap.metric,
    gap.cause,
    [...gap.packages].sort().join(','),
    gap.detail,
  ].join('|');
  const sorted = [...gaps].sort((left, right) => (
    keyFor(left).localeCompare(keyFor(right)) || left.month.localeCompare(right.month)
  ));
  const groups: CvsrGapGroup[] = [];
  for (const gap of sorted) {
    const previous = groups.at(-1);
    if (previous && keyFor(previous) === keyFor(gap) && nextMonth(previous.endMonth) === gap.month) {
      previous.endMonth = gap.month;
    } else {
      groups.push({ ...gap, packages: [...gap.packages], endMonth: gap.month });
    }
  }
  return groups;
}

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
  const selectedMonth = date.slice(0, 7);
  const exactCvsrSnapshot = useMemo(() => {
    if (!data || !selectedMonth) return undefined;
    return data.history.snapshots.find(
      (snapshot) => snapshot.tier === 2 && snapshot.dataMonth === selectedMonth,
    );
  }, [data, selectedMonth]);
  const lastCvsrSnapshot = useMemo(() => {
    if (!data || !selectedMonth) return undefined;
    return data.history.snapshots
      .filter((snapshot) => snapshot.tier === 2 && snapshot.dataMonth < selectedMonth)
      .sort((left, right) => left.dataMonth.localeCompare(right.dataMonth))
      .at(-1);
  }, [data, selectedMonth]);
  const displayCvsrSnapshot = exactCvsrSnapshot ?? lastCvsrSnapshot;
  const selectedCvsrGaps = useMemo(
    () => data?.history.cvsrInventory.gaps.filter((gap) => gap.month === selectedMonth) ?? [],
    [data, selectedMonth],
  );
  const groupedCvsrGaps = useMemo(
    () => groupCvsrGaps(data?.history.cvsrInventory.gaps ?? []),
    [data],
  );
  const selectedCompletionBySegment = useMemo<Record<string, number | null>>(() => {
    if (!data) return {};
    return Object.fromEntries(data.segments.segments.map((segment) => {
      const completion = activeSnapshot?.perSegment !== undefined
        && Object.hasOwn(activeSnapshot.perSegment, segment.id)
        ? activeSnapshot.perSegment[segment.id].completion
        : segment.completion;
      return [segment.id, completion];
    }));
  }, [activeSnapshot, data]);

  const handleHover = useCallback((id: string | null) => setHoveredId(id), []);
  const handleSelect = useCallback((id: string | null) => setSelectedId(id), []);

  if (loadError) {
    return <main className="load-state"><p className="eyebrow">Data load failed</p><h1>Dashboard unavailable</h1><code>{loadError}</code></main>;
  }
  if (!data || !date) {
    return <main className="load-state"><p className="eyebrow">Loading committed CAHSRA data</p><h1>Merced–Bakersfield progress</h1></main>;
  }

  const completionFor = (id: string): number | null => (
    Object.hasOwn(selectedCompletionBySegment, id) ? selectedCompletionBySegment[id] : null
  );
  const equivalentMiles = data.segments.segments
    .filter((segment) => segment.kind === 'guideway' && segment.cp !== 'M2M' && segment.cp !== 'LGA')
    .reduce((sum, segment) => sum + (segment.iosMileEnd - segment.iosMileStart) * (completionFor(segment.id) ?? 0), 0);
  const weightedPercent = data.segments.segments.reduce((sum, segment) => {
    const numericCompletion = completionFor(segment.id);
    const modelledCompletion = numericCompletion
      ?? (segment.kind === 'structure' && derived.statuses[segment.id] === 'structure_complete' ? 1 : 0);
    return sum + segment.weightShare * modelledCompletion;
  }, 0) * 100;
  const aggregatePackages = Object.values(displayCvsrSnapshot?.perPackage ?? {});
  const structuresComplete = aggregatePackages.reduce(
    (sum, metrics) => sum + metrics.structuresComplete,
    0,
  );
  const structuresTotal = aggregatePackages.reduce(
    (sum, metrics) => sum + metrics.structuresTotal,
    0,
  );
  const structureMonth = displayCvsrSnapshot?.dataMonth;

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
            <div title="CVSR package aggregates from the exact report month or an explicitly labelled last observation">
              <span>Structures observed</span>
              <strong>{structureMonth ? structuresComplete : '—'} <small>/ {structureMonth ? structuresTotal : '—'}</small> <SourceLink sourceId="cvsr" /></strong>
            </div>
          </div>
        </header>

        <PackageBands
          snapshot={displayCvsrSnapshot}
          gaps={selectedCvsrGaps}
          selectedMonth={selectedMonth}
          exact={exactCvsrSnapshot !== undefined}
        />

        <DataGapDisclosure groups={groupedCvsrGaps} />

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
          selectedCompletionBySegment={selectedCompletionBySegment}
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
  source_not_reported: 'Not published in source',
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

function SnapshotReportLink({ snapshot }: { snapshot: Snapshot }) {
  if (snapshot.tier !== 2 || !snapshot.reportUrl) return <SourceLink sourceId="cvsr" />;
  const archived = snapshot.originalReportUrl !== undefined;
  return (
    <a
      className="snapshot-report-link"
      href={snapshot.reportUrl}
      target="_blank"
      rel="noreferrer"
      title={archived ? `Original overwritten Authority URL: ${snapshot.originalReportUrl}` : undefined}
    >
      {archived ? 'archived Authority report' : 'Authority report'}
    </a>
  );
}

const GAP_METRIC_LABELS: Record<CvsrGap['metric'], string> = {
  snapshot: 'Monthly report',
  utilities: 'Utilities',
  parcels: 'Parcels',
};

function DataGapDisclosure({ groups }: { groups: CvsrGapGroup[] }) {
  return (
    <details className="data-gaps">
      <summary>Data gaps</summary>
      <ul>
        {groups.map((group) => (
          <li
            key={`${group.metric}:${group.cause}:${group.month}:${group.endMonth}:${group.packages.join(',')}`}
            title={group.detail}
          >
            <b>{GAP_METRIC_LABELS[group.metric]} ({group.packages.join(', ')})</b>:{' '}
            {group.month}{group.endMonth === group.month ? '' : `–${group.endMonth}`} — {GAP_LABELS[group.cause]}
          </li>
        ))}
      </ul>
    </details>
  );
}

function PackageBands({
  snapshot,
  gaps,
  selectedMonth,
  exact,
}: {
  snapshot: Snapshot | undefined;
  gaps: CvsrGap[];
  selectedMonth: string;
  exact: boolean;
}) {
  const packages = ['CP1', 'CP2-3', 'CP4'] as const;
  const snapshotGap = gaps.find((gap) => gap.metric === 'snapshot');
  return (
    <section className="package-bands" aria-label="Construction-package aggregate status">
      <div className={`package-report-status${exact ? '' : ' stale'}`}>
        {exact && snapshot
          ? <>Data through {selectedMonth} · <SnapshotReportLink snapshot={snapshot} /></>
          : snapshot
            ? <>{snapshotGap ? GAP_LABELS[snapshotGap.cause] : 'No CVSR snapshot for selected month'} · Last observed {snapshot.dataMonth} · <SnapshotReportLink snapshot={snapshot} /></>
            : <>{snapshotGap ? GAP_LABELS[snapshotGap.cause] : 'No CVSR snapshot for selected month'}</>}
      </div>
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
                  : <>{value.toLocaleString()} / {total.toLocaleString()} <SourceLink sourceId="cvsr" /></>}
              </span>
            );
          })}
        </div>
      ))}
    </section>
  );
}

export default App;

import { useCallback, useEffect, useMemo, useState } from 'react';
import './App.css';
import type {
  CvsrGap,
  CvsrInventory,
  CvsrPackageId,
  HistoryArtifact,
  SegmentsArtifact,
  Snapshot,
} from './data/types';
import { deriveStatuses, selectedCompletions } from './lib/status';
import { buildCvsrSeries, sparklineLabel } from './lib/cvsr-series';
import { GAP_LABELS, groupCvsrGaps, groupRevisions } from './lib/cvsr-gaps';
import { formatRailValue, packagePercent, railMetricValues, RAIL_METRICS } from './lib/rail-metrics';
import { Abbr, type Abbreviation } from './components/Abbr';
import { ReportLink, SourceLink, SourcesList } from './components/Citation';
import { NotesList } from './components/Notes';
import { DeliveryOutlook } from './components/DeliveryOutlook';
import { DELIVERY_CONTEXT_BY_PACKAGE, TRACK_METRIC } from './data/delivery-outlook';
import { Legend } from './components/Legend';
import { type SparklineSeries } from './components/Sparkline';
import { MetricBlock } from './components/MetricBlock';
import { SegmentDetail } from './components/SegmentDetail';
import { StripChart, type AxisMode } from './components/StripChart';
import { TimeScrubber } from './components/TimeScrubber';
import { AlignmentMap, type SegmentFeatureCollection } from './components/AlignmentMap';

type LoadedData = {
  segments: SegmentsArtifact;
  history: HistoryArtifact;
  geojson: SegmentFeatureCollection;
};

const CVSR_PACKAGES = ['CP1', 'CP2-3', 'CP4'] as const satisfies readonly CvsrPackageId[];
// TypeScript rejects a bare text child against a union-typed `children` (TS2745),
// so the rail's report abbreviation travels as a checked constant.
const CVSR: Abbreviation = 'CVSR';

function App() {
  const [data, setData] = useState<LoadedData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [date, setDate] = useState('');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [axisMode, setAxisMode] = useState<AxisMode>('distance');
  const [satellite, setSatellite] = useState(false);

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
        const latest = [...history.replayMonths, ...history.snapshots.map((snapshot) => snapshot.date)].sort().at(-1);
        setDate(latest ?? segments.generatedAt.slice(0, 10));
      })
      .catch((error) => setLoadError(String(error)));
  }, []);

  // Tier 2 applies to the last tick only. Every live poll is already eligible there
  // (deriveStatuses takes the newest observation per segment), so the axis needs one
  // tick, not one per poll.
  const currentPoll = useMemo(
    () => data?.history.snapshots
      .filter((snapshot) => snapshot.tier === 2)
      .sort((left, right) => left.date.localeCompare(right.date))
      .at(-1),
    [data],
  );
  const dates = useMemo(
    () => data
      ? (currentPoll ? [...data.history.replayMonths, currentPoll.date] : data.history.replayMonths)
      : [],
    [currentPoll, data],
  );
  const derived = useMemo(
    () => data && date
      ? deriveStatuses(data.history.snapshots, data.segments.segments, date)
      : { statuses: {}, evidence: {} },
    [data, date],
  );
  const selectedMonth = date.slice(0, 7);
  const exactCvsrSnapshot = useMemo(() => {
    if (!data || !selectedMonth) return undefined;
    return data.history.snapshots.find(
      (snapshot) => snapshot.tier === 1 && snapshot.dataMonth === selectedMonth,
    );
  }, [data, selectedMonth]);
  const lastCvsrSnapshot = useMemo(() => {
    if (!data || !selectedMonth) return undefined;
    return data.history.snapshots
      .filter((snapshot) => snapshot.tier === 1 && snapshot.dataMonth < selectedMonth)
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
  const groupedRevisions = useMemo(
    () => groupRevisions(data?.history.cvsrInventory.revisions ?? []),
    [data],
  );
  const selectedCompletionBySegment = useMemo(
    () => data ? selectedCompletions(data.segments.segments, data.history.snapshots, date) : {},
    [data, date],
  );

  const handleHover = useCallback((id: string | null) => setHoveredId(id), []);
  const handleSelect = useCallback((id: string | null) => setSelectedId(id), []);
  const handleClearSelection = useCallback(() => setSelectedId(null), []);

  if (loadError) {
    return <main className="load-state"><p className="eyebrow">Data load failed</p><h1>Tracking On</h1><code>{loadError}</code></main>;
  }
  if (!data || !date) {
    return <main className="load-state"><p className="eyebrow">Loading committed CAHSRA data</p><h1>Tracking On</h1></main>;
  }

  const inventory = data.history.cvsrInventory;

  const selectedSegment = selectedId
    ? data.segments.segments.find((segment) => segment.id === selectedId)
    : undefined;
  const selectedDisagreement = selectedId
    ? data.segments.crossCheck?.disagreements.find((item) => item.segmentId === selectedId)
    : undefined;

  return (
    <main className="page">
      <div className="screen">
        <header className="topbar">
          <h1>Tracking On</h1>
          <div className="topbar-meta">
            <span>CA HSR Construction Dashboard</span>
            <span>
              Last updated {new Date(data.segments.generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}
              {' '}(CVSR up to {new Date(`${inventory.coverageEnd}-01T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })})
            </span>
            <a href="https://github.com/rschiang/hsr-dashboard" target="_blank" rel="noreferrer" aria-label="Source code on GitHub">
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" /></svg>
            </a>
          </div>
        </header>

        <div className="viewport-grid">
          <div className="map-pane">
            <AlignmentMap
              data={data.geojson}
              statuses={derived.statuses}
              hoveredId={hoveredId}
              selectedId={selectedId}
              onHover={handleHover}
              onSelect={handleSelect}
              satellite={satellite}
            />
            <div className="map-layer-switch">
              <div className="axis-toggle" role="group" aria-label="Basemap">
                <button type="button" className={satellite ? '' : 'active'} onClick={() => setSatellite(false)}>Map</button>
                <button type="button" className={satellite ? 'active' : ''} onClick={() => setSatellite(true)}>Satellite</button>
              </div>
            </div>
            <div className="map-overlay" aria-live="polite">
              {selectedSegment && (
                <SegmentDetail
                  segment={selectedSegment}
                  status={derived.statuses[selectedSegment.id]}
                  evidence={derived.evidence[selectedSegment.id]}
                  disagreement={selectedDisagreement}
                  deliveryContext={DELIVERY_CONTEXT_BY_PACKAGE[selectedSegment.cp]}
                  date={date}
                  onClear={handleClearSelection}
                />
              )}
            </div>
          </div>
          <aside className="metric-rail" aria-label="Program metrics">
            <MetricRail
              snapshot={displayCvsrSnapshot}
              snapshots={data.history.snapshots}
              inventory={inventory}
              selectedMonth={selectedMonth}
              gaps={selectedCvsrGaps}
              exact={exactCvsrSnapshot !== undefined}
              arcgisObserved={currentPoll && date === currentPoll.date ? currentPoll.date : undefined}
            />
          </aside>
        </div>

        <section className="strip-band" aria-labelledby="strip-heading">
          <h2 id="strip-heading" className="sr-only">Construction status by mile</h2>
          <div className="strip-controls">
            <TimeScrubber
              dates={dates}
              date={date}
              onDateChange={setDate}
            />
            <div className="axis-toggle" role="group" aria-label="Segment width scale">
              <button type="button" className={axisMode === 'distance' ? 'active' : ''} onClick={() => setAxisMode('distance')}>Distance</button>
              <button type="button" className={axisMode === 'difficulty' ? 'active' : ''} onClick={() => setAxisMode('difficulty')}>Difficulty</button>
            </div>
          </div>
          <StripChart
            segments={data.segments.segments}
            stations={data.segments.stations}
            statuses={derived.statuses}
            hoveredId={hoveredId}
            selectedId={selectedId}
            onHover={handleHover}
            onSelect={handleSelect}
            axisMode={axisMode}
            date={date}
            evidence={derived.evidence}
            selectedCompletionBySegment={selectedCompletionBySegment}
            disagreements={data.segments.crossCheck?.disagreements ?? []}
          />
        </section>
      </div>

      <section className="below-fold">
        <DeliveryOutlook />
        <Legend />
        <NotesList
          gaps={groupedCvsrGaps}
          revisions={groupedRevisions}
          overlapMiles={data.segments.overlaps.reduce((sum, overlap) => sum + overlap.miles, 0)}
        />
        <SourcesList />
      </section>

      <footer className="page-footer">
        <p>
          Visualized with large language model, may contain errors. Released to the public under{' '}
          <a href="https://github.com/rschiang/hsr-dashboard/blob/main/LICENSE.md" target="_blank" rel="noreferrer">The Unlicense</a>.
        </p>
      </footer>
    </main>
  );
}

function GapReportLink({ gap }: { gap: CvsrGap }) {
  if (!gap.reportUrl) return <SourceLink sourceId="cvsr" />;
  return <ReportLink url={gap.reportUrl} title={gap.detail} />;
}

function SnapshotReportLink({ snapshot }: { snapshot: Snapshot }) {
  // No byte-verified direct PDF for this month: the status line names the month and
  // the report file in its tooltip, which is all the attribution the source supports.
  if (snapshot.tier !== 1 || !snapshot.reportUrl) return null;
  const archived = snapshot.originalReportUrl !== undefined;
  return (
    <a
      className="fn-ref"
      href={snapshot.reportUrl}
      target="_blank"
      rel="noreferrer"
      title={archived
        ? `${snapshot.reportFile} · original overwritten Authority URL: ${snapshot.originalReportUrl}`
        : snapshot.reportFile}
    >
      <sup>↗</sup>
    </a>
  );
}

const CP_COLORS: Record<(typeof CVSR_PACKAGES)[number], string> = {
  CP1: 'var(--cp1)',
  'CP2-3': 'var(--cp2-3)',
  CP4: 'var(--cp4)',
};

/**
 * The rail reads each published CVSR metric at program level: a value the report
 * printed for CP 1-4 wins, otherwise the sum over the packages that all reported it,
 * and guideway uses the fixed 119-mile corridor denominator rather than a sum of
 * package denominators that move with contract scope. A partial package sum is never
 * shown, because it would read as a program total it is not.
 */
function MetricRail({
  snapshot,
  snapshots,
  inventory,
  selectedMonth,
  gaps,
  exact,
  arcgisObserved,
}: {
  snapshot: Snapshot | undefined;
  snapshots: Snapshot[];
  inventory: CvsrInventory;
  selectedMonth: string;
  gaps: CvsrGap[];
  exact: boolean;
  /** Poll date when the selected tick is the ArcGIS-overlaid present, else undefined. */
  arcgisObserved?: string;
}) {
  const beforeCoverage = selectedMonth < inventory.coverageStart;
  const afterCoverage = selectedMonth > inventory.coverageEnd;
  const snapshotGap = gaps.find((gap) => gap.metric === 'snapshot');
  const monthIndex = inventory.expectedMonths.indexOf(selectedMonth);
  const selectedIndex = monthIndex < 0 ? null : monthIndex;
  const series = useMemo(() => {
    const result: Record<string, SparklineSeries[]> = {};
    for (const metric of RAIL_METRICS) {
      result[metric.value] = CVSR_PACKAGES.map((cp) => ({
        id: cp,
        points: buildCvsrSeries(snapshots, inventory.expectedMonths, cp, metric.value, metric.total),
        color: CP_COLORS[cp],
      }));
    }
    return result;
  }, [inventory.expectedMonths, snapshots]);
  // No monthly track-installation series exists to plot: one all-null series is
  // the dashed floor the Sparkline draws instead of inventing a trend.
  const trackSeries = useMemo<SparklineSeries[]>(
    () => [{ id: 'track', points: inventory.expectedMonths.map(() => null), color: 'var(--cp1)' }],
    [inventory.expectedMonths],
  );

  return (
    <>
      <MetricBlock
        label="Track installed"
        value={TRACK_METRIC.value}
        unit={TRACK_METRIC.unit}
        chip={<>{TRACK_METRIC.chip} <SourceLink sourceId={TRACK_METRIC.sourceId} /></>}
        series={trackSeries}
        selectedIndex={null}
        ariaLabel={TRACK_METRIC.ariaLabel}
      />
      {RAIL_METRICS.map((metric) => {
        const { value, total } = beforeCoverage
          ? { value: undefined, total: undefined }
          : railMetricValues(snapshot, metric);
        const metricSeries = series[metric.value];
        const gap = beforeCoverage || metric.gapMetric === undefined
          ? undefined
          : gaps.find((candidate) => candidate.metric === metric.gapMetric || candidate.metric === 'snapshot');
        return (
          <MetricBlock
            key={metric.value}
            label={metric.label}
            value={formatRailValue(metric, value, total)}
            unit={metric.unit}
            packages={CVSR_PACKAGES.map((cp) => {
              // The superseded month keeps the number its own report published; the marker
              // says the Authority later restated it.
              const revision = beforeCoverage || metric.family === undefined ? undefined : inventory.revisions.find(
                (entry) => entry.month === selectedMonth
                  && entry.metric === metric.family
                  && entry.packages.includes(cp),
              );
              return {
                cp,
                ...packagePercent(beforeCoverage ? undefined : snapshot, metric, cp),
                revisedTitle: revision === undefined
                  ? undefined
                  : `Superseded: the Authority restated this value in the ${revision.correctedIn} report. ${revision.detail}`,
              };
            })}
            status={gap && <><span title={gap.detail}>{GAP_LABELS[gap.cause]}</span> <GapReportLink gap={gap} /></>}
            series={metricSeries}
            selectedIndex={selectedIndex}
            ariaLabel={metricSeries.map((entry) => sparklineLabel(metric.label, entry.id, entry.points)).join('; ')}
          />
        );
      })}
      <div className={`rail-report-status${exact || beforeCoverage || afterCoverage ? '' : ' stale'}`}>
        {beforeCoverage
          ? <>Before the published <Abbr>{CVSR}</Abbr> series (starts {inventory.coverageStart})</>
          : afterCoverage && snapshot
            ? <><Abbr>{CVSR}</Abbr> data through {inventory.coverageEnd}<SnapshotReportLink snapshot={snapshot} />{arcgisObserved && <> · ArcGIS observed {arcgisObserved}</>}</>
            : exact && snapshot
              ? <><Abbr>{CVSR}</Abbr> data through {selectedMonth}<SnapshotReportLink snapshot={snapshot} /></>
              : snapshot
                ? <>{snapshotGap ? GAP_LABELS[snapshotGap.cause] : 'No CVSR snapshot for selected month'} · last <Abbr>{CVSR}</Abbr> {snapshot.dataMonth}<SnapshotReportLink snapshot={snapshot} /></>
                : <>{snapshotGap ? GAP_LABELS[snapshotGap.cause] : 'No CVSR snapshot for selected month'}</>}
      </div>
    </>
  );
}

export default App;

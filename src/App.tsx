import { useCallback, useEffect, useMemo, useState } from 'react';
import './App.css';
import type {
  CvsrGap,
  CvsrGapCause,
  CvsrInventory,
  CvsrPackageId,
  HistoryArtifact,
  SegmentsArtifact,
  Snapshot,
} from './data/types';
import { deriveStatuses, selectedCompletions } from './lib/status';
import { buildCvsrSeries, sparklineLabel, type CvsrSeriesPoint, type NumericPackageMetric } from './lib/cvsr-series';
import { SourceLink } from './components/Citation';
import { Legend } from './components/Legend';
import { Sparkline } from './components/Sparkline';
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

const PACKAGE_BAND_METRICS: ReadonlyArray<{
  label: string;
  value: NumericPackageMetric;
  total: NumericPackageMetric;
  transcribedAs?: 'progress' | 'parcels';
  revisedAs?: 'progress' | 'parcels' | 'utilities';
}> = [
  { label: 'Structures complete', value: 'structuresComplete', total: 'structuresTotal', transcribedAs: 'progress', revisedAs: 'progress' },
  { label: 'Guideway complete (mi)', value: 'guidewayMilesComplete', total: 'guidewayMilesTotal', transcribedAs: 'progress', revisedAs: 'progress' },
  { label: 'ROW parcels acquired', value: 'parcelsAcquired', total: 'parcelsAcquisitionTotal' },
  { label: 'ROW delivered to DB', value: 'parcelsDelivered', total: 'parcelsTotal', transcribedAs: 'parcels', revisedAs: 'parcels' },
  { label: 'Railroad ROW parcels', value: 'railroadParcelsAcquired', total: 'railroadParcelsTotal' },
  { label: 'Utilities relocated', value: 'utilitiesRelocated', total: 'utilitiesTotal', revisedAs: 'utilities' },
];

type CvsrGapGroup = CvsrGap & { endMonth: string };
type TranscriptionGroup = {
  fields: string;
  month: string;
  endMonth: string;
  reportFile: string;
  detail: string;
};
type RevisionGroup = {
  key: string;
  metric: CvsrInventory['revisions'][number]['metric'];
  packages: string;
  month: string;
  endMonth: string;
  correctedIn: string;
  detail: string;
};

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

function groupTranscriptions(entries: CvsrInventory['transcriptions']): TranscriptionGroup[] {
  const sorted = [...entries].sort((left, right) => left.month.localeCompare(right.month));
  const groups: TranscriptionGroup[] = [];
  for (const entry of sorted) {
    const fields = entry.fields.join(' + ');
    const previous = groups.at(-1);
    if (previous && previous.fields === fields && nextMonth(previous.endMonth) === entry.month) {
      previous.endMonth = entry.month;
    } else {
      groups.push({ fields, month: entry.month, endMonth: entry.month, reportFile: entry.reportFile, detail: entry.detail });
    }
  }
  return groups;
}

function groupRevisions(entries: CvsrInventory['revisions']): RevisionGroup[] {
  const sorted = [...entries].sort((left, right) => left.month.localeCompare(right.month));
  const groups: RevisionGroup[] = [];
  for (const entry of sorted) {
    const key = `${entry.metric}|${entry.packages.join(', ')}|${entry.correctedIn}`;
    const previous = groups.at(-1);
    if (previous && previous.key === key && nextMonth(previous.endMonth) === entry.month) {
      previous.endMonth = entry.month;
    } else {
      groups.push({
        key,
        metric: entry.metric,
        packages: entry.packages.join(', '),
        month: entry.month,
        endMonth: entry.month,
        correctedIn: entry.correctedIn,
        detail: entry.detail,
      });
    }
  }
  return groups;
}

function sumPackages(
  snapshot: Snapshot | undefined,
  key: NumericPackageMetric,
): number | undefined {
  const packages = Object.values(snapshot?.perPackage ?? {});
  if (packages.length === 0) return undefined;
  let total = 0;
  for (const metrics of packages) {
    const value = metrics[key];
    if (typeof value !== 'number') return undefined;
    total += value;
  }
  return total;
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
        const latest = [...history.replayMonths, ...history.snapshots.map((snapshot) => snapshot.date)].sort().at(-1);
        setDate(latest ?? segments.generatedAt.slice(0, 10));
      })
      .catch((error) => setLoadError(String(error)));
  }, []);

  // Scrubbable dates are the full month sequence plus every real ArcGIS
  // observation. Tier-2 CVSR months already sit on the month sequence.
  const dates = useMemo(
    () => data
      ? [...new Set([
          ...data.history.replayMonths,
          ...data.history.snapshots.filter((snapshot) => snapshot.tier === 3).map((snapshot) => snapshot.date),
        ])].sort()
      : [],
    [data],
  );
  const derived = useMemo(
    () => data && date
      ? deriveStatuses(data.history.snapshots, data.segments.segments, date)
      : { statuses: {}, evidence: {}, provenance: 'scheduled' as const },
    [data, date],
  );
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
  const groupedTranscriptions = useMemo(
    () => groupTranscriptions(data?.history.cvsrInventory.transcriptions ?? []),
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
    return <main className="load-state"><p className="eyebrow">Data load failed</p><h1>Dashboard unavailable</h1><code>{loadError}</code></main>;
  }
  if (!data || !date) {
    return <main className="load-state"><p className="eyebrow">Loading committed CAHSRA data</p><h1>Merced–Bakersfield progress</h1></main>;
  }

  const inventory = data.history.cvsrInventory;

  const cvsrGuidewayComplete = sumPackages(displayCvsrSnapshot, 'guidewayMilesComplete');
  const cvsrTotalMiles = sumPackages(displayCvsrSnapshot, 'guidewayMilesTotal');
  const structuresComplete = sumPackages(displayCvsrSnapshot, 'structuresComplete');
  const structuresTotal = sumPackages(displayCvsrSnapshot, 'structuresTotal');
  const beforeCoverage = selectedMonth < inventory.coverageStart;
  const cvsrNote = beforeCoverage
    ? 'Before the published series'
    : exactCvsrSnapshot
      ? `Data through ${selectedMonth}`
      : displayCvsrSnapshot
        ? `Last observed ${displayCvsrSnapshot.dataMonth}`
        : 'Before the published series';
  const perMile = (value: number | undefined): string => value === undefined ? '—' : value.toFixed(1);
  const selectedSegment = selectedId
    ? data.segments.segments.find((segment) => segment.id === selectedId)
    : undefined;
  const selectedDisagreement = selectedId
    ? data.segments.crossCheck?.disagreements.find((item) => item.segmentId === selectedId)
    : undefined;

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
              <span>Guideway complete</span>
              <strong>{perMile(cvsrGuidewayComplete)} <small>/ {perMile(cvsrTotalMiles)} mi</small></strong>
              <em className="metric-note">
                {cvsrNote}{' '}
                {displayCvsrSnapshot ? <SnapshotReportLink snapshot={displayCvsrSnapshot} /> : <SourceLink sourceId="cvsr" />}
              </em>
            </div>
            <div>
              <span>Structures complete</span>
              <strong>{structuresComplete ?? '—'} <small>/ {structuresTotal ?? '—'}</small></strong>
              <em className="metric-note">
                {cvsrNote}{' '}
                {displayCvsrSnapshot ? <SnapshotReportLink snapshot={displayCvsrSnapshot} /> : <SourceLink sourceId="cvsr" />}
              </em>
            </div>
          </div>
        </header>

        <PackageBands
          snapshot={displayCvsrSnapshot}
          snapshots={data.history.snapshots}
          inventory={inventory}
          gaps={selectedCvsrGaps}
          selectedMonth={selectedMonth}
          exact={exactCvsrSnapshot !== undefined}
        />

        <DataGapDisclosure
          groups={groupedCvsrGaps}
          transcriptions={groupedTranscriptions}
          revisions={groupedRevisions}
        />

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
          disagreements={data.segments.crossCheck?.disagreements ?? []}
        />

        <SegmentDetail
          segment={selectedSegment}
          status={selectedId ? derived.statuses[selectedId] : undefined}
          evidence={selectedId ? derived.evidence[selectedId] : undefined}
          completion={selectedId ? selectedCompletionBySegment[selectedId] ?? null : null}
          disagreement={selectedDisagreement}
          date={date}
          onClear={handleClearSelection}
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
  related_measure_only: 'Related measure only',
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
  if (snapshot.tier !== 2 || !snapshot.reportUrl) {
    // No byte-verified direct PDF for this month: identify the series and name
    // the exact report file in the tooltip rather than linking a guess.
    return <SourceLink sourceId="cvsr" title={snapshot.reportFile} />;
  }
  const archived = snapshot.originalReportUrl !== undefined;
  return (
    <a
      className="snapshot-report-link"
      href={snapshot.reportUrl}
      target="_blank"
      rel="noreferrer"
      title={archived
        ? `${snapshot.reportFile} · original overwritten Authority URL: ${snapshot.originalReportUrl}`
        : snapshot.reportFile}
    >
      {archived ? 'archived Authority report (PDF)' : 'Authority report (PDF)'}
    </a>
  );
}

const GAP_METRIC_LABELS: Record<CvsrGap['metric'], string> = {
  snapshot: 'Monthly report',
  utilities: 'Utilities',
  parcels: 'Parcels',
  parcel_delivery: 'Parcels delivered to DB',
};

function DataGapDisclosure({
  groups,
  transcriptions,
  revisions,
}: {
  groups: CvsrGapGroup[];
  transcriptions: TranscriptionGroup[];
  revisions: RevisionGroup[];
}) {
  return (
    <details className="data-gaps">
      <summary>Data gaps, transcriptions &amp; revisions</summary>
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
        {transcriptions.map((group) => (
          <li key={`transcription:${group.fields}:${group.month}:${group.endMonth}`} title={group.detail}>
            <b>Transcribed ({group.fields})</b>:{' '}
            {group.month}{group.endMonth === group.month ? '' : `–${group.endMonth}`} — read by hand from a chart image in the source PDF
          </li>
        ))}
        {revisions.map((group) => (
          <li key={`revision:${group.key}:${group.month}:${group.endMonth}`} title={group.detail}>
            <b>Restated ({group.metric}, {group.packages})</b>:{' '}
            {group.month}{group.endMonth === group.month ? '' : `–${group.endMonth}`} — superseded by the {group.correctedIn} report
          </li>
        ))}
      </ul>
    </details>
  );
}

function PackageBands({
  snapshot,
  snapshots,
  inventory,
  gaps,
  selectedMonth,
  exact,
}: {
  snapshot: Snapshot | undefined;
  snapshots: Snapshot[];
  inventory: CvsrInventory;
  gaps: CvsrGap[];
  selectedMonth: string;
  exact: boolean;
}) {
  const snapshotGap = gaps.find((gap) => gap.metric === 'snapshot');
  const beforeCoverage = selectedMonth < inventory.coverageStart;
  const afterCoverage = selectedMonth > inventory.coverageEnd;
  const selectedIndex = inventory.expectedMonths.indexOf(selectedMonth);
  const series = useMemo(() => {
    const result: Record<string, Array<CvsrSeriesPoint | null>> = {};
    for (const metric of PACKAGE_BAND_METRICS) {
      for (const cp of CVSR_PACKAGES) {
        result[`${metric.value}:${cp}`] = buildCvsrSeries(
          snapshots,
          inventory.expectedMonths,
          cp,
          metric.value,
          metric.total,
        );
      }
    }
    return result;
  }, [inventory.expectedMonths, snapshots]);

  // One exact report link plus the `Data through {month}` label attributes every
  // figure in this panel; the registry link on the heading identifies the series.
  // Repeating the same CVSR superscript on all sixteen cells was wallpaper.
  return (
    <section className="package-bands" aria-label="Construction-package aggregate status">
      <div className={`package-report-status${exact || beforeCoverage || afterCoverage ? '' : ' stale'}`}>
        {beforeCoverage
          ? <>Before the published CVSR series (starts {inventory.coverageStart}) <SourceLink sourceId="cvsr" /></>
          : afterCoverage && snapshot
            ? <>Latest published CVSR: data through {inventory.coverageEnd} · <SnapshotReportLink snapshot={snapshot} />{snapshot.reportUrl && <> <SourceLink sourceId="cvsr" /></>}</>
            : exact && snapshot
              ? <>Data through {selectedMonth} · <SnapshotReportLink snapshot={snapshot} />{snapshot.reportUrl && <> <SourceLink sourceId="cvsr" /></>}</>
              : snapshot
                ? <>{snapshotGap ? GAP_LABELS[snapshotGap.cause] : 'No CVSR snapshot for selected month'} · Last observed {snapshot.dataMonth} · <SnapshotReportLink snapshot={snapshot} />{snapshot.reportUrl && <> <SourceLink sourceId="cvsr" /></>}</>
                : <>{snapshotGap ? GAP_LABELS[snapshotGap.cause] : 'No CVSR snapshot for selected month'} <SourceLink sourceId="cvsr" /></>}
      </div>
      {PACKAGE_BAND_METRICS.map((metric) => (
        <div className="package-band" key={metric.value}>
          <span className="band-title">{metric.label}</span>
          {CVSR_PACKAGES.map((cp) => {
            const packageMetric = beforeCoverage ? undefined : snapshot?.perPackage?.[cp];
            const value = packageMetric?.[metric.value];
            const total = packageMetric?.[metric.total];
            const metricName = metric.value.startsWith('utilities')
              ? 'utilities'
              : metric.value === 'parcelsDelivered'
                ? 'parcel_delivery'
                : undefined;
            const gap = beforeCoverage ? undefined : gaps.find(
              (candidate) => (
                candidate.metric === 'snapshot'
                || candidate.metric === metricName
              ) && candidate.packages.includes(cp),
            );
            const points = series[`${metric.value}:${cp}`];
            const transcribed = metric.transcribedAs !== undefined
              && packageMetric?.transcribedFields?.includes(metric.transcribedAs) === true;
            const revisedAs = metric.revisedAs;
            // The superseded month keeps the number its own report published;
            // the marker says the Authority later restated it.
            const revision = revisedAs === undefined ? undefined : inventory.revisions.find(
              (entry) => entry.month === selectedMonth
                && entry.metric === revisedAs
                && entry.packages.includes(cp),
            );
            const valueClass = [transcribed ? 'transcribed' : '', revision ? 'revised' : '']
              .filter(Boolean)
              .join(' ');
            const valueTitle = [
              transcribed && snapshot?.reportFile
                ? `Transcribed by hand from a chart image in ${snapshot.reportFile}; not extractable as PDF text.`
                : undefined,
              revision
                ? `Superseded: the Authority restated this value in the ${revision.correctedIn} report. ${revision.detail}`
                : undefined,
            ].filter((entry): entry is string => entry !== undefined).join(' ');
            return (
              <span className={`band-value${gap ? ' missing' : ''}`} key={cp} title={gap?.detail}>
                <b>{cp}</b>
                <Sparkline
                  points={points}
                  selectedIndex={selectedIndex < 0 ? null : selectedIndex}
                  label={sparklineLabel(metric.label, cp, points)}
                />
                {beforeCoverage
                  ? <>—</>
                  : metric.value === 'parcelsAcquired' && packageMetric?.acquisitionAudit
                    ? (
                      <span title="The report does not publish an exact January package acquisition split.">
                        March 9 audit: {packageMetric.acquisitionAudit.priorAcquired.toLocaleString()} prior acquired / {packageMetric.acquisitionAudit.totalNeeded.toLocaleString()} needed · as of {packageMetric.acquisitionAudit.asOf}
                      </span>
                    )
                    : value === undefined || total === undefined
                      ? <>{metric.value === 'parcelsDelivered' && gap ? 'Delivered to DB — not reported' : gap ? GAP_LABELS[gap.cause] : 'No report for selected month'} {gap && <ReportLink gap={gap} />}</>
                      : (
                        <span
                          className={valueClass === '' ? undefined : valueClass}
                          title={valueTitle === '' ? undefined : valueTitle}
                        >
                          {metric.value === 'parcelsAcquired' ? 'Acquired ' : ''}{value.toLocaleString()} / {total.toLocaleString()}
                          {metric.value === 'parcelsAcquired' && packageMetric?.parcelAcquisitionAsOf
                            ? ` · as of ${packageMetric.parcelAcquisitionAsOf}`
                            : ''}
                        </span>
                      )}
              </span>
            );
          })}
        </div>
      ))}
    </section>
  );
}

export default App;

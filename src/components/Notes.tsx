import {
  GAP_LABELS,
  GAP_METRIC_LABELS,
  REVISION_METRIC_LABELS,
  type CvsrGapGroup,
  type RevisionGroup,
} from '../lib/cvsr-gaps';
import { SourceLink } from './Citation';

/**
 * Every marking stripped from the strip and the legend is consolidated here, so
 * the first screen stays a chart rather than a page of footnote crosses.
 */
export function NotesList({ gaps, revisions }: { gaps: CvsrGapGroup[]; revisions: RevisionGroup[] }) {
  return (
    <section className="notes-list" aria-labelledby="notes-heading">
      <h2 id="notes-heading">Notes</h2>
      <ul>
        <li>
          <b>Strip axis.</b> The ruler under the strip is the published subdivision milepost — C, S,
          then D <SourceLink sourceId="ts1_alignment" /> — and the named marks are the five station
          sites <SourceLink sourceId="arcgis_stations" />. This dashboard’s internal iosMile
          coordinate is the published milepost minus 124 over the whole route, so it is not repeated
          on the axis; it is shown per segment, next to the published station range, in the strip
          tooltip and the selected-segment panel. The dashed rules are construction-package
          boundaries.
        </li>
        <li>
          <b>Structure marks.</b> Ticks above the band mark named structures. Structures narrower
          than the pixel grid are drawn as fixed-width marks at their true position and are not to
          scale.
        </li>
        <li>
          <b>Difficulty scale.</b> Segment widths are scaled by an unofficial difficulty model.
          Numeric earthwork completion contributes continuously; categorical Structure complete
          contributes the full structure weight, while in-progress structures contribute no invented
          percentage. CVSR row tables take precedence where published because they are dated
          reports; ArcGIS fills the remaining rows. Package totals come from published per-package
          contract values plus the 2026 Business Plan Table B.1 extension totals; both the structure
          type factors and the structure/guideway split are this dashboard’s editorial judgment with
          no published basis. CP1 publishes structure rows inside their guideway rows, so about
          1.6 mi of corridor appears in both. <SourceLink sourceId="arcgis_progress" />{' '}
          <SourceLink sourceId="cvsr" /> <SourceLink sourceId="business_plan_2026" />
        </li>
        <li>
          <b>Granularity matters.</b> ROW and utility progress are reported by construction package,
          never painted by mile. Historical colors before the latest fetch are schedule-derived.
        </li>
        <li>
          <b>Track installation.</b> Exhibit D.0 of the 2026 Final Business Plan lists Track &amp;
          Systems Design &amp; Construction for the 119-mile Central Valley Segment as NOT STARTED,
          and the Authority’s 2026 milestones say the track-laying phase can commence in 2026. No
          monthly track-installation series and no track-mileage total are published, so the block
          shows a bare zero over a dashed baseline rather than a reported trend.{' '}
          <SourceLink sourceId="business_plan_2026_schedule" />
        </li>
        <li>
          <b>Right-of-way delivered.</b> The CVSR counts parcels the Authority has handed to the
          design-builder — the contractor joint venture building that package — which is what the
          rail charts. The Authority also publishes a separate acquisition count, last reported for
          the 2021-03 data month, and a railroad-parcel count that moved from 105 to 164 across 69
          published months; neither is charted here. <SourceLink sourceId="cvsr" />
        </li>
        {gaps.length > 0 && (
          <li>
            <b>Data gaps.</b> A month the Authority did not publish a metric is left blank, never
            interpolated and never carried forward. <SourceLink sourceId="cvsr" />
            <ul>
              {gaps.map((group) => (
                <li
                  key={`${group.metric}:${group.cause}:${group.month}:${group.endMonth}:${group.packages.join(',')}`}
                  title={group.detail}
                >
                  {GAP_METRIC_LABELS[group.metric]} ({group.packages.join(', ')}):{' '}
                  {group.month}{group.endMonth === group.month ? '' : `–${group.endMonth}`} — {GAP_LABELS[group.cause]}
                </li>
              ))}
            </ul>
          </li>
        )}
        {revisions.length > 0 && (
          <li>
            <b>Data anomalies.</b> Values the Authority later restated. The superseded month keeps
            the number its own report published; the rail marks the affected package with a wavy
            underline. <SourceLink sourceId="cvsr" />
            <ul>
              {revisions.map((group) => (
                <li key={`revision:${group.key}:${group.month}:${group.endMonth}`} title={group.detail}>
                  {REVISION_METRIC_LABELS[group.metric]} ({group.packages}):{' '}
                  {group.month}{group.endMonth === group.month ? '' : `–${group.endMonth}`} — restated in the{' '}
                  {group.correctedIn} report
                </li>
              ))}
            </ul>
          </li>
        )}
      </ul>
    </section>
  );
}

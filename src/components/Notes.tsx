import {
  GAP_LABELS,
  GAP_METRIC_LABELS,
  REVISION_METRIC_LABELS,
  type CvsrGapGroup,
  type RevisionGroup,
} from '../lib/cvsr-gaps';
import { ReportLink, SourceLink } from './Citation';

/**
 * Every marking stripped from the strip and the legend is consolidated here, so
 * the first screen stays a chart rather than a page of footnote crosses.
 */
export function NotesList({ gaps, revisions, overlapMiles }: {
  gaps: CvsrGapGroup[];
  revisions: RevisionGroup[];
  /** Corridor this dashboard measures as nested structure-inside-guideway, in miles. */
  overlapMiles: number;
}) {
  return (
    <section className="notes-list" aria-labelledby="notes-heading">
      <h2 id="notes-heading">Notes</h2>
      <ul>
        <li>
          <b>Strip axis.</b> The ruler under the strip is the published subdivision milepost — C, S,
          then D <SourceLink sourceId="ts1_alignment" /> — and the named marks are the five published
          station points, projected onto the alignment centerline and read off the TS1 milepost
          axis <SourceLink sourceId="arcgis_stations" /> <SourceLink sourceId="ts1_alignment" />;
          three of the five sit in gaps in the published geometry and their tooltip says so. This
          dashboard’s internal iosMile
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
          contract values plus, for the two extensions, the sum of each extension’s construction,
          utility-relocation and right-of-way line items in the 2026 Business Plan Estimate column
          of Table B.1; both the structure type factors and the structure/guideway split are this
          dashboard’s editorial judgment with no published basis. CP1 publishes structure rows
          inside their guideway rows; this dashboard measures about {overlapMiles.toFixed(1)} mi of
          corridor in both. <SourceLink sourceId="arcgis_progress" />{' '}
          <SourceLink sourceId="cvsr" /> <SourceLink sourceId="bp2026_costs" />
        </li>
        <li>
          <b>Guideway complete.</b> Construction spans are listed in the report’s <i>Completed</i> table once they reached substantial completion — minor closeout work may still remain. To actually contribute to the mileage tally, the span must be officially announced as finished in the report. Take June 2026 for example: despite several new CP2-3 spans being marked as complete announced none for CP2-3, thus completed mileage remained flat in June 2026. <SourceLink sourceId="cvsr_2026_08" page="p. 2" />
        </li>
        <li>
          <b>Granularity matters.</b> ROW and utility progress are reported by construction package,
          never painted by mile. Historical colors before the latest fetch are schedule-derived.
        </li>
        <li>
          <b>Track installation.</b> The Authority awarded the Track &amp; Systems Construction
          Contract in June 2026 and authorized Packages 1B and 2, so track work is under contract
          rather than unstarted; every later package still needs its own Board
          approval <SourceLink sourceId="tscc_resolution_2026" />. CP4 track laying is forecast to
          begin in Q4 2026, against a contract requirement to start track construction no later
          than December 15, 2026. No installed-track mileage total and no monthly
          track-installation series are published, so the block shows an em dash over a dashed
          baseline rather than a number. <SourceLink sourceId="cvsr_2026_08_forecast" /> Package and
          section detail is in the delivery outlook below.
        </li>
        <li>
          <b>Right-of-way delivered.</b> The CVSR counts parcels the Authority has handed to the
          design-builder — the contractor joint venture building that package — which is what the
          rail charts. The Authority also publishes a separate acquisition count, last reported for
          the 2021-03 data month, and a railroad-parcel series in its own table: 105 of 183 parcels
          acquired as of March 9, 2020 in the January-2020-data report <SourceLink sourceId="cvsr" />,
          and 164 of 176 delivered to the design-builder in the May-2026-data
          report <SourceLink sourceId="cvsr" />. Neither is charted here, and the acquisition and
          delivery counts are not one series.
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
                  {group.reportUrl && <> <ReportLink url={group.reportUrl} title={group.reportFile ?? group.detail} /></>}
                </li>
              ))}
            </ul>
          </li>
        )}
        {revisions.length > 0 && (
          <li>
            <b>Data anomalies.</b> Values the Authority later restated. The superseded month keeps
            the number its own report published; the rail marks the affected package with a wavy
            underline. <SourceLink sourceId="cvsr_2022_04" />
            <ul>
              {revisions.map((group) => (
                <li key={`revision:${group.key}:${group.month}:${group.endMonth}`} title={group.detail}>
                  {REVISION_METRIC_LABELS[group.metric]} ({group.packages}):{' '}
                  {group.month}{group.endMonth === group.month ? '' : `–${group.endMonth}`} — restated in the{' '}
                  {group.correctedIn} report
                  {group.reportUrl && <> <ReportLink url={group.reportUrl} title={group.reportFile} /></>}
                </li>
              ))}
            </ul>
          </li>
        )}
      </ul>
    </section>
  );
}

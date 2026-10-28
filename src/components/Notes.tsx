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
          <b>Guideway complete.</b> The report counts a construction span complete once it has
          reached substantial completion — minor closeout work may still remain, so a span can be
          counted complete below 100%. To actually contribute to the mileage tally, the span must be
          officially announced as finished in the report. Take the June-2026 data for example: nine
          CP2-3 rows moved from the report’s underway list to its completed list, yet the report
          announced no completed miles for CP2-3, so the package stayed at 57 of 65 miles and the
          program at 89. <SourceLink sourceId="cvsr_2026_08" page="p. 2" />
        </li>
        <li>
          <b>Per-location rows.</b> Through the September-2026 report the Authority published
          per-location progress as <i>Underway</i>/<i>Completed</i> tables carrying schedule dates.
          The October-2026 report replaced them with charts labelled <i>Location -- Percentage
          Complete</i>, which publish neither the completed/underway split nor the dates. The
          August-2026-data rows here are therefore transcribed by hand: percentages and spans from
          that report, the split and schedule months carried from the September report and changed
          only where the October report’s notes announce a completion, checked against the package
          counts the same report prints. <SourceLink sourceId="cvsr_2026_09" />{' '}
          <SourceLink sourceId="cvsr_2026_10" />
        </li>
        <li>
          <b>Granularity matters.</b> ROW and utility progress are reported by construction package,
          never painted by mile. Segment colors come from the newest CVSR row at or before the
          selected month — those rows start with the March-2026 data month — and, for earlier
          months, from dated structure evidence or, failing that, the schedule dates the ArcGIS
          layer publishes. <SourceLink sourceId="arcgis_progress" /> <SourceLink sourceId="cvsr" />
        </li>
        <li>
          <b>Track installation.</b> Exhibit D.0 of the 2026 Final Business Plan lists Track &amp;
          Systems Design &amp; Construction for the 119-mile Central Valley Segment as NOT
          STARTED <SourceLink sourceId="bp2026_schedule" />, and the Authority’s 2026 milestones put
          the start behind the southern railhead: with that railhead ready, deliveries of rail,
          concrete ties and ballast can begin and the track-laying phase can
          commence <SourceLink sourceId="bp2026_milestones" />. The report does publish a quarterly
          forecast — mobilization at the southern railhead through the fourth quarter of 2026, then
          track laying running north from CP4 into 2029 — but no installed-track mileage for any
          month, so the block shows a bare zero over a dashed baseline rather than a reported
          trend. <SourceLink sourceId="cvsr_2026_10" page="p. 11" />
        </li>
        <li>
          <b>Right-of-way delivered.</b> The CVSR counts parcels the Authority has handed to the
          design-builder — the contractor joint venture building that package — which is what the
          rail charts. Delivery reached all 2,288 parcels in the April-2026 data month and has not
          moved since; the report calls it a program
          milestone. <SourceLink sourceId="cvsr_2026_06_24" /> <SourceLink sourceId="cvsr_2026_10" page="p. 10" />
          The Authority also publishes a separate acquisition count, last reported for the 2021-03
          data month, and a railroad-parcel series in its own table: 105 of 183 parcels acquired as
          of March 9, 2020 in the January-2020-data
          report <SourceLink sourceId="cvsr_2020_03" />, and 164 of 176 railroad parcels delivered,
          unchanged through the August-2026 data month, where the report records none delivered that
          month and says the remainder are not needed to build the
          guideway. <SourceLink sourceId="cvsr_2026_10" page="p. 10" /> Neither is charted here, and
          the acquisition and delivery counts are not one series.
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

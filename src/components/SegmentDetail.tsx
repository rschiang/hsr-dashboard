import { SOURCES } from '../data/sources';
import type { AlignmentStatus, Segment, StructureEvidence } from '../data/types';
import { STATUS_LABELS } from '../lib/status';
import { evidenceDateLabel, structureObservationLabel } from '../lib/observation-labels';
import { Abbr } from './Abbr';
import { SourceLink } from './Citation';

/**
 * The strip tooltip is `pointer-events: none`, so anchors inside it are dead for
 * mouse and keyboard alike. This panel carries the same content with links that
 * actually work, and is reachable by keyboard from the strip and the map.
 */
export function SegmentDetail({
  segment,
  status,
  evidence,
  disagreement,
  date,
  onClear,
}: {
  segment: Segment;
  status: AlignmentStatus | undefined;
  evidence: StructureEvidence | undefined;
  disagreement?: { arcgis: number; cvsr: number; cvsrMonth: string; reportFile: string };
  date: string;
  onClear: () => void;
}) {
  return (
    <section className="segment-detail" aria-labelledby="segment-detail-heading" aria-live="polite">
      <div className="segment-detail-head">
        <p className="eyebrow">Selected segment</p>
        <h2 id="segment-detail-heading">{segment.label}</h2>
      </div>
      <dl>
        <dt>Package · status</dt>
        <dd><Abbr>{segment.cp}</Abbr> · {STATUS_LABELS[status ?? segment.currentStatus]}</dd>

        <dt>Station</dt>
        <dd>
          {segment.stationStart?.toLocaleString() ?? 'not published'}–{segment.stationEnd?.toLocaleString() ?? 'not published'} ft
          {' '}<SourceLink sourceId={segment.sourceId} />
        </dd>

        <dt>Milepost</dt>
        <dd>
          {segment.iosMileStart.toFixed(2)}–{segment.iosMileEnd.toFixed(2)} ios mi · {segment.officialMpStart}–{segment.officialMpEnd}
          {' '}<SourceLink sourceId="ts1_alignment" />
        </dd>

        {disagreement && date.slice(0, 7) >= disagreement.cvsrMonth && (
          <>
            <dt>Earthwork · ArcGIS</dt>
            <dd>{Math.round(disagreement.arcgis * 100)}% · layer updated {SOURCES.arcgis_progress.date} <SourceLink sourceId="arcgis_progress" /></dd>
            <dt>Earthwork · CVSR</dt>
            <dd>{Math.round(disagreement.cvsr * 100)}% · {disagreement.cvsrMonth} data <SourceLink sourceId="cvsr" /></dd>
          </>
        )}

        <dt>Difficulty share</dt>
        <dd>{(segment.weightShare * 100).toFixed(2)}% <SourceLink sourceId="business_plan_2026" /></dd>

        {evidence && (
          <>
            <dt>Evidence</dt>
            <dd>
              “{evidence.quote}” — {evidenceDateLabel(evidence)}.{' '}
              <a href={evidence.sourceUrl} target="_blank" rel="noreferrer">{evidence.sourceTitle}</a>
            </dd>
          </>
        )}

        {segment.structures.length > 0 && (
          <>
            <dt>Named structures</dt>
            <dd>
              <ul className="detail-structures">
                {segment.structures.map((structure) => (
                  <li key={structure.globalId}>
                    <a href={structure.url} target="_blank" rel="noreferrer">{structure.name}</a>
                    {' — '}{structureObservationLabel(structure, date)}
                  </li>
                ))}
              </ul>
            </dd>
          </>
        )}
      </dl>
      <button type="button" onClick={onClear}>Clear selection</button>
    </section>
  );
}

import type { AlignmentStatus, Segment, StructureEvidence } from '../data/types';
import { STATUS_LABELS } from '../lib/status';
import { evidenceDateLabel, structureObservationLabel } from '../lib/observation-labels';
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
  completion,
  disagreement,
  date,
  onClear,
}: {
  segment: Segment | undefined;
  status: AlignmentStatus | undefined;
  evidence: StructureEvidence | undefined;
  completion: number | null;
  disagreement?: { arcgis: number; cvsr: number; cvsrMonth: string; reportFile: string };
  date: string;
  onClear: () => void;
}) {
  return (
    <section className="segment-detail" aria-labelledby="segment-detail-heading" aria-live="polite">
      <div className="segment-detail-head">
        <div>
          <p className="eyebrow">Selected segment · working citations</p>
          <h2 id="segment-detail-heading">{segment ? segment.label : 'No segment selected'}</h2>
        </div>
        {segment && <button type="button" onClick={onClear}>Clear selection</button>}
      </div>
      {!segment
        ? <p className="detail-empty">Select a segment on the strip or map for its sources.</p>
        : (
          <dl>
            <dt>Package · status</dt>
            <dd>{segment.cp} · {STATUS_LABELS[status ?? segment.currentStatus]}</dd>

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

            {disagreement && date.slice(0, 7) >= disagreement.cvsrMonth ? (
              <>
                <dt>Earthwork · ArcGIS</dt>
                <dd>{Math.round(disagreement.arcgis * 100)}% <SourceLink sourceId="arcgis_progress" /></dd>
                <dt>Earthwork · CVSR</dt>
                <dd>{Math.round(disagreement.cvsr * 100)}% · April 2026 data <SourceLink sourceId="cvsr" /></dd>
              </>
            ) : (
              <>
                <dt>Earthwork at selected date</dt>
                <dd>
                  {completion === null ? 'not reported' : `${Math.round(completion * 100)}%`}
                  {' '}<SourceLink sourceId={segment.sourceId === 'cvsr' ? 'cvsr' : 'arcgis_progress'} />
                </dd>
              </>
            )}

            <dt>Difficulty share</dt>
            <dd>{(segment.weightShare * 100).toFixed(2)}% <SourceLink sourceId="business_plan_2026" /></dd>

            {evidence && (
              <>
                <dt>Evidence</dt>
                <dd className="detail-wide">
                  “{evidence.quote}” — {evidenceDateLabel(evidence)}.{' '}
                  <a href={evidence.sourceUrl} target="_blank" rel="noreferrer">{evidence.sourceTitle}</a>
                </dd>
              </>
            )}

            {segment.structures.length > 0 && (
              <>
                <dt>Named structures</dt>
                <dd className="detail-wide">
                  {segment.structures.map((structure, index) => (
                    <span key={structure.globalId}>
                      {index > 0 && ' · '}
                      <a href={structure.url} target="_blank" rel="noreferrer">{structure.name}</a>
                      {' — '}{structureObservationLabel(structure, date)}
                    </span>
                  ))}
                </dd>
              </>
            )}
          </dl>
        )}
    </section>
  );
}

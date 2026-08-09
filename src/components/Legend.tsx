import { STATUS_COLORS, STATUS_LABELS, OFFICIAL_DEFINITIONS } from '../lib/status';
import type { AlignmentStatus } from '../data/types';
import { SourceLink, SourcesList } from './Citation';

const VISIBLE_STATUSES: AlignmentStatus[] = [
  'not_started',
  'no_data',
  'preconstruction',
  'under_construction',
  'structure_complete',
  'guideway_complete',
  'track_laid',
  'systems_installed',
];

export function Legend() {
  return (
    <aside className="legend-panel" aria-label="Legend and sources">
      <div>
        <p className="eyebrow">Alignment status</p>
        <h2>Construction phase</h2>
        <ul className="legend-items">
          {VISIBLE_STATUSES.map((status) => (
            <li
              key={status}
              title={status === 'guideway_complete'
                ? OFFICIAL_DEFINITIONS.guideway
                : status === 'structure_complete'
                  ? OFFICIAL_DEFINITIONS.structure
                  : undefined}
            >
              <span className={`legend-swatch ${status === 'no_data' ? 'hatched' : ''}`} style={{ backgroundColor: STATUS_COLORS[status] }} />
              <span>{STATUS_LABELS[status]}</span>
              {(status === 'track_laid' || status === 'systems_installed') && <span className="legend-zero">0% <SourceLink sourceId="cvsr" /></span>}
            </li>
          ))}
        </ul>
        <p className="definition" title={OFFICIAL_DEFINITIONS.guideway}>
          <strong>Guideway complete:</strong> earthworks complete with rough grading. <SourceLink sourceId="cvsr" />
        </p>
        <p className="definition" title={OFFICIAL_DEFINITIONS.structure}>
          <strong>Structure complete:</strong> all concrete work complete; ready for punchlist and certification. <SourceLink sourceId="cvsr" />
        </p>
        <div className="granularity-note">
          <strong>Granularity matters.</strong> ROW and utility progress are reported by construction package, never painted by mile. Historical colors before the latest fetch are schedule-derived.
        </div>
      </div>
      <SourcesList />
    </aside>
  );
}

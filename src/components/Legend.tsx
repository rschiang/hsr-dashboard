import { STATUS_COLORS, STATUS_LABELS } from '../lib/status';
import type { AlignmentStatus } from '../data/types';
import { SourceLink } from './Citation';

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

const STATUS_CAPTIONS: Partial<Record<AlignmentStatus, string>> = {
  structure_complete: 'All concrete work complete; ready for punchlist and certification.',
  guideway_complete: 'Earthworks complete with rough grading.',
};

export function Legend() {
  return (
    <aside className="legend-panel" aria-labelledby="legend-heading">
      <h2 id="legend-heading">Alignment status</h2>
      <ul className="legend-items">
        {VISIBLE_STATUSES.map((status) => {
          const caption = STATUS_CAPTIONS[status];
          return (
            <li key={status}>
              <span className={`legend-swatch ${status === 'no_data' ? 'hatched' : ''}`} style={{ backgroundColor: STATUS_COLORS[status] }} />
              <span className="legend-copy">
                <span className="legend-name">{STATUS_LABELS[status]}</span>
                {caption && (
                  <span className="legend-caption">{caption} <SourceLink sourceId="cvsr" /></span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

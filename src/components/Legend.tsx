import { STATUS_COLORS, STATUS_LABELS, OFFICIAL_DEFINITIONS } from '../lib/status';
import type { AlignmentStatus } from '../data/types';

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
    <aside className="legend-panel" aria-label="Alignment status legend">
      <ul className="legend-items">
        {VISIBLE_STATUSES.map((status) => {
          const definition = status === 'guideway_complete'
            ? OFFICIAL_DEFINITIONS.guideway
            : status === 'structure_complete'
              ? OFFICIAL_DEFINITIONS.structure
              : undefined;
          return (
            <li key={status} title={definition ? `${STATUS_LABELS[status]} — ${definition}` : STATUS_LABELS[status]}>
              <span className={`legend-swatch ${status === 'no_data' ? 'hatched' : ''}`} style={{ backgroundColor: STATUS_COLORS[status] }} />
              <span className="sr-only">{STATUS_LABELS[status]}</span>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

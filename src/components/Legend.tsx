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

// Verbatim from the July 2026 report: the structure sentence on printed p. 18, the
// guideway sentence on printed p. 7. Each cites the page it is quoted from.
const STATUS_CAPTIONS: Partial<Record<AlignmentStatus, { text: string; page: string }>> = {
  structure_complete: {
    text: 'All concrete work is complete, ready for punchlist and certification.',
    page: 'p. 18',
  },
  guideway_complete: {
    text: 'Earthworks complete with rough grading.',
    page: 'p. 7',
  },
};

export function Legend() {
  return (
    <aside className="legend-panel" aria-labelledby="legend-heading">
      <h2 id="legend-heading">Segment status</h2>
      <ul className="legend-items">
        {VISIBLE_STATUSES.map((status) => {
          const caption = STATUS_CAPTIONS[status];
          return (
            <li key={status}>
              <span className={`legend-swatch ${status === 'no_data' ? 'hatched' : ''}`} style={{ backgroundColor: STATUS_COLORS[status] }} />
              <span className="legend-copy">
                <span className="legend-name">{STATUS_LABELS[status]}</span>
                {caption && (
                  <span className="legend-caption">
                    {caption.text} <SourceLink sourceId="cvsr_2026_07" page={caption.page} />
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

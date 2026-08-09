import type { CvsrSeriesPoint } from '../lib/cvsr-series';

/**
 * A 120x24 sparkline over one published CVSR series. Every break in the line is
 * a month the Authority did not publish the metric: contiguous runs are drawn
 * as separate paths and never bridged, so the gaps stay visible rather than
 * being smoothed into a trend that was never reported.
 */
export function Sparkline({
  points,
  selectedIndex,
  label,
}: {
  points: Array<CvsrSeriesPoint | null>;
  selectedIndex: number | null;
  label: string;
}): React.ReactElement {
  const step = points.length > 1 ? 116 / (points.length - 1) : 0;
  const xAt = (index: number): number => 2 + index * step;
  const yAt = (point: CvsrSeriesPoint): number => 22 - point.ratio * 20;

  const runs: Array<Array<{ index: number; point: CvsrSeriesPoint }>> = [];
  let run: Array<{ index: number; point: CvsrSeriesPoint }> = [];
  points.forEach((point, index) => {
    if (point === null) {
      if (run.length > 0) runs.push(run);
      run = [];
      return;
    }
    run.push({ index, point });
  });
  if (run.length > 0) runs.push(run);

  const marker = ((): { x: number; y: number; exact: boolean } | null => {
    if (selectedIndex === null) return null;
    const exact = points[selectedIndex];
    if (exact) return { x: xAt(selectedIndex), y: yAt(exact), exact: true };
    for (let index = Math.min(selectedIndex, points.length - 1); index >= 0; index -= 1) {
      const point = points[index];
      if (point) return { x: xAt(index), y: yAt(point), exact: false };
    }
    return null;
  })();

  return (
    <svg className="sparkline" viewBox="0 0 120 24" width="120" height="24" role="img" aria-label={label}>
      <title>{label}</title>
      {runs.map((entries) => (
        entries.length === 1
          ? <circle key={entries[0].index} cx={xAt(entries[0].index)} cy={yAt(entries[0].point)} r="1" className="sparkline-point" />
          : (
            <path
              key={entries[0].index}
              className="sparkline-run"
              d={entries.map(({ index, point }, position) => `${position === 0 ? 'M' : 'L'} ${xAt(index).toFixed(2)} ${yAt(point).toFixed(2)}`).join(' ')}
            />
          )
      ))}
      {marker && (
        marker.exact
          ? <circle cx={marker.x} cy={marker.y} r="2.5" fill="var(--accent)" />
          : <circle cx={marker.x} cy={marker.y} r="2.5" fill="none" stroke="var(--accent)" />
      )}
    </svg>
  );
}

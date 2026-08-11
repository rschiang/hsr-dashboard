import type { CvsrSeriesPoint } from '../lib/cvsr-series';

export type SparklineSeries = { id: string; points: Array<CvsrSeriesPoint | null>; color: string };

const WIDTH = 240;
const HEIGHT = 44;
const PLOT_LEFT = 2;
const PLOT_WIDTH = 236;
const BASELINE = 40;
const AMPLITUDE = 34;

/**
 * One sparkline over N published CVSR series. Every break in a line is a month
 * the Authority did not publish the metric: contiguous runs are drawn as
 * separate paths and never bridged, so the gaps stay visible rather than being
 * smoothed into a trend that was never reported. A series with no published
 * month at all is a dashed baseline, not an invented flat line.
 */
export function Sparkline({
  series,
  selectedIndex,
  label,
}: {
  series: SparklineSeries[];
  selectedIndex: number | null;
  label: string;
}): React.ReactElement {
  const length = series[0]?.points.length ?? 0;
  const step = length > 1 ? PLOT_WIDTH / (length - 1) : 0;
  const xAt = (index: number): number => PLOT_LEFT + index * step;
  const yAt = (point: CvsrSeriesPoint): number => BASELINE - point.ratio * AMPLITUDE;

  const markerX = selectedIndex !== null && selectedIndex >= 0 && selectedIndex < length
    ? xAt(selectedIndex)
    : null;
  const markerExact = series[0]?.points[selectedIndex ?? -1] != null;

  return (
    <svg
      className="sparkline"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width="100%"
      height={HEIGHT}
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
    >
      <title>{label}</title>
      {series.map(({ id, points, color }) => {
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

        if (runs.length === 0) {
          return (
            <line
              key={id}
              x1={PLOT_LEFT}
              x2={WIDTH - PLOT_LEFT}
              y1={BASELINE}
              y2={BASELINE}
              stroke={color}
              strokeWidth="1"
              strokeDasharray="2 3"
              vectorEffect="non-scaling-stroke"
            />
          );
        }
        return runs.map((entries) => (
          entries.length === 1
            ? <circle key={`${id}:${entries[0].index}`} cx={xAt(entries[0].index)} cy={yAt(entries[0].point)} r="1" fill={color} />
            : (
              <path
                key={`${id}:${entries[0].index}`}
                className="sparkline-run"
                stroke={color}
                vectorEffect="non-scaling-stroke"
                d={entries.map(({ index, point }, position) => `${position === 0 ? 'M' : 'L'} ${xAt(index).toFixed(2)} ${yAt(point).toFixed(2)}`).join(' ')}
              />
            )
        ));
      })}
      {markerX !== null && (
        <line
          x1={markerX}
          x2={markerX}
          y1="2"
          y2="42"
          stroke="var(--accent)"
          strokeWidth="1"
          strokeDasharray={markerExact ? undefined : '2 2'}
          vectorEffect="non-scaling-stroke"
        />
      )}
    </svg>
  );
}

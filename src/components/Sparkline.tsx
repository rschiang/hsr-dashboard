import type { CvsrSeriesPoint } from '../lib/cvsr-series';

export type SparklineSeries = { id: string; points: Array<CvsrSeriesPoint | null>; color: string };

const WIDTH = 240;
const HEIGHT = 44;
const PLOT_LEFT = 2;
const PLOT_WIDTH = 236;
const BASELINE = 40;
const AMPLITUDE = 34;

/**
 * One sparkline over N published CVSR series. Published months are drawn as solid
 * runs; every month the Authority did not publish is bridged with a light-grey
 * dashed segment, so an estimated span can never be mistaken for a reported one.
 * A leading run of unpublished months is bridged flat at the first published value;
 * a trailing one is not bridged at all, because nothing later justifies it. A series
 * with no published month is a grey dashed baseline, not an invented flat line.
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
              className="sparkline-gap"
              x1={PLOT_LEFT}
              x2={WIDTH - PLOT_LEFT}
              y1={BASELINE}
              y2={BASELINE}
              vectorEffect="non-scaling-stroke"
            />
          );
        }

        // Months the Authority never published are bridged, not plotted: a light-grey
        // dashed segment marks the span as an estimate the source does not support.
        const bridges: Array<{ key: string; x1: number; y1: number; x2: number; y2: number }> = [];
        const head = runs[0][0];
        if (head.index > 0) {
          // Nothing precedes the first published month, so the first value is the estimate.
          bridges.push({ key: 'lead', x1: xAt(0), y1: yAt(head.point), x2: xAt(head.index), y2: yAt(head.point) });
        }
        for (let position = 1; position < runs.length; position += 1) {
          const from = runs[position - 1].at(-1)!;
          const to = runs[position][0];
          bridges.push({ key: `gap:${from.index}`, x1: xAt(from.index), y1: yAt(from.point), x2: xAt(to.index), y2: yAt(to.point) });
        }

        return (
          <g key={id}>
            {bridges.map((bridge) => (
              <line
                key={bridge.key}
                className="sparkline-gap"
                x1={bridge.x1.toFixed(2)}
                y1={bridge.y1.toFixed(2)}
                x2={bridge.x2.toFixed(2)}
                y2={bridge.y2.toFixed(2)}
                vectorEffect="non-scaling-stroke"
              />
            ))}
            {runs.map((entries) => (
              entries.length === 1
                ? <circle key={entries[0].index} cx={xAt(entries[0].index)} cy={yAt(entries[0].point)} r="1" fill={color} />
                : (
                  <path
                    key={entries[0].index}
                    className="sparkline-run"
                    stroke={color}
                    vectorEffect="non-scaling-stroke"
                    d={entries.map(({ index, point }, position) => `${position === 0 ? 'M' : 'L'} ${xAt(index).toFixed(2)} ${yAt(point).toFixed(2)}`).join(' ')}
                  />
                )
            ))}
          </g>
        );
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

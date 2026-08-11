import type { CvsrPackageId } from '../data/types';
import { Abbr } from './Abbr';
import { Sparkline, type SparklineSeries } from './Sparkline';

/**
 * One rail block: a headline number over the per-package sparklines that
 * produced it. Every string arrives pre-formatted — the block never derives a
 * number, so a metric the Authority did not publish stays an em dash.
 */
export function MetricBlock({
  label,
  value,
  unit,
  chip,
  packages,
  series,
  selectedIndex,
  ariaLabel,
  status,
}: {
  label: string;
  value: string;
  unit?: string;
  chip?: React.ReactNode;
  packages?: Array<{ cp: CvsrPackageId; percent: string; revisedTitle?: string }>;
  series: SparklineSeries[];
  selectedIndex: number | null;
  ariaLabel: string;
  status?: React.ReactNode;
}): React.ReactElement {
  return (
    <section className="metric-block">
      <div className="metric-head">
        <div className="metric-head-label">
          <h3>{label}</h3>
          {status && <p className="metric-status">{status}</p>}
        </div>
        {chip && <span className="metric-chip">{chip}</span>}
        {packages && (
          <ul className="metric-packages">
            {packages.map(({ cp, percent, revisedTitle }) => (
              <li key={cp}>
                <b><Abbr>{cp}</Abbr></b>:{' '}
                {revisedTitle === undefined
                  ? percent
                  : <span className="revised" title={revisedTitle}>{percent}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="metric-value">{value}{unit && <span className="metric-unit">{unit}</span>}</p>
      <Sparkline series={series} selectedIndex={selectedIndex} label={ariaLabel} />
    </section>
  );
}

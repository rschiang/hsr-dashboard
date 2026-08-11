import { useEffect, useMemo, useRef, useState } from 'react';
import type { CvsrGap } from '../data/types';

export function TimeScrubber({
  dates,
  date,
  onDateChange,
  reportGap,
}: {
  dates: string[];
  date: string;
  onDateChange: (date: string) => void;
  reportGap?: CvsrGap;
}) {
  const [playing, setPlaying] = useState(false);
  const frameRef = useRef<number | null>(null);
  const index = useMemo(() => Math.max(0, dates.indexOf(date)), [date, dates]);

  useEffect(() => {
    if (!playing || dates.length === 0) return;
    let prior = performance.now();
    const frame = (now: number) => {
      if (now - prior >= 250) {
        prior = now;
        const current = dates.indexOf(date);
        if (current >= dates.length - 1) {
          setPlaying(false);
          return;
        }
        onDateChange(dates[current + 1]);
      }
      frameRef.current = requestAnimationFrame(frame);
    };
    frameRef.current = requestAnimationFrame(frame);
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [date, dates, onDateChange, playing]);

  return (
    <div className="time-scrubber">
      <div className="scrubber-row">
        <button type="button" className="play-button" onClick={() => setPlaying((value) => !value)} aria-label={playing ? 'Pause replay' : 'Play replay'}>
          {playing ? 'Pause' : 'Play'}
        </button>
        <input
          type="range"
          min={0}
          max={Math.max(0, dates.length - 1)}
          value={index}
          onChange={(event) => onDateChange(dates[Number(event.currentTarget.value)])}
          aria-label="Progress date"
        />
        {/* The last tick is not a month: it is the present, CVSR base plus any later ArcGIS poll. */}
        <time dateTime={date}>{index === dates.length - 1 ? 'Current' : date.slice(0, 7)}</time>
      </div>
      {/* Everything whose width changes with the selected month lives on its own
          row: a badge resizing must never resize the track under the pointer. */}
      <div className="scrubber-status">
        {reportGap && (
          <span className="report-gap-badge" title={reportGap.detail}>
            Report gap
            {reportGap.reportUrl && (
              <>
                {' · '}
                <a href={reportGap.reportUrl} target="_blank" rel="noreferrer">report</a>
              </>
            )}
          </span>
        )}
      </div>
    </div>
  );
}

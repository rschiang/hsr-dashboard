import { useEffect, useMemo, useRef, useState } from 'react';
import type { CvsrGap } from '../data/types';

export function TimeScrubber({
  dates,
  date,
  onDateChange,
  provenance,
  reportGap,
}: {
  dates: string[];
  date: string;
  onDateChange: (date: string) => void;
  provenance: 'scheduled' | 'observed' | 'mixed';
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

  const provenanceLabel = provenance === 'mixed'
    ? 'Mixed observed + scheduled'
    : provenance === 'observed'
      ? 'Observed replay'
      : 'Scheduled replay';
  return (
    <div className="time-scrubber">
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
      <time dateTime={date}>{date.slice(0, 7)}</time>
      <span className={`tier-badge provenance-${provenance}`}>{provenanceLabel}</span>
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
  );
}

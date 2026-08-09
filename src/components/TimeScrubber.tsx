import { useEffect, useMemo, useRef, useState } from 'react';
import type { SourceId } from '../data/sources';
import { SourceLink } from './Citation';

export function TimeScrubber({
  dates,
  date,
  onDateChange,
  tier,
}: {
  dates: string[];
  date: string;
  onDateChange: (date: string) => void;
  tier: 1 | 2 | 3;
}) {
  const [playing, setPlaying] = useState(false);
  const frameRef = useRef<number | null>(null);
  const index = useMemo(() => Math.max(0, dates.indexOf(date)), [date, dates]);
  const sourceId: SourceId = tier === 2 ? 'cvsr' : 'arcgis_progress';

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

  const tierLabel = tier === 3 ? 'Observed segment snapshot' : tier === 2 ? 'Observed monthly aggregate' : 'Scheduled replay';
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
      <time dateTime={date}>{date.slice(0, 7)} <SourceLink sourceId={sourceId} /></time>
      <span className={`tier-badge tier-${tier}`}>{tierLabel}</span>
    </div>
  );
}

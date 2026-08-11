import { useEffect, useMemo, useRef, useState } from 'react';

export function TimeScrubber({
  dates,
  date,
  onDateChange,
}: {
  dates: string[];
  date: string;
  onDateChange: (date: string) => void;
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

  const togglePlay = () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    // The last tick is the present: replaying from there would advance zero frames,
    // so a Play press there means "start over".
    if (dates.length > 0 && index >= dates.length - 1) onDateChange(dates[0]);
    setPlaying(true);
  };

  return (
    <div className="time-scrubber">
      <div className="scrubber-row">
        <button type="button" className="play-button" onClick={togglePlay} aria-label={playing ? 'Pause replay' : 'Play replay'}>
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
    </div>
  );
}

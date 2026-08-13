import { useMemo, useRef, useState, useSyncExternalStore, type SVGProps } from 'react';
import { scaleLinear } from 'd3-scale';
import type { AlignmentStatus, Segment, SegmentsArtifact, StructureEvidence } from '../data/types';
import { STATUS_COLOR_VARS, STATUS_LABELS } from '../lib/status';
import { iosMileToOfficialMp } from '../lib/mileposts';
import { evidenceDateLabel, structureObservationLabel } from '../lib/observation-labels';
import { SourceLink } from './Citation';

export type AxisMode = 'distance' | 'difficulty';

const CP_BOUNDARIES = [
  { label: 'M2M / CVY', mile: 0, color: 'var(--m2m)', title: 'M2M — Merced to Madera extension · CVY — Central Valley Wye' },
  { label: 'CP1', mile: 34, color: 'var(--cp1)', title: 'CP1 — Construction Package 1' },
  { label: 'CP2–3', mile: 65, color: 'var(--cp2-3)', title: 'CP2–3 — Construction Packages 2 and 3' },
  { label: 'CP4', mile: 131, color: 'var(--cp4)', title: 'CP4 — Construction Package 4' },
  { label: 'LGA', mile: 152, color: 'var(--lga)', title: 'LGA — Locally Generated Alternative (Fresno–Bakersfield)' },
] as const;

const TICK_TOP = 28;        // named-structure ticks
const TICK_BOTTOM = 36;
const BAND_TOP = 38;
const BAND_H = 50;
const AXIS_Y = 88;          // BAND_TOP + BAND_H
const LABEL_Y = 106;        // shared baseline for milepost AND station labels
const CHART_H = 112;

const MILE_TICKS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170, 175];
// The two endpoints claim space first so the axis reads its full extent before
// the interior ticks compete for what is left.
const TICK_ORDER = [0, 175, ...MILE_TICKS.slice(1, -1)];
const CHAR_W = 6.2;

type AxisLabel = { x: number; text: string; anchor: 'start' | 'middle' | 'end'; box: [number, number] };

function useElementWidth(ref: React.RefObject<HTMLDivElement | null>): number {
  return useSyncExternalStore(
    (notify) => {
      if (!ref.current) return () => undefined;
      const observer = new ResizeObserver(notify);
      observer.observe(ref.current);
      return () => observer.disconnect();
    },
    () => ref.current?.clientWidth ?? 900,
    () => 900,
  );
}

export function StripChart({
  segments,
  stations,
  statuses,
  hoveredId,
  selectedId,
  onHover,
  onSelect,
  axisMode,
  date,
  evidence,
  selectedCompletionBySegment,
  disagreements,
}: {
  segments: Segment[];
  stations: SegmentsArtifact['stations'];
  statuses: Record<string, AlignmentStatus>;
  hoveredId: string | null;
  selectedId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string | null) => void;
  axisMode: AxisMode;
  date: string;
  evidence: Record<string, StructureEvidence | undefined>;
  selectedCompletionBySegment: Record<string, number | null>;
  disagreements: Array<{ segmentId: string; cvsrMonth: string }>;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const width = Math.max(540, useElementWidth(containerRef));
  const [tooltip, setTooltip] = useState<{ segment: Segment; x: number; y: number } | null>(null);
  // Roving tabindex over the segment rects: exactly one rect is in the tab order at a
  // time; arrows/Home/End move focus within the list.
  const [focusedIndex, setFocusedIndex] = useState(0);
  const rectRefs = useRef<Array<SVGRectElement | null>>([]);
  const plotLeft = 0;
  const plotRight = width;
  const distanceScale = useMemo(() => scaleLinear().domain([0, 175]).range([plotLeft, plotRight]), [plotRight]);
  const difficultyScale = useMemo(() => scaleLinear().domain([0, 1]).range([plotLeft, plotRight]), [plotRight]);
  const weightedPositions = useMemo(() => {
    const positions = new Map<string, { start: number; end: number }>();
    let cursor = 0;
    for (const segment of segments) {
      positions.set(segment.id, { start: cursor, end: cursor + segment.weightShare });
      cursor += segment.weightShare;
    }
    return positions;
  }, [segments]);

  const xForMile = (mile: number): number => {
    if (axisMode === 'distance') return distanceScale(mile);
    const segment = segments.find((candidate) => mile >= candidate.iosMileStart && mile <= candidate.iosMileEnd);
    if (!segment) return difficultyScale(mile / 175);
    const position = weightedPositions.get(segment.id)!;
    const span = segment.iosMileEnd - segment.iosMileStart;
    const fraction = span === 0 ? 0 : (mile - segment.iosMileStart) / span;
    return difficultyScale(position.start + fraction * (position.end - position.start));
  };

  const hovered = hoveredId ? segments.find((segment) => segment.id === hoveredId) : null;
  const tooltipEvidence = tooltip ? evidence[tooltip.segment.id] : undefined;
  const tooltipCompletion = tooltip ? selectedCompletionBySegment[tooltip.segment.id] : null;
  const tooltipDisagrees = tooltip
    ? disagreements.some(
        (item) => item.segmentId === tooltip.segment.id && date.slice(0, 7) >= item.cvsrMonth,
      )
    : false;

  // One label row, two ranks. Stations outrank mileposts: a milepost label is
  // dropped when it would collide, but its tick mark is always drawn, so the
  // ruler keeps its full scale even where a station name owns the space.
  const place = (x: number, text: string): AxisLabel => {
    const w = text.length * CHAR_W + 8;
    if (x <= 24) return { x: 2, text, anchor: 'start', box: [2, 2 + w] };
    if (x >= width - 24) return { x: width - 2, text, anchor: 'end', box: [width - 2 - w, width - 2] };
    return { x, text, anchor: 'middle', box: [x - w / 2, x + w / 2] };
  };
  const overlaps = (a: [number, number], b: [number, number]) => a[0] < b[1] + 6 && b[0] < a[1] + 6;

  const stationLabels = stations.map((station) => ({ station, label: place(xForMile(station.iosMile), station.label) }));
  const reserved: Array<[number, number]> = stationLabels.map(({ label }) => label.box);
  const keptMileposts = new Map<number, AxisLabel>();
  for (const mile of TICK_ORDER) {
    // Reserve against the widest form the label can take; suppression below can
    // only shorten it, so a kept label never grows into a neighbour.
    const { subdivision, mp } = iosMileToOfficialMp(mile);
    const label = place(xForMile(mile), `${subdivision} ${mp}`);
    if (reserved.some((box) => overlaps(label.box, box))) continue;
    reserved.push(label.box);
    keptMileposts.set(mile, label);
  }
  // Subdivision letters are assigned after suppression, so a dropped tick can
  // never swallow the C→S or S→D change.
  const milepostLabels: AxisLabel[] = [];
  let priorSubdivision = '';
  for (const mile of MILE_TICKS) {
    const label = keptMileposts.get(mile);
    if (label === undefined) continue;
    const { subdivision, mp } = iosMileToOfficialMp(mile);
    milepostLabels.push({ ...label, text: subdivision === priorSubdivision ? `${mp}` : `${subdivision} ${mp}` });
    priorSubdivision = subdivision;
  }

  const interactionProps = (segment: Segment, index: number): SVGProps<SVGRectElement> => ({
    role: 'listitem',
    tabIndex: focusedIndex === index ? 0 : -1,
    'aria-label': `${segment.label}, ${segment.cp}, ${STATUS_LABELS[statuses[segment.id] ?? segment.currentStatus]}, ios mile ${segment.iosMileStart.toFixed(1)} to ${segment.iosMileEnd.toFixed(1)}`,
    onPointerEnter: (event) => {
      onHover(segment.id);
      const bounds = event.currentTarget.ownerSVGElement!.getBoundingClientRect();
      setTooltip({ segment, x: event.clientX - bounds.left, y: event.clientY - bounds.top });
    },
    onPointerMove: (event) => {
      const bounds = event.currentTarget.ownerSVGElement!.getBoundingClientRect();
      setTooltip({ segment, x: event.clientX - bounds.left, y: event.clientY - bounds.top });
    },
    onPointerLeave: () => { onHover(null); setTooltip(null); },
    onClick: () => onSelect(selectedId === segment.id ? null : segment.id),
    onFocus: (event) => {
      onHover(segment.id);
      const bounds = event.currentTarget.ownerSVGElement!.getBoundingClientRect();
      const rect = event.currentTarget.getBoundingClientRect();
      setTooltip({
        segment,
        x: rect.left + rect.width / 2 - bounds.left,
        y: rect.top + rect.height / 2 - bounds.top,
      });
    },
    onBlur: () => { onHover(null); setTooltip(null); },
    onKeyDown: (event) => {
      const last = segments.length - 1;
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft' || event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        const next = event.key === 'ArrowRight'
          ? Math.min(last, index + 1)
          : event.key === 'ArrowLeft'
            ? Math.max(0, index - 1)
            : event.key === 'Home' ? 0 : last;
        setFocusedIndex(next);
        rectRefs.current[next]?.focus();
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onSelect(selectedId === segment.id ? null : segment.id);
      } else if (event.key === 'Escape') {
        onSelect(null);
        setTooltip(null);
      }
    },
  });

  return (
    <div className="strip-canvas" ref={containerRef}>
      {/* role="group", not role="img": role="img" makes the subtree a leaf for assistive
          tech, which would hide the focusable segment list below. */}
      <svg viewBox={`0 0 ${width} ${CHART_H}`} role="group" aria-label="Construction status strip from Merced to Oswell Street">
        <defs>
          <pattern id="no-data-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill={STATUS_COLOR_VARS.no_data} />
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--status-no-data-hatch)" strokeWidth="2" />
          </pattern>
        </defs>
        {CP_BOUNDARIES.map((boundary) => {
          const x = xForMile(boundary.mile);
          return (
            <g key={boundary.label}>
              <line x1={x} x2={x} y1={4} y2={AXIS_Y} className="cp-rule" />
              <text x={x + 7} y={18} className="cp-label" fill={boundary.color}><title>{boundary.title}</title>{boundary.label}</text>
            </g>
          );
        })}
        <g role="list">
          {segments.map((segment, index) => {
            const position = weightedPositions.get(segment.id)!;
            const x = axisMode === 'distance' ? distanceScale(segment.iosMileStart) : difficultyScale(position.start);
            const end = axisMode === 'distance' ? distanceScale(segment.iosMileEnd) : difficultyScale(position.end);
            const trueWidth = Math.max(0, end - x);
            const status = statuses[segment.id] ?? segment.currentStatus;
            const fill = status === 'no_data' ? 'url(#no-data-hatch)' : STATUS_COLOR_VARS[status];
            const className = `strip-segment ${hoveredId === segment.id ? 'hovered' : ''} ${selectedId === segment.id ? 'selected' : ''}`;
            if (trueWidth < 1.5) {
              return (
                <g key={segment.id}>
                  <line
                    x1={x}
                    x2={x}
                    y1={BAND_TOP}
                    y2={AXIS_Y}
                    stroke={STATUS_COLOR_VARS[status]}
                    strokeWidth="3"
                  />
                  <rect
                    ref={(node) => { rectRefs.current[index] = node; }}
                    {...interactionProps(segment, index)}
                    x={x - 3}
                    y={BAND_TOP}
                    width="6"
                    height={BAND_H}
                    fill="transparent"
                    className={className}
                  />
                </g>
              );
            }
            return (
              <rect
                key={segment.id}
                ref={(node) => { rectRefs.current[index] = node; }}
                {...interactionProps(segment, index)}
                x={x}
                y={BAND_TOP}
                width={trueWidth}
                height={BAND_H}
                fill={fill}
                className={className}
              />
            );
          })}
        </g>
        {segments.flatMap((segment) => segment.structures.map((structure, index) => {
          const x = xForMile((segment.iosMileStart + segment.iosMileEnd) / 2);
          return <line key={`${segment.id}:${structure.name}:${index}`} x1={x} x2={x} y1={TICK_TOP} y2={TICK_BOTTOM} className="structure-tick"><title>{structure.name} — {structureObservationLabel(structure, date)}</title></line>;
        }))}
        {hovered && <line x1={xForMile((hovered.iosMileStart + hovered.iosMileEnd) / 2)} x2={xForMile((hovered.iosMileStart + hovered.iosMileEnd) / 2)} y1={2} y2={AXIS_Y} className="hover-marker" />}
        <line x1={0} x2={width} y1={AXIS_Y} y2={AXIS_Y} className="axis-line" />
        {MILE_TICKS.map((mile) => {
          const x = xForMile(mile);
          return <line key={mile} x1={x} x2={x} y1={AXIS_Y} y2={AXIS_Y + 5} className="axis-line" />;
        })}
        {milepostLabels.map((label) => (
          <text key={label.text} x={label.x} y={LABEL_Y} textAnchor={label.anchor} className="axis-label">{label.text}</text>
        ))}
        {stationLabels.map(({ station, label }) => {
          const x = xForMile(station.iosMile);
          return (
            <g key={station.officialName}>
              <path d={`M ${x - 4} ${AXIS_Y} L ${x + 4} ${AXIS_Y} L ${x} ${AXIS_Y + 7} Z`} className="station-marker" />
              <text x={label.x} y={LABEL_Y} textAnchor={label.anchor} className="station-label">
                {station.label}
                <title>
                  {`${station.officialName}${station.crossStreets ? ` (${station.crossStreets})` : ''} — ${station.officialMp}, ios mile ${station.iosMile.toFixed(2)}`}
                  {station.chordMi >= 0.5
                    ? `; position interpolated across a ${station.chordMi.toFixed(1)} mi gap in the published alignment geometry`
                    : ''}
                </title>
              </text>
            </g>
          );
        })}
      </svg>
      {tooltip && (
        <div className="segment-tooltip" style={{ left: `clamp(var(--space-2), ${tooltip.x}px + var(--space-3), 100% - var(--tooltip-width) - var(--space-2))` }}>
          <strong>{tooltip.segment.label}</strong>
          <span>{tooltip.segment.cp} · {STATUS_LABELS[statuses[tooltip.segment.id] ?? tooltip.segment.currentStatus]}</span>
          <span>Station {tooltip.segment.stationStart?.toLocaleString() ?? 'not published'}–{tooltip.segment.stationEnd?.toLocaleString() ?? 'not published'} ft <SourceLink sourceId={tooltip.segment.stationSourceId} /></span>
          <span>{tooltip.segment.iosMileStart.toFixed(2)}–{tooltip.segment.iosMileEnd.toFixed(2)} ios mi · {tooltip.segment.officialMpStart}–{tooltip.segment.officialMpEnd} <SourceLink sourceId="ts1_alignment" /></span>
          <span>Earthwork completion at selected date {tooltipCompletion === null || tooltipCompletion === undefined ? 'not reported' : `${Math.round(tooltipCompletion * 100)}%`}{tooltipDisagrees ? ' · sources disagree' : ''} <SourceLink sourceId={tooltip.segment.sourceId === 'cvsr' ? 'cvsr' : 'arcgis_progress'} /></span>
          {/* Plain text only: `.segment-tooltip` is `pointer-events: none`, so anchors here
              are unclickable by mouse and unreachable by keyboard. The SegmentDetail panel
              below the fold carries the working evidence and structure links. */}
          {tooltipEvidence && (
            <span>
              Evidence: {tooltipEvidence.label === tooltip.segment.label ? '' : `${tooltipEvidence.label} — `}
              “{tooltipEvidence.quote}” — {evidenceDateLabel(tooltipEvidence)}. {tooltipEvidence.sourceTitle}
            </span>
          )}
          <span>Difficulty share {(tooltip.segment.weightShare * 100).toFixed(2)}% <SourceLink sourceId="bp2026_costs" /></span>
        </div>
      )}
    </div>
  );
}

import { useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { scaleLinear } from 'd3-scale';
import type { AlignmentStatus, Segment } from '../data/types';
import { SOURCES } from '../data/sources';
import { STATUS_COLORS, STATUS_LABELS } from '../lib/status';
import { formatOfficialMp } from '../lib/mileposts';
import { SourceLink } from './Citation';

export type AxisMode = 'distance' | 'difficulty';

const STATIONS = [
  { name: 'Merced', mile: 0, note: 'C 124; station point snaps at iosMile 0' },
  { name: 'Madera', mile: 34, note: 'Station site near CP1 north limit' },
  { name: 'Fresno', mile: 70, note: 'Published S 194 / iosMile 70; GIS station point snaps near geodesic mile 59 — unresolved source discrepancy' },
  { name: 'Kings/Tulare', mile: 115, note: 'Published S 239; station site is 3.05 mi off the built alignment' },
  { name: 'Bakersfield', mile: 171, note: 'S 295 / D 295' },
] as const;

const CP_BOUNDARIES = [
  { label: 'M2M / CVY', mile: 0 },
  { label: 'CP1', mile: 34 },
  { label: 'CP2–3', mile: 65 },
  { label: 'CP4', mile: 131 },
  { label: 'LGA', mile: 152 },
  { label: 'Oswell', mile: 175 },
] as const;

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
  statuses,
  hoveredId,
  selectedId,
  onHover,
  onSelect,
  axisMode,
  onAxisModeChange,
}: {
  segments: Segment[];
  statuses: Record<string, AlignmentStatus>;
  hoveredId: string | null;
  selectedId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string | null) => void;
  axisMode: AxisMode;
  onAxisModeChange: (mode: AxisMode) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const width = Math.max(540, useElementWidth(containerRef));
  const [tooltip, setTooltip] = useState<{ segment: Segment; x: number; y: number } | null>(null);
  const plotLeft = 22;
  const plotRight = width - 22;
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
  const axisTicks = axisMode === 'distance'
    ? Array.from({ length: 18 }, (_, index) => index === 17 ? 171 : index * 10)
    : Array.from({ length: 6 }, (_, index) => index / 5);

  return (
    <section className="strip-section" aria-labelledby="strip-heading">
      <div className="strip-toolbar">
        <div>
          <p className="eyebrow">Primary view · official station axis</p>
          <h2 id="strip-heading">Every mile, by construction phase</h2>
        </div>
        <div className="axis-toggle" role="group" aria-label="Segment width scale">
          <button type="button" className={axisMode === 'distance' ? 'active' : ''} onClick={() => onAxisModeChange('distance')}>Distance</button>
          <button type="button" className={axisMode === 'difficulty' ? 'active' : ''} onClick={() => onAxisModeChange('difficulty')}>Difficulty</button>
        </div>
      </div>
      <div className="strip-canvas" ref={containerRef}>
        <svg viewBox={`0 0 ${width} 190`} role="img" aria-label="Construction status strip from Merced to Oswell Street">
          <defs>
            <pattern id="no-data-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="6" height="6" fill={STATUS_COLORS.no_data} />
              <line x1="0" y1="0" x2="0" y2="6" stroke="#b7b7b7" strokeWidth="2" />
            </pattern>
          </defs>
          {CP_BOUNDARIES.map((boundary) => {
            const x = xForMile(boundary.mile);
            return (
              <g key={boundary.label}>
                <line x1={x} x2={x} y1="28" y2="112" className="cp-rule" />
                <text x={x + 4} y="38" className="cp-label">{boundary.label}</text>
              </g>
            );
          })}
          {segments.map((segment) => {
            const position = weightedPositions.get(segment.id)!;
            const x = axisMode === 'distance' ? distanceScale(segment.iosMileStart) : difficultyScale(position.start);
            const end = axisMode === 'distance' ? distanceScale(segment.iosMileEnd) : difficultyScale(position.end);
            const status = statuses[segment.id] ?? segment.currentStatus;
            return (
              <rect
                key={segment.id}
                x={x}
                y="48"
                width={Math.max(0.75, end - x)}
                height="55"
                fill={status === 'no_data' ? 'url(#no-data-hatch)' : STATUS_COLORS[status]}
                className={`strip-segment ${hoveredId === segment.id ? 'hovered' : ''} ${selectedId === segment.id ? 'selected' : ''}`}
                onPointerEnter={(event) => {
                  onHover(segment.id);
                  const bounds = event.currentTarget.ownerSVGElement!.getBoundingClientRect();
                  setTooltip({ segment, x: event.clientX - bounds.left, y: event.clientY - bounds.top });
                }}
                onPointerMove={(event) => {
                  const bounds = event.currentTarget.ownerSVGElement!.getBoundingClientRect();
                  setTooltip({ segment, x: event.clientX - bounds.left, y: event.clientY - bounds.top });
                }}
                onPointerLeave={() => { onHover(null); setTooltip(null); }}
                onClick={() => onSelect(segment.id)}
              />
            );
          })}
          {segments.flatMap((segment) => segment.structures.map((structure, index) => {
            const x = xForMile((segment.iosMileStart + segment.iosMileEnd) / 2);
            return <line key={`${segment.id}:${structure.name}:${index}`} x1={x} x2={x} y1="43" y2="48" className="structure-tick"><title>{structure.name} — {structure.status}</title></line>;
          }))}
          {hovered && <line x1={xForMile((hovered.iosMileStart + hovered.iosMileEnd) / 2)} x2={xForMile((hovered.iosMileStart + hovered.iosMileEnd) / 2)} y1="22" y2="120" className="hover-marker" />}
          <line x1={plotLeft} x2={plotRight} y1="120" y2="120" className="axis-line" />
          {axisTicks.map((tick) => {
            const x = axisMode === 'distance' ? distanceScale(tick) : difficultyScale(tick);
            const label = axisMode === 'distance' ? `${tick} / ${formatOfficialMp(tick)}` : `${Math.round(tick * 100)}%`;
            return (
              <g key={tick}>
                <line x1={x} x2={x} y1="120" y2="126" className="axis-line" />
                <a href={axisMode === 'distance' ? SOURCES.ts1_alignment.url : SOURCES.business_plan_2026.url} target="_blank" rel="noreferrer">
                  <text x={x} y="140" className="axis-label" textAnchor="middle">{label}†</text>
                </a>
              </g>
            );
          })}
          {STATIONS.map((station) => {
            const x = xForMile(station.mile);
            return (
              <g key={station.name}>
                <path d={`M ${x - 4} 107 L ${x + 4} 107 L ${x} 114 Z`} className="station-marker" />
                <a href={SOURCES.arcgis_stations.url} target="_blank" rel="noreferrer"><text x={x} y="162" className="station-label" textAnchor="middle">{station.name}†<title>{station.note}</title></text></a>
              </g>
            );
          })}
          <text x={plotLeft} y="182" className="axis-caption">{axisMode === 'distance' ? 'iosMile / published subdivision milepost' : 'cumulative share of modelled engineering effort'}</text>
        </svg>
        {tooltip && (
          <div className="segment-tooltip" style={{ left: Math.min(width - 300, Math.max(8, tooltip.x + 12)), top: Math.max(4, tooltip.y - 126) }}>
            <strong>{tooltip.segment.label}</strong>
            <span>{tooltip.segment.cp} · {STATUS_LABELS[statuses[tooltip.segment.id] ?? tooltip.segment.currentStatus]}</span>
            <span>Station {tooltip.segment.stationStart?.toLocaleString() ?? 'not published'}–{tooltip.segment.stationEnd?.toLocaleString() ?? 'not published'} ft <SourceLink sourceId={tooltip.segment.sourceId} /></span>
            <span>{tooltip.segment.iosMileStart.toFixed(2)}–{tooltip.segment.iosMileEnd.toFixed(2)} ios mi · {tooltip.segment.officialMpStart}–{tooltip.segment.officialMpEnd} <SourceLink sourceId="ts1_alignment" /></span>
            <span>Current earthwork completion {tooltip.segment.completion === null ? 'not reported' : `${Math.round(tooltip.segment.completion * 100)}%`} <SourceLink sourceId="arcgis_progress" /></span>
            <span>Difficulty share {(tooltip.segment.weightShare * 100).toFixed(2)}% <SourceLink sourceId="business_plan_2026" /></span>
            {tooltip.segment.structures.map((structure) => <a key={structure.name} href={structure.url} target="_blank" rel="noreferrer">{structure.name} — {structure.status}†</a>)}
          </div>
        )}
      </div>
      {axisMode === 'difficulty' && (
        <p className="model-caption">Segment widths scaled by an unofficial difficulty model (earthwork quantities are official CAHSRA data; structure type factors are this dashboard’s own estimate, calibrated to published per-package contract values). The Authority’s own progress measures are miles of guideway and structure counts. <SourceLink sourceId="arcgis_progress" /> <SourceLink sourceId="cvsr" /> <SourceLink sourceId="business_plan_2026" /></p>
      )}
    </section>
  );
}

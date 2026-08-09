import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { MapGeoJSONFeature } from 'maplibre-gl';
import type { FeatureCollection, LineString } from 'geojson';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { AlignmentStatus } from '../data/types';
import { STATUS_COLORS } from '../lib/status';
maplibregl.setWorkerUrl(`${import.meta.env.BASE_URL}vendor/maplibre-gl-worker.mjs`);


export type SegmentFeatureCollection = FeatureCollection<LineString, {
  id: string;
  cp: string;
  status: AlignmentStatus;
}>;

export function AlignmentMap({
  data,
  statuses,
  hoveredId,
  selectedId,
  onHover,
  onSelect,
}: {
  data: SegmentFeatureCollection;
  statuses: Record<string, AlignmentStatus>;
  hoveredId: string | null;
  selectedId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const readyRef = useRef(false);
  const priorHoverRef = useRef<string | null>(null);
  const priorSelectedRef = useRef<string | null>(null);
  const statusesRef = useRef(statuses);
  statusesRef.current = statuses;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://tiles.openfreemap.org/styles/positron',
      center: [-119.73, 36.35],
      zoom: 6.55,
      // The OpenFreeMap style JSON carries no `attribution` field, so MapLibre would
      // otherwise credit only itself. Supplying `customAttribution` replaces MapLibre's
      // default entry, hence the explicit MapLibre item below.
      attributionControl: {
        compact: false,
        customAttribution: [
          '<a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a>',
          '\u00a9 <a href="https://www.openmaptiles.org/" target="_blank" rel="noreferrer">OpenMapTiles</a>',
          'Data from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
          '<a href="https://maplibre.org/" target="_blank" rel="noreferrer">MapLibre</a>',
        ],
      },
    });
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-left');
    mapRef.current = map;

    map.on('load', () => {
      map.addSource('alignment', { type: 'geojson', data, promoteId: 'id' });
      map.addLayer({
        id: 'alignment-casing',
        type: 'line',
        source: 'alignment',
        layout: { 'line-cap': 'butt', 'line-join': 'round' },
        paint: {
          'line-color': '#172b32',
          'line-opacity': ['case', ['boolean', ['feature-state', 'selected'], false], 0.95, ['boolean', ['feature-state', 'hover'], false], 0.8, 0],
          'line-width': ['interpolate', ['linear'], ['zoom'], 6, 5, 12, 11],
        },
      });
      map.addLayer({
        id: 'alignment-status',
        type: 'line',
        source: 'alignment',
        layout: { 'line-cap': 'butt', 'line-join': 'round' },
        paint: {
          'line-width': ['interpolate', ['linear'], ['zoom'], 6, 2.5, 12, 7],
          'line-color': [
            'match', ['feature-state', 'status'],
            'preconstruction', STATUS_COLORS.preconstruction,
            'under_construction', STATUS_COLORS.under_construction,
            'structure_complete', STATUS_COLORS.structure_complete,
            'guideway_complete', STATUS_COLORS.guideway_complete,
            'track_laid', STATUS_COLORS.track_laid,
            'systems_installed', STATUS_COLORS.systems_installed,
            'not_started', STATUS_COLORS.not_started,
            STATUS_COLORS.no_data,
          ],
        },
      });
      for (const [id, status] of Object.entries(statusesRef.current)) {
        map.setFeatureState({ source: 'alignment', id }, { status });
      }
      readyRef.current = true;
    });

    const featureId = (feature: MapGeoJSONFeature | undefined): string | null => {
      if (!feature) return null;
      return typeof feature.properties.id === 'string' ? feature.properties.id : String(feature.id ?? '') || null;
    };
    map.on('mousemove', 'alignment-status', (event) => {
      map.getCanvas().style.cursor = 'pointer';
      onHover(featureId(event.features?.[0]));
    });
    map.on('mouseleave', 'alignment-status', () => {
      map.getCanvas().style.cursor = '';
      onHover(null);
    });
    map.on('click', 'alignment-status', (event) => onSelect(featureId(event.features?.[0])));

    return () => {
      readyRef.current = false;
      map.remove();
      mapRef.current = null;
    };
  }, [data, onHover, onSelect]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    for (const [id, status] of Object.entries(statuses)) map.setFeatureState({ source: 'alignment', id }, { status });
  }, [statuses]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    if (priorHoverRef.current) map.setFeatureState({ source: 'alignment', id: priorHoverRef.current }, { hover: false });
    if (hoveredId) map.setFeatureState({ source: 'alignment', id: hoveredId }, { hover: true });
    priorHoverRef.current = hoveredId;
  }, [hoveredId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    if (priorSelectedRef.current) map.setFeatureState({ source: 'alignment', id: priorSelectedRef.current }, { selected: false });
    if (!selectedId) return;
    map.setFeatureState({ source: 'alignment', id: selectedId }, { selected: true });
    priorSelectedRef.current = selectedId;
    const feature = data.features.find((candidate) => candidate.properties.id === selectedId);
    if (!feature) return;
    const bounds = new maplibregl.LngLatBounds();
    for (const coordinate of feature.geometry.coordinates) bounds.extend(coordinate as [number, number]);
    map.fitBounds(bounds, { padding: 72, maxZoom: 11, duration: 650 });
  }, [data, selectedId]);

  return (
    <section className="map-section" aria-labelledby="map-heading">
      <div className="map-title">
        <div>
          <p className="eyebrow">Geographic context</p>
          <h2 id="map-heading">Central Valley alignment</h2>
        </div>
        <span>Hover to link · click to focus</span>
      </div>
      <div
        ref={containerRef}
        className="map-container"
        aria-label="Alignment map; the strip chart above carries the same data in keyboard-accessible form"
      />
    </section>
  );
}

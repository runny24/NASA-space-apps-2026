// The map. React owns the page; MapLibre owns this one <div>. Props say what should be on the map
// and the effects below make MapLibre match, through DataLayerController.

import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState, type Ref } from 'react';
import type { Map as MapLibreMap, Marker } from 'maplibre-gl';
import type { Site } from '../contract/manifest';
import { DataLayerController, type ActiveLayer, type PictureOnMap } from '../map/dataLayers';
import { wrapLongitude } from '../map/geo';
import { followDevice } from '../map/gestures';
import { fileLabel, type MapErrorReport } from '../map/mapErrors';
import { maplibregl } from '../map/maplibre';
import { OverlayController, type OverlayOnMap } from '../map/overlayLayers';

// OpenFreeMap needs no key. "positron" is a quiet grey basemap that lets the radar stand out, and
// unlike "liberty" it loads without console warnings under MapLibre 6.18 (research/digests/browser.md, fact F32).
export const BASEMAP_STYLE = 'https://tiles.openfreemap.org/styles/positron';

/**
 * What a screen reader says when keyboard focus lands on the map (MapLibre's default is just
 * "Map"), so the keyboard way to read values is found where it is needed. The arrow keys and
 * plus/minus are MapLibre's own keyboard controls.
 */
export const MAP_CANVAS_LABEL =
  'Map. Arrow keys move it, plus and minus zoom. To read the values in the middle of the map, use the button "Read values at the map centre".';

export interface MapViewState {
  lon: number;
  lat: number;
  zoom: number;
}

export interface MapHandle {
  /** The map's centre and zoom (the zoom says how far a pixel reaches, for picking a point). */
  center(): { lon: number; lat: number; zoom: number } | null;
  /** The map itself, once it exists, for the guided story (story/stage.ts is what it does to it). */
  map(): MapLibreMap | null;
}

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** The class that spreads one ring from the marker where it is placed (styles/motion.css). */
const MARKER_RING_CLASS = 'point-marker-ring';

/**
 * One ring from the marker, from its start even when the last one is still spreading; none with
 * reduced motion (read now, not when the map was made). The ring carries no value: it says where.
 */
function ringOnce(element: HTMLElement) {
  element.classList.remove(MARKER_RING_CLASS);
  if (prefersReducedMotion()) return;
  // Reading the layout applies the removal, so that adding the class again starts the animation again.
  element.getBoundingClientRect();
  element.classList.add(MARKER_RING_CLASS);
}

interface MapViewProps {
  site: Site | null;
  initialView: MapViewState | null;
  active: ActiveLayer | null;
  itemIndex: number;
  opacity: number;
  marker: { lon: number; lat: number } | null;
  /** What the map draws of each overlay that is switched on and loaded. */
  overlays: readonly OverlayOnMap[];
  onClick: (lon: number, lat: number, zoom: number) => void;
  onViewChange: (view: MapViewState) => void;
  /** A problem drawing the map, or null when a new layer starts loading. */
  onError: (report: MapErrorReport | null) => void;
  /** The map has drawn the picture of this item (null: the picture is changing). */
  onDrawn?: (itemIndex: number | null) => void;
  /** The picture on the map now, which may still be the previous date's while a new one loads (null: none). */
  onPictureShown?: (picture: PictureOnMap | null) => void;
  /**
   * The map has framed this site (its first framing, and every change of site). The guided story
   * takes the camera only after it: this framing runs when the style is ready and would overwrite an
   * earlier move.
   */
  onFramed?: (siteId: string) => void;
  ref?: Ref<MapHandle>;
}

export function MapView({
  site,
  initialView,
  active,
  itemIndex,
  opacity,
  marker,
  overlays,
  onClick,
  onViewChange,
  onError,
  onDrawn,
  onPictureShown,
  onFramed,
  ref,
}: MapViewProps) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const controllerRef = useRef<DataLayerController | null>(null);
  const overlayRef = useRef<OverlayController | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const usedInitialView = useRef(false);
  const [ready, setReady] = useState(false);
  // The latest callbacks and values, read by map event handlers and by effects that must not re-run
  // when only these change (the map is created once, not once per new closure).
  const latest = useRef({ onClick, onViewChange, onError, onDrawn, onPictureShown, onFramed, site, initialView, itemIndex, opacity });
  useEffect(() => {
    latest.current = { onClick, onViewChange, onError, onDrawn, onPictureShown, onFramed, site, initialView, itemIndex, opacity };
  });

  useImperativeHandle(ref, () => ({
    center: () => {
      // Wrapped: after panning onto a neighbouring copy of the world the map reports longitudes
      // such as 242, which no data file covers.
      const map = mapRef.current;
      if (!map) return null;
      const c = map.getCenter();
      return { lon: wrapLongitude(c.lng), lat: c.lat, zoom: map.getZoom() };
    },
    map: () => mapRef.current,
  }));

  useEffect(() => {
    if (!container.current) return;
    const map = new maplibregl.Map({
      container: container.current,
      style: BASEMAP_STYLE,
      center: [0, 20],
      zoom: 1.5,
      attributionControl: { compact: true },
      // Kept flat (no tilt by right-drag, Ctrl+drag, two fingers or Shift+arrows): the search for the
      // overlay point nearest a click (map/nearestPoint.ts) takes a screen pixel to be the same
      // distance everywhere on the map, which a tilted map breaks.
      maxPitch: 0,
      locale: { 'Map.Title': MAP_CANVAS_LABEL },
    });
    // On a phone one finger scrolls the page past the map and two fingers move it; with a mouse the
    // wheel keeps zooming (map/gestures.ts says who gets which).
    const stopFollowingDevice = followDevice(map.cooperativeGestures, (query) => window.matchMedia(query));
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    // Bottom-right, stacked above the attribution, so the two never overlap on a phone.
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-right');
    map.on('click', (e) => latest.current.onClick(wrapLongitude(e.lngLat.lng), e.lngLat.lat, map.getZoom()));
    map.on('moveend', () => {
      const c = map.getCenter();
      latest.current.onViewChange({ lon: wrapLongitude(c.lng), lat: c.lat, zoom: map.getZoom() });
    });
    map.on('error', (e) => {
      // Name the data file when the problem is about one of ours; "Request failed" alone does not
      // tell the builder which file to fix.
      const message = e.error?.message ?? 'Map error';
      const url = controllerRef.current?.urlForSource((e as { sourceId?: string }).sourceId);
      latest.current.onError(url ? { message: `Could not load ${fileLabel(url)}: ${message}`, url } : { message });
    });
    map.once('load', () => setReady(true));
    mapRef.current = map;
    const controller = new DataLayerController(
      map,
      (report) => latest.current.onError(report),
      (index) => latest.current.onDrawn?.(index),
      (picture) => latest.current.onPictureShown?.(picture),
    );
    controllerRef.current = controller;
    overlayRef.current = new OverlayController(map);
    // A handle for the end-to-end test and for debugging in the browser console.
    (window as unknown as { __map?: MapLibreMap }).__map = map;
    return () => {
      stopFollowingDevice();
      controller.dispose();
      controllerRef.current = null;
      overlayRef.current = null;
      mapRef.current = null;
      setReady(false);
      map.remove();
    };
  }, []);

  // Frame the site whenever a different site is chosen. The URL's view wins on first load only.
  const siteId = site?.id;
  useEffect(() => {
    const map = mapRef.current;
    const { site: current, initialView: initial } = latest.current;
    if (!ready || !map || !current) return;
    if (initial && !usedInitialView.current) {
      map.jumpTo({ center: [initial.lon, initial.lat], zoom: initial.zoom });
    } else if (current.view) {
      map.jumpTo({ center: current.view.center, zoom: current.view.zoom });
    } else {
      const [w, s, e, n] = current.bounds;
      // The first framing jumps (an animation from the world view is easily cut short by an early
      // click); later site changes glide, unless the person prefers reduced motion.
      map.fitBounds([w, s, e, n], { padding: 40, animate: usedInitialView.current && !prefersReducedMotion() });
    }
    usedInitialView.current = true;
    latest.current.onFramed?.(current.id);
  }, [ready, siteId]);

  // Swap the data layer when the layer changes; switch dates when only the item changes.
  useEffect(() => {
    if (!ready || !controllerRef.current) return;
    void controllerRef.current.setLayer(active, latest.current.itemIndex, latest.current.opacity);
  }, [ready, active]);
  useEffect(() => {
    controllerRef.current?.show(itemIndex);
  }, [itemIndex]);
  useEffect(() => {
    controllerRef.current?.setOpacity(opacity);
  }, [opacity]);
  // Overlays: added, refiltered (when the date or the day reached changes) and removed to match the
  // props. A layout effect, so the map's filter changes in the same commit as the caption that
  // counts the same window: the count on screen is never a step ahead of the dots.
  useLayoutEffect(() => {
    if (ready) overlayRef.current?.set(overlays);
  }, [ready, overlays]);

  // A marker where the person last clicked, so the readout has a visible anchor.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    if (!marker) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    if (!markerRef.current) markerRef.current = new maplibregl.Marker({ color: '#ffb000', className: 'point-marker' });
    markerRef.current.setLngLat([marker.lon, marker.lat]).addTo(map);
    ringOnce(markerRef.current.getElement());
  }, [ready, marker]);

  return (
    <div
      id="map"
      ref={container}
      role="region"
      aria-label='Map. Click to read values at a point, or use the button "Read values at the map centre".'
    />
  );
}

// The whole app: loads the manifest, holds what is selected, and lays out map and panels.
// Logic lives in plain functions (src/contract, src/state, src/map); this file wires them together.
// The guided story (src/story, web/MOTION.md) is owned here through useStory: it sets the same
// selection the tool does, so the URL, the layers, the overlays and their captions follow by themselves.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BRANDING } from './branding';
import { loadManifest, manifestUrl, resolveDataUrl, type Manifest } from './contract/manifest';
import { inspectPoint, itemWhen, type InspectResult } from './map/inspect';
import type { ActiveLayer, PictureOnMap } from './map/dataLayers';
import { rememberMapError, selectionKey, visibleMapError, type MapErrorReport, type StoredMapError } from './map/mapErrors';
import { nearestPoint } from './map/nearestPoint';
import { DEFAULT_OVERLAY_COLOR, overlayFilter, overlayMapData, type OverlayOnMap } from './map/overlayLayers';
import { overlayView, pointReading } from './state/overlayView';
import { canPlay, wantsAutoplay } from './state/playback';
import { buildTimeline, stepDate } from './state/timeline';
import { curveSeries, timelineCurve } from './state/timelineCurve';
import { defaultSite, parseUrlState, resolveSelection, selectionToUrlState, serializeUrlState, siteOverlays, type Selection } from './state/urlState';
import { DateStamp } from './story/DateStamp';
import { StoryBoundary, useStoryFocus } from './story/Story';
import { StoryCover } from './story/StoryCover';
import { StoryCurve } from './story/StoryCurve';
import { StoryPanel } from './story/StoryPanel';
import { sameSelection } from './story/storyModel';
import { storyQuery } from './story/storyUrl';
import { useStory } from './story/useStory';
import { AboutDialog } from './components/AboutDialog';
import { DateStepper, LayerPicker, OpacityControl, PairPicker, SitePicker, StaticLayerNote } from './components/Controls';
import { crashContext } from './components/ErrorBoundary';
import { InspectPanel, type InspectState } from './components/InspectPanel';
import { Legend } from './components/Legend';
import { OverlayMapCaption, OverlaySwitches } from './components/Overlays';
import { useOverlayFiles } from './components/useOverlayFiles';
import { MapView, prefersReducedMotion, type MapHandle, type MapViewState } from './components/MapView';
import { PictureLoading, PictureShown, pictureLoadingNote, pictureShownText } from './components/PictureLoading';
import { MIXED_RELEASE_WARNING, StatsPanel } from './components/StatsPanel';
import { usePlayback } from './components/usePlayback';
import { useStats } from './components/useStats';
import { CAPTION_UNDER_MAP_QUERY, NOTES_UNDER_MAP_QUERY, useMediaQuery } from './components/useMediaQuery';

const NO_OVERLAYS: string[] = [];

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; manifest: Manifest };

const MANIFEST_HREF = manifestUrl({
  baseURI: document.baseURI,
  search: window.location.search,
  envUrl: import.meta.env.VITE_MANIFEST_URL as string | undefined,
  dev: import.meta.env.DEV,
});

/** Change what is shown, and tell the crash page which sample notice it must keep on screen. */
function noteSelection(sel: Selection | null): Selection | null {
  crashContext.sampleNotice = sel?.site.is_sample ? (sel.site.notice ?? '') : null;
  return sel;
}

/** Arrow keys belong to these elements (text fields, sliders, menus, the map's own panning). */
function arrowKeysTaken(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.closest('.maplibregl-map')) return true;
  return target.matches('input, select, textarea, [contenteditable="true"]');
}

export function App() {
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [selection, setSelection] = useState<Selection | null>(null);
  const [opacity, setOpacity] = useState(1);
  // Where the person last asked for a reading, and the map's zoom then (how far a pixel reached).
  const [point, setPoint] = useState<{ lon: number; lat: number; zoom: number } | null>(null);
  const [inspected, setInspected] = useState<{ key: string; pointKey: string; result: InspectResult } | null>(null);
  const [mapErrors, setMapErrors] = useState<StoredMapError[]>([]);
  const [aboutOpen, setAboutOpen] = useState(false);
  const mapHandle = useRef<MapHandle>(null);
  // Read once: the view a shared link asks for.
  const [initialUrl] = useState(() => parseUrlState(window.location.search));
  const initialView = useMemo<MapViewState | null>(
    () =>
      initialUrl.lon !== undefined && initialUrl.lat !== undefined && initialUrl.zoom !== undefined
        ? { lon: initialUrl.lon, lat: initialUrl.lat, zoom: initialUrl.zoom }
        : null,
    [initialUrl],
  );
  const view = useRef<MapViewState | null>(initialView);
  // play=1 in the link opens playing (for a shared link or a screen recording). Read once, never
  // written back (urlState.ts drops it), and ignored when the person asks for reduced motion.
  const autoplayPending = useRef(wantsAutoplay(window.location.search, prefersReducedMotion()));

  const site = selection?.site ?? null;
  const layer = selection?.layer ?? null;
  const itemIndex = selection?.itemIndex ?? -1;

  const citation = site?.source.citation;
  const active = useMemo<ActiveLayer | null>(
    () =>
      layer
        ? {
            layer,
            urls: layer.items.map((it) => resolveDataUrl(it.url, MANIFEST_HREF)),
            ...(citation ? { attribution: citation } : {}),
          }
        : null,
    [layer, citation],
  );

  // A map problem is shown only while it is about what is on screen (see map/mapErrors.ts).
  const screenKey = selectionKey(site?.id, layer?.id, itemIndex);
  const screenKeyRef = useRef(screenKey);
  useEffect(() => {
    screenKeyRef.current = screenKey;
  });
  const onMapError = useCallback((report: MapErrorReport | null) => {
    setMapErrors((stored) => (report ? rememberMapError(stored, report, screenKeyRef.current) : []));
  }, []);
  const mapError = visibleMapError(mapErrors, active?.urls[itemIndex], screenKey);
  const timeline = useMemo(() => (site && layer?.kind === 'per-date' ? buildTimeline(site, layer) : []), [site, layer]);
  // The site's stats.json, read once per site and shared by the Statistics panel and the year's curve
  // (the layer's dB series above the timeline's marks, and as a story step's figure).
  const stats = useStats(site?.stats ? resolveDataUrl(site.stats, MANIFEST_HREF) : null);
  const yearSeries = useMemo(() => curveSeries(stats?.stats, layer), [stats, layer]);
  const yearCurve = useMemo(() => (yearSeries ? timelineCurve(timeline, yearSeries.points) : null), [yearSeries, timeline]);

  const selectItem = useCallback((index: number) => {
    setSelection((sel) => (sel && index >= 0 ? { ...sel, itemIndex: index } : sel));
  }, []);
  const playback = usePlayback(timeline, itemIndex, selectItem);
  const { play, stop, toggle, onDrawn: playbackOnDrawn } = playback;
  // What the person does with the playback, the dates, the layer or the place also cancels a play=1
  // still waiting for the first picture (see the effect below), so it cannot start after them.
  const stopPlayback = useCallback(() => {
    autoplayPending.current = false;
    stop();
  }, [stop]);
  const togglePlayback = useCallback(() => {
    autoplayPending.current = false;
    toggle();
  }, [toggle]);

  // The guided story. It shows a step by setting the selection, as the tool does, after stopping the
  // tool's playback; it takes the camera only once MapView has framed the site (onFramed).
  const [framedSite, setFramedSite] = useState<string | null>(null);
  const getMap = useCallback(() => mapHandle.current?.map() ?? null, []);
  const applyStorySelection = useCallback(
    (next: Selection) => {
      stopPlayback();
      noteSelection(next);
      setSelection((sel) => (sameSelection(sel, next) ? sel : next));
    },
    [stopPlayback],
  );
  // What the story's sequences wait for, and what its cover needs to know: the picture on the map as
  // the map reports it (while a new date loads, still the previous one; the tag on the map and the
  // story's stamp name it, never the date chosen), the files of the overlays that are switched on,
  // and whether the layout is stacked (a phone: the cover's words are then under the map, not on it).
  const [pictureShown, setPictureShown] = useState<PictureOnMap | null>(null);
  const overlaysOn = selection?.overlays ?? NO_OVERLAYS;
  const { loadOf } = useOverlayFiles(site, overlaysOn, MANIFEST_HREF);
  const notesUnderMap = useMediaQuery(NOTES_UNDER_MAP_QUERY);
  const captionUnderMap = useMediaQuery(CAPTION_UNDER_MAP_QUERY);
  const stacked = captionUnderMap;
  const story = useStory({
    manifest: load.status === 'ready' ? load.manifest : null,
    site,
    framedSite,
    getMap,
    apply: applyStorySelection,
    aboutOpen,
    picture: pictureShown,
    loadOf,
    coverOnMap: !stacked,
  });
  const storyShown = story.status !== 'closed';
  useStoryFocus(story.status, story.run);
  // When the story takes the map, the tool's layer opacity goes back to 100 % and its reading marker
  // and reading are cleared, so the story's pictures are never shown faint or under a pin. (Adjusted
  // while rendering, as React advises for state that follows another, not in an effect.)
  const [storyWasShown, setStoryWasShown] = useState(storyShown);
  if (storyWasShown !== storyShown) {
    setStoryWasShown(storyShown);
    if (storyShown) {
      setOpacity(1);
      setPoint(null);
    }
  }

  // The first selection after the manifest arrives is already the opening step's when the address
  // asks for the story (story.arrive), so no other date's picture is fetched or shown before it.
  const { arrive: storyArrive, fail: storyFail } = story;
  useEffect(() => {
    loadManifest(MANIFEST_HREF)
      .then((manifest) => {
        setLoad({ status: 'ready', manifest });
        setSelection(noteSelection(storyArrive(manifest, resolveSelection(manifest, initialUrl))));
      })
      .catch((err: unknown) => {
        setLoad({ status: 'error', message: err instanceof Error ? err.message : String(err) });
        storyFail();
      });
  }, [initialUrl, storyArrive, storyFail]);

  // Keep the URL in step with what is on screen. replaceState, so Back leaves the app instead of
  // replaying every click. While the story is open the link names the step (story=<id>) and no
  // selection, so a reload comes back to the same step; the site only when it is not the one a bare
  // address opens.
  const storyStepId = story.status === 'open' ? (story.step?.id ?? null) : null;
  const storySiteParam = story.site && load.status === 'ready' && defaultSite(load.manifest)?.id !== story.site.id ? story.site.id : null;
  const writeUrl = useCallback(() => {
    if (!selection) return; // nothing loaded yet: leave the link as it arrived
    const query =
      storyStepId !== null
        ? storyQuery(storyStepId, storySiteParam, window.location.search)
        : serializeUrlState({ ...selectionToUrlState(selection), ...view.current }, window.location.search);
    window.history.replaceState(null, '', `${window.location.pathname}${query}${window.location.hash}`);
  }, [selection, storyStepId, storySiteParam]);
  useEffect(writeUrl, [writeUrl]);
  const onViewChange = useCallback(
    (v: MapViewState) => {
      view.current = v;
      writeUrl();
    },
    [writeUrl],
  );
  // Which item the map has drawn (null while the picture changes): playback waits for it, and the
  // map says "Loading the picture" until it is the item chosen.
  const [drawnItem, setDrawnItem] = useState<number | null>(null);
  const onDrawn = useCallback(
    (index: number | null) => {
      setDrawnItem(index);
      playbackOnDrawn(index);
    },
    [playbackOnDrawn],
  );
  const loadingNote = pictureLoadingNote({ layer, itemIndex, drawnItem, hasError: mapError !== null });
  // The tag on the map names the picture the map has drawn (components/PictureLoading.tsx).
  const pictureTag = <PictureShown text={pictureShownText(pictureShown, layer !== null)} />;

  // Overlays (data from other sources): the ones switched on (their files are read above), and what
  // each shows with what is on screen (state/overlayView.ts). The caption's count and the map's
  // filter come from the same window; while the story builds an overlay up day by day, that window
  // is capped at the day reached (story.capOf), for both.
  const { capOf: storyCapOf } = story;
  const overlayViews = useMemo(
    () =>
      (site?.overlays ?? [])
        .filter((o) => overlaysOn.includes(o.id))
        .map((o) => overlayView(o, loadOf(o), layer, itemIndex, DEFAULT_OVERLAY_COLOR, storyCapOf(o.id))),
    [site, overlaysOn, loadOf, layer, itemIndex, storyCapOf],
  );
  const mapOverlays = useMemo<OverlayOnMap[]>(
    () =>
      overlayViews.flatMap((v) => {
        const load = loadOf(v.overlay);
        if (load?.status !== 'ready') return [];
        return [{ id: v.overlay.id, data: overlayMapData(load.loaded), color: v.color, credit: v.overlay.credit, filter: overlayFilter(v.window) }];
      }),
    [overlayViews, loadOf],
  );
  // The nearest drawn point of each overlay to where the person asked for a reading.
  const overlayReadings = useMemo(
    () =>
      point
        ? overlayViews.flatMap((v) => {
            const found = nearestPoint(point, v.drawn, point.zoom);
            return found ? [pointReading(v.overlay, found.point, found.withinReach)] : [];
          })
        : [],
    [point, overlayViews],
  );
  const toggleOverlay = (id: string, on: boolean) => {
    setSelection((sel) =>
      sel ? { ...sel, overlays: siteOverlays(sel.site, on ? [...sel.overlays, id] : sel.overlays.filter((x) => x !== id)) } : sel,
    );
  };
  // Anything the person does with the dates, the layer or the place stops playback.
  const chooseItem = useCallback(
    (index: number) => {
      stopPlayback();
      selectItem(index);
    },
    [stopPlayback, selectItem],
  );
  const selectSite = (id: string) => {
    if (load.status !== 'ready') return;
    stopPlayback();
    setSelection(noteSelection(resolveSelection(load.manifest, { site: id })));
    setPoint(null);
  };
  const selectLayer = (id: string) => {
    if (load.status !== 'ready' || !site) return;
    stopPlayback();
    // Keep the date or pair when the new layer has it too.
    setSelection(noteSelection(resolveSelection(load.manifest, { ...(selection ? selectionToUrlState(selection) : {}), layer: id })));
  };

  // Left and right arrow keys step through the dates of a per-date layer (not while the story is
  // open or loading: its keys are its own, story/useStory.ts).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') || e.altKey || e.ctrlKey || e.metaKey) return;
      if (timeline.length === 0 || arrowKeysTaken(e.target) || aboutOpen || storyShown) return;
      const next = stepDate(timeline, itemIndex, e.key === 'ArrowLeft' ? -1 : 1);
      if (next >= 0) {
        e.preventDefault();
        chooseItem(next);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [timeline, itemIndex, chooseItem, aboutOpen, storyShown]);

  // A link with play=1 starts playing once the map has drawn the picture the layer opened with, if
  // it can play: so the start of the map (the basemap, the file's header, its tiles) does not count
  // against the first date's time on screen, and a slow connection shows that date before playback
  // moves on. Anything the person does first cancels it (stopPlayback, togglePlayback).
  useEffect(() => {
    if (!autoplayPending.current || load.status !== 'ready' || drawnItem === null || drawnItem !== itemIndex) return;
    autoplayPending.current = false;
    if (canPlay(timeline)) play();
  }, [load.status, drawnItem, itemIndex, timeline, play]);

  // Read the values at the chosen point, again whenever the layer or date changes. The key says
  // which request a result belongs to, so a slow old answer is never shown for a newer click.
  // pointKey leaves out the date: the history at a point depends on the place, the layer and the
  // point, not on the date shown, so while another date's value is read it stays on screen.
  const pointKey = point && site ? `${site.id}|${layer?.id}|${point.lon}|${point.lat}` : null;
  const inspectKey = pointKey !== null ? `${pointKey}|${itemIndex}` : null;
  useEffect(() => {
    if (!inspectKey || !pointKey || !point || !site) return;
    let alive = true;
    inspectPoint({ site, layer, itemIndex, manifestHref: MANIFEST_HREF, ...point }).then((result) => {
      if (alive) setInspected({ key: inspectKey, pointKey, result });
    });
    return () => {
      alive = false;
    };
  }, [inspectKey, pointKey, point, site, layer, itemIndex]);
  const inspect: InspectState = !point
    ? { status: 'idle' }
    : inspected?.key === inspectKey
      ? { status: 'done', result: inspected.result }
      : inspected?.pointKey === pointKey && layer
        ? { status: 'updating', result: inspected.result, when: itemWhen(layer, layer.items[itemIndex]) }
        : { status: 'loading', ...point };

  // What the map shows (the tag), what the overlay's dots are, then the loading note: on the map,
  // top left, clear of its own buttons. On a short map the loading note goes in a strip right under
  // it, where nothing cuts it off; on a phone (any height) the caption goes in that strip, never over
  // the dots it counts. The tag (one short line that takes no taps) stays on the map at every size.
  // (notesUnderMap, captionUnderMap and stacked are read above, with the story.)
  // While the story is not closed its date stamp is the tag, from the same report, so there is never
  // a second one: on a desktop where the tag is, first in the notes on the map (top left, clear of
  // MapLibre's controls and its credit line, which runs along the bottom while the story keeps the
  // map still); in the stacked layout (a phone) in a strip under the map, where nothing of the story
  // lies on the map.
  const stamp = (under: boolean) => (
    <StoryBoundary onError={story.exit}>
      <DateStamp shown={pictureShown} layerChosen={layer !== null} under={under} />
    </StoryBoundary>
  );
  // The cover (from the first frame when the bare address asks for it): on a desktop over the map.
  const coverShown = (story.status === 'pending' && story.intent.kind === 'cover') || (story.status === 'open' && story.index === 0);
  const mapNotes = (under: boolean) => (
    <div className={under ? 'map-notes map-notes-under' : 'map-notes'} data-testid={under ? 'map-notes-under' : 'map-notes'}>
      {!under && (storyShown ? !stacked && stamp(false) : pictureTag)}
      {captionUnderMap === under && <OverlayMapCaption views={overlayViews} />}
      {notesUnderMap === under && <PictureLoading note={loadingNote} />}
    </div>
  );

  const onMapClick = useCallback((lon: number, lat: number, zoom: number) => setPoint({ lon, lat, zoom }), []);
  const onInspectCentre = () => {
    const c = mapHandle.current?.center();
    if (c) setPoint(c);
  };

  return (
    <div className="app" data-story={storyShown ? story.status : undefined}>
      <header className="header">
        <div className="brand">
          <h1>{BRANDING.name}</h1>
          <p className="tagline">{BRANDING.tagline}</p>
        </div>
        <div className="header-actions">
          <button type="button" className="secondary" onClick={() => setAboutOpen(true)}>
            About
          </button>
          {story.available && (
            <button type="button" className="secondary" data-testid="story-open" onClick={story.open}>
              Story
            </button>
          )}
        </div>
      </header>
      {/* The story's one live region, always in the page: the step on entering it, then "Exploring the map". */}
      <p className="visually-hidden" role="status" aria-live="polite" data-testid="story-status">
        {story.announcement}
      </p>
      {site?.is_sample && (
        <div className="notice" role="note" data-testid="sample-notice">
          <strong>Sample data:</strong> {site.notice}
        </div>
      )}
      <main className="main">
        <div className="map-wrap">
          <MapView
            ref={mapHandle}
            site={site}
            initialView={initialView}
            active={active}
            itemIndex={itemIndex}
            opacity={opacity}
            marker={point}
            overlays={mapOverlays}
            onClick={onMapClick}
            onViewChange={onViewChange}
            onError={onMapError}
            onDrawn={onDrawn}
            onPictureShown={setPictureShown}
            onFramed={setFramedSite}
          />
          {/* Before the notes, at the same level: the notes and MapLibre's corners stay above it. */}
          {storyShown && !stacked && coverShown && (
            <StoryBoundary onError={story.exit}>
              <StoryCover site={story.site} step={story.step} onStart={story.next} onExit={story.exit} />
            </StoryBoundary>
          )}
          {mapNotes(false)}
        </div>
        {(captionUnderMap || notesUnderMap) && mapNotes(true)}
        {storyShown && stacked && stamp(true)}
        {storyShown && (
          <StoryBoundary onError={story.exit}>
            <StoryPanel
              pending={story.status === 'pending'}
              site={story.site}
              steps={story.steps}
              index={story.index}
              layer={layer}
              overlayViews={overlayViews}
              curve={
                yearSeries && yearCurve && layer ? (
                  <StoryCurve series={yearSeries} curve={yearCurve} entries={timeline} layer={layer} picture={pictureShown} />
                ) : null
              }
              coverOnMap={!stacked}
              control={story.control}
              onControl={story.toggle}
              onNext={story.next}
              onBack={story.back}
              onGoTo={story.goTo}
              onExit={story.exit}
            />
          </StoryBoundary>
        )}
        {/* Asleep while the story is open (under its panel on a desktop, not shown on a phone). */}
        <aside className="side" aria-label="Controls and readouts" inert={storyShown}>
          {load.status === 'loading' && <p className="muted">Loading data…</p>}
          {load.status === 'error' && (
            <div className="error" role="alert">
              <strong>The data could not be loaded.</strong>
              <pre>{load.message}</pre>
            </div>
          )}
          {load.status === 'ready' && !site && (
            <p className="panel" data-testid="no-data">
              No data yet. The pipeline has not produced any places for this map.
            </p>
          )}
          {load.status === 'ready' && site && (
            <>
              <section className="panel" aria-labelledby="site-title">
                <SitePicker sites={load.manifest.sites} value={site.id} onChange={selectSite} />
                {/* Takes focus when the story closes (tabIndex -1: not a stop in the tab order). */}
                <h2 id="site-title" tabIndex={-1}>
                  {site.title}
                </h2>
                {site.summary && <p>{site.summary}</p>}
                <p className="muted">
                  {site.source.product}, stack {site.source.stack} ({site.source.direction}), release {site.source.release}
                </p>
                {citation && (
                  <p className="muted" data-testid="site-citation">
                    Data: {citation}
                  </p>
                )}
                {site.source.release === 'mixed' && <p className="warning">{MIXED_RELEASE_WARNING}</p>}
                {layer ? (
                  <>
                    <LayerPicker layers={site.layers} value={layer.id} onChange={selectLayer} />
                    {layer.kind === 'per-date' && (
                      <DateStepper
                        entries={timeline}
                        itemIndex={itemIndex}
                        onChange={chooseItem}
                        play={{ playing: playback.playing, onToggle: togglePlayback, announcement: playback.announcement }}
                        series={yearSeries}
                      />
                    )}
                    {layer.kind === 'pair' && <PairPicker layer={layer} itemIndex={itemIndex} onChange={selectItem} />}
                    {layer.kind === 'static' && <StaticLayerNote />}
                    <OpacityControl value={opacity} onChange={setOpacity} />
                  </>
                ) : (
                  <p className="muted">This place has no layers yet.</p>
                )}
                {/* Also on a place with no layers yet: whatever the map draws can be switched off. */}
                <OverlaySwitches
                  overlays={site.overlays}
                  on={overlaysOn}
                  views={overlayViews}
                  onToggle={toggleOverlay}
                  quiet={playback.playing}
                  defaultColor={DEFAULT_OVERLAY_COLOR}
                />
              </section>
              {(layer || overlayViews.length > 0) && <Legend layer={layer} overlays={overlayViews} />}
              {mapError && (
                <p className="error" role="alert">
                  {mapError}
                </p>
              )}
              <InspectPanel
                state={inspect}
                mixedRelease={site.source.release === 'mixed'}
                onInspectCentre={onInspectCentre}
                quiet={playback.playing}
                overlayReadings={overlayReadings}
              />
              {site.stats && <StatsPanel load={stats} mixedRelease={site.source.release === 'mixed'} layers={site.layers} />}
            </>
          )}
        </aside>
      </main>
      <AboutDialog open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </div>
  );
}

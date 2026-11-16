// Extension point: compare (swipe) view. Placeholder only; nothing imports it yet.
//
// TODO(builder): build a two-date swipe here: two maps kept in sync (move -> jumpTo), the top one
// clipped with CSS clip-path behind a draggable, keyboard-operable handle. A hand-written version of
// this (about 40 lines) passed every check in the pre-kickoff browser tests; see
// research/digests/browser.md, section 6.5 (the tested code) and facts F16 to F18.
// Do NOT use the @maplibre/maplibre-gl-compare plugin: it fails under Vite. Size both map containers
// with id selectors or inset: 0, or maplibre-gl.css collapses them to zero height.
export {};

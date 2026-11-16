// The project's name and tagline. This is the one place they are written: the header (App.tsx)
// reads them from here, and so does index.html, whose title and meta description vite.config.ts
// fills in at build time.
//
// Copied by hand from docs/CONCEPT.md, the line that starts "**Project name and tagline:**" in its
// list of answers (lines 103 and 104 when copied, on 14 November 2026). No test compares the two:
// teammates edit docs/CONCEPT.md directly on GitHub, and the tests gate every deploy, so a reworded
// line there must not block one. When the name or tagline changes there, change it here too.
//
// The tagline was reworded on 14 November 2026, at a teammate's decision, in both places at once:
// its second half used to promise that straw machines can reach the fields before the fires do,
// which read as a result, and the fire test did not support that (docs/METHODS.md, section 6). It
// is now the question the project asks.

export const BRANDING = {
  name: 'Before the Smoke',
  tagline: "NISAR sees Punjab's rice harvest through haze and before dawn. Can that get straw machines to the fields before the fires?",
} as const;

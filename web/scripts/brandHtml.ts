// Fills the name and tagline (src/branding.ts) into index.html at build time: the page's <title> and
// its meta description are then the same text as the header, from one constant. vite.config.ts runs
// this from a small transformIndexHtml plugin, on the dev server and in the production build.

export const BRAND_PLACEHOLDERS = { name: '__BRAND_NAME__', tagline: '__BRAND_TAGLINE__' } as const;

/** Text made safe for HTML, in element content and in quoted attribute values alike. */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
}

/**
 * index.html with every placeholder replaced by the escaped text. Throws when a placeholder is
 * absent, so that a page whose title has lost its placeholder cannot go unnoticed.
 */
export function fillBrandPlaceholders(html: string, brand: { name: string; tagline: string }): string {
  let out = html;
  for (const key of ['name', 'tagline'] as const) {
    const placeholder = BRAND_PLACEHOLDERS[key];
    if (!out.includes(placeholder)) throw new Error(`index.html has no ${placeholder} placeholder for the ${key} (src/branding.ts)`);
    out = out.split(placeholder).join(escapeHtml(brand[key]));
  }
  return out;
}

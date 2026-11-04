// An id for an SVG <filter> or <clipPath> in a component that can appear
// more than once on a page (the logo in the navbar and the mobile menu, the
// UK flag in the language button and its list). Numbered in render order
// within each page, not random: the same page then builds to the same HTML
// every time, which scripts/indexnow.mjs relies on to report only the pages
// that really changed.
const counts = new Map<string, number>()

export function svgId(prefix: string, page: URL): string {
  const key = `${prefix} ${page.pathname}`
  const next = (counts.get(key) ?? 0) + 1
  counts.set(key, next)
  return `${prefix}-${next}`
}

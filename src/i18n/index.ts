// Every user-facing string lives in src/i18n/<locale>.ts, each typed as the
// English file (`satisfies typeof en`), so a key missing in a translation
// fails the build.

import { defaultLocale, locales, ogLocales, type Locale } from "./locales"
import en from "./en"
import pl from "./pl"
import de from "./de"
import es from "./es"
import fr from "./fr"
import it from "./it"
import pt from "./pt"
import nl from "./nl"
import cs from "./cs"
import tr from "./tr"
import ro from "./ro"
import id from "./id"

export { defaultLocale, locales, ogLocales, type Locale }

export type Strings = typeof en
export type EditorStrings = Strings["editor"]
/** The "change the date" editor: the shared editor strings, with its own on top. */
export type ExifEditorStrings = Strings["editor"] & Strings["exif"]["editor"]

/**
 * Polish and Czech typesetting: a one-letter word (pl: a, i, o, u, w, z;
 * cs: a, i, k, o, s, u, v, z) must not end a line, so the space after it is
 * a non-breaking one. Applied to every string here rather than typed into
 * the locale files, where it would be invisible.
 */
function keepOneLetterWords<T>(value: T, letters: string): T {
  const word = new RegExp(`(?<=^|[\\s(„"])([${letters}${letters.toUpperCase()}]) `, "g")
  const walk = (item: unknown): unknown => {
    if (typeof item === "string") return item.replace(word, "$1\u00a0")
    if (Array.isArray(item)) return item.map(walk)
    if (item && typeof item === "object") return Object.fromEntries(Object.entries(item).map(([key, child]) => [key, walk(child)]))
    return item
  }
  return walk(value) as T
}

export const strings: Record<Locale, Strings> = { en, pl: keepOneLetterWords(pl, "aiouwz"), de, es, fr, it, pt, nl, cs: keepOneLetterWords(cs, "aikosuvz"), tr, ro, id }

export const t = (locale: Locale) => strings[locale]

/**
 * The pages of the site; each locale gives each its own (translated) slug.
 * "exif" is the second tool: it changes the date saved in the photo (EXIF)
 * instead of printing it on the picture.
 */
export const pages = ["home", "exif", "iphone", "android", "windows", "mac", "batch", "screenshot", "timestamp", "scanned", "retro", "exifIphone", "exifMessenger", "exifGoogle", "exifScanned", "guides", "privacy"] as const
export type Page = (typeof pages)[number]

/** The how-to pages (Guide.astro), each aimed at one search: "add date to photo on iPhone"... */
export const stampGuidePages = ["iphone", "android", "windows", "mac", "batch", "screenshot", "timestamp", "scanned", "retro"] as const satisfies readonly Page[]
/** The guides for the second tool, changing the date saved in the photo (their editor is ExifEditor). */
export const exifGuidePages = ["exifIphone", "exifMessenger", "exifGoogle", "exifScanned"] as const satisfies readonly Page[]
export const guidePages = [...stampGuidePages, ...exifGuidePages] as const
export type GuidePage = (typeof guidePages)[number]
export type ExifGuidePage = (typeof exifGuidePages)[number]
export const isGuide = (page: Page): page is GuidePage => (guidePages as readonly Page[]).includes(page)
/** The pages of the "change the date" tool: its own page and its guides (their own share picture, ExifEditor). */
export const isExifPage = (page: Page): page is "exif" | ExifGuidePage => page === "exif" || (exifGuidePages as readonly Page[]).includes(page)

/** A page's path in a locale, without the base: /, /pl/, /de/datum-auf-foto-iphone/. */
export function pathOf(page: Page, locale: Locale): string {
  const prefix = locale === defaultLocale ? "/" : `/${locale}/`
  return page === "home" ? prefix : `${prefix}${strings[locale].slugs[page]}/`
}

// import.meta.env is Vite's; outside it (the Playwright tests import this
// file for the page paths) there is no base.
const base = (import.meta.env?.BASE_URL ?? "/").replace(/\/$/, "")

/** A path with the GitHub Pages base prefixed (/datestamp/pl/ in production). */
export const href = (path: string) => base + path

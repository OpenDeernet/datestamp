import { describe, expect, it } from "vitest"
import { defaultLocale, guidePages, locales, pages, pathOf, strings, type Strings } from "../../src/i18n"

// Every leaf key of an object, as "a.b.c" paths.
const keys = (value: unknown, prefix = ""): string[] =>
  value && typeof value === "object" && !Array.isArray(value)
    ? Object.entries(value).flatMap(([key, child]) => keys(child, prefix ? `${prefix}.${key}` : key))
    : [prefix]

describe("translations", () => {
  const reference = keys(strings.en).sort()

  it.each(locales)("%s has every key of en", (locale) => {
    expect(keys(strings[locale]).sort()).toEqual(reference)
  })

  it.each(locales)("%s has no empty strings", (locale) => {
    const empty = keys(strings[locale]).filter((path) => {
      const value = path.split(".").reduce<unknown>((node, key) => (node as Record<string, unknown>)[key], strings[locale])
      return typeof value === "string" && value.trim() === ""
    })
    expect(empty).toEqual([])
  })

  it.each(locales)("%s lists as many FAQ entries, facts, steps and examples as en", (locale) => {
    const of = (s: Strings) => [
      s.home.faq.length,
      s.home.facts.length,
      s.home.steps.items.length,
      s.home.examples.captions.length,
      ...guidePages.map((guide) => s.guides[guide].steps.length),
      s.exif.steps.length,
      s.exif.faq.length,
      s.exif.facts.length,
      s.privacy.sections.length,
    ]
    expect(of(strings[locale])).toEqual(of(strings.en))
  })

  // Search results cut titles at about 60 characters and descriptions at
  // about 160; shorter descriptions get replaced by a snippet Google picks.
  it.each(locales)("%s has titles and descriptions that fit a search result", (locale) => {
    const s = strings[locale]
    for (const page of [s.home, s.exif, ...guidePages.map((guide) => s.guides[guide]), s.privacy]) {
      expect(page.title.length, page.title).toBeLessThanOrEqual(60)
      expect(page.description.length, page.description).toBeLessThanOrEqual(160)
      expect(page.description.length, page.description).toBeGreaterThanOrEqual(90)
    }
  })

  // The steps and the FAQ quote the shift's label, so it must be the editor's own.
  it.each(locales)("%s quotes the editor's own label for the date shift", (locale) => {
    const s = strings[locale].exif
    expect(s.steps.join(" ")).toContain(s.editor.shift)
    expect(s.faq.map(({ a }) => a).join(" ")).toContain(s.editor.shift)
  })

  it.each(locales)("%s offers date formats without duplicates", (locale) => {
    const formats = strings[locale].dateFormats
    expect(formats.length).toBeGreaterThan(2)
    expect(new Set(formats).size).toBe(formats.length)
  })

  it("never leaves a Czech one-letter word at the end of a line", () => {
    const texts = (value: unknown): string[] =>
      typeof value === "string" ? [value] : value && typeof value === "object" ? Object.values(value).flatMap(texts) : []
    for (const text of texts(strings.cs)) expect(text, text).not.toMatch(/(?<=^|[\s(„"])[aikosuvzAIKOSUVZ] /)
  })

  it("never leaves a Polish one-letter word at the end of a line", () => {
    const texts = (value: unknown): string[] =>
      typeof value === "string" ? [value] : value && typeof value === "object" ? Object.values(value).flatMap(texts) : []
    const all = texts(strings.pl)
    expect(all.join(" ")).toContain("stronę i\u00a0jak")
    for (const text of all) expect(text, text).not.toMatch(/(?<=^|[\s(„"])[aiouwzAIOUWZ] /)
  })

  it.each(locales)("%s keeps the {name}, {email} and {date} placeholders", (locale) => {
    expect(strings[locale].editor.cannotOpen).toContain("{name}")
    expect(strings[locale].privacy.contact).toContain("{email}")
    expect(strings[locale].exif.editor.before).toContain("{date}")
  })
})

describe("pathOf", () => {
  it("serves the default locale at the root", () => {
    expect(pathOf("home", defaultLocale)).toBe("/")
    expect(pathOf("home", "pl")).toBe("/pl/")
  })

  it("gives every page a distinct path in every locale", () => {
    const paths = pages.flatMap((page) => locales.map((locale) => pathOf(page, locale)))
    expect(new Set(paths).size).toBe(paths.length)
  })

  it("uses URL-safe slugs", () => {
    for (const locale of locales) {
      for (const slug of Object.values(strings[locale].slugs)) expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    }
  })
})

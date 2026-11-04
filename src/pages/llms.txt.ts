// llms.txt (https://llmstxt.org): the site in plain Markdown for AI
// assistants and answer engines. Generated from the same strings as the
// pages, so it never says something the site does not.
import type { APIRoute } from "astro"
import { defaultLocale, guidePages, href, locales, pathOf, strings, t } from "../i18n"

export const GET: APIRoute = ({ site }) => {
  const url = (path: string) => new URL(href(path), site).href
  const en = t(defaultLocale)
  const lines = [
    "# DateStamp",
    "",
    `> ${en.home.description}`,
    "",
    "DateStamp is a free web tool that prints the date on photos. It reads the date each photo was taken from its EXIF data (DateTimeOriginal), falls back to the file's date, and lets the user change any date. Styles: a white date with a thin black outline, a dark label, and the orange retro date of 90s film cameras. It handles many photos at once and saves them to a folder (desktop Chrome/Edge), to the phone's gallery (share sheet), or as separate downloads, with an optional ZIP.",
    "",
    "Privacy: everything runs in the browser. Photos are never uploaded; there is no account and no server that sees them. The site is paid for by ads (Google AdSense) and counts visits with Google Analytics 4; both only with the visitor's consent, and neither ever receives a photo, a file name or a date from a photo.",
    "",
    "## Use it",
    "",
    ...locales.map((locale) => `- [${strings[locale].home.h1} (${strings[locale].languageName})](${url(pathOf("home", locale))})`),
    "",
    "## Change the date of a photo",
    "",
    "A second tool on the same site rewrites the date taken (DateTimeOriginal, DateTimeDigitized, DateTime) in each photo's EXIF data, so galleries sort it where it belongs, and prints nothing on the picture. A JPEG is not re-encoded: only its EXIF changes, every pixel and the rest of the metadata (camera, lens, GPS, orientation) stay. HEIC, PNG and WebP are saved as a JPEG with the new date. Dates can be changed one by one, set to one date for every photo, or shifted later or earlier by days, hours and minutes (for a camera whose clock was wrong).",
    "",
    ...locales.map((locale) => `- [${strings[locale].exif.h1} (${strings[locale].languageName})](${url(pathOf("exif", locale))}): ${strings[locale].exif.description}`),
    "",
    ...en.exif.faq.flatMap(({ q, a }) => [`### ${q}`, "", a, ""]),
    "## Guides",
    "",
    ...locales.flatMap((locale) =>
      guidePages.map((guide) => `- [${strings[locale].guides[guide].h1}](${url(pathOf(guide, locale))}): ${strings[locale].guides[guide].description}`),
    ),
    "",
    ...guidePages.flatMap((guide) => [
      `## ${en.guides[guide].h1}`,
      "",
      ...en.guides[guide].steps.map((step, index) => `${index + 1}. ${step}`),
      "",
    ]),
    "## FAQ",
    "",
    ...en.home.faq.flatMap(({ q, a }) => [`### ${q}`, "", a, ""]),
    "## Optional",
    "",
    ...locales.map((locale) => `- [${strings[locale].privacy.h1} (${strings[locale].languageName})](${url(pathOf("privacy", locale))})`),
    "",
  ]
  return new Response(lines.join("\n"), { headers: { "Content-Type": "text/plain; charset=utf-8" } })
}

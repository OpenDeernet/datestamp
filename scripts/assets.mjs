// Renders the site's pictures into public/: the icon PNGs from
// public/favicon.svg and one share picture (og:image) per language from the
// dev-only /og/<locale>/ and /og/<locale>-exif/ pages. Run after changing the favicon, the OG
// layout or a home page title: `npm run assets`, then commit public/.
import { chromium } from "@playwright/test"
import { spawn } from "node:child_process"
import { mkdir, readFile } from "node:fs/promises"
import { locales } from "../src/i18n/locales.ts"

const PORT = 4330
const root = new URL("../", import.meta.url)
const out = (path) => new URL(`public/${path}`, root).pathname

const svg = await readFile(new URL("public/favicon.svg", root), "utf8")
// Full-bleed versions: iOS and Android mask the corners themselves, and a
// maskable icon must keep its content inside the middle 80 %.
const square = svg.replace('rx="14"', 'rx="0"')
const maskable = square.replace(/<svg ([^>]*)viewBox="0 0 64 64"/, '<svg $1viewBox="-8 -8 80 80"').replace('<rect width="64" height="64" rx="0"', '<rect x="-8" y="-8" width="80" height="80"')

const icons = [
  { file: "favicon-32.png", size: 32, source: svg },
  { file: "apple-touch-icon.png", size: 180, source: square },
  { file: "icon-192.png", size: 192, source: svg },
  { file: "icon-512.png", size: 512, source: svg },
  { file: "icon-maskable-512.png", size: 512, source: maskable },
]

const server = spawn("npx", ["astro", "dev", "--port", String(PORT), "--ignore-lock"], { cwd: root.pathname, stdio: "ignore" })
const browser = await chromium.launch()
try {
  const page = await browser.newPage()

  for (const { file, size, source } of icons) {
    await page.setViewportSize({ width: size, height: size })
    await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${source}`)
    await page.screenshot({ path: out(file), omitBackground: true })
    console.log("icon", file)
  }

  await waitFor(`http://localhost:${PORT}/og/en/`)
  await mkdir(out("og"), { recursive: true })
  await page.setViewportSize({ width: 1200, height: 630 })
  // Each language's two pictures: the date stamp, and changing the date (-exif).
  for (const name of locales.flatMap((locale) => [locale, `${locale}-exif`])) {
    await page.goto(`http://localhost:${PORT}/og/${name}/`, { waitUntil: "networkidle" })
    // The dev server's toolbar is not part of the picture.
    await page.evaluate(() => document.querySelector("astro-dev-toolbar")?.remove())
    await page.locator("[data-og]").screenshot({ path: out(`og/${name}.png`) })
    console.log("og", name)
  }
} finally {
  await browser.close()
  server.kill()
}

async function waitFor(url) {
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(url)).ok) return
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error(`dev server did not answer at ${url}`)
}

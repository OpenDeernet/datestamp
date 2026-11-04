import { expect } from "@playwright/test"
import { locales, pages, pathOf, strings } from "../../src/i18n"
import { test, visit } from "./helpers"

for (const locale of locales) {
  test(`${locale}: home page has its language, title and hreflang alternates`, async ({ page }) => {
    await page.goto(pathOf("home", locale))
    await expect(page.locator("html")).toHaveAttribute("lang", locale)
    await expect(page).toHaveTitle(strings[locale].home.title)
    await expect(page.locator("h1")).toHaveText(strings[locale].home.h1)
    await expect(page.locator('link[rel="alternate"][hreflang]')).toHaveCount(locales.length + 1)
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`${pathOf("home", locale)}$`))
  })
}

test("every page in every locale answers", async ({ request }) => {
  for (const locale of locales) {
    for (const page of pages) {
      const response = await request.get(pathOf(page, locale))
      expect(response.status(), pathOf(page, locale)).toBe(200)
    }
  }
})

test("the language menu keeps the page and switches the language", async ({ page }) => {
  await page.goto(pathOf("iphone", "pl"))
  await page.locator('header summary[aria-label="Language"]').click()
  await page.locator('header a[hreflang="de"]').click()
  await expect(page).toHaveURL(new RegExp(`${pathOf("iphone", "de")}$`))
  await expect(page.locator("html")).toHaveAttribute("lang", "de")
})

test("the theme switch applies and remembers a theme, and system forgets it", async ({ page }) => {
  await visit(page)
  // Below 420 px (the phone project) the navbar has one button that opens the three.
  const menu = page.locator("header details[data-theme-switch]")
  const pick = async (theme: string) => {
    if (await menu.isVisible()) await menu.locator("summary").click()
    await page.locator(`header [data-theme-choice="${theme}"]:visible`).click()
  }
  await pick("dark")
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark")
  await page.reload()
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark")
  await expect(page.locator('header [data-theme-choice="dark"]').first()).toHaveAttribute("aria-pressed", "true")

  await pick("system")
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.*/)
  await page.reload()
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.*/)
})

test("on a narrow phone the theme is a menu: its button shows the choice and closes after a pick", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 })
  await visit(page)
  const menu = page.locator("header details[data-theme-switch]")
  await expect(menu).toBeVisible()
  await expect(page.locator("header [role=group][data-theme-switch]")).toBeHidden()
  await expect(menu.locator('summary [data-icon="system"]')).toBeVisible()
  await menu.locator("summary").click()
  await menu.locator('[data-theme-choice="dark"]').click()
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark")
  await expect(menu).not.toHaveAttribute("open")
  await expect(menu.locator('summary [data-icon="dark"]')).toBeVisible()
  await expect(menu.locator('summary [data-icon="system"]')).toBeHidden()
})

test("no horizontal scrolling", async ({ page }) => {
  await page.goto("/pl/")
  const overflows = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
  expect(overflows).toBe(false)
})

test("sitemap and ads.txt are published", async ({ request }) => {
  expect((await request.get("/sitemap-index.xml")).status()).toBe(200)
  expect((await request.get("/ads.txt")).status()).toBe(200)
})

test("share picture, description and icons are set", async ({ page, request }) => {
  await page.goto(pathOf("home", "pl"))
  const image = await page.locator('meta[property="og:image"]').getAttribute("content")
  expect(image).toMatch(/\/og\/pl\.png$/)
  expect((await request.get(new URL(image!).pathname)).headers()["content-type"]).toContain("image/png")
  await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute("content", "pl_PL")
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image")
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", strings.pl.home.description)
  for (const icon of ["/favicon.svg", "/favicon-32.png", "/apple-touch-icon.png", "/icon-512.png", "/icon-maskable-512.png"]) {
    expect((await request.get(icon)).status(), icon).toBe(200)
  }
})

test("the change-date pages share their own picture, in every language", async ({ page, request }) => {
  for (const [path, h1] of [
    [pathOf("exif", "pl"), strings.pl.exif.h1],
    [pathOf("exifMessenger", "de"), strings.de.exif.h1],
  ]) {
    await page.goto(path)
    const image = await page.locator('meta[property="og:image"]').getAttribute("content")
    expect(image, path).toMatch(/\/og\/[a-z]{2}-exif\.png$/)
    expect((await request.get(new URL(image!).pathname)).headers()["content-type"]).toContain("image/png")
    await expect(page.locator('meta[property="og:image:alt"]')).toHaveAttribute("content", h1)
  }
  // A date stamp guide keeps the stamp's picture.
  await page.goto(pathOf("scanned", "pl"))
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", /\/og\/pl\.png$/)
})

test("JSON-LD is one valid graph with the site, the app and the page", async ({ page }) => {
  for (const [path, extra] of [[pathOf("home", "pl"), "FAQPage"], [pathOf("iphone", "pl"), "HowTo"]] as const) {
    await page.goto(path)
    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents()
    expect(blocks).toHaveLength(1)
    const graph = JSON.parse(blocks[0])["@graph"] as { "@type": string }[]
    expect(graph.map((node) => node["@type"])).toEqual(["WebSite", "WebApplication", "WebPage", extra])
  }
})

test("robots.txt welcomes crawlers and llms.txt describes the site", async ({ request }) => {
  const robots = await (await request.get("/robots.txt")).text()
  expect(robots).toContain("Allow: /")
  expect(robots).toContain("ClaudeBot")
  expect(robots).toMatch(/Sitemap: .*sitemap-index\.xml/)
  const llms = await (await request.get("/llms.txt")).text()
  expect(llms.startsWith("# DateStamp")).toBe(true)
  for (const locale of locales) expect(llms).toContain(pathOf("home", locale))
})

test("the navbar links the page's sections; on a phone they are in a menu that closes itself", async ({ page, isMobile }) => {
  await page.goto(pathOf("home", "pl"))
  if (!isMobile) {
    await expect(page.locator('header nav > ul a[aria-current="page"]')).toHaveText(strings.pl.nav.editor)
    await page.locator("header nav").getByRole("link", { name: strings.pl.nav.guides }).click()
    // It only scrolls: the address gets no #guides.
    await expect(page.locator("#guides")).toBeInViewport()
    expect(new URL(page.url()).hash).toBe("")
    // The heading it landed on lights up, and the underline has moved under "Guides".
    await expect(page.locator("#guides")).toHaveClass(/is-target/)
    const underline = page.locator("[data-nav-indicator]")
    const guidesLink = page.locator("header nav").getByRole("link", { name: strings.pl.nav.guides })
    await expect
      .poll(async () => {
        const [line, link] = await Promise.all([underline.boundingBox(), guidesLink.boundingBox()])
        return Math.round(line!.x + line!.width / 2) - Math.round(link!.x + link!.width / 2)
      })
      .toBeLessThanOrEqual(1)
    return
  }
  await page.getByRole("button", { name: strings.pl.nav.menu }).click()
  // The <dialog> itself has no size (its sheet is fixed), so look at its links.
  const guidesLink = page.locator("#mobile-menu").getByRole("link", { name: strings.pl.nav.guides })
  await expect(guidesLink).toBeVisible()
  // Panel and tint are absolute on the page, not fixed to the screen (that
  // turns iOS Safari's bars opaque): the tint covers the whole page, the
  // page's scroll is locked, and the panel has no transform while open.
  const shade = page.locator("[data-menu-shade]")
  const panel = page.locator("#mobile-menu")
  await expect(shade).toHaveAttribute("data-open", "")
  await expect(shade).toHaveCSS("position", "absolute")
  await expect(panel).toHaveCSS("position", "absolute")
  await expect(panel).toHaveCSS("translate", "none")
  expect((await shade.boundingBox())!.height).toBeGreaterThanOrEqual(await page.evaluate(() => document.documentElement.scrollHeight) - 1)
  await expect(page.locator("html")).toHaveCSS("overflow", "hidden")
  // Safari's status bar is dimmed with it: no theme-color, and the page's
  // background the light page (251, 250, 248) under 30 % black.
  await expect(page.locator('meta[name="theme-color"]')).toHaveCount(0)
  await expect(page.locator("body")).toHaveCSS("background-color", "rgb(176, 175, 174)")
  await guidesLink.click()
  await expect(page.locator("#guides")).toBeInViewport()
  expect(new URL(page.url()).hash).toBe("")
  await expect(guidesLink).toBeHidden()
  await expect(shade).not.toHaveAttribute("data-open")
  await expect(page.locator("html")).not.toHaveCSS("overflow", "hidden")
  await expect(page.locator('meta[name="theme-color"]')).toHaveCount(4)
  await expect(page.locator("body")).not.toHaveCSS("background-color", "rgb(176, 175, 174)")

  // Escape and a tap beside the sheet close it too.
  await page.getByRole("button", { name: strings.pl.nav.menu }).click()
  await expect(guidesLink).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(guidesLink).toBeHidden()
  await page.getByRole("button", { name: strings.pl.nav.menu }).click()
  await expect(guidesLink).toBeVisible()
  await page.mouse.click(380, 400)
  await expect(guidesLink).toBeHidden()
})

test.describe("install the app", () => {
  test("in Chrome the menu's button opens the browser's install prompt", async ({ page, isMobile }) => {
    test.skip(!isMobile, "the menu is for narrow screens")
    await page.goto(pathOf("home", "pl"))
    const install = page.locator("#mobile-menu").getByRole("button", { name: strings.pl.install.label })
    await page.getByRole("button", { name: strings.pl.nav.menu }).click()
    await expect(install).toBeHidden() // no prompt offered yet
    await page.evaluate(() => {
      const event = Object.assign(new Event("beforeinstallprompt", { cancelable: true }), {
        prompt: () => ((window as unknown as { prompted: boolean }).prompted = true) && Promise.resolve(),
      })
      dispatchEvent(event)
    })
    await install.click()
    expect(await page.evaluate(() => (window as unknown as { prompted?: boolean }).prompted)).toBe(true)
    await expect(install).toBeHidden()
  })

  test.describe("on an iPhone", () => {
    test.use({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1" })
    test("the button shows how to add it from the Share menu", async ({ page, isMobile }) => {
      test.skip(!isMobile, "the menu is for narrow screens")
      await page.goto(pathOf("home", "pl"))
      await page.getByRole("button", { name: strings.pl.nav.menu }).click()
      const hint = page.locator("#mobile-menu").getByText(strings.pl.install.iosHint)
      await expect(hint).toBeHidden()
      await page.locator("#mobile-menu").getByRole("button", { name: strings.pl.install.label }).click()
      await expect(hint).toBeVisible()
    })
  })
})

test.describe("cookie banner", () => {
  test.use({ consent: null })

  // The AdSense flags live on the adsbygoogle array, which evaluate() would copy without them.
  const ads = (page: import("@playwright/test").Page) =>
    page.evaluate(() => {
      const queue = (window as unknown as { adsbygoogle: { pauseAdRequests?: number; requestNonPersonalizedAds?: number } }).adsbygoogle
      return { pauseAdRequests: queue.pauseAdRequests, requestNonPersonalizedAds: queue.requestNonPersonalizedAds }
    })
  const gaLoaded = (page: import("@playwright/test").Page) => page.locator('script[src*="googletagmanager.com/gtag/js"]').count()

  test("asks first: no ad requests and no Google Analytics until a choice", async ({ page }) => {
    await page.goto(pathOf("home", "pl"))
    await expect(page.locator("[data-consent]")).toHaveAttribute("data-open", "")
    expect((await ads(page)).pauseAdRequests).toBe(1)
    expect(await gaLoaded(page)).toBe(0)
  })

  test("reject all: non-personalised ads, no Google Analytics, remembered", async ({ page }) => {
    await page.goto(pathOf("home", "pl"))
    const banner = page.locator("[data-consent]")
    await banner.getByRole("button", { name: strings.pl.consent.reject }).click()
    await expect(banner).not.toHaveAttribute("data-open", /.*/)
    expect(await ads(page)).toMatchObject({ pauseAdRequests: 0, requestNonPersonalizedAds: 1 })
    expect(await gaLoaded(page)).toBe(0)

    await page.reload()
    await expect(banner).not.toHaveAttribute("data-open", /.*/)
    expect((await ads(page)).requestNonPersonalizedAds).toBe(1)
    expect(await gaLoaded(page)).toBe(0)
  })

  test("customize: statistics yes, ads no; cookie settings shows the choice again", async ({ page }) => {
    await page.goto(pathOf("home", "pl"))
    const banner = page.locator("[data-consent]")
    await banner.getByRole("button", { name: strings.pl.consent.customize }).click()
    await expect(banner.getByRole("switch", { name: new RegExp(strings.pl.consent.necessary.title) })).toBeDisabled()
    await banner.getByRole("switch", { name: new RegExp(strings.pl.consent.analytics.title) }).check()
    await banner.getByRole("button", { name: strings.pl.consent.save }).click()
    await expect(banner).not.toHaveAttribute("data-open", /.*/)
    expect(await gaLoaded(page)).toBe(1)
    expect((await ads(page)).requestNonPersonalizedAds).toBe(1)

    // Loaded early on the next page, before anything else.
    await page.reload()
    expect(await gaLoaded(page)).toBe(1)

    await page.getByRole("button", { name: strings.pl.consent.settings }).click()
    await expect(banner).toHaveAttribute("data-open", "")
    await expect(banner.getByRole("switch", { name: new RegExp(strings.pl.consent.analytics.title) })).toBeChecked()
    await expect(banner.getByRole("switch", { name: new RegExp(strings.pl.consent.ads.title) })).not.toBeChecked()
    await banner.getByRole("button", { name: strings.pl.consent.accept }).click()
    expect((await ads(page)).requestNonPersonalizedAds).toBe(0)
  })
})

test("the examples show the three sample photos, credited", async ({ page, request }) => {
  const { samples } = await import("../../src/lib/samples")
  await page.goto(pathOf("home", "pl"))
  const images = page.locator('#examples ~ div img')
  await expect(images).toHaveCount(3)
  for (const [index, { key }] of samples.entries()) {
    // Resized at build time: a phone picks the 400 px one, AVIF where it can.
    const picture = page.locator("#examples ~ div picture").nth(index)
    await expect(picture.locator('source[type="image/avif"]')).toHaveAttribute("srcset", /400w.*800w/)
    await expect(images.nth(index)).toHaveAttribute("src", new RegExp(`/_astro/${key}\\.[\\w-]+\\.webp$`))
    const src = await images.nth(index).getAttribute("src")
    expect((await request.get(src!)).status(), key).toBe(200)
  }
  await expect(page.getByRole("link", { name: "Kamil Krzysteczko" })).toBeVisible()
})

test("on the home page the inline ad sits after the examples, before the FAQ, away from the editor", async ({ page, isMobile }) => {
  test.skip(!isMobile, "the inline ad shows only on screens without rails")
  await page.goto(pathOf("home", "pl"))
  const ad = page.locator(".ad-inline")
  await expect(ad).toBeVisible()
  const top = async (selector: string) => (await page.locator(selector).boundingBox())!.y
  const adTop = await top(".ad-inline")
  expect(adTop).toBeGreaterThan(await top("#examples"))
  expect(adTop).toBeLessThan(await top("#guides"))
})

test("a missing address shows the 404 page in the language of its path, not indexed and without ads", async ({ page }) => {
  const response = await page.goto("/pl/nie-ma-takiej-strony/")
  expect(response?.status()).toBe(404)
  await expect(page.locator("html")).toHaveAttribute("lang", "pl")
  await expect(page).toHaveTitle(strings.pl.notFound.title)
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(strings.pl.notFound.h1)
  await expect(page.getByRole("link", { name: strings.pl.notFound.cta })).toHaveAttribute("href", /\/pl\/$/)
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex")
  await expect(page.locator('link[rel="canonical"], script[type="application/ld+json"], ins.ad-unit')).toHaveCount(0)
})

test("on a wide screen both rails ask AdSense for an ad, and the hidden inline unit does not", async ({ page, isMobile }) => {
  test.skip(isMobile, "the rails exist only on wide screens")
  await page.setViewportSize({ width: 1500, height: 900 })
  await page.goto(pathOf("home", "pl"))
  // A unit gets the adsbygoogle class (AdSense's turn) only when it is requested.
  await expect(page.locator(".ad-rail ins.adsbygoogle")).toHaveCount(2)
  await expect(page.locator(".ad-inline ins.adsbygoogle")).toHaveCount(0)
  expect(await page.evaluate(() => (window as unknown as { adsbygoogle: unknown[] }).adsbygoogle.length)).toBe(2)
})

test("an ad AdSense could not fill is hidden, label and all", async ({ page, isMobile }) => {
  test.skip(isMobile, "the rails exist only on wide screens")
  await page.setViewportSize({ width: 1500, height: 900 })
  await page.goto(pathOf("home", "pl"))
  // As AdSense leaves it: the unit unfilled, its iframe set visible.
  await page.locator(".ad-rail-left ins").evaluate((unit) => {
    unit.setAttribute("data-ad-status", "unfilled")
    unit.insertAdjacentHTML("beforeend", '<iframe style="visibility: visible; background: white; width: 160px; height: 600px"></iframe>')
  })
  await expect(page.locator(".ad-rail-left")).toHaveCSS("opacity", "0")
  await expect(page.locator(".ad-rail-right")).toHaveCSS("opacity", "1")
})

test("a section link from a guide opens the home page at that section, with no # left in the address", async ({ page, isMobile }) => {
  await page.goto(pathOf("iphone", "pl"))
  if (isMobile) await page.getByRole("button", { name: strings.pl.nav.menu }).click()
  const links = page.locator(isMobile ? "#mobile-menu" : "header nav")
  await links.getByRole("link", { name: strings.pl.nav.guides }).click()
  await expect(page).toHaveTitle(strings.pl.home.title)
  await expect(page.locator("#guides")).toBeInViewport()
  await expect(page.locator("#guides")).toHaveClass(/is-target/)
  expect(new URL(page.url()).hash).toBe("")
})

test("without ads (a build with no AdSense ids renders no rails) the content keeps its full width", async ({ page, isMobile }) => {
  test.skip(isMobile, "the rails exist only on wide screens")
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(pathOf("home", "pl"))
  await page.evaluate(() => document.querySelectorAll(".ad-rail").forEach((rail) => rail.remove()))
  const box = await page.locator(".page-content").boundingBox()
  expect(box!.width).toBeGreaterThanOrEqual(940)
  // and centred
  expect(Math.abs(box!.x + box!.width / 2 - 720)).toBeLessThanOrEqual(10)
})

// "Change the date of a photo": the date is rewritten in the photo's EXIF,
// a JPEG's picture is not touched, and the dates can be changed one by
// one or set for all.
import { expect } from "@playwright/test"
import exifr from "exifr"
import JSZip from "jszip"
import { readFile } from "node:fs/promises"
import { pathOf, strings } from "../../src/i18n"
import { exifDate, exifSegment } from "../../src/lib/exif"
import { addPhotos, fixture, PHOTOS, test, useFileDownloads, visit } from "./helpers"

const PAGE = pathOf("exif", "pl")
const tags = (jpeg: Uint8Array) => exifr.parse(jpeg, { tiff: true, exif: true, gps: true, translateValues: false })

/** The file without its EXIF segment: the picture itself. */
function withoutExif(jpeg: Uint8Array) {
  const segment = exifSegment(jpeg)
  if (!segment) return Buffer.from(jpeg)
  const at = Buffer.from(jpeg).indexOf(Buffer.from(segment))
  return Buffer.concat([jpeg.subarray(0, at), jpeg.subarray(at + segment.length)])
}

test.describe("changing the date", () => {
  test.beforeEach(async ({ page }) => {
    await useFileDownloads(page)
    await visit(page, PAGE)
  })

  test("writes the new date into a JPEG and keeps its picture and metadata", async ({ page }) => {
    await addPhotos(page, [fixture("exif-full.jpg")])
    const card = page.locator(".photo").first()
    const field = card.locator('input[type="datetime-local"]')
    // Open from the start: changing the date is the point of the page.
    await expect(field).toBeVisible()
    await expect(field).toHaveValue("2019-08-03T12:34")
    await expect(card.locator("[data-date-before]")).toBeHidden()

    await field.fill("2001-02-03T04:05")
    await expect(card.locator("[data-date-label]")).toHaveText("03.02.2001 04:05")
    await expect(card.locator("[data-date-before]")).toHaveText("Było: 03.08.2019 12:34")

    const [download] = await Promise.all([page.waitForEvent("download"), page.locator("[data-save-all]").click()])
    // The same name: it is the same photo with another date.
    expect(download.suggestedFilename()).toBe("exif-full.jpg")
    const saved = await readFile(await download.path())
    const original = await readFile(fixture("exif-full.jpg"))
    expect(withoutExif(saved).equals(withoutExif(original))).toBe(true)

    const saidTags = await tags(saved)
    expect(exifDate(saidTags.DateTimeOriginal)).toBe("2001:02:03 04:05:00")
    expect(exifDate(saidTags.CreateDate)).toBe("2001:02:03 04:05:00")
    expect(saidTags.Make).toBe("TestCam")
    expect(saidTags.latitude).toBeCloseTo(50.0614, 3)
    await expect(card).toHaveAttribute("data-state", "done")

    // A new date puts the photo back to "ready": the saved file no longer matches.
    await field.fill("2001-02-04T04:05")
    await expect(card).toHaveAttribute("data-state", "ready")
  })

  test("sets one date for every photo", async ({ page }) => {
    const setAll = page.locator("[data-set-all]")
    await expect(setAll).toBeDisabled() // no photos yet
    await addPhotos(page)
    await expect(setAll).toBeDisabled() // no date picked yet
    await page.locator("input[name=all]").fill("2010-05-06T07:08")
    await setAll.click()
    const fields = page.locator('.photo input[type="datetime-local"]')
    for (const field of await fields.all()) await expect(field).toHaveValue("2010-05-06T07:08")
    // Each one can still be changed on its own.
    await fields.nth(1).fill("2010-05-07T09:00")
    await expect(fields.nth(0)).toHaveValue("2010-05-06T07:08")
  })

  test("gives a photo without EXIF the date, and saves the album as a ZIP", async ({ page }) => {
    await addPhotos(page, PHOTOS)
    await page.locator('.photo input[type="datetime-local"]').nth(1).fill("1995-12-24T18:00")
    const [download] = await Promise.all([page.waitForEvent("download"), page.locator("[data-zip]").click()])
    const zip = await JSZip.loadAsync(await readFile(await download.path()))
    expect(Object.keys(zip.files).sort()).toEqual(["exif-landscape.jpg", "no-exif-portrait.jpg", "no-exif-square.jpg"])

    const portrait = await zip.file("no-exif-portrait.jpg")!.async("uint8array")
    expect(exifDate((await tags(portrait)).DateTimeOriginal)).toBe("1995:12:24 18:00:00")
    // Its picture is the original's, with an EXIF added.
    expect(withoutExif(portrait).equals(await readFile(PHOTOS[1]))).toBe(true)
    // An unchanged photo keeps its own date.
    const landscape = await zip.file("exif-landscape.jpg")!.async("uint8array")
    expect(exifDate((await tags(landscape)).DateTimeOriginal)).toBe("1998:07:14 18:30:00")
  })

  test("saves a HEIC as a JPEG with the new date", async ({ page }) => {
    await addPhotos(page, [fixture("exif-landscape.heic")])
    await page.locator('.photo input[type="datetime-local"]').fill("2020-01-02T03:04")
    const [download] = await Promise.all([page.waitForEvent("download"), page.locator("[data-save-all]").click()])
    expect(download.suggestedFilename()).toBe("exif-landscape.jpg")
    const saved = await readFile(await download.path())
    expect([...saved.subarray(0, 2)]).toEqual([0xff, 0xd8])
    expect(exifDate((await tags(saved)).DateTimeOriginal)).toBe("2020:01:02 03:04:00")
  })

  test("prints nothing on the picture", async ({ page }) => {
    await addPhotos(page, [fixture("exif-landscape.jpg")])
    // The card shows the photo as it is: no stamp settings on this page.
    await expect(page.locator("[data-options] input[name=style]")).toHaveCount(0)
    await expect(page.locator(".photo canvas")).toBeVisible()
  })
})

test("the editor is as tall as the date stamp editor", async ({ page, isMobile }) => {
  test.skip(isMobile, "stacked on a phone: each column as tall as its content")
  const height = async (path: string, selector: string) => {
    await visit(page, path)
    return (await page.locator(selector).boundingBox())!.height
  }
  for (const locale of ["pl", "de", "en"] as const) {
    expect(await height(pathOf("exif", locale), "[data-exif-editor]")).toBe(await height(pathOf("home", locale), "[data-editor]"))
  }
})

test("the navbar links the page and marks it current", async ({ page, isMobile }) => {
  await visit(page, "/pl/")
  if (isMobile) await page.getByRole("button", { name: strings.pl.nav.menu }).click()
  const links = page.locator(isMobile ? "#mobile-menu" : "header nav")
  await links.getByRole("link", { name: strings.pl.nav.exif }).click()
  await expect(page).toHaveURL(new RegExp(`${PAGE}$`))
  await expect(page.locator("h1")).toHaveText(strings.pl.exif.h1)
  if (!isMobile) await expect(page.locator('header nav > ul a[aria-current="page"]')).toHaveText(strings.pl.nav.exif)
})

test("the page links to the date stamp", async ({ page }) => {
  await visit(page, PAGE)
  await page.getByRole("link", { name: strings.pl.exif.stamp.cta }).click()
  await expect(page).toHaveURL(/\/pl\/$/)
})

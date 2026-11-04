import exifr from "exifr"
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { buildExif, exifDate, exifSegment, fitExif, insertExif, redateJpeg } from "../../src/lib/exif"

const fixture = (name: string) => new Uint8Array(readFileSync(new URL(`../fixtures/${name}`, import.meta.url)))
// A stand-in for what a canvas encodes: a JPEG with a JFIF segment and no EXIF.
const canvasJpeg = () => {
  const original = fixture("no-exif-square.jpg")
  expect(exifSegment(original)).toBeNull()
  return original
}
const parse = (jpeg: Uint8Array) => exifr.parse(jpeg, { tiff: true, exif: true, gps: true, translateValues: false })

describe("exifSegment", () => {
  it("finds the EXIF of a camera photo and nothing in a photo without one", () => {
    expect(exifSegment(fixture("exif-full.jpg"))?.slice(0, 2)).toEqual(new Uint8Array([0xff, 0xe1]))
    expect(exifSegment(fixture("no-exif-portrait.jpg"))).toBeNull()
    expect(exifSegment(new TextEncoder().encode("not a jpeg"))).toBeNull()
  })
})

describe("fitExif + insertExif", () => {
  it("keeps the date, the camera and the place", async () => {
    const segment = fitExif(exifSegment(fixture("exif-full.jpg"))!, { width: 1600, height: 1200 })!
    const tags = await parse(insertExif(canvasJpeg(), segment))
    expect(exifDate(tags.DateTimeOriginal)).toBe("2019:08:03 12:34:56")
    expect(tags.Make).toBe("TestCam")
    expect(tags.Model).toBe("X100")
    expect(tags.latitude).toBeCloseTo(50.0614, 3)
    expect(tags.longitude).toBeCloseTo(19.9366, 3)
  })

  it("turns the orientation upright and writes the new size", async () => {
    const segment = fitExif(exifSegment(fixture("rotated.jpg"))!, { width: 600, height: 800 })!
    const tags = await parse(insertExif(canvasJpeg(), segment))
    expect(tags.Orientation).toBe(1)
  })

  it("writes the new pixel size (a big photo is scaled down on export)", async () => {
    const segment = fitExif(exifSegment(fixture("exif-full.jpg"))!, { width: 800, height: 600 })!
    const tags = await parse(insertExif(canvasJpeg(), segment))
    expect([tags.ExifImageWidth, tags.ExifImageHeight]).toEqual([800, 600])
  })

  it("writes a changed date", async () => {
    const segment = fitExif(exifSegment(fixture("exif-full.jpg"))!, { width: 1600, height: 1200, date: new Date(2001, 1, 3, 4, 5, 6) })!
    const tags = await parse(insertExif(canvasJpeg(), segment))
    expect(exifDate(tags.DateTimeOriginal)).toBe("2001:02:03 04:05:06")
  })

  it("puts EXIF right after the start of the file, instead of the canvas's JFIF", () => {
    const out = insertExif(canvasJpeg(), buildExif(new Date()))
    expect([...out.slice(0, 4)]).toEqual([0xff, 0xd8, 0xff, 0xe1])
    expect(exifSegment(out)).not.toBeNull()
  })

  it("gives up on a broken segment instead of writing garbage", () => {
    const broken = exifSegment(fixture("exif-full.jpg"))!.slice(0, 20)
    expect(fitExif(broken, { width: 1, height: 1 })).toBeNull()
  })
})

describe("buildExif", () => {
  it("is a valid EXIF with the date and an upright orientation", async () => {
    const tags = await parse(insertExif(canvasJpeg(), buildExif(new Date(2026, 6, 14, 18, 30, 0))))
    expect(exifDate(tags.DateTimeOriginal)).toBe("2026:07:14 18:30:00")
    expect(tags.Orientation).toBe(1)
  })
})

// Everything but the EXIF segment: the picture itself, which redating must not touch.
const withoutExif = (jpeg: Uint8Array) => {
  const segment = exifSegment(jpeg)
  if (!segment) return jpeg
  const at = jpeg.findIndex((_, index) => jpeg[index] === 0xff && jpeg[index + 1] === 0xe1)
  return new Uint8Array([...jpeg.subarray(0, at), ...jpeg.subarray(at + segment.length)])
}

/** A JPEG whose EXIF has a camera and an orientation but no date (some edited photos are like that). */
const jpegWithUndatedExif = (little: boolean) => {
  const tiff = new Uint8Array(8 + 2 + 2 * 12 + 4 + 8)
  const view = new DataView(tiff.buffer)
  tiff.set(little ? [0x49, 0x49] : [0x4d, 0x4d])
  view.setUint16(2, 42, little)
  view.setUint32(4, 8, little)
  view.setUint16(8, 2, little)
  const entry = (at: number, tag: number, type: number, count: number, value: number) => {
    view.setUint16(at, tag, little)
    view.setUint16(at + 2, type, little)
    view.setUint32(at + 4, count, little)
    if (type === 3) view.setUint16(at + 8, value, little)
    else view.setUint32(at + 8, value, little)
  }
  entry(10, 0x010f, 2, 8, 38) // Make → "TestCam\0" after the IFD
  entry(22, 0x0112, 3, 1, 6) // Orientation 6
  view.setUint32(34, 0, little)
  tiff.set(new TextEncoder().encode("TestCam\0"), 38)
  const length = 2 + 6 + tiff.length
  const segment = new Uint8Array([0xff, 0xe1, length >> 8, length & 0xff, 0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff])
  return insertExif(canvasJpeg(), segment)
}

describe("redateJpeg", () => {
  const date = new Date(2001, 1, 3, 4, 5, 6)

  it("changes the date and keeps the picture, the camera and the place", async () => {
    const original = fixture("exif-full.jpg")
    const out = redateJpeg(original, date)!
    expect(withoutExif(out)).toEqual(withoutExif(original))
    const tags = await parse(out)
    expect(exifDate(tags.DateTimeOriginal)).toBe("2001:02:03 04:05:06")
    expect(exifDate(tags.CreateDate)).toBe("2001:02:03 04:05:06")
    expect(tags.Make).toBe("TestCam")
    expect(tags.LensModel).toBeDefined()
    expect(tags.latitude).toBeCloseTo(50.0614, 3)
    expect([tags.ExifImageWidth, tags.ExifImageHeight]).toEqual([1600, 1200])
    // In place: the segment keeps its size.
    expect(exifSegment(out)!.length).toBe(exifSegment(original)!.length)
  })

  it("keeps the orientation: the pixels are not turned", async () => {
    const tags = await parse(redateJpeg(fixture("rotated.jpg"), date)!)
    expect(tags.Orientation).toBe(6)
    expect(exifDate(tags.DateTimeOriginal)).toBe("2001:02:03 04:05:06")
  })

  it("adds a CreateDate the photo did not have", async () => {
    const original = fixture("exif-landscape.jpg")
    expect((await parse(original)).CreateDate).toBeUndefined()
    const out = redateJpeg(original, date)!
    expect(withoutExif(out)).toEqual(withoutExif(original))
    const tags = await parse(out)
    expect(exifDate(tags.DateTimeOriginal)).toBe("2001:02:03 04:05:06")
    expect(exifDate(tags.CreateDate)).toBe("2001:02:03 04:05:06")
    expect(tags.ColorSpace).toBe((await parse(original)).ColorSpace)
  })

  it.each([true, false])("adds the dates to an EXIF without any (little-endian: %s), keeping its fields", async (little) => {
    const original = jpegWithUndatedExif(little)
    const out = redateJpeg(original, date)!
    expect(withoutExif(out)).toEqual(withoutExif(original))
    const tags = await parse(out)
    expect(exifDate(tags.DateTimeOriginal)).toBe("2001:02:03 04:05:06")
    expect(tags.Make).toBe("TestCam")
    expect(tags.Orientation).toBe(6)
  })

  it("gives a photo without EXIF a minimal one, after its JFIF segment", async () => {
    const original = fixture("no-exif-portrait.jpg")
    const out = redateJpeg(original, date)!
    expect([...out.slice(0, 4)]).toEqual([0xff, 0xd8, 0xff, 0xe0])
    expect(withoutExif(out)).toEqual(original)
    expect(exifDate((await parse(out)).DateTimeOriginal)).toBe("2001:02:03 04:05:06")
  })

  it("replaces an unreadable EXIF with a minimal one", async () => {
    const broken = fixture("exif-landscape.jpg")
    const at = broken.findIndex((_, index) => broken[index] === 0xff && broken[index + 1] === 0xe1)
    broken.set([0, 0], at + 10) // the byte order mark
    const tags = await parse(redateJpeg(broken, date)!)
    expect(exifDate(tags.DateTimeOriginal)).toBe("2001:02:03 04:05:06")
  })

  it("refuses what is not a JPEG", () => {
    expect(redateJpeg(new TextEncoder().encode("not a jpeg"), date)).toBeNull()
  })
})

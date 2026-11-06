import { describe, expect, it } from "vitest"
import { droppedPhotos, uniqueName } from "../../src/lib/files"
import { stampedFileName } from "../../src/lib/photo"

const file = (name: string, type: string) => new File(["x"], name, { type })
const transfer = (files: File[], items: File[] = []) =>
  ({ files, items: items.map((item) => ({ getAsFile: () => item })) }) as unknown as DataTransfer

describe("droppedPhotos", () => {
  it("takes images and drops other files", () => {
    const photos = droppedPhotos(transfer([file("a.jpg", "image/jpeg"), file("notes.txt", "text/plain")]))
    expect(photos.map((photo) => photo.name)).toEqual(["a.jpg"])
  })

  it("takes files without a MIME type (macOS Photos, HEIC in Chrome)", () => {
    const photos = droppedPhotos(transfer([file("IMG_1.HEIC", ""), file("export", "")]))
    expect(photos.map((photo) => photo.name)).toEqual(["IMG_1.HEIC", "export"])
  })

  it("falls back to the items when files is empty", () => {
    const photos = droppedPhotos(transfer([], [file("b.png", "image/png")]))
    expect(photos.map((photo) => photo.name)).toEqual(["b.png"])
  })
})

describe("uniqueName", () => {
  it("keeps a free name", () => {
    expect(uniqueName(() => false, "IMG_1-date.jpg")).toBe("IMG_1-date.jpg")
  })

  it("numbers a taken one", () => {
    const taken = new Set(["IMG_1-date.jpg", "IMG_1-date-2.jpg"])
    expect(uniqueName((name) => taken.has(name), "IMG_1-date.jpg")).toBe("IMG_1-date-3.jpg")
  })
})

describe("stampedFileName", () => {
  it("always gives a .jpg", () => {
    expect(stampedFileName("IMG_0001.HEIC")).toBe("IMG_0001-date.jpg")
    expect(stampedFileName("holiday.photo.png")).toBe("holiday.photo-date.jpg")
  })
})

  it("numbers an extensionless name without looping", () => {
    const taken = new Set(["export", "export-2"])
    expect(uniqueName((name) => taken.has(name), "export")).toBe("export-3")
  })
